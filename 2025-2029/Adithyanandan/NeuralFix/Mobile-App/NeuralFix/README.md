# NeuralFix — AI Tech Support for Everyone

Help non-technical people fix any tech problem. One server, many phones, same WiFi.

## Categories
🌐 WiFi / Internet · 💻 Computers · 🖨️ Printers · 📱 Phones · 💿 Software · 📺 Displays · 🔑 Accounts · 🏠 Smart Devices

---

## Setup

### 1. Backend (server computer)
```bash
cd backend
cp .env.example .env
# Add your GROQ_API_KEY (free at console.groq.com)

pip install -r requirements.txt
python run.py
# Prints your local IP — write it down
```

### 2. Mobile (all phones, same WiFi)
Edit `mobile/src/utils/config.js`:
```js
export const API_BASE_URL = 'http://YOUR_SERVER_IP:8000';
```

Then install and run:
```bash
cd mobile
bash install.sh       # handles all version conflicts automatically
npx expo start        # scan QR with Expo Go
```

---

## RAG (teammate)
Drop PDF/TXT manuals into `backend/docs/` then:
```bash
curl -X POST http://localhost:8000/api/rag/reindex
```
Entry point: `backend/app/services/rag_service.py`

---

## API
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | Status |
| POST | /api/sessions | Create session |
| POST | /api/chat | Chat with AI |
| POST | /api/images/upload | Upload device photo |
| POST | /api/reports/generate | Generate IT report |
| POST | /api/rag/reindex | Rebuild knowledge base |

Swagger: `http://<server-ip>:8000/docs`
