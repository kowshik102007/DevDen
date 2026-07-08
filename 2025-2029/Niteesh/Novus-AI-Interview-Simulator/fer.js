// Use global tf injected via script tag to prevent ESM network cascade failures
const tf = window.tf;

/* ==========================================================================
 * fer.js — In-browser facial expression inference
 * --------------------------------------------------------------------------
 * Loads the TF.js model trained on FER-2013 and computes a tensionProxy
 * value per answer from webcam frames captured during recording.
 *
 * HONEST LABELLING (important for credibility):
 *   - This model classifies FACIAL EXPRESSIONS, not emotions.
 *   - tensionProxy = normalized(mean(fear+sad) + variance) across frames.
 *   - Never display this as "anxiety". Always label it "Composure (proxy)".
 *   - Expected accuracy: ~58% on FER-2013 (human agreement is ~65%).
 * ========================================================================== */

// Class order matches the training output exactly (alphabetical from Keras)
const FER_CLASSES = ['angry', 'disgust', 'fear', 'happy', 'neutral', 'sad', 'surprise'];
const FEAR_IDX    = FER_CLASSES.indexOf('fear');    // 2
const SAD_IDX     = FER_CLASSES.indexOf('sad');     // 5

let ferModel = null;
let ferLoading = false;

export function isFerReady() { return ferModel !== null; }

/**
 * Load the TF.js model once. Call this early (e.g. when interview starts).
 * Silently fails if the model files aren't present — tensionProxy stays null.
 */
export async function loadFerModel() {
    if (ferModel || ferLoading) return;
    ferLoading = true;
    try {
        ferModel = await tf.loadGraphModel('models/fer_tfjs/model.json');
        console.log('FER model loaded.');
    } catch (e) {
        console.warn('FER model not found — composure will use focus+latency only.', e.message);
        ferModel = null;
    } finally {
        ferLoading = false;
    }
}

/**
 * Run inference on a single video frame.
 * @param video  HTMLVideoElement (the webcam feed)
 * @param bbox   { x, y, width, height } normalised face bounding box from MediaPipe
 *               (values 0..1 relative to video dimensions). Pass null to use full frame.
 * @returns Float32Array of 7 probabilities, or null if model not loaded.
 */
export function inferFrame(video, bbox = null) {
    if (!ferModel || !video || video.readyState < 2) return null;

    return tf.tidy(() => {
        // Crop face region from video frame
        const canvas = document.createElement('canvas');
        canvas.width = 96;
        canvas.height = 96;
        const ctx = canvas.getContext('2d');

        if (bbox) {
            const vw = video.videoWidth;
            const vh = video.videoHeight;
            // Add 20% padding around the bbox for better face coverage
            const pad = 0.10;
            const sx = Math.max(0, (bbox.x - pad) * vw);
            const sy = Math.max(0, (bbox.y - pad) * vh);
            const sw = Math.min(vw - sx, (bbox.width  + 2 * pad) * vw);
            const sh = Math.min(vh - sy, (bbox.height + 2 * pad) * vh);
            ctx.drawImage(video, sx, sy, sw, sh, 0, 0, 96, 96);
        } else {
            ctx.drawImage(video, 0, 0, 96, 96);
        }

        // Preprocess: MobileNetV2 expects pixels scaled to [-1, 1]
        let t = tf.browser.fromPixels(canvas);        // [96,96,3] uint8
        t = t.toFloat().div(127.5).sub(1);            // scale to [-1,1]
        t = t.expandDims(0);                          // [1,96,96,3]
        const probs = ferModel.execute(t).dataSync(); // Float32Array[7]
        return Array.from(probs);
    });
}

/**
 * Compute tensionProxy from a list of per-frame probability arrays collected
 * during one answer.
 *
 * Formula:
 *   mean_tense  = average of (fear + sad) across frames           (0..1)
 *   variance    = frame-to-frame std-dev of (fear + sad)          (0..1 approx)
 *   raw         = 0.65 * mean_tense + 0.35 * variance
 *   tensionProxy = clamp(raw * 100, 0, 100)                       (0..100)
 *
 * Higher tensionProxy = more tense-looking expression = lower composure score.
 * scoring.js already does:  composure_tension = clamp(100 - tensionProxy)
 *
 * @param frames  Array of Float32Array[7] from inferFrame()
 * @returns number 0..100, or null if fewer than 3 valid frames
 */
export function computeTensionProxy(frames) {
    const valid = frames.filter(f => f && f.length === 7);
    if (valid.length < 3) return null;

    const tensePerFrame = valid.map(f => f[FEAR_IDX] + f[SAD_IDX]); // 0..2 range

    const mean = tensePerFrame.reduce((s, v) => s + v, 0) / tensePerFrame.length;

    const variance = Math.sqrt(
        tensePerFrame.reduce((s, v) => s + (v - mean) ** 2, 0) / tensePerFrame.length
    );

    // Normalise: mean is 0..2 (two probs summed), variance typically 0..0.5
    const normMean     = Math.min(mean / 2, 1);
    const normVariance = Math.min(variance / 0.5, 1);

    const raw = 0.65 * normMean + 0.35 * normVariance;
    return Math.max(0, Math.min(100, raw * 100));
}
