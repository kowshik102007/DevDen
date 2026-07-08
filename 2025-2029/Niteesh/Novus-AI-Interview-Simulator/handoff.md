# Novus AI — Interview Simulator — Handoff (Updated)

Continuation doc for a teammate picking up the project. Covers what the product
is, the current state after the latest work session, what's working, what's
half-done, the exact open bugs, and the next steps in priority order.

---

## 1. What the project is

**Novus AI** is a client-side, AI-powered mock interview web app. The loop:

1. User logs in (Supabase auth) and picks a **role** (SWE / Data / Frontend / Behavioral).
2. The app asks questions from a **fixed, topic-tagged bank** for that role.
3. Each spoken answer is scored on three composites — **Correctness** (LLM rubric),
   **Communication** (delivery metrics), **Composure** (face/timing proxies).
4. A **one-tap self-report (1–5 confidence)** is collected after each answer.
5. The engine adaptively asks more questions on the **weakest topic**.
6. A **report view** shows overall score, a Chart.js radar of the 3 composites,
   per-topic bars, and a per-question breakdown.
7. Session results are **saved to Supabase** (per-user history).

Supporting modules (older, still present): AI study guides (DSA / System Design /
STAR), replicated OAs with a live Python runner (Piston API), and webcam
attention tracking (MediaPipe).

**Privacy angle (a selling point):** all face processing runs **on-device** in
the browser. Video never leaves the machine.

---

## 2. File inventory (current state)

Project folder (Windows, OneDrive-synced):
`C:\Users\rahul\OneDrive\Desktop\interview\`

```
interview/
├── index.html          Working — shell, all views, loads Chart.js + Supabase
├── styles.css          Working — dark theme + report view + self-report overlay
├── app.js              Working — main logic (see below)
├── scoring.js          Working — weighted scoring engine, fully integrated
├── fer.js              NEW — in-browser facial-expression inference (see bug #2)
├── create_sessions_table.sql   One-time SQL, already run in Supabase
├── fer_cnn_train.ipynb Colab notebook — trains the FER CNN (already run once)
├── models/
│   └── fer_tfjs/       The exported TF.js model (model.json + 3 .bin + class_names)
└── supabase/
    └── functions/
        └── gemini-proxy/
            └── index.ts   Edge Function source (already deployed to Supabase)
```

---

## 3. How to run it

- **Must be served over HTTP**, not `file://` (ES modules + camera/mic need it).
  In the `interview` folder address bar type `cmd`, then:
  `python -m http.server`  → open `http://localhost:8000`
- **Browser:** Chrome or Edge (speech uses `webkitSpeechRecognition`).
- **Login:** Supabase auth. Any email + 6+ char password auto-creates an account.
  "Confirm email" is OFF in Supabase Auth settings (already done).

---

## 4. What got DONE this session

1. **scoring.js fully integrated** into app.js. All raw metrics captured live:
   WPM, word count, filler rate, response latency, focus %, and (when the FER
   model loads) a tension proxy.
2. **Question bank expanded** from 2 roles to 4 real banks:
   `TECHNICAL` (SWE), `DATA`, `FRONTEND`, `HR` (behavioral) — 10 questions each,
   properly topic-tagged so the adaptive weak-topic selector works.
   `ROLE_OPTIONS` maps data→DATA and frontend→FRONTEND.
3. **Self-report (1–5 confidence)** overlay added after each answer. Stored on
   each answer object as `selfReport`. This starts the labelled dataset.
4. **Dedicated report view** (`view-report`) built with a Chart.js radar of the
   three composites, weakest-first topic bars, and per-question cards showing the
   self-report badge and a transcript snippet. Replaces the old inline text report.
5. **Gemini API key secured.** The hardcoded key is GONE from app.js. All Gemini
   calls now route through a **Supabase Edge Function** (`gemini-proxy`) that
   holds the key server-side as a secret.
6. **Session storage.** A `sessions` table was created (RLS on, owner-read).
   `renderInterviewReport` fires `saveSessionToSupabase()` (non-blocking) which
   posts the result through the same Edge Function.
7. **FER CNN trained and exported.** `fer_cnn_train.ipynb` was run in Colab on
   FER-2013 + MobileNetV2. Final accuracy ~58% (state-of-the-art for FER-2013 is
   ~65%, human agreement ~65%, so this is fine). Exported to TF.js into
   `models/fer_tfjs/`. `fer.js` was written to load it and compute the tension
   proxy from webcam frames during each answer.

---

## 5. Supabase setup (already configured)

- **Project:** "Novus AI", ref `zzaqawcpqdbdymcugcfy`, region ap-southeast-2, FREE/Nano plan.
- **Auth:** "Confirm email" OFF, "Allow new signups" ON.
- **Edge Function `gemini-proxy`** is deployed. "Verify JWT with legacy secret" is OFF.
  - Handles two actions: `gemini` (proxies the model call) and `save_session`
    (verifies the user JWT, inserts into `sessions`).
  - **Secrets set** (Dashboard → Edge Functions → Secrets):
    - `GEMINI_API_KEY`
    - `SERVICE_ROLE_KEY`  (named without the `SUPABASE_` prefix because Supabase
      reserves that prefix — the function reads `Deno.env.get("SERVICE_ROLE_KEY")`)
- **`sessions` table** created via `create_sessions_table.sql` (RLS enabled).
- **API keys:** the app uses the **legacy anon key** (`eyJ...`) in app.js, not the
  new `sb_publishable_...` key — the new format wasn't working with
  `supabase-js@2`'s `signInWithPassword`. The legacy anon key is in
  Settings → API Keys → "Legacy anon, service_role API keys".

---

## 6. OPEN BUGS (what to fix next — start here)

### Bug #1 — Login returns 400 (auth)  [HIGHEST PRIORITY]
Symptom: console shows
`Failed to load resource ...auth/v1/token?grant_type=password ... 400`.
The login call to Supabase Auth is being rejected.

What we already tried: confirmed Confirm-email is OFF, swapped the new
`sb_publishable_` key for the **legacy anon `eyJ...` key** in app.js, reverted
`supabase-js` to the stable `@2` CDN tag.

Next things to check:
- Open the Network tab, click the failing `token?grant_type=password` request,
  read the JSON response body — it will say exactly why (e.g.
  "Invalid login credentials", "Email logins are disabled", "Signups not allowed").
- In Supabase → Authentication → Providers, make sure **Email** provider is enabled.
- Try a brand-new email/password (6+ chars) to rule out a stale/half-created account.
- If it says "Email logins are disabled", enable the Email provider.

### Bug #2 — FER model won't load (`InputLayer should be passed batchInputShape`)
Symptom: `fer.js` warns and falls back to focus+latency only; composure still
works but without the tension proxy.

Cause: the model was exported by **Keras 3.13.2**, which writes `batch_shape` in
the InputLayer config, but the TF.js LayersModel loader expects
`batch_input_shape`. There's also a `RandomFlip` augmentation layer that is
training-only and not needed at inference.

Two ways to fix (pick one):
- **(Recommended) Re-export as a GraphModel from Colab.** Add a cell to
  `fer_cnn_train.ipynb`:
  ```python
  import tensorflow as tf, tensorflowjs as tfjs, json, shutil
  model.export('saved_fer')   # SavedModel dir
  !tensorflowjs_converter --input_format=tf_saved_model \
      --output_format=tfjs_graph_model saved_fer tfjs_graph
  with open('tfjs_graph/class_names.json','w') as f: json.dump(CLASS_NAMES, f)
  shutil.make_archive('fer_graph_model','zip','tfjs_graph')
  from google.colab import files; files.download('fer_graph_model.zip')
  ```
  Then in `fer.js`, change the load call to `tf.loadGraphModel(...)` (a graph
  model has no LayersModel config issues). Note: a GraphModel's call is
  `ferModel.predict(t)` / `ferModel.execute(t)` — keep the same preprocessing.
  NOTE: the Colab runtime may have timed out; if so the model must be retrained
  first (~20 min on a T4 GPU). The training data is the Kaggle dataset
  `msambare/fer2013`.
- **(Alt) Patch model.json on load.** `fer.js` currently contains a custom IO
  handler that rewrites `batch_shape`→`batch_input_shape` before loading. It also
  needs to drop/ignore the `RandomFlip` layer. This is more fragile than the
  graph-model route.

### Bug #3 — Proxy occasionally 404 on first calls
The model-discovery used to hit Google directly; that was removed and replaced
with a hardcoded model list (`gemini-2.0-flash`, `gemini-1.5-flash`,
`gemini-1.5-pro`, `gemini-1.5-flash-8b`). The proxy fetch now sends the anon key
in `Authorization` + `apikey` headers. If 404s persist, confirm the function URL
is exactly `https://zzaqawcpqdbdymcugcfy.supabase.co/functions/v1/gemini-proxy`
and that the function shows as deployed in the dashboard.

---

## 7. Architecture / scoring notes (unchanged, still true)

- **Two-phase question selection:** Phase 1 asks one random question per topic
  (calibration); Phase 2 is weighted-random biased toward lowest-scoring topics.
- **scoring.js pipeline:** raw measurement → normalize each to 0–100 → weighted
  combine into 3 composites → weighted combine into 1 role-weighted overall.
  Missing inputs (e.g. no camera) are dropped and remaining weights renormalized.
- **All thresholds/weights in `CONFIG`** are honest placeholders to be calibrated
  from real data later, NOT validated constants.
- **Honesty stance (keep this for credibility):** the CNN classifies *expressions*,
  not emotions. Its output feeds a clearly-labelled **"Composure (proxy)"** —
  never a raw "anxiety" number. The self-report (1–5) is the real label to train
  a fusion model on later.

---

## 8. Next steps after the bugs (priority order)

1. **Fix login (Bug #1).** Nothing else can be tested end-to-end until this works.
2. **Fix FER load (Bug #2)** via the graph-model re-export.
3. **Verify session save** — finish an interview, confirm a row appears in
   Supabase → Table Editor → `sessions`.
4. **Build a "history" view** — read the user's past `sessions` and show progress
   over time (the data is already being saved).
5. **Add the low-confidence flag** more prominently on the overall score when
   composure is computed from too few inputs (partial: per-answer "⚠ LOW DATA"
   badge already exists).
6. **Calibrate weights** once enough labelled sessions exist — fit `CONFIG`
   weights by regression against the self-report labels / outcomes.
7. **Rotate secrets before any public use.** Both the Gemini key and the Supabase
   service-role key were shared in chat during setup; generate fresh ones
   (Google AI Studio for Gemini; Supabase → Settings → API for the service role).

---

## 9. Security TODO (do not skip before real users)

- Rotate the Gemini API key and Supabase service-role key (see step 7 above).
- The anon key in app.js is fine to be public (that's its purpose) **as long as
  Row Level Security is on** for every table — confirm RLS is enabled on
  `sessions` (it is, via the SQL) and on any future tables.
