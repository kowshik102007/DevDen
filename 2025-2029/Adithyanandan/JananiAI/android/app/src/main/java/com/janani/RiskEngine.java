package com.janani;

import android.content.Context;
import org.tensorflow.lite.Interpreter;
import org.tensorflow.lite.support.common.FileUtil;
import java.io.IOException;
import java.util.Arrays;
import java.util.Map;
import java.util.HashMap;

public class RiskEngine {
    private Interpreter interpreter;
    private float[] mean;
    private float[] std;
    private static final String MODEL_FILE = "janani_risk_model.tflite";

    // Feature order (must match training)
    private static final String[] FEATURE_NAMES = {
        "systolic_bp", "diastolic_bp", "hemoglobin_gdl", "gestational_age_weeks",
        "weight_gain_kg", "fetal_heart_rate", "urine_protein_dipstick",
        "gravida", "parity", "age", "previous_complications",
        "inter_pregnancy_interval_months", "muac_cm"
    };

    // Hindi reason templates
    private static final Map<String, String> REASON_TEMPLATES = new HashMap<>();
    static {
        REASON_TEMPLATES.put("systolic_bp_high", "BP bahut zyada hai — aaj PHC jaana zaroori hai");
        REASON_TEMPLATES.put("hemoglobin_low", "Khoon ki kami hai — iron injection ki zaroorat ho sakti hai");
        REASON_TEMPLATES.put("urine_protein_high", "Peshab mein protein mila — pre-eclampsia ka khatra");
        REASON_TEMPLATES.put("fetal_heart_rate_low", "Bachche ki dhadkan kam hai — turant doctor dikhayein");
        REASON_TEMPLATES.put("age_risk_young", "Umar ke hisaab se zyada dhyan chahiye");
        REASON_TEMPLATES.put("previous_complications", "Pehle ki takleef ki wajah se dhyan rakhein");
        REASON_TEMPLATES.put("weight_gain_low", "Wajan nahi badh raha — poshan ki zaroorat hai");
        REASON_TEMPLATES.put("inter_pregnancy_short", "Do bacchon ke beech kam samay hua — dhyan rakhein");
        REASON_TEMPLATES.put("gestational_age_high", "Adhi lambi hai pregnancy — doctor ki zaroorat hai");
        REASON_TEMPLATES.put("muac_low", "Baazoo ka girth kam hai — poshan ki kami ho sakti hai");
        REASON_TEMPLATES.put("hemoglobin_moderate", "Khoon ki kami mild hai — iron tablet lein");
        REASON_TEMPLATES.put("bp_borderline", "BP upar border par hai — dhyan rakhein");
    }

    public RiskEngine(Context context) {
        try {
            interpreter = new Interpreter(FileUtil.loadMappedFile(context, MODEL_FILE));
            loadNormalizationParams(context);
        } catch (IOException e) {
            throw new RuntimeException("Failed to load TFLite model", e);
        }
    }

    private void loadNormalizationParams(Context context) {
        // Default normalization params (computed from training data)
        mean = new float[]{121.5f, 76.3f, 10.8f, 24.2f, 8.5f, 138.0f, 0.4f, 2.5f, 1.0f, 26.5f, 0.25f, 30.0f, 24.5f};
        std = new float[]{18.0f, 12.0f, 2.2f, 8.0f, 5.0f, 15.0f, 1.0f, 1.8f, 1.2f, 6.0f, 0.5f, 25.0f, 3.5f};
    }

    public String[] getFeatureNames() {
        return FEATURE_NAMES;
    }

    public float[] normalize(float[] rawFeatures) {
        float[] normalized = new float[rawFeatures.length];
        for (int i = 0; i < rawFeatures.length; i++) {
            normalized[i] = (rawFeatures[i] - mean[i]) / (std[i] + 1e-8f);
        }
        return normalized;
    }

    /**
     * Run inference and return probabilities.
     * @param features 13 raw feature values in order
     * @return float[3] with probabilities [LOW, MODERATE, HIGH]
     */
    public float[] predict(float[] features) {
        float[] normalized = normalize(features);
        float[][] input = {normalized};
        float[][] output = {{0f, 0f, 0f}};

        interpreter.run(input, output);

        return output[0];  // [prob_LOW, prob_MODERATE, prob_HIGH]
    }

    public String getRiskLabel(float[] probabilities) {
        int maxIndex = 0;
        float maxProb = probabilities[0];
        for (int i = 1; i < probabilities.length; i++) {
            if (probabilities[i] > maxProb) {
                maxProb = probabilities[i];
                maxIndex = i;
            }
        }
        String[] labels = {"LOW", "MODERATE", "HIGH"};
        return labels[maxIndex];
    }

    public String[] getTopReasons(float[] rawFeatures) {
        String[] reasons = new String[3];
        int reasonCount = 0;

        float sbp = rawFeatures[0];
        float hb = rawFeatures[2];
        float fhr = rawFeatures[5];
        int up = (int) rawFeatures[6];
        float age = rawFeatures[9];
        int pc = (int) rawFeatures[10];
        float ga = rawFeatures[3];

        if (sbp >= 140) {
            reasons[reasonCount++] = REASON_TEMPLATES.get("systolic_bp_high");
        } else if (sbp >= 130) {
            reasons[reasonCount++] = REASON_TEMPLATES.get("bp_borderline");
        }

        if (hb < 7.0) {
            if (reasonCount < 3) reasons[reasonCount++] = REASON_TEMPLATES.get("hemoglobin_low");
        } else if (hb < 9.0) {
            if (reasonCount < 3) reasons[reasonCount++] = REASON_TEMPLATES.get("hemoglobin_moderate");
        }

        if (up >= 2) {
            if (reasonCount < 3) reasons[reasonCount++] = REASON_TEMPLATES.get("urine_protein_high");
        }

        if (fhr < 110) {
            if (reasonCount < 3) reasons[reasonCount++] = REASON_TEMPLATES.get("fetal_heart_rate_low");
        }

        if (age < 18) {
            if (reasonCount < 3) reasons[reasonCount++] = REASON_TEMPLATES.get("age_risk_young");
        }

        if (pc >= 1) {
            if (reasonCount < 3) reasons[reasonCount++] = REASON_TEMPLATES.get("previous_complications");
        }

        if (ga > 40) {
            if (reasonCount < 3) reasons[reasonCount++] = REASON_TEMPLATES.get("gestational_age_high");
        }

        // Fill remaining with default
        while (reasonCount < 3) {
            reasons[reasonCount++] = "Doctor se milkar salah lein";
        }

        return reasons;
    }

    /**
     * Fallback rule-based scoring when model fails.
     */
    public String fallbackRiskLabel(float[] features) {
        float sbp = features[0];
        float hb = features[2];
        int up = (int) features[6];
        float age = features[9];
        int pc = (int) features[10];

        int score = 0;
        if (sbp >= 160) score += 3;
        else if (sbp >= 140) score += 2;
        else if (sbp >= 130) score += 1;

        if (hb < 7.0) score += 3;
        else if (hb < 9.0) score += 1;

        if (up >= 2) score += 2;
        if (age < 18 && pc >= 1) score += 3;
        if (pc >= 1) score += 1;

        if (score >= 3) return "HIGH";
        if (score >= 1) return "MODERATE";
        return "LOW";
    }

    public void close() {
        if (interpreter != null) {
            interpreter.close();
        }
    }
}