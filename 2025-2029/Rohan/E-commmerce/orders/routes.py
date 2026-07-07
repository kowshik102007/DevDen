from flask import render_template, redirect, url_for, flash
from flask_login import login_required, current_user
from . import orders
from ..extensions import db
from ..models import Purchase, PurchaseItem, Cart


@orders.route('/checkout')
@login_required
def checkout():
    cart_items = Cart.query.filter_by(user_id=current_user.id).all()
    
    if not cart_items:
        flash("Your cart is empty", "error")
        return redirect(url_for('shopping.view_cart'))
    
    total_cost = 0
    for cart_item in cart_items:
        total_cost += cart_item.product.price * cart_item.quantity
    
    # Create purchase
    new_purchase = Purchase(
        buyer_id=current_user.id,
        total_amount=total_cost
    )
    
    db.session.add(new_purchase)
    db.session.commit()
    
    # Create purchase items
    for cart_item in cart_items:
        product_entry = PurchaseItem(
            purchase_id=new_purchase.id,
            product_id=cart_item.product_id,
            qty=cart_item.quantity,
            unit_price=cart_item.product.price
        )
        db.session.add(product_entry)
    
    # Clear cart
    Cart.query.filter_by(user_id=current_user.id).delete()
    db.session.commit()
    
    flash("Your order has been placed successfully!", "success")
    return render_template("success.html", message="Order Confirmed!")


@orders.route('/')
@login_required
def list_orders():
    all_orders = Purchase.query.filter_by(buyer_id=current_user.id).all()
    return render_template("orders.html", orders=all_orders)

