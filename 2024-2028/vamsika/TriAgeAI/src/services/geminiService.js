import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize — API key will be set from env
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

let genAI = null;
let model = null;

function getModel() {
  if (!model && API_KEY) {
    genAI = new GoogleGenerativeAI(API_KEY);
    model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  }
  return model;
}

// Retry helper for 429 rate limit errors
async function withRetry(fn, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const is429 = err?.status === 429 || err?.message?.includes('429') || err?.message?.includes('quota') || err?.message?.includes('RESOURCE_EXHAUSTED');
      if (is429 && attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1500; // 1.5s, 3s, 6s
        console.warn(`Gemini rate limited (429). Retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
}

/**
 * Analyze injury description (voice transcript or text) and classify severity
 */
export async function analyzeTriageText(description) {
  const m = getModel();
  if (!m) return getFallbackAnalysis(description);

  const prompt = `You are an expert emergency medical triage AI assistant used during mass casualty events.

Analyze the following patient injury description and provide a triage classification.

Patient Description: "${description}"

Respond in EXACTLY this JSON format (no markdown, no code blocks, just raw JSON):
{
  "severity": "red|yellow|green|black",
  "severityLabel": "Immediate|Delayed|Minor|Deceased/Expectant",
  "confidence": 0.85,
  "assessment": "Brief 2-sentence medical assessment",
  "recommendedActions": ["action1", "action2", "action3"],
  "estimatedAge": "adult|child|elderly",
  "injuryType": "type of injury",
  "priorityScore": 8.5,
  "needsSurgery": true,
  "needsBlood": false,
  "recommendedSpecialty": "Trauma Surgery|Orthopedics|Neurology|Burns|General|Cardiac"
}

Severity Classification Rules:
- RED (Immediate): Life-threatening, needs immediate intervention. Airway compromise, severe hemorrhage, tension pneumothorax, shock.
- YELLOW (Delayed): Serious but stable for now. Fractures, moderate burns, abdominal injuries without shock.
- GREEN (Minor): Walking wounded. Minor cuts, sprains, psychological distress, minor burns.
- BLACK (Deceased/Expectant): No signs of life or injuries incompatible with survival given available resources.`;

  try {
    const result = await withRetry(() => m.generateContent(prompt));
    const text = result.response.text();
    // Clean up response — remove markdown code blocks if present
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('Gemini API error:', err);
    return getFallbackAnalysis(description);
  }
}

/**
 * Analyze an injury photo using Gemini Vision
 */
export async function analyzeTriageImage(imageBase64, mimeType = 'image/jpeg') {
  const m = getModel();
  if (!m) return getFallbackImageAnalysis();

  const prompt = `You are an expert emergency medical triage AI. Analyze this image from a mass casualty event scene.

Provide your assessment in EXACTLY this JSON format (no markdown, no code blocks):
{
  "severity": "red|yellow|green|black",
  "severityLabel": "Immediate|Delayed|Minor|Deceased/Expectant",
  "confidence": 0.80,
  "assessment": "Brief 2-sentence visual medical assessment based on what you observe",
  "visibleInjuries": ["injury1", "injury2"],
  "recommendedActions": ["action1", "action2", "action3"],
  "injuryType": "type of injury observed",
  "priorityScore": 7.5,
  "needsSurgery": false,
  "needsBlood": false,
  "recommendedSpecialty": "Trauma Surgery|Orthopedics|Neurology|Burns|General|Cardiac",
  "sceneNotes": "Brief note about the scene context if visible"
}`;

  try {
    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType: mimeType,
      },
    };
    const result = await withRetry(() => m.generateContent([prompt, imagePart]));
    const text = result.response.text();
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('Gemini Vision error:', err);
    return getFallbackImageAnalysis();
  }
}

/**
 * Generate optimal hospital routing for a patient
 */
export async function getHospitalRecommendation(patient, hospitals) {
  const m = getModel();
  if (!m) return { recommendedHospitalId: hospitals[0]?.id, reasoning: 'Nearest available hospital selected.' };

  const prompt = `You are a medical logistics AI. Given a patient and available hospitals, recommend the best hospital.

Patient:
- Severity: ${patient.severity}
- Injury: ${patient.injuryType || 'Unknown'}
- Needs Surgery: ${patient.needsSurgery || false}
- Needs Blood: ${patient.needsBlood || false}
- Recommended Specialty: ${patient.recommendedSpecialty || 'General'}

Available Hospitals:
${hospitals.map(h => `- ID:${h.id} "${h.name}" | Beds: ${h.beds} | Distance: ${h.distance} | ETA: ${h.eta} | Specialty: ${h.speciality}`).join('\n')}

Respond in JSON: {"recommendedHospitalId": 1, "reasoning": "Brief explanation", "alternativeId": 2}`;

  try {
    const result = await withRetry(() => m.generateContent(prompt));
    const text = result.response.text();
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    return { recommendedHospitalId: hospitals[0]?.id, reasoning: 'Nearest available hospital selected.' };
  }
}

// Fallback when API key is not set
function getFallbackAnalysis(desc) {
  const lower = desc.toLowerCase();
  let severity = 'green';
  if (lower.includes('bleeding') || lower.includes('unconscious') || lower.includes('not breathing') || lower.includes('crushed') || lower.includes('severe')) {
    severity = 'red';
  } else if (lower.includes('fracture') || lower.includes('burn') || lower.includes('pain') || lower.includes('broken')) {
    severity = 'yellow';
  }

  const labels = { red: 'Immediate', yellow: 'Delayed', green: 'Minor', black: 'Deceased/Expectant' };
  return {
    severity,
    severityLabel: labels[severity],
    confidence: 0.65,
    assessment: `Patient presents with described symptoms. Classified as ${labels[severity]} priority based on keyword analysis. Full AI analysis requires API key configuration.`,
    recommendedActions: ['Assess airway, breathing, circulation', 'Monitor vital signs', 'Prepare for transport'],
    injuryType: 'Mixed trauma',
    priorityScore: severity === 'red' ? 9.0 : severity === 'yellow' ? 6.0 : 3.0,
    needsSurgery: severity === 'red',
    needsBlood: severity === 'red',
    recommendedSpecialty: 'Trauma Surgery',
  };
}

function getFallbackImageAnalysis() {
  return {
    severity: 'yellow',
    severityLabel: 'Delayed',
    confidence: 0.5,
    assessment: 'Image analysis requires Gemini API key. Using default assessment — patient should be evaluated in person by medical professional.',
    visibleInjuries: ['Unable to assess without API key'],
    recommendedActions: ['Physical examination required', 'Monitor vital signs', 'Prepare for transport if needed'],
    injuryType: 'Undetermined',
    priorityScore: 5.0,
    needsSurgery: false,
    needsBlood: false,
    recommendedSpecialty: 'General',
  };
}
