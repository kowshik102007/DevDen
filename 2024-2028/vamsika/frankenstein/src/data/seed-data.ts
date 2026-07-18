/**
 * Seeded FHIR-shaped patient data
 *
 * Realistic synthetic data for demo purposes.
 * Each patient has vitals, medications, lab results, and notes.
 */

export const SEEDED_PATIENTS = [
  {
    id: 'PAT-001',
    name: 'Arjun Sharma',
    age: 67,
    department: 'ICU',
    bed: 'ICU-03',
    vitals: {
      heartRate: 132,        // ← will trigger heartRate > 120 (warning)
      bloodPressureSystolic: 155,
      bloodPressureDiastolic: 95,
      spo2: 87,              // ← will trigger spo2 < 90 (critical)
      temperature: 38.9,
      respiratoryRate: 22,
      lastUpdated: new Date().toISOString(),
    },
    medications: [
      { name: 'Metoprolol', dose: '25mg', schedule: '08:00, 20:00', lastAdministered: '06:00' },  // ← overdue
      { name: 'Aspirin', dose: '100mg', schedule: '08:00', lastAdministered: '08:05' },
      { name: 'Heparin', dose: '5000 IU', schedule: '06:00, 18:00', lastAdministered: '18:10' },
    ],
    labResults: [
      { testName: 'Troponin', value: '2.4 ng/mL', status: 'critical', timestamp: new Date(Date.now() - 30 * 60000).toISOString(), reviewed: false },
      { testName: 'WBC', value: '14.2 K/uL', status: 'abnormal', timestamp: new Date(Date.now() - 45 * 60000).toISOString(), reviewed: true },
      { testName: 'Creatinine', value: '1.8 mg/dL', status: 'abnormal', timestamp: new Date(Date.now() - 90 * 60000).toISOString(), reviewed: false },
    ],
    notes: [
      { text: 'Patient reported chest pain at 03:00. ECG ordered. Fall risk noted.', author: 'Nurse Priya', time: new Date(Date.now() - 3 * 3600000).toISOString() },
      { text: 'Pain managed with morphine 2mg IV. Patient resting now. Wound dressing intact.', author: 'Nurse Anil', time: new Date(Date.now() - 1 * 3600000).toISOString() },
      { text: 'Vitals trending upward — HR increasing over last 2 hours. Febrile. Notified Dr. Mehta.', author: 'Nurse Priya', time: new Date(Date.now() - 20 * 60000).toISOString() },
    ],
  },
  {
    id: 'PAT-002',
    name: 'Lakshmi Nair',
    age: 45,
    department: 'General Ward',
    bed: 'GW-12',
    vitals: {
      heartRate: 78,
      bloodPressureSystolic: 185,    // ← will trigger BP > 180 (critical)
      bloodPressureDiastolic: 110,
      spo2: 96,
      temperature: 37.1,
      respiratoryRate: 16,
      lastUpdated: new Date().toISOString(),
    },
    medications: [
      { name: 'Amlodipine', dose: '5mg', schedule: '07:00', lastAdministered: '07:05' },
      { name: 'Telmisartan', dose: '40mg', schedule: '07:00', lastAdministered: '07:05' },
    ],
    labResults: [
      { testName: 'HbA1c', value: '8.2%', status: 'abnormal', timestamp: new Date(Date.now() - 2 * 3600000).toISOString(), reviewed: true },
    ],
    notes: [
      { text: 'Patient agitated overnight. Declined oral meds. Counseled on medication compliance.', author: 'Nurse Deepa', time: new Date(Date.now() - 6 * 3600000).toISOString() },
    ],
  },
  {
    id: 'PAT-003',
    name: 'Ravi Menon',
    age: 72,
    department: 'ICU',
    bed: 'ICU-07',
    vitals: {
      heartRate: 55,
      bloodPressureSystolic: 100,
      bloodPressureDiastolic: 65,
      spo2: 93,
      temperature: 36.2,           // ← will trigger temp < 35? No, 36.2 > 35. Safe.
      respiratoryRate: 28,          // ← will trigger RR > 25 (warning)
      lastUpdated: new Date().toISOString(),
    },
    medications: [
      { name: 'Warfarin', dose: '5mg', schedule: '09:00', lastAdministered: '09:10' },
      { name: 'Digoxin', dose: '0.125mg', schedule: '09:00', lastAdministered: '09:10' },
    ],
    labResults: [
      { testName: 'INR', value: '4.2', status: 'critical', timestamp: new Date(Date.now() - 15 * 60000).toISOString(), reviewed: false },
      { testName: 'Potassium', value: '5.8 mEq/L', status: 'critical', timestamp: new Date(Date.now() - 40 * 60000).toISOString(), reviewed: false },
    ],
    notes: [
      { text: 'Post-surgical recovery. Wound site clean, no signs of infection. Mild fever earlier, resolved.', author: 'Nurse Kavitha', time: new Date(Date.now() - 2 * 3600000).toISOString() },
    ],
  },
  {
    id: 'PAT-004',
    name: 'Sneha Pillai',
    age: 34,
    department: 'General Ward',
    bed: 'GW-05',
    vitals: {
      heartRate: 82,
      bloodPressureSystolic: 118,
      bloodPressureDiastolic: 76,
      spo2: 99,
      temperature: 36.8,
      respiratoryRate: 14,
      lastUpdated: new Date().toISOString(),
    },
    medications: [
      { name: 'Ondansetron', dose: '4mg', schedule: 'PRN', lastAdministered: '14:00' },
    ],
    labResults: [
      { testName: 'Hemoglobin', value: '11.2 g/dL', status: 'normal', timestamp: new Date(Date.now() - 5 * 3600000).toISOString(), reviewed: true },
    ],
    notes: [
      { text: 'Stable. Discharge planned tomorrow. Patient counselled on follow-up.', author: 'Nurse Anjali', time: new Date(Date.now() - 1 * 3600000).toISOString() },
    ],
  },
  {
    id: 'PAT-005',
    name: 'Krishnan Iyer',
    age: 58,
    department: 'ICU',
    bed: 'ICU-11',
    vitals: {
      heartRate: 155,               // ← will trigger HR > 150 (critical)
      bloodPressureSystolic: 92,    // ← will trigger BP < 90? No, 92 > 90. Safe.
      bloodPressureDiastolic: 60,
      spo2: 82,                     // ← will trigger spo2 < 90 (critical)
      temperature: 39.4,             // ← will trigger temp > 39 (warning)
      respiratoryRate: 30,
      lastUpdated: new Date().toISOString(),
    },
    medications: [
      { name: 'Amiodarone', dose: '150mg IV', schedule: 'PRN', lastAdministered: '15:30' },
      { name: 'Noradrenaline', dose: '0.5 mcg/kg/min', schedule: 'continuous', lastAdministered: 'continuous' },
    ],
    labResults: [
      { testName: 'Lactate', value: '6.1 mmol/L', status: 'critical', timestamp: new Date(Date.now() - 10 * 60000).toISOString(), reviewed: false },
      { testName: 'pH', value: '7.18', status: 'critical', timestamp: new Date(Date.now() - 10 * 60000).toISOString(), reviewed: false },
    ],
    notes: [
      { text: 'Septic shock — vasopressors running. Fever spike. Team notified for emergent review.', author: 'Nurse Rajesh', time: new Date(Date.now() - 15 * 60000).toISOString() },
    ],
  },
];
