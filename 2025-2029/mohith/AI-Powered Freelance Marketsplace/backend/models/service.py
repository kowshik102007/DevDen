import json
from datetime import datetime
from backend.models.db import db

class Service(db.Model):
    __tablename__ = 'services'
    
    id = db.Column(db.Integer, primary_key=True)
    freelancer_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=False)
    price = db.Column(db.Numeric(10, 2), nullable=False)
    delivery_days = db.Column(db.Integer, nullable=False)
    category = db.Column(db.String(100), nullable=False)
    images_json = db.Column(db.Text, default='[]')  # JSON array of image URLs
    requirements = db.Column(db.Text, default='')
    active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship to user
    freelancer = db.relationship('User', backref=db.backref('services', lazy=True))
    
    def to_dict(self):
        try:
            images = json.loads(self.images_json) if self.images_json else []
        except:
            images = []
            
        # Get freelancer name
        freelancer_name = ""
        freelancer_title = ""
        freelancer_rating = 0.0
        if self.freelancer:
            freelancer_name = f"{self.freelancer.first_name} {self.freelancer.last_name}"
            if self.freelancer.freelancer_profile:
                freelancer_title = self.freelancer.freelancer_profile.title
                freelancer_rating = float(self.freelancer.freelancer_profile.rating)
                
        return {
            'id': self.id,
            'freelancer_id': self.freelancer_id,
            'freelancer_name': freelancer_name,
            'freelancer_title': freelancer_title,
            'freelancer_rating': freelancer_rating,
            'title': self.title,
            'description': self.description,
            'price': float(self.price),
            'delivery_days': self.delivery_days,
            'category': self.category,
            'images': images,
            'requirements': self.requirements,
            'active': self.active,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
