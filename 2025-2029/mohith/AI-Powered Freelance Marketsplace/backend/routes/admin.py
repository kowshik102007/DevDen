from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from backend.models import db, User, Service, Order, Payment, Refund, AuditLog, Wallet
from backend.services.payment_service import PaymentService

admin_bp = Blueprint('admin', __name__)

def is_admin(user_id):
    user = User.query.get(user_id)
    return user and user.role == 'admin'

@admin_bp.route('/dashboard', methods=['GET'])
@jwt_required()
def get_admin_dashboard():
    current_user_id = get_jwt_identity()
    if not is_admin(current_user_id):
        return jsonify({"error": "Admin access required"}), 403
        
    try:
        total_users = User.query.count()
        total_freelancers = User.query.filter_by(role='freelancer').count()
        total_clients = User.query.filter_by(role='client').count()
        
        total_services = Service.query.count()
        total_orders = Order.query.count()
        
        # Calculate gross transaction volume
        total_revenue = db.session.query(db.func.sum(Payment.amount)).filter(Payment.status == 'completed').scalar() or 0.0
        
        # Category breakdown
        category_counts = db.session.query(
            Service.category, db.func.count(Service.id)
        ).group_by(Service.category).all()
        
        categories_share = [{"category": row[0], "count": row[1]} for row in category_counts]
        
        # Monthly sales simulation or simple dynamic counts
        monthly_sales = [
            {"month": "Jan", "sales": int(total_revenue * 0.1)},
            {"month": "Feb", "sales": int(total_revenue * 0.15)},
            {"month": "Mar", "sales": int(total_revenue * 0.2)},
            {"month": "Apr", "sales": int(total_revenue * 0.18)},
            {"month": "May", "sales": int(total_revenue * 0.25)},
            {"month": "Jun", "sales": int(total_revenue)}
        ]
        
        # Pending refund claims
        pending_refunds = Refund.query.filter_by(status='pending').count()
        
        return jsonify({
            "metrics": {
                "total_users": total_users,
                "total_freelancers": total_freelancers,
                "total_clients": total_clients,
                "total_services": total_services,
                "total_orders": total_orders,
                "total_revenue": float(total_revenue),
                "pending_refunds": pending_refunds
            },
            "categories_share": categories_share,
            "monthly_sales": monthly_sales
        }), 200
        
    except Exception as e:
        return jsonify({"error": "Failed to fetch admin stats", "details": str(e)}), 500


@admin_bp.route('/users', methods=['GET'])
@jwt_required()
def get_all_users():
    current_user_id = get_jwt_identity()
    if not is_admin(current_user_id):
        return jsonify({"error": "Admin access required"}), 403
        
    users = User.query.order_by(User.created_at.desc()).all()
    user_list = []
    for u in users:
        u_dict = u.to_dict()
        u_dict['balance'] = float(u.wallet.balance) if u.wallet else 0.0
        user_list.append(u_dict)
        
    return jsonify(user_list), 200


@admin_bp.route('/services/<int:service_id>/toggle', methods=['POST'])
@jwt_required()
def toggle_service(service_id):
    current_user_id = get_jwt_identity()
    if not is_admin(current_user_id):
        return jsonify({"error": "Admin access required"}), 403
        
    service = Service.query.get(service_id)
    if not service:
        return jsonify({"error": "Service not found"}), 404
        
    service.active = not service.active
    db.session.commit()
    
    return jsonify({
        "message": f"Service active state set to {service.active}",
        "service": service.to_dict()
    }), 200


@admin_bp.route('/refunds', methods=['GET'])
@jwt_required()
def get_refund_tickets():
    current_user_id = get_jwt_identity()
    if not is_admin(current_user_id):
        return jsonify({"error": "Admin access required"}), 403
        
    refunds = Refund.query.order_by(Refund.created_at.desc()).all()
    return jsonify([r.to_dict() for r in refunds]), 200


@admin_bp.route('/refunds/<int:refund_id>/resolve', methods=['POST'])
@jwt_required()
def resolve_refund(refund_id):
    current_user_id = get_jwt_identity()
    if not is_admin(current_user_id):
        return jsonify({"error": "Admin access required"}), 403
        
    refund = Refund.query.get(refund_id)
    if not refund:
        return jsonify({"error": "Refund claim not found"}), 404
        
    data = request.get_json() or {}
    decision = data.get('decision')  # 'approve', 'reject'
    
    if decision not in ['approve', 'reject']:
        return jsonify({"error": "Decision must be either 'approve' or 'reject'"}), 400
        
    try:
        if decision == 'approve':
            # Call transaction refund workflow
            success, msg = PaymentService.process_refund(refund.order_id, reason=refund.reason)
            if not success:
                return jsonify({"error": "Escrow reversal failed", "details": msg}), 400
            refund.status = 'approved'
        else:
            refund.status = 'rejected'
            
        db.session.commit()
        return jsonify({"message": f"Refund claim resolved as: {decision}", "refund": refund.to_dict()}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Refund resolution crash", "details": str(e)}), 500
