# NeuralFix — AI Tech Support for Everyone

> AI-powered troubleshooting assistant for non-technical staff. Diagnose any tech problem through a chat interface, upload device photos, and generate structured IT reports — all running on your local WiFi network.

---

## What It Does

NeuralFix helps non-technical people fix technology problems without needing IT staff on-site. Users describe their issue in plain language, and the AI guides them through step-by-step fixes. If the problem can't be resolved, it generates a structured diagnostic report to share with IT support.

### Supported Categories

| Category | Examples |
|----------|----------|
| 🌐 WiFi / Internet | No connection, slow speeds, router issues |
| 💻 Computer / Laptop | Frozen, won't start, blue screen, slow |
| 🖨️ Printer / Scanner | Not detected, paper jam, blank pages |
| 📱 Phone / Tablet | Won't charge, app crashing, storage full |
| 💿 Software / Apps | Won't open, error messages, update failing |
| 📺 TV / Projector | No signal, HDMI not working, wrong resolution |
| 🔑 Password / Account | Locked out, forgot password, MFA issues |
| 🏠 Smart Devices | Alexa/Google not responding, device offline |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    LOCAL WiFi NETWORK                   │
│                                                         │
│   ┌──────────────────┐        ┌────────────────────┐   │
│   │  SERVER COMPUTER │◄──────►│  PHONES (Expo Go)  │   │
│   │                  │  HTTP  │                     │   │
│   │  Python/FastAPI  │        │  React Native       │   │
│   │  SQLite DB       │        │  iOS or Android     │   │
│   │  LangChain RAG   │        └────────────────────┘   │
│   │  FAISS Vector DB │                                  │
│   │  Port 8000       │──► Groq API (llama-3.1-8b)      │
│   └──────────────────┘                                  │
└─────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
NeuralFix/
├── backend/                          ← Runs on server computer
│   ├── app/
│   │   ├── main.py                   # FastAPI app entry point
│   │   ├── api/
│   │   │   └── routers.py            # All API endpoints
│   │   ├── services/
│   │   │   ├── groq_service.py       # Groq AI + prompts
│   │   │   ├── rag_service.py        # LangChain RAG pipeline ← teammate entry point
│   │   │   └── vision_service.py     # Device image analysis
│   │   ├── db/
│   │   │   └── database.py           # SQLite models
│   │   ├── models/
│   │   │   └── schemas.py            # Pydantic schemas
│   │   └── core/
│   │       └── config.py             # Settings from .env
│   ├── docs/                         # ← Drop PDF/TXT manuals here
│   ├── vector_store/                 # FAISS index (auto-generated)
│   ├── uploads/                      # Uploaded device images
│   ├── .env                          # Your config (not committed)
│   ├── .env.example                  # Config template
│   ├── requirements.txt
│   └── run.py                        # Start server (shows local IP)
│
└── mobile/                           ← Runs on phones via Expo Go
    ├── App.js
    ├── app.json
    ├── install.sh                    # One-shot dependency installer
    └── src/
        ├── screens/
        │   ├── ChatScreen.js         # Main troubleshooting chat + category picker
        │   ├── DiagnosticReportScreen.js  # AI-generated IT report
        │   └── HistoryScreen.js      # Past sessions
        ├── components/
        │   ├── MessageBubble.js      # Chat message rendering
        │   ├── StatusBadge.js        # Session status indicator
        │   └── ServerBanner.js       # Offline/connecting banner
        ├── services/
        │   └── api.js                # All HTTP calls to backend
        └── utils/
            ├── config.js             # ← SET YOUR SERVER IP HERE
            ├── theme.js              # Colors, fonts, spacing
            └── SessionContext.js     # Global session state
```

---

## Setup Guide

### Prerequisites

- **Server computer**: Python 3.10+, pip
- **Phones**: Expo Go app (free — Play Store / App Store)
- **Network**: Server and phones on the same WiFi
- **API Key**: Free Groq API key from [console.groq.com](https://console.groq.com)

---

### Step 1 — Backend Setup (Server Computer)

```bash
cd NeuralFix/backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate       # Linux/Mac
# .venv\Scripts\activate        # Windows

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
```

Edit `.env`:
```env
GROQ_API_KEY=gsk_your_key_here      # Get from console.groq.com
DATABASE_URL=sqlite:///./neuralfix.db
PORT=8000
DOCS_PATH=./docs
VECTOR_STORE_PATH=./vector_store
```

```bash
# Start the server
python run.py
```

The server will print your local IP:
```
╔══════════════════════════════════════════════════╗
║         NeuralFix — AI Tech Support              ║
╠══════════════════════════════════════════════════╣
║  Local IP  : 192.168.1.45                       ║
║  API URL   : http://192.168.1.45:8000           ║
╚══════════════════════════════════════════════════╝
```

Write down the IP — you'll need it for the mobile app.

---

### Step 2 — Mobile App Setup

**Set the server IP** in `mobile/src/utils/config.js`:
```js
export const API_BASE_URL = 'http://192.168.1.45:8000'; // ← your server IP
```

**Install dependencies:**
```bash
cd NeuralFix/mobile
bash install.sh        # handles all Expo version conflicts automatically
```

**Start the app:**
```bash
npx expo start
```

Scan the QR code with Expo Go on your phone. Make sure your phone is on the same WiFi as the server.

---

### Step 3 — Add RAG Knowledge Base (Optional but Recommended)

Drop PDF or TXT documents into `backend/docs/`, then trigger indexing:

```bash
# Reindex all documents
curl -X POST http://localhost:8000/api/rag/reindex

# Check RAG status
curl http://localhost:8000/api/rag/status

# Upload a single document without restarting
curl -X POST http://localhost:8000/api/rag/upload-doc \
  -F "file=@/path/to/manual.pdf"
```

The RAG knowledge base enhances AI responses with content from your documents. Without documents, the AI still works using Groq's general knowledge.

---

## API Reference

### Base URL
```
http://<server-ip>:8000
```

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server health, model info, RAG status |
| POST | `/api/sessions/` | Create a new troubleshooting session |
| GET | `/api/sessions/` | List all sessions |
| GET | `/api/sessions/{id}/` | Get session with full message history |
| DELETE | `/api/sessions/{id}/` | Delete a session |
| PATCH | `/api/sessions/{id}/status/` | Update status (active/resolved/escalated) |
| POST | `/api/chat/` | Send a message, get AI response |
| POST | `/api/images/upload/` | Upload device photo for analysis |
| GET | `/api/images/file/{filename}` | Retrieve uploaded image |
| POST | `/api/reports/generate/` | Generate structured IT diagnostic report |
| GET | `/api/reports/{id}/` | Get existing report for a session |
| GET | `/api/rag/status` | RAG pipeline status |
| POST | `/api/rag/reindex` | Rebuild vector store from docs folder |
| POST | `/api/rag/upload-doc` | Add a single document to RAG |

**Interactive Swagger UI:** `http://<server-ip>:8000/docs`

### Example: Create Session & Chat

```bash
# Create session
SESSION=$(curl -s -X POST http://localhost:8000/api/sessions/ \
  -H "Content-Type: application/json" \
  -d '{"title": "WiFi Issue", "category": "networking"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

# Send message
curl -X POST http://localhost:8000/api/chat/ \
  -H "Content-Type: application/json" \
  -d "{\"session_id\": \"$SESSION\", \"message\": \"My router lights are red\"}"
```

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Backend framework | FastAPI (Python) |
| AI model | Groq — llama-3.1-8b-instant |
| RAG pipeline | LangChain + FAISS |
| Embeddings | HuggingFace all-MiniLM-L6-v2 |
| Database | SQLite (auto-created, zero setup) |
| Mobile framework | React Native (Expo) |
| Mobile navigation | React Navigation v7 |

---

## Troubleshooting Setup Issues

**Mobile can't reach server**
- Confirm phone and server are on the same WiFi network
- Check IP in `mobile/src/utils/config.js` matches `run.py` output
- Test in phone browser: `http://<server-ip>:8000/health` should return JSON
- Check no firewall is blocking port 8000

**Double slash in API URLs (404 errors)**
- Ensure `API_BASE_URL` has no trailing slash: `http://ip:8000` not `http://ip:8000/`
- All endpoint paths in `api.js` should have their own leading slash

**307 Redirect errors**
- Add trailing slash to POST endpoints: `/api/sessions/` not `/api/sessions`

**Groq API error / 500 on chat**
- Check `GROQ_API_KEY` is set correctly in `backend/.env`
- Verify key is valid at [console.groq.com](https://console.groq.com)
- Restart backend after changing `.env`

**RAG not loading**
- Add PDF/TXT files to `backend/docs/`
- Run `curl -X POST http://localhost:8000/api/rag/reindex`
- Check `curl http://localhost:8000/api/rag/status` shows `"vector_store_loaded": true`

**Expo version conflicts**
- Always use `bash install.sh` instead of manually editing `package.json`
- If issues persist: `rm -rf node_modules package-lock.json && bash install.sh`

---

## Session Lifecycle

```
Created → active
              ↓
        Troubleshooting
              ↓
    ┌─────────────────┐
    │                 │
 resolved        escalated
(fixed by user)  (report generated,
                  sent to IT support)
```

Sessions stay in history and can be reopened. Diagnostic reports are stored with the session and can be reshared at any time.

---

## For Developers

### Adding a New Troubleshooting Category

1. Add entry to `CATEGORIES` array in `mobile/src/screens/ChatScreen.js`
2. Add quick prompts to `QUICK_PROMPTS` object
3. Add icon entry to `CAT_ICONS` in `mobile/src/screens/HistoryScreen.js`
4. Update system prompt in `backend/app/services/groq_service.py` if needed

### Swapping the AI Model

In `backend/app/services/groq_service.py`:
```python
MODEL = "llama-3.1-8b-instant"   # change this
# Options: llama-3.3-70b-versatile, mixtral-8x7b-32768, gemma2-9b-it
```

### RAG Teammate Entry Point

The RAG pipeline is in `backend/app/services/rag_service.py`. The key functions:
- `build_vector_store_from_docs()` — loading and chunking logic
- `retrieve_context()` — retrieval logic
- Drop-in replacement: keep the same function signatures and the rest of the app works unchanged.

---



