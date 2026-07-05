from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from backend.models.db import db

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(50), nullable=False)  # 'freelancer', 'client', 'admin'
    is_verified = db.Column(db.Boolean, default=False)
    two_factor_secret = db.Column(db.String(100), nullable=True)
    is_two_factor_enabled = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    freelancer_profile = db.relationship('FreelancerProfile', backref='user', uselist=False, cascade="all, delete-orphan")
    client_profile = db.relationship('ClientProfile', backref='user', uselist=False, cascade="all, delete-orphan")
    wallet = db.relationship('Wallet', backref='user', uselist=False, cascade="all, delete-orphan")
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
        
    def check_password(self, password):
        # We also allow checking the seeded hash or plain text comparison if needed (just in case),
        # but let's stick to standard Werkzeug checking which covers pbkdf2 and newer algorithms.
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'role': self.role,
            'is_verified': self.is_verified,
            'is_two_factor_enabled': self.is_two_factor_enabled,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class FreelancerProfile(db.Model):
    __tablename__ = 'freelancer_profiles'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), unique=True, nullable=False)
    title = db.Column(db.String(255), default='')
    bio = db.Column(db.Text, default='')
    skills = db.Column(db.Text, default='')  # Comma-separated
    experience = db.Column(db.Text, default='[]')  # JSON string
    certifications = db.Column(db.Text, default='[]')  # JSON string
    portfolio_links = db.Column(db.Text, default='[]')  # JSON string
    rating = db.Column(db.Numeric(3, 2), default=0.00)
    completed_jobs = db.Column(db.Integer, default=0)
    earnings = db.Column(db.Numeric(15, 2), default=0.00)
    resume_url = db.Column(db.Text, default='')
    resume_ats_score = db.Column(db.Integer, nullable=True)
    resume_suggestions = db.Column(db.Text, default='')
    
    def to_dict(self):
        import json
        try:
            exp_list = json.loads(self.experience) if self.experience else []
        except:
            exp_list = []
        try:
            certs_list = json.loads(self.certifications) if self.certifications else []
        except:
            certs_list = []
        try:
            portfolio_list = json.loads(self.portfolio_links) if self.portfolio_links else []
        except:
            portfolio_list = []
            
        return {
            'id': self.id,
            'user_id': self.user_id,
            'title': self.title,
            'bio': self.bio,
            'skills': [s.strip() for s in self.skills.split(',')] if self.skills else [],
            'skills_raw': self.skills,
            'experience': exp_list,
            'certifications': certs_list,
            'portfolio_links': portfolio_list,
            'rating': float(self.rating) if self.rating else 0.0,
            'completed_jobs': self.completed_jobs,
            'earnings': float(self.earnings) if self.earnings else 0.0,
            'resume_url': self.resume_url,
            'resume_ats_score': self.resume_ats_score,
            'resume_suggestions': self.resume_suggestions
        }


class ClientProfile(db.Model):
    __tablename__ = 'client_profiles'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), unique=True, nullable=False)
    company = db.Column(db.String(255), default='')
    bio = db.Column(db.Text, default='')
    total_spent = db.Column(db.Numeric(15, 2), default=0.00)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'company': self.company,
            'bio': self.bio,
            'total_spent': float(self.total_spent) if self.total_spent else 0.0
        }
