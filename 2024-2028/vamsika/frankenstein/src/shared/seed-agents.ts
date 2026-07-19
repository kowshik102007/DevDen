/**
 * Seed Agents
 *
 * Pre-seeds 6 agents on first boot so the dashboard
 * has live data immediately. Only seeds if no agents exist.
 */

import { AgentSpec } from '../schemas/agent-spec.schema.js';
import { AgentRegistryService } from '../registry/agent-registry.service.js';

const SEED_AGENTS: AgentSpec[] = [
  {
    templateId: 'vitals-monitoring',
    name: 'ICU Vitals Guardian',
    description: 'Monitors ICU patient vitals — alerts on tachycardia, hypoxemia, hypertensive crisis, and fever',
    config: {
      thresholds: {
        heartRateHigh: 120,
        heartRateLow: 50,
        spo2Low: 90,
        bloodPressureSystolicHigh: 180,
        temperatureHigh: 39.0,
        respiratoryRateHigh: 25,
      },
      resourceEndpoint: 'fhir://patients/*/observations',
      checkIntervalSeconds: 30,
      alertRules: [
        { condition: 'heartRate > 120', severity: 'warning', message: 'Elevated heart rate: {value} bpm for patient {patientId}' },
        { condition: 'heartRate > 150', severity: 'critical', message: 'CRITICAL: Tachycardia — {value} bpm for patient {patientId}' },
        { condition: 'spo2 < 90', severity: 'critical', message: 'CRITICAL: Hypoxemia — SpO2 at {value}% for patient {patientId}' },
        { condition: 'bloodPressureSystolic > 180', severity: 'critical', message: 'CRITICAL: Hypertensive crisis — {value} mmHg' },
        { condition: 'respiratoryRate > 25', severity: 'warning', message: 'Elevated respiratory rate: {value} breaths/min' },
        { condition: 'temperature > 39', severity: 'warning', message: 'Fever detected: {value}°C for patient {patientId}' },
      ],
    },
  },
  {
    templateId: 'blood-bank-inventory',
    name: 'Blood Bank Sentinel',
    description: 'Tracks blood bank stock levels and alerts on critically low inventory or upcoming expiries',
    config: {
      thresholds: {
        minUnitsByType: 10,
        criticalUnitsByType: 3,
        expiryWarningDays: 7,
      },
      resourceEndpoint: 'fhir://blood-bank/inventory',
      checkIntervalSeconds: 60,
      alertRules: [
        { condition: 'unitsRemaining <= 3', severity: 'critical', message: 'CRITICAL: {bloodType} critically low — only {value} units remaining' },
        { condition: 'unitsRemaining <= 10', severity: 'warning', message: 'Low stock: {bloodType} — {value} units remaining' },
        { condition: 'daysUntilExpiry <= 7', severity: 'warning', message: 'Expiring soon: {value} units of {bloodType} expire within 7 days' },
      ],
    },
  },
  {
    templateId: 'nurse-notes-summarizer',
    name: 'Shift Notes Scanner',
    description: 'Scans nurse shift notes for flagged keywords (fall, pain, fever, wound) and highlights action items',
    config: {
      thresholds: {
        maxNotesAge: 8,
        flagKeywords: 'fall, pain, fever, decline, agitation, wound',
      },
      resourceEndpoint: 'fhir://patients/*/notes',
      checkIntervalSeconds: 120,
      alertRules: [
        { condition: 'note contains flagged keyword', severity: 'warning', message: 'Flagged keyword "{keyword}" in note for patient {patientId}' },
        { condition: 'no notes in last 8 hours', severity: 'info', message: 'No recent notes for patient {patientId}' },
      ],
    },
  },
  {
    templateId: 'medication-tracker',
    name: 'Medication Compliance Monitor',
    description: 'Tracks scheduled medications and flags overdue doses and drug interactions',
    config: {
      thresholds: {
        overdueMinutes: 30,
      },
      resourceEndpoint: 'fhir://patients/*/medications',
      checkIntervalSeconds: 60,
      alertRules: [
        { condition: 'dose overdue by > 30 min', severity: 'warning', message: 'Missed dose: {medication} for patient {patientId} — overdue by {value} min' },
        { condition: 'drug interaction detected', severity: 'critical', message: 'CRITICAL: Drug interaction for patient {patientId} — {medication}' },
      ],
    },
  },
  {
    templateId: 'bed-status-monitor',
    name: 'Ward Occupancy Tracker',
    description: 'Monitors bed occupancy across all wards and alerts on capacity pressure',
    config: {
      thresholds: {
        occupancyHighPercent: 90,
        icuOccupancyHighPercent: 85,
      },
      resourceEndpoint: 'fhir://beds/status',
      checkIntervalSeconds: 120,
      alertRules: [
        { condition: 'ward occupancy > 90%', severity: 'warning', message: 'High occupancy: {ward} at {value}% capacity' },
        { condition: 'ICU occupancy > 85%', severity: 'critical', message: 'CRITICAL: ICU near capacity — {value}% occupied' },
      ],
    },
  },
  {
    templateId: 'lab-results-alert',
    name: 'Critical Lab Results Alerter',
    description: 'Monitors lab results and flags critical/unreviewed values requiring immediate attention',
    config: {
      thresholds: {
        criticalResultAge: 60,
      },
      resourceEndpoint: 'fhir://patients/*/lab-results',
      checkIntervalSeconds: 60,
      alertRules: [
        { condition: 'critical lab flag', severity: 'critical', message: 'CRITICAL lab: {testName} = {value} for patient {patientId}' },
        { condition: 'abnormal lab flag', severity: 'warning', message: 'Abnormal lab: {testName} = {value} for patient {patientId}' },
        { condition: 'result not reviewed > 60 min', severity: 'warning', message: 'Unreviewed critical: {testName} for patient {patientId} — {value} min old' },
      ],
    },
  },
];

/**
 * Seed agents if none exist yet. Call this from an OnModuleInit hook.
 */
export function seedAgentsIfEmpty(registry: AgentRegistryService): number {
  if (registry.getAll().length > 0) return 0;

  let count = 0;
  for (const spec of SEED_AGENTS) {
    registry.createFromSpec(spec);
    count++;
  }
  return count;
}
