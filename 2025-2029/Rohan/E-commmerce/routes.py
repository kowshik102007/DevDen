from flask import Blueprint, request

main = Blueprint('main', __name__)

@main.route('/')
def home():
    return "Home Page"

@main.route('/register', methods=['GET','POST'])
def register():
    return "Register Page"

@main.route('/login', methods=['GET','POST'])
def login():
    return "Login Page"

@main.route('/logout')
def logout():
    return "Logout Page"
