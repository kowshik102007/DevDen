# JananiAI (जननी AI)

**"Har maa surakshit ho" — Every mother is safe**

An AI-powered maternal and neonatal risk flagging system for ASHA (Accredited Social Health Activist) workers in rural India. Offline-first Android application with embedded TensorFlow Lite ML model that flags high-risk pregnancies during routine home visits.

## Project Structure

```
JananiAI/
├── ml/                         # ML Pipeline (Unified Backend)
│   ├── data/
│   │   ├── generate_dataset.py    # NumPy+PHC synthetic data generator
│   │   ├── phc_anc_visits.csv     # Generated dataset (5000 rows)
│   │   └── synthetic_patients.json
│   ├── train.py                   # Keras MLP (BatchNorm + class weights)
│   ├── explain.py                 # SHAP-based explainer + Hindi reasons
│   ├── export_tflite.py           # TFLite float16 exporter
│   ├── schema.py                  # SQLite schema definitions
│   ├── requirements.txt
│   ├── model_output/
│   │   ├── janani_model.keras     # Trained Keras model
│   │   ├── janani_risk_model.tflite # Android-ready model (< 11 KB)
│   │   ├── scaler.pkl             # StandardScaler
│   │   ├── model_meta.json        # Android sync config
│   │   └── shap_background.npy    # Baseline for SHAP explanations
│   └── tests/
│       └── test_risk_engine.py    # Unit tests
│
├── api/                        # FastAPI Backend
│   ├── main.py                 # Server API + Device Sync
│   └── routes/
│
├── dashboard/                  # React + Vite Dashboard
│   ├── src/
│   │   └── components/         # Real-time ASHA monitoring UI
│   └── package.json
│
├── android/                    # Android App (Native Java)
│   └── ...                     # Core edge app with TFLite integration
│
└── ASHAShield/                 # Mobile App Prototype
    └── ...                     # React Native / Expo mobile app prototype
```

## Quick Start

### ML Pipeline

```bash
cd ml
pip install -r requirements.txt
python data/generate_dataset.py --n 5000 --seed 42  # Generate PHC data
python train.py --epochs 100                        # Train Keras model
python export_tflite.py                             # Export to TFLite
python tests/test_risk_engine.py                    # Run unit tests
```

### Dashboard & API

**For presenting at the hackathon, the easiest way to run the full stack locally is using the provided batch script:**
Double click `start_demo.bat` in the root folder. This will automatically launch both the API and the React Dashboard in two separate terminal windows.

Alternatively, to run them manually for development:

**Terminal 1 (Backend API):**
```bash
cd api
python main.py
```
*(Runs on http://localhost:8000)*

**Terminal 2 (React Dashboard):**
```bash
cd dashboard
npm install
npm run dev
```
*(Runs on http://localhost:3000 or 3001)*

## 🚀 Production Deployment (How to run it as a product)

If you are deploying JananiAI as a real-world product for a healthcare NGO or government body, the architecture is designed to be fully decoupled:

1. **The Edge App (Android/ASHAShield):** Build the release APK (`./gradlew assembleRelease`). The TFLite model is embedded directly in the APK. Distribute this via MDM (Mobile Device Management) or the Google Play Store to ASHA workers' offline devices.
2. **The Cloud Server (FastAPI):** Deploy the `api/` directory to a cloud provider like AWS EC2, Google Cloud Run, or Render. Use `gunicorn` with `uvicorn` workers for production traffic. Update the `SYNC_URL` in the mobile app to point to your public domain.
3. **The Web Dashboard (React):** Build the static site (`npm run build`) and host it on Vercel, Netlify, or an AWS S3 Bucket. Configure it to fetch data from your cloud FastAPI server.

---

## 🎤 Hackathon Demo Guide (How to present it)

When presenting JananiAI to the judges, follow this flow to highlight both the social impact and the deep tech architecture:

1. **The Hook (The Problem):** Explain that rural ASHA workers have no predictive triage tools and collect ANC data on paper, leading to missed high-risk pregnancies.
2. **The Edge Solution (Android App / ASHAShield):** Show the mobile app running completely offline. Enter high-risk vitals (e.g., BP 160/105). Emphasize that the embedded Keras TFLite model is only **10.5 KB** so it runs instantly on cheap smartphones without internet.
3. **The Explainability (TTS):** Show the Risk Card. Point out that it's not a black box—the model uses SHAP to generate localized Hindi explanations (e.g., *"BP bahut zyada hai"*). Let the app read it aloud via TTS.
4. **The Central Command (React Dashboard):** Open `localhost:3000` (or 3001). Explain that when the ASHA worker gets internet, the app syncs to the FastAPI backend. Show the supervisor view, the district heatmap, and the live alerts for the high-risk patient you just entered.
5. **The Deep Tech:** Open `localhost:8000/docs` to prove you built a real REST API. Mention the ML architecture: A Keras MLP with `BatchNormalization`, Early Stopping, and class-weight balancing that achieved **89.3% accuracy and 92.5% HIGH risk recall**.

## Key Features

### ML Model
- **Clinical Alignment:** 13 clinical features mapped to standard PHC triage logic.
- **Robust Architecture:** Keras MLP with `BatchNormalization`, `EarlyStopping`, and `compute_class_weight` to ensure >90% recall for HIGH risk cases.
- **Explainability:** Real `shap.DeepExplainer` mapping mathematical feature importance into rural-context Hindi reason templates with value interpolation.
- **Edge Deployment:** Float16 TFLite quantization yielding a <11 KB model payload suitable for offline Android devices without internet connectivity.

### Backend & Sync
- **Data Contract:** 13-feature input vector defined in `Agent.md` ensuring strict compatibility between the edge devices, the web server, and the training pipeline.
- **Robust Schema:** Relational SQLite schema with `WAL` mode handling patients, ANC visits, ASHA workers, risk events (SHAP audit trail), and an offline-first push/pull synchronization protocol.

## License

MIT License - Hackathon Project