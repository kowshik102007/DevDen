from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from backend.models import db, User, FreelancerProfile, ClientProfile, Wallet, AuditLog
from backend.services.payment_service import PaymentService

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    email = data.get('email')
    password = data.get('password')
    first_name = data.get('first_name')
    last_name = data.get('last_name')
    role = data.get('role')  # 'freelancer', 'client'
    
    if not email or not password or not first_name or not last_name or not role:
        return jsonify({"error": "Missing required fields"}), 400
        
    if role not in ['freelancer', 'client']:
        return jsonify({"error": "Invalid role specified"}), 400
        
    # Check if user exists
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already registered"}), 400
        
    try:
        # Create user
        user = User(
            email=email,
            first_name=first_name,
            last_name=last_name,
            role=role,
            is_verified=False
        )
        user.set_password(password)
        db.session.add(user)
        db.session.flush() # gets user.id
        
        # Initialize wallet
        PaymentService.initialize_wallet(user.id)
        
        # Initialize profiles
        if role == 'freelancer':
            profile = FreelancerProfile(user_id=user.id, title="Freelancer")
            db.session.add(profile)
        else:
            profile = ClientProfile(user_id=user.id)
            db.session.add(profile)
            
        # Log action
        log = AuditLog(user_id=user.id, action="User registered", ip_address=request.remote_addr)
        db.session.add(log)
        
        db.session.commit()
        
        # Generate token
        access_token = create_access_token(identity=str(user.id))
        
        return jsonify({
            "message": "User registered successfully",
            "token": access_token,
            "user": user.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Registration failed", "details": str(e)}), 500


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400
        
    user = User.query.filter_by(email=email).first()
    
    # Check password
    # Wait, we support standard check_password. For seeded user, we check seeded hashes or compare pbkdf2.
    # We will let user.check_password(password) evaluate it.
    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid email or password"}), 401
        
    # Generate token
    access_token = create_access_token(identity=str(user.id))
    
    # Audit log
    log = AuditLog(user_id=user.id, action="User logged in", ip_address=request.remote_addr)
    db.session.add(log)
    db.session.commit()
    
    return jsonify({
        "message": "Login successful",
        "token": access_token,
        "user": user.to_dict()
    }), 200


@auth_bp.route('/verify-email', methods=['POST'])
@jwt_required()
def verify_email():
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
        
    user.is_verified = True
    db.session.commit()
    return jsonify({"message": "Email verified successfully"}), 200


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_me():
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
        
    res = user.to_dict()
    if user.role == 'freelancer' and user.freelancer_profile:
        res['profile'] = user.freelancer_profile.to_dict()
    elif user.role == 'client' and user.client_profile:
        res['profile'] = user.client_profile.to_dict()
        
    # Add wallet details
    if user.wallet:
        res['wallet'] = user.wallet.to_dict()
        
    return jsonify(res), 200


@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    data = request.get_json() or {}
    email = data.get('email')
    
    if not email:
        return jsonify({"error": "Email is required"}), 400
        
    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "No account found with this email address"}), 404
        
    # Generate a temporary token valid for 15 minutes
    from datetime import timedelta
    reset_token = create_access_token(identity=str(user.id), expires_delta=timedelta(minutes=15))
    
    # In local development, we return the token directly so the frontend can consume it.
    return jsonify({
        "message": "Password reset token generated. Use it to complete the reset process.",
        "token": reset_token
    }), 200


@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    data = request.get_json() or {}
    token = data.get('token')
    new_password = data.get('new_password')
    
    if not token or not new_password:
        return jsonify({"error": "Token and new password are required"}), 400
        
    from flask_jwt_extended import decode_token
    try:
        decoded = decode_token(token)
        user_id = decoded['sub']
    except Exception as e:
        return jsonify({"error": "Invalid or expired token", "details": str(e)}), 400
        
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
        
    try:
        user.set_password(new_password)
        
        # Log action
        log = AuditLog(user_id=user.id, action="Password reset completed", ip_address=request.remote_addr)
        db.session.add(log)
        db.session.commit()
        
        return jsonify({"message": "Password has been reset successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Failed to reset password", "details": str(e)}), 500
