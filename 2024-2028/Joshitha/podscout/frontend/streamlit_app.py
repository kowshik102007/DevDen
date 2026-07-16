
import streamlit as st
import pandas as pd
import pydeck as pdk
import requests
import json
import os
import sys

# Add backend to path for direct imports if needed (or use HTTP)
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Backend API URL
API_URL = os.getenv("BACKEND_URL", "http://localhost:8000")

st.set_page_config(layout="wide", page_title="PodScout AI Command Center")

# =============================================================================
# Session State Initialization
# =============================================================================

if "authenticated" not in st.session_state:
    st.session_state.authenticated = False
if "user" not in st.session_state:
    st.session_state.user = None
if "access_token" not in st.session_state:
    st.session_state.access_token = None
if "refresh_token" not in st.session_state:
    st.session_state.refresh_token = None
if "messages" not in st.session_state:
    st.session_state.messages = []


# =============================================================================
# Authentication Functions
# =============================================================================

def login(email: str, password: str) -> bool:
    """Authenticate user with email and password."""
    try:
        response = requests.post(
            f"{API_URL}/api/v1/auth/login",
            json={"email": email, "password": password},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "success":
                st.session_state.authenticated = True
                st.session_state.user = data.get("user")
                st.session_state.access_token = data.get("session", {}).get("access_token")
                st.session_state.refresh_token = data.get("session", {}).get("refresh_token")
                return True
        
        st.error(response.json().get("error", "Login failed"))
        return False
        
    except requests.exceptions.RequestException as e:
        st.error(f"Connection error: {e}")
        return False


def signup(email: str, password: str, name: str = None) -> bool:
    """Register a new user."""
    try:
        payload = {"email": email, "password": password}
        if name:
            payload["name"] = name
            
        response = requests.post(
            f"{API_URL}/api/v1/auth/signup",
            json=payload,
            timeout=10
        )
        
        if response.status_code == 201:
            data = response.json()
            if data.get("status") == "success":
                st.success("Account created! Please check your email to confirm, then login.")
                return True
        
        st.error(response.json().get("error", "Signup failed"))
        return False
        
    except requests.exceptions.RequestException as e:
        st.error(f"Connection error: {e}")
        return False


def logout():
    """Sign out the current user."""
    try:
        requests.post(f"{API_URL}/api/v1/auth/logout", timeout=5)
    except:
        pass
    
    st.session_state.authenticated = False
    st.session_state.user = None
    st.session_state.access_token = None
    st.session_state.refresh_token = None
    st.rerun()


# =============================================================================
# Sidebar - Authentication & Configuration
# =============================================================================

with st.sidebar:
    st.title("🌍 PodScout Pro")
    
    # Authentication Section
    if not st.session_state.authenticated:
        st.header("🔐 Authentication")
        
        auth_tab = st.radio("", ["Login", "Sign Up"], horizontal=True, label_visibility="collapsed")
        
        if auth_tab == "Login":
            with st.form("login_form"):
                email = st.text_input("Email", placeholder="you@example.com")
                password = st.text_input("Password", type="password")
                submitted = st.form_submit_button("Login", use_container_width=True)
                
                if submitted and email and password:
                    if login(email, password):
                        st.rerun()
        else:
            with st.form("signup_form"):
                name = st.text_input("Name (optional)", placeholder="Your name")
                email = st.text_input("Email", placeholder="you@example.com")
                password = st.text_input("Password", type="password", help="Min 6 characters")
                confirm = st.text_input("Confirm Password", type="password")
                submitted = st.form_submit_button("Create Account", use_container_width=True)
                
                if submitted:
                    if not email or not password:
                        st.error("Email and password required")
                    elif len(password) < 6:
                        st.error("Password must be at least 6 characters")
                    elif password != confirm:
                        st.error("Passwords don't match")
                    else:
                        signup(email, password, name)
        
        st.divider()
        st.caption("🔑 OAuth Login")
        if st.button("Continue with Google", use_container_width=True):
            try:
                response = requests.get(f"{API_URL}/api/v1/auth/oauth/google", timeout=5)
                if response.status_code == 200:
                    oauth_url = response.json().get("url")
                    if oauth_url:
                        st.markdown(f"[Click here to authenticate with Google]({oauth_url})")
            except:
                st.error("Could not connect to authentication service")
    
    else:
        # User is authenticated
        user = st.session_state.user or {}
        st.success(f"✅ Logged in as {user.get('email', 'User')}")
        
        if st.button("Logout", use_container_width=True):
            logout()
        
        st.divider()
        
        # Configuration Section
        st.header("⚙️ Configuration")
        city = st.selectbox("Select City", ["Greater Noida", "Delhi", "Mumbai", "Bangalore", "Chennai"])
        show_nodes = st.checkbox("Show Grid Nodes", True)
        show_predictions = st.checkbox("Show ML Predictions", False)
        
        st.divider()
        
        # System Status
        st.header("📊 System Status")
        try:
            health = requests.get(f"{API_URL}/health", timeout=5)
            if health.status_code == 200:
                st.success("Backend: Online ✅")
            else:
                st.warning("Backend: Degraded ⚠️")
        except:
            st.error("Backend: Offline ❌")


# =============================================================================
# Main Content - Requires Authentication
# =============================================================================

st.title("🌍 PodScout AI: Urban Pollution Intelligence")

if not st.session_state.authenticated:
    st.info("👋 Please login or create an account to access PodScout features.")
    
    # Show demo/public information
    st.markdown("""
    ## Features
    
    - 🛰️ **Satellite Data Integration** - Sentinel-5P NO2/SO2, Landsat LST
    - 🌍 **Ground Sensor Network** - CPCB, OpenAQ real-time data
    - 🧠 **ML Predictions** - Bayesian ST-GNN for PM2.5 forecasting
    - 💡 **Smart Recommendations** - Personalized health advice
    - 🗺️ **Spatial Intelligence** - Grid-based pollution mapping
    
    ### Sign up to get started!
    """)
    
else:
    # Authenticated user experience
    city = st.session_state.get('city', 'Greater Noida')
    
    # Main Area
    col1, col2 = st.columns([2, 1])
    
    with col1:
        st.subheader("🗺️ Real-Time Spatial Intelligence")
        
        # Placeholder for Map Layers
        layers = []
        
        # 1. Fetch Grid Data
        try:
            from backend.app.services.supabase import get_supabase
            supabase = get_supabase()
            response = supabase.table("grid_cells").select("*").eq("city", city).execute()
            df = pd.DataFrame(response.data)
            
            if not df.empty:
                # Color based on Pollution (NO2 or PM2.5)
                df['color_r'] = df['avg_no2'].apply(lambda x: min(255, int((x / 0.0005) * 255)) if x else 0)
                df['color_g'] = df['avg_no2'].apply(lambda x: min(255, int((1 - (x / 0.0005)) * 255)) if x else 255)
                
                # Layer 1: Grid Cells (Scatterplot)
                layer = pdk.Layer(
                    "ScatterplotLayer",
                    df,
                    get_position=["center_lon", "center_lat"],
                    get_color=["color_r", "color_g", 0, 140],
                    get_radius=200,
                    pickable=True,
                    auto_highlight=True
                )
                layers.append(layer)
                
                # Map View
                view_state = pdk.ViewState(
                    latitude=df['center_lat'].mean(),
                    longitude=df['center_lon'].mean(),
                    zoom=11,
                    pitch=45
                )
                
                st.pydeck_chart(pdk.Deck(
                    map_style="mapbox://styles/mapbox/dark-v9",
                    initial_view_state=view_state,
                    layers=layers,
                    tooltip={"html": "<b>ID:</b> {gnn_node_id}<br><b>NO2:</b> {avg_no2}<br><b>Temp:</b> {avg_temperature}°C"}
                ))
                
                # Metrics row
                met_col1, met_col2, met_col3 = st.columns(3)
                with met_col1:
                    st.metric("Active Sensors", len(df))
                with met_col2:
                    st.metric("Avg NO2 Level", f"{df['avg_no2'].mean():.6f}")
                with met_col3:
                    avg_pm25 = df['avg_pm25'].mean() if 'avg_pm25' in df.columns and not df['avg_pm25'].isna().all() else 0
                    st.metric("Avg PM2.5", f"{avg_pm25:.1f} µg/m³")
            else:
                st.info(f"No grid data available for {city}. Trigger ingestion to populate data.")

        except Exception as e:
            st.error(f"Failed to load map data: {e}")
    
    with col2:
        st.subheader("🤖 AI Orchestrator")
        
        # Chat Interface
        for message in st.session_state.messages:
            with st.chat_message(message["role"]):
                st.markdown(message["content"])
        
        if prompt := st.chat_input("Ask PodScout (e.g. 'Predict pollution for tomorrow')"):
            st.session_state.messages.append({"role": "user", "content": prompt})
            with st.chat_message("user"):
                st.markdown(prompt)
            
            with st.chat_message("assistant"):
                message_placeholder = st.empty()
                message_placeholder.markdown("🔄 Analyzing...")
                
                # Call Swarm Orchestrator
                try:
                    import asyncio
                    from backend.app.agents.orchestrator import process_user_request
                    
                    # Async call in Streamlit
                    response = asyncio.run(process_user_request(prompt))
                except Exception as e:
                    import traceback
                    response = f"❌ Error: {e}\n\n```\n{traceback.format_exc()}\n```"
                
                message_placeholder.markdown(response)
                st.session_state.messages.append({"role": "assistant", "content": response})
        
        # Quick Actions
        st.divider()
        st.caption("⚡ Quick Actions")
        
        quick_col1, quick_col2 = st.columns(2)
        with quick_col1:
            if st.button("📊 Get Recommendations", use_container_width=True):
                st.session_state.messages.append({"role": "user", "content": f"Recommend for {city}"})
                st.rerun()
        
        with quick_col2:
            if st.button("🔥 Find Hotspots", use_container_width=True):
                st.session_state.messages.append({"role": "user", "content": f"Hotspots in {city}"})
                st.rerun()

