/**
 * ml/riskModel.js
 *
 * WHY THIS FILE EXISTS:
 * The actual ASHA Shield model is an XGBoost tree exported to TFLite (.tflite)
 * and loaded via react-native-tflite (a native module).
 *
 * For the hackathon demo we ship a RULE-BASED FALLBACK that mirrors the clinical
 * logic the XGBoost model learned from HMIS + WHO ANC guidelines. This runs
 * in pure JavaScript — zero native dependencies — so the app demo works even
 * before the real .tflite model is trained.
 *
 * The file exports ONE public function:  computeRisk(features)
 * Every other function here is internal.
 *
 * HOW THE RISK SCORE WORKS:
 *  1. Each vital/feature is evaluated against clinical thresholds.
 *  2. Each threshold breach adds a weighted "risk point" to a running total.
 *  3. The total is mapped to LOW / MODERATE / HIGH.
 *  4. SHAP-style attribution: the TOP 3 contributing features are ranked and
 *     converted to a plain-language Hindi-English reason string.
 */

// ── FEATURE WEIGHTS ──────────────────────────────────────────────────────────
// These approximate what the XGBoost model learns from training data.
// Higher weight = stronger predictor of adverse maternal outcome.
// Source: WHO ANC guidelines + Lancet maternal mortality studies.

const WEIGHTS = {
  severe_hypertension:   10, // systolic ≥ 160 OR diastolic ≥ 110 → emergency
  moderate_hypertension:  6, // systolic 140–159 OR diastolic 90–109
  urine_protein_high:     7, // 2+ or 3+ → pre-eclampsia combination with BP
  urine_protein_trace:    3, // trace or 1+
  severe_anaemia:         8, // Hb < 7 g/dL → transfusion-level
  moderate_anaemia:       4, // Hb 7–10 g/dL
  low_fetal_hr:           9, // < 110 bpm → foetal distress
  high_fetal_hr:          7, // > 160 bpm → foetal distress
  preterm_risk:           5, // gestational age < 34 weeks with any flag
  iugr_proxy:             4, // weight gain < 0.3 kg/week after week 20
  young_age:              3, // age < 18
  advanced_age:           3, // age > 35
  prev_csection:          4, // repeat C-section risk
  prev_pph:               5, // postpartum haemorrhage history → very high risk
  prev_stillbirth:        5, // stillbirth history
  short_inter_preg:       4, // < 24 months between pregnancies
  high_gravida:           2, // gravida ≥ 4
  low_muac:               3, // MUAC < 23 cm → malnutrition
};

// ── REASON TEMPLATES ─────────────────────────────────────────────────────────
// Plain-language strings that correspond to each risk flag.
// Hindi phrases included for voice readout on the risk card.
// Format: { en: English text,  hi: Hindi text }

const REASONS = {
  severe_hypertension:   { en: 'Blood pressure is dangerously high (≥160/110). Refer immediately.',                        hi: 'BP bahut khatarnak hai. Abhi PHC le jayein.' },
  moderate_hypertension: { en: 'Blood pressure is elevated (≥140/90). Monitor closely, consider referral.',                hi: 'BP zyada hai. Nazar rakhein, PHC bhejne ki zaroorat ho sakti hai.' },
  urine_protein_high:    { en: 'High urine protein detected (2+ or 3+). Pre-eclampsia risk — refer today.',                hi: 'Urine mein protein mila hai. Aaj PHC le jayein.' },
  urine_protein_trace:   { en: 'Trace urine protein found. Monitor at next visit.',                                        hi: 'Thoda protein mila hai. Agli visit mein check karein.' },
  severe_anaemia:        { en: 'Haemoglobin is critically low (<7 g/dL). Patient needs urgent blood assessment.',          hi: 'Khoon bahut kam hai. Turant hospital bhejein.' },
  moderate_anaemia:      { en: 'Haemoglobin is low (7–10 g/dL). Start iron supplements, schedule PHC visit.',             hi: 'Khoon thoda kam hai. Iron ki dawa shuru karein.' },
  low_fetal_hr:          { en: 'Foetal heart rate is low (<110 bpm). Possible foetal distress — refer immediately.',       hi: 'Bache ki dhadkan kam hai. Abhi PHC bhejein.' },
  high_fetal_hr:         { en: 'Foetal heart rate is high (>160 bpm). Monitor closely.',                                   hi: 'Bache ki dhadkan tez hai. Dhyan rakhein.' },
  preterm_risk:          { en: 'Pregnancy is less than 34 weeks with risk factors — preterm delivery risk.',               hi: 'Samay se pehle prasav ka darr hai.' },
  iugr_proxy:            { en: 'Weight gain is low — possible foetal growth restriction (IUGR). Nutrition counselling needed.', hi: 'Wajan kam badh raha hai. Poshan salah zaroor dein.' },
  young_age:             { en: 'Patient is under 18 — higher obstetric risk.',                                             hi: 'Patient ki umra 18 saal se kam hai.' },
  advanced_age:          { en: 'Patient is over 35 — higher risk of complications.',                                       hi: 'Patient ki umra 35 saal se zyada hai.' },
  prev_csection:         { en: 'Previous C-section — institutional delivery mandatory.',                                   hi: 'Pehle C-section hua hai. Hospital mein prasav zaroori hai.' },
  prev_pph:              { en: 'History of postpartum haemorrhage — high-risk delivery expected.',                         hi: 'Pehle zyada khoon nikla tha. Hospital mein prasav zaroori hai.' },
  prev_stillbirth:       { en: 'Previous stillbirth — additional monitoring required.',                                    hi: 'Pehle mara hua bacha hua tha. Zyada dhyan zaroor dein.' },
  short_inter_preg:      { en: 'Less than 2 years since last delivery — elevated maternal risk.',                          hi: 'Pichle prasav ke baad 2 saal nahi hue hain.' },
  high_gravida:          { en: 'Fourth or higher pregnancy — increased risk of complications.',                            hi: 'Ye chauthi ya zyada baar ki pregnancy hai.' },
  low_muac:              { en: 'Low arm circumference (<23 cm) — malnutrition risk. Refer for nutrition support.',         hi: 'Maa ka poshan theek nahi hai. Nutrition centre bhejein.' },
};

// ── CORE SCORING FUNCTION ────────────────────────────────────────────────────

/**
 * computeRisk(features)
 *
 * @param {object} features - Vitals and history from the visit form:
 *   systolic_bp, diastolic_bp, hb_gdl, urine_protein,
 *   fetal_hr, gestational_age, weight_kg, prev_weight_kg,
 *   age, gravida, prev_csection, prev_pph, prev_stillbirth,
 *   inter_preg_gap, muac_cm
 *
 * @returns {object}  { riskLevel, score, reasons, voiceHindi, voiceEnglish }
 *
 * USED BY: VisitLoggingScreen — called after user taps "Compute Risk"
 */
export const computeRisk = (features) => {
  const {
    systolic_bp, diastolic_bp,
    hb_gdl,
    urine_protein = 'nil',
    fetal_hr,
    gestational_age,
    weight_kg, prev_weight_kg,
    age,
    gravida = 1,
    prev_csection = false,
    prev_pph = false,
    prev_stillbirth = false,
    inter_preg_gap,
    muac_cm,
  } = features;

  // Running tally of (flagKey → weight) pairs that fired
  const firedFlags = {};

  // ── Blood Pressure ──────────────────────────────────────────────────────
  if (systolic_bp >= 160 || diastolic_bp >= 110) {
    firedFlags.severe_hypertension = WEIGHTS.severe_hypertension;
  } else if (systolic_bp >= 140 || diastolic_bp >= 90) {
    firedFlags.moderate_hypertension = WEIGHTS.moderate_hypertension;
  }

  // ── Urine Protein ───────────────────────────────────────────────────────
  if (['2+', '3+'].includes(urine_protein)) {
    firedFlags.urine_protein_high = WEIGHTS.urine_protein_high;
  } else if (['trace', '1+'].includes(urine_protein)) {
    firedFlags.urine_protein_trace = WEIGHTS.urine_protein_trace;
  }

  // ── Haemoglobin / Anaemia ───────────────────────────────────────────────
  if (hb_gdl != null) {
    if (hb_gdl < 7) {
      firedFlags.severe_anaemia = WEIGHTS.severe_anaemia;
    } else if (hb_gdl < 10) {
      firedFlags.moderate_anaemia = WEIGHTS.moderate_anaemia;
    }
  }

  // ── Foetal Heart Rate ───────────────────────────────────────────────────
  if (fetal_hr != null) {
    if (fetal_hr < 110) firedFlags.low_fetal_hr  = WEIGHTS.low_fetal_hr;
    if (fetal_hr > 160) firedFlags.high_fetal_hr = WEIGHTS.high_fetal_hr;
  }

  // ── Gestational Age ─────────────────────────────────────────────────────
  if (gestational_age != null && gestational_age < 34 && Object.keys(firedFlags).length > 0) {
    firedFlags.preterm_risk = WEIGHTS.preterm_risk;
  }

  // ── Weight Gain (IUGR proxy) ─────────────────────────────────────────────
  if (weight_kg != null && prev_weight_kg != null && gestational_age > 20) {
    const gain = weight_kg - prev_weight_kg;
    if (gain < 0.3) firedFlags.iugr_proxy = WEIGHTS.iugr_proxy;
  }

  // ── Age ──────────────────────────────────────────────────────────────────
  if (age != null) {
    if (age < 18)  firedFlags.young_age    = WEIGHTS.young_age;
    if (age > 35)  firedFlags.advanced_age = WEIGHTS.advanced_age;
  }

  // ── Obstetric History ────────────────────────────────────────────────────
  if (prev_csection)    firedFlags.prev_csection   = WEIGHTS.prev_csection;
  if (prev_pph)         firedFlags.prev_pph         = WEIGHTS.prev_pph;
  if (prev_stillbirth)  firedFlags.prev_stillbirth  = WEIGHTS.prev_stillbirth;

  // ── Inter-Pregnancy Gap ──────────────────────────────────────────────────
  if (inter_preg_gap != null && inter_preg_gap < 24) {
    firedFlags.short_inter_preg = WEIGHTS.short_inter_preg;
  }

  // ── Gravida ──────────────────────────────────────────────────────────────
  if (gravida >= 4) firedFlags.high_gravida = WEIGHTS.high_gravida;

  // ── MUAC / Nutrition ─────────────────────────────────────────────────────
  if (muac_cm != null && muac_cm < 23) {
    firedFlags.low_muac = WEIGHTS.low_muac;
  }

  // ── Aggregate Score ──────────────────────────────────────────────────────
  const totalScore = Object.values(firedFlags).reduce((a, b) => a + b, 0);

  // Map score to risk level
  // Thresholds tuned so: score≥10 = HIGH, score≥4 = MODERATE, else LOW
  let riskLevel;
  if (totalScore >= 10) riskLevel = 'HIGH';
  else if (totalScore >= 4) riskLevel = 'MODERATE';
  else riskLevel = 'LOW';

  // ── Top Reason Strings ────────────────────────────────────────────────────
  // Sort fired flags by their weight (highest impact first) → top 3 reasons
  const sortedFlags = Object.entries(firedFlags)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([key]) => key);

  const reasons = sortedFlags.map(key => ({
    key,
    en: REASONS[key]?.en || key,
    hi: REASONS[key]?.hi || key,
  }));

  // Build voice readout strings — joined for TTS
  const voiceHindi   = reasons.map(r => r.hi).join('. ');
  const voiceEnglish = reasons.map(r => r.en).join('. ');

  return { riskLevel, score: totalScore, reasons, voiceHindi, voiceEnglish };
};

// ── RISK LEVEL DISPLAY HELPERS ────────────────────────────────────────────────

/**
 * getRiskColor(riskLevel)
 * Returns the background color for the risk card.
 * GREEN = safe, YELLOW = watch, RED = act now.
 */
export const getRiskColor = (riskLevel) => {
  switch (riskLevel) {
    case 'HIGH':     return '#FF3B30';  // Red
    case 'MODERATE': return '#FF9500';  // Amber / Orange
    default:         return '#34C759';  // Green
  }
};

/**
 * getRiskLabel(riskLevel)
 * Returns the Hindi label shown on the colour-coded risk card.
 */
export const getRiskLabel = (riskLevel) => {
  switch (riskLevel) {
    case 'HIGH':     return 'KHATRA / उच्च जोखिम';  // Danger / High Risk
    case 'MODERATE': return 'SAVDHAN / मध्यम जोखिम'; // Caution / Moderate Risk
    default:         return 'SURAKSHIT / कम जोखिम';  // Safe / Low Risk
  }
};
