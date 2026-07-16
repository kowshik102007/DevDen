"""
Orchestrator Agent (MCP Server)

Central coordinator for the PodScout Agent Swarm.
Implements the complete pipeline:
  Query -> Scout -> Ingest -> Features -> Train -> Predict -> Recommend
"""

from mcp.server.fastmcp import FastMCP
import asyncio
import json
import logging
import re
from typing import Dict, Any, List
from datetime import datetime

# Import all agents
try:
    from backend.app.agents.scout import find_location
    from backend.app.agents.ingestion import setup_new_city, ingest_satellite_data, ingest_ground_data
    from backend.app.agents.feature_agg import aggregate_temporal_features, aggregate_static_features, aggregate_weather_data
    from backend.app.agents.training import check_and_train_model
    from backend.app.agents.prediction import predict_pollution
    from backend.app.agents.recommendation import detect_hotspots, get_recommendations, generate_alert
except ImportError as e:
    logging.error(f"Orchestrator import failed: {e}")

mcp = FastMCP("PodScout Orchestrator")
logger = logging.getLogger(__name__)

# Intent patterns
INTENT_PATTERNS = {
    "analyze": r"(?:predict|analyze|analyse|forecast|show|check)\s+(?:for|in|at)?\s*(.+)",
    "hotspots": r"(?:hotspot|hotspots|find|detect)\s+(?:for|in)\s*(.+)",
    "recommend": r"(?:recommend|action|advice|what\s+to\s+do)\s+(?:for|in)\s*(.+)",
}


@mcp.tool()
async def process_user_request(query: str) -> str:
    """
    Process a natural language request through the agent swarm.
    
    Supports:
    - "Analyze [city]" - Full pipeline
    - "Hotspots in [city]" - Hotspot detection
    - "Recommend for [city]" - Action recommendations
    """
    print(f"🤖 Orchestrator received: {query}")
    query_lower = query.lower().strip()
    
    # Determine intent and extract city
    intent, city_name = parse_intent(query_lower)
    
    if not city_name:
        return "❓ Please specify a city. Example: 'Analyze Delhi' or 'Hotspots in Mumbai'"
    
    print(f"📍 Intent: {intent}, City: {city_name}")
    
    # Route to appropriate handler
    if intent == "hotspots":
        return await handle_hotspot_request(city_name)
    elif intent == "recommend":
        return await handle_recommendation_request(city_name)
    else:
        return await handle_analysis_request(city_name)


async def handle_analysis_request(city_name: str) -> str:
    """Full analysis pipeline: Scout -> Ingest -> Features -> Train -> Predict -> Recommend"""
    
    # Step 1: Scout Location (sync HTTP — offload to thread to avoid blocking loop)
    print("🕵️ Step 1: Scouting location...")
    loop = asyncio.get_event_loop()
    loc_data = await loop.run_in_executor(None, find_location, city_name)
    if loc_data.get("status") != "found":
        return f"❌ Could not find location: {city_name}. Try a different spelling."
    
    bbox = loc_data["bbox"]
    print(f"✅ Found: {loc_data['name'][:50]}...")
    
    # Step 2: Setup Grid
    print("🏗️ Step 2: Setting up grid infrastructure...")
    grid_res = await setup_new_city(city_name, bbox)
    cells_count = grid_res.get("details", {}).get("cells_stored", 0)
    print(f"✅ Grid: {cells_count} cells")
    
    # Step 3: Ingest Data
    print("🛰️ Step 3: Ingesting satellite data...")
    sat_res = await ingest_satellite_data(bbox)
    
    print("🌍 Step 3b: Ingesting ground data...")
    ground_res = await ingest_ground_data(city_name, bbox)
    
    # Step 4: Feature Aggregation
    print("📊 Step 4: Aggregating features...")
    try:
        temporal_res = await aggregate_temporal_features(city_name)
        print(f"  Temporal: {temporal_res.get('cells_updated', 0)} cells")
    except Exception as e:
        print(f"  Temporal: skipped ({e})")
    
    try:
        weather_res = await aggregate_weather_data(city_name, bbox)
        print(f"  Weather: {weather_res.get('message', 'done')}")
    except Exception as e:
        print(f"  Weather: skipped ({e})")
    
    # Step 5: Train Model (if needed)
    print("🧠 Step 5: Checking/training model...")
    try:
        train_res = await check_and_train_model(city_name)
        print(f"✅ Model: {train_res.get('status')}")
        
        if train_res.get("status") == "failed":
            return f"⚠️ Model training failed for {city_name}. Insufficient data."
    except Exception as e:
        print(f"⚠️ Training error: {e}")
    
    # Step 6: Predict  (sync tool — safe to call from async context; internally
    #                   offloads graph build to a worker thread when loop is running)
    print("🔮 Step 6: Running predictions...")
    loop = asyncio.get_event_loop()
    pred_res = await loop.run_in_executor(None, predict_pollution, city_name)
    
    # Step 7: Generate Response
    print("📝 Step 7: Generating report...")
    return await generate_analysis_report(city_name, sat_res, ground_res, pred_res)


async def handle_hotspot_request(city_name: str) -> str:
    """Handle hotspot detection request."""
    hotspots_res = await detect_hotspots(city_name)
    
    if hotspots_res.get("status") != "success":
        return f"❌ Hotspot detection failed: {hotspots_res.get('message')}"
    
    hotspots = hotspots_res.get("hotspots", [])
    
    if not hotspots:
        return f"✅ **{city_name}**: No hotspots detected (PM2.5 < threshold)."
    
    report = f"## 🔥 Hotspots in {city_name}\n\n"
    report += f"**{len(hotspots)} hotspots** detected.\n\n"
    report += "| Location | PM2.5 | Severity |\n|----------|-------|----------|\n"
    
    for h in hotspots[:5]:
        report += f"| ({h['lat']:.3f}, {h['lon']:.3f}) | {h['pm25']} | {h['severity']} |\n"
    
    return report


async def handle_recommendation_request(city_name: str) -> str:
    """Handle recommendation request."""
    alert_res = await generate_alert(city_name)
    
    if alert_res.get("status") != "success":
        return f"❌ Recommendation failed: {alert_res.get('message')}"
    
    alert = alert_res.get("alert", {})
    actions = alert.get("actions", {})
    
    report = f"## 💡 Recommendations for {city_name}\n\n"
    report += f"**Status**: {alert.get('level', 'Unknown').replace('_', ' ').title()}\n"
    report += f"**Max PM2.5**: {alert.get('max_pm25', 'N/A')} µg/m³\n\n"
    report += "### Actions\n"
    
    for sector, action in actions.items():
        report += f"- **{sector.title()}**: {action}\n"
    
    return report


async def generate_analysis_report(city_name: str, sat_res: dict, ground_res: dict, pred_res: dict) -> str:
    """Generate comprehensive analysis report."""
    
    report = f"## 📊 Analysis Report: {city_name}\n\n"
    report += f"**Generated**: {datetime.utcnow().strftime('%Y-%m-%d %H:%M')} UTC\n\n"
    
    # Data Sources
    report += "### 📡 Data Ingested\n"
    sat_count = sat_res.get("data", {}).get("no2_count", 0)
    report += f"- Satellite (NO2/LST): {sat_count} records\n"
    report += f"- Ground sensors: {ground_res.get('data', {}).get('openaq_count', 0)} records\n\n"
    
    # Predictions
    if "predictions" in pred_res:
        vals = pred_res["predictions"].get("step1_values", [])[:5]
        
        report += "### 🔮 PM2.5 Forecast (Next 24h)\n"
        report += "| Node | Prediction | Uncertainty |\n|------|------------|-------------|\n"
        
        max_pm25 = 0
        for v in vals:
            val = v.get("value_real", 0)
            if val > max_pm25:
                max_pm25 = val
            report += f"| {v['node_id']} | {v.get('range_real', 'N/A')} | ±{v.get('uncertainty_real', 'N/A')} |\n"
        
        # Recommendations based on max
        report += "\n### 💡 Recommended Actions\n"
        recs = await get_recommendations(city_name, max_pm25)
        
        if recs.get("status") == "success":
            rec_data = recs.get("recommendations", {})
            report += f"**Level**: {rec_data.get('level', 'Unknown').replace('_', ' ').title()}\n\n"
            
            for sector, action in rec_data.get("actions", {}).items():
                report += f"- **{sector.title()}**: {action}\n"
    else:
        report += f"### ⚠️ Prediction Error\n{pred_res.get('error', 'Unknown error')}\n"
    
    return report


def parse_intent(query: str) -> tuple:
    """Parse user intent and extract city name."""
    
    # Check hotspot intent
    match = re.search(INTENT_PATTERNS["hotspots"], query)
    if match:
        return "hotspots", clean_city_name(match.group(1))
    
    # Check recommend intent
    match = re.search(INTENT_PATTERNS["recommend"], query)
    if match:
        return "recommend", clean_city_name(match.group(1))
    
    # Default: analyze intent
    match = re.search(INTENT_PATTERNS["analyze"], query)
    if match:
        return "analyze", clean_city_name(match.group(1))
    
    # Fallback: try to extract any city name
    words = query.split()
    stopwords = ["the", "for", "in", "at", "of", "pollution", "air", "quality", "data"]
    candidates = [w for w in words if w.lower() not in stopwords]
    
    if candidates:
        return "analyze", " ".join(candidates).title()
    
    return "unknown", None


def clean_city_name(raw: str) -> str:
    """Clean and normalize city name."""
    stopwords = ["pollution", "levels", "data", "quality", "now", "tomorrow", "today", "air"]
    
    for sw in stopwords:
        raw = raw.replace(sw, "").strip()
    
    return raw.title().strip()


@mcp.resource("podscout://swarm/status")
def get_swarm_status() -> str:
    """Get current status of the agent swarm."""
    status = {
        "orchestrator": "active",
        "agents": ["scout", "ingestion", "feature_agg", "training", "prediction", "recommendation"],
        "timestamp": datetime.utcnow().isoformat()
    }
    return json.dumps(status, indent=2)


if __name__ == "__main__":
    mcp.run(transport="stdio")
