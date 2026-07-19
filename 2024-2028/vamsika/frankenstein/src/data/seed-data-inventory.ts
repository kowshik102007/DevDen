/**
 * Seeded blood bank inventory + ward/bed data
 */

export const BLOOD_BANK_INVENTORY = [
  { bloodType: 'A+', unitsRemaining: 8, expiryDays: 12, lastUpdated: new Date().toISOString() },
  { bloodType: 'A-', unitsRemaining: 2, expiryDays: 5, lastUpdated: new Date().toISOString() },   // ← critical
  { bloodType: 'B+', unitsRemaining: 15, expiryDays: 21, lastUpdated: new Date().toISOString() },
  { bloodType: 'B-', unitsRemaining: 3, expiryDays: 3, lastUpdated: new Date().toISOString() },   // ← critical + expiring
  { bloodType: 'AB+', unitsRemaining: 6, expiryDays: 9, lastUpdated: new Date().toISOString() },
  { bloodType: 'AB-', unitsRemaining: 1, expiryDays: 14, lastUpdated: new Date().toISOString() },  // ← critical
  { bloodType: 'O+', unitsRemaining: 22, expiryDays: 18, lastUpdated: new Date().toISOString() },
  { bloodType: 'O-', unitsRemaining: 5, expiryDays: 6, lastUpdated: new Date().toISOString() }, // ← low
];

export const WARD_BEDS = [
  { ward: 'ICU', totalBeds: 20, occupied: 18, patients: ['PAT-001', 'PAT-003', 'PAT-005'] },
  { ward: 'General Ward', totalBeds: 50, occupied: 44, patients: ['PAT-002', 'PAT-004'] },
  { ward: 'Emergency', totalBeds: 15, occupied: 14, patients: [] },
  { ward: 'Pediatric', totalBeds: 20, occupied: 8, patients: [] },
  { ward: 'Maternity', totalBeds: 25, occupied: 19, patients: [] },
];

export const DRUG_INTERACTIONS = [
  { drug1: 'Warfarin', drug2: 'Aspirin', severity: 'high', description: 'Increased bleeding risk' },
  { drug1: 'Digoxin', drug2: 'Amiodarone', severity: 'high', description: 'Digoxin toxicity risk — monitor levels' },
  { drug1: 'Metoprolol', drug2: 'Amlodipine', severity: 'medium', description: 'Additive bradycardia risk' },
];
