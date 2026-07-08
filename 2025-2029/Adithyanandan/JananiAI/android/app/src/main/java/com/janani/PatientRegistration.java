package com.janani;

import android.content.ContentValues;
import android.content.Intent;
import android.os.Bundle;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;

public class PatientRegistration extends AppCompatActivity {
    private DatabaseHelper db;
    private EditText nameInput, ageInput, villageInput, ashaIdInput;
    private EditText lmpDateInput, gravidaInput, parityInput, prevComplicationsInput;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_patient_register);

        db = new DatabaseHelper(this);

        nameInput = findViewById(R.id.input_name);
        ageInput = findViewById(R.id.input_age);
        villageInput = findViewById(R.id.input_village);
        ashaIdInput = findViewById(R.id.input_asha_id);
        lmpDateInput = findViewById(R.id.input_lmp_date);
        gravidaInput = findViewById(R.id.input_gravida);
        parityInput = findViewById(R.id.input_parity);
        prevComplicationsInput = findViewById(R.id.input_prev_complications);

        Button saveBtn = findViewById(R.id.btn_save);
        saveBtn.setOnClickListener(v -> savePatient());

        Button cancelBtn = findViewById(R.id.btn_cancel);
        cancelBtn.setOnClickListener(v -> finish());
    }

    private void savePatient() {
        String name = nameInput.getText().toString().trim();
        if (name.isEmpty()) {
            Toast.makeText(this, "Please enter name", Toast.LENGTH_SHORT).show();
            return;
        }

        ContentValues values = new ContentValues();
        values.put("name", name);
        values.put("age", parseIntOrZero(ageInput.getText().toString()));
        values.put("village", villageInput.getText().toString().trim());
        values.put("asha_id", ashaIdInput.getText().toString().trim());
        values.put("lmp_date", lmpDateInput.getText().toString().trim());
        values.put("gravida", parseIntOrZero(gravidaInput.getText().toString()));
        values.put("parity", parseIntOrZero(parityInput.getText().toString()));
        values.put("previous_complications", parseIntOrZero(prevComplicationsInput.getText().toString()));

        long result = db.insertPatient(values);
        if (result > 0) {
            Toast.makeText(this, "Patient registered successfully", Toast.LENGTH_SHORT).show();
            finish();
        } else {
            Toast.makeText(this, "Failed to register patient", Toast.LENGTH_SHORT).show();
        }
    }

    private int parseIntOrZero(String text) {
        try {
            return Integer.parseInt(text.trim());
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}