"""
Recommendation Agent (MCP Server)

Provides actionable recommendations based on pollution levels:
- Hotspot detection
- Severity classification
- Automated action recommendations
- Personalized health advice
- Time-based activity suggestions
"""

from mcp.server.fastmcp import FastMCP
import logging
from typing import Dict, Any, List
from datetime import datetime
import json

try:
    from backend.app.services.supabase import get_supabase
except ImportError as e:
    logging.error(f"Recommendation Agent import error: {e}")

mcp = FastMCP("PodScout Recommendation Agent")
logger = logging.getLogger(__name__)

# Pollution Level Thresholds (AQI-based for India)
THRESHOLDS = {
    "pm25": {
        "good": 30,
        "satisfactory": 60,
        "moderate": 90,
        "poor": 120,
        "very_poor": 250,
        "severe": 500
    },
    "no2": {
        "good": 40,
        "moderate": 80,
        "poor": 180,
        "severe": 400
    }
}

# Government/Institutional Action Templates
ACTIONS = {
    "industrial": {
        "critical": "🏭 HALT non-essential industrial operations immediately.",
        "high": "🏭 Enforce emission controls on heavy industries.",
        "moderate": "🏭 Monitor industrial emissions closely.",
        "low": "🏭 Continue routine emission monitoring."
    },
    "transport": {
        "critical": "🚗 Implement emergency odd-even vehicle rationing.",
        "high": "🚗 Restrict heavy vehicle movement in core areas.",
        "moderate": "🚗 Encourage public transport use.",
        "low": "🚗 Promote carpooling and green commuting."
    },
    "health": {
        "critical": "🚑 Issue health emergency. Distribute N95 masks. Close schools.",
        "high": "🚑 Advise vulnerable groups to stay indoors.",
        "moderate": "🚑 Advisory for sensitive individuals.",
        "low": "🚑 No immediate health concerns."
    },
    "municipal": {
        "critical": "🚿 Deploy anti-smog guns. Water sprinklers on roads.",
        "high": "🚿 Increase street sweeping frequency.",
        "moderate": "🚿 Standard dust suppression measures.",
        "low": "🚿 Continue regular maintenance schedule."
    }
}

# Personal Health Recommendations by Severity
PERSONAL_RECOMMENDATIONS = {
    "general": {
        "critical": [
            "Stay indoors with windows and doors sealed",
            "Run air purifiers on maximum setting",
            "Avoid all outdoor activities",
            "Keep emergency medication accessible",
            "Consider working from home"
        ],
        "high": [
            "Limit outdoor exposure to essential activities only",
            "Wear N95 mask when outdoors",
            "Keep air purifier running",
            "Stay hydrated to help respiratory system",
            "Avoid opening windows during peak pollution hours"
        ],
        "moderate": [
            "Reduce prolonged outdoor exposure",
            "Consider wearing a mask for extended outdoor time",
            "Keep indoor air clean with purifiers or plants",
            "Avoid outdoor exercise during peak traffic hours",
            "Monitor AQI updates regularly"
        ],
        "low": [
            "Good day for outdoor activities",
            "Open windows for natural ventilation",
            "Great conditions for outdoor exercise",
            "No special precautions needed"
        ]
    },
    "sensitive_groups": {
        "children": {
            "critical": "🧒 Keep children indoors. Cancel all outdoor school activities. Schools should consider closure.",
            "high": "🧒 Limit outdoor play time. Ensure indoor recess. Monitor for respiratory symptoms.",
            "moderate": "🧒 Reduce outdoor playtime. Keep inhalers accessible for asthmatic children.",
            "low": "🧒 Normal outdoor activities allowed. Encourage physical activity."
        },
        "elderly": {
            "critical": "👴 Stay indoors. Avoid any physical exertion. Keep emergency contacts ready.",
            "high": "👴 Limit outdoor time. Avoid strenuous activities. Stay in air-conditioned spaces.",
            "moderate": "👴 Take breaks during outdoor activities. Stay hydrated. Monitor health.",
            "low": "👴 Good day for gentle outdoor activities. Morning walks recommended."
        },
        "respiratory_conditions": {
            "critical": "🫁 Stay indoors in filtered air. Keep rescue medication accessible. Consult doctor if symptoms worsen.",
            "high": "🫁 Limit outdoor exposure. Use preventive inhalers as prescribed. Avoid triggers.",
            "moderate": "🫁 Carry rescue inhaler. Avoid heavy exertion outdoors. Monitor symptoms.",
            "low": "🫁 Normal activities allowed. Continue regular medication routine."
        },
        "pregnant": {
            "critical": "🤰 Stay indoors. Avoid all outdoor exposure. Use air purifier in bedroom.",
            "high": "🤰 Limit outdoor time. Wear N95 mask if must go out. Stay hydrated.",
            "moderate": "🤰 Reduce outdoor activities. Avoid high-traffic areas.",
            "low": "🤰 Good conditions for outdoor activities. Stay active but hydrated."
        }
    }
}

# Activity-Based Recommendations
ACTIVITY_RECOMMENDATIONS = {
    "outdoor_exercise": {
        "critical": "🏃 Cancel all outdoor exercise. Use indoor gym or home workouts only.",
        "high": "🏃 Switch to indoor exercise. If outdoor is essential, reduce intensity and duration by 50%.",
        "moderate": "🏃 Exercise in early morning when pollution is lower. Avoid main roads.",
        "low": "🏃 Great conditions for outdoor exercise! Enjoy your workout."
    },
    "commuting": {
        "critical": "🚌 Work from home if possible. If commuting is essential, use AC vehicles with windows closed.",
        "high": "🚌 Use air-conditioned public transport. Wear mask. Avoid peak traffic hours.",
        "moderate": "🚌 Use public transport over personal vehicles. Consider early departure.",
        "low": "🚌 Normal commuting. Consider cycling or walking for short distances."
    },
    "outdoor_work": {
        "critical": "👷 Halt all non-essential outdoor work. Provide N95 masks and indoor rest areas.",
        "high": "👷 Limit continuous outdoor work to 2-hour shifts. Mandatory mask use.",
        "moderate": "👷 Take regular breaks. Stay hydrated. Use masks in dusty areas.",
        "low": "👷 Normal work conditions. Standard safety measures apply."
    }
}

# Time-Based Recommendations
TIME_BASED_ADVICE = {
    "morning": {
        "good": "🌅 Best time for outdoor activities. Air quality typically better in early morning.",
        "warning": "🌅 Morning pollution can be high due to temperature inversion. Wait until 10 AM."
    },
    "afternoon": {
        "good": "☀️ Midday often has better dispersion. Good window for outdoor activities.",
        "warning": "☀️ Avoid outdoor activities during afternoon if AQI is high."
    },
    "evening": {
        "good": "🌆 Evening walks are pleasant. Kids can play outdoors.",
        "warning": "🌆 Rush hour emissions peak in evening. Stay indoors 5-8 PM."
    },
    "night": {
        "good": "🌙 Run air purifiers overnight for clean sleep environment.",
        "warning": "🌙 Close windows at night. Use sealed room with air purifier."
    }
}

# Indoor Air Quality Tips
INDOOR_AIR_TIPS = {
    "critical": [
        "Seal all windows and doors with weather stripping",
        "Run HEPA air purifiers in all occupied rooms",
        "Create a 'clean room' with extra air filtration",
        "Avoid cooking methods that produce smoke",
        "Use wet mopping instead of sweeping"
    ],
    "high": [
        "Keep windows closed during peak pollution hours",
        "Run air purifiers continuously",
        "Add indoor plants that filter air (snake plant, spider plant)",
        "Avoid burning incense or candles",
        "Change AC filters regularly"
    ],
    "moderate": [
        "Use air purifier in bedroom at night",
        "Open windows during low-pollution hours only",
        "Consider adding air-purifying houseplants",
        "Regular vacuuming with HEPA filter",
        "Use exhaust fans while cooking"
    ],
    "low": [
        "Natural ventilation is safe today",
        "Good day to air out bedding and mattresses",
        "Open windows for cross-ventilation",
        "General cleaning won't worsen air quality"
    ]
}


@mcp.tool()
async def detect_hotspots(city: str, threshold_pm25: float = 100.0) -> Dict[str, Any]:
    """
    Detect pollution hotspots in a city.
    
    Returns cells exceeding threshold, ranked by severity.
    """
    supabase = get_supabase()
    if not supabase:
        return {"status": "error", "message": "DB not connected."}
    
    try:
        # Fetch cells with pollution data
        res = supabase.table("grid_cells") \
            .select("id, gnn_node_id, center_lat, center_lon, avg_pm25, avg_no2, population_density") \
            .eq("city", city) \
            .gte("avg_pm25", threshold_pm25) \
            .order("avg_pm25", desc=True) \
            .execute()
        
        hotspots = []
        for cell in res.data:
            pm25 = cell.get("avg_pm25") or 0
            severity = classify_severity(pm25)
            
            hotspots.append({
                "cell_id": cell["id"],
                "node_id": cell["gnn_node_id"],
                "lat": cell["center_lat"],
                "lon": cell["center_lon"],
                "pm25": round(pm25, 1),
                "severity": severity,
                "population_density": cell.get("population_density", 0)
            })
        
        return {
            "status": "success",
            "city": city,
            "threshold": threshold_pm25,
            "hotspot_count": len(hotspots),
            "hotspots": hotspots[:10]  # Top 10
        }
        
    except Exception as e:
        logger.error(f"Hotspot detection error: {e}")
        return {"status": "error", "message": str(e)}


@mcp.tool()
async def get_recommendations(city: str, max_pm25: float = None) -> Dict[str, Any]:
    """
    Generate actionable recommendations based on current pollution levels.
    Includes personalized advice for different groups and activities.
    """
    supabase = get_supabase()
    if not supabase:
        return {"status": "error", "message": "DB not connected."}
    
    try:
        # Get city-wide max PM2.5 if not provided
        if max_pm25 is None:
            res = supabase.table("grid_cells") \
                .select("avg_pm25") \
                .eq("city", city) \
                .order("avg_pm25", desc=True) \
                .limit(1) \
                .execute()
            
            if res.data:
                max_pm25 = res.data[0].get("avg_pm25") or 0
            else:
                max_pm25 = 0
        
        severity = classify_severity(max_pm25)
        
        # Map severity to action level
        if severity in ["severe", "hazardous"]:
            action_level = "critical"
        elif severity in ["very_poor", "poor"]:
            action_level = "high"
        elif severity in ["moderate", "satisfactory"]:
            action_level = "moderate"
        else:
            action_level = "low"
        
        # Determine current time period
        current_hour = datetime.utcnow().hour + 5  # IST offset
        if current_hour >= 24:
            current_hour -= 24
            
        if 5 <= current_hour < 10:
            time_period = "morning"
        elif 10 <= current_hour < 16:
            time_period = "afternoon"
        elif 16 <= current_hour < 20:
            time_period = "evening"
        else:
            time_period = "night"
        
        # Get time-based advice
        time_key = "warning" if action_level in ["critical", "high"] else "good"
        
        recommendations = {
            "level": severity,
            "action_level": action_level,
            "max_pm25": round(max_pm25, 1),
            
            # Government/Institutional Actions
            "institutional_actions": {
                "industrial": ACTIONS["industrial"].get(action_level, "Monitor."),
                "transport": ACTIONS["transport"].get(action_level, "No action."),
                "health": ACTIONS["health"].get(action_level, "No advisory."),
                "municipal": ACTIONS["municipal"].get(action_level, "Standard ops.")
            },
            
            # Personal Recommendations
            "personal": {
                "general": PERSONAL_RECOMMENDATIONS["general"].get(action_level, []),
                "summary": generate_personal_summary(max_pm25, action_level)
            },
            
            # Sensitive Groups
            "sensitive_groups": {
                group: advice.get(action_level, "No specific advice.")
                for group, advice in PERSONAL_RECOMMENDATIONS["sensitive_groups"].items()
            },
            
            # Activity-Based Recommendations
            "activities": {
                activity: advice.get(action_level, "Normal activities.")
                for activity, advice in ACTIVITY_RECOMMENDATIONS.items()
            },
            
            # Time-Based Advice
            "time_based": {
                "current_period": time_period,
                "advice": TIME_BASED_ADVICE.get(time_period, {}).get(time_key, "")
            },
            
            # Indoor Air Tips
            "indoor_air_tips": INDOOR_AIR_TIPS.get(action_level, []),
            
            # Quick Summary
            "quick_summary": generate_quick_summary(city, max_pm25, severity, action_level),
            
            "timestamp": datetime.utcnow().isoformat()
        }
        
        return {
            "status": "success",
            "city": city,
            "recommendations": recommendations
        }
        
    except Exception as e:
        logger.error(f"Recommendation error: {e}")
        return {"status": "error", "message": str(e)}


def generate_personal_summary(pm25: float, action_level: str) -> str:
    """Generate a personal summary based on pollution level."""
    if action_level == "critical":
        return f"⚠️ ALERT: PM2.5 at {pm25:.0f} µg/m³ (Severe). Stay indoors. Avoid all outdoor exposure."
    elif action_level == "high":
        return f"🔴 CAUTION: PM2.5 at {pm25:.0f} µg/m³ (Very Poor). Limit outdoor exposure. Wear N95 mask if going out."
    elif action_level == "moderate":
        return f"🟡 ADVISORY: PM2.5 at {pm25:.0f} µg/m³ (Moderate). Reduce prolonged outdoor activities."
    else:
        return f"🟢 Good conditions: PM2.5 at {pm25:.0f} µg/m³. Enjoy outdoor activities!"


def generate_quick_summary(city: str, pm25: float, severity: str, action_level: str) -> Dict[str, Any]:
    """Generate a quick summary card for the city."""
    emoji_map = {
        "critical": "🚨",
        "high": "⚠️",
        "moderate": "🟡",
        "low": "🟢"
    }
    
    mask_required = action_level in ["critical", "high"]
    outdoor_safe = action_level in ["moderate", "low"]
    
    return {
        "emoji": emoji_map.get(action_level, "❓"),
        "headline": f"{city}: {severity.replace('_', ' ').title()} Air Quality",
        "pm25_display": f"{pm25:.0f} µg/m³",
        "mask_required": mask_required,
        "outdoor_safe": outdoor_safe,
        "key_action": PERSONAL_RECOMMENDATIONS["general"].get(action_level, ["No specific action"])[0]
    }




@mcp.tool()
async def generate_alert(city: str) -> Dict[str, Any]:
    """
    Generate a structured alert for a city based on current conditions.
    """
    # Get hotspots
    hotspots_res = await detect_hotspots(city, threshold_pm25=60)
    
    # Get recommendations
    recommendations_res = await get_recommendations(city)
    
    if hotspots_res.get("status") != "success":
        return hotspots_res
    
    hotspots = hotspots_res.get("hotspots", [])
    recs = recommendations_res.get("recommendations", {})
    
    # Build enhanced alert
    alert = {
        "city": city,
        "timestamp": datetime.utcnow().isoformat(),
        "level": recs.get("level", "unknown"),
        "action_level": recs.get("action_level", "unknown"),
        "max_pm25": recs.get("max_pm25", 0),
        "hotspot_count": len(hotspots),
        "top_hotspots": hotspots[:3],
        
        # Quick summary for display
        "quick_summary": recs.get("quick_summary", {}),
        
        # Institutional actions
        "institutional_actions": recs.get("institutional_actions", {}),
        
        # Personal advice
        "personal_summary": recs.get("personal", {}).get("summary", ""),
        
        # Key recommendations
        "key_recommendations": recs.get("personal", {}).get("general", [])[:3],
        
        # Sensitive groups
        "sensitive_groups_advice": recs.get("sensitive_groups", {}),
        
        # Time-based advice
        "time_based_advice": recs.get("time_based", {}),
        
        # Full summary
        "summary": generate_summary(city, recs.get("level"), len(hotspots), recs.get("max_pm25"))
    }
    
    return {
        "status": "success",
        "alert": alert
    }


def classify_severity(pm25: float) -> str:
    """Classify PM2.5 level into severity category using India AQI standards."""
    if pm25 >= THRESHOLDS["pm25"]["severe"]:
        return "severe"
    elif pm25 >= THRESHOLDS["pm25"]["very_poor"]:
        return "very_poor"
    elif pm25 >= THRESHOLDS["pm25"]["poor"]:
        return "poor"
    elif pm25 >= THRESHOLDS["pm25"]["moderate"]:
        return "moderate"
    elif pm25 >= THRESHOLDS["pm25"]["satisfactory"]:
        return "satisfactory"
    else:
        return "good"


def generate_summary(city: str, level: str, hotspot_count: int, max_pm25: float) -> str:
    """Generate human-readable summary."""
    level_emoji = {
        "good": "🟢",
        "moderate": "🟡",
        "unhealthy_sensitive": "🟠",
        "unhealthy": "🟠",
        "very_unhealthy": "🔴",
        "hazardous": "⚫"
    }
    
    emoji = level_emoji.get(level, "⚪")
    
    return f"{emoji} **{city}**: {level.replace('_', ' ').title()} (PM2.5: {max_pm25:.0f} µg/m³). {hotspot_count} hotspots detected."


@mcp.resource("podscout://alerts/latest/{city}")
def get_latest_alert(city: str) -> str:
    """Resource: Get latest alert summary for a city."""
    import asyncio
    
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        alert_res = loop.run_until_complete(generate_alert(city))
        return json.dumps(alert_res, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)})


if __name__ == "__main__":
    mcp.run(transport="stdio")
