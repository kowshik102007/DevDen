# Pharmacy-Management-System

A full-stack Pharmacy Management System built with Python Flask and MySQL. This project supports both user and admin roles with dedicated dashboards.

## Features
- **User Login & Dashboard**: Users can browse medicines, search by name, and purchase items.
- **Admin Login & Dashboard**: Admins can view analytics (low stock, restock alerts, inventory value), add new medicines, and delete existing ones.
- **MySQL Database**: Uses MySQL for persistent data storage with tables for users, medicines, sales, and sale items.
- **Modern Frontend**: Clean, responsive UI built with DM Sans/DM Serif Display fonts and smooth animations.

## Project Structure
- `app.py` — Main Flask backend (routes, login, dashboard logic)
- `init_db.py` — Database initialization script (creates MySQL tables and sample data)
- `mysqlcodedatabase` — Raw MySQL schema reference
- `templates/` — Jinja2 HTML templates (login, user dashboard, admin dashboard)
- `static/` — CSS styles
- `frontend_pharma/` — Standalone frontend login page (CSS, HTML, JS)
- `Anagha/` — Admin analytics module (Flask API + data analysis with pandas)

## Setting Up To Run
1. Install Python on your PC.
2. Install MySQL Server and make sure it is running.
3. Install requirements: `pip install -r requirements.txt`
4. Run the database initialization: `python init_db.py`
5. Run the web application: `python app.py`
6. Open `http://127.0.0.1:5000` in your browser.

## Login Details
- **Admin**: Username: `admin@gmail.com` | Password: `admin123`
- **User**: Username: `jeevan@gmail.com` | Password: `jeevan`
