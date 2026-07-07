import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_socketio import SocketIO, emit, join_room, leave_room
from werkzeug.security import generate_password_hash

from backend.config import Config
from backend.models.db import db
from backend.models import (
    User, FreelancerProfile, ClientProfile, Service, Order, Payment,
    Wallet, Transaction, Review, Message, Notification, SupportTicket, Refund, AuditLog
)
from backend.services.payment_service import PaymentService

# Instantiate Socket.IO
socketio = SocketIO(cors_allowed_origins="*")

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # Enable CORS
    CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)
    
    # Initialize Database and JWT
    db.init_app(app)
    jwt = JWTManager(app)
    
    # Initialize Socket.IO
    socketio.init_app(app)
    
    # Ensure uploads directory exists
    if not os.path.exists(app.config['UPLOAD_FOLDER']):
        os.makedirs(app.config['UPLOAD_FOLDER'])
        
    # Register blueprints (we will create them next)
    from backend.routes.auth import auth_bp
    from backend.routes.users import users_bp
    from backend.routes.services import services_bp
    from backend.routes.orders import orders_bp
    from backend.routes.payments import payments_bp
    from backend.routes.wallet import wallet_bp
    from backend.routes.messages import messages_bp
    from backend.routes.admin import admin_bp
    
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(users_bp, url_prefix='/api/users')
    app.register_blueprint(services_bp, url_prefix='/api/services')
    app.register_blueprint(orders_bp, url_prefix='/api/orders')
    app.register_blueprint(payments_bp, url_prefix='/api/payments')
    app.register_blueprint(wallet_bp, url_prefix='/api/wallet')
    app.register_blueprint(messages_bp, url_prefix='/api/messages')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    
    # Central error handlers
    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Resource not found"}), 404
        
    @app.errorhandler(500)
    def server_error(e):
        return jsonify({"error": "Internal server error", "details": str(e)}), 500
        
    # Database Initialization & Seeding helper
    with app.app_context():
        db.create_all()
        # Seed if empty
        if not User.query.first():
            print("Database is empty. Seeding database...")
            try:
                # Read seed.sql and apply it
                seed_path = os.path.join(os.path.dirname(__file__), '../database/seed.sql')
                if os.path.exists(seed_path):
                    with open(seed_path, 'r', encoding='utf-8') as f:
                        sql_commands = f.read().split(';')
                        for command in sql_commands:
                            if command.strip():
                                db.session.execute(db.text(command))
                    db.session.commit()
                    print("Seed completed successfully!")
                else:
                    print("Seed file not found at", seed_path)
            except Exception as e:
                db.session.rollback()
                print("Error seeding database:", e)
                
    return app

app = create_app()

# Real-Time Chat (Socket.IO) Events
@socketio.on('connect')
def handle_connect():
    print(f"Client connected: {request.sid}")

@socketio.on('join')
def handle_join(data):
    """
    User joins their private notification room or a mutual chat room.
    """
    room = data.get('room')
    if room:
        join_room(room)
        print(f"User room joined: {room}")
        emit('status', {'msg': f'Joined room: {room}'}, room=room)

@socketio.on('leave')
def handle_leave(data):
    room = data.get('room')
    if room:
        leave_room(room)
        print(f"User room left: {room}")

@socketio.on('message')
def handle_message(data):
    """
    Sends message in a room.
    data format: { sender_id, receiver_id, content, room, file_url, file_type }
    """
    from backend.models.message import Message
    from backend.models.misc import Notification
    
    sender_id = data.get('sender_id')
    receiver_id = data.get('receiver_id')
    content = data.get('content', '')
    room = data.get('room')
    file_url = data.get('file_url', '')
    file_type = data.get('file_type', '')
    
    if not sender_id or not receiver_id or not room:
        return
        
    try:
        # Create message in DB
        new_msg = Message(
            sender_id=sender_id,
            receiver_id=receiver_id,
            content=content,
            file_url=file_url,
            file_type=file_type,
            is_read=False
        )
        db.session.add(new_msg)
        db.session.commit()
        
        # Broadcast message to the chat room
        emit('message_received', new_msg.to_dict(), room=room)
        
        # Notify receiver in their personal notifications channel
        receiver_notification_room = f"user_{receiver_id}"
        emit('notification_received', {
            "type": "message",
            "content": f"New message from user #{sender_id}",
            "message": new_msg.to_dict()
        }, room=receiver_notification_room)
        
    except Exception as e:
        print("SocketIO message processing error:", e)

@socketio.on('typing')
def handle_typing(data):
    """
    Emits typing indicator to room.
    data format: { room, user_id, is_typing }
    """
    room = data.get('room')
    user_id = data.get('user_id')
    is_typing = data.get('is_typing', False)
    if room and user_id:
        emit('typing_status', {'user_id': user_id, 'is_typing': is_typing}, room=room, include_self=False)

@socketio.on('disconnect')
def handle_disconnect():
    print(f"Client disconnected: {request.sid}")

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
