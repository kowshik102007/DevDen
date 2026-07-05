from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from backend.models import db, User, Wallet, Transaction

wallet_bp = Blueprint('wallet', __name__)

@wallet_bp.route('', methods=['GET'])
@jwt_required()
def get_wallet():
    current_user_id = get_jwt_identity()
    wallet = Wallet.query.filter_by(user_id=current_user_id).first()
    if not wallet:
        # Create wallet on the fly if missing
        from backend.services.payment_service import PaymentService
        wallet = PaymentService.initialize_wallet(current_user_id)
        
    return jsonify(wallet.to_dict()), 200


@wallet_bp.route('/transactions', methods=['GET'])
@jwt_required()
def get_transactions():
    current_user_id = get_jwt_identity()
    wallet = Wallet.query.filter_by(user_id=current_user_id).first()
    if not wallet:
        return jsonify([]), 200
        
    txns = Transaction.query.filter_by(wallet_id=wallet.id).order_by(Transaction.created_at.desc()).all()
    return jsonify([t.to_dict() for t in txns]), 200


@wallet_bp.route('/deposit', methods=['POST'])
@jwt_required()
def deposit():
    current_user_id = get_jwt_identity()
    wallet = Wallet.query.filter_by(user_id=current_user_id).first()
    if not wallet:
        return jsonify({"error": "Wallet not found"}), 404
        
    data = request.get_json() or {}
    amount = data.get('amount', 0.0)
    method = data.get('method', 'UPI')
    
    if amount <= 0:
        return jsonify({"error": "Deposit amount must be greater than zero"}), 400
        
    try:
        wallet.balance += amount
        
        # Log Transaction
        txn = Transaction(
            wallet_id=wallet.id,
            amount=amount,
            type='credit',
            description=f"Deposited funds via {method}",
            status='completed'
        )
        db.session.add(txn)
        
        # Log Notification
        from backend.models import Notification
        notif = Notification(
            user_id=current_user_id,
            content=f"Deposited ₹{amount:.2f} to your SkillBridge wallet.",
            type='payment'
        )
        db.session.add(notif)
        
        db.session.commit()
        return jsonify({"message": "Deposit successful", "wallet": wallet.to_dict()}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Deposit failed", "details": str(e)}), 500


@wallet_bp.route('/withdraw', methods=['POST'])
@jwt_required()
def withdraw():
    current_user_id = get_jwt_identity()
    wallet = Wallet.query.filter_by(user_id=current_user_id).first()
    if not wallet:
        return jsonify({"error": "Wallet not found"}), 404
        
    data = request.get_json() or {}
    amount = data.get('amount', 0.0)
    
    if amount <= 0:
        return jsonify({"error": "Withdrawal amount must be greater than zero"}), 400
        
    if wallet.balance < amount:
        return jsonify({"error": "Insufficient balance"}), 400
        
    try:
        wallet.balance -= amount
        
        # Log Transaction
        txn = Transaction(
            wallet_id=wallet.id,
            amount=amount,
            type='debit',
            description="Withdrawn funds to bank account",
            status='completed'
        )
        db.session.add(txn)
        
        # Log Notification
        from backend.models import Notification
        notif = Notification(
            user_id=current_user_id,
            content=f"Withdrew ₹{amount:.2f} from your SkillBridge wallet.",
            type='payment'
        )
        db.session.add(notif)
        
        db.session.commit()
        return jsonify({"message": "Withdrawal successful", "wallet": wallet.to_dict()}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Withdrawal failed", "details": str(e)}), 500
