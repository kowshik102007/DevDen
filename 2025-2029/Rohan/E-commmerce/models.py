
from flask_login import UserMixin
from .extensions import login_manager, db


class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.String(256), nullable=False)

    def __repr__(self):
        return f"<User {self.username}>"


class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    price = db.Column(db.Float, nullable=False)

    def __repr__(self):
        return f"<Product {self.name}>"


class Cart(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=False)
    quantity = db.Column(db.Integer, default=1)

    user = db.relationship('User', backref='cart_items')
    product = db.relationship('Product')

    def __repr__(self):
        return f"<Cart user={self.user_id} product={self.product_id} qty={self.quantity}>"


class Purchase(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    buyer_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    total_amount = db.Column(db.Float, nullable=False)
    created_on = db.Column(db.DateTime, default=db.func.current_timestamp())

    items = db.relationship('PurchaseItem', backref='purchase', lazy=True)


class PurchaseItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    purchase_id = db.Column(db.Integer, db.ForeignKey('purchase.id'))
    product_id = db.Column(db.Integer)
    qty = db.Column(db.Integer)
    unit_price = db.Column(db.Float)

    def __repr__(self):
        return f"<PurchaseItem purchase={self.purchase_id} product={self.product_id} qty={self.qty}>"


@login_manager.user_loader

def load_user(user_id):
    return User.query.get(int(user_id))
