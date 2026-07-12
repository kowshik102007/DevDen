from datetime import datetime
from backend.models.db import db

class Wallet(db.Model):
    __tablename__ = 'wallets'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), unique=True, nullable=False)
    balance = db.Column(db.Numeric(15, 2), default=0.00)
    pending_balance = db.Column(db.Numeric(15, 2), default=0.00)
    
    # Relationships
    transactions = db.relationship('Transaction', backref='wallet', lazy=True, cascade="all, delete-orphan")
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'balance': float(self.balance),
            'pending_balance': float(self.pending_balance)
        }


class Transaction(db.Model):
    __tablename__ = 'transactions'
    
    id = db.Column(db.Integer, primary_key=True)
    wallet_id = db.Column(db.Integer, db.ForeignKey('wallets.id', ondelete='CASCADE'), nullable=False)
    amount = db.Column(db.Numeric(15, 2), nullable=False)
    type = db.Column(db.String(50), nullable=False)  # 'credit', 'debit'
    description = db.Column(db.String(255), nullable=False)
    status = db.Column(db.String(50), default='completed')  # 'pending', 'completed', 'failed'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'wallet_id': self.wallet_id,
            'amount': float(self.amount),
            'type': self.type,
            'description': self.description,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
