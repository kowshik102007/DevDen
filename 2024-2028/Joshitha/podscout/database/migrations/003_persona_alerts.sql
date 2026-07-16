-- ============================================================================
-- Migration 003: Persona-Based Alert System
-- ============================================================================
-- Extends user_profiles with persona + locality context.
-- Adds alert_subscriptions and alert_deliveries tables.
-- Run once on the Supabase SQL editor.
-- ============================================================================

-- ============================================================================
-- 1. Extend user_profiles with persona fields
-- ============================================================================
ALTER TABLE user_profiles
  -- Which persona this user belongs to
  ADD COLUMN IF NOT EXISTS persona TEXT DEFAULT 'individual'
    CHECK (persona IN ('individual', 'community', 'municipality')),

  -- Free-text locality label (ward/neighbourhood/city-zone)
  ADD COLUMN IF NOT EXISTS locality TEXT,

  -- Radius used to aggregate nearby monitoring sites
  ADD COLUMN IF NOT EXISTS locality_radius_km FLOAT DEFAULT 2.0,

  -- Notification channels enabled for this user
  -- e.g. {"email": true, "sms": false, "whatsapp": true, "webhook": false}
  ADD COLUMN IF NOT EXISTS notification_channels JSONB
    DEFAULT '{"email": true, "sms": false, "whatsapp": false, "webhook": false}'::jsonb,

  -- Persona-specific metadata blob
  -- individual:   {"health_conditions": ["asthma"], "children_present": true, "outdoor_job": false}
  -- community:    {"org_name": "ITO RWA", "member_count": 450, "has_school": true, "meeting_day": "Sunday"}
  -- municipality: {"ward_id": "W-07", "ward_name": "ITO Ward", "population": 85000,
  --               "num_sensors": 12, "budget_crore": 4.5}
  ADD COLUMN IF NOT EXISTS persona_meta JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN user_profiles.persona IS
  'User persona: individual | community | municipality';
COMMENT ON COLUMN user_profiles.locality IS
  'Human-readable locality label: neighbourhood, ward, or city zone';
COMMENT ON COLUMN user_profiles.persona_meta IS
  'Persona-specific structured metadata (health, org, or ward info)';

-- ============================================================================
-- 2. Alert Subscriptions — configurable trigger rules per user
-- ============================================================================
CREATE TABLE IF NOT EXISTS alert_subscriptions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

  -- What triggers this alert
  -- 'threshold_breach' | 'daily_summary' | 'weekly_plan'
  -- | 'weekly_digest' | 'monthly_health_plan'
  -- | 'ward_critical' | 'city_dashboard' | 'weekly_policy_brief' | 'monthly_regulatory'
  trigger         TEXT NOT NULL,

  -- Trigger-specific config
  -- threshold_breach: {"pm25_warn": 60, "pm25_critical": 150}
  -- daily_summary:    {"hour_utc": 2}     (2:30 UTC = 8:00 IST)
  -- weekly_plan:      {"day_of_week": 0}  (0 = Monday)
  -- monthly_*:        {"day_of_month": 1}
  trigger_config  JSONB DEFAULT '{}'::jsonb,

  -- Which channels to use for this subscription
  channels        TEXT[] DEFAULT ARRAY['email'],

  active          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS alert_subs_user_idx
  ON alert_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS alert_subs_active_trigger_idx
  ON alert_subscriptions(trigger) WHERE active = TRUE;

-- ============================================================================
-- 3. Alert Deliveries — history of every alert sent
-- ============================================================================
CREATE TABLE IF NOT EXISTS alert_deliveries (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  sub_id        UUID REFERENCES alert_subscriptions(id) ON DELETE SET NULL,

  -- Classification
  persona       TEXT NOT NULL,
  alert_type    TEXT NOT NULL,
  channel       TEXT NOT NULL,   -- 'log' | 'email' | 'sms' | 'whatsapp' | 'webhook'

  -- Content
  subject       TEXT,
  content_md    TEXT,            -- Full Markdown content sent to user
  content_json  JSONB,           -- Structured data (locality stats, thresholds, etc.)

  -- Context at time of send
  locality      TEXT,
  city          TEXT,
  pm25_at_send  FLOAT,
  severity      TEXT,            -- 'good' | 'moderate' | 'poor' | 'very_poor' | 'severe'

  -- Delivery status
  status        TEXT DEFAULT 'sent'
    CHECK (status IN ('sent', 'failed', 'pending')),
  error_msg     TEXT,

  sent_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS alert_del_user_time_idx
  ON alert_deliveries(user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS alert_del_type_idx
  ON alert_deliveries(alert_type, sent_at DESC);
CREATE INDEX IF NOT EXISTS alert_del_city_idx
  ON alert_deliveries(city, sent_at DESC);

-- ============================================================================
-- 4. Default subscriptions for existing users (backfill)
-- ============================================================================
-- Give every existing user a daily_summary and threshold_breach subscription
INSERT INTO alert_subscriptions (user_id, trigger, trigger_config, channels)
SELECT
  id,
  'threshold_breach',
  json_build_object('pm25_warn', COALESCE(alert_threshold_pm25, 100), 'pm25_critical', 150)::jsonb,
  ARRAY['email']
FROM user_profiles
WHERE NOT EXISTS (
  SELECT 1 FROM alert_subscriptions s
  WHERE s.user_id = user_profiles.id AND s.trigger = 'threshold_breach'
)
ON CONFLICT DO NOTHING;

INSERT INTO alert_subscriptions (user_id, trigger, trigger_config, channels)
SELECT
  id,
  'daily_summary',
  '{"hour_utc": 2}'::jsonb,
  ARRAY['email']
FROM user_profiles
WHERE NOT EXISTS (
  SELECT 1 FROM alert_subscriptions s
  WHERE s.user_id = user_profiles.id AND s.trigger = 'daily_summary'
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 5. RLS (Row Level Security) — users can only see their own data
-- ============================================================================
ALTER TABLE alert_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_deliveries    ENABLE ROW LEVEL SECURITY;

-- Users manage their own subscriptions
CREATE POLICY alert_subscriptions_self ON alert_subscriptions
  USING (user_id = auth.uid());

-- Users read their own delivery history
CREATE POLICY alert_deliveries_read ON alert_deliveries
  FOR SELECT USING (user_id = auth.uid());

-- Service role can write deliveries (needed by backend)
CREATE POLICY alert_deliveries_service_write ON alert_deliveries
  FOR INSERT WITH CHECK (true);  -- restricted by service_role key in backend
