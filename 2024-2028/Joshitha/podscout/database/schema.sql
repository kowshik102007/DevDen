-- ============================================================================
-- PodScout Pro - Complete Database Schema
-- ============================================================================
-- Supabase PostgreSQL with PostGIS extension
-- Last Updated: 2026-01-15
-- ============================================================================
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- ============================================================================
-- USER PROFILES TABLE (extends Supabase auth.users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    -- Location preferences
    default_city TEXT DEFAULT 'Delhi',
    home_location GEOGRAPHY(POINT, 4326),
    home_lat DOUBLE PRECISION,
    home_lon DOUBLE PRECISION,
    -- Health profile (for personalized recommendations)
    user_group TEXT DEFAULT 'general',
    -- 'general', 'children', 'elderly', 'respiratory', 'pregnant'
    has_respiratory_condition BOOLEAN DEFAULT FALSE,
    -- Notification preferences
    push_notifications_enabled BOOLEAN DEFAULT TRUE,
    email_alerts_enabled BOOLEAN DEFAULT TRUE,
    alert_threshold_pm25 DOUBLE PRECISION DEFAULT 100.0,
    -- App settings
    preferred_language TEXT DEFAULT 'en',
    theme TEXT DEFAULT 'dark',
    -- 'light', 'dark', 'system'
    units TEXT DEFAULT 'metric',
    -- 'metric', 'imperial'
    -- Metadata
    role TEXT DEFAULT 'user',
    -- 'user', 'admin'
    is_active BOOLEAN DEFAULT TRUE,
    last_active_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS user_profiles_city_idx ON user_profiles(default_city);
CREATE INDEX IF NOT EXISTS user_profiles_role_idx ON user_profiles(role);
-- ============================================================================
-- CONVERSATIONS TABLE (Chat History)
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    -- Conversation metadata
    title TEXT DEFAULT 'New Conversation',
    city_context TEXT,
    -- City this conversation is about
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_archived BOOLEAN DEFAULT FALSE,
    -- Timestamps
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS conversations_user_idx ON conversations(user_id);
CREATE INDEX IF NOT EXISTS conversations_active_idx ON conversations(user_id, is_active, last_message_at DESC);
-- ============================================================================
-- MESSAGES TABLE (Individual Chat Messages)
-- ============================================================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    -- Message content
    role TEXT NOT NULL,
    -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,
    -- Metadata from AI processing
    intent TEXT,
    -- 'analyze', 'recommend', 'hotspots', 'general'
    city_mentioned TEXT,
    -- If assistant message, store structured data
    prediction_data JSONB,
    -- Store ML predictions
    recommendation_data JSONB,
    -- Store recommendations
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages(conversation_id, created_at);
-- ============================================================================
-- USER SAVED LOCATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    -- Location details
    name TEXT NOT NULL,
    -- 'Home', 'Office', 'School'
    location GEOGRAPHY(POINT, 4326),
    lat DOUBLE PRECISION NOT NULL,
    lon DOUBLE PRECISION NOT NULL,
    city TEXT NOT NULL,
    address TEXT,
    -- Type
    location_type TEXT DEFAULT 'custom',
    -- 'home', 'work', 'school', 'custom'
    is_primary BOOLEAN DEFAULT FALSE,
    -- Alert settings for this location
    notify_on_poor_aqi BOOLEAN DEFAULT TRUE,
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS user_locations_user_idx ON user_locations(user_id);
CREATE INDEX IF NOT EXISTS user_locations_geom_idx ON user_locations USING GIST (location);
-- ============================================================================
-- USER ALERTS TABLE (Alert History)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    -- Alert details
    alert_type TEXT NOT NULL,
    -- 'aqi_threshold', 'hotspot_detected', 'health_advisory'
    severity TEXT NOT NULL,
    -- 'low', 'moderate', 'high', 'critical'
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    -- Location context
    city TEXT,
    location_id UUID REFERENCES user_locations(id),
    -- AQI data at time of alert
    pm25_value DOUBLE PRECISION,
    aqi_category TEXT,
    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    is_dismissed BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS user_alerts_user_idx ON user_alerts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_alerts_unread_idx ON user_alerts(user_id, is_read)
WHERE NOT is_read;
-- ============================================================================
-- MONITORING SITES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS monitoring_sites (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    country TEXT DEFAULT 'India',
    location GEOGRAPHY(POINT, 4326),
    lat DOUBLE PRECISION NOT NULL,
    lon DOUBLE PRECISION NOT NULL,
    -- Current measurements
    pm25 DOUBLE PRECISION,
    pm10 DOUBLE PRECISION,
    so2 DOUBLE PRECISION,
    no2 DOUBLE PRECISION,
    co DOUBLE PRECISION,
    o3 DOUBLE PRECISION,
    temperature DOUBLE PRECISION,
    humidity DOUBLE PRECISION,
    wind_speed DOUBLE PRECISION,
    wind_direction DOUBLE PRECISION,
    -- Metadata
    source TEXT,
    -- 'cpcb', 'openaq', 'sentinel5p', 'landsat'
    data_provider TEXT,
    active BOOLEAN DEFAULT TRUE,
    population_density INTEGER,
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS monitoring_sites_location_idx ON monitoring_sites USING GIST (location);
CREATE INDEX IF NOT EXISTS monitoring_sites_city_idx ON monitoring_sites(city);
CREATE INDEX IF NOT EXISTS monitoring_sites_pm25_idx ON monitoring_sites(pm25 DESC NULLS LAST);
-- ============================================================================
-- MEASUREMENTS TABLE (Historical Time-Series)
-- ============================================================================
CREATE TABLE IF NOT EXISTS measurements (
    id SERIAL PRIMARY KEY,
    site_id TEXT NOT NULL REFERENCES monitoring_sites(id) ON DELETE CASCADE,
    -- Measurements
    pm25 DOUBLE PRECISION,
    pm10 DOUBLE PRECISION,
    so2 DOUBLE PRECISION,
    no2 DOUBLE PRECISION,
    co DOUBLE PRECISION,
    o3 DOUBLE PRECISION,
    temperature DOUBLE PRECISION,
    humidity DOUBLE PRECISION,
    wind_speed DOUBLE PRECISION,
    lst DOUBLE PRECISION,
    -- Land Surface Temperature from Landsat
    -- Metadata
    source TEXT,
    quality_flag TEXT,
    -- Timestamp
    measured_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS measurements_site_time_idx ON measurements(site_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS measurements_time_idx ON measurements(measured_at DESC);
-- ============================================================================
-- GRID CELLS TABLE (Spatial Grid for ML)
-- ============================================================================
CREATE TABLE IF NOT EXISTS grid_cells (
    id TEXT PRIMARY KEY,
    -- Grid geometry
    cell_geom GEOGRAPHY(POLYGON, 4326),
    center_lat DOUBLE PRECISION NOT NULL,
    center_lon DOUBLE PRECISION NOT NULL,
    cell_size_meters INTEGER NOT NULL,
    -- Grid metadata
    city TEXT NOT NULL,
    grid_level INTEGER DEFAULT 1,
    -- 1=urban (500m), 2=suburban (1km), 3=rural (2km)
    gnn_node_id INTEGER,
    -- Node ID for ML graph
    -- Aggregated pollution data
    avg_pm25 DOUBLE PRECISION,
    avg_pm10 DOUBLE PRECISION,
    avg_no2 DOUBLE PRECISION,
    avg_so2 DOUBLE PRECISION,
    avg_co DOUBLE PRECISION,
    avg_o3 DOUBLE PRECISION,
    avg_temperature DOUBLE PRECISION,
    avg_lst DOUBLE PRECISION,
    -- Contextual features
    population_density INTEGER,
    land_use_type TEXT,
    -- 'residential', 'industrial', 'commercial', 'green'
    road_density DOUBLE PRECISION,
    -- Full feature vector for ML
    features JSONB,
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS grid_cells_geom_idx ON grid_cells USING GIST (cell_geom);
CREATE INDEX IF NOT EXISTS grid_cells_city_idx ON grid_cells(city);
CREATE INDEX IF NOT EXISTS grid_cells_node_idx ON grid_cells(gnn_node_id);
-- ============================================================================
-- PREDICTIONS TABLE (ML Prediction History)
-- ============================================================================
CREATE TABLE IF NOT EXISTS predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Location reference
    grid_cell_id TEXT REFERENCES grid_cells(id),
    city TEXT NOT NULL,
    -- Prediction data
    predicted_pm25 DOUBLE PRECISION NOT NULL,
    uncertainty DOUBLE PRECISION,
    aqi_category TEXT,
    confidence_level TEXT,
    -- 'very_high', 'high', 'moderate', 'low'
    -- Forecast metadata
    forecast_horizon_hours INTEGER DEFAULT 24,
    model_version TEXT DEFAULT 'bayesian-st-gnn-v1',
    -- Timestamps
    predicted_for TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS predictions_city_time_idx ON predictions(city, predicted_for DESC);
CREATE INDEX IF NOT EXISTS predictions_cell_idx ON predictions(grid_cell_id, predicted_for DESC);
-- ============================================================================
-- SITE ANALYSES TABLE (AI Analyses)
-- ============================================================================
CREATE TABLE IF NOT EXISTS site_analyses (
    id SERIAL PRIMARY KEY,
    site_id TEXT NOT NULL REFERENCES monitoring_sites(id) ON DELETE CASCADE,
    -- Input data
    pm25 DOUBLE PRECISION NOT NULL,
    temperature DOUBLE PRECISION,
    -- AI Analysis results
    analysis JSONB NOT NULL,
    severity TEXT,
    priority_score INTEGER,
    health_impact TEXT,
    recommendations TEXT,
    -- Metadata
    llm_provider TEXT,
    -- Timestamps
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS site_analyses_site_idx ON site_analyses(site_id);
CREATE INDEX IF NOT EXISTS site_analyses_time_idx ON site_analyses(timestamp DESC);
-- ============================================================================
-- AUTO-UPDATE TRIGGER FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Create triggers for tables with updated_at
CREATE TRIGGER update_user_profiles_updated_at BEFORE
UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_monitoring_sites_updated_at BEFORE
UPDATE ON monitoring_sites FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_grid_cells_updated_at BEFORE
UPDATE ON grid_cells FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- Enable RLS on user tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_alerts ENABLE ROW LEVEL SECURITY;
-- User Profiles: Users can only see/edit their own profile
CREATE POLICY "Users can view own profile" ON user_profiles FOR
SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR
UPDATE USING (auth.uid() = id);
-- Conversations: Users can only access their own conversations
CREATE POLICY "Users can view own conversations" ON conversations FOR
SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own conversations" ON conversations FOR
INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own conversations" ON conversations FOR
UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own conversations" ON conversations FOR DELETE USING (auth.uid() = user_id);
-- Messages: Access via conversation ownership
CREATE POLICY "Users can view messages in own conversations" ON messages FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM conversations
            WHERE conversations.id = messages.conversation_id
                AND conversations.user_id = auth.uid()
        )
    );
CREATE POLICY "Users can create messages in own conversations" ON messages FOR
INSERT WITH CHECK (
        EXISTS (
            SELECT 1
            FROM conversations
            WHERE conversations.id = messages.conversation_id
                AND conversations.user_id = auth.uid()
        )
    );
-- User Locations: Users can only access their own locations
CREATE POLICY "Users can manage own locations" ON user_locations FOR ALL USING (auth.uid() = user_id);
-- User Alerts: Users can only access their own alerts
CREATE POLICY "Users can view own alerts" ON user_alerts FOR
SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own alerts" ON user_alerts FOR
UPDATE USING (auth.uid() = user_id);
-- ============================================================================
-- FUNCTION: Create user profile on signup
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$ BEGIN
INSERT INTO public.user_profiles (id, email, full_name)
VALUES (
        NEW.id,
        NEW.email,
        COALESCE(
            NEW.raw_user_meta_data->>'name',
            NEW.raw_user_meta_data->>'full_name',
            ''
        )
    );
RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
AFTER
INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
-- ============================================================================
-- VIEWS
-- ============================================================================
-- Active conversations with message count
CREATE OR REPLACE VIEW user_conversations_summary AS
SELECT c.id,
    c.user_id,
    c.title,
    c.city_context,
    c.started_at,
    c.last_message_at,
    COUNT(m.id) as message_count,
    (
        SELECT content
        FROM messages
        WHERE conversation_id = c.id
        ORDER BY created_at DESC
        LIMIT 1
    ) as last_message
FROM conversations c
    LEFT JOIN messages m ON m.conversation_id = c.id
WHERE c.is_active = TRUE
    AND c.is_archived = FALSE
GROUP BY c.id;
-- City pollution summary
CREATE OR REPLACE VIEW city_pollution_summary AS
SELECT city,
    COUNT(*) as total_cells,
    ROUND(AVG(avg_pm25)::numeric, 1) as avg_pm25,
    ROUND(MAX(avg_pm25)::numeric, 1) as max_pm25,
    ROUND(MIN(avg_pm25)::numeric, 1) as min_pm25,
    COUNT(*) FILTER (
        WHERE avg_pm25 > 100
    ) as hotspot_count,
    MAX(updated_at) as last_updated
FROM grid_cells
WHERE avg_pm25 IS NOT NULL
GROUP BY city;