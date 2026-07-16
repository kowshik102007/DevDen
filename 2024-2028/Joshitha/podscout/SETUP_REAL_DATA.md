# PodScout Pro - Real Data Connection Setup

## Required API Keys & Credentials

To connect real-time data sources, you need the following credentials:

---

## 1. Supabase (Database) - **REQUIRED**

**What it's for**: Store all pollution data, monitoring sites, grid cells

**Get it from**: https://supabase.com
1. Create a new project (free tier available)
2. Go to Project Settings → API
3. Copy:
   - Project URL
   - `anon` key (public)
   - `service_role` key (secret, for admin operations)

**Add to `.env`**:
```env
SUPABASE_URL=https://xxxxxxxxxx.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....  # anon key
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....  # service_role key
```

**Setup Database**:
```sql
-- In Supabase SQL Editor, run:
-- 1. database/schema.sql (main tables)
-- 2. database/grid_cells_schema.sql (grid tables)
```

---

## 2. LLM APIs - **REQUIRED for AI Analysis**

### Groq (Fast LLM)

**What it's for**: Real-time pollution site analysis

**Get it from**: https://console.groq.com
1. Sign up (free tier: 14,400 requests/day)
2. Go to API Keys
3. Create new key

**Add to `.env`**:
```env
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Google Gemini (Strategic LLM)

**What it's for**: Deployment strategy planning

**Get it from**: https://aistudio.google.com/app/apikey
1. Sign in with Google
2. Create API key (free tier: 60 requests/minute)

**Add to `.env`**:
```env
GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 3. Google Earth Engine - **OPTIONAL** (Satellite Data)

**What it's for**: Sentinel-5P (NO₂, SO₂), Landsat (LST)

**Get it from**: https://earthengine.google.com
1. Sign up for Earth Engine
2. Create a service account:
   - Go to Google Cloud Console
   - Enable Earth Engine API
   - Create service account
   - Download JSON key file
3. Register service account with Earth Engine

**Add to `.env`**:
```env
GEE_SERVICE_ACCOUNT=your-service-account@your-project.iam.gserviceaccount.com
GEE_PRIVATE_KEY_PATH=C:/path/to/service-account-key.json
```

**Install Python package**:
```bash
pip install earthengine-api google-api-python-client
```

---

## 4. CPCB API - **OPTIONAL** (India Ground Sensors)

**What it's for**: Real-time air quality from Indian monitoring stations

**Get it from**: Contact CPCB or use proxy
- Official: https://cpcb.nic.in/
- Alternative: Some data available via OpenAQ

**Add to `.env`**:
```env
CPCB_API_KEY=your_cpcb_api_key_here  # If available
```

**Note**: CPCB data might need special access. The code has fallback mechanisms.

---

## 5. OpenAQ API - **FREE** (Global Air Quality)

**What it's for**: Global air quality data including India

**Get it from**: https://openaq.org/
- **V2 API**: Open, no key needed (rate limited)
- **V3 API**: Optional API key for higher limits

**Add to `.env`**:
```env
OPENAQ_API_KEY=your_openaq_api_key  # Optional
```

**Note**: Works without key, but key gives higher rate limits.

---

## Minimal Setup (Start Here)

For initial testing, you **only need**:

```env
# .env file

# Application
APP_NAME=PodScout Pro
APP_VERSION=0.1.0
DEBUG=True

# Database (REQUIRED)
SUPABASE_URL=your-supabase-url
SUPABASE_KEY=your-supabase-anon-key
SUPABASE_SERVICE_KEY=your-supabase-service-key

# LLMs (REQUIRED for AI features)
GROQ_API_KEY=your-groq-api-key
GEMINI_API_KEY=your-gemini-api-key

# Redis (if using cache)
REDIS_URL=redis://localhost:6379/0
```

**Optional** (add later for full features):
- `GEE_SERVICE_ACCOUNT` + `GEE_PRIVATE_KEY_PATH` (satellite data)
- `CPCB_API_KEY` (India specific sensors)
- `OPENAQ_API_KEY` (higher rate limits)

---

## Setup Steps

### 1. Copy `.env.example` to `.env`
```bash
cp .env.example .env
```

### 2. Edit `.env` with your keys
```bash
# Open in your editor
code .env  # or notepad .env
```

### 3. Setup Supabase Database
1. Go to Supabase SQL Editor
2. Run `database/schema.sql`
3. Run `database/grid_cells_schema.sql`

### 4. Generate Initial Grid (First Time)
```bash
# Start backend
python -m backend.app.main

# In another terminal:
curl -X POST http://localhost:8000/api/v1/spatial/grid/generate/major-cities
```

### 5. Trigger First Ingestion
```bash
curl -X POST http://localhost:8000/api/v1/pipeline/trigger
```

### 6. Check Pipeline Status
```bash
curl http://localhost:8000/api/v1/pipeline/status
```

---

## Verification

After setup, verify each service:

### Database
```bash
curl http://localhost:8000/api/v1/spatial/grid/stats
```
Should show grid cells count.

### LLM (Groq/Gemini)
```bash
curl -X POST http://localhost:8000/api/v1/mcp/tools/analyze_pollution_site \
  -H "Content-Type: application/json" \
  -d '{"arguments": {"site_id": "test", "pm25": 150, "lat": 28.69, "lon": 77.19}}'
```
Should return AI analysis.

### Data Ingestion
```bash
curl http://localhost:8000/api/v1/pipeline/health
```
Should show "healthy" status with no issues.

---

## What Works Without Keys

| Feature | Without Keys | With Keys |
|---------|-------------|-----------|
| **Backend Start** | ✅ Yes | ✅ Yes |
| **MCP Servers** | ✅ Yes | ✅ Yes |
| **API Endpoints** | ✅ Yes | ✅ Yes |
| **Database Storage** | ❌ No (needs Supabase) | ✅ Yes |
| **AI Analysis** | ❌ No (needs Groq/Gemini) | ✅ Yes |
| **Satellite Data** | ❌ No (needs GEE) | ✅ Yes |
| **Ground Sensors** | ⚠️ Mock data | ✅ Real data |

---

## Need Help Getting Keys?

Reply with:
- "I have Supabase" - I'll help set up database
- "I have Groq key" - I'll help test AI
- "I need help with X" - I'll provide detailed steps

Ready to provide your API keys?
