from datetime import datetime
from backend.models.db import db

class Payment(db.Model):
    __tablename__ = 'payments'
    
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id', ondelete='CASCADE'), nullable=False)
    status = db.Column(db.String(50), default='pending')  # 'pending', 'completed', 'failed', 'refunded'
    transaction_id = db.Column(db.String(255), unique=True, nullable=False)
    method = db.Column(db.String(50), nullable=False)  # 'UPI', 'Credit Card', 'Debit Card', 'Wallet', 'Net Banking'
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    order = db.relationship('Order', backref='payments')
    
    def to_dict(self):
        return {
            'id': self.id,
            'order_id': self.order_id,
            'status': self.status,
            'transaction_id': self.transaction_id,
            'method': self.method,
            'amount': float(self.amount),
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
