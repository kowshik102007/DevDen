from flask import Flask, render_template, request, redirect, session, flash
import sqlite3
app = Flask(__name__)
app.secret_key = 'pharmacy_secret_key'
def get_db_connection():
    conn = sqlite3.connect('pharmacy.db')
    conn.row_factory = sqlite3.Row
    return conn
@app.route('/')
def index():
    if 'username' in session:
        if session['role'] == 'user':
            return redirect('/dashboard')
        else:
            return redirect('/admin')
    return render_template('login.html')
@app.route('/login', methods=['POST'])
def login():
    uname = request.form['username']
    pwd = request.form['password']
    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE username = ? AND password = ?', (uname, pwd)).fetchone()
    conn.close()
    if user:
        session['username'] = user['username']
        session['role'] = user['role']
        if user['role'] == 'user':
            return redirect('/dashboard')
        else:
            return redirect('/admin')
    else:
        flash("Incorrect username or password")
        return redirect('/')
@app.route('/admin')
def admin():
    if 'username' not in session or session['role'] != 'admin':
        return redirect('/')
    conn = get_db_connection()
    all_meds = conn.execute('SELECT * FROM medicines').fetchall()
    conn.close()
    meds_list = []
    for m in all_meds:
        meds_list.append(dict(m))
    low_stock = []
    for m in meds_list:
        if m['stock'] < 40:
            low_stock.append(m)
    restock = []
    for m in meds_list:
        if m['stock'] < 20 and m['stock'] > 0:
            restock.append(m)
    total_val = 0
    for m in meds_list:
        total_val = total_val + (float(m['price']) * m['stock'])
    return render_template('admin_dashboard.html',
                           username=session['username'],
                           medicines=meds_list,
                           low_stock=low_stock,
                           restock=restock,
                           top_selling=meds_list,
                           highest_priced=meds_list,
                           total_value=total_val)
@app.route('/dashboard')
def dashboard():
    if 'username' not in session or session['role'] != 'user':
        return redirect('/')
    conn = get_db_connection()
    medicines = conn.execute('SELECT * FROM medicines').fetchall()
    conn.close()
    return render_template('dashboard.html', username=session['username'], medicines=medicines, query='')
@app.route('/buy/<int:med_id>')
def buy_medicine(med_id):
    if 'username' not in session or session['role'] != 'user':
        return redirect('/')
    conn = get_db_connection()
    med = conn.execute('SELECT * FROM medicines WHERE id = ?', (med_id,)).fetchone()
    if med:
        if med['stock'] > 0:
            new_stock = med['stock'] - 1
            conn.execute('UPDATE medicines SET stock = ? WHERE id = ?', (new_stock, med_id))
            conn.commit()
            flash("Purchase successful!")
        else:
            flash("Out of stock!")
    conn.close()
    return redirect('/dashboard')
@app.route('/search', methods=['GET', 'POST'])
def search():
    if 'username' not in session or session['role'] != 'user':
        return redirect('/')
    if request.method == 'POST':
        query = request.form['query']
        conn = get_db_connection()
        medicines = conn.execute("SELECT * FROM medicines WHERE name LIKE ?", ('%' + query + '%',)).fetchall()
        conn.close()
        return render_template('dashboard.html', username=session['username'], medicines=medicines, query=query)
    return redirect('/dashboard')
@app.route('/add-medicine', methods=['POST'])
def add_medicine():
    if 'username' not in session or session['role'] != 'admin':
        return redirect('/')
    name = request.form['name']
    cat = request.form['category']
    manuf = request.form['manufacturer']
    prc = request.form['price']
    exp = request.form['expiry_date']
    stk = request.form['stock']
    conn = get_db_connection()
    conn.execute('INSERT INTO medicines (name, category, manufacturer, price, expiry_date, stock) VALUES (?, ?, ?, ?, ?, ?)', (name, cat, manuf, prc, exp, stk))
    conn.commit()
    conn.close()
    return redirect('/admin')
@app.route('/delete-medicine/<int:med_id>')
def delete_medicine(med_id):
    if 'username' not in session or session['role'] != 'admin':
        return redirect('/')
    conn = get_db_connection()
    conn.execute('DELETE FROM medicines WHERE id = ?', (med_id,))
    conn.commit()
    conn.close()
    return redirect('/admin')
@app.route('/logout')
def logout():
    session.clear()
    return redirect('/')
if __name__ == '__main__':
    app.run(debug=True)