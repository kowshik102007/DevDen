# Careflow AI

Project scaffold for Careflow AI.

Structure:

```
careflow-ai/
│
├── backend/
│   ├── main.py
│   ├── config.py
│   │
│   ├── agents/
│   │   ├── patient_agent.py
│   │   ├── doctor_agent.py
│   │   ├── medicine_agent.py
│   │   └── emergency_agent.py
│   │
│   ├── graph/
│   │   ├── state.py
│   │   └── workflow.py
│   │
│   ├── services/
│   │   ├── llm.py
│   │   ├── memory.py
│   │   └── alerts.py
│   │
│   ├── models/
│   │   └── schemas.py
│   │
│   └── database/
│       ├── mongo.py
│       └── faiss_store.py
│
├── frontend/
│   └── app.py
│
├── requirements.txt
└── README.md
```
