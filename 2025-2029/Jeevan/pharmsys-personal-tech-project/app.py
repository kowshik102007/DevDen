from flask import Flask, render_template, request, redirect, url_for, flash
from models import db, Medicine, Sale
from datetime import datetime

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///pharmacy.db'
app.config['SECRET_KEY'] = 'supersecretkey123'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

with app.app_context():
    db.create_all()

@app.route('/')
def index():
    med_count = Medicine.query.count()
    sales = Sale.query.order_by(Sale.date.desc()).limit(5).all()
    # simple revenue calculation
    total_rev = sum(s.total_amount for s in Sale.query.all())
    
    # check for low stock
    low_stock = Medicine.query.filter(Medicine.stock < 20).count()
    
    return render_template('index.html', med_count=med_count, sales=sales, total_rev=total_rev, low_stock=low_stock)

@app.route('/inventory')
def inventory():
    medicines = Medicine.query.all()
    return render_template('inventory.html', medicines=medicines)

@app.route('/add_medicine', methods=['GET', 'POST'])
def add_medicine():
    if request.method == 'POST':
        name = request.form['name']
        brand = request.form['brand']
        category = request.form['category']
        price = float(request.form['price'])
        stock = int(request.form['stock'])
        expiry_str = request.form['expiry']
        
        try:
            expiry = datetime.strptime(expiry_str, '%Y-%m-%d').date()
            m = Medicine(name=name, brand=brand, category=category, price=price, stock=stock, expiry_date=expiry)
            db.session.add(m)
            db.session.commit()
            flash('Medicine added successfully!', 'success')
            return redirect(url_for('inventory'))
        except ValueError:
            flash('Invalid date format.', 'error')
            
    return render_template('add_medicine.html')

@app.route('/sell', methods=['GET', 'POST'])
def sell():
    medicines = Medicine.query.filter(Medicine.stock > 0).all()
    
    if request.method == 'POST':
        med_id = request.form['medicine_id']
        qty_str = request.form['quantity']
        
        if not med_id or not qty_str:
            flash('Please select a medicine and quantity', 'error')
            return redirect(url_for('sell'))
            
        qty = int(qty_str)
        m = Medicine.query.get(med_id)
        
        if m and m.stock >= qty:
            total = m.price * qty
            m.stock -= qty
            s = Sale(medicine_id=m.id, quantity=qty, total_amount=total)
            db.session.add(s)
            db.session.commit()
            flash(f'Sale completed! Total: ${total}', 'success')
            return redirect(url_for('index'))
        else:
            flash('Not enough stock available', 'error')
            
    return render_template('sell.html', medicines=medicines)

@app.route('/delete/<int:id>')
def delete_medicine(id):
    m = Medicine.query.get_or_404(id)
    db.session.delete(m)
    db.session.commit()
    flash('Medicine deleted', 'success')
    return redirect(url_for('inventory'))

if __name__ == '__main__':
    app.run(debug=True)
