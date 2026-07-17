"""
ML Predictions MCP Server

Provides ML-powered predictions via MCP:
- PM2.5 forecasting using ST-GNN
- Hotspot detection and classification
- Real-time inference on grid cells
"""

import json
import sys
import os
from datetime import datetime
from typing import Optional

# Add parent to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))

from mcp.server.fastmcp import FastMCP
from backend.app.ml.graph_builder import graph_builder, TORCH_AVAILABLE
from backend.app.services.supabase import get_supabase
import logging

# Create MCP server
mcp = FastMCP("PodScout ML Predictions")
logger = logging.getLogger(__name__)


# ============================================================================
# AQI Categories and Health Impact Definitions
# ============================================================================

AQI_CATEGORIES = {
    "good": {
        "range": (0, 30),
        "color": "#00E400",
        "emoji": "🟢",
        "label": "Good",
        "health_impact": "Air quality is satisfactory, and air pollution poses little or no risk.",
        "sensitive_groups": "None",
        "outdoor_activity": "Great day for outdoor activities!",
        "mask_required": False
    },
    "satisfactory": {
        "range": (31, 60),
        "color": "#92D050",
        "emoji": "🟡",
        "label": "Satisfactory",
        "health_impact": "Air quality is acceptable. However, there may be a risk for some people.",
        "sensitive_groups": "Unusually sensitive individuals may experience minor respiratory symptoms.",
        "outdoor_activity": "Good conditions for most outdoor activities.",
        "mask_required": False
    },
    "moderate": {
        "range": (61, 90),
        "color": "#FFFF00",
        "emoji": "🟠",
        "label": "Moderate",
        "health_impact": "Some people may experience health effects. General public unlikely to be affected.",
        "sensitive_groups": "People with respiratory or heart conditions may experience symptoms.",
        "outdoor_activity": "Consider reducing prolonged outdoor exertion if you experience symptoms.",
        "mask_required": False
    },
    "poor": {
        "range": (91, 120),
        "color": "#FF7E00",
        "emoji": "🟠",
        "label": "Poor",
        "health_impact": "Everyone may begin to experience health effects. Sensitive groups may experience more serious effects.",
        "sensitive_groups": "Elderly, children, and people with respiratory diseases should limit outdoor exposure.",
        "outdoor_activity": "Reduce prolonged or heavy outdoor exertion.",
        "mask_required": True
    },
    "very_poor": {
        "range": (121, 250),
        "color": "#FF0000",
        "emoji": "🔴",
        "label": "Very Poor",
        "health_impact": "Health warnings of emergency conditions. Everyone is likely to be affected.",
        "sensitive_groups": "Avoid all outdoor activities. Stay indoors with air purifiers if possible.",
        "outdoor_activity": "Avoid outdoor activities. Work from home if possible.",
        "mask_required": True,
        "mask_type": "N95 or better"
    },
    "severe": {
        "range": (251, 500),
        "color": "#7E0023",
        "emoji": "⚫",
        "label": "Severe",
        "health_impact": "Health alert: everyone may experience serious health effects.",
        "sensitive_groups": "Medical emergency for sensitive groups. Seek medical attention if needed.",
        "outdoor_activity": "Everyone should avoid all outdoor physical activities.",
        "mask_required": True,
        "mask_type": "N95 with proper fit"
    },
    "hazardous": {
        "range": (501, float('inf')),
        "color": "#4A0018",
        "emoji": "☠️",
        "label": "Hazardous",
        "health_impact": "Health emergency. Entire population is affected. Immediate action required.",
        "sensitive_groups": "All individuals at severe health risk. Emergency protocols advised.",
        "outdoor_activity": "Remain indoors. Seal windows. Use air purifiers on maximum.",
        "mask_required": True,
        "mask_type": "N95/N99 mandatory outdoors"
    }
}


def pm25_to_aqi_category(pm25: float) -> dict:
    """
    Convert PM2.5 value to AQI category with full details.
    
    Args:
        pm25: PM2.5 concentration in µg/m³
        
    Returns:
        Dict with category details including color, health impact, and recommendations
    """
    if pm25 < 0:
        pm25 = 0
    
    for category, details in AQI_CATEGORIES.items():
        low, high = details["range"]
        if low <= pm25 <= high:
            return {
                "category": category,
                "label": details["label"],
                "color": details["color"],
                "emoji": details["emoji"],
                "pm25_value": round(pm25, 1),
                "health_impact": details["health_impact"],
                "sensitive_groups_advice": details["sensitive_groups"],
                "outdoor_activity_advice": details["outdoor_activity"],
                "mask_required": details["mask_required"],
                "mask_type": details.get("mask_type")
            }
    
    # Fallback for very high values
    return pm25_to_aqi_category(500)


def get_confidence_level(uncertainty: float, value: float) -> dict:
    """
    Interpret uncertainty as a confidence level.
    
    Args:
        uncertainty: Prediction uncertainty (sigma)
        value: Predicted value (mean)
        
    Returns:
        Dict with confidence level and description
    """
    if value == 0:
        ratio = 1.0
    else:
        ratio = uncertainty / max(value, 1)
    
    if ratio < 0.1:
        return {
            "level": "very_high",
            "emoji": "🎯",
            "description": "Model has very high confidence in this prediction",
            "reliability": "Highly reliable"
        }
    elif ratio < 0.25:
        return {
            "level": "high",
            "emoji": "✅",
            "description": "Model has high confidence in this prediction",
            "reliability": "Reliable"
        }
    elif ratio < 0.5:
        return {
            "level": "moderate",
            "emoji": "⚠️",
            "description": "Moderate confidence - actual values may vary",
            "reliability": "Somewhat reliable"
        }
    else:
        return {
            "level": "low",
            "emoji": "❓",
            "description": "Low confidence - consider this as an estimate",
            "reliability": "Use with caution"
        }


def interpret_prediction(prediction: dict) -> dict:
    """
    Generate a comprehensive interpretation of a single prediction.
    
    Args:
        prediction: Raw prediction dict with value_real and uncertainty_real
        
    Returns:
        Enhanced prediction with interpretation
    """
    pm25 = prediction.get("value_real", 0)
    uncertainty = prediction.get("uncertainty_real", 0)
    
    aqi_info = pm25_to_aqi_category(pm25)
    confidence = get_confidence_level(uncertainty, pm25)
    
    return {
        **prediction,
        "aqi_category": aqi_info,
        "confidence": confidence,
        "interpretation": {
            "summary": f"{aqi_info['emoji']} {aqi_info['label']} air quality (PM2.5: {pm25:.1f} µg/m³)",
            "health_message": aqi_info["health_impact"],
            "recommendation": aqi_info["outdoor_activity_advice"]
        }
    }


def generate_city_summary(predictions: list, city: str) -> dict:
    """
    Generate a city-wide summary from all node predictions.
    
    Args:
        predictions: List of node predictions
        city: City name
        
    Returns:
        Summary dict with aggregated insights
    """
    if not predictions:
        return {"error": "No predictions available"}
    
    values = [p.get("value_real", 0) for p in predictions]
    avg_pm25 = sum(values) / len(values)
    max_pm25 = max(values)
    min_pm25 = min(values)
    
    # Count nodes in each category
    category_counts = {}
    for p in predictions:
        cat = pm25_to_aqi_category(p.get("value_real", 0))["category"]
        category_counts[cat] = category_counts.get(cat, 0) + 1
    
    # Determine dominant category
    dominant = max(category_counts, key=category_counts.get)
    dominant_info = pm25_to_aqi_category(avg_pm25)
    
    # Count hotspots (poor or worse)
    hotspot_categories = {"poor", "very_poor", "severe", "hazardous"}
    hotspot_count = sum(category_counts.get(c, 0) for c in hotspot_categories)
    
    return {
        "city": city,
        "overall_status": {
            "category": dominant_info["label"],
            "emoji": dominant_info["emoji"],
            "color": dominant_info["color"],
            "avg_pm25": round(avg_pm25, 1),
            "max_pm25": round(max_pm25, 1),
            "min_pm25": round(min_pm25, 1)
        },
        "hotspots": {
            "count": hotspot_count,
            "percentage": round((hotspot_count / len(predictions)) * 100, 1)
        },
        "category_distribution": category_counts,
        "health_advisory": dominant_info["health_impact"],
        "general_recommendation": dominant_info["outdoor_activity_advice"]
    }


# ============================================================================
# TOOLS - ML-powered prediction functions
# ============================================================================

@mcp.tool()
def predict_pollution(
    city: str,
    forecast_hours: int = 24,
) -> dict:
    """
    Predict future PM2.5 levels for a city using ST-GNN.

    Args:
        city: City name (e.g., 'Delhi', 'Mumbai')
        forecast_hours: Hours ahead to forecast (default: 24).
                        The model auto-regressively produces up to this many steps.

    Returns:
        Predictions for all grid cells in the city
    """
    if not TORCH_AVAILABLE:
        return {"error": "ML features not available. Install PyTorch.", "city": city}

    try:
        import asyncio
        import re
        import torch
        import numpy as np
        from backend.app.ml.st_gnn import BayesianSTGNN

        # -----------------------------------------------------------------
        # 1. Build graph — safe event-loop handling (no nest_asyncio needed)
        # -----------------------------------------------------------------
        try:
            loop = asyncio.get_running_loop()
            # We are inside a running loop → offload to a worker thread that
            # owns its own loop, avoiding the deadlock entirely.
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                future = pool.submit(
                    asyncio.run, graph_builder.build_city_graph(city)
                )
                graph = future.result(timeout=30)
        except RuntimeError:
            # No running loop in this thread — safe to call directly.
            graph = asyncio.run(graph_builder.build_city_graph(city))

        if graph is None:
            return {
                "error": f"Could not build graph for {city}. Check grid cells exist.",
                "city": city,
            }

        graph = graph_builder.normalize_features(graph)

        # -----------------------------------------------------------------
        # 2. Locate model + scaler files (absolute path relative to this file)
        # -----------------------------------------------------------------
        city_slug   = re.sub(r'[^a-z0-9]', '_', city.lower())
        models_dir  = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'ml', 'models')
        models_dir  = os.path.normpath(models_dir)
        final_path  = os.path.join(models_dir, f'{city_slug}_weights.pt')
        scaler_path = os.path.join(models_dir, f'{city_slug}_scaler.pt')

        if not os.path.exists(final_path):
            return {
                "error": f"Model weights not found at {final_path}. Train the model first.",
                "city": city,
            }

        # -----------------------------------------------------------------
        # 3. Load model
        # -----------------------------------------------------------------
        scaler_data = torch.load(scaler_path) if os.path.exists(scaler_path) else None

        # Retrieve hidden_dim and seq_len from scaler if available
        hidden_dim = int((scaler_data or {}).get('hidden_dim', 32))
        seq_len    = int((scaler_data or {}).get('seq_len',   12))

        model = BayesianSTGNN(
            num_features=graph.num_features, hidden_dim=hidden_dim, output_dim=1
        )
        model.load_state_dict(torch.load(final_path, map_location='cpu'))
        model.eval()

        # -----------------------------------------------------------------
        # 4. Build seed sequence (repeat current snapshot seq_len times)
        # -----------------------------------------------------------------
        x_snapshot = graph.x                                           # [Nodes, Features]
        x_seq      = x_snapshot.unsqueeze(0).repeat(seq_len, 1, 1)    # [SeqLen, Nodes, Features]

        edge_index = graph.edge_index
        edge_attr  = graph.edge_attr[:, 0]

        # -----------------------------------------------------------------
        # 5. Scaler: mean/std shape is [1, 1, Features] — PM2.5 is index 0
        # -----------------------------------------------------------------
        if scaler_data is not None:
            pm25_mean = float(scaler_data['mean'].reshape(-1)[0])
            pm25_std  = float(scaler_data['std'].reshape(-1)[0])
        else:
            pm25_mean, pm25_std = 0.0, 1.0

        # -----------------------------------------------------------------
        # 6. Auto-regressive multi-step forecast (up to forecast_hours steps)
        # -----------------------------------------------------------------
        forecast_steps = max(1, min(forecast_hours, 72))   # cap at 72 h
        all_step_predictions: list = []

        with torch.no_grad():
            for step in range(forecast_steps):
                mu, sigma, _ = model(x_seq, edge_index, edge_attr, seq_len=seq_len)
                # mu, sigma: [Nodes, 1]

                mu_list    = mu.squeeze().tolist()
                sigma_list = sigma.squeeze().tolist()

                if isinstance(mu_list, float):          # single-node edge case
                    mu_list    = [mu_list]
                    sigma_list = [sigma_list]

                step_preds = []
                for i, (val_z, unc_z) in enumerate(zip(mu_list, sigma_list)):
                    val_real = max(0.0, val_z * pm25_std + pm25_mean)
                    unc_real = abs(unc_z * pm25_std)
                    raw = {
                        "node_id":          i,
                        "step_ahead":       step + 1,
                        "value_real":       round(val_real, 2),
                        "uncertainty_real": round(unc_real, 2),
                        "range_real":       f"{val_real:.2f} ± {unc_real:.2f}",
                        "z_score":          round(val_z, 2),
                    }
                    step_preds.append(interpret_prediction(raw))

                all_step_predictions.append(step_preds)

                # Slide window: drop oldest step, append prediction as new step
                new_x = x_seq[-1].clone()
                new_x[:, 0] = mu.squeeze()   # overwrite PM2.5 with forecast
                x_seq = torch.cat([x_seq[1:], new_x.unsqueeze(0)], dim=0)

        # -----------------------------------------------------------------
        # 7. Build response — first step (next hour) as the primary result
        # -----------------------------------------------------------------
        predictions_list = all_step_predictions[0]
        city_summary     = generate_city_summary(predictions_list, city)

        # Aggregate trend: max PM2.5 per step for sparkline
        trend = [
            {
                "step_ahead": s + 1,
                "avg_pm25": round(
                    sum(p["value_real"] for p in step_preds) / max(len(step_preds), 1), 2
                ),
            }
            for s, step_preds in enumerate(all_step_predictions)
        ]

        return {
            "city":           city,
            "forecast_hours": forecast_steps,
            "num_nodes":      graph.num_nodes,
            "city_summary":   city_summary,
            "predictions": {
                "status":            "success",
                "model":             "Bayesian ST-GNN",
                "type":              "Probabilistic (Mean ± Sigma)",
                "step1_values":      predictions_list[:10],
                "total_nodes":       len(predictions_list),
                "forecast_trend":    trend,
            },
            "interpretation": {
                "overall_aqi":    city_summary.get("overall_status", {}).get("category", "Unknown"),
                "health_advisory": city_summary.get("health_advisory", ""),
                "recommendation":  city_summary.get("general_recommendation", ""),
                "hotspot_alert":   (
                    f"⚠️ {city_summary.get('hotspots', {}).get('count', 0)} hotspots detected"
                    if city_summary.get('hotspots', {}).get('count', 0) > 0
                    else "✅ No hotspots detected"
                ),
            },
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.exception("predict_pollution failed for %s", city)
        return {"error": str(e), "city": city}


@mcp.tool()
def detect_hotspots(
    city: str,
    threshold_pm25: float = 100.0,
    confidence_threshold: float = 0.7
) -> dict:
    """
    Detect pollution hotspots using ML classification.
    
    Args:
        city: City name
        threshold_pm25: PM2.5 threshold for hotspot (default: 100)
        confidence_threshold: Minimum confidence score (default: 0.7)
    
    Returns:
        Detected hotspots with confidence scores
    """
    if not TORCH_AVAILABLE:
        return {
            "error": "ML features not available",
            "city": city
        }
    
    try:
        import asyncio
        
        # Build graph
        graph = asyncio.run(graph_builder.build_city_graph(city))
        
        if graph is None:
            return {
                "error": f"No grid data for {city}",
                "city": city
            }
        
        # Would use trained model for actual predictions
        return {
            "city": city,
            "threshold_pm25": threshold_pm25,
            "confidence_threshold": confidence_threshold,
            "hotspots": [],
            "status": "Model not trained yet",
            "message": "Train model using /api/v1/ml/train endpoint",
            "timestamp": datetime.utcnow().isoformat()
        }
    
    except Exception as e:
        return {
            "error": str(e),
            "city": city
        }


@mcp.tool()
def evaluate_deployment_impact(
    site_ids: list[str],
    pod_capacity: int = 1000
) -> dict:
    """
    Evaluate predicted impact of Climate Pod deployment using ML.
    
    Args:
        site_ids: List of grid cell IDs for deployment
        pod_capacity: PM2.5 reduction capacity per pod (µg/m³)
    
    Returns:
        Predicted PM2.5 reduction and affected population
    """
    supabase = get_supabase()
    
    if not supabase:
        return {"error": "Database not configured"}
    
    try:
        # Fetch site information
        sites = []
        for site_id in site_ids:
            result = supabase.table("grid_cells").select("*").eq("id", site_id).execute()
            if result.data:
                sites.append(result.data[0])
        
        if not sites:
            return {"error": "No sites found"}
        
        # Calculate impact (simplified - would use ML model)
        total_population = sum(s.get("population_density", 0) for s in sites)
        avg_pm25_before = sum(s.get("avg_pm25", 0) for s in sites) / len(sites)
        
        # Estimate reduction
        estimated_reduction = min(pod_capacity, avg_pm25_before * 0.3)  # 30% max
        
        return {
            "deployment_sites": len(sites),
            "site_ids": site_ids,
            "pod_capacity": pod_capacity,
            "impact_estimate": {
                "population_affected": total_population,
                "avg_pm25_before": round(avg_pm25_before, 2),
                "estimated_reduction_pm25": round(estimated_reduction, 2),
                "avg_pm25_after": round(avg_pm25_before - estimated_reduction, 2),
                "percent_improvement": round((estimated_reduction / avg_pm25_before) * 100, 1) if avg_pm25_before > 0 else 0
            },
            "model_status": "Using heuristic model. Train ST-GNN for ML-based predictions.",
            "timestamp": datetime.utcnow().isoformat()
        }
    
    except Exception as e:
        return {"error": str(e)}


# ============================================================================
# RESOURCES - ML model information
# ============================================================================

@mcp.resource("podscout://ml/model/status")
def get_model_status() -> str:
    """Get ML model training status and information."""
    
    status = {
        "torch_available": TORCH_AVAILABLE,
        "models": {
            "st_gnn": {
                "status": "not_trained",
                "architecture": "GCN + LSTM",
                "tasks": ["pm25_prediction", "hotspot_classification"],
                "requires_training": True
            }
        },
        "graph_builder": {
            "available": True,
            "num_features": 14,
            "feature_names": graph_builder.feature_names if TORCH_AVAILABLE else []
        },
        "last_updated": datetime.utcnow().isoformat()
    }
    
    return json.dumps(status, indent=2)


@mcp.resource("podscout://ml/predictions/recent")
def get_recent_predictions() -> str:
    """Get recent ML predictions (placeholder)."""
    
    recent = {
        "predictions": [],
        "message": "No predictions yet. Use predict_pollution tool",
        "timestamp": datetime.utcnow().isoformat()
    }
    
    return json.dumps(recent, indent=2)


# ============================================================================
# PROMPTS - ML analysis templates
# ============================================================================

@mcp.prompt()
def pollution_forecast_prompt(city: str, days: int = 7) -> str:
    """Generate prompt for pollution forecasting."""
    
    return f"""Analyze pollution forecast for {city} for the next {days} days.

**City**: {city}
**Forecast Period**: {days} days
**Analysis Time**: {datetime.utcnow().isoformat()}

**Required Analysis**:
1. Current pollution trends
2. Predicted PM2.5 levels (hourly breakdown)
3. High-risk periods identification
4. Weather impact factors
5. Recommended interventions

Use ST-GNN model predictions combined with meteorological data."""


@mcp.prompt()
def hotspot_analysis_prompt(city: str) -> str:
    """Generate prompt for hotspot detection and analysis."""
    
    return f"""Perform comprehensive hotspot analysis for {city}.

**Analysis Focus**:
1. Detected hotspot locations (ML-powered)
2. Severity classification (critical/high/moderate)
3. Contributing factors
4. Affected population estimate
5. Intervention priority ranking

Combine ML predictions with real-time sensor data."""


# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    mcp.run(transport="stdio")
