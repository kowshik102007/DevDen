from flask import Blueprint

shopping = Blueprint("shopping", __name__)

from . import cart_views