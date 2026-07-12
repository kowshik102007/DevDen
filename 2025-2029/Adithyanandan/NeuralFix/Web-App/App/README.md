# NetFixAI — Full System

AI-powered network troubleshooting. One computer runs the server. Everyone's phone runs the app. Both must be on the same WiFi.

```
┌─────────────────────────────────────────────────────────┐
│                    LOCAL WiFi NETWORK                   │
│                                                         │
│   ┌──────────────────┐        ┌────────────────────┐   │
│   │  SERVER COMPUTER │◄──────►│  PHONES (mobile)   │   │
│   │  Python/FastAPI  │  HTTP  │  React Native/Expo  │   │
│   │  PostgreSQL      │        │  iOS or Android     │   │
│   │  LangChain RAG   │        └────────────────────┘   │
│   │  Claude Vision   │                                  │
│   │  Port 8000       │──► Anthropic API (Claude)        │
│   └──────────────────┘                                  │
└─────────────────────────────────────────────────────────┘
```

---

## STEP 1 — Server Computer Setup

### Create PostgreSQL database
```bash
psql -U postgres
CREATE USER netfix WITH PASSWORD 'netfix123';
CREATE DATABASE netfixai OWNER netfix;
\q
```

### Install & start backend
```bash
cd backend
cp .env.example .env
# Edit .env: add your ANTHROPIC_API_KEY

pip install -r requirements.txt
python run.py
```

The server will print your local IP — write it down:
```
   Local IP : 192.168.1.45   ← WRITE THIS DOWN
   API URL  : http://192.168.1.45:8000
```

---

## STEP 2 — Configure Mobile App

Edit `mobile/src/utils/config.js`:
```js
export const API_BASE_URL = 'http://192.168.1.45:8000'; // your server IP
```

---

## STEP 3 — Run Mobile App on Phones

Install **Expo Go** on each phone (App Store / Play Store), then:
```bash
cd mobile
npm install
npx expo start
```
Scan the QR code. All phones must be on the same WiFi as the server.

---

## STEP 4 — Add RAG Documents (Teammate)

Drop PDF/TXT networking manuals into `backend/docs/`, then:
```bash
# Trigger reindex without restarting:
curl -X POST http://localhost:8000/api/rag/reindex

# Or upload a single doc:
curl -X POST http://localhost:8000/api/rag/upload-doc -F "file=@manual.pdf"

# Check status:
curl http://localhost:8000/api/rag/status
```

---

## Project Structure

```
NetFixAI/
├── backend/
│   ├── app/
│   │   ├── main.py               # FastAPI app
│   │   ├── api/                  # Route handlers
│   │   │   ├── sessions.py
│   │   │   ├── chat.py           # Chat + RAG
│   │   │   ├── images.py         # Upload + vision analysis
│   │   │   ├── reports.py        # Diagnostic reports
│   │   │   └── rag.py            # RAG management
│   │   ├── services/
│   │   │   ├── claude_service.py # Claude AI + prompts
│   │   │   ├── rag_service.py    # ← TEAMMATE ENTRY POINT
│   │   │   └── vision_service.py # Equipment image analysis
│   │   ├── db/database.py        # PostgreSQL models
│   │   └── core/config.py        # .env settings
│   ├── docs/                     # Drop manuals/PDFs here
│   ├── run.py                    # Start server
│   └── requirements.txt
│
└── mobile/
    ├── App.js
    └── src/
        ├── screens/
        │   ├── ChatScreen.js
        │   ├── DiagnosticReportScreen.js
        │   └── HistoryScreen.js
        ├── components/
        │   ├── MessageBubble.js
        │   ├── StatusBadge.js
        │   └── ServerBanner.js   # Shows if server offline
        ├── services/api.js       # All HTTP calls to backend
        └── utils/
            ├── config.js         # ← SET SERVER IP HERE
            ├── theme.js
            └── SessionContext.js
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | Health + RAG status |
| POST | /api/sessions | Create session |
| GET | /api/sessions | List sessions |
| POST | /api/chat | Chat with AI (RAG-powered) |
| POST | /api/images/upload | Upload equipment photo |
| POST | /api/reports/generate | Generate diagnostic report |
| GET | /api/rag/status | RAG pipeline status |
| POST | /api/rag/reindex | Rebuild vector store |
| POST | /api/rag/upload-doc | Add document to RAG |

Full Swagger docs: `http://<server-ip>:8000/docs`

---

## Troubleshooting

**Mobile can't reach server:** Confirm same WiFi, check IP in config.js, test `http://<ip>:8000/health` in phone browser.

**Database error:** Check PostgreSQL is running, credentials in .env match.

**RAG not working:** Add files to `backend/docs/` and POST to `/api/rag/reindex`. Check `/api/rag/status`.
