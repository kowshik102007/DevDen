from datetime import datetime
from backend.models.db import db

class Notification(db.Model):
    __tablename__ = 'notifications'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    is_read = db.Column(db.Boolean, default=False)
    type = db.Column(db.String(100), default='general')  # 'order', 'payment', 'message', 'review'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref='notifications')
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'content': self.content,
            'is_read': self.is_read,
            'type': self.type,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class SupportTicket(db.Model):
    __tablename__ = 'support_tickets'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    subject = db.Column(db.String(255), nullable=False)
    message = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(50), default='open')  # 'open', 'resolved', 'closed'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref='tickets')
    
    def to_dict(self):
        user_name = f"{self.user.first_name} {self.user.last_name}" if self.user else ""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'user_name': user_name,
            'subject': self.subject,
            'message': self.message,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Refund(db.Model):
    __tablename__ = 'refunds'
    
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id', ondelete='CASCADE'), nullable=False)
    status = db.Column(db.String(50), default='pending')  # 'pending', 'approved', 'rejected'
    reason = db.Column(db.Text, nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    order = db.relationship('Order', backref='refund')
    
    def to_dict(self):
        return {
            'id': self.id,
            'order_id': self.order_id,
            'status': self.status,
            'reason': self.reason,
            'amount': float(self.amount),
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class AuditLog(db.Model):
    __tablename__ = 'audit_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    action = db.Column(db.Text, nullable=False)
    ip_address = db.Column(db.String(45), default='')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User')
    
    def to_dict(self):
        user_email = self.user.email if self.user else "System"
        return {
            'id': self.id,
            'user_id': self.user_id,
            'user_email': user_email,
            'action': self.action,
            'ip_address': self.ip_address,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
