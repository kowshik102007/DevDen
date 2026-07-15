from fastapi import FastAPI
from graph.workflow import careflow_graph

app = FastAPI()

@app.post("/process")
def process_patient(data: dict):
    state = {
        "patient_id": data["patient_id"],
        "symptoms": [data["input"]],
        "reports": [],
        "doctor_notes": "",
        "prescriptions": [],
        "risk_flags": [],
        "current_agent": "patient"
    }

    result = careflow_graph.invoke(state)
    return result
