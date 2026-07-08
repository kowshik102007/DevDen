# Novus AI — Interview Simulator

A client-side, AI-powered mock interview web app. Users log in, pick a role, answer
spoken questions from a topic-tagged bank, and receive a scored report. All face
processing runs **on-device** in the browser — video never leaves the machine.

## What it does

1. Log in (Supabase auth) and choose a **role**: SWE / Data / Frontend / Behavioral.
2. The app asks questions from a fixed, topic-tagged bank for that role.
3. Each spoken answer is scored on three composites:
   - **Correctness** — LLM rubric (via a server-side Gemini proxy)
   - **Communication** — objective delivery metrics (WPM, fillers, length, latency)
   - **Composure** — face/timing proxies (focus %, tension proxy)
4. A one-tap **self-report (1–5 confidence)** is collected after each answer.
5. The engine adaptively asks more questions on the user's **weakest topic**.
6. A **report view** shows overall score, a Chart.js radar of the 3 composites,
   per-topic bars, and a per-question breakdown.
7. Sessions are saved to Supabase for per-user history.

## Tech stack

- Vanilla JS (ES modules), HTML, CSS — no build step
- Supabase (auth, Postgres, Edge Functions)
- Google Gemini (via a Supabase Edge Function proxy, key held server-side)
- TensorFlow.js — in-browser facial-expression model (FER-2013 + MobileNetV2)
- MediaPipe Tasks Vision — face landmarks / attention tracking
- Chart.js — report visualizations

## Project structure

```
├── index.html                   App shell + all views
├── styles.css                   Dark theme, report view, overlays
├── app.js                       Main logic
├── scoring.js                   Weighted scoring engine
├── fer.js                       In-browser facial-expression inference
├── create_sessions_table.sql    One-time Supabase schema + RLS
├── fer_cnn_train.ipynb          Colab notebook that trains the FER model
├── models/fer_tfjs/             Exported TF.js model (model.json + .bin + class_names)
└── supabase/functions/
    └── gemini-proxy/index.ts    Edge Function (Gemini proxy + session save)
```

## Running locally

Must be served over HTTP (ES modules + camera/mic won't work from `file://`):

```bash
python -m http.server
# open http://localhost:8000
```

Use Chrome or Edge (speech recognition uses `webkitSpeechRecognition`).

## Configuration / keys

- The **Supabase anon key** in `app.js` is the public key and is safe to expose,
  as long as Row Level Security is enabled on every table (it is, via
  `create_sessions_table.sql`).
- The **Gemini API key** and **Supabase service-role key** are **not** in this
  repo. They live server-side as Edge Function secrets and must be set in the
  Supabase dashboard.
- `PIPER_TTS_URL` / `PIPER_TTS_KEY` in `app.js` are placeholders for an optional
  self-hosted TTS service; fill them in only if you deploy one.

## A note on honesty (facial expressions ≠ emotions)

The CNN classifies **facial expressions**, not emotions. Its output feeds a
clearly-labelled **"Composure (proxy)"**, never a raw "anxiety" number. Expected
accuracy is ~58–65% on FER-2013 (roughly human agreement level). Treat any
composure figure as an estimate. The 1–5 self-reports are the real labels for
training a proper fusion model later.

## Status

Working: scoring engine, question banks, self-report, report view, session
storage, Gemini proxy. See the project handoff notes for open items (auth
edge cases, FER model loading, and secret rotation before any public use).
