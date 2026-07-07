from datetime import datetime
from backend.models.db import db

class Message(db.Model):
    __tablename__ = 'messages'
    
    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    receiver_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    content = db.Column(db.Text, default='')
    file_url = db.Column(db.Text, default='')
    file_type = db.Column(db.String(50), default='')  # 'image', 'document', 'archive', etc.
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    sender = db.relationship('User', foreign_keys=[sender_id], backref='sent_messages')
    receiver = db.relationship('User', foreign_keys=[receiver_id], backref='received_messages')
    
    def to_dict(self):
        sender_name = f"{self.sender.first_name} {self.sender.last_name}" if self.sender else ""
        return {
            'id': self.id,
            'sender_id': self.sender_id,
            'sender_name': sender_name,
            'receiver_id': self.receiver_id,
            'content': self.content,
            'file_url': self.file_url,
            'file_type': self.file_type,
            'is_read': self.is_read,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
