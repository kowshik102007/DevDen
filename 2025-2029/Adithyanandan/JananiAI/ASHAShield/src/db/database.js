/**
 * db/database.js
 *
 * WHY THIS FILE EXISTS:
 * ASHA Shield works fully OFFLINE — there is no internet in villages like Barmer.
 * SQLite is a file-based database that lives entirely on the Android device.
 * This file sets up the database, creates all tables, and exports helper
 * functions so every screen can read/write data without worrying about SQL.
 *
 * TABLES:
 *  - patients       : one row per registered pregnant woman
 *  - visits         : one row per home visit by an ASHA worker
 *  - risk_flags     : one row per risk event (HIGH/MODERATE flags)
 *  - emergency_contacts : PHC numbers, 108 ambulance, ANM supervisor per district
 */

import SQLite from 'react-native-sqlite-storage';

// Enable promise-based API so we can use async/await instead of callbacks
SQLite.enablePromise(true);

// The database file is stored in the app's private storage on the Android device.
// It persists across app restarts.
let db = null;

/**
 * getDB()
 * Opens (or creates) the SQLite database file.
 * Called once when the app starts — subsequent calls return the same connection.
 */
export const getDB = async () => {
  if (db) return db; // already open — reuse the connection
  db = await SQLite.openDatabase({
    name: 'asha_shield.db',    // filename on device
    location: 'default',       // Android: app-private Documents folder
  });
  await initSchema(); // ensure all tables exist
  return db;
};

/**
 * initSchema()
 * Creates all tables if they don't already exist.
 * Safe to call on every startup — IF NOT EXISTS prevents duplicate creation.
 */
const initSchema = async () => {
  const database = await getDB();

  // ── PATIENTS TABLE ──────────────────────────────────────────────────────────
  // Stores the one-time registration data for each pregnant woman.
  // ASHA workers fill this once; subsequent visits reference patient_id.
  await database.executeSql(`
    CREATE TABLE IF NOT EXISTS patients (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT NOT NULL,
      age             INTEGER,            -- age in years; <18 or >35 are risk modifiers
      village         TEXT,
      district        TEXT,
      phone           TEXT,
      gravida         INTEGER DEFAULT 1,  -- number of pregnancies including current
      parity          INTEGER DEFAULT 0,  -- number of previous deliveries
      lmp             TEXT,               -- Last Menstrual Period date (ISO string)
      edd             TEXT,               -- Expected Delivery Date
      prev_csection   INTEGER DEFAULT 0,  -- boolean: 1 if previous C-section
      prev_pph        INTEGER DEFAULT 0,  -- boolean: 1 if previous PPH
      prev_stillbirth INTEGER DEFAULT 0,  -- boolean: 1 if previous stillbirth
      inter_preg_gap  INTEGER,            -- months between last delivery and this LMP
      blood_group     TEXT,
      asha_id         TEXT,               -- ID of the ASHA worker who registered her
      created_at      TEXT DEFAULT (datetime('now'))
    );
  `);

  // ── VISITS TABLE ────────────────────────────────────────────────────────────
  // Each row is one Antenatal Care (ANC) home visit.
  // These are the vitals the ASHA worker measures during the visit.
  // The ML model reads these columns to compute a risk score.
  await database.executeSql(`
    CREATE TABLE IF NOT EXISTS visits (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id      INTEGER NOT NULL,   -- foreign key → patients.id
      visit_date      TEXT NOT NULL,      -- ISO date of the visit
      gestational_age INTEGER,            -- weeks of pregnancy at this visit
      systolic_bp     INTEGER,            -- mmHg — key pre-eclampsia indicator
      diastolic_bp    INTEGER,            -- mmHg
      weight_kg       REAL,               -- kg — used for weight gain trajectory
      fundal_height   REAL,               -- cm — IUGR detection proxy
      fetal_hr        INTEGER,            -- beats/min — foetal distress flag
      hb_gdl          REAL,               -- haemoglobin g/dL — anaemia severity
      urine_protein   TEXT DEFAULT 'nil', -- dipstick: nil / trace / 1+ / 2+ / 3+
      muac_cm         REAL,               -- Mid-Upper Arm Circumference — nutrition
      notes           TEXT,               -- free-text notes by ASHA worker
      risk_level      TEXT DEFAULT 'LOW', -- LOW / MODERATE / HIGH (from ML model)
      risk_reason     TEXT,               -- plain-language reason string (from SHAP)
      synced          INTEGER DEFAULT 0,  -- 0 = not yet synced to supervisor; 1 = synced
      created_at      TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (patient_id) REFERENCES patients(id)
    );
  `);

  // ── RISK FLAGS TABLE ─────────────────────────────────────────────────────────
  // A lightweight log of every HIGH or MODERATE risk event.
  // Supervisor dashboard reads this for district-level analytics.
  await database.executeSql(`
    CREATE TABLE IF NOT EXISTS risk_flags (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id  INTEGER NOT NULL,
      visit_id    INTEGER NOT NULL,
      flag_level  TEXT NOT NULL,       -- MODERATE or HIGH
      flag_reason TEXT,                -- same plain-language string
      resolved    INTEGER DEFAULT 0,   -- 1 when patient has been referred/treated
      flagged_at  TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (patient_id) REFERENCES patients(id),
      FOREIGN KEY (visit_id)   REFERENCES visits(id)
    );
  `);

  // ── EMERGENCY CONTACTS TABLE ──────────────────────────────────────────────
  // PHC numbers, ANM supervisor numbers, 108 ambulance — pre-loaded per district.
  // Quick-dial buttons on the risk card read from here.
  await database.executeSql(`
    CREATE TABLE IF NOT EXISTS emergency_contacts (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      label    TEXT NOT NULL,    -- e.g. "PHC Barmer", "ANM Supervisor", "108 Ambulance"
      phone    TEXT NOT NULL,
      district TEXT,
      type     TEXT              -- 'ambulance' | 'phc' | 'anm' | 'other'
    );
  `);

  // Seed default emergency contacts if table is empty
  const [result] = await database.executeSql(
    'SELECT COUNT(*) as cnt FROM emergency_contacts'
  );
  if (result.rows.item(0).cnt === 0) {
    await database.executeSql(`
      INSERT INTO emergency_contacts (label, phone, district, type) VALUES
        ('108 Ambulance',       '108',        'All',      'ambulance'),
        ('PHC Barmer',          '02982-220123','Barmer',   'phc'),
        ('ANM Supervisor',      '9876543210', 'Barmer',   'anm'),
        ('PHC Palamu',          '06562-222345','Palamu',   'phc'),
        ('District Hospital',   '102',        'All',      'phc');
    `);
  }
};

// ── PATIENT HELPERS ──────────────────────────────────────────────────────────

/**
 * insertPatient(data)
 * Inserts a new patient row and returns the new row ID.
 * Called from PatientRegistrationScreen after the ASHA worker fills the form.
 */
export const insertPatient = async (data) => {
  const database = await getDB();
  const [res] = await database.executeSql(
    `INSERT INTO patients
       (name, age, village, district, phone, gravida, parity, lmp, edd,
        prev_csection, prev_pph, prev_stillbirth, inter_preg_gap, blood_group, asha_id)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      data.name, data.age, data.village, data.district, data.phone,
      data.gravida, data.parity, data.lmp, data.edd,
      data.prev_csection ? 1 : 0,
      data.prev_pph ? 1 : 0,
      data.prev_stillbirth ? 1 : 0,
      data.inter_preg_gap, data.blood_group, data.asha_id,
    ]
  );
  return res.insertId; // return the new patient's ID
};

/**
 * getAllPatients()
 * Returns all registered patients sorted by latest first.
 * Used by PatientListScreen to show the ASHA worker's full case list.
 */
export const getAllPatients = async () => {
  const database = await getDB();
  const [res] = await database.executeSql(
    `SELECT p.*,
            (SELECT risk_level FROM visits v WHERE v.patient_id = p.id
             ORDER BY v.visit_date DESC LIMIT 1) AS latest_risk
     FROM patients p ORDER BY p.created_at DESC`
  );
  const rows = [];
  for (let i = 0; i < res.rows.length; i++) rows.push(res.rows.item(i));
  return rows;
};

/**
 * getPatientById(id)
 * Returns a single patient row — used by VisitLoggingScreen and RiskCardScreen.
 */
export const getPatientById = async (id) => {
  const database = await getDB();
  const [res] = await database.executeSql(
    'SELECT * FROM patients WHERE id = ?', [id]
  );
  return res.rows.length > 0 ? res.rows.item(0) : null;
};

// ── VISIT HELPERS ────────────────────────────────────────────────────────────

/**
 * insertVisit(data)
 * Saves a new visit row (vitals + computed risk level + reason string).
 * Also inserts a risk_flag row if the level is MODERATE or HIGH.
 */
export const insertVisit = async (data) => {
  const database = await getDB();
  const [res] = await database.executeSql(
    `INSERT INTO visits
       (patient_id, visit_date, gestational_age, systolic_bp, diastolic_bp,
        weight_kg, fundal_height, fetal_hr, hb_gdl, urine_protein,
        muac_cm, notes, risk_level, risk_reason)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      data.patient_id, data.visit_date, data.gestational_age,
      data.systolic_bp, data.diastolic_bp, data.weight_kg,
      data.fundal_height, data.fetal_hr, data.hb_gdl,
      data.urine_protein, data.muac_cm, data.notes,
      data.risk_level, data.risk_reason,
    ]
  );
  const visitId = res.insertId;

  // Auto-log a risk flag for any non-LOW result
  if (data.risk_level !== 'LOW') {
    await database.executeSql(
      `INSERT INTO risk_flags (patient_id, visit_id, flag_level, flag_reason)
       VALUES (?,?,?,?)`,
      [data.patient_id, visitId, data.risk_level, data.risk_reason]
    );
  }
  return visitId;
};

/**
 * getVisitsForPatient(patientId)
 * Returns all visits for a patient in chronological order.
 * Used by the trend graph to show BP / Hb progression across the pregnancy.
 */
export const getVisitsForPatient = async (patientId) => {
  const database = await getDB();
  const [res] = await database.executeSql(
    `SELECT * FROM visits WHERE patient_id = ?
     ORDER BY visit_date ASC`,
    [patientId]
  );
  const rows = [];
  for (let i = 0; i < res.rows.length; i++) rows.push(res.rows.item(i));
  return rows;
};

/**
 * getLatestVisit(patientId)
 * Returns just the most recent visit — used for the risk card summary.
 */
export const getLatestVisit = async (patientId) => {
  const database = await getDB();
  const [res] = await database.executeSql(
    `SELECT * FROM visits WHERE patient_id = ?
     ORDER BY visit_date DESC LIMIT 1`,
    [patientId]
  );
  return res.rows.length > 0 ? res.rows.item(0) : null;
};

// ── EMERGENCY CONTACTS HELPERS ───────────────────────────────────────────────

/**
 * getEmergencyContacts(district)
 * Returns contacts for a specific district + universal contacts (All).
 * Used by the emergency quick-dial buttons on the risk card.
 */
export const getEmergencyContacts = async (district) => {
  const database = await getDB();
  const [res] = await database.executeSql(
    `SELECT * FROM emergency_contacts
     WHERE district = ? OR district = 'All'
     ORDER BY type ASC`,
    [district]
  );
  const rows = [];
  for (let i = 0; i < res.rows.length; i++) rows.push(res.rows.item(i));
  return rows;
};
