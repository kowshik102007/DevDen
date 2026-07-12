"""
Generate realistic train schedule data for Kerala railways.
Creates data/train_schedules.csv with station-by-station timings
for major trains on Kerala's railway lines.
"""

import csv
import os
import math
from datetime import datetime, timedelta

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
STATIONS_FILE = os.path.join(DATA_DIR, 'kerala_stations.csv')
OUTPUT_FILE = os.path.join(DATA_DIR, 'train_schedules.csv')


def load_stations():
    stations = {}
    with open(STATIONS_FILE, 'r') as f:
        for row in csv.DictReader(f):
            stations[row['station_code'].strip()] = {
                'name': row['station_name'],
                'lat': float(row['lat']),
                'lon': float(row['lon']),
            }
    return stations


def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def compute_distances(route, stations):
    dists = [0.0]
    for i in range(1, len(route)):
        s1 = stations[route[i - 1]]
        s2 = stations[route[i]]
        dists.append(dists[-1] + haversine(s1['lat'], s1['lon'], s2['lat'], s2['lon']))
    return dists


def make_schedule(route, stations, start_hour, start_min, avg_speed_kmph, halt_min=1):
    """Generate a station-by-station schedule for a route."""
    dists = compute_distances(route, stations)
    total_km = dists[-1]

    schedule = []
    for i, code in enumerate(route):
        travel_km = dists[i]
        travel_hours = travel_km / avg_speed_kmph if avg_speed_kmph > 0 else 0
        travel_min = travel_hours * 60
        cumulative_halt = i * halt_min

        arrival_total = start_hour * 60 + start_min + travel_min + cumulative_halt
        departure_total = arrival_total + halt_min

        arr_h = int(arrival_total // 60) % 24
        arr_m = int(arrival_total % 60)
        dep_h = int(departure_total // 60) % 24
        dep_m = int(departure_total % 60)

        schedule.append({
            'station_code': code,
            'station_name': stations[code]['name'],
            'arrival_time': '--' if i == 0 else f'{arr_h:02d}:{arr_m:02d}',
            'departure_time': f'{dep_h:02d}:{dep_m:02d}' if i < len(route) - 1 else '--',
            'distance_km': round(dists[i], 1),
        })

    return schedule


# Kerala's main railway lines (station codes in order)
# Coastal main line: Mangalore side to Trivandrum
MAIN_LINE_NORTH = [
    'MJS', 'UAA', 'KMQ', 'KGQ', 'KQK', 'BFR', 'NLE', 'CHV', 'TKQ',
    'ELM', 'PAZ', 'KPQ', 'PPNS', 'VAPM', 'CAN', 'CS', 'ETK', 'TLY',
    'JGE', 'MAHE', 'BDJ', 'PYOL', 'TKT', 'QLD', 'CMC', 'ETR', 'WH', 'CLT',
]

MAIN_LINE_CLT_SRR = [
    'CLT', 'KUL', 'FK', 'KN', 'VLI', 'PGI', 'TA', 'TIR', 'TUA',
    'KTU', 'SRR',
]

MAIN_LINE_SRR_TCR = [
    'SRR', 'VTK', 'WKI', 'MGK', 'AMLR', 'PNQ', 'TCR',
]

MAIN_LINE_TCR_ERS = [
    'TCR', 'OLR', 'PUK', 'IJK', 'CKI', 'KUC', 'AFK',
    'CWR', 'ALVA', 'PNCU', 'CPPY', 'AATK', 'MUTT', 'KLMR',
    'CCUV', 'PDPM', 'EDAP', 'CGPP', 'PARV', 'JLSD', 'KALR', 'ERN',
]

MAIN_LINE_ERS_COAST = [
    'ERS', 'KPTM', 'TUVR', 'SRTL', 'MAKM', 'ALLP', 'AMPA', 'HAD',
    'CHPD', 'KYJ',
]

MAIN_LINE_KYJ_QLN = [
    'KYJ', 'OCR', 'KPY', 'STKT', 'MQO', 'KLQ', 'QLN',
]

MAIN_LINE_QLN_TVC = [
    'QLN', 'MYY', 'PVU', 'KFI', 'EVA', 'VAK', 'KVU', 'CRY',
    'PGZ', 'MQU', 'KXP', 'KZK', 'TVCN', 'TVP', 'TVC',
]

MAIN_LINE_TVC_SOUTH = [
    'TVC', 'NEM', 'BRAM', 'NYY', 'DAVM', 'PASA',
]

# Shoranur - Palakkad line
SRR_PGT = [
    'SRR', 'MNUR', 'OTP', 'KRKD', 'PTB', 'PUM', 'PKQ', 'AAM',
    'LDY', 'MNY', 'PLL', 'KTKU', 'PGT', 'KJKD', 'WRA',
]

# Ernakulam - Kottayam via Thrippunithura (alternative inland route)
ERS_KTYM = [
    'ERS', 'TRTR', 'TNU', 'KUMM', 'KFE', 'MNTT', 'KPTM',
    'PVRD', 'VARD', 'KRPP', 'ETM', 'KFQ', 'KTYM',
]

KTYM_KYJ = [
    'KTYM', 'CGV', 'CGY', 'TRVL', 'CNGR', 'CYN', 'MVLK', 'KYJ',
]

# Kayamkulam - Punalur - Shencottah line
KYJ_PUU = [
    'KYJ', 'MVLK', 'CYN', 'CNGR', 'KKZ', 'EKN', 'KUV',
    'AVS', 'PUU',
]

PUU_AYV = [
    'PUU', 'EDN', 'OKL', 'TML', 'AYVN', 'AYV',
]

# Shoranur - Nilambur line
SRR_NIL = [
    'SRR', 'VTK', 'VNB', 'MLTR', 'NIL',
]

# Thrissur - Guruvayur line
TCR_GUV = [
    'TCR', 'OLR', 'PUK', 'IJK', 'GUV',
]

# Full long-distance routes
FULL_COASTAL_SOUTH = (MAIN_LINE_NORTH + MAIN_LINE_CLT_SRR[1:] +
                       MAIN_LINE_SRR_TCR[1:] + MAIN_LINE_TCR_ERS[1:] +
                       MAIN_LINE_ERS_COAST[1:] + MAIN_LINE_KYJ_QLN[1:] +
                       MAIN_LINE_QLN_TVC[1:])

FULL_COASTAL_NORTH = list(reversed(FULL_COASTAL_SOUTH))

# Inland route via Kottayam
INLAND_SOUTH = (MAIN_LINE_NORTH + MAIN_LINE_CLT_SRR[1:] +
                MAIN_LINE_SRR_TCR[1:] + MAIN_LINE_TCR_ERS[1:] +
                ['ERS'] + ERS_KTYM[1:] + KTYM_KYJ[1:] +
                MAIN_LINE_KYJ_QLN[1:] + MAIN_LINE_QLN_TVC[1:])

INLAND_NORTH = list(reversed(INLAND_SOUTH))


def define_trains():
    """Define trains with their routes, timings, and running days."""
    trains = []

    # --- Express/Mail trains on the coastal main line (southbound) ---
    express_sb_configs = [
        ('16605', 'Mangala Lakshadweep Exp', FULL_COASTAL_SOUTH, 6, 0, 55, 2, 'MTWTFSS'),
        ('12625', 'Kerala Express', FULL_COASTAL_SOUTH, 7, 30, 50, 2, 'MTWTFSS'),
        ('16345', 'Netravati Express', FULL_COASTAL_SOUTH, 9, 0, 48, 2, 'MTWTFSS'),
        ('12601', 'Mangala Express', FULL_COASTAL_SOUTH, 10, 30, 52, 2, 'MT-TFSS'),
        ('16525', 'Kanyakumari Express', FULL_COASTAL_SOUTH, 12, 0, 45, 2, 'MTWTFSS'),
        ('12695', 'Trivandrum Rajdhani', FULL_COASTAL_SOUTH, 14, 0, 60, 1, 'M-W-F--'),
        ('22113', 'Kochuveli Superfast', FULL_COASTAL_SOUTH, 15, 30, 55, 2, 'MTWTFSS'),
        ('16859', 'Malabar Express', FULL_COASTAL_SOUTH, 17, 0, 45, 2, 'MTWTFSS'),
        ('12617', 'Mangala Express', FULL_COASTAL_SOUTH, 19, 0, 50, 2, '-T-T---'),
        ('16527', 'Guruvayur Express', FULL_COASTAL_SOUTH, 20, 30, 48, 2, 'MTWTFSS'),
        ('12511', 'Rapti Sagar Express', FULL_COASTAL_SOUTH, 22, 0, 52, 2, '--W--S-'),
        ('16335', 'Nagercoil Express', FULL_COASTAL_SOUTH, 23, 30, 46, 2, 'MTWTFSS'),
    ]

    # --- Express/Mail trains (northbound) ---
    express_nb_configs = [
        ('16606', 'Mangala Lakshadweep Exp', FULL_COASTAL_NORTH, 5, 0, 55, 2, 'MTWTFSS'),
        ('12626', 'Kerala Express', FULL_COASTAL_NORTH, 6, 30, 50, 2, 'MTWTFSS'),
        ('16346', 'Netravati Express', FULL_COASTAL_NORTH, 8, 0, 48, 2, 'MTWTFSS'),
        ('12602', 'Mangala Express', FULL_COASTAL_NORTH, 10, 0, 52, 2, 'MT-TFSS'),
        ('16526', 'Kanyakumari Express', FULL_COASTAL_NORTH, 11, 30, 45, 2, 'MTWTFSS'),
        ('12696', 'Trivandrum Rajdhani', FULL_COASTAL_NORTH, 13, 0, 60, 1, 'M-W-F--'),
        ('22114', 'Kochuveli Superfast', FULL_COASTAL_NORTH, 14, 30, 55, 2, 'MTWTFSS'),
        ('16860', 'Malabar Express', FULL_COASTAL_NORTH, 16, 30, 45, 2, 'MTWTFSS'),
        ('12618', 'Mangala Express', FULL_COASTAL_NORTH, 18, 0, 50, 2, '-T-T---'),
        ('16528', 'Guruvayur Express', FULL_COASTAL_NORTH, 19, 30, 48, 2, 'MTWTFSS'),
        ('12512', 'Rapti Sagar Express', FULL_COASTAL_NORTH, 21, 0, 52, 2, '--W--S-'),
        ('16336', 'Nagercoil Express', FULL_COASTAL_NORTH, 23, 0, 46, 2, 'MTWTFSS'),
    ]

    # --- Inland route trains (via Kottayam) ---
    inland_configs = [
        ('12081', 'Jan Shatabdi Express', INLAND_SOUTH, 6, 15, 55, 2, 'MTWTF--'),
        ('16301', 'Venad Express', INLAND_SOUTH, 8, 0, 45, 2, 'MTWTFSS'),
        ('12623', 'Thiruvananthapuram Mail', INLAND_SOUTH, 11, 0, 50, 2, 'MTWTFSS'),
        ('16303', 'Vanchinad Express', INLAND_SOUTH, 14, 0, 44, 2, 'MTWTFSS'),
        ('16349', 'Mangalore Express', INLAND_SOUTH, 18, 0, 48, 2, 'MTWTFSS'),
        ('12082', 'Jan Shatabdi Express', INLAND_NORTH, 5, 30, 55, 2, 'MTWTF--'),
        ('16302', 'Venad Express', INLAND_NORTH, 7, 30, 45, 2, 'MTWTFSS'),
        ('12624', 'Thiruvananthapuram Mail', INLAND_NORTH, 10, 0, 50, 2, 'MTWTFSS'),
        ('16304', 'Vanchinad Express', INLAND_NORTH, 13, 30, 44, 2, 'MTWTFSS'),
        ('16350', 'Mangalore Express', INLAND_NORTH, 17, 30, 48, 2, 'MTWTFSS'),
    ]

    # --- Short-distance / Passenger trains (much more frequent) ---
    # TVC-ERS corridor
    tvc_ers_route = MAIN_LINE_QLN_TVC[::-1] + MAIN_LINE_KYJ_QLN[::-1] + MAIN_LINE_ERS_COAST[::-1]
    ers_tvc_route = MAIN_LINE_ERS_COAST + MAIN_LINE_KYJ_QLN[1:] + MAIN_LINE_QLN_TVC[1:]
    passenger_configs = []
    for hour in range(5, 22, 2):
        num_sb = 56361 + (hour - 5)
        num_nb = 56381 + (hour - 5)
        passenger_configs.append(
            (str(num_sb), 'ERS-TVC Passenger', ers_tvc_route, hour, 0, 35, 2, 'MTWTFSS'))
        passenger_configs.append(
            (str(num_nb), 'TVC-ERS Passenger', tvc_ers_route, hour, 30, 35, 2, 'MTWTFSS'))

    # ERS-CLT corridor
    ers_clt_route = list(reversed(MAIN_LINE_TCR_ERS)) + MAIN_LINE_SRR_TCR[::-1] + MAIN_LINE_CLT_SRR[::-1]
    clt_ers_route = MAIN_LINE_CLT_SRR + MAIN_LINE_SRR_TCR[1:] + MAIN_LINE_TCR_ERS[1:]
    for hour in range(5, 22, 3):
        num_sb = 66301 + (hour - 5)
        num_nb = 66311 + (hour - 5)
        passenger_configs.append(
            (str(num_sb), 'CLT-ERS MEMU', clt_ers_route, hour, 15, 38, 1, 'MTWTFSS'))
        passenger_configs.append(
            (str(num_nb), 'ERS-CLT MEMU', ers_clt_route, hour, 45, 38, 1, 'MTWTFSS'))

    # CAN-CLT short passenger
    can_clt = MAIN_LINE_NORTH[MAIN_LINE_NORTH.index('CAN'):]
    clt_can = list(reversed(can_clt))
    for hour in range(6, 21, 3):
        num = 56651 + (hour - 6)
        passenger_configs.append(
            (str(num), 'CAN-CLT Passenger', can_clt, hour, 0, 40, 1, 'MTWTFSS'))
        passenger_configs.append(
            (str(num + 20), 'CLT-CAN Passenger', clt_can, hour, 30, 40, 1, 'MTWTFSS'))

    # QLN-TVC short
    for hour in range(5, 23, 2):
        num = 66341 + (hour - 5)
        passenger_configs.append(
            (str(num), 'QLN-TVC Passenger', MAIN_LINE_QLN_TVC, hour, 10, 35, 1, 'MTWTFSS'))
        passenger_configs.append(
            (str(num + 20), 'TVC-QLN Passenger', list(reversed(MAIN_LINE_QLN_TVC)),
             hour, 40, 35, 1, 'MTWTFSS'))

    # SRR-PGT corridor
    for hour in [6, 9, 12, 15, 18, 21]:
        num = 56501 + (hour - 6)
        passenger_configs.append(
            (str(num), 'SRR-PGT Passenger', SRR_PGT, hour, 20, 40, 1, 'MTWTFSS'))
        passenger_configs.append(
            (str(num + 10), 'PGT-SRR Passenger', list(reversed(SRR_PGT)),
             hour, 50, 40, 1, 'MTWTFSS'))

    # TCR-GUV corridor
    for hour in [6, 8, 10, 13, 16, 19]:
        num = 66401 + (hour - 6)
        passenger_configs.append(
            (str(num), 'TCR-GUV MEMU', TCR_GUV, hour, 0, 40, 1, 'MTWTFSS'))
        passenger_configs.append(
            (str(num + 10), 'GUV-TCR MEMU', list(reversed(TCR_GUV)),
             hour, 30, 40, 1, 'MTWTFSS'))

    # SRR-NIL corridor
    for hour in [7, 10, 14, 17, 20]:
        num = 56601 + (hour - 7)
        passenger_configs.append(
            (str(num), 'SRR-NIL Passenger', SRR_NIL, hour, 0, 35, 1, 'MTWTFSS'))
        passenger_configs.append(
            (str(num + 10), 'NIL-SRR Passenger', list(reversed(SRR_NIL)),
             hour, 30, 35, 1, 'MTWTFSS'))

    # KYJ-PUU corridor
    for hour in [6, 10, 14, 18]:
        num = 56701 + (hour - 6)
        passenger_configs.append(
            (str(num), 'KYJ-PUU Passenger', KYJ_PUU, hour, 0, 35, 1, 'MTWTFSS'))
        passenger_configs.append(
            (str(num + 10), 'PUU-KYJ Passenger', list(reversed(KYJ_PUU)),
             hour, 30, 35, 1, 'MTWTFSS'))

    # ERS-KTYM via Kottayam
    for hour in range(6, 22, 2):
        num = 66501 + (hour - 6)
        passenger_configs.append(
            (str(num), 'ERS-KTYM Passenger', ERS_KTYM, hour, 5, 35, 1, 'MTWTFSS'))
        passenger_configs.append(
            (str(num + 20), 'KTYM-ERS Passenger', list(reversed(ERS_KTYM)),
             hour, 35, 35, 1, 'MTWTFSS'))

    # TVC to south
    for hour in [7, 11, 15, 19]:
        num = 66601 + (hour - 7)
        passenger_configs.append(
            (str(num), 'TVC-PASA Passenger', MAIN_LINE_TVC_SOUTH, hour, 0, 35, 1, 'MTWTFSS'))
        passenger_configs.append(
            (str(num + 10), 'PASA-TVC Passenger', list(reversed(MAIN_LINE_TVC_SOUTH)),
             hour, 30, 35, 1, 'MTWTFSS'))

    all_configs = express_sb_configs + express_nb_configs + inland_configs + passenger_configs

    for cfg in all_configs:
        num, name, route, h, m, speed, halt, days = cfg
        trains.append({
            'train_number': num,
            'train_name': name,
            'route': route,
            'start_hour': h,
            'start_min': m,
            'speed': speed,
            'halt': halt,
            'runs_on_days': days,
        })

    return trains


def main():
    stations = load_stations()
    print(f"Loaded {len(stations)} stations")

    trains = define_trains()
    print(f"Defined {len(trains)} trains")

    all_rows = []
    skipped = 0

    for train in trains:
        route = [s for s in train['route'] if s in stations]
        if len(route) < 2:
            skipped += 1
            continue

        schedule = make_schedule(
            route, stations,
            train['start_hour'], train['start_min'],
            train['speed'], train['halt'],
        )

        for stop in schedule:
            all_rows.append({
                'train_number': train['train_number'],
                'train_name': train['train_name'],
                'station_code': stop['station_code'],
                'station_name': stop['station_name'],
                'arrival_time': stop['arrival_time'],
                'departure_time': stop['departure_time'],
                'distance_km': stop['distance_km'],
                'day_of_journey': 1,
                'runs_on_days': train['runs_on_days'],
            })

    with open(OUTPUT_FILE, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=[
            'train_number', 'train_name', 'station_code', 'station_name',
            'arrival_time', 'departure_time', 'distance_km',
            'day_of_journey', 'runs_on_days'
        ])
        writer.writeheader()
        writer.writerows(all_rows)

    print(f"Generated {len(all_rows)} schedule rows for {len(trains) - skipped} trains")
    print(f"Skipped {skipped} trains (missing station data)")
    print(f"Output: {OUTPUT_FILE}")


if __name__ == '__main__':
    main()
