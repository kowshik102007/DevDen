"""
Gate status calculation logic.
Determines whether each gate is OPEN, WARNING, or CLOSED
based on train schedules and current time.
"""

import math
from datetime import datetime
from backend.database import get_db
from backend.live_status import get_train_delay

# Status thresholds (minutes)
CLOSED_THRESHOLD = 5       # Train 0-5 min away -> CLOSED
WARNING_THRESHOLD = 15     # Train 5-15 min away -> WARNING

# Day name mapping: Python weekday (0=Mon) to schedule day position
DAY_MAP = {0: 'M', 1: 'T', 2: 'W', 3: 'T', 4: 'F', 5: 'S', 6: 'S'}
DAY_INDEX = {0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6}


def parse_time_to_minutes(time_str):
    """Convert HH:MM to minutes since midnight."""
    if not time_str or time_str == '--':
        return None
    try:
        parts = time_str.strip().split(':')
        return int(parts[0]) * 60 + int(parts[1])
    except (ValueError, IndexError):
        return None


def train_runs_today(runs_on_days, now=None):
    """Check if a train runs on the current day of the week."""
    if not runs_on_days or runs_on_days == 'MTWTFSS':
        return True  # Runs daily

    if now is None:
        now = datetime.now()

    day_idx = now.weekday()  # 0=Monday
    if day_idx < len(runs_on_days):
        return runs_on_days[day_idx] != '-'
    return True


def haversine(lat1, lon1, lat2, lon2):
    """Distance between two points in km."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def calculate_gate_status(gate_id, now=None, skip_live=False):
    """
    Calculate the current status for a single gate.
    Returns dict with status, next_train info, and upcoming trains list.
    If skip_live=True, skip fetching live delay from the API (faster startup).
    """
    if now is None:
        now = datetime.now()

    current_minutes = now.hour * 60 + now.minute

    conn = get_db()
    cursor = conn.cursor()

    # Get all trains mapped to this gate
    cursor.execute('''
        SELECT train_number, train_name, estimated_crossing_time,
               prev_station_code, next_station_code, runs_on_days
        FROM gate_train_mapping
        WHERE gate_id = ?
        ORDER BY estimated_crossing_time
    ''', (gate_id,))

    rows = cursor.fetchall()
    conn.close()

    status = 'OPEN'
    next_train = None
    minutes_until_closing = None
    upcoming_trains = []

    for row in rows:
        if not train_runs_today(row['runs_on_days'], now):
            continue

        crossing_minutes = parse_time_to_minutes(row['estimated_crossing_time'])
        if crossing_minutes is None:
            continue

        # Adjust for live delay from Indian Railways API (skip during initial startup)
        live_delay = 0 if skip_live else get_train_delay(row['train_number'])
        adjusted_crossing = crossing_minutes + live_delay

        # Time until this train crosses the gate (with live delay applied)
        time_diff = adjusted_crossing - current_minutes
        # Handle midnight wrap
        if time_diff < -720:
            time_diff += 1440
        elif time_diff > 720:
            time_diff -= 1440

        adjusted_h = int(adjusted_crossing // 60) % 24
        adjusted_m = int(adjusted_crossing % 60)
        estimated_time = f"{adjusted_h:02d}:{adjusted_m:02d}"

        train_info = {
            'train_number': row['train_number'],
            'train_name': row['train_name'],
            'estimated_time': estimated_time,
            'scheduled_time': row['estimated_crossing_time'],
            'delay_minutes': live_delay,
            'minutes_away': round(time_diff, 1),
            'prev_station': row['prev_station_code'],
            'next_station': row['next_station_code'],
        }

        # Only consider trains that haven't passed yet (within reason)
        if -2 <= time_diff <= WARNING_THRESHOLD:
            upcoming_trains.append(train_info)

        # Determine status based on closest approaching train
        if 0 <= time_diff <= CLOSED_THRESHOLD:
            status = 'CLOSED'
            if next_train is None or time_diff < minutes_until_closing:
                next_train = train_info
                minutes_until_closing = time_diff
        elif CLOSED_THRESHOLD < time_diff <= WARNING_THRESHOLD:
            if status != 'CLOSED':
                status = 'WARNING'
            if next_train is None:
                next_train = train_info
                minutes_until_closing = time_diff

    # Sort upcoming trains by time
    upcoming_trains.sort(key=lambda t: t['minutes_away'])

    return {
        'status': status,
        'next_train': next_train,
        'minutes_until_closing': minutes_until_closing,
        'upcoming_trains': upcoming_trains,
    }


def calculate_all_gate_statuses(now=None, skip_live=False):
    """
    Calculate status for all gates.
    Returns dict: gate_id -> status info.
    If skip_live=True, skip fetching live delay (for fast startup).
    """
    if now is None:
        now = datetime.now()

    conn = get_db()
    cursor = conn.cursor()

    # Get all gates
    cursor.execute('SELECT gate_id FROM gates')
    gate_ids = [row['gate_id'] for row in cursor.fetchall()]
    conn.close()

    statuses = {}
    for gate_id in gate_ids:
        statuses[gate_id] = calculate_gate_status(gate_id, now, skip_live=skip_live)

    return statuses


# In-memory cache for gate statuses (refreshed by scheduler)
_status_cache = {}


def refresh_status_cache(skip_live=False):
    """Recalculate all gate statuses and update the cache."""
    global _status_cache
    now = datetime.now()
    _status_cache = calculate_all_gate_statuses(now, skip_live=skip_live)
    print(f"[{now.strftime('%H:%M:%S')}] Status cache refreshed — "
          f"{sum(1 for s in _status_cache.values() if s['status'] == 'CLOSED')} closed, "
          f"{sum(1 for s in _status_cache.values() if s['status'] == 'WARNING')} warning")


def get_cached_status(gate_id):
    """Get cached status for a gate."""
    return _status_cache.get(gate_id, {
        'status': 'UNKNOWN',
        'next_train': None,
        'minutes_until_closing': None,
        'upcoming_trains': [],
    })


def get_all_cached_statuses():
    """Get all cached gate statuses."""
    return _status_cache
