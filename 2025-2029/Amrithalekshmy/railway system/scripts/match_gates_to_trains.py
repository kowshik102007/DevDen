"""
Match railway gates to train routes.
For each gate, find which trains pass through it and estimate crossing times.

Algorithm:
1. For each gate, find the two nearest stations on a railway line segment
2. Verify the gate is between those stations (dot product projection check)
3. For every train stopping at both stations consecutively, estimate crossing time

Output: data/gate_train_mapping.csv
"""

import csv
import math
import os
from datetime import datetime, timedelta

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
GATES_FILE = os.path.join(DATA_DIR, 'kerala_gates.csv')
STATIONS_FILE = os.path.join(DATA_DIR, 'kerala_stations.csv')
SCHEDULES_FILE = os.path.join(DATA_DIR, 'train_schedules.csv')
OUTPUT_FILE = os.path.join(DATA_DIR, 'gate_train_mapping.csv')

# A gate belongs to a railway line segment if within this distance (km)
MAX_GATE_DISTANCE_KM = 0.5  # 500 meters


def haversine(lat1, lon1, lat2, lon2):
    """Distance between two points on Earth in km."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def point_to_segment_distance(px, py, ax, ay, bx, by):
    """
    Distance from point P to line segment AB, and the projection fraction t.
    Uses flat-earth approximation (fine for short distances within Kerala).
    Returns (distance_km, t) where t in [0,1] means the projection is on the segment.
    """
    # Convert to approximate flat coordinates (km)
    mid_lat = math.radians((ay + by) / 2)
    cos_lat = math.cos(mid_lat)

    # Convert degrees to km
    km_per_deg_lat = 111.32
    km_per_deg_lon = 111.32 * cos_lat

    ax_km = ax * km_per_deg_lon
    ay_km = ay * km_per_deg_lat
    bx_km = bx * km_per_deg_lon
    by_km = by * km_per_deg_lat
    px_km = px * km_per_deg_lon
    py_km = py * km_per_deg_lat

    dx = bx_km - ax_km
    dy = by_km - ay_km
    seg_len_sq = dx * dx + dy * dy

    if seg_len_sq < 1e-10:
        # Stations are at same point
        dist = math.sqrt((px_km - ax_km) ** 2 + (py_km - ay_km) ** 2)
        return dist, 0.0

    # Projection fraction: t=0 at A, t=1 at B
    t = ((px_km - ax_km) * dx + (py_km - ay_km) * dy) / seg_len_sq
    t = max(0.0, min(1.0, t))

    # Closest point on segment
    cx = ax_km + t * dx
    cy = ay_km + t * dy

    dist = math.sqrt((px_km - cx) ** 2 + (py_km - cy) ** 2)
    return dist, t


def parse_time(time_str):
    """Parse HH:MM time string, returns minutes since midnight."""
    if not time_str or time_str == '--':
        return None
    try:
        parts = time_str.strip().split(':')
        return int(parts[0]) * 60 + int(parts[1])
    except (ValueError, IndexError):
        return None


def minutes_to_time_str(minutes):
    """Convert minutes since midnight to HH:MM string."""
    minutes = int(minutes) % 1440  # Wrap around midnight
    h = minutes // 60
    m = minutes % 60
    return f"{h:02d}:{m:02d}"


def load_gates():
    """Load gates from CSV."""
    gates = []
    with open(GATES_FILE, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                gates.append({
                    'gate_id': row['gate_id'],
                    'display_name': row['display_name'],
                    'lat': float(row['lat']),
                    'lon': float(row['lon']),
                    'district': row.get('district', ''),
                })
            except (ValueError, KeyError):
                continue
    return gates


def load_stations():
    """Load stations from CSV."""
    stations = []
    with open(STATIONS_FILE, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                stations.append({
                    'station_code': row['station_code'].strip(),
                    'station_name': row['station_name'],
                    'lat': float(row['lat']),
                    'lon': float(row['lon']),
                })
            except (ValueError, KeyError):
                continue
    return stations


def load_schedules():
    """
    Load train schedules and group by train number.
    Returns dict: train_number -> list of stops in order.
    """
    trains = {}
    with open(SCHEDULES_FILE, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            tn = row['train_number']
            if tn not in trains:
                trains[tn] = {
                    'train_name': row['train_name'],
                    'runs_on_days': row.get('runs_on_days', 'MTWTFSS'),
                    'stops': [],
                }
            trains[tn]['stops'].append({
                'station_code': row['station_code'].strip(),
                'station_name': row['station_name'],
                'arrival_time': row['arrival_time'],
                'departure_time': row['departure_time'],
                'distance_km': float(row['distance_km']) if row['distance_km'] else 0,
            })
    return trains


def build_station_lookup(stations):
    """Build a dict: station_code -> station info with lat/lon."""
    return {s['station_code']: s for s in stations}


def find_consecutive_station_pairs(trains, station_lookup):
    """
    Build a list of all consecutive station pairs from train routes
    where both stations are in Kerala (have coordinates).
    Returns list of (station1_code, station2_code, train_number, train_name,
                     dep_time_s1, arr_time_s2, runs_on_days)
    """
    pairs = []
    for train_num, train_data in trains.items():
        stops = train_data['stops']
        for i in range(len(stops) - 1):
            s1 = stops[i]
            s2 = stops[i + 1]
            s1_code = s1['station_code']
            s2_code = s2['station_code']

            if s1_code not in station_lookup or s2_code not in station_lookup:
                continue

            dep_time = parse_time(s1['departure_time'])
            arr_time = parse_time(s2['arrival_time'])

            if dep_time is None or arr_time is None:
                continue

            pairs.append({
                'station1_code': s1_code,
                'station2_code': s2_code,
                'train_number': train_num,
                'train_name': train_data['train_name'],
                'departure_time': dep_time,
                'arrival_time': arr_time,
                'runs_on_days': train_data['runs_on_days'],
            })
    return pairs


def match_gates_to_segments(gates, stations, station_lookup, pairs):
    """
    For each gate, find which station-pair segments it belongs to,
    then calculate estimated crossing times for all trains on those segments.
    """
    # Group pairs by station pair for faster lookup
    segment_trains = {}
    for pair in pairs:
        key = (pair['station1_code'], pair['station2_code'])
        if key not in segment_trains:
            segment_trains[key] = []
        segment_trains[key].append(pair)

    # Build list of unique station-pair segments with coordinates
    segments = []
    seen = set()
    for pair in pairs:
        s1 = pair['station1_code']
        s2 = pair['station2_code']
        # Normalize: use alphabetical order for dedup, but keep direction
        key = (s1, s2)
        if key not in seen:
            seen.add(key)
            if s1 in station_lookup and s2 in station_lookup:
                segments.append({
                    'station1_code': s1,
                    'station2_code': s2,
                    'lat1': station_lookup[s1]['lat'],
                    'lon1': station_lookup[s1]['lon'],
                    'lat2': station_lookup[s2]['lat'],
                    'lon2': station_lookup[s2]['lon'],
                })

    print(f"  {len(segments)} unique station-pair segments with trains")

    mappings = []
    matched_gates = 0

    for gi, gate in enumerate(gates):
        if (gi + 1) % 200 == 0:
            print(f"  Processing gate {gi + 1}/{len(gates)}...")

        gate_lat = gate['lat']
        gate_lon = gate['lon']

        # Find all segments this gate is close to
        for seg in segments:
            dist, t = point_to_segment_distance(
                gate_lon, gate_lat,
                seg['lon1'], seg['lat1'],
                seg['lon2'], seg['lat2']
            )

            if dist > MAX_GATE_DISTANCE_KM:
                continue

            if t <= 0.01 or t >= 0.99:
                # Gate is at the very edge — probably not between these stations
                continue

            # This gate is on this segment. Find all trains on this segment.
            key = (seg['station1_code'], seg['station2_code'])
            if key not in segment_trains:
                continue

            for train_pair in segment_trains[key]:
                dep = train_pair['departure_time']
                arr = train_pair['arrival_time']

                # Handle midnight crossing
                travel_time = arr - dep
                if travel_time < 0:
                    travel_time += 1440  # Add 24 hours

                estimated_minutes = dep + t * travel_time
                crossing_time = minutes_to_time_str(estimated_minutes)

                mappings.append({
                    'gate_id': gate['gate_id'],
                    'train_number': train_pair['train_number'],
                    'train_name': train_pair['train_name'],
                    'estimated_crossing_time': crossing_time,
                    'prev_station_code': seg['station1_code'],
                    'next_station_code': seg['station2_code'],
                    'runs_on_days': train_pair['runs_on_days'],
                })

            matched_gates += 1

    return mappings, matched_gates


def main():
    print("Loading gates...")
    gates = load_gates()
    print(f"  {len(gates)} gates loaded")

    print("Loading stations...")
    stations = load_stations()
    station_lookup = build_station_lookup(stations)
    print(f"  {len(stations)} stations loaded")

    print("Loading train schedules...")
    if not os.path.exists(SCHEDULES_FILE):
        print(f"  ERROR: {SCHEDULES_FILE} not found!")
        print("  Run scrape_schedules.py first to generate train schedule data.")
        print("  Or create a sample file to test with.")
        return

    trains = load_schedules()
    print(f"  {len(trains)} trains loaded")

    print("Building station pairs...")
    pairs = find_consecutive_station_pairs(trains, station_lookup)
    print(f"  {len(pairs)} consecutive station pairs with timings")

    print("Matching gates to train routes...")
    mappings, matched_count = match_gates_to_segments(
        gates, stations, station_lookup, pairs
    )

    print(f"\nResults:")
    print(f"  Gates matched to at least one segment: {matched_count}")
    print(f"  Total gate-train mappings: {len(mappings)}")

    # Write output
    with open(OUTPUT_FILE, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=[
            'gate_id', 'train_number', 'train_name',
            'estimated_crossing_time', 'prev_station_code',
            'next_station_code', 'runs_on_days'
        ])
        writer.writeheader()
        writer.writerows(mappings)

    print(f"  Output saved to: {OUTPUT_FILE}")


if __name__ == '__main__':
    main()
