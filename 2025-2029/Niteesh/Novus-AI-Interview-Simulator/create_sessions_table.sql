-- Run this in Supabase Dashboard → SQL Editor

create table if not exists public.sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  role         text not null,
  overall_score numeric,
  composites   jsonb,
  topic_scores jsonb,
  answers      jsonb,
  created_at   timestamptz default now(),
  activity_type text default 'interview'
);

-- Only the owner can read their own sessions
alter table public.sessions enable row level security;

create policy "Users can read own sessions"
  on public.sessions for select
  using (auth.uid() = user_id);

create policy "Service role can insert"
  on public.sessions for insert
  with check (true);

-- Index for fast per-user history queries
create index on public.sessions (user_id, created_at desc);

-- ============================================================================
-- Student Intelligence Profile View
-- Dynamically aggregates OA and Interview performance to avoid duplicate data
-- ============================================================================
create or replace view public.student_intelligence_profile with (security_invoker = true) as
with user_sessions as (
    select id, user_id, activity_type, overall_score, composites, topic_scores, created_at
    from public.sessions
),
session_conf as (
    select
        s.id,
        avg((a->>'selfReport')::numeric) as session_avg_conf
    from public.sessions s,
    jsonb_array_elements(s.answers) as a
    where a->>'selfReport' is not null
    group by s.id
),
user_sessions_extended as (
    select us.*, sc.session_avg_conf
    from user_sessions us
    left join session_conf sc on us.id = sc.id
),
interview_stats as (
    select
        user_id,
        count(*) as session_count,
        max(created_at) as last_activity,
        avg(overall_score) as avg_interview_score,
        avg((composites->>'correctness')::numeric) as avg_technical,
        avg((composites->>'communication')::numeric) as avg_communication,
        avg((composites->>'composure')::numeric) as avg_composure,
        avg(session_avg_conf) as avg_confidence
    from user_sessions_extended
    where activity_type = 'interview'
    group by user_id
),
oa_stats as (
    select
        user_id,
        avg(overall_score) as avg_oa_score
    from user_sessions
    where activity_type = 'oa'
    group by user_id
),
topic_expansion as (
    select
        user_id,
        key as topic,
        value::numeric as score
    from user_sessions_extended, jsonb_each_text(topic_scores)
    where topic_scores is not null
),
topic_aggs as (
    select user_id, topic, avg(score) as avg_topic_score
    from topic_expansion
    group by user_id, topic
),
ranked_topics as (
    select
        user_id,
        (select jsonb_agg(jsonb_build_object('topic', topic, 'score', avg_topic_score) order by avg_topic_score desc)
         from (select topic, avg_topic_score from topic_aggs t2 where t2.user_id = t1.user_id order by avg_topic_score desc limit 3) top) as strong_topics,
        (select jsonb_agg(jsonb_build_object('topic', topic, 'score', avg_topic_score) order by avg_topic_score asc)
         from (select topic, avg_topic_score from topic_aggs t2 where t2.user_id = t1.user_id order by avg_topic_score asc limit 3) bot) as weak_topics
    from topic_aggs t1
    group by user_id
),
session_trends as (
    select
        user_id,
        jsonb_agg(
            jsonb_build_object(
                'id', id,
                'date', created_at,
                'overall', overall_score,
                'technical', (composites->>'correctness')::numeric,
                'communication', (composites->>'communication')::numeric,
                'composure', (composites->>'composure')::numeric,
                'confidence', coalesce(session_avg_conf, 0)
            ) order by created_at asc
        ) as history_trend
    from user_sessions_extended
    where activity_type = 'interview'
    group by user_id
)
select
    coalesce(i.user_id, o.user_id) as user_id,
    coalesce(i.session_count, 0) as session_count,
    i.last_activity,
    i.avg_interview_score,
    o.avg_oa_score,
    i.avg_technical, i.avg_communication, i.avg_composure, i.avg_confidence,
    case when o.avg_oa_score is null then i.avg_interview_score when i.avg_interview_score is null then o.avg_oa_score else (i.avg_interview_score * 0.7 + o.avg_oa_score * 0.3) end as overall_readiness,
    rt.strong_topics, rt.weak_topics,
    st.history_trend,
    case 
        when st.history_trend is null or jsonb_array_length(st.history_trend) < 2 then 'Stable'
        when (st.history_trend->(jsonb_array_length(st.history_trend)-1)->>'confidence')::numeric > (st.history_trend->(jsonb_array_length(st.history_trend)-2)->>'confidence')::numeric then 'Increasing'
        when (st.history_trend->(jsonb_array_length(st.history_trend)-1)->>'confidence')::numeric < (st.history_trend->(jsonb_array_length(st.history_trend)-2)->>'confidence')::numeric then 'Decreasing'
        else 'Stable'
    end as confidence_trend
from interview_stats i
full outer join oa_stats o on i.user_id = o.user_id
left join ranked_topics rt on i.user_id = rt.user_id
left join session_trends st on i.user_id = st.user_id;
