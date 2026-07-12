package com.janani;

import android.content.ContentValues;
import android.content.Intent;
import android.database.Cursor;
import android.os.Bundle;
import android.view.View;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ListView;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class MainActivity extends AppCompatActivity {
    private DatabaseHelper db;
    private ListView patientList;
    private TextView emptyText;
    private int demoTapCount = 0;
    private long lastTapTime = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        db = new DatabaseHelper(this);
        db.populateDemoData();  // Ensure demo data exists

        patientList = findViewById(R.id.patient_list);
        emptyText = findViewById(R.id.empty_text);

        loadPatients();

        Button addPatientBtn = findViewById(R.id.btn_add_patient);
        addPatientBtn.setOnClickListener(v -> {
            Intent intent = new Intent(this, PatientRegistration.class);
            startActivity(intent);
        });

        // Demo mode trigger: triple tap on title
        TextView title = findViewById(R.id.app_title);
        title.setOnClickListener(v -> {
            long now = System.currentTimeMillis();
            if (now - lastTapTime < 500) {
                demoTapCount++;
            } else {
                demoTapCount = 1;
            }
            lastTapTime = now;

            if (demoTapCount >= 3) {
                demoTapCount = 0;
                runDemoMode();
            }
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        loadPatients();
    }

    private void loadPatients() {
        Cursor cursor = db.getAllPatients();
        List<String> patientNames = new ArrayList<>();
        List<Integer> patientIds = new ArrayList<>();

        if (cursor.moveToFirst()) {
            do {
                int idIndex = cursor.getColumnIndex("id");
                int nameIndex = cursor.getColumnIndex("name");
                int villageIndex = cursor.getColumnIndex("village");
                int ageIndex = cursor.getColumnIndex("age");

                int id = cursor.getInt(idIndex);
                String name = cursor.getString(nameIndex);
                String village = cursor.getString(villageIndex);
                int age = cursor.getInt(ageIndex);

                patientNames.add(name + " (" + age + ") - " + village);
                patientIds.add(id);
            } while (cursor.moveToNext());
        }
        cursor.close();

        if (patientNames.isEmpty()) {
            emptyText.setVisibility(View.VISIBLE);
            patientList.setVisibility(View.GONE);
        } else {
            emptyText.setVisibility(View.GONE);
            patientList.setVisibility(View.VISIBLE);

            ArrayAdapter<String> adapter = new ArrayAdapter<>(this,
                android.R.layout.simple_list_item_1, patientNames);
            patientList.setAdapter(adapter);

            patientList.setOnItemClickListener((parent, view, position, id) -> {
                int patientId = patientIds.get(position);
                openPatientDetails(patientId);
            });
        }
    }

    private void openPatientDetails(int patientId) {
        Intent intent = new Intent(this, VisitLogging.class);
        intent.putExtra("PATIENT_ID", patientId);
        startActivity(intent);
    }

    private void runDemoMode() {
        Toast.makeText(this, "Demo Mode Activated", Toast.LENGTH_SHORT).show();

        // Navigate to Sunita Devi's visit logging
        Cursor patients = db.getAllPatients();
        int sunitaId = -1;

        if (patients.moveToFirst()) {
            do {
                int nameIndex = patients.getColumnIndex("name");
                String name = patients.getString(nameIndex);
                if ("Sunita Devi".equals(name)) {
                    sunitaId = patients.getInt(patients.getColumnIndex("id"));
                    break;
                }
            } while (patients.moveToNext());
        }
        patients.close();

        if (sunitaId != -1) {
            Intent intent = new Intent(this, VisitLogging.class);
            intent.putExtra("PATIENT_ID", sunitaId);
            intent.putExtra("DEMO_MODE", true);
            startActivity(intent);
        }
    }
}