# 🚀 Quick Start - PodScout Pro

## Your Credentials ✅
All configured in `.env` file

## Deploy in 3 Steps

### Step 1: Setup Database (5 min)

**Go to Supabase SQL Editor:**
https://supabase.com/dashboard/project/vxoxitherkbtlsbbbxlj/editor

**Run these SQL files:**
1. `database/schema.sql` - Main tables
2. `database/grid_cells_schema.sql` - Spatial grid

**Quick commands:**
```sql
-- Click "New Query" in Supabase
-- Copy/paste each file and click "Run"
```

---

### Step 2: Start Backend (1 min)

```bash
# Stop any running backends (Ctrl+C)
uv run python -m backend.app.main
```

**Should see:**
```
✓ Connected to MCP server: analysis
✓ Connected to MCP server: ml_predictions  
✓ Connected to MCP server: supabase_mcp
✓ Real-time pipeline started
```

---

### Step 3: Verify System (1 min)

```bash
python verify_system.py
```

**Tests:**
- ✅ Backend health
- ✅ 3 MCP servers
- ✅ Database connection
- ✅ Real-time pipeline
- ✅ AI analysis (Groq/Gemini)
- ✅ ML predictions

---

## Optional: Generate Grids

```bash
curl -X POST http://localhost:8000/api/v1/spatial/grid/generate/major-cities
```

Takes 5-10 min, creates ~1,500 grid cells for Delhi, Mumbai, Bangalore, Chennai, Kolkata.

---

## System Running!

- **API**: http://localhost:8000
- **Docs**: http://localhost:8000/docs
- **Pipeline**: Auto-runs every hour
- **MCP Servers**: Analysis, ML, Supabase

---

## Quick Tests

```bash
# System status
curl http://localhost:8000/

# List AI tools
curl http://localhost:8000/api/v1/mcp/tools

# Pipeline status
curl http://localhost:8000/api/v1/pipeline/status

# Grid stats
curl http://localhost:8000/api/v1/spatial/grid/stats
```

---

## What's Next?

1. Let pipeline run (hourly data ingestion auto-starts)
2. Generate grids for cities
3. Build frontend
4. Train ML model (optional: install PyTorch)

**See `deployment_guide.md` for full details!**
