// @ts-nocheck
// (ts-nocheck silences VS Code Node.js workspace errors for valid Deno imports)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const { action, payload, userToken } = await req.json();

    // ── 1. GEMINI PROXY ──────────────────────────────────────────────────────
    if (action === "gemini") {
      const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
      if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY not set in Edge Function secrets.");

      const { model, prompt } = payload;
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${GEMINI_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );

      const geminiData = await geminiRes.json();

      // Forward status + body as-is so client fallback logic still works
      return new Response(JSON.stringify(geminiData), {
        status: geminiRes.status,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // ── 1.5 DISCOVER MODELS ──────────────────────────────────────────────────
    if (action === "discover_models") {
      const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
      if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY not set in Edge Function secrets.");

      const listRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_KEY}`,
        { method: "GET" }
      );

      const listData = await listRes.json();
      return new Response(JSON.stringify(listData), {
        status: listRes.status,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // ── 2. SAVE SESSION ───────────────────────────────────────────────────────
    if (action === "save_session") {
      // Verify the user JWT so we know who this belongs to
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      // Decode user from their access token
      const { data: { user }, error: authError } = await supabase.auth.getUser(userToken);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...CORS, "Content-Type": "application/json" },
        });
      }

      const { role, overall, composites, topic_scores, answers, activity_type } = payload;

      const { error: dbError } = await supabase.from("sessions").insert({
        user_id: user.id,
        role,
        overall_score: overall,
        composites,
        topic_scores,
        answers, // full array with transcripts + self-reports
        activity_type: activity_type || 'interview',
        created_at: new Date().toISOString(),
      });

      if (dbError) throw dbError;

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
