"""
ML prediction integration for the backend.
Loads trained models and provides predict functions
used by gate_status.py to adjust crossing times.
"""

import os
import pandas as pd
import joblib
from datetime import datetime

ML_DIR = os.path.join(os.path.dirname(__file__), '..', 'ml')

# Global model references (loaded once at startup)
_delay_model = None
_delay_encoder = None
_closure_model = None


def load_models():
    """Load trained ML models from disk."""
    global _delay_model, _delay_encoder, _closure_model

    delay_path = os.path.join(ML_DIR, 'delay_model.pkl')
    encoder_path = os.path.join(ML_DIR, 'delay_train_encoder.pkl')
    closure_path = os.path.join(ML_DIR, 'closure_model.pkl')

    if os.path.exists(delay_path) and os.path.exists(encoder_path):
        _delay_model = joblib.load(delay_path)
        _delay_encoder = joblib.load(encoder_path)
        print("  Delay prediction model loaded")
    else:
        print("  Delay model not found — run ml/train_delay_model.py first")

    if os.path.exists(closure_path):
        _closure_model = joblib.load(closure_path)
        print("  Closure duration model loaded")
    else:
        print("  Closure model not found — run ml/train_closure_model.py first")


def predict_delay(train_number, scheduled_hour=None, prev_delay=0,
                  distance_km=0, now=None):
    """
    Predict how many minutes late a train will be.
    Returns predicted delay in minutes, or 0 if model not available.
    """
    if _delay_model is None:
        return 0

    if now is None:
        now = datetime.now()
    if scheduled_hour is None:
        scheduled_hour = now.hour

    # Encode train number
    train_num_str = str(train_number)
    try:
        train_encoded = _delay_encoder.transform([train_num_str])[0]
    except ValueError:
        train_encoded = 0  # Unknown train

    is_express = 1 if train_num_str[:1] in ('1', '2') else 0

    features = pd.DataFrame([{
        'train_number_encoded': train_encoded,
        'day_of_week': now.weekday(),
        'month': now.month,
        'scheduled_hour': scheduled_hour,
        'prev_station_delay': prev_delay,
        'distance_from_origin': distance_km,
        'is_express': is_express,
    }])

    prediction = _delay_model.predict(features)[0]
    return max(0, round(prediction, 1))


def predict_closure_duration(train_number, speed_kmh=None, hour=None):
    """
    Predict how long a gate will stay closed for a given train.
    Returns predicted closure duration in minutes.
    Falls back to physics-based estimate if model not available.
    """
    train_num_str = str(train_number)

    # Classify train type
    first_two = int(train_num_str[:2]) if train_num_str[:2].isdigit() else 0
    if first_two in range(10, 15):
        train_type = 1  # superfast
        default_coaches = 24
        default_speed = 90
    elif first_two in range(15, 25):
        train_type = 0  # express
        default_coaches = 22
        default_speed = 70
    elif first_two in range(55, 58):
        train_type = 2  # passenger
        default_coaches = 16
        default_speed = 40
    elif first_two in range(66, 68):
        train_type = 5  # memu
        default_coaches = 12
        default_speed = 50
    else:
        train_type = 0
        default_coaches = 20
        default_speed = 60

    if speed_kmh is None:
        speed_kmh = default_speed
    if hour is None:
        hour = datetime.now().hour

    if _closure_model is not None:
        features = pd.DataFrame([{
            'train_type': train_type,
            'number_of_coaches': default_coaches,
            'train_speed_kmh': speed_kmh,
            'time_of_day': hour,
        }])
        prediction = _closure_model.predict(features)[0]
        return max(0.5, round(prediction, 1))

    # Fallback: physics-based estimate
    length_m = default_coaches * 19  # ~19m per coach
    speed_ms = max(1, speed_kmh * (1000 / 3600))
    duration_min = (length_m + 200) / speed_ms / 60
    return max(0.5, round(duration_min, 1))


def models_available():
    """Check which models are loaded."""
    return {
        'delay_model': _delay_model is not None,
        'closure_model': _closure_model is not None,
    }
