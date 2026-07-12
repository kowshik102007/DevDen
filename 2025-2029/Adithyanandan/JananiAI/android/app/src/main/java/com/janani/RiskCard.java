package com.janani;

import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;

public class RiskCard extends AppCompatActivity {
    private String riskLabel;
    private String[] riskReasons;
    private String patientName;
    private int patientId;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_risk_card);

        Intent intent = getIntent();
        riskLabel = intent.getStringExtra("RISK_LABEL");
        riskReasons = intent.getStringArrayExtra("RISK_REASONS");
        patientName = intent.getStringExtra("PATIENT_NAME");
        patientId = intent.getIntExtra("PATIENT_ID", -1);

        displayRiskCard();
        setupActionButtons();
    }

    private void displayRiskCard() {
        TextView titleText = findViewById(R.id.risk_title);
        TextView riskLevelText = findViewById(R.id.risk_level);
        TextView reasonsText = findViewById(R.id.reasons_text);

        View cardBackground = findViewById(R.id.card_background);

        if ("HIGH".equals(riskLabel)) {
            cardBackground.setBackgroundColor(0xFFC62828);  // Red
            titleText.setText("🔴  KHATRA — UCHCH JOKHIM");
            riskLevelText.setText("HIGH RISK");
            riskLevelText.setTextColor(0xFFFFFFFF);
        } else if ("MODERATE".equals(riskLabel)) {
            cardBackground.setBackgroundColor(0xFFF57F17);  // Yellow/Orange
            titleText.setText("🟡  DHYAN — MADHYAM JOKHIM");
            riskLevelText.setText("MODERATE RISK");
            riskLevelText.setTextColor(0xFF000000);
        } else {
            cardBackground.setBackgroundColor(0xFF2E7D32);  // Green
            titleText.setText("🟢  SWASTHYA — NICH JOKHIM");
            riskLevelText.setText("LOW RISK");
            riskLevelText.setTextColor(0xFFFFFFFF);
        }

        titleText.setTextColor(0xFFFFFFFF);
        reasonsText.setTextColor(0xFFFFFFFF);

        StringBuilder reasonsBuilder = new StringBuilder();
        reasonsBuilder.append("Kaaran:\n");
        if (riskReasons != null && riskReasons.length > 0) {
            for (String reason : riskReasons) {
                if (reason != null && !reason.isEmpty()) {
                    reasonsBuilder.append("• ").append(reason).append("\n");
                }
            }
        } else {
            reasonsBuilder.append("• Koi特別dhyan dene ki zaroorat nahi");
        }
        reasonsText.setText(reasonsBuilder.toString());
    }

    private void setupActionButtons() {
        Button ambulanceBtn = findViewById(R.id.btn_ambulance);
        Button anmBtn = findViewById(R.id.btn_anm);
        Button phcBtn = findViewById(R.id.btn_phc);
        Button closeBtn = findViewById(R.id.btn_close);

        ambulanceBtn.setOnClickListener(v -> {
            Intent callIntent = new Intent(Intent.ACTION_DIAL);
            callIntent.setData(Uri.parse("tel:108"));
            startActivity(callIntent);
        });

        anmBtn.setOnClickListener(v -> {
            // Navigate to ANM contact or message screen
            Intent intent = new Intent(this, MainActivity.class);
            intent.putExtra("ACTION", "CONTACT_ANM");
            startActivity(intent);
        });

        phcBtn.setOnClickListener(v -> {
            // Open map or show PHC directions
            Intent intent = new Intent(this, MainActivity.class);
            intent.putExtra("ACTION", "PHC_DIRECTIONS");
            startActivity(intent);
        });

        closeBtn.setOnClickListener(v -> finish());
    }
}