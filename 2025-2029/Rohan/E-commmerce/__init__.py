from flask import Flask, redirect, url_for
from .extensions import db, login_manager

from .auth import auth
from .products import products
from .cart import shopping
from .orders import orders

def create_app():
    app = Flask(__name__)

    app.config["SECRET_KEY"] = "mysecretkey"
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///database.db"

    db.init_app(app)
    login_manager.init_app(app)

    # create database tables
    with app.app_context():
        db.create_all()
        
        # Seed sample products if table is empty
        from .models import Product
        if Product.query.count() == 0:
            sample_products = [
                Product(name="Laptop", price=999.99),
                Product(name="Mouse", price=29.99),
                Product(name="Keyboard", price=79.99),
                Product(name="Monitor", price=299.99),
                Product(name="Headphones", price=149.99),
                Product(name="Webcam", price=89.99),
            ]
            for product in sample_products:
                db.session.add(product)
            db.session.commit()

    # Register blueprints with prefixes
    app.register_blueprint(auth, url_prefix="/auth")
    app.register_blueprint(products, url_prefix="/products")
    app.register_blueprint(shopping, url_prefix="/cart")
    app.register_blueprint(orders, url_prefix="/orders")

    # root route pointing to product list for convenience
    @app.route('/')
    def home():
        return redirect(url_for('products.index'))

    return app