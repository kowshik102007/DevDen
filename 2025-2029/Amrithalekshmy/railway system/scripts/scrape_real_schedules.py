

import requests
from bs4 import BeautifulSoup
import csv
import time
import re
import os

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
STATIONS_FILE = os.path.join(DATA_DIR, 'kerala_stations.csv')
OUTPUT_FILE = os.path.join(DATA_DIR, 'train_schedules.csv')

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 '
                  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

# Real Kerala train numbers — covering all major routes
# Verified real Kerala train numbers from erail.in API
# Last updated: 2026-07-02
TRAIN_NUMBERS = [
    # Superfast / Express (daily Kerala services)
    10215, 10216,  # Madgaon-ERS Express
    11097, 11098,  # Poorna Express (PUNE-ERS)
    12075, 12076,  # Jan Shatabdi (CLT-TVC)
    12081, 12082,  # Jan Shatabdi (CAN-TVC)
    12201, 12202,  # Garib Rath (LTT-TVCN)
    12217, 12218,  # Sampark Kranti (TVCN-CDG)
    12257, 12258,  # YPR-TVCN Garib Rath
    12283, 12284,  # ERS-NZM Duronto
    12431, 12432,  # TVC Rajdhani
    12511, 12512,  # Rapti Sagar Express
    12521, 12522,  # Rapti Sagar (BJU-ERS)
    12617, 12618,  # Mangala Lakshadweep Express (ERS-NZM)
    12623, 12624,  # TVC Mail (MAS-TVC)
    12625, 12626,  # Kerala Express (TVC-NDLS)
    12643, 12644,  # Swarna Jayanti Express
    12645, 12646,  # Millennium Express (ERS-NZM)
    12683, 12684,  # ERS-SMVB SF Express
    12695, 12696,  # MAS-TVC SF Express
    12697, 12698,  # MAS-TVC SF Express
    12977, 12978,  # Maru Sagar Express (ERS-AII)
    13351, 13352,  # DHN-ALLP Express

    # Vande Bharat / Premium
    20631, 20632,  # MAQ-TVC Vande Bharat
    20633, 20634,  # KGQ-TVC Vande Bharat
    26651, 26652,  # SBC-ERS Vande Bharat

    # Intercity / Short Express (daily, high frequency)
    16127, 16128,  # Guruvayur-Chennai Express
    16187, 16188,  # KIK-ERS Express
    16301, 16302,  # Venad Express (SRR-TVC)
    16303, 16304,  # Vanchinad Express (ERS-TVC)
    16305, 16306,  # ERS-CAN Express
    16307, 16308,  # ALLP-CAN Express
    16313, 16314,  # TVCN-MAJN Antyodaya
    16315, 16316,  # MYS-TVCN Express
    16325, 16326,  # NIL-KTYM Express
    16327, 16328,  # MDU-GUV Express
    16329, 16330,  # NCJ-MAJN Amrit Bharat
    16331, 16332,  # TVC-LTT Express
    16335, 16336,  # GIMB-NCJ Express
    16337, 16338,  # OKHA-ERS Express
    16341, 16342,  # GUV-TVC Express
    16343, 16344,  # Amritha Express (TVC-RMM)
    16345, 16346,  # Netravati Express (LTT-TVC)
    16347, 16348,  # Mangalore/Trivandrum Express
    16349, 16350,  # Rajya Rani Express (TVCN-NIL)
    16355, 16356,  # TVCN-MAJN Antyodaya
    16366,          # NCJ-KTYM Express
    16377, 16378,  # BNC-ERS Intercity
    16381, 16382,  # Kanyakumari Express (PUNE-CAPE)
    16525, 16526,  # CAPE-SBC Express
    16561, 16562,  # YPR-TVCN AC Express
    16603, 16604,  # Maveli Express (MAQ-TVC)
    16605, 16606,  # Ernad Express (MAQ-TVC)
    16629, 16630,  # Malabar Express (TVC-MAQ)
    16649, 16650,  # Parasuram Express (MAQ-CAPE)
    16729, 16730,  # MDU-PUU Express
    16791, 16792,  # Palaruvi Express (TN-PGT)

    # Sabari / Other SF
    20629, 20630,  # Sabari SF Express (SC-TVC)
    20635, 20636,  # Anantapuri Express (MS-QLN)
    20923, 20924,  # TEN Humsafar
    22113, 22114,  # LTT-TVCN SF Express
    22149, 22150,  # ERS-PUNE SF Express
    22207, 22208,  # MAS-TVC AC SF Express
    22503, 22504,  # Vivek Express (CAPE-DBRG)
    22633, 22634,  # TVC-NZM SF Express
    22639, 22640,  # MAS-ALLP SF Express
    22641, 22642,  # TVC-SHM SF Express
    22643, 22644,  # ERS-PNBE SF Express
    22645, 22646,  # INDB-TVCN SF Express
    22647, 22648,  # KRBA-TVCN SF Express
    22653, 22654,  # TVC-NZM SF Express
    22655, 22656,  # ERS-NZM SF Express
    22659, 22660,  # TVCN-YNRK SF Express
    22669, 22670,  # ERS-PNBE SF Express
    22815, 22816,  # BSP-ERS SF Express
    22877, 22878,  # HWH-ERS Antyodaya

    # Long Distance (less frequent)
    15607, 15608,  # Aronai Express (TVC-SCL)
    17421, 17422,  # TPTY-QLN Express
    18189, 18190,  # TATA-ERS Express
    18501, 18502,  # VSKP-QLN Express
    18567, 18568,  # VSKP-QLN Express
    19259, 19260,  # TVCN-BVC Express
    19577, 19578,  # TEN-JAM Express
    22619, 22620,  # BSP-TEN SF Express

    # Passenger / MEMU (verified real numbers)
    56101, 56102,  # QLN-NCJ Passenger
    56303, 56304,  # QLN-TVC Passenger
    56307,          # QLN-TVC Passenger
    56313, 56314,  # GUV-ERS Passenger
    56317, 56318,  # GUV-ERS Passenger
    56705, 56706,  # PUU-CAPE Passenger
    66305, 66306,  # CAPE-QLN MEMU
    66319, 66320,  # SRR-ERS MEMU
    66609, 66610,  # PGT-ERS MEMU
]


TRAIN_NUMBERS = sorted(set(TRAIN_NUMBERS))


def load_kerala_stations():
    stations = set()
    with open(STATIONS_FILE, 'r') as f:
        for row in csv.DictReader(f):
            stations.add(row['station_code'].strip())
    return stations


def scrape_schedule(train_number):
    url = f'https://www.confirmtkt.com/train-schedule/{train_number}'
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        if resp.status_code != 200:
            return None
    except requests.RequestException as e:
        print(f"  Error: {e}")
        return None

    soup = BeautifulSoup(resp.text, 'html.parser')
    tables = soup.find_all('table')
    if not tables:
        return None

    schedule = []
    header_row = tables[0].find('tr')
    if not header_row:
        return None

    rows = tables[0].find_all('tr')[1:]
    for row in rows:
        cols = [td.get_text(strip=True) for td in row.find_all('td')]
        if len(cols) < 6:
            continue

        stn_text = cols[1]
        match = re.search(r'-\s*([A-Z]{2,6})\s*$', stn_text)
        code = match.group(1) if match else ''
        name = stn_text.rsplit('-', 1)[0].strip() if match else stn_text

        if not code:
            continue

        arr = cols[2].strip()
        dep = cols[3].strip()
        dist = cols[5].replace('km', '').strip()

        schedule.append({
            'station_code': code,
            'station_name': name,
            'arrival_time': '--' if arr in ('Start', 'Source', '-', '') else arr,
            'departure_time': '--' if dep in ('End', 'Destination', '-', '') else dep,
            'distance_km': dist,
        })

    if not schedule:
        return None

    train_name = ''
    title = soup.find('title')
    if title:
        match = re.search(r'(\d+)\s+(.+?)\s*(?:Route|Schedule|Train)', title.get_text())
        if match:
            train_name = match.group(2).strip()
    if not train_name:
        h1 = soup.find('h1')
        if h1:
            match = re.search(r'\d+\s+(.+?)(?:\s+Route|\s+Schedule|$)', h1.get_text())
            if match:
                train_name = match.group(1).strip()


    runs_on = 'MTWTFSS'
    if len(tables) > 1:
        for row in tables[1].find_all('tr'):
            cols = [td.get_text(strip=True) for td in row.find_all('td')]
            if len(cols) >= 2 and 'Service' in cols[0]:
                days_text = cols[1]
                day_names = {'Mon': 0, 'Tue': 1, 'Wed': 2, 'Thu': 3,
                            'Fri': 4, 'Sat': 5, 'Sun': 6}
                day_chars = list('-------')
                for day_name, idx in day_names.items():
                    if day_name in days_text:
                        day_chars[idx] = 'MTWTFSS'[idx]
                runs_on = ''.join(day_chars)

    return {
        'train_number': str(train_number),
        'train_name': train_name,
        'runs_on_days': runs_on,
        'schedule': schedule,
    }


def main():
    kerala_stations = load_kerala_stations()
    print(f"Loaded {len(kerala_stations)} Kerala station codes")
    print(f"Scraping {len(TRAIN_NUMBERS)} trains from confirmtkt.com...")
    print()

    all_rows = []
    scraped = 0
    failed = 0
    skipped = 0

    for i, train_num in enumerate(TRAIN_NUMBERS):
        print(f"[{i+1}/{len(TRAIN_NUMBERS)}] Train {train_num}...", end=' ', flush=True)

        result = scrape_schedule(train_num)

        if result and result['schedule']:
            # Check Kerala station overlap
            train_codes = {s['station_code'] for s in result['schedule']}
            kerala_overlap = train_codes & kerala_stations

            if kerala_overlap:
                for stop in result['schedule']:
                    all_rows.append({
                        'train_number': result['train_number'],
                        'train_name': result['train_name'],
                        'station_code': stop['station_code'],
                        'station_name': stop['station_name'],
                        'arrival_time': stop['arrival_time'],
                        'departure_time': stop['departure_time'],
                        'distance_km': stop['distance_km'],
                        'day_of_journey': 1,
                        'runs_on_days': result['runs_on_days'],
                    })
                print(f"{result['train_name']} — {len(result['schedule'])} stops, "
                      f"{len(kerala_overlap)} in Kerala")
                scraped += 1
            else:
                print("No Kerala stations — skipped")
                skipped += 1
        else:
            print("NOT FOUND")
            failed += 1


        time.sleep(1.5)


    with open(OUTPUT_FILE, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=[
            'train_number', 'train_name', 'station_code', 'station_name',
            'arrival_time', 'departure_time', 'distance_km',
            'day_of_journey', 'runs_on_days'
        ])
        writer.writeheader()
        writer.writerows(all_rows)

    print(f"\n{'='*50}")
    print(f"Done! Scraped: {scraped}, Failed: {failed}, Skipped: {skipped}")
    print(f"Total schedule rows: {len(all_rows)}")
    print(f"Output: {OUTPUT_FILE}")


if __name__ == '__main__':
    main()
