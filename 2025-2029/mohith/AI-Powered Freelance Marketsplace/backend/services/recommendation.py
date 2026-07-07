from sqlalchemy import desc, func
from backend.models import db, Service, User, FreelancerProfile, Order

class RecommendationService:
    @staticmethod
    def get_recommended_services(user_id=None, limit=6):
        """
        Recommends freelance services (gigs) based on:
        1. If logged-in user has past orders, recommend services in similar categories.
        2. Otherwise, recommend highly-rated active services.
        """
        try:
            # Check user's order history
            favorite_categories = []
            if user_id:
                # Find categories of past orders
                past_orders = db.session.query(Service.category).join(
                    Order, Order.service_id == Service.id
                ).filter(Order.client_id == user_id).all()
                favorite_categories = [cat[0] for cat in past_orders if cat[0]]
            
            # Form base query
            query = Service.query.filter(Service.active == True)
            
            # If user has favorite categories, prioritize them
            if favorite_categories:
                # Group by matching category first
                recommended = query.filter(Service.category.in_(favorite_categories))\
                                   .order_by(desc(Service.price))\
                                   .limit(limit).all()
                # If we need more to fill the list
                if len(recommended) < limit:
                    remaining_limit = limit - len(recommended)
                    additional = query.filter(~Service.category.in_(favorite_categories))\
                                      .order_by(desc(Service.id))\
                                      .limit(remaining_limit).all()
                    recommended.extend(additional)
                return recommended
            else:
                # General recommendation: sort by freelancer rating, then price
                # We join with FreelancerProfile to order by rating
                recommended = db.session.query(Service).join(
                    FreelancerProfile, FreelancerProfile.user_id == Service.freelancer_id
                ).filter(Service.active == True)\
                 .order_by(desc(FreelancerProfile.rating), desc(Service.price))\
                 .limit(limit).all()
                 
                if not recommended:
                    # Fallback to simple listing if profile join is empty
                    recommended = Service.query.filter(Service.active == True).limit(limit).all()
                    
                return recommended
        except Exception as e:
            print("Recommendation error, returning default listings:", e)
            return Service.query.filter(Service.active == True).limit(limit).all()

    @staticmethod
    def get_top_freelancers(limit=5):
        """
        Recommends top freelancers based on rating and jobs completed.
        """
        try:
            top_profiles = FreelancerProfile.query.order_by(
                desc(FreelancerProfile.rating), 
                desc(FreelancerProfile.completed_jobs)
            ).limit(limit).all()
            
            freelancers_list = []
            for profile in top_profiles:
                user = User.query.get(profile.user_id)
                if user:
                    freelancers_list.append({
                        "user_id": user.id,
                        "name": f"{user.first_name} {user.last_name}",
                        "title": profile.title,
                        "rating": float(profile.rating),
                        "completed_jobs": profile.completed_jobs,
                        "skills": [s.strip() for s in profile.skills.split(',')] if profile.skills else []
                    })
            return freelancers_list
        except Exception as e:
            print("Error loading top freelancers:", e)
            return []

    @staticmethod
    def get_top_categories():
        """
        Returns popular categories based on service volumes.
        """
        try:
            categories_count = db.session.query(
                Service.category, func.count(Service.id).label('total')
            ).filter(Service.active == True)\
             .group_by(Service.category)\
             .order_by(desc('total')).all()
             
            return [{"category": item[0], "count": item[1]} for item in categories_count]
        except Exception as e:
            print("Error retrieving top categories:", e)
            return [
                {"category": "Artificial Intelligence", "count": 2},
                {"category": "Web Development", "count": 1},
                {"category": "Graphic Design", "count": 2}
            ]
class RecommendationSystem:
    pass
