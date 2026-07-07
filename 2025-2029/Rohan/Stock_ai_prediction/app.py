from datetime import datetime, timezone

from flask import Flask, render_template, request, redirect, url_for, flash
from flask_sqlalchemy import SQLAlchemy
from flask_login import (
    LoginManager,
    UserMixin,
    login_user,
    logout_user,
    login_required,
    current_user
)
from werkzeug.security import generate_password_hash, check_password_hash

from predict import get_prediction

app = Flask(__name__)

# ---------------------
# Config
# ---------------------

app.config["SECRET_KEY"] = "stock_project_secret"

app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///stock.db"

app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

# ---------------------
# Login Manager
# ---------------------

login_manager = LoginManager()

login_manager.init_app(app)

login_manager.login_view = "login"

# ---------------------
# User Model
# ---------------------

class User(UserMixin, db.Model):

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    username = db.Column(
        db.String(100),
        nullable=False
    )

    email = db.Column(
        db.String(100),
        unique=True,
        nullable=False
    )

    password = db.Column(
        db.String(255),
        nullable=False
    )

    created_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    predictions = db.relationship(
        "Prediction",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy=True
    )

# ---------------------
# Prediction Model
# ---------------------

class Prediction(db.Model):

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("user.id"),
        nullable=False,
        index=True
    )

    symbol = db.Column(
        db.String(20),
        nullable=False,
        index=True
    )

    current_price = db.Column(
        db.Float,
        nullable=False
    )

    predicted_price = db.Column(
        db.Float,
        nullable=False
    )

    signal = db.Column(
        db.String(20),
        nullable=False
    )

    confidence = db.Column(
        db.Float,
        nullable=False
    )

    created_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    user = db.relationship(
        "User",
        back_populates="predictions"
    )

# ---------------------
# Database Onboarding
# ---------------------

def initialize_database():

    with app.app_context():

        db.create_all()

# ---------------------
# User Loader
# ---------------------

@login_manager.user_loader
def load_user(user_id):

    return User.query.get(
        int(user_id)
    )

# ---------------------
# Home
# ---------------------

@app.route("/")
def home():

    if current_user.is_authenticated:

        return redirect(
            url_for("dashboard")
        )

    return redirect(
        url_for("login")
    )

# ---------------------
# Register
# ---------------------

@app.route(
    "/register",
    methods=["GET", "POST"]
)
def register():

    if request.method == "POST":

        username = request.form["username"]

        email = request.form["email"]

        password = request.form["password"]

        user = User.query.filter_by(
            email=email
        ).first()

        if user:

            flash(
                "Email already exists"
            )

            return redirect(
                url_for("register")
            )

        hashed_password = generate_password_hash(
            password
        )

        new_user = User(
            username=username,
            email=email,
            password=hashed_password
        )

        db.session.add(
            new_user
        )

        db.session.commit()

        flash(
            "Registration Successful"
        )

        return redirect(
            url_for("login")
        )

    return render_template(
        "register.html"
    )

# ---------------------
# Login
# ---------------------

@app.route(
    "/login",
    methods=["GET", "POST"]
)
def login():

    if request.method == "POST":

        email = request.form["email"]

        password = request.form["password"]

        user = User.query.filter_by(
            email=email
        ).first()

        if user and check_password_hash(
            user.password,
            password
        ):

            login_user(user)

            return redirect(
                url_for("dashboard")
            )

        flash(
            "Invalid Credentials"
        )

    return render_template(
        "login.html"
    )

# ---------------------
# Logout
# ---------------------

@app.route("/logout")
@login_required
def logout():

    logout_user()

    return redirect(
        url_for("login")
    )

# ---------------------
# Dashboard
# ---------------------

@app.route("/dashboard")
@login_required
def dashboard():

    predictions = Prediction.query.filter_by(
        user_id=current_user.id
    ).order_by(
        Prediction.id.desc()
    ).all()

    return render_template(
        "dashboard.html",
        user=current_user,
        predictions=predictions
    )

# ---------------------
# Stock Prediction
# ---------------------

@app.route(
    "/stock",
    methods=["GET", "POST"]
)
@login_required
def stock():

    result = None

    if request.method == "POST":

        symbol = request.form["symbol"]

        result = get_prediction(
            symbol
        )

        if result:

            prediction = Prediction(

                user_id=current_user.id,

                symbol=result["symbol"],

                current_price=result[
                    "current_price"
                ],

                predicted_price=result[
                    "predicted_price"
                ],

                signal=result["signal"],

                confidence=result[
                    "confidence"
                ]
            )

            db.session.add(
                prediction
            )

            db.session.commit()

        else:

            flash(
                "Stock not found"
            )

    return render_template(
        "stock.html",
        result=result
    )

# ---------------------
# Create DB
# ---------------------

@app.route("/create_db")
def create_db():
    try:
        initialize_database()
        return "Database Created Successfully"
    except Exception as e:
        return str(e)

# ---------------------
# Run
# ---------------------

if __name__ == "__main__":

    initialize_database()

    app.run(
        debug=True
    )
