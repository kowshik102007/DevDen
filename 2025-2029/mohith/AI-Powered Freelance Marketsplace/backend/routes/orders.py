from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from backend.models import db, Order, Service, User, Notification
from backend.services.payment_service import PaymentService

orders_bp = Blueprint('orders', __name__)

@orders_bp.route('', methods=['POST'])
@jwt_required()
def create_order():
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)
    if not user or user.role != 'client':
        return jsonify({"error": "Only clients can purchase services"}), 403
        
    data = request.get_json() or {}
    service_id = data.get('service_id')
    requirements = data.get('requirements', '')
    
    if not service_id:
        return jsonify({"error": "Service ID is required"}), 400
        
    service = Service.query.get(service_id)
    if not service or not service.active:
        return jsonify({"error": "Service not available"}), 404
        
    try:
        # Calculate delivery date
        delivery_date = datetime.utcnow() + timedelta(days=service.delivery_days)
        
        # Create order in 'pending' status (waiting for payment verification)
        order = Order(
            service_id=service_id,
            client_id=current_user_id,
            freelancer_id=service.freelancer_id,
            status='pending',
            price=service.price,
            delivery_date=delivery_date,
            requirements_submitted=requirements
        )
        db.session.add(order)
        db.session.commit()
        
        # Send Notification to freelancer
        notif = Notification(
            user_id=service.freelancer_id,
            content=f"You have a new pending contract request for: '{service.title[:50]}...'",
            type='order'
        )
        db.session.add(notif)
        db.session.commit()
        
        return jsonify({
            "message": "Order created successfully. Please proceed to payment.",
            "order": order.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Failed to create order", "details": str(e)}), 500


@orders_bp.route('', methods=['GET'])
@jwt_required()
def get_orders():
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
        
    if user.role == 'client':
        orders = Order.query.filter_by(client_id=current_user_id).order_by(Order.created_at.desc()).all()
    elif user.role == 'freelancer':
        orders = Order.query.filter_by(freelancer_id=current_user_id).order_by(Order.created_at.desc()).all()
    else: # admin
        orders = Order.query.order_by(Order.created_at.desc()).all()
        
    return jsonify([o.to_dict() for o in orders]), 200


@orders_bp.route('/<int:order_id>', methods=['GET'])
@jwt_required()
def get_order_details(order_id):
    current_user_id = int(get_jwt_identity())
    order = Order.query.get(order_id)
    if not order:
        return jsonify({"error": "Order not found"}), 404
        
    # Check permissions
    if current_user_id not in [order.client_id, order.freelancer_id] and User.query.get(current_user_id).role != 'admin':
        return jsonify({"error": "Unauthorized to view this order"}), 403
        
    return jsonify(order.to_dict()), 200


@orders_bp.route('/<int:order_id>/submit-requirements', methods=['POST'])
@jwt_required()
def submit_requirements(order_id):
    current_user_id = int(get_jwt_identity())
    order = Order.query.get(order_id)
    if not order or order.client_id != current_user_id:
        return jsonify({"error": "Unauthorized"}), 403
        
    data = request.get_json() or {}
    requirements = data.get('requirements')
    if not requirements:
        return jsonify({"error": "Requirements cannot be empty"}), 400
        
    order.requirements_submitted = requirements
    if order.status == 'pending':
        order.status = 'active'
        
    db.session.commit()
    return jsonify({"message": "Requirements submitted successfully", "order": order.to_dict()}), 200


@orders_bp.route('/<int:order_id>/deliver', methods=['POST'])
@jwt_required()
def deliver_order(order_id):
    current_user_id = int(get_jwt_identity())
    order = Order.query.get(order_id)
    if not order or order.freelancer_id != current_user_id:
        return jsonify({"error": "Unauthorized to deliver this order"}), 403
        
    data = request.get_json() or {}
    attachment_url = data.get('attachment_url', '')
    note = data.get('note', '')
    
    if not note:
        return jsonify({"error": "Delivery description note is required"}), 400
        
    try:
        order.status = 'delivered'
        order.delivery_attachment_url = attachment_url
        order.delivery_note = note
        
        # Notify client
        notif = Notification(
            user_id=order.client_id,
            content=f"Freelancer has delivered your work for Order #{order.id}. Please review it.",
            type='order'
        )
        db.session.add(notif)
        db.session.commit()
        
        return jsonify({"message": "Work delivered successfully", "order": order.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Delivery submission failed", "details": str(e)}), 500


@orders_bp.route('/<int:order_id>/complete', methods=['POST'])
@jwt_required()
def complete_order(order_id):
    current_user_id = int(get_jwt_identity())
    order = Order.query.get(order_id)
    if not order or order.client_id != current_user_id:
        return jsonify({"error": "Unauthorized to complete this order"}), 403
        
    if order.status != 'delivered':
        return jsonify({"error": "Order must be in delivered state to complete"}), 400
        
    try:
        order.status = 'completed'
        order.completed_at = datetime.utcnow()
        db.session.flush()
        
        # Release funds from escrow to freelancer
        success, msg = PaymentService.release_escrow(order.id)
        if not success:
            db.session.rollback()
            return jsonify({"error": "Failed to release escrow funds", "details": msg}), 500
            
        # Notify freelancer
        notif = Notification(
            user_id=order.freelancer_id,
            content=f"Client accepted delivery. Escrow funds released for Order #{order.id}!",
            type='order'
        )
        db.session.add(notif)
        db.session.commit()
        
        return jsonify({"message": "Order completed and funds cleared!", "order": order.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Completion processing failed", "details": str(e)}), 500


@orders_bp.route('/<int:order_id>/revision', methods=['POST'])
@jwt_required()
def request_revision(order_id):
    current_user_id = int(get_jwt_identity())
    order = Order.query.get(order_id)
    if not order or order.client_id != current_user_id:
        return jsonify({"error": "Unauthorized"}), 403
        
    data = request.get_json() or {}
    note = data.get('note', '')
    if not note:
        return jsonify({"error": "Revision comments are required"}), 400
        
    try:
        order.status = 'revision_requested'
        order.delivery_note = f"Revision Request: {note}"
        
        # Notify freelancer
        notif = Notification(
            user_id=order.freelancer_id,
            content=f"Revision requested for Order #{order.id}. Comments: {note}",
            type='order'
        )
        db.session.add(notif)
        db.session.commit()
        
        return jsonify({"message": "Revision requested successfully", "order": order.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Failed to request revision", "details": str(e)}), 500
