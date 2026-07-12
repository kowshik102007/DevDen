

import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from backend.database import get_db


def record_gate_closed(gate_id, train_number=None):
    """Record that a gate just closed."""
    conn = get_db()
    cursor = conn.cursor()
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    cursor.execute('''
        INSERT INTO gate_closure_events (gate_id, train_number, closed_at, recorded_date, source)
        VALUES (?, ?, ?, ?, 'user_report')
    ''', (gate_id, train_number, now, now[:10]))

    event_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return event_id


def record_gate_opened(gate_id):
    """
    Record that a gate just opened.
    Finds the most recent unfinished closure event for this gate
    and calculates the duration.
    """
    conn = get_db()
    cursor = conn.cursor()
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    # Find the most recent closure event without an opened_at time
    cursor.execute('''
        SELECT id, closed_at FROM gate_closure_events
        WHERE gate_id = ? AND opened_at IS NULL
        ORDER BY closed_at DESC
        LIMIT 1
    ''', (gate_id,))

    row = cursor.fetchone()
    if not row:
        conn.close()
        return None

    # Calculate duration
    closed_at = datetime.strptime(row['closed_at'], '%Y-%m-%d %H:%M:%S')
    opened_at = datetime.strptime(now, '%Y-%m-%d %H:%M:%S')
    duration = (opened_at - closed_at).total_seconds() / 60

    # Sanity check: closure shouldn't be more than 30 minutes
    if duration > 30:
        conn.close()
        return None

    cursor.execute('''
        UPDATE gate_closure_events
        SET opened_at = ?, duration_minutes = ?
        WHERE id = ?
    ''', (now, round(duration, 2), row['id']))

    conn.commit()
    conn.close()
    return {'event_id': row['id'], 'duration_minutes': round(duration, 2)}


def get_closure_stats(gate_id=None):
    """Get closure statistics, optionally filtered by gate."""
    conn = get_db()
    cursor = conn.cursor()

    if gate_id:
        cursor.execute('''
            SELECT COUNT(*) as total,
                   AVG(duration_minutes) as avg_duration,
                   MIN(duration_minutes) as min_duration,
                   MAX(duration_minutes) as max_duration
            FROM gate_closure_events
            WHERE gate_id = ? AND duration_minutes IS NOT NULL
        ''', (gate_id,))
    else:
        cursor.execute('''
            SELECT COUNT(*) as total,
                   AVG(duration_minutes) as avg_duration,
                   MIN(duration_minutes) as min_duration,
                   MAX(duration_minutes) as max_duration
            FROM gate_closure_events
            WHERE duration_minutes IS NOT NULL
        ''')

    row = cursor.fetchone()
    conn.close()

    return {
        'total_events': row['total'],
        'avg_duration': round(row['avg_duration'], 1) if row['avg_duration'] else None,
        'min_duration': round(row['min_duration'], 1) if row['min_duration'] else None,
        'max_duration': round(row['max_duration'], 1) if row['max_duration'] else None,
    }


def export_training_data():
    """Export closure events as CSV for model training."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT gate_id, train_number, closed_at, opened_at,
               duration_minutes, recorded_date
        FROM gate_closure_events
        WHERE duration_minutes IS NOT NULL
        ORDER BY recorded_date
    ''')

    rows = cursor.fetchall()
    conn.close()

    if not rows:
        print("No completed closure events to export.")
        return

    import csv
    output_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'gate_closure_events.csv')
    with open(output_path, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['gate_id', 'train_number', 'closed_at', 'opened_at',
                         'duration_minutes', 'recorded_date'])
        for row in rows:
            writer.writerow([row['gate_id'], row['train_number'], row['closed_at'],
                             row['opened_at'], row['duration_minutes'], row['recorded_date']])

    print(f"Exported {len(rows)} closure events to {output_path}")


if __name__ == '__main__':
    stats = get_closure_stats()
    print("Gate Closure Data Collection Stats:")
    print(f"  Total completed events: {stats['total_events']}")
    if stats['avg_duration']:
        print(f"  Avg duration: {stats['avg_duration']} min")
        print(f"  Min duration: {stats['min_duration']} min")
        print(f"  Max duration: {stats['max_duration']} min")
    else:
        print("  No data collected yet.")
    print("\nTo collect data, users report gate closures via the app.")
    print("Target: 500+ events before training Model 2 on real data.")
