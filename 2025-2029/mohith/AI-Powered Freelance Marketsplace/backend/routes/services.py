import json
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, jwt_required
from backend.models import db, Service, User
from backend.services.recommendation import RecommendationService

services_bp = Blueprint('services', __name__)

@services_bp.route('', methods=['GET'])
def get_services():
    # Query parameters
    search = request.args.get('search', '')
    category = request.args.get('category', '')
    min_price = request.args.get('min_price', type=float)
    max_price = request.args.get('max_price', type=float)
    sort_by = request.args.get('sort_by', 'newest')  # newest, price_low, price_high, top_rated
    
    query = Service.query.filter(Service.active == True)
    
    if search:
        query = query.filter(
            (Service.title.ilike(f'%{search}%')) | 
            (Service.description.ilike(f'%{search}%'))
        )
        
    if category:
        query = query.filter(Service.category == category)
        
    if min_price is not None:
        query = query.filter(Service.price >= min_price)
        
    if max_price is not None:
        query = query.filter(Service.price <= max_price)
        
    # Sorting
    if sort_by == 'price_low':
        query = query.order_by(Service.price.asc())
    elif sort_by == 'price_high':
        query = query.order_by(Service.price.desc())
    else:
        query = query.order_by(Service.created_at.desc())
        
    services = query.all()
    
    # Return as JSON list
    return jsonify([s.to_dict() for s in services]), 200


@services_bp.route('/<int:service_id>', methods=['GET'])
def get_service_details(service_id):
    service = Service.query.get(service_id)
    if not service:
        return jsonify({"error": "Service not found"}), 404
        
    # Get reviews for freelancer
    reviews = []
    from backend.models.review import Review
    from backend.models.user import FreelancerProfile
    
    reviews_objs = Review.query.filter_by(reviewee_id=service.freelancer_id).all()
    reviews = [r.to_dict() for r in reviews_objs]
    
    # Generate some standard mock FAQs
    faqs = [
        {"question": "What standard details do you require?", "answer": "Please supply all specifications, wireframes, logo colors, or reference files in the requirement box after purchase."},
        {"question": "Do you support post-delivery changes?", "answer": "Yes, we include 2 rounds of standard revision edits with every delivery package."}
    ]
    
    # Package options
    packages = {
        "basic": {"name": "Basic Spark", "price": float(service.price), "features": ["Core Delivery", "1 Revision Round", "Source file"], "delivery": service.delivery_days},
        "premium": {"name": "Ultimate Scale", "price": float(service.price * 2), "features": ["Full Stack Solution", "Unlimited Revisions", "Source Code", "Deployment Assist"], "delivery": max(1, service.delivery_days - 2)}
    }
    
    res = service.to_dict()
    res['reviews'] = reviews
    res['faqs'] = faqs
    res['packages'] = packages
    
    return jsonify(res), 200


@services_bp.route('', methods=['POST'])
@jwt_required()
def create_service():
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    if not user or user.role != 'freelancer':
        return jsonify({"error": "Only freelancers can publish services"}), 403
        
    data = request.get_json() or {}
    title = data.get('title')
    description = data.get('description')
    price = data.get('price')
    delivery_days = data.get('delivery_days')
    category = data.get('category')
    requirements = data.get('requirements', '')
    images = data.get('images', [])
    
    if not title or not description or not price or not delivery_days or not category:
        return jsonify({"error": "Missing required fields"}), 400
        
    try:
        service = Service(
            freelancer_id=current_user_id,
            title=title,
            description=description,
            price=price,
            delivery_days=delivery_days,
            category=category,
            requirements=requirements,
            images_json=json.dumps(images),
            active=True
        )
        db.session.add(service)
        db.session.commit()
        return jsonify({"message": "Service published successfully", "service": service.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Failed to create service", "details": str(e)}), 500


@services_bp.route('/recommended', methods=['GET'])
@jwt_required(optional=True)
def get_recommended():
    # If token exists, recommend based on profile context
    current_user_id = get_jwt_identity()
    recommended = RecommendationService.get_recommended_services(current_user_id, limit=6)
    return jsonify([s.to_dict() for s in recommended]), 200


@services_bp.route('/categories', methods=['GET'])
def get_categories():
    categories = RecommendationService.get_top_categories()
    return jsonify(categories), 200
