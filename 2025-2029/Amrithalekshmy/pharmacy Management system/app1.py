from unittest import result

from flask import Flask,request,jsonify
from eda import lowstock, topsellingmedicine
from eda import highestpricedmedicine
from eda import priceofstockleft
from eda import restockneeded

def verify_admin(admin_id, username):
    if admin_id == "admin123" and username == "admin":
        return True
    else:
        return False
app = Flask(__name__)

@app.route("/admin-login", methods=["POST"])
def admin_login():
    data = request.json
    admin_id = data.get("admin_id")
    username = data.get("username")
    if verify_admin(admin_id, username):
        return jsonify({"message": "Login successful"})
    else:
        return jsonify({"message": "Invalid admin credentials"})

@app.route("/")
def home():
    return "Pharmacy Backend Running"

@app.route("/top-medicines")
def top_medicines():
    result = topsellingmedicine()
    return result.to_json()

@app.route("/weekday-sales")
def weekday_sales():
    result = highestpricedmedicine()
    return result.to_json()
@app.route("/restock-needed")
def restock_needed():
    result = restockneeded()
    return result.to_json()

@app.route("/low-stock")
def low_stock():
    result = lowstock()
    return result.to_json()

@app.route("/inventory-value")
def inventory_value():
    result = priceofstockleft()
    return result.to_json()

if __name__ == "__main__":
    app.run(debug=True)