"""
SQLite database setup and data loading.
Creates tables and loads CSV data into the database.
"""

import sqlite3
import csv
import os

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'railway.db')
DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')


def get_db():
    """Get a database connection."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Create all tables."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.executescript('''
        CREATE TABLE IF NOT EXISTS gates (
            gate_id TEXT PRIMARY KEY,
            display_name TEXT,
            lat REAL,
            lon REAL,
            road_name TEXT,
            nearest_place TEXT,
            district TEXT
        );

        CREATE TABLE IF NOT EXISTS stations (
            station_code TEXT PRIMARY KEY,
            station_name TEXT,
            station_name_ml TEXT,
            lat REAL,
            lon REAL
        );

        CREATE TABLE IF NOT EXISTS train_schedules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            train_number TEXT,
            train_name TEXT,
            station_code TEXT,
            station_name TEXT,
            arrival_time TEXT,
            departure_time TEXT,
            distance_km REAL,
            day_of_journey INTEGER DEFAULT 1,
            runs_on_days TEXT DEFAULT 'MTWTFSS'
        );

        CREATE TABLE IF NOT EXISTS gate_train_mapping (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            gate_id TEXT,
            train_number TEXT,
            train_name TEXT,
            estimated_crossing_time TEXT,
            prev_station_code TEXT,
            next_station_code TEXT,
            runs_on_days TEXT DEFAULT 'MTWTFSS'
        );

        CREATE TABLE IF NOT EXISTS historical_delays (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            train_number TEXT,
            station_code TEXT,
            scheduled_arrival TEXT,
            actual_arrival TEXT,
            delay_minutes REAL,
            recorded_date TEXT,
            day_of_week INTEGER,
            month INTEGER
        );

        CREATE TABLE IF NOT EXISTS gate_closure_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            gate_id TEXT,
            train_number TEXT,
            closed_at TEXT,
            opened_at TEXT,
            duration_minutes REAL,
            recorded_date TEXT,
            source TEXT DEFAULT 'calculated'
        );

        CREATE INDEX IF NOT EXISTS idx_gate_mapping_gate ON gate_train_mapping(gate_id);
        CREATE INDEX IF NOT EXISTS idx_gate_mapping_train ON gate_train_mapping(train_number);
        CREATE INDEX IF NOT EXISTS idx_schedules_train ON train_schedules(train_number);
        CREATE INDEX IF NOT EXISTS idx_schedules_station ON train_schedules(station_code);
    ''')

    conn.commit()
    conn.close()
    print("Database tables created.")


def load_csv(filename, table, columns):
    """Load a CSV file into a database table."""
    filepath = os.path.join(DATA_DIR, filename)
    if not os.path.exists(filepath):
        print(f"  Skipping {filename} — file not found")
        return 0

    conn = get_db()
    cursor = conn.cursor()

    # Clear existing data
    cursor.execute(f"DELETE FROM {table}")

    count = 0
    with open(filepath, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            values = []
            for col in columns:
                values.append(row.get(col, ''))
            placeholders = ','.join(['?' for _ in columns])
            col_names = ','.join(columns)
            cursor.execute(
                f"INSERT OR REPLACE INTO {table} ({col_names}) VALUES ({placeholders})",
                values
            )
            count += 1

    conn.commit()
    conn.close()
    return count


def load_all_data():
    """Load all CSV files into the database."""
    print("Loading data into database...")

    count = load_csv('kerala_gates.csv', 'gates',
                     ['gate_id', 'display_name', 'lat', 'lon',
                      'road_name', 'nearest_place', 'district'])
    print(f"  Gates: {count} rows")

    count = load_csv('kerala_stations.csv', 'stations',
                     ['station_code', 'station_name', 'station_name_ml',
                      'lat', 'lon'])
    print(f"  Stations: {count} rows")

    count = load_csv('train_schedules.csv', 'train_schedules',
                     ['train_number', 'train_name', 'station_code',
                      'station_name', 'arrival_time', 'departure_time',
                      'distance_km', 'day_of_journey', 'runs_on_days'])
    print(f"  Train schedules: {count} rows")

    count = load_csv('gate_train_mapping.csv', 'gate_train_mapping',
                     ['gate_id', 'train_number', 'train_name',
                      'estimated_crossing_time', 'prev_station_code',
                      'next_station_code', 'runs_on_days'])
    print(f"  Gate-train mappings: {count} rows")

    print("Done loading data.")


if __name__ == '__main__':
    print(f"Database path: {DB_PATH}")
    init_db()
    load_all_data()
