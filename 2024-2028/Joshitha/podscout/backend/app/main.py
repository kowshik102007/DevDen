"""
PodScout Pro - Flask Backend Application

Air quality prediction platform with multi-source data ingestion,
Redis caching, and MCP-based orchestration.
"""
from flask import Flask, jsonify, request
import os
import asyncio
import logging
from supabase import create_client, Client
from dotenv import load_dotenv

# Import services
from backend.app.mcp_host.client import mcp_host
from backend.app.services.redis_client import RedisClient
from backend.app.services.auth import auth
from backend.app.config import settings
from backend.app.ingestion.scheduler import scheduler
from backend.app.middleware.auth import require_auth, optional_auth, get_current_user

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Supabase Configuration
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")

supabase: Client = None
if url and key:
    try:
        supabase = create_client(url, key)
        logger.info("✅ Supabase client initialized")
    except Exception as e:
        logger.error(f"❌ Supabase initialization failed: {e}")
else:
    logger.warning("⚠️ SUPABASE_URL or SUPABASE_KEY not found in environment")


# =============================================================================
# Root and Info Endpoints
# =============================================================================

@app.route('/')
def index():
    """Root endpoint with application info."""
    return jsonify({
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "endpoints": {
            "health": "/health",
            "ready": "/ready",
            "auth": {
                "signup": "/api/v1/auth/signup",
                "login": "/api/v1/auth/login",
                "logout": "/api/v1/auth/logout",
                "me": "/api/v1/auth/me",
                "oauth": "/api/v1/auth/oauth/<provider>",
                "refresh": "/api/v1/auth/refresh",
                "reset_password": "/api/v1/auth/reset-password"
            },
            "user": {
                "profile": "/api/v1/user/profile",
                "locations": "/api/v1/user/locations",
                "alerts": "/api/v1/user/alerts"
            },
            "chat": {
                "conversations": "/api/v1/chat/conversations",
                "messages": "/api/v1/chat/conversations/<id>/messages"
            },
            "mcp": {
                "tools": "/mcp/tools",
                "predict": "/mcp/tools/predict_pollution",
                "recommend": "/mcp/tools/get_recommendations"
            },
            "ingestion": "/api/v1/ingestion/trigger",
            "cache": "/api/v1/cache/stats"
        }
    })


# =============================================================================
# Health Check Endpoints
# =============================================================================

@app.route('/health')
def health():
    """
    Basic health check - returns 200 if app is running.
    Use for liveness probes.
    """
    return jsonify({
        "status": "healthy",
        "framework": "flask",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION
    })


@app.route('/ready')
def ready():
    """
    Readiness check - verifies all dependencies are available.
    Use for readiness probes.
    """
    checks = {
        "app": True,
        "supabase": False,
        "redis": False
    }
    
    # Check Supabase
    if supabase:
        try:
            # Try a simple query
            supabase.table('monitoring_sites').select('id').limit(1).execute()
            checks["supabase"] = True
        except Exception as e:
            logger.warning(f"Supabase not ready: {e}")
    
    # Check Redis
    redis_health = RedisClient.health_check()
    checks["redis"] = redis_health.get("status") == "healthy"
    
    # Determine overall status
    all_ready = all(checks.values())
    critical_ready = checks["app"]  # App is the only critical dependency
    
    status_code = 200 if critical_ready else 503
    
    return jsonify({
        "status": "ready" if all_ready else "degraded" if critical_ready else "not_ready",
        "checks": checks,
        "redis_details": redis_health
    }), status_code


# =============================================================================
# Ingestion API Endpoints
# =============================================================================

@app.route('/api/v1/ingestion/trigger', methods=['POST'])
def trigger_ingestion():
    """
    Trigger data ingestion pipeline.
    Runs synchronously and returns results.
    """
    try:
        logger.info("🚀 Manual ingestion triggered via API")
        
        # Run async ingestion in sync context
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(scheduler.run_daily_ingestion())
        finally:
            loop.close()
        
        return jsonify({
            "status": "completed",
            "result": result
        })
        
    except Exception as e:
        logger.error(f"Ingestion failed: {e}")
        return jsonify({
            "status": "error",
            "error": str(e)
        }), 500


@app.route('/api/v1/ingestion/status')
def ingestion_status():
    """Get current ingestion pipeline status."""
    return jsonify({
        "running": scheduler.running,
        "last_run": None,
        "schedule": "Hourly"
    })


@app.route('/api/v1/ingestion/sources')
def list_data_sources():
    """List all available data sources."""
    return jsonify({
        "satellite": [
            {
                "name": "Sentinel-5P",
                "parameters": ["NO2", "SO2", "CO", "O3"],
                "resolution": "3.5km x 7km",
                "revisit": "Daily"
            },
            {
                "name": "Landsat 8/9",
                "parameters": ["LST"],
                "resolution": "30m",
                "revisit": "8-16 days"
            }
        ],
        "ground_sensors": [
            {
                "name": "CPCB",
                "coverage": "India",
                "parameters": ["PM2.5", "PM10", "NO2", "SO2", "CO", "O3"],
                "frequency": "Real-time"
            },
            {
                "name": "OpenAQ",
                "coverage": "Global",
                "parameters": ["PM2.5", "PM10", "NO2", "SO2", "CO", "O3"],
                "frequency": "Real-time"
            }
        ]
    })


# =============================================================================
# Cache Management Endpoints
# =============================================================================

@app.route('/api/v1/cache/stats')
def cache_stats():
    """Get Redis cache statistics."""
    if not RedisClient.is_connected():
        return jsonify({
            "status": "disconnected",
            "error": "Redis not connected"
        }), 503
    
    stats = RedisClient.get_cache_stats()
    health = RedisClient.health_check()
    
    return jsonify({
        "status": "connected",
        "health": health,
        "keys_by_prefix": stats
    })


@app.route('/api/v1/cache/clear/<prefix>', methods=['POST'])
def clear_cache(prefix: str):
    """Clear cache for a specific data source prefix."""
    valid_prefixes = ['openaq', 'cpcb', 'osm', 'sentinel', 'grid', 'analysis', 'all']
    
    if prefix not in valid_prefixes:
        return jsonify({
            "error": f"Invalid prefix. Valid values: {valid_prefixes}"
        }), 400
    
    if prefix == 'all':
        # Clear all caches
        total = 0
        for p in ['openaq', 'cpcb', 'osm', 'sentinel', 'grid', 'analysis']:
            total += RedisClient.invalidate_cache(p)
        return jsonify({"status": "cleared", "keys_deleted": total})
    
    deleted = RedisClient.invalidate_cache(prefix)
    return jsonify({
        "status": "cleared",
        "prefix": prefix,
        "keys_deleted": deleted
    })


# =============================================================================
# MCP Endpoints
# =============================================================================

@app.route('/mcp/setup', methods=['POST'])
async def mcp_setup():
    """Initialize MCP Host and return connected servers."""
    try:
        if not mcp_host._initialized:
            logger.info("Initializing MCP Host...")
            await mcp_host.initialize()
            
        servers = list(mcp_host.sessions.keys())
        
        return jsonify({
            "status": "success",
            "message": "MCP Host Initialized and Connected",
            "connected_servers": servers,
            "host_state": "ready"
        })
    except Exception as e:
        logger.error(f"MCP setup error: {e}")
        return jsonify({"status": "error", "error": str(e)}), 500


# =============================================================================
# OpenAQ Test Endpoint
# =============================================================================

@app.route('/api/v1/test/openaq')
def test_openaq():
    """Test OpenAQ API connection."""
    from backend.app.ingestion.openaq import openaq
    
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            # Fetch latest measurements for India
            result = loop.run_until_complete(
                openaq.fetch_latest_measurements(
                    country='IN',
                    limit=10
                )
            )
        finally:
            loop.close()
        
        pm25_data = [r for r in result if r.get('parameter') == 'pm25']
        
        return jsonify({
            "status": "success",
            "total_measurements": len(result),
            "pm25_measurements": len(pm25_data),
            "sample_data": result[:3] if result else [],
            "api_key_configured": bool(openaq.api_key)
        })
        
    except Exception as e:
        logger.error(f"OpenAQ test failed: {e}")
        return jsonify({
            "status": "error",
            "error": str(e)
        }), 500


# =============================================================================
# Authentication Endpoints
# =============================================================================

@app.route('/api/v1/auth/signup', methods=['POST'])
def signup():
    """
    Register a new user with email and password.
    
    Body:
        - email: string (required)
        - password: string (required, min 6 chars)
        - name: string (optional)
    """
    data = request.get_json()
    
    if not data:
        return jsonify({"error": "Request body required", "status": "error"}), 400
    
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({"error": "Email and password required", "status": "error"}), 400
    
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters", "status": "error"}), 400
    
    metadata = {}
    if data.get('name'):
        metadata['name'] = data.get('name')
    
    result = auth.signup_with_email(email, password, metadata if metadata else None)
    
    if result.get("status") == "success":
        return jsonify(result), 201
    else:
        return jsonify(result), 400


@app.route('/api/v1/auth/login', methods=['POST'])
def login():
    """
    Authenticate user with email and password.
    
    Body:
        - email: string (required)
        - password: string (required)
    """
    data = request.get_json()
    
    if not data:
        return jsonify({"error": "Request body required", "status": "error"}), 400
    
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({"error": "Email and password required", "status": "error"}), 400
    
    result = auth.login_with_email(email, password)
    
    if result.get("status") == "success":
        return jsonify(result)
    else:
        return jsonify(result), 401


@app.route('/api/v1/auth/logout', methods=['POST'])
def logout():
    """Sign out the current user."""
    result = auth.logout()
    return jsonify(result)


@app.route('/api/v1/auth/oauth/<provider>')
def oauth_login(provider: str):
    """
    Get OAuth login URL for provider.
    
    Supported providers: google, github
    """
    if provider not in ['google', 'github']:
        return jsonify({"error": f"Unsupported provider: {provider}", "status": "error"}), 400
    
    result = auth.login_with_oauth(provider)
    
    if result.get("status") == "success":
        return jsonify(result)
    else:
        return jsonify(result), 400


@app.route('/api/v1/auth/me')
@require_auth
def get_me():
    """Get current authenticated user's profile."""
    user = get_current_user()
    return jsonify({
        "status": "success",
        "user": user
    })


@app.route('/api/v1/auth/refresh', methods=['POST'])
def refresh_token():
    """
    Refresh access token using refresh token.
    
    Body:
        - refresh_token: string (required)
    """
    data = request.get_json()
    
    if not data or not data.get('refresh_token'):
        return jsonify({"error": "Refresh token required", "status": "error"}), 400
    
    result = auth.refresh_session(data.get('refresh_token'))
    
    if result.get("status") == "success":
        return jsonify(result)
    else:
        return jsonify(result), 401


@app.route('/api/v1/auth/reset-password', methods=['POST'])
def reset_password():
    """
    Send password reset email.
    
    Body:
        - email: string (required)
    """
    data = request.get_json()
    
    if not data or not data.get('email'):
        return jsonify({"error": "Email required", "status": "error"}), 400
    
    result = auth.reset_password(data.get('email'))
    return jsonify(result)


# =============================================================================
# User Profile Endpoints (Protected)
# =============================================================================

@app.route('/api/v1/user/profile')
@require_auth
def get_user_profile():
    """Get current user's profile from user_profiles table."""
    user = get_current_user()
    
    try:
        result = supabase.table("user_profiles").select("*").eq("id", user['id']).single().execute()
        
        if result.data:
            return jsonify({"status": "success", "profile": result.data})
        else:
            return jsonify({"error": "Profile not found", "status": "error"}), 404
    except Exception as e:
        return jsonify({"error": str(e), "status": "error"}), 500


@app.route('/api/v1/user/profile', methods=['PATCH'])
@require_auth
def update_user_profile():
    """Update user profile."""
    user = get_current_user()
    data = request.get_json()
    
    if not data:
        return jsonify({"error": "Request body required", "status": "error"}), 400
    
    # Allowed fields to update
    allowed_fields = [
        'full_name', 'default_city', 'user_group', 'has_respiratory_condition',
        'push_notifications_enabled', 'email_alerts_enabled', 'alert_threshold_pm25',
        'preferred_language', 'theme', 'units', 'home_lat', 'home_lon'
    ]
    
    update_data = {k: v for k, v in data.items() if k in allowed_fields}
    
    try:
        result = supabase.table("user_profiles").update(update_data).eq("id", user['id']).execute()
        return jsonify({"status": "success", "profile": result.data[0] if result.data else None})
    except Exception as e:
        return jsonify({"error": str(e), "status": "error"}), 500


@app.route('/api/v1/user/locations')
@require_auth
def get_user_locations():
    """Get user's saved locations."""
    user = get_current_user()
    
    try:
        result = supabase.table("user_locations").select("*").eq("user_id", user['id']).execute()
        return jsonify({"status": "success", "locations": result.data})
    except Exception as e:
        return jsonify({"error": str(e), "status": "error"}), 500


@app.route('/api/v1/user/locations', methods=['POST'])
@require_auth
def add_user_location():
    """Add a new saved location."""
    user = get_current_user()
    data = request.get_json()
    
    required = ['name', 'lat', 'lon', 'city']
    if not all(k in data for k in required):
        return jsonify({"error": f"Required fields: {required}", "status": "error"}), 400
    
    location_data = {
        "user_id": user['id'],
        "name": data['name'],
        "lat": data['lat'],
        "lon": data['lon'],
        "city": data['city'],
        "address": data.get('address'),
        "location_type": data.get('location_type', 'custom'),
        "notify_on_poor_aqi": data.get('notify_on_poor_aqi', True)
    }
    
    try:
        result = supabase.table("user_locations").insert(location_data).execute()
        return jsonify({"status": "success", "location": result.data[0]}), 201
    except Exception as e:
        return jsonify({"error": str(e), "status": "error"}), 500


@app.route('/api/v1/user/locations/<location_id>', methods=['DELETE'])
@require_auth
def delete_user_location(location_id: str):
    """Delete a saved location."""
    user = get_current_user()
    
    try:
        supabase.table("user_locations").delete().eq("id", location_id).eq("user_id", user['id']).execute()
        return jsonify({"status": "success", "message": "Location deleted"})
    except Exception as e:
        return jsonify({"error": str(e), "status": "error"}), 500


@app.route('/api/v1/user/alerts')
@require_auth
def get_user_alerts():
    """Get user's alerts."""
    user = get_current_user()
    unread_only = request.args.get('unread', 'false').lower() == 'true'
    
    try:
        query = supabase.table("user_alerts").select("*").eq("user_id", user['id'])
        if unread_only:
            query = query.eq("is_read", False)
        query = query.order("created_at", desc=True).limit(50)
        
        result = query.execute()
        return jsonify({"status": "success", "alerts": result.data})
    except Exception as e:
        return jsonify({"error": str(e), "status": "error"}), 500


@app.route('/api/v1/user/alerts/<alert_id>/read', methods=['PATCH'])
@require_auth
def mark_alert_read(alert_id: str):
    """Mark an alert as read."""
    user = get_current_user()
    
    try:
        from datetime import datetime
        supabase.table("user_alerts").update({
            "is_read": True,
            "read_at": datetime.utcnow().isoformat()
        }).eq("id", alert_id).eq("user_id", user['id']).execute()
        
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e), "status": "error"}), 500


# =============================================================================
# Chat & Conversation Endpoints (Protected)
# =============================================================================

@app.route('/api/v1/chat/conversations')
@require_auth
def get_conversations():
    """Get user's conversations."""
    user = get_current_user()
    
    try:
        result = supabase.table("conversations").select("*").eq("user_id", user['id']).eq("is_archived", False).order("last_message_at", desc=True).execute()
        return jsonify({"status": "success", "conversations": result.data})
    except Exception as e:
        return jsonify({"error": str(e), "status": "error"}), 500


@app.route('/api/v1/chat/conversations', methods=['POST'])
@require_auth
def create_conversation():
    """Create a new conversation."""
    user = get_current_user()
    data = request.get_json() or {}
    
    conv_data = {
        "user_id": user['id'],
        "title": data.get('title', 'New Conversation'),
        "city_context": data.get('city_context')
    }
    
    try:
        result = supabase.table("conversations").insert(conv_data).execute()
        return jsonify({"status": "success", "conversation": result.data[0]}), 201
    except Exception as e:
        return jsonify({"error": str(e), "status": "error"}), 500


@app.route('/api/v1/chat/conversations/<conv_id>/messages')
@require_auth
def get_messages(conv_id: str):
    """Get messages for a conversation."""
    user = get_current_user()
    
    try:
        # Verify ownership
        conv = supabase.table("conversations").select("user_id").eq("id", conv_id).single().execute()
        if not conv.data or conv.data['user_id'] != user['id']:
            return jsonify({"error": "Conversation not found", "status": "error"}), 404
        
        result = supabase.table("messages").select("*").eq("conversation_id", conv_id).order("created_at").execute()
        return jsonify({"status": "success", "messages": result.data})
    except Exception as e:
        return jsonify({"error": str(e), "status": "error"}), 500


@app.route('/api/v1/chat/conversations/<conv_id>/messages', methods=['POST'])
@require_auth
def send_message(conv_id: str):
    """Send a message and get AI response."""
    user = get_current_user()
    data = request.get_json()
    
    if not data or not data.get('content'):
        return jsonify({"error": "Message content required", "status": "error"}), 400
    
    try:
        # Verify ownership
        conv = supabase.table("conversations").select("user_id, city_context").eq("id", conv_id).single().execute()
        if not conv.data or conv.data['user_id'] != user['id']:
            return jsonify({"error": "Conversation not found", "status": "error"}), 404
        
        # Save user message
        user_msg = {
            "conversation_id": conv_id,
            "role": "user",
            "content": data['content']
        }
        supabase.table("messages").insert(user_msg).execute()
        
        # Process with orchestrator
        from backend.app.agents.orchestrator import process_user_request
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            response = loop.run_until_complete(process_user_request(data['content']))
        finally:
            loop.close()
        
        # Save assistant response
        assistant_msg = {
            "conversation_id": conv_id,
            "role": "assistant",
            "content": response
        }
        result = supabase.table("messages").insert(assistant_msg).execute()
        
        # Update conversation last_message_at
        from datetime import datetime
        supabase.table("conversations").update({
            "last_message_at": datetime.utcnow().isoformat()
        }).eq("id", conv_id).execute()
        
        return jsonify({
            "status": "success",
            "message": result.data[0] if result.data else {"role": "assistant", "content": response}
        })
    except Exception as e:
        logger.error(f"Chat error: {e}")
        return jsonify({"error": str(e), "status": "error"}), 500


@app.route('/api/v1/chat/conversations/<conv_id>', methods=['DELETE'])
@require_auth
def delete_conversation(conv_id: str):
    """Delete (archive) a conversation."""
    user = get_current_user()
    
    try:
        supabase.table("conversations").update({"is_archived": True}).eq("id", conv_id).eq("user_id", user['id']).execute()
        return jsonify({"status": "success", "message": "Conversation archived"})
    except Exception as e:
        return jsonify({"error": str(e), "status": "error"}), 500


# =============================================================================
# Main Entry Point
# =============================================================================

if __name__ == '__main__':
    logger.info(f"🚀 Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"📊 Redis URL: {settings.REDIS_URL[:30]}..." if settings.REDIS_URL else "⚠️ Redis not configured")
    logger.info(f"🗄️ Supabase: {'Configured' if supabase else 'Not configured'}")
    
    app.run(debug=settings.DEBUG, port=8000, host='0.0.0.0')
