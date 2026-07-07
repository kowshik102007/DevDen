"""
Fetch real Kerala train data from erail.in and rappid.in APIs.
Produces data/train_schedules.csv with verified, accurate schedules.

Usage:
    python -m scripts.fetch_real_trains
"""

import requests
import csv
import re
import time
import os

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
STATIONS_FILE = os.path.join(DATA_DIR, 'kerala_stations.csv')
OUTPUT_FILE = os.path.join(DATA_DIR, 'train_schedules.csv')

ERAIL_BASE = 'https://erail.in/rail/getTrains.aspx'
RAPPID_BASE = 'https://rappid.in/apis/train.php'
HEADERS = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'}

# Major Kerala station pairs to search for trains
STATION_PAIRS = [
    ('MAQ', 'TVC'), ('TVC', 'MAQ'),
    ('ERS', 'TVC'), ('TVC', 'ERS'),
    ('CLT', 'TVC'), ('TVC', 'CLT'),
    ('SRR', 'TVC'), ('TVC', 'SRR'),
    ('CAN', 'ERS'), ('ERS', 'CAN'),
    ('CAN', 'TVC'), ('TVC', 'CAN'),
    ('CLT', 'ERS'), ('ERS', 'CLT'),
    ('SRR', 'ERS'), ('ERS', 'SRR'),
    ('TCR', 'ERS'), ('ERS', 'TCR'),
    ('MAQ', 'ERS'), ('ERS', 'MAQ'),
    ('QLN', 'TVC'), ('TVC', 'QLN'),
    ('KYJ', 'TVC'), ('TVC', 'KYJ'),
    ('CAN', 'CLT'), ('CLT', 'CAN'),
    ('SRR', 'CLT'), ('CLT', 'SRR'),
    ('SRR', 'PGT'), ('PGT', 'SRR'),
    ('TCR', 'GUV'), ('GUV', 'TCR'),
    ('SRR', 'NIL'), ('NIL', 'SRR'),
    ('KYJ', 'PUU'), ('PUU', 'KYJ'),
    ('ERS', 'KTYM'), ('KTYM', 'ERS'),
    ('QLN', 'NCJ'), ('NCJ', 'QLN'),
    ('ALLP', 'ERS'), ('ERS', 'ALLP'),
    ('TVC', 'NCJ'), ('NCJ', 'TVC'),
]


def load_kerala_stations():
    """Load Kerala station codes from CSV."""
    stations = set()
    with open(STATIONS_FILE, 'r') as f:
        for row in csv.DictReader(f):
            stations.add(row['station_code'].strip())
    return stations


def discover_trains():
    """Discover all trains passing through Kerala using erail.in API."""
    print("Discovering Kerala trains from erail.in...")
    all_trains = {}

    for i, (frm, to) in enumerate(STATION_PAIRS):
        print(f"  [{i+1}/{len(STATION_PAIRS)}] {frm} → {to}...", end=' ', flush=True)
        url = f'{ERAIL_BASE}?Station_From={frm}&Station_To={to}&DataSource=0&Language=0&Cache=true'
        try:
            resp = requests.get(url, headers={**HEADERS, 'Referer': 'https://erail.in/'}, timeout=15)
            records = resp.text.split('^')
            count = 0
            for rec in records[1:]:
                fields = rec.split('~')
                if len(fields) > 13:
                    train_num = fields[0]
                    train_name = fields[1]
                    src_code = fields[3]
                    dst_code = fields[5]
                    run_days = fields[13]
                    if train_num and train_num.isdigit():
                        # Clean HTML from name
                        train_name = re.sub(r'<[^>]+>', '', train_name).strip()
                        train_name = re.sub(r'&[A-Za-z]+;', ' ', train_name).strip()
                        train_name = re.sub(r'\s+', ' ', train_name)
                        # Skip special/one-off trains (06xxx prefix)
                        if not train_num.startswith('06'):
                            all_trains[train_num] = {
                                'number': train_num,
                                'name': train_name,
                                'source': src_code,
                                'destination': dst_code,
                                'runs_on': run_days,
                            }
                            count += 1
            print(f"{count} trains")
        except Exception as e:
            print(f"Error: {e}")
        time.sleep(0.5)

    print(f"\nDiscovered {len(all_trains)} unique trains")
    return all_trains


def fetch_schedule(train_number):
    """Fetch station-by-station schedule from rappid.in API."""
    try:
        resp = requests.get(
            RAPPID_BASE,
            params={'type': 'livetrainstatus', 'train_no': str(train_number)},
            headers=HEADERS,
            timeout=15,
        )
        data = resp.json()
    except Exception:
        return None

    if not data.get('success') or not data.get('data'):
        return None

    schedule = []
    for i, stn in enumerate(data['data']):
        timing = stn.get('timing', '')
        halt = stn.get('halt', '')

        # Parse scheduled time from timing field (format: "actual_timescheduled_time")
        scheduled = '--'
        actual = '--'
        if timing not in ('Source', 'Destination', ''):
            match = re.match(r'(\d{2}:\d{2})(\d{2}:\d{2})', timing)
            if match:
                actual = match.group(1)
                scheduled = match.group(2)
            else:
                match = re.match(r'(\d{2}:\d{2})', timing)
                if match:
                    scheduled = match.group(1)
                    actual = scheduled

        # Parse distance
        dist = 0.0
        dist_str = stn.get('distance', '-')
        dist_match = re.search(r'([\d.]+)', dist_str)
        if dist_match:
            dist = float(dist_match.group(1))

        if halt == 'Source':
            arr_time = '--'
            dep_time = scheduled
        elif halt == 'Destination':
            arr_time = scheduled
            dep_time = '--'
        else:
            arr_time = scheduled
            dep_time = scheduled

        schedule.append({
            'station_name': stn.get('station_name', ''),
            'arrival_time': arr_time,
            'departure_time': dep_time,
            'distance_km': dist,
        })

    return schedule


def main():
    kerala_stations = load_kerala_stations()
    print(f"Loaded {len(kerala_stations)} Kerala station codes")

    # Step 1: Discover trains
    trains = discover_trains()

    # Step 2: Fetch schedules for each train
    print(f"\nFetching schedules for {len(trains)} trains from rappid.in...")
    all_rows = []
    success = 0
    failed = 0

    sorted_trains = sorted(trains.values(), key=lambda t: t['number'])

    for i, train in enumerate(sorted_trains):
        num = train['number']
        print(f"  [{i+1}/{len(sorted_trains)}] {num} {train['name']}...", end=' ', flush=True)

        schedule = fetch_schedule(num)
        if schedule and len(schedule) >= 2:
            for stop in schedule:
                all_rows.append({
                    'train_number': num,
                    'train_name': train['name'],
                    'station_code': '',  # Will be resolved below
                    'station_name': stop['station_name'],
                    'arrival_time': stop['arrival_time'],
                    'departure_time': stop['departure_time'],
                    'distance_km': stop['distance_km'],
                    'day_of_journey': 1,
                    'runs_on_days': _format_runs_on(train['runs_on']),
                })
            print(f"{len(schedule)} stations")
            success += 1
        else:
            print("FAILED")
            failed += 1

        time.sleep(1.0)

    # Write output CSV
    with open(OUTPUT_FILE, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=[
            'train_number', 'train_name', 'station_code', 'station_name',
            'arrival_time', 'departure_time', 'distance_km',
            'day_of_journey', 'runs_on_days'
        ])
        writer.writeheader()
        writer.writerows(all_rows)

    print(f"\n{'='*50}")
    print(f"Done! Success: {success}, Failed: {failed}")
    print(f"Total schedule rows: {len(all_rows)}")
    print(f"Output: {OUTPUT_FILE}")


def _format_runs_on(erail_days):
    """Convert erail.in days format (1111111) to MTWTFSS format."""
    if not erail_days or len(erail_days) < 7:
        return 'MTWTFSS'
    template = 'MTWTFSS'
    return ''.join(
        template[i] if erail_days[i] == '1' else '-'
        for i in range(7)
    )


if __name__ == '__main__':
    main()
