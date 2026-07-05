from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from backend.models import db, Order, User, Payment
from backend.services.payment_service import PaymentService

payments_bp = Blueprint('payments', __name__)

@payments_bp.route('/checkout', methods=['POST'])
@jwt_required()
def checkout():
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)
    if not user or user.role != 'client':
        return jsonify({"error": "Only clients can process checkout payments"}), 403
        
    data = request.get_json() or {}
    order_id = data.get('order_id')
    method = data.get('method')  # 'UPI', 'Credit Card', 'Debit Card', 'Wallet', 'Net Banking'
    
    if not order_id or not method:
        return jsonify({"error": "Order ID and Payment Method are required"}), 400
        
    order = Order.query.get(order_id)
    if not order or order.client_id != current_user_id:
        return jsonify({"error": "Order not found or unauthorized"}), 404
        
    if order.status != 'pending':
        return jsonify({"error": "This order has already been paid or cancelled"}), 400
        
    try:
        # Call checkout service
        success, result_or_msg = PaymentService.process_checkout(order.id, method, order.price)
        
        if not success:
            return jsonify({"error": "Payment failed", "details": result_or_msg}), 400
            
        # Send Notification to freelancer and client
        from backend.models import Notification
        notif_f = Notification(
            user_id=order.freelancer_id,
            content=f"Payment received! Order #{order.id} is now Active. Work can begin.",
            type='order'
        )
        notif_c = Notification(
            user_id=order.client_id,
            content=f"Your payment of ₹{order.price:.2f} for Order #{order.id} was processed securely via {method}.",
            type='payment'
        )
        db.session.add(notif_f)
        db.session.add(notif_c)
        db.session.commit()
        
        return jsonify({
            "message": "Payment processed successfully",
            "transaction_id": result_or_msg,
            "status": "completed",
            "order": order.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Payment checkout execution crashed", "details": str(e)}), 500
