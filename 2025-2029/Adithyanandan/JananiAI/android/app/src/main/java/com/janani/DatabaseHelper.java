package com.janani;

import android.content.Context;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.database.Cursor;

public class DatabaseHelper extends SQLiteOpenHelper {
    private static final String DATABASE_NAME = "janani.db";
    private static final int DATABASE_VERSION = 1;

    // Patients table
    public static final String TABLE_PATIENTS = "patients";
    public static final String COL_PATIENT_ID = "id";
    public static final String COL_NAME = "name";
    public static final String COL_AGE = "age";
    public static final String COL_VILLAGE = "village";
    public static final String COL_ASHA_ID = "asha_id";
    public static final String COL_LMP_DATE = "lmp_date";
    public static final String COL_GRAVIDA = "gravida";
    public static final String COL_PARITY = "parity";
    public static final String COL_PREV_COMPLICATIONS = "previous_complications";
    public static final String COL_REGISTERED_AT = "registered_at";

    // Visits table
    public static final String TABLE_VISITS = "visits";
    public static final String COL_VISIT_ID = "id";
    public static final String COL_FK_PATIENT_ID = "patient_id";
    public static final String COL_VISIT_DATE = "visit_date";
    public static final String COL_GESTATIONAL_AGE = "gestational_age_weeks";
    public static final String COL_SYSTOLIC_BP = "systolic_bp";
    public static final String COL_DIASTOLIC_BP = "diastolic_bp";
    public static final String COL_HEMOGLOBIN = "hemoglobin_gdl";
    public static final String COL_WEIGHT_KG = "weight_kg";
    public static final String COL_FETAL_HEART_RATE = "fetal_heart_rate";
    public static final String COL_URINE_PROTEIN = "urine_protein";
    public static final String COL_MUAC_CM = "muac_cm";
    public static final String COL_RISK_LABEL = "risk_label";
    public static final String COL_RISK_REASONS = "risk_reasons";
    public static final String COL_NOTES = "notes";
    public static final String COL_CREATED_AT = "created_at";

    private static final String CREATE_PATIENTS_TABLE =
        "CREATE TABLE " + TABLE_PATIENTS + " (" +
        COL_PATIENT_ID + " INTEGER PRIMARY KEY AUTOINCREMENT, " +
        COL_NAME + " TEXT NOT NULL, " +
        COL_AGE + " INTEGER, " +
        COL_VILLAGE + " TEXT, " +
        COL_ASHA_ID + " TEXT, " +
        COL_LMP_DATE + " TEXT, " +
        COL_GRAVIDA + " INTEGER, " +
        COL_PARITY + " INTEGER, " +
        COL_PREV_COMPLICATIONS + " INTEGER DEFAULT 0, " +
        COL_REGISTERED_AT + " TEXT DEFAULT CURRENT_TIMESTAMP)";

    private static final String CREATE_VISITS_TABLE =
        "CREATE TABLE " + TABLE_VISITS + " (" +
        COL_VISIT_ID + " INTEGER PRIMARY KEY AUTOINCREMENT, " +
        COL_FK_PATIENT_ID + " INTEGER REFERENCES patients(id), " +
        COL_VISIT_DATE + " TEXT, " +
        COL_GESTATIONAL_AGE + " INTEGER, " +
        COL_SYSTOLIC_BP + " INTEGER, " +
        COL_DIASTOLIC_BP + " INTEGER, " +
        COL_HEMOGLOBIN + " REAL, " +
        COL_WEIGHT_KG + " REAL, " +
        COL_FETAL_HEART_RATE + " INTEGER, " +
        COL_URINE_PROTEIN + " INTEGER, " +
        COL_MUAC_CM + " REAL, " +
        COL_RISK_LABEL + " TEXT, " +
        COL_RISK_REASONS + " TEXT, " +
        COL_NOTES + " TEXT, " +
        COL_CREATED_AT + " TEXT DEFAULT CURRENT_TIMESTAMP)";

    public DatabaseHelper(Context context) {
        super(context, DATABASE_NAME, null, DATABASE_VERSION);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL(CREATE_PATIENTS_TABLE);
        db.execSQL(CREATE_VISITS_TABLE);
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        db.execSQL("DROP TABLE IF EXISTS " + TABLE_VISITS);
        db.execSQL("DROP TABLE IF EXISTS " + TABLE_PATIENTS);
        onCreate(db);
    }

    // Insert a new patient, return row ID
    public long insertPatient(ContentValues values) {
        SQLiteDatabase db = getWritableDatabase();
        return db.insert(TABLE_PATIENTS, null, values);
    }

    // Insert a visit
    public long insertVisit(ContentValues values) {
        SQLiteDatabase db = getWritableDatabase();
        return db.insert(TABLE_VISITS, null, values);
    }

    // Get all patients
    public Cursor getAllPatients() {
        SQLiteDatabase db = getReadableDatabase();
        return db.query(TABLE_PATIENTS, null, null, null, null, null, COL_REGISTERED_AT + " DESC");
    }

    // Get patient by ID
    public Cursor getPatientById(int patientId) {
        SQLiteDatabase db = getReadableDatabase();
        return db.query(TABLE_PATIENTS, null, COL_PATIENT_ID + " = ?",
            new String[]{String.valueOf(patientId)}, null, null, null);
    }

    // Get visits for a patient
    public Cursor getVisitsForPatient(int patientId) {
        SQLiteDatabase db = getReadableDatabase();
        return db.query(TABLE_VISITS, null, COL_FK_PATIENT_ID + " = ?",
            new String[]{String.valueOf(patientId)}, null, null, COL_VISIT_DATE + " DESC");
    }

    // Get all HIGH risk patients
    public Cursor getHighRiskPatients() {
        SQLiteDatabase db = getReadableDatabase();
        String query = "SELECT p.*, v." + COL_VISIT_DATE + ", v." + COL_RISK_LABEL +
            " FROM " + TABLE_PATIENTS + " p " +
            " INNER JOIN " + TABLE_VISITS + " v ON p." + COL_PATIENT_ID + " = v." + COL_FK_PATIENT_ID +
            " WHERE v." + COL_RISK_LABEL + " = 'HIGH' " +
            " GROUP BY p." + COL_PATIENT_ID;
        return db.rawQuery(query, null);
    }

    // Delete patient and their visits
    public void deletePatient(int patientId) {
        SQLiteDatabase db = getWritableDatabase();
        db.delete(TABLE_VISITS, COL_FK_PATIENT_ID + " = ?", new String[]{String.valueOf(patientId)});
        db.delete(TABLE_PATIENTS, COL_PATIENT_ID + " = ?", new String[]{String.valueOf(patientId)});
    }

    // Update patient
    public int updatePatient(int patientId, ContentValues values) {
        SQLiteDatabase db = getWritableDatabase();
        return db.update(TABLE_PATIENTS, values, COL_PATIENT_ID + " = ?",
            new String[]{String.valueOf(patientId)});
    }

    // Get patient count
    public int getPatientCount() {
        SQLiteDatabase db = getReadableDatabase();
        Cursor c = db.rawQuery("SELECT COUNT(*) FROM " + TABLE_PATIENTS, null);
        c.moveToFirst();
        int count = c.getInt(0);
        c.close();
        return count;
    }

    // Demo: Pre-populate with sample patients
    public void populateDemoData() {
        if (getPatientCount() > 0) return;  // Already populated

        ContentValues patient1 = new ContentValues();
        patient1.put(COL_NAME, "Sunita Devi");
        patient1.put(COL_AGE, 28);
        patient1.put(COL_VILLAGE, "Harsani");
        patient1.put(COL_ASHA_ID, "ASHA001");
        patient1.put(COL_LMP_DATE, "2026-01-15");
        patient1.put(COL_GRAVIDA, 3);
        patient1.put(COL_PARITY, 2);
        patient1.put(COL_PREV_COMPLICATIONS, 0);
        long p1Id = insertPatient(patient1);

        ContentValues visit1 = new ContentValues();
        visit1.put(COL_FK_PATIENT_ID, p1Id);
        visit1.put(COL_VISIT_DATE, "2026-04-28");
        visit1.put(COL_GESTATIONAL_AGE, 32);
        visit1.put(COL_SYSTOLIC_BP, 148);
        visit1.put(COL_DIASTOLIC_BP, 96);
        visit1.put(COL_HEMOGLOBIN, 8.2);
        visit1.put(COL_WEIGHT_KG, 52.0);
        visit1.put(COL_FETAL_HEART_RATE, 145);
        visit1.put(COL_URINE_PROTEIN, 1);
        visit1.put(COL_MUAC_CM, 23.5);
        visit1.put(COL_RISK_LABEL, "HIGH");
        visit1.put(COL_RISK_REASONS, "[\"BP bahut zyada hai — aaj PHC jaana zaroori hai\", \"Khoon ki kami hai — iron injection ki zaroorat ho sakti hai\"]");
        insertVisit(visit1);

        // LOW risk patients
        ContentValues patient2 = new ContentValues();
        patient2.put(COL_NAME, "Lakshmi Devi");
        patient2.put(COL_AGE, 25);
        patient2.put(COL_VILLAGE, "Bhanpura");
        patient2.put(COL_ASHA_ID, "ASHA001");
        patient2.put(COL_LMP_DATE, "2026-02-20");
        patient2.put(COL_GRAVIDA, 2);
        patient2.put(COL_PARITY, 1);
        patient2.put(COL_PREV_COMPLICATIONS, 0);
        long p2Id = insertPatient(patient2);

        ContentValues visit2 = new ContentValues();
        visit2.put(COL_FK_PATIENT_ID, p2Id);
        visit2.put(COL_VISIT_DATE, "2026-04-27");
        visit2.put(COL_GESTATIONAL_AGE, 28);
        visit2.put(COL_SYSTOLIC_BP, 112);
        visit2.put(COL_DIASTOLIC_BP, 72);
        visit2.put(COL_HEMOGLOBIN, 11.5);
        visit2.put(COL_WEIGHT_KG, 58.0);
        visit2.put(COL_FETAL_HEART_RATE, 152);
        visit2.put(COL_URINE_PROTEIN, 0);
        visit2.put(COL_MUAC_CM, 26.0);
        visit2.put(COL_RISK_LABEL, "LOW");
        visit2.put(COL_RISK_REASONS, "[]");
        insertVisit(visit2);

        ContentValues patient3 = new ContentValues();
        patient3.put(COL_NAME, "Geeta Bai");
        patient3.put(COL_AGE, 30);
        patient3.put(COL_VILLAGE, "Sardarpur");
        patient3.put(COL_ASHA_ID, "ASHA002");
        patient3.put(COL_LMP_DATE, "2026-01-10");
        patient3.put(COL_GRAVIDA, 4);
        patient3.put(COL_PARITY, 3);
        patient3.put(COL_PREV_COMPLICATIONS, 0);
        long p3Id = insertPatient(patient3);

        ContentValues visit3 = new ContentValues();
        visit3.put(COL_FK_PATIENT_ID, p3Id);
        visit3.put(COL_VISIT_DATE, "2026-04-25");
        visit3.put(COL_GESTATIONAL_AGE, 34);
        visit3.put(COL_SYSTOLIC_BP, 118);
        visit3.put(COL_DIASTOLIC_BP, 78);
        visit3.put(COL_HEMOGLOBIN, 10.8);
        visit3.put(COL_WEIGHT_KG, 60.0);
        visit3.put(COL_FETAL_HEART_RATE, 148);
        visit3.put(COL_URINE_PROTEIN, 0);
        visit3.put(COL_MUAC_CM, 25.5);
        visit3.put(COL_RISK_LABEL, "LOW");
        visit3.put(COL_RISK_REASONS, "[]");
        insertVisit(visit3);

        ContentValues patient4 = new ContentValues();
        patient4.put(COL_NAME, "Maya Kumari");
        patient4.put(COL_AGE, 22);
        patient4.put(COL_VILLAGE, "Kota");
        patient4.put(COL_ASHA_ID, "ASHA001");
        patient4.put(COL_LMP_DATE, "2026-02-01");
        patient4.put(COL_GRAVIDA, 1);
        patient4.put(COL_PARITY, 0);
        patient4.put(COL_PREV_COMPLICATIONS, 0);
        long p4Id = insertPatient(patient4);

        ContentValues visit4 = new ContentValues();
        visit4.put(COL_FK_PATIENT_ID, p4Id);
        visit4.put(COL_VISIT_DATE, "2026-04-26");
        visit4.put(COL_GESTATIONAL_AGE, 26);
        visit4.put(COL_SYSTOLIC_BP, 108);
        visit4.put(COL_DIASTOLIC_BP, 68);
        visit4.put(COL_HEMOGLOBIN, 11.2);
        visit4.put(COL_WEIGHT_KG, 54.0);
        visit4.put(COL_FETAL_HEART_RATE, 150);
        visit4.put(COL_URINE_PROTEIN, 0);
        visit4.put(COL_MUAC_CM, 25.0);
        visit4.put(COL_RISK_LABEL, "LOW");
        visit4.put(COL_RISK_REASONS, "[]");
        insertVisit(visit4);

        // MODERATE risk patient
        ContentValues patient5 = new ContentValues();
        patient5.put(COL_NAME, "Rameshvari");
        patient5.put(COL_AGE, 32);
        patient5.put(COL_VILLAGE, "Harsani");
        patient5.put(COL_ASHA_ID, "ASHA001");
        patient5.put(COL_LMP_DATE, "2026-01-05");
        patient5.put(COL_GRAVIDA, 5);
        patient5.put(COL_PARITY, 4);
        patient5.put(COL_PREV_COMPLICATIONS, 1);
        long p5Id = insertPatient(patient5);

        ContentValues visit5 = new ContentValues();
        visit5.put(COL_FK_PATIENT_ID, p5Id);
        visit5.put(COL_VISIT_DATE, "2026-04-29");
        visit5.put(COL_GESTATIONAL_AGE, 36);
        visit5.put(COL_SYSTOLIC_BP, 134);
        visit5.put(COL_DIASTOLIC_BP, 86);
        visit5.put(COL_HEMOGLOBIN, 8.8);
        visit5.put(COL_WEIGHT_KG, 56.0);
        visit5.put(COL_FETAL_HEART_RATE, 140);
        visit5.put(COL_URINE_PROTEIN, 1);
        visit5.put(COL_MUAC_CM, 22.5);
        visit5.put(COL_RISK_LABEL, "MODERATE");
        visit5.put(COL_RISK_REASONS, "[\"BP upar border par hai — dhyan rakhein\", \"Khoon ki kami mild hai — iron tablet lein\"]");
        insertVisit(visit5);
    }
}