"""
Scrape train schedules from erail.in for Kerala trains.
Outputs data/train_schedules.csv with station-by-station timings.
"""

import requests
from bs4 import BeautifulSoup
import csv
import time
import re
import os
import sys

# Kerala train numbers to scrape
# Coastal line (TVC to MAQ/CBE) + major Kerala trains
TRAIN_NUMBERS = [
    # Main Kerala coastal line trains
    16606, 20634, 12076, 16650, 20923, 19577, 16346, 16329, 12431,
    22633, 12082, 16334, 20632, 16336, 16629, 16604, 16347, 6041, 22653,
    # TVC to ERS corridor
    16301, 16302, 16303, 16304, 16305, 16306, 16307, 16308,
    16341, 16342, 16343, 16344, 16349, 16350,
    # ERS to CLT corridor
    16605, 16606, 16609, 16610, 16615, 16616, 16603, 16604,
    # ERS to SRR (Shoranur) corridor
    16307, 16308, 16305, 16306, 56361, 56362, 56363, 56364,
    # Long distance trains through Kerala
    12625, 12626, 12601, 12602, 16525, 16526, 12695, 12696,
    16345, 16346, 12081, 12082, 22113, 22114, 12617, 12618,
    16527, 16528, 12623, 12624, 12511, 12512, 16859, 16860,
    # TVC-CAPE-Nagercoil section
    16723, 16724, 16791, 16792,
    # SRR-PGT (Palakkad) corridor
    56651, 56652, 56653, 56654,
    # Passenger / MEMU trains
    56361, 56362, 56363, 56364, 56365, 56366, 56367, 56368,
    56371, 56372, 56373, 56374, 56375, 56376, 56377, 56378,
    56381, 56382, 56383, 56384, 56385, 56386, 56387, 56388,
    66301, 66302, 66303, 66304, 66305, 66306, 66307, 66308,
    66309, 66310, 66311, 66312, 66313, 66314, 66315, 66316,
    66317, 66318, 66319, 66320, 66321, 66322, 66323, 66324,
]

# Remove duplicates and sort
TRAIN_NUMBERS = sorted(set(TRAIN_NUMBERS))

# Kerala station codes (to filter only Kerala portions of routes)
KERALA_STATION_FILE = os.path.join(os.path.dirname(__file__), '..', 'data', 'kerala_stations.csv')

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
}


def load_kerala_stations():
    """Load Kerala station codes from CSV."""
    stations = set()
    with open(KERALA_STATION_FILE, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            stations.add(row['station_code'].strip())
    return stations


def scrape_train(train_number):
    """Scrape schedule for a single train from erail.in."""
    url = f'https://erail.in/rail/getTrains.aspx?TrainNo={train_number}'
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
    except requests.RequestException as e:
        print(f"  Error fetching train {train_number}: {e}")
        return None

    soup = BeautifulSoup(resp.text, 'html.parser')

    # Try to find train name
    train_name = ""
    name_elem = soup.find('span', {'id': 'MainContent_trainname'})
    if not name_elem:
        name_elem = soup.find('span', class_='trainname')
    if not name_elem:
        title = soup.find('title')
        if title:
            # Title often has "TrainNumber TrainName Route"
            text = title.get_text()
            match = re.search(r'\d+\s+(.+?)(?:\s+Route|\s+Schedule|\s*$)', text)
            if match:
                train_name = match.group(1).strip()
    else:
        train_name = name_elem.get_text(strip=True)

    # Find runs_on_days
    runs_on = "MTWTFSS"  # Default: runs daily
    days_elem = soup.find('span', {'id': 'MainContent_lblRunDays'})
    if not days_elem:
        days_elem = soup.find(string=re.compile(r'Runs on:'))
        if days_elem:
            text = days_elem.get_text() if hasattr(days_elem, 'get_text') else str(days_elem)
            match = re.search(r'[MTWTFSS]{1,7}', text)
            if match:
                runs_on = match.group(0)
    else:
        runs_on = days_elem.get_text(strip=True) or "MTWTFSS"

    # Parse schedule table
    # erail.in uses a specific table structure
    schedule = []

    # Look for the schedule data in the page
    # erail stores schedule in a hidden div or in script tags
    script_tags = soup.find_all('script')
    for script in script_tags:
        if script.string and 'sttnsList' in script.string:
            # Found the station list in JavaScript
            matches = re.findall(
                r'\{[^}]*stnCode["\s:]+["\'](\w+)["\'][^}]*stnName["\s:]+["\'](.*?)["\'][^}]*arr["\s:]+["\']([\d:]*)["\'][^}]*dep["\s:]+["\']([\d:]*)["\'][^}]*dist["\s:]+["\']([\d.]*)["\']',
                script.string
            )
            if matches:
                for m in matches:
                    schedule.append({
                        'station_code': m[0],
                        'station_name': m[1],
                        'arrival': m[2] or '--',
                        'departure': m[3] or '--',
                        'distance_km': m[4] or '0',
                    })

    # Fallback: parse HTML table
    if not schedule:
        tables = soup.find_all('table')
        for table in tables:
            rows = table.find_all('tr')
            for row in rows:
                cols = row.find_all('td')
                if len(cols) >= 5:
                    code = cols[1].get_text(strip=True) if len(cols) > 1 else ''
                    if re.match(r'^[A-Z]{2,5}$', code):
                        schedule.append({
                            'station_code': code,
                            'station_name': cols[2].get_text(strip=True) if len(cols) > 2 else '',
                            'arrival': cols[3].get_text(strip=True) if len(cols) > 3 else '--',
                            'departure': cols[4].get_text(strip=True) if len(cols) > 4 else '--',
                            'distance_km': cols[5].get_text(strip=True) if len(cols) > 5 else '0',
                        })

    # Another fallback: look for divs with class containing 'stn' or schedule data
    if not schedule:
        # Try the route page format
        route_divs = soup.find_all('div', class_=re.compile(r'rout|sched|stn', re.I))
        for div in route_divs:
            rows = div.find_all(['div', 'tr'], class_=re.compile(r'row|stn', re.I))
            for row in rows:
                text = row.get_text(' ', strip=True)
                match = re.match(r'(\d+)\s+([A-Z]{2,5})\s+(.+?)\s+(\d{2}:\d{2}|--)\s+(\d{2}:\d{2}|--)\s+(\d+)', text)
                if match:
                    schedule.append({
                        'station_code': match.group(2),
                        'station_name': match.group(3),
                        'arrival': match.group(4),
                        'departure': match.group(5),
                        'distance_km': match.group(6),
                    })

    if not schedule:
        print(f"  No schedule found for train {train_number}")
        return None

    return {
        'train_number': str(train_number),
        'train_name': train_name,
        'runs_on_days': runs_on,
        'schedule': schedule,
    }


def main():
    output_file = os.path.join(os.path.dirname(__file__), '..', 'data', 'train_schedules.csv')

    kerala_stations = load_kerala_stations()
    print(f"Loaded {len(kerala_stations)} Kerala station codes")
    print(f"Scraping {len(TRAIN_NUMBERS)} trains...")

    all_rows = []
    scraped = 0
    failed = 0

    for i, train_num in enumerate(TRAIN_NUMBERS):
        print(f"[{i+1}/{len(TRAIN_NUMBERS)}] Scraping train {train_num}...", end=' ')

        result = scrape_train(train_num)

        if result and result['schedule']:
            # Check if this train has any Kerala stations
            train_station_codes = {s['station_code'] for s in result['schedule']}
            kerala_overlap = train_station_codes & kerala_stations

            if kerala_overlap:
                day = 1
                for stop in result['schedule']:
                    all_rows.append({
                        'train_number': result['train_number'],
                        'train_name': result['train_name'],
                        'station_code': stop['station_code'],
                        'station_name': stop['station_name'],
                        'arrival_time': stop['arrival'],
                        'departure_time': stop['departure'],
                        'distance_km': stop['distance_km'],
                        'day_of_journey': day,
                        'runs_on_days': result['runs_on_days'],
                    })
                print(f"OK — {len(result['schedule'])} stops, {len(kerala_overlap)} in Kerala")
                scraped += 1
            else:
                print("No Kerala stations — skipping")
        else:
            print("FAILED")
            failed += 1

        # Be polite to erail.in
        time.sleep(2)

    # Write output CSV
    with open(output_file, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=[
            'train_number', 'train_name', 'station_code', 'station_name',
            'arrival_time', 'departure_time', 'distance_km',
            'day_of_journey', 'runs_on_days'
        ])
        writer.writeheader()
        writer.writerows(all_rows)

    print(f"\nDone! Scraped {scraped} trains, {failed} failed")
    print(f"Total schedule rows: {len(all_rows)}")
    print(f"Output: {output_file}")


if __name__ == '__main__':
    main()
