from flask import request, render_template, redirect, url_for, flash
from flask_login import login_required, current_user
from . import products
from app.models import Product
from app.extensions import db


@products.route("/")
def index():
    products_list = Product.query.all()
    return render_template("index.html", products=products_list)


@products.route("/admin/add", methods=["GET", "POST"])
@login_required
def add_product():
    if request.method == "POST":
        name = request.form.get("name")
        price = request.form.get("price")
        
        if not name or not price:
            flash("Name and price are required", "error")
            return redirect(url_for("products.add_product"))
        
        try:
            price = float(price)
            new_product = Product(name=name, price=price)
            db.session.add(new_product)
            db.session.commit()
            flash("Product added successfully!", "success")
            return redirect(url_for("products.index"))
        except ValueError:
            flash("Price must be a number", "error")
    
    return render_template("add_product.html")