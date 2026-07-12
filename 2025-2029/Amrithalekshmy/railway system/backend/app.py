"""
Flask API server for Kerala Railway Gate Status App.
Serves gate status data to the frontend.
"""

import math
from flask import Flask, jsonify, request, send_from_directory
from apscheduler.schedulers.background import BackgroundScheduler
import os

from backend.database import get_db, init_db, load_all_data
from backend.gate_status import (
    refresh_status_cache, get_cached_status, get_all_cached_statuses,
    haversine, calculate_gate_status
)
from backend.ml_predict import load_models, predict_delay, predict_closure_duration, models_available
from backend.live_status import fetch_live_status, get_train_delay

app = Flask(__name__,
            static_folder=os.path.join(os.path.dirname(__file__), '..', 'frontend'),
            static_url_path='')


# --- API Endpoints ---

@app.route('/api/gates')
def get_gates():
    """Return all gates with current status."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT gate_id, display_name, lat, lon, road_name, nearest_place, district FROM gates')
    gates = cursor.fetchall()
    conn.close()

    result = []
    for gate in gates:
        gate_id = gate['gate_id']
        status_info = get_cached_status(gate_id)
        entry = {
            'gate_id': gate_id,
            'display_name': gate['display_name'],
            'lat': gate['lat'],
            'lon': gate['lon'],
            'status': status_info['status'],
            'next_train': status_info['next_train'],
            'minutes_until_closing': status_info['minutes_until_closing'],
        }
        result.append(entry)

    return jsonify(result)


@app.route('/api/gates/<path:gate_id>')
def get_gate_detail(gate_id):
    """Return detailed info for one gate."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        'SELECT gate_id, display_name, lat, lon, road_name, nearest_place, district FROM gates WHERE gate_id = ?',
        (gate_id,)
    )
    gate = cursor.fetchone()
    conn.close()

    if not gate:
        return jsonify({'error': 'Gate not found'}), 404

    status_info = calculate_gate_status(gate_id)

    return jsonify({
        'gate_id': gate['gate_id'],
        'display_name': gate['display_name'],
        'lat': gate['lat'],
        'lon': gate['lon'],
        'road_name': gate['road_name'],
        'nearest_place': gate['nearest_place'],
        'district': gate['district'],
        'status': status_info['status'],
        'next_train': status_info['next_train'],
        'minutes_until_closing': status_info['minutes_until_closing'],
        'upcoming_trains': status_info['upcoming_trains'],
    })


@app.route('/api/gates/nearby')
def get_nearby_gates():
    """Return gates within a radius of a location."""
    try:
        lat = float(request.args.get('lat'))
        lon = float(request.args.get('lon'))
        radius = float(request.args.get('radius', 5))  # Default 5 km
    except (TypeError, ValueError):
        return jsonify({'error': 'lat, lon required as numbers'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT gate_id, display_name, lat, lon FROM gates')
    gates = cursor.fetchall()
    conn.close()

    nearby = []
    for gate in gates:
        dist = haversine(lat, lon, gate['lat'], gate['lon'])
        if dist <= radius:
            status_info = get_cached_status(gate['gate_id'])
            nearby.append({
                'gate_id': gate['gate_id'],
                'display_name': gate['display_name'],
                'lat': gate['lat'],
                'lon': gate['lon'],
                'distance_km': round(dist, 2),
                'status': status_info['status'],
                'next_train': status_info['next_train'],
                'minutes_until_closing': status_info['minutes_until_closing'],
            })

    nearby.sort(key=lambda g: g['distance_km'])
    return jsonify(nearby)


@app.route('/api/trains/<train_number>/position')
def get_train_position(train_number):
    """Return current position and upcoming gates for a train."""
    conn = get_db()
    cursor = conn.cursor()

    # Get all gates this train will cross today
    cursor.execute('''
        SELECT g.gate_id, g.display_name, g.lat, g.lon,
               m.estimated_crossing_time, m.prev_station_code, m.next_station_code
        FROM gate_train_mapping m
        JOIN gates g ON g.gate_id = m.gate_id
        WHERE m.train_number = ?
        ORDER BY m.estimated_crossing_time
    ''', (train_number,))
    gates = cursor.fetchall()

    # Get train name
    cursor.execute(
        'SELECT DISTINCT train_name FROM train_schedules WHERE train_number = ?',
        (train_number,)
    )
    name_row = cursor.fetchone()
    train_name = name_row['train_name'] if name_row else train_number

    # Get train schedule (stations)
    cursor.execute('''
        SELECT station_code, station_name, arrival_time, departure_time, distance_km
        FROM train_schedules
        WHERE train_number = ?
        ORDER BY distance_km
    ''', (train_number,))
    schedule = cursor.fetchall()
    conn.close()

    from datetime import datetime
    now = datetime.now()
    current_minutes = now.hour * 60 + now.minute

    upcoming_gates = []
    for gate in gates:
        parts = gate['estimated_crossing_time'].split(':')
        crossing_min = int(parts[0]) * 60 + int(parts[1])
        time_diff = crossing_min - current_minutes
        if time_diff < -720:
            time_diff += 1440

        if time_diff >= -2:
            upcoming_gates.append({
                'gate_id': gate['gate_id'],
                'display_name': gate['display_name'],
                'lat': gate['lat'],
                'lon': gate['lon'],
                'estimated_crossing_time': gate['estimated_crossing_time'],
                'minutes_away': round(time_diff),
                'prev_station': gate['prev_station_code'],
                'next_station': gate['next_station_code'],
            })

    return jsonify({
        'train_number': train_number,
        'train_name': train_name,
        'schedule': [dict(s) for s in schedule],
        'upcoming_gates': upcoming_gates,
    })


@app.route('/api/trains/<train_number>/live')
def get_train_live_status(train_number):
    """Return real-time running status for a train from Indian Railways."""
    status = fetch_live_status(train_number)
    if not status:
        return jsonify({'error': 'Could not fetch live status', 'train_number': train_number}), 404

    return jsonify({
        'train_number': status['train_number'],
        'train_name': status['train_name'],
        'message': status['message'],
        'updated_time': status['updated_time'],
        'is_running': status['is_running'],
        'latest_delay_minutes': status['latest_delay_minutes'],
        'average_delay_minutes': status['average_delay_minutes'],
        'current_station': status['current_station'],
        'stations': status['stations'],
    })


@app.route('/api/stats')
def get_stats():
    """Return overall statistics."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('SELECT COUNT(*) as count FROM gates')
    total_gates = cursor.fetchone()['count']

    cursor.execute('SELECT COUNT(DISTINCT train_number) as count FROM train_schedules')
    total_trains = cursor.fetchone()['count']

    cursor.execute('SELECT COUNT(DISTINCT gate_id) as count FROM gate_train_mapping')
    mapped_gates = cursor.fetchone()['count']

    cursor.execute('SELECT COUNT(*) as count FROM stations')
    total_stations = cursor.fetchone()['count']

    conn.close()

    all_statuses = get_all_cached_statuses()
    closed_count = sum(1 for s in all_statuses.values() if s['status'] == 'CLOSED')
    warning_count = sum(1 for s in all_statuses.values() if s['status'] == 'WARNING')
    open_count = sum(1 for s in all_statuses.values() if s['status'] == 'OPEN')

    return jsonify({
        'total_gates': total_gates,
        'total_trains': total_trains,
        'total_stations': total_stations,
        'mapped_gates': mapped_gates,
        'current_closed': closed_count,
        'current_warning': warning_count,
        'current_open': open_count,
    })


# --- ML Prediction Endpoints ---

@app.route('/api/predict/delay')
def predict_train_delay():
    """Predict delay for a given train."""
    train_number = request.args.get('train')
    if not train_number:
        return jsonify({'error': 'train parameter required'}), 400

    delay = predict_delay(train_number)
    closure = predict_closure_duration(train_number)

    return jsonify({
        'train_number': train_number,
        'predicted_delay_minutes': delay,
        'predicted_closure_minutes': closure,
        'models': models_available(),
    })


@app.route('/api/report/closed', methods=['POST'])
def report_gate_closed():
    """User reports a gate just closed."""
    from ml.collect_closure_data import record_gate_closed
    data = request.get_json() or {}
    gate_id = data.get('gate_id')
    train_number = data.get('train_number')
    if not gate_id:
        return jsonify({'error': 'gate_id required'}), 400

    event_id = record_gate_closed(gate_id, train_number)
    return jsonify({'event_id': event_id, 'message': 'Recorded gate closure'})


@app.route('/api/report/opened', methods=['POST'])
def report_gate_opened():
    """User reports a gate just opened."""
    from ml.collect_closure_data import record_gate_opened
    data = request.get_json() or {}
    gate_id = data.get('gate_id')
    if not gate_id:
        return jsonify({'error': 'gate_id required'}), 400

    result = record_gate_opened(gate_id)
    if result:
        return jsonify(result)
    return jsonify({'message': 'No matching closure event found'}), 404


# --- Frontend Routes ---

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')


@app.route('/gate')
def gate_page():
    return send_from_directory(app.static_folder, 'gate.html')


@app.route('/search')
def search_page():
    return send_from_directory(app.static_folder, 'search.html')


# --- App Startup ---

def create_app():
    """Initialize the app, database, and scheduler."""
    # Initialize database
    init_db()
    load_all_data()

    # Load ML models (if trained)
    print("Loading ML models...")
    load_models()

    # Initial status calculation (skip live API calls for fast startup;
    # the scheduler will fetch live delays within 60 seconds)
    refresh_status_cache(skip_live=True)

    # Schedule status refresh every 60 seconds
    scheduler = BackgroundScheduler()
    scheduler.add_job(refresh_status_cache, 'interval', seconds=60)
    scheduler.start()

    return app


if __name__ == '__main__':
    application = create_app()
    application.run(host='0.0.0.0', port=5000, debug=True)
