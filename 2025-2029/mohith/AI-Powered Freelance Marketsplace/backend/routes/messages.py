from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import or_, and_
from backend.models import db, Message, User, Order
from backend.services.ai_service import AIService

messages_bp = Blueprint('messages', __name__)

@messages_bp.route('/history/<int:other_user_id>', methods=['GET'])
@jwt_required()
def get_chat_history(other_user_id):
    current_user_id = get_jwt_identity()
    
    # Retrieve messages sent between current_user and other_user
    messages = Message.query.filter(
        or_(
            and_(Message.sender_id == current_user_id, Message.receiver_id == other_user_id),
            and_(Message.sender_id == other_user_id, Message.receiver_id == current_user_id)
        )
    ).order_by(Message.created_at.asc()).all()
    
    # Mark incoming messages as read
    unread_messages = Message.query.filter_by(
        sender_id=other_user_id, 
        receiver_id=current_user_id, 
        is_read=False
    ).all()
    
    for msg in unread_messages:
        msg.is_read = True
    if unread_messages:
        db.session.commit()
        
    return jsonify([m.to_dict() for m in messages]), 200


@messages_bp.route('/contacts', methods=['GET'])
@jwt_required()
def get_contacts():
    current_user_id = get_jwt_identity()
    
    # Find all unique users who sent messages to or received messages from current user
    sent_to = db.session.query(Message.receiver_id).filter(Message.sender_id == current_user_id).distinct().all()
    received_from = db.session.query(Message.sender_id).filter(Message.receiver_id == current_user_id).distinct().all()
    
    contact_ids = set([r[0] for r in sent_to] + [r[0] for r in received_from])
    
    contacts = []
    for cid in contact_ids:
        c_user = User.query.get(cid)
        if c_user:
            # Get latest message
            latest_msg = Message.query.filter(
                or_(
                    and_(Message.sender_id == current_user_id, Message.receiver_id == cid),
                    and_(Message.sender_id == cid, Message.receiver_id == current_user_id)
                )
            ).order_by(Message.created_at.desc()).first()
            
            contacts.append({
                "id": c_user.id,
                "first_name": c_user.first_name,
                "last_name": c_user.last_name,
                "role": c_user.role,
                "latest_message": latest_msg.content if latest_msg else "",
                "latest_message_time": latest_msg.created_at.isoformat() if latest_msg else None,
                "unread": latest_msg.is_read == False if (latest_msg and latest_msg.sender_id == cid) else False
            })
            
    # Sort contacts by latest message time
    contacts.sort(key=lambda x: x['latest_message_time'] or "", reverse=True)
    return jsonify(contacts), 200


@messages_bp.route('/chatbot', methods=['POST'])
@jwt_required(optional=True)
def chatbot():
    current_user_id = get_jwt_identity()
    data = request.get_json() or {}
    message = data.get('message', '')
    
    if not message:
        return jsonify({"error": "Message is required"}), 400
        
    order_status = None
    wallet_balance = None
    
    if current_user_id:
        user = User.query.get(current_user_id)
        if user:
            # Get latest active order status
            if user.role == 'client':
                latest_order = Order.query.filter_by(client_id=current_user_id).order_by(Order.created_at.desc()).first()
            else:
                latest_order = Order.query.filter_by(freelancer_id=current_user_id).order_by(Order.created_at.desc()).first()
            if latest_order:
                order_status = latest_order.status
                
            if user.wallet:
                wallet_balance = float(user.wallet.balance)
                
    response_text = AIService.support_chat(message, order_status=order_status, wallet_balance=wallet_balance)
    return jsonify({"reply": response_text}), 200
