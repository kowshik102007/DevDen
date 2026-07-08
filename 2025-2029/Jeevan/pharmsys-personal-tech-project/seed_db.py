from app import app, db
from models import Medicine
from datetime import datetime, timedelta
import random

# Simulating Kaggle dataset load
kaggle_data = [
    {"name": "Paracetamol 500mg", "brand": "Generic", "category": "Analgesic", "price": 10.5},
    {"name": "Amoxicillin 250mg", "brand": "Mox", "category": "Antibiotic", "price": 45.0},
    {"name": "Ibuprofen 400mg", "brand": "Advil", "category": "NSAID", "price": 15.0},
    {"name": "Cetirizine 10mg", "brand": "Zyrtec", "category": "Antihistamine", "price": 8.0},
    {"name": "Azithromycin 500mg", "brand": "Zithromax", "category": "Antibiotic", "price": 60.0},
    {"name": "Omeprazole 20mg", "brand": "Prilosec", "category": "Antacid", "price": 25.0},
    {"name": "Metformin 500mg", "brand": "Glucophage", "category": "Antidiabetic", "price": 12.0},
    {"name": "Amlodipine 5mg", "brand": "Norvasc", "category": "Antihypertensive", "price": 18.0},
    {"name": "Losartan 50mg", "brand": "Cozaar", "category": "Antihypertensive", "price": 22.0},
    {"name": "Atorvastatin 20mg", "brand": "Lipitor", "category": "Cholesterol", "price": 30.0},
    {"name": "Aspirin 81mg", "brand": "Bayer", "category": "Analgesic", "price": 9.0},
    {"name": "Pantoprazole 40mg", "brand": "Protonix", "category": "Antacid", "price": 28.0},
    {"name": "Doxycycline 100mg", "brand": "Vibramycin", "category": "Antibiotic", "price": 35.0},
    {"name": "Ciprofloxacin 500mg", "brand": "Cipro", "category": "Antibiotic", "price": 40.0},
    {"name": "Levofloxacin 500mg", "brand": "Levaquin", "category": "Antibiotic", "price": 50.0}
]

with app.app_context():
    # clean db
    db.drop_all()
    db.create_all()
    
    # insert kaggle data
    for item in kaggle_data:
        # randomize stock and exp date
        stock = random.randint(30, 150)
        days = random.randint(90, 700)
        exp_date = datetime.now() + timedelta(days=days)
        
        m = Medicine(
            name=item['name'],
            brand=item['brand'],
            category=item['category'],
            price=item['price'],
            stock=stock,
            expiry_date=exp_date.date()
        )
        db.session.add(m)
        
    db.session.commit()
    print("Database seeded with sample Kaggle dataset!")
