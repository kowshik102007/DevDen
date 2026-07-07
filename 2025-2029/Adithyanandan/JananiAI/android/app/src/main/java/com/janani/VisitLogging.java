package com.janani;

import android.content.ContentValues;
import android.content.Intent;
import android.database.Cursor;
import android.os.Bundle;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import org.json.JSONArray;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class VisitLogging extends AppCompatActivity {
    private DatabaseHelper db;
    private RiskEngine riskEngine;
    private TTSHelper ttsHelper;

    private int patientId;
    private boolean isDemoMode = false;
    private String patientName;

    private EditText gestationalAgeInput, systolicBpInput, diastolicBpInput;
    private EditText hemoglobinInput, weightInput, fetalHeartRateInput;
    private EditText urineProteinInput, muacInput, notesInput;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_visit_log);

        db = new DatabaseHelper(this);

        patientId = getIntent().getIntExtra("PATIENT_ID", -1);
        isDemoMode = getIntent().getBooleanExtra("DEMO_MODE", false);

        if (patientId == -1) {
            Toast.makeText(this, "Invalid patient", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        // Initialize TTS
        ttsHelper = new TTSHelper(this);

        // Initialize RiskEngine (model loading happens here)
        try {
            riskEngine = new RiskEngine(this);
        } catch (Exception e) {
            Toast.makeText(this, "Warning: Using fallback risk scoring", Toast.LENGTH_LONG).show();
            riskEngine = null;
        }

        loadPatientInfo();
        setupInputFields();
        setupButtons();

        if (isDemoMode) {
            prefillDemoData();
        }
    }

    private void loadPatientInfo() {
        Cursor cursor = db.getPatientById(patientId);
        if (cursor.moveToFirst()) {
            int nameIndex = cursor.getColumnIndex("name");
            patientName = cursor.getString(nameIndex);

            TextView patientInfo = findViewById(R.id.patient_info);
            patientInfo.setText("Patient: " + patientName);
        }
        cursor.close();
    }

    private void setupInputFields() {
        gestationalAgeInput = findViewById(R.id.input_gestational_age);
        systolicBpInput = findViewById(R.id.input_systolic_bp);
        diastolicBpInput = findViewById(R.id.input_diastolic_bp);
        hemoglobinInput = findViewById(R.id.input_hemoglobin);
        weightInput = findViewById(R.id.input_weight);
        fetalHeartRateInput = findViewById(R.id.input_fetal_heart_rate);
        urineProteinInput = findViewById(R.id.input_urine_protein);
        muacInput = findViewById(R.id.input_muac);
        notesInput = findViewById(R.id.input_notes);
    }

    private void setupButtons() {
        Button submitBtn = findViewById(R.id.btn_submit_visit);
        submitBtn.setOnClickListener(v -> submitVisit());

        Button historyBtn = findViewById(R.id.btn_view_history);
        historyBtn.setOnClickListener(v -> {
            Intent intent = new Intent(this, VisitHistory.class);
            intent.putExtra("PATIENT_ID", patientId);
            startActivity(intent);
        });
    }

    private void prefillDemoData() {
        // Pre-fill Sunita Devi's data for demo
        gestationalAgeInput.setText("32");
        systolicBpInput.setText("148");
        diastolicBpInput.setText("96");
        hemoglobinInput.setText("8.2");
        weightInput.setText("52.0");
        fetalHeartRateInput.setText("145");
        urineProteinInput.setText("1");
        muacInput.setText("23.5");
    }

    private void submitVisit() {
        // Parse all input values
        float gestationalAge = parseFloatOrZero(gestationalAgeInput.getText().toString());
        float systolicBp = parseFloatOrZero(systolicBpInput.getText().toString());
        float diastolicBp = parseFloatOrZero(diastolicBpInput.getText().toString());
        float hemoglobin = parseFloatOrZero(hemoglobinInput.getText().toString());
        float weight = parseFloatOrZero(weightInput.getText().toString());
        float fetalHeartRate = parseFloatOrZero(fetalHeartRateInput.getText().toString());
        float urineProtein = parseFloatOrZero(urineProteinInput.getText().toString());
        float muac = parseFloatOrZero(muacInput.getText().toString());

        if (gestationalAge == 0 || systolicBp == 0 || hemoglobin == 0) {
            Toast.makeText(this, "Please fill in required fields", Toast.LENGTH_SHORT).show();
            return;
        }

        // Build feature array in correct order
        // systolic_bp, diastolic_bp, hemoglobin_gdl, gestational_age_weeks,
        // weight_gain_kg, fetal_heart_rate, urine_protein_dipstick,
        // gravida, parity, age, previous_complications, inter_pregnancy_interval_months, muac_cm

        // Get patient info for gravida, parity, age, etc.
        Cursor cursor = db.getPatientById(patientId);
        float gravida = 1, parity = 0, age = 25, prevComplications = 0, interPregnancyInterval = 0;

        if (cursor.moveToFirst()) {
            int gravidaIndex = cursor.getColumnIndex("gravida");
            int parityIndex = cursor.getColumnIndex("parity");
            int ageIndex = cursor.getColumnIndex("age");
            int prevCompIndex = cursor.getColumnIndex("previous_complications");

            gravida = cursor.getInt(gravidaIndex);
            parity = cursor.getInt(parityIndex);
            age = cursor.getInt(ageIndex);
            prevComplications = cursor.getInt(prevCompIndex);
        }
        cursor.close();

        // Estimate weight gain (for demo, assume 8kg)
        float weightGain = 8.0f;

        float[] features = {
            systolicBp, diastolicBp, hemoglobin, gestationalAge,
            weightGain, fetalHeartRate, urineProtein,
            gravida, parity, age, prevComplications,
            interPregnancyInterval, muac
        };

        // Run inference
        String riskLabel;
        String[] riskReasons;
        float[] probabilities;

        try {
            probabilities = riskEngine.predict(features);
            riskLabel = riskEngine.getRiskLabel(probabilities);
            riskReasons = riskEngine.getTopReasons(features);
        } catch (Exception e) {
            // Fallback to rule-based
            riskLabel = fallbackRiskLabel(features);
            riskReasons = new String[]{"Swasthya janch ho rahi hai", "Doctor se miliye", ""};
            probabilities = new float[]{0.3f, 0.4f, 0.3f};
        }

        // Save to database
        ContentValues visitValues = new ContentValues();
        visitValues.put("patient_id", patientId);
        visitValues.put("visit_date", new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date()));
        visitValues.put("gestational_age_weeks", (int) gestationalAge);
        visitValues.put("systolic_bp", (int) systolicBp);
        visitValues.put("diastolic_bp", (int) diastolicBp);
        visitValues.put("hemoglobin_gdl", hemoglobin);
        visitValues.put("weight_kg", weight);
        visitValues.put("fetal_heart_rate", (int) fetalHeartRate);
        visitValues.put("urine_protein", (int) urineProtein);
        visitValues.put("muac_cm", muac);
        visitValues.put("risk_label", riskLabel);
        visitValues.put("risk_reasons", new JSONArray(riskReasons).toString());
        visitValues.put("notes", notesInput.getText().toString());

        long visitId = db.insertVisit(visitValues);

        if (visitId > 0) {
            // Show risk card
            Intent intent = new Intent(this, RiskCard.class);
            intent.putExtra("RISK_LABEL", riskLabel);
            intent.putExtra("RISK_REASONS", riskReasons);
            intent.putExtra("PATIENT_NAME", patientName);
            intent.putExtra("PATIENT_ID", patientId);
            startActivity(intent);

            // Speak the risk
            String topReason = riskReasons.length > 0 ? riskReasons[0] : "";
            ttsHelper.speakRiskCard(riskLabel, topReason);
        } else {
            Toast.makeText(this, "Failed to save visit", Toast.LENGTH_SHORT).show();
        }
    }

    private String fallbackRiskLabel(float[] features) {
        float sbp = features[0];
        float hb = features[2];
        int up = (int) features[6];

        int score = 0;
        if (sbp >= 160) score += 3;
        else if (sbp >= 140) score += 2;
        else if (sbp >= 130) score += 1;

        if (hb < 7.0) score += 3;
        else if (hb < 9.0) score += 1;

        if (up >= 2) score += 2;

        if (score >= 3) return "HIGH";
        if (score >= 1) return "MODERATE";
        return "LOW";
    }

    private float parseFloatOrZero(String text) {
        try {
            return Float.parseFloat(text.trim());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (ttsHelper != null) {
            ttsHelper.shutdown();
        }
        if (riskEngine != null) {
            riskEngine.close();
        }
    }
}