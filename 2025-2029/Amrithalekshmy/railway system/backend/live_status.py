"""
Real-time train running status using the rappid.in API.
Provides live position, delay, and current station for Indian Railway trains.
"""

import requests
import re
import time
import threading
from datetime import datetime

API_URL = "https://rappid.in/apis/train.php"
HEADERS = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"}
CACHE_TTL = 120  # seconds

_cache = {}
_cache_lock = threading.Lock()


def _parse_timing(timing_str):
    """Parse rappid.in timing field: 'actual_timescheduled_time' (e.g., '08:2108:05')."""
    if not timing_str or timing_str in ("Source", "Destination"):
        return None, None
    match = re.match(r"(\d{2}:\d{2})(\d{2}:\d{2})", timing_str)
    if match:
        return match.group(1), match.group(2)
    match = re.match(r"(\d{2}:\d{2})", timing_str)
    if match:
        return match.group(1), match.group(1)
    return None, None


def _parse_delay(delay_str):
    """Parse delay string like '18min' or 'Right Time' to minutes."""
    if not delay_str:
        return 0
    if "right" in delay_str.lower():
        return 0
    match = re.search(r"(\d+)", delay_str)
    return int(match.group(1)) if match else 0


def _parse_distance(dist_str):
    """Parse distance string like '17 km' to float."""
    if not dist_str or dist_str == "-":
        return 0.0
    match = re.search(r"([\d.]+)", dist_str)
    return float(match.group(1)) if match else 0.0


def fetch_live_status(train_number):
    """
    Fetch real-time running status for a train.
    Returns dict with current position info, or None on failure.
    """
    train_number = str(train_number).strip()

    with _cache_lock:
        cached = _cache.get(train_number)
        if cached and (time.time() - cached["_fetched_at"]) < CACHE_TTL:
            return cached

    try:
        resp = requests.get(
            API_URL,
            params={"type": "livetrainstatus", "train_no": train_number},
            headers=HEADERS,
            timeout=10,
        )
        data = resp.json()
    except Exception:
        return None

    if not data.get("success") or not data.get("data"):
        return None

    train_name = data.get("train_name", "").replace(" Running Status", "")
    # Remove leading train number from name
    train_name = re.sub(r"^\d+\s+", "", train_name)

    message = data.get("message", "")
    updated_time = data.get("updated_time", "")

    stations = []
    current_station = None
    current_idx = -1
    last_reported_idx = -1

    for i, stn in enumerate(data["data"]):
        actual_time, scheduled_time = _parse_timing(stn.get("timing", ""))
        delay_min = _parse_delay(stn.get("delay", ""))
        distance = _parse_distance(stn.get("distance", ""))

        entry = {
            "station_name": stn.get("station_name", ""),
            "actual_time": actual_time,
            "scheduled_time": scheduled_time,
            "delay_minutes": delay_min,
            "distance_km": distance,
            "platform": stn.get("platform", ""),
            "halt": stn.get("halt", ""),
            "is_source": stn.get("halt") == "Source",
            "is_destination": stn.get("halt") == "Destination",
        }
        stations.append(entry)

        if stn.get("is_current_station"):
            current_station = entry
            current_idx = i

        if actual_time and not stn.get("halt") == "Destination":
            last_reported_idx = i

    # Determine train's current position
    if current_idx >= 0:
        position_idx = current_idx
    elif last_reported_idx >= 0:
        position_idx = last_reported_idx
    else:
        position_idx = -1

    avg_delay = 0
    if stations:
        delays = [s["delay_minutes"] for s in stations if s["actual_time"]]
        if delays:
            avg_delay = round(sum(delays) / len(delays))

    latest_delay = 0
    if position_idx >= 0:
        latest_delay = stations[position_idx]["delay_minutes"]

    # Build upcoming stations
    upcoming = []
    if position_idx >= 0:
        for s in stations[position_idx + 1 :]:
            upcoming.append(s)

    result = {
        "train_number": train_number,
        "train_name": train_name,
        "message": message,
        "updated_time": updated_time,
        "stations": stations,
        "current_station": current_station or (stations[position_idx] if position_idx >= 0 else None),
        "current_station_index": position_idx,
        "latest_delay_minutes": latest_delay,
        "average_delay_minutes": avg_delay,
        "upcoming_stations": upcoming,
        "is_running": position_idx >= 0 and position_idx < len(stations) - 1,
        "_fetched_at": time.time(),
    }

    with _cache_lock:
        _cache[train_number] = result

    return result


def get_train_delay(train_number):
    """Get the latest delay in minutes for a train. Returns 0 if unavailable."""
    status = fetch_live_status(train_number)
    if status:
        return status["latest_delay_minutes"]
    return 0


def get_train_position_message(train_number):
    """Get a human-readable position message for a train."""
    status = fetch_live_status(train_number)
    if not status:
        return None
    return status["message"]


def clear_cache():
    """Clear the live status cache."""
    global _cache
    with _cache_lock:
        _cache = {}
