from datetime import datetime
from backend.models.db import db

class Order(db.Model):
    __tablename__ = 'orders'
    
    id = db.Column(db.Integer, primary_key=True)
    service_id = db.Column(db.Integer, db.ForeignKey('services.id'), nullable=False)
    client_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    freelancer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    status = db.Column(db.String(50), default='pending')  # 'pending', 'active', 'delivered', 'revision_requested', 'completed', 'cancelled', 'refunded'
    price = db.Column(db.Numeric(10, 2), nullable=False)
    delivery_date = db.Column(db.DateTime, nullable=False)
    requirements_submitted = db.Column(db.Text, default='')
    delivery_attachment_url = db.Column(db.Text, default='')
    delivery_note = db.Column(db.Text, default='')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime, nullable=True)
    
    # Relationships
    service = db.relationship('Service', backref='orders')
    client = db.relationship('User', foreign_keys=[client_id], backref='client_orders')
    freelancer = db.relationship('User', foreign_keys=[freelancer_id], backref='freelancer_orders')
    
    def to_dict(self):
        service_title = self.service.title if self.service else "Deleted Service"
        client_name = f"{self.client.first_name} {self.client.last_name}" if self.client else "Unknown Client"
        freelancer_name = f"{self.freelancer.first_name} {self.freelancer.last_name}" if self.freelancer else "Unknown Freelancer"
        
        return {
            'id': self.id,
            'service_id': self.service_id,
            'service_title': service_title,
            'client_id': self.client_id,
            'client_name': client_name,
            'freelancer_id': self.freelancer_id,
            'freelancer_name': freelancer_name,
            'status': self.status,
            'price': float(self.price),
            'delivery_date': self.delivery_date.isoformat() if self.delivery_date else None,
            'requirements_submitted': self.requirements_submitted,
            'delivery_attachment_url': self.delivery_attachment_url,
            'delivery_note': self.delivery_note,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None
        }
Class = Order
