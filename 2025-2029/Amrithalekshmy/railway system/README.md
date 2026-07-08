# Kerala Gate Watch

Real-time status of 1,222 railway level crossings across Kerala. Know before you go — is the gate open, closing soon, or already closed?

![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-2.x-000000?logo=flask)
![scikit-learn](https://img.shields.io/badge/scikit--learn-ML-F7931E?logo=scikit-learn&logoColor=white)
![Leaflet](https://img.shields.io/badge/Leaflet.js-Map-199900?logo=leaflet&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-Database-003B57?logo=sqlite&logoColor=white)

---

## The Problem

Kerala has one of India's densest railway networks. Level crossings (where roads cross railway tracks) cause unpredictable traffic delays. There's no easy way to know if a gate on your route is closed — or about to close.

## The Solution

Kerala Gate Watch combines **train schedules**, **geographic matching**, and **ML-based delay prediction** to show the live status of every railway gate in Kerala.

### Features

- **Live Map** — All 1,222 gates on an interactive map, color-coded by status (green/orange/red)
- **"Near Me"** — Find gates closest to your current location
- **Gate Detail** — See exactly which trains are approaching and when they'll cross
- **Search & Filter** — Find gates by name, district, or status
- **ML Predictions** — Predicted train delays and gate closure durations
- **Auto-refresh** — Status updates every 60 seconds

### Status Logic

| Status | Meaning | Threshold |
|--------|---------|-----------|
| **OPEN** | No approaching train | > 15 min to next train |
| **WARNING** | Train approaching | 5–15 min to next train |
| **CLOSED** | Train at gate | 0–5 min to next train |

---

## Quick Start

```bash
# 1. Clone and setup
git clone https://github.com/amrithalekshmyg/kerala-gate-app.git
cd kerala-gate-app
python -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt

# 2. Generate data (first time only)
python scripts/generate_schedules.py
python scripts/match_gates_to_trains.py

# 3. Train ML models (optional — app works without them)
python ml/train_delay_model.py
python ml/train_closure_model.py

# 4. Run
python -m backend.app
# Open http://127.0.0.1:5000
```

---

## Architecture

```
                    ┌─────────────┐
                    │   Browser   │
                    │  Leaflet.js │
                    └──────┬──────┘
                           │ HTTP
                    ┌──────┴──────┐
                    │  Flask API  │
                    │   app.py    │
                    └──┬───┬───┬──┘
                       │   │   │
            ┌──────────┘   │   └──────────┐
            ▼              ▼              ▼
    ┌───────────┐  ┌─────────────┐  ┌───────────┐
    │   SQLite  │  │ Gate Status │  │ ML Models │
    │ database  │  │  Algorithm  │  │ (sklearn) │
    │ .py       │  │  .py        │  │ .py       │
    └───────────┘  └─────────────┘  └───────────┘
         ▲              ▲
         │              │
    CSV Data      Background
    on startup    Scheduler (60s)
```

### Data Pipeline

```
kerala_gates.csv ─────────────────────────────────────┐
kerala_stations.csv ──┐                               │
                      ▼                               ▼
            generate_schedules.py              SQLite Database
                      │                               ▲
                      ▼                               │
            train_schedules.csv                       │
                      │                               │
                      ▼                               │
           match_gates_to_trains.py                   │
                      │                               │
                      ▼                               │
           gate_train_mapping.csv ────────────────────┘
```

---

## Project Structure

```
kerala-gate-app/
├── backend/
│   ├── app.py              # Flask server, API endpoints, startup
│   ├── database.py         # SQLite schema, CSV loading
│   ├── gate_status.py      # OPEN/WARNING/CLOSED calculation
│   └── ml_predict.py       # Load models, predict delay & closure
│
├── frontend/
│   ├── index.html          # Map page (Leaflet.js)
│   ├── gate.html           # Gate detail page
│   ├── search.html         # Search & filter page
│   ├── app.js              # All frontend logic
│   └── style.css           # Styling
│
├── ml/
│   ├── train_delay_model.py      # Model 1: predict train delays
│   ├── train_closure_model.py    # Model 2: predict closure duration
│   └── collect_closure_data.py   # Crowdsource real data from users
│
├── scripts/
│   ├── generate_schedules.py     # Generate train timetable data
│   ├── match_gates_to_trains.py  # Geographic gate-to-train matching
│   └── scrape_schedules.py       # (Alt) Scrape from erail.in
│
├── data/
│   ├── kerala_gates.csv          # 1,222 gate locations (OSM)
│   ├── kerala_stations.csv       # 172 stations with coordinates
│   ├── train_schedules.csv       # Generated train schedules
│   ├── gate_train_mapping.csv    # Gate ↔ train associations
│   └── historical_delays.csv     # Training data for delay model
│
└── Learn.md                # Full project walkthrough & explanation
```

---

## ML Models

### Model 1 — Train Delay Prediction

Predicts how many minutes late a train will be, using a **Random Forest Regressor** (100 trees).

| Feature | Importance |
|---------|-----------|
| Previous station delay | 91.7% |
| Distance from origin | 2.7% |
| Scheduled hour | 1.6% |
| Train number | 1.6% |
| Month (monsoon effect) | 1.3% |
| Day of week | 0.9% |

**Performance**: MAE = 5.0 min, R² = 0.799

### Model 2 — Gate Closure Duration

Predicts how long a gate stays closed based on train type, coaches, speed, and time of day. Falls back to physics-based estimation (`distance / speed`) when the model isn't available.

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/gates` | All gates with current status |
| GET | `/api/gates/<id>` | Gate detail with upcoming trains |
| GET | `/api/gates/nearby?lat=X&lon=Y&radius=5` | Gates within radius (km) |
| GET | `/api/trains/<number>/position` | Train position and upcoming gates |
| GET | `/api/stats` | Dashboard statistics |
| GET | `/api/predict/delay?train=16301` | ML delay prediction |
| POST | `/api/report/closed` | Report gate closure (crowdsource) |
| POST | `/api/report/opened` | Report gate opening (crowdsource) |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python, Flask, APScheduler |
| Database | SQLite |
| ML | scikit-learn (Random Forest), pandas, joblib |
| Frontend | Vanilla HTML/CSS/JS, Leaflet.js |
| Map Tiles | OpenStreetMap |
| Gate Data | OpenStreetMap (1,222 level crossings) |

---

## License

MIT
