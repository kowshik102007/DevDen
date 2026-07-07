import os
from dotenv import load_dotenv

# Load environmental variables from root .env
basedir = os.path.abspath(os.path.dirname(__file__))
root_dir = os.path.abspath(os.path.join(basedir, ".."))
load_dotenv(os.path.join(root_dir, ".env"))

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "skillbridge_fallback_secret_key_2026")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "jwt_skillbridge_fallback_key")
    JWT_ACCESS_TOKEN_EXPIRES = 86400  # 24 hours
    
    # Configure Database URL
    raw_db_url = os.getenv("DATABASE_URL", "sqlite:///database/skillbridge.db")
    if raw_db_url.startswith("sqlite:///"):
        # Make the SQLite database absolute to avoid path mismatches during running
        db_path = raw_db_url.replace("sqlite:///", "")
        if not os.path.isabs(db_path):
            db_path = os.path.abspath(os.path.join(root_dir, db_path))
        db_path = db_path.replace("\\", "/")
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{db_path}"
    else:
        SQLALCHEMY_DATABASE_URI = raw_db_url
        
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Upload folder
    UPLOAD_FOLDER = os.path.abspath(os.path.join(root_dir, "uploads"))
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB limit
    
    # AI Keys
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    
    # Payments
    STRIPE_PUBLIC_KEY = os.getenv("STRIPE_PUBLIC_KEY", "pk_test_mock_skillbridge")
    STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "sk_test_mock_skillbridge")
    RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "rzp_test_mock_skillbridge")
    RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "rzp_test_mock_secret_skillbridge")
    
    # App Settings
    HOLDING_PERIOD_DAYS = int(os.getenv("HOLDING_PERIOD_DAYS", "0"))
    ADMIN_COMMISSION_PERCENT = int(os.getenv("ADMIN_COMMISSION_PERCENT", "10"))
