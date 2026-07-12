/* ============================================================================
 * scoring.js — Interview scoring engine (dependency-free ES module)
 * ----------------------------------------------------------------------------
 * Pipeline:  raw measurements  ->  normalize each to 0..100  ->  weighted
 *            combine into 3 composites  ->  weighted combine into 1 overall.
 *
 * HONEST LABELLING:
 *   - "correctness", "depth", "structure" come from the LLM rubric (judgment).
 *   - delivery metrics (wpm, fillers, length, latency) are OBJECTIVE measurements.
 *   - "tension" is a PROXY derived from face/voice signals, NOT measured anxiety.
 *     Treat any composure number as an estimate, never as a validated emotion read.
 *
 * CALIBRATION:
 *   Every number in CONFIG is a sensible *placeholder*. The whole point of the
 *   data loop is to replace these with values fitted from real, labelled
 *   sessions (see fitWeights notes at the bottom).
 * ========================================================================== */

// ---------- math primitives -------------------------------------------------

export const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

// Bell curve: peaks (100) at `mu`, falls off with tolerance `sigma`. For
// metrics that have a "sweet spot" (pace, length, latency).
export function gaussianScore(x, mu, sigma) {
  if (x == null || Number.isNaN(x)) return null;
  return 100 * Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma));
}

// Monotonic "lower is better": 100 at x=0, decays with scale `tau`. For fillers.
export function decayScore(x, tau) {
  if (x == null || Number.isNaN(x)) return null;
  return 100 * Math.exp(-Math.max(0, x) / tau);
}

// Monotonic "higher is better, saturating": logistic S-curve.
export function logisticScore(x, x0, k) {
  if (x == null || Number.isNaN(x)) return null;
  return 100 / (1 + Math.exp(-k * (x - x0)));
}

// Population-relative score: percentile of x under N(mu, sigma). Use this once
// you have enough data to estimate mu/sigma from your own user base.
export function zPercentile(x, mu, sigma) {
  if (x == null || Number.isNaN(x) || !sigma) return null;
  const z = (x - mu) / sigma;
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  p = z > 0 ? 1 - p : p;
  return clamp(100 * p);
}

// Weighted combine. Skips null sub-scores and RENORMALISES the remaining
// weights so a missing input never unfairly drags the result toward zero.
export function weightedCombine(scores, weights) {
  let num = 0, den = 0;
  for (const k in weights) {
    const s = scores[k];
    if (s == null || Number.isNaN(s)) continue;
    num += weights[k] * s;
    den += weights[k];
  }
  return den === 0 ? null : num / den;
}

// ---------- configuration (tune these from data later) ----------------------

export const CONFIG = {
  // normalization params for objective delivery metrics
  pace:    { mu: 135, sigma: 45 },  // words per minute; comfortable ~135
  length:  { mu: 90,  sigma: 70 },  // words per answer; ideal ~90
  latency: { mu: 3,   sigma: 4 },   // seconds before answering; ideal ~3
  fillerTau: 4,                     // fillers per 100 words; lower is better

  // Layer-1 weights: sub-scores -> composite (each group should sum to ~1)
  weights: {
    correctness:   { correctness: 0.65, depth: 0.35 },
    communication: { structure: 0.30, fillers: 0.25, pace: 0.25, length: 0.20 },
    composure:     { focus: 0.35, latency: 0.25, tension: 0.25, voice: 0.15 }
  },

  // Layer-2 weights: composites -> overall, varying by role (each sums to ~1)
  roleProfiles: {
    swe_intern: { correctness: 0.50, communication: 0.30, composure: 0.20 },
    backend:    { correctness: 0.65, communication: 0.20, composure: 0.15 },
    frontend:   { correctness: 0.50, communication: 0.35, composure: 0.15 },
    data_analyst:{ correctness: 0.55, communication: 0.30, composure: 0.15 },
    data_science:{ correctness: 0.65, communication: 0.25, composure: 0.10 },
    ml_engineer:{ correctness: 0.70, communication: 0.20, composure: 0.10 },
    cybersec:   { correctness: 0.60, communication: 0.20, composure: 0.20 },
    devops:     { correctness: 0.65, communication: 0.20, composure: 0.15 },
    behavioral: { correctness: 0.35, communication: 0.45, composure: 0.20 },
    default:    { correctness: 0.50, communication: 0.30, composure: 0.20 }
  }
};

// ---------- per-answer scoring ----------------------------------------------

/**
 * Score one answer.
 * @param raw {
 *   llm:      { correctness, depth, structure },         // 0..100, from LLM rubric
 *   delivery: { words, wpm, fillerRate, latencySec },    // objective measurements
 *   presence: { focusPct, tensionProxy, voiceSteadiness } // 0..100 proxies; may be null
 * }
 */
export function scoreAnswer(raw, cfg = CONFIG) {
  const c = raw.llm || {};
  const d = raw.delivery || {};
  const p = raw.presence || {};

  const sub = {
    // content (LLM judgment)
    correctness: c.correctness ?? null,
    depth:       c.depth ?? null,
    structure:   c.structure ?? null,
    // delivery (objective -> normalized)
    fillers: d.fillerRate != null ? decayScore(d.fillerRate, cfg.fillerTau) : null,
    pace:    gaussianScore(d.wpm, cfg.pace.mu, cfg.pace.sigma),
    length:  gaussianScore(d.words, cfg.length.mu, cfg.length.sigma),
    // composure (proxies)
    focus:   p.focusPct ?? null,
    latency: d.latencySec != null ? gaussianScore(d.latencySec, cfg.latency.mu, cfg.latency.sigma) : null,
    tension: p.tensionProxy != null ? clamp(100 - p.tensionProxy) : null, // more tension -> less composure
    voice:   p.voiceSteadiness ?? null
  };

  const composites = {
    correctness:   weightedCombine(sub, cfg.weights.correctness),
    communication: weightedCombine(sub, cfg.weights.communication),
    composure:     weightedCombine(sub, cfg.weights.composure)
  };

  return { sub, composites };
}

export function overallScore(composites, role = 'default', cfg = CONFIG) {
  const profile = cfg.roleProfiles[role] || cfg.roleProfiles.default;
  return weightedCombine(composites, profile);
}

// ---------- session aggregation ---------------------------------------------

const _avg = (arr) => {
  const v = arr.filter((x) => x != null && !Number.isNaN(x));
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
};

/**
 * Aggregate a whole session.
 * @param answers array of { topic, llm, delivery, presence }
 * @returns { perAnswer, composites, topicScores, weakestTopic, overall }
 *          topicScores feeds the adaptive weak-topic question selector.
 */
export function scoreSession(answers, role = 'default', cfg = CONFIG) {
  const perAnswer = answers.map((a) => ({ topic: a.topic, ...scoreAnswer(a, cfg) }));

  const composites = {
    correctness:   _avg(perAnswer.map((s) => s.composites.correctness)),
    communication: _avg(perAnswer.map((s) => s.composites.communication)),
    composure:     _avg(perAnswer.map((s) => s.composites.composure))
  };

  const byTopic = {};
  for (const s of perAnswer) (byTopic[s.topic] ??= []).push(s.composites.correctness);
  const topicScores = {};
  for (const t in byTopic) topicScores[t] = _avg(byTopic[t]);

  const overall = overallScore(composites, role, cfg);
  const ranked = Object.entries(topicScores).sort((a, b) => (a[1] ?? 0) - (b[1] ?? 0));
  const weakestTopic = ranked.length ? ranked[0][0] : null;

  return { perAnswer, composites, topicScores, weakestTopic, overall };
}

/* ----------------------------------------------------------------------------
 * NEXT STEP — fitting weights from data (turns guesses into a real model):
 *   1. Collect rows: [sub-scores...] -> label (human rating, or self-reported
 *      anxiety for the tension model, or a 0/1 "placed" outcome).
 *   2. Fit weights by minimizing  Σ (predicted - label)^2  (linear regression),
 *      or a logistic fit for a binary label.
 *   3. Drop the fitted weights into CONFIG.weights / roleProfiles.
 * Until then, the numbers above are honest defaults, not measurements.
 * ------------------------------------------------------------------------- */
