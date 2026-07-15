from typing import TypedDict, List

class CareFlowState(TypedDict):
    patient_id: str
    symptoms: List[str]
    reports: List[str]
    doctor_notes: str
    prescriptions: List[str]
    risk_flags: List[str]
    current_agent: str
