
from flask import render_template, redirect, url_for, flash
from flask_login import login_required, current_user
from . import shopping
from ..extensions import db
from ..models import Cart, Product


@shopping.route("/add/<int:product_id>")
@login_required
def add_to_cart(product_id):
    product = Product.query.get(product_id)
    if product is None:
        flash("Product not found")
        return redirect(url_for("products.index"))
    cart_item = Cart.query.filter_by(
        user_id=current_user.id,
        product_id=product_id
    ).first()
    if cart_item:
        cart_item.quantity += 1
    else:
        new_item = Cart(
            user_id=current_user.id,
            product_id=product_id,
            quantity=1
        )
        db.session.add(new_item)
    db.session.commit()
    flash("Item added to cart")
    return redirect(url_for("products.index"))


@shopping.route("/")
@login_required
def view_cart():
    cart_items = Cart.query.filter_by(user_id=current_user.id).all()
    total_price = 0
    for item in cart_items:
        total_price += item.product.price * item.quantity
    return render_template("cart.html", cart_items=cart_items, total_price=total_price)


@shopping.route("/remove/<int:cart_id>")
@login_required
def remove_from_cart(cart_id):
    cart_item = Cart.query.get(cart_id)
    
    if cart_item and cart_item.user_id == current_user.id:
        db.session.delete(cart_item)
        db.session.commit()
        flash("Item removed from cart", "success")
    
    return redirect(url_for("shopping.view_cart"))