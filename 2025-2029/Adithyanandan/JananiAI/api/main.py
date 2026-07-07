import sys
import os
from pathlib import Path
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from datetime import datetime
import json

# Add parent directory to path so we can import from ml
sys.path.insert(0, str(Path(__file__).parent.parent))

from ml.schema import (
    init_db, register_patient, record_visit, save_risk_result,
    get_high_risk_summary, get_patient_timeline, get_pending_sync, mark_synced
)
from ml.explain import get_risk_explanation

app = FastAPI(title="JananiAI API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE = "janani.db"

# Initialize DB on startup
def get_db():
    conn = init_db(DATABASE)
    try:
        yield conn
    finally:
        conn.close()


# --- Pydantic Models ---

class PatientCreate(BaseModel):
    name_local: str
    age_at_registration: int
    village: str
    subcentre: str
    phc_name: str
    asha_worker_id: str
    phone_number: Optional[str] = None
    gravida: Optional[int] = 1
    parity: Optional[int] = 0
    previous_complications: Optional[int] = 0
    inter_pregnancy_interval_months: Optional[int] = 0


class VisitCreate(BaseModel):
    patient_id: str
    visit_number: int = 1
    systolic_bp: int
    diastolic_bp: int
    hemoglobin_gdl: float
    gestational_age_weeks: int
    weight_gain_kg: float
    fetal_heart_rate: int
    urine_protein_dipstick: int
    muac_cm: float


class SyncPushRequest(BaseModel):
    patients: List[Dict[str, Any]] = []
    visits: List[Dict[str, Any]] = []
    events: List[Dict[str, Any]] = []
    asha_worker_id: str


class SyncPullRequest(BaseModel):
    asha_worker_id: str
    last_sync_timestamp: Optional[str] = None


# --- Routes ---

@app.get("/")
def root():
    return {"message": "JananiAI API", "status": "running"}


@app.get("/health")
def health():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


@app.post("/patients")
def create_patient(patient: PatientCreate, db=Depends(get_db)):
    pid = register_patient(db, patient.model_dump())
    return {"id": pid, "message": "Patient created"}


@app.get("/patients/{patient_id}")
def get_patient(patient_id: str, db=Depends(get_db)):
    try:
        timeline = get_patient_timeline(db, patient_id)
        return timeline
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/visits")
def create_visit(visit: VisitCreate, db=Depends(get_db)):
    vid = record_visit(db, visit.patient_id, visit.model_dump())
    return {"id": vid, "message": "Visit recorded"}


@app.post("/predict")
def predict_visit(visit_data: dict, db=Depends(get_db)):
    """Server-side inference endpoint."""
    try:
        # Run ML explanation pipeline
        risk_label, reasons, confidence = get_risk_explanation(visit_data)
        
        result = {
            "risk_label": risk_label,
            "confidence": confidence,
            "reasons": reasons,
            "shap_top_features": [] # SHAP values handled internally by get_risk_explanation now
        }
        
        # If visit_id is provided, save it to DB
        if "visit_id" in visit_data and "patient_id" in visit_data:
            save_risk_result(db, visit_data["visit_id"], visit_data["patient_id"], result)
            
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- Sync Endpoints (From MachineLearning backend) ---

@app.post("/sync/push")
def sync_push(payload: SyncPushRequest, db=Depends(get_db)):
    """Receive data from ASHA worker's offline device."""
    inserted = {"patients": 0, "visits": 0, "events": 0}

    for p in payload.patients:
        try:
            register_patient(db, p)
            inserted["patients"] += 1
        except Exception as e:
            print(f"Error syncing patient: {e}")

    for v in payload.visits:
        try:
            record_visit(db, v.get("patient_id"), v)
            if "risk_label" in v:
                save_risk_result(db, v.get("id"), v.get("patient_id"), v)
            inserted["visits"] += 1
        except Exception as e:
            print(f"Error syncing visit: {e}")

    return {"status": "success", "inserted": inserted}


@app.post("/sync/pull")
def sync_pull(payload: SyncPullRequest, db=Depends(get_db)):
    """Send pending server updates to ASHA worker's device."""
    data = get_pending_sync(db)
    # Note: A real app would filter by asha_worker_id and update sync_status here
    return {"status": "success", "data": data}


# --- Dashboard Endpoints ---

@app.get("/dashboard/summary")
def dashboard_summary(db=Depends(get_db)):
    total = db.execute("SELECT COUNT(*) as c FROM patients").fetchone()["c"]
    high_risk = db.execute("""
        SELECT COUNT(DISTINCT patient_id) as c FROM anc_visits WHERE risk_label = 'HIGH'
    """).fetchone()["c"]
    moderate_risk = db.execute("""
        SELECT COUNT(DISTINCT patient_id) as c FROM anc_visits WHERE risk_label = 'MODERATE'
    """).fetchone()["c"]
    low_risk = db.execute("""
        SELECT COUNT(DISTINCT patient_id) as c FROM anc_visits WHERE risk_label = 'LOW'
    """).fetchone()["c"]
    total_visits = db.execute("SELECT COUNT(*) as c FROM anc_visits").fetchone()["c"]

    return {
        "total_patients": total,
        "high_risk": high_risk,
        "moderate_risk": moderate_risk,
        "low_risk": low_risk,
        "total_visits": total_visits
    }


@app.get("/dashboard/highrisk")
def get_high_risk_patients(db=Depends(get_db)):
    patients = db.execute("""
        SELECT DISTINCT p.id, p.name_local as name, p.village, p.asha_worker_id as asha_id,
               v.visit_date, v.gestational_age_weeks, v.risk_label, v.confidence
        FROM patients p
        INNER JOIN anc_visits v ON p.id = v.patient_id
        WHERE v.risk_label = 'HIGH'
        ORDER BY v.visit_date DESC
    """).fetchall()

    return [dict(p) for p in patients]


@app.get("/supervisor/stats")
def supervisor_stats(district: Optional[str] = None, db=Depends(get_db)):
    # Simple fallback without district filter since our new schema uses phc_name instead
    total = db.execute("SELECT COUNT(*) as c FROM patients").fetchone()["c"]
    high_risk = db.execute("""
        SELECT COUNT(DISTINCT patient_id) as c FROM anc_visits WHERE risk_label = 'HIGH'
    """).fetchone()["c"]
    moderate_risk = db.execute("""
        SELECT COUNT(DISTINCT patient_id) as c FROM anc_visits WHERE risk_label = 'MODERATE'
    """).fetchone()["c"]
    total_visits = db.execute("SELECT COUNT(*) as c FROM anc_visits").fetchone()["c"]

    return {
        "district": "All",
        "total_patients": total,
        "high_risk": high_risk,
        "moderate_risk": moderate_risk,
        "total_visits": total_visits,
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)