"""SQLite schema and helper utilities for JananiAI.

This module implements the schema SQL, triggers and a small set of
convenience functions used by the backend and device sync.
"""

from __future__ import annotations

import sqlite3
import uuid
import os
from datetime import datetime
from typing import Any

SCHEMA_SQL = """
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS patients (
    id                              TEXT PRIMARY KEY,
    mcp_card_number                 TEXT UNIQUE,
    name_local                      TEXT NOT NULL,
    name_transliterated             TEXT,
    age_at_registration             INTEGER NOT NULL,
    lmp_date                        TEXT,
    edd_date                        TEXT,
    village                         TEXT NOT NULL,
    subcentre                       TEXT NOT NULL,
    phc_name                        TEXT NOT NULL,
    asha_worker_id                  TEXT NOT NULL,
    phone_number                    TEXT,
    ration_card_number              TEXT,
    gravida                         INTEGER,
    parity                          INTEGER,
    previous_complications          INTEGER DEFAULT 0,
    inter_pregnancy_interval_months INTEGER DEFAULT 0,
    created_at                      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at                      TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at                      TEXT,
    sync_status                     TEXT NOT NULL DEFAULT 'pending'
                                    CHECK(sync_status IN ('pending','synced','conflict')),
    server_id                       TEXT
);

CREATE INDEX IF NOT EXISTS idx_patients_asha   ON patients(asha_worker_id);
CREATE INDEX IF NOT EXISTS idx_patients_mcp    ON patients(mcp_card_number);
CREATE INDEX IF NOT EXISTS idx_patients_sync   ON patients(sync_status)
                                               WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS anc_visits (
    id                          TEXT PRIMARY KEY,
    patient_id                  TEXT NOT NULL REFERENCES patients(id),
    visit_number                INTEGER NOT NULL,
    visit_date                  TEXT NOT NULL,

    systolic_bp                 INTEGER,
    diastolic_bp                INTEGER,
    hemoglobin_gdl              REAL,
    gestational_age_weeks       INTEGER,
    weight_gain_kg              REAL,
    fetal_heart_rate            INTEGER,
    urine_protein_dipstick      INTEGER CHECK(urine_protein_dipstick IN (0,1,2,3)),
    muac_cm                     REAL,

    ifa_tablets_given           INTEGER DEFAULT 0,
    calcium_tablets_given       INTEGER DEFAULT 0,
    tt_vaccine_given            INTEGER DEFAULT 0,

    birth_plan_discussed        INTEGER DEFAULT 0,
    institutional_delivery      INTEGER DEFAULT 0,
    transport_arranged          INTEGER DEFAULT 0,
    emergency_contact           TEXT,

    risk_label                  TEXT CHECK(risk_label IN ('LOW','MODERATE','HIGH',NULL)),
    confidence                  REAL,
    reason_1_hi                 TEXT,
    reason_2_hi                 TEXT,
    reason_3_hi                 TEXT,

    asha_acknowledged           INTEGER DEFAULT 0,
    asha_acknowledged_at        TEXT,
    asha_notes                  TEXT,

    created_at                  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at                  TEXT NOT NULL DEFAULT (datetime('now')),
    sync_status                 TEXT NOT NULL DEFAULT 'pending'
                                CHECK(sync_status IN ('pending','synced','conflict')),
    server_id                   TEXT
);

CREATE INDEX IF NOT EXISTS idx_visits_patient  ON anc_visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_date     ON anc_visits(visit_date);
CREATE INDEX IF NOT EXISTS idx_visits_highrisk ON anc_visits(risk_label)
                                               WHERE risk_label = 'HIGH';
CREATE INDEX IF NOT EXISTS idx_visits_sync     ON anc_visits(sync_status);

CREATE TABLE IF NOT EXISTS risk_events (
    id              TEXT PRIMARY KEY,
    visit_id        TEXT NOT NULL REFERENCES anc_visits(id),
    patient_id      TEXT NOT NULL REFERENCES patients(id),
    feature_name    TEXT NOT NULL,
    shap_value      REAL,
    raw_value       REAL,
    reason_hi       TEXT NOT NULL,
    acknowledged_at TEXT,
    escalated_at    TEXT,
    resolved_at     TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    sync_status     TEXT NOT NULL DEFAULT 'pending'
                    CHECK(sync_status IN ('pending','synced','conflict'))
);

CREATE INDEX IF NOT EXISTS idx_events_visit    ON risk_events(visit_id);
CREATE INDEX IF NOT EXISTS idx_events_patient  ON risk_events(patient_id);
CREATE INDEX IF NOT EXISTS idx_events_unack    ON risk_events(acknowledged_at)
                                               WHERE acknowledged_at IS NULL;

CREATE TABLE IF NOT EXISTS obstetric_history (
    id              TEXT PRIMARY KEY,
    patient_id      TEXT NOT NULL REFERENCES patients(id),
    pregnancy_year  INTEGER,
    outcome         TEXT CHECK(outcome IN
                    ('live_birth','stillbirth','abortion','ectopic','molar',NULL)),
    delivery_type   TEXT CHECK(delivery_type IN ('vaginal','cs','assisted',NULL)),
    birth_weight_g  INTEGER,
    complications   TEXT,
    neonatal_death  INTEGER DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_obstetric_patient ON obstetric_history(patient_id);

CREATE TABLE IF NOT EXISTS asha_workers (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    phone           TEXT UNIQUE NOT NULL,
    village         TEXT NOT NULL,
    subcentre       TEXT NOT NULL,
    phc_name        TEXT NOT NULL,
    supervisor_id   TEXT,
    is_active       INTEGER DEFAULT 1,
    last_sync_at    TEXT,
    app_version     TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sync_log (
    id                  TEXT PRIMARY KEY,
    sync_started_at     TEXT NOT NULL,
    sync_ended_at       TEXT,
    records_pushed      INTEGER DEFAULT 0,
    records_pulled      INTEGER DEFAULT 0,
    records_conflict    INTEGER DEFAULT 0,
    error_message       TEXT,
    asha_worker_id      TEXT,
    app_version         TEXT,
    network_type        TEXT
);
"""

TRIGGERS_SQL = """
CREATE TRIGGER IF NOT EXISTS trg_patients_updated
AFTER UPDATE ON patients
BEGIN
    UPDATE patients SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_visits_updated
AFTER UPDATE ON anc_visits
BEGIN
    UPDATE anc_visits SET updated_at = datetime('now') WHERE id = NEW.id;
END;
"""


def init_db(db_path: str) -> sqlite3.Connection:
    """Create (or open) the SQLite DB and apply schema + triggers."""
    os.makedirs(os.path.dirname(db_path) or '.', exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(SCHEMA_SQL)
    conn.executescript(TRIGGERS_SQL)
    conn.commit()
    return conn


def new_id() -> str:
    return str(uuid.uuid4())


def register_patient(conn: sqlite3.Connection, data: dict[str, Any]) -> str:
    pid = data.get("id") or new_id()
    cols = [
        "id", "mcp_card_number", "name_local", "name_transliterated",
        "age_at_registration", "lmp_date", "edd_date", "village",
        "subcentre", "phc_name", "asha_worker_id", "phone_number",
        "ration_card_number", "gravida", "parity", "previous_complications",
        "inter_pregnancy_interval_months", "server_id",
    ]
    values = [
        pid, data.get("mcp_card_number"), data.get("name_local"),
        data.get("name_transliterated"), data.get("age_at_registration"),
        data.get("lmp_date"), data.get("edd_date"), data.get("village"),
        data.get("subcentre"), data.get("phc_name"), data.get("asha_worker_id"),
        data.get("phone_number"), data.get("ration_card_number"),
        data.get("gravida"), data.get("parity"),
        data.get("previous_complications", 0),
        data.get("inter_pregnancy_interval_months", 0), data.get("server_id"),
    ]
    placeholders = ",".join(["?"] * len(cols))
    sql = f"INSERT INTO patients ({','.join(cols)}) VALUES ({placeholders})"
    conn.execute(sql, values)
    conn.commit()
    return pid


def record_visit(conn: sqlite3.Connection, patient_id: str, visit_data: dict[str, Any]) -> str:
    vid = visit_data.get("id") or new_id()
    cols = [
        "id", "patient_id", "visit_number", "visit_date", "systolic_bp",
        "diastolic_bp", "hemoglobin_gdl", "gestational_age_weeks",
        "weight_gain_kg", "fetal_heart_rate", "urine_protein_dipstick",
        "muac_cm", "server_id",
    ]
    values = [
        vid, patient_id, visit_data.get("visit_number", 1),
        visit_data.get("visit_date", datetime.utcnow().isoformat()),
        visit_data.get("systolic_bp"), visit_data.get("diastolic_bp"),
        visit_data.get("hemoglobin_gdl"), visit_data.get("gestational_age_weeks"),
        visit_data.get("weight_gain_kg"), visit_data.get("fetal_heart_rate"),
        visit_data.get("urine_protein_dipstick"), visit_data.get("muac_cm"),
        visit_data.get("server_id"),
    ]
    placeholders = ",".join(["?"] * len(cols))
    sql = f"INSERT INTO anc_visits ({','.join(cols)}) VALUES ({placeholders})"
    conn.execute(sql, values)
    conn.commit()
    return vid


def save_risk_result(conn: sqlite3.Connection, visit_id: str, patient_id: str, result: dict[str, Any]) -> None:
    reasons = result.get("reasons", [])
    r1, r2, r3 = (reasons + [None, None, None])[:3]

    conn.execute(
        """
        UPDATE anc_visits
        SET risk_label = ?, confidence = ?, reason_1_hi = ?, reason_2_hi = ?, reason_3_hi = ?, sync_status = 'pending'
        WHERE id = ?
        """,
        (result.get("risk_label"), result.get("confidence"), r1, r2, r3, visit_id),
    )

    for feat in result.get("shap_top_features", []):
        eid = new_id()
        conn.execute(
            """
            INSERT INTO risk_events (id, visit_id, patient_id, feature_name, shap_value, raw_value, reason_hi)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                eid, visit_id, patient_id, feat.get("feature"),
                feat.get("shap_value"), feat.get("raw_value"),
                get_reason_text_safe(feat.get("feature"), reasons),
            ),
        )
    conn.commit()


def get_reason_text_safe(feature_name: str | None, reasons: list[str]) -> str:
    if not reasons:
        return ""
    if feature_name is None:
        return reasons[0]
    for r in reasons:
        if feature_name and feature_name.replace('_', ' ') in r:
            return r
    return reasons[0]


def get_pending_sync(conn: sqlite3.Connection) -> dict[str, list[dict[str, Any]]]:
    out = {}
    cur = conn.execute("SELECT * FROM patients WHERE sync_status = 'pending'")
    out["patients"] = [dict(row) for row in cur.fetchall()]
    cur = conn.execute("SELECT * FROM anc_visits WHERE sync_status = 'pending'")
    out["visits"] = [dict(row) for row in cur.fetchall()]
    cur = conn.execute("SELECT * FROM risk_events WHERE sync_status = 'pending'")
    out["events"] = [dict(row) for row in cur.fetchall()]
    return out


def mark_synced(conn: sqlite3.Connection, table: str, ids: list[str]) -> None:
    if not ids:
        return
    placeholders = ",".join(["?"] * len(ids))
    sql = f"UPDATE {table} SET sync_status = 'synced' WHERE id IN ({placeholders})"
    conn.execute(sql, ids)
    conn.commit()


def get_high_risk_summary(conn: sqlite3.Connection, asha_worker_id: str) -> list[dict[str, Any]]:
    sql = """
    SELECT p.id as patient_id, p.name_local, p.village, p.phone_number, v.visit_date, v.confidence, v.reason_1_hi, v.reason_2_hi, v.reason_3_hi
    FROM patients p
    JOIN anc_visits v ON v.patient_id = p.id
    WHERE p.asha_worker_id = ? AND v.risk_label = 'HIGH'
    ORDER BY v.confidence DESC
    """
    cur = conn.execute(sql, (asha_worker_id,))
    return [dict(r) for r in cur.fetchall()]


def get_patient_timeline(conn: sqlite3.Connection, patient_id: str) -> dict[str, Any]:
    cur = conn.execute("SELECT * FROM patients WHERE id = ?", (patient_id,))
    patient = cur.fetchone()
    if patient is None:
        raise KeyError(f"Patient not found: {patient_id}")
    visits_cur = conn.execute("SELECT * FROM anc_visits WHERE patient_id = ? ORDER BY visit_date DESC", (patient_id,))
    visits = [dict(r) for r in visits_cur.fetchall()]
    events_cur = conn.execute("SELECT * FROM risk_events WHERE patient_id = ? ORDER BY created_at DESC", (patient_id,))
    events = [dict(r) for r in events_cur.fetchall()]
    return {"patient": dict(patient), "visits": visits, "risk_events": events}
