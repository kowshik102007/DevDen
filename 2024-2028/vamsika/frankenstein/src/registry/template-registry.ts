/**
 * Template Registry
 *
 * The fixed set of agent templates. Each template defines:
 * - What the agent monitors
 * - Default thresholds
 * - Default alert rules
 * - What data resources it reads from
 *
 * The factory maps an AgentSpec.templateId → one of these entries.
 * No new code is written at runtime — only config is injected.
 */

import { AgentSpec } from '../schemas/agent-spec.schema.js';

export interface AgentTemplate {
  id: string;
  label: string;
  description: string;
  icon: string;
  defaultThresholds: Record<string, any>;
  defaultAlertRules: Array<{
    condition: string;
    severity: 'info' | 'warning' | 'critical';
    message: string;
  }>;
  dataResources: string[];       // FHIR / openFDA resource URIs this template reads
  checkIntervalSeconds: number;
}

export const TEMPLATE_REGISTRY: Record<string, AgentTemplate> = {
  'vitals-monitoring': {
    id: 'vitals-monitoring',
    label: 'Vitals Monitor',
    description: 'Watches patient vital signs and alerts when thresholds are breached',
    icon: '💓',
    defaultThresholds: {
      heartRateHigh: 120,
      heartRateLow: 50,
      bloodPressureSystolicHigh: 180,
      bloodPressureSystolicLow: 90,
      spo2Low: 90,
      temperatureHigh: 39.0,
      temperatureLow: 35.0,
      respiratoryRateHigh: 25,
      respiratoryRateLow: 10,
    },
    defaultAlertRules: [
      { condition: 'heartRate > 120', severity: 'warning', message: 'Elevated heart rate detected: {value} bpm for patient {patientId}' },
      { condition: 'heartRate > 150', severity: 'critical', message: 'CRITICAL: Tachycardia — {value} bpm for patient {patientId}' },
      { condition: 'spo2 < 90', severity: 'critical', message: 'CRITICAL: Hypoxemia — SpO2 at {value}% for patient {patientId}' },
      { condition: 'bloodPressureSystolic > 180', severity: 'critical', message: 'CRITICAL: Hypertensive crisis — {value} mmHg for patient {patientId}' },
    ],
    dataResources: ['fhir://patients/{patientId}/observations'],
    checkIntervalSeconds: 30,
  },

  'blood-bank-inventory': {
    id: 'blood-bank-inventory',
    label: 'Blood Bank Tracker',
    description: 'Monitors blood bank stock levels and alerts on low inventory',
    icon: '🩸',
    defaultThresholds: {
      minUnitsByType: 10,
      criticalUnitsByType: 3,
      expiryWarningDays: 7,
    },
    defaultAlertRules: [
      { condition: 'unitsRemaining <= 3', severity: 'critical', message: 'CRITICAL: Blood type {bloodType} critically low — only {value} units remaining' },
      { condition: 'unitsRemaining <= 10', severity: 'warning', message: 'Low stock: Blood type {bloodType} — {value} units remaining' },
      { condition: 'daysUntilExpiry <= 7', severity: 'warning', message: 'Expiring soon: {value} units of {bloodType} expire within 7 days' },
    ],
    dataResources: ['fhir://blood-bank/inventory', 'openfda://blood-products'],
    checkIntervalSeconds: 60,
  },

  'nurse-notes-summarizer': {
    id: 'nurse-notes-summarizer',
    label: 'Nurse Notes Summarizer',
    description: 'Summarizes nurse shift notes and flags action items',
    icon: '📝',
    defaultThresholds: {
      maxNotesAge: 8,        // hours
      flagKeywords: ['fall', 'pain', 'fever', 'decline', 'agitation', 'wound'],
    },
    defaultAlertRules: [
      { condition: 'note contains flagged keyword', severity: 'warning', message: 'Flagged keyword in note for patient {patientId}: "{keyword}"' },
      { condition: 'no notes in last 8 hours', severity: 'info', message: 'No recent notes for patient {patientId} — last update was {value}h ago' },
    ],
    dataResources: ['fhir://patients/{patientId}/notes'],
    checkIntervalSeconds: 120,
  },

  'medication-tracker': {
    id: 'medication-tracker',
    label: 'Medication Tracker',
    description: 'Tracks medication schedules and flags missed or overdue doses',
    icon: '💊',
    defaultThresholds: {
      overdueMinutes: 30,
      interactionRiskLevel: 'high',
    },
    defaultAlertRules: [
      { condition: 'dose overdue by > 30 min', severity: 'warning', message: 'Missed dose: {medication} for patient {patientId} — overdue by {value} minutes' },
      { condition: 'drug interaction detected', severity: 'critical', message: 'CRITICAL: Drug interaction detected for patient {patientId} — {medication}' },
    ],
    dataResources: ['fhir://patients/{patientId}/medications', 'openfda://drug-interactions'],
    checkIntervalSeconds: 60,
  },

  'bed-status-monitor': {
    id: 'bed-status-monitor',
    label: 'Bed Status Monitor',
    description: 'Monitors hospital bed occupancy and flags capacity issues',
    icon: '🏥',
    defaultThresholds: {
      occupancyHighPercent: 90,
      icuOccupancyHighPercent: 85,
      dischargeDelayHours: 4,
    },
    defaultAlertRules: [
      { condition: 'ward occupancy > 90%', severity: 'warning', message: 'High occupancy: {ward} at {value}% capacity' },
      { condition: 'ICU occupancy > 85%', severity: 'critical', message: 'CRITICAL: ICU near capacity — {value}% occupied' },
      { condition: 'discharge delayed > 4h', severity: 'info', message: 'Discharge delay: Bed {bedId} in {ward} — patient ready but not discharged for {value}h' },
    ],
    dataResources: ['fhir://beds/status', 'fhir://wards/occupancy'],
    checkIntervalSeconds: 120,
  },

  'lab-results-alert': {
    id: 'lab-results-alert',
    label: 'Lab Results Alert',
    description: 'Monitors lab results and flags critical or abnormal values',
    icon: '🔬',
    defaultThresholds: {
      criticalResultAge: 60,   // minutes — flag if not reviewed within
    },
    defaultAlertRules: [
      { condition: 'critical lab flag', severity: 'critical', message: 'CRITICAL lab result for patient {patientId}: {testName} = {value}' },
      { condition: 'abnormal lab flag', severity: 'warning', message: 'Abnormal lab for patient {patientId}: {testName} = {value}' },
      { condition: 'result not reviewed > 60 min', severity: 'warning', message: 'Unreviewed critical result: {testName} for patient {patientId} — {value} min old' },
    ],
    dataResources: ['fhir://patients/{patientId}/lab-results'],
    checkIntervalSeconds: 60,
  },
};

/**
 * Map a parsed AgentSpec to a template, merging spec config
 * with template defaults. The factory calls this.
 */
export function resolveTemplate(spec: AgentSpec): {
  template: AgentTemplate;
  mergedConfig: AgentSpec['config'];
} {
  const template = TEMPLATE_REGISTRY[spec.templateId];
  if (!template) {
    throw new Error(`Unknown template ID: ${spec.templateId}`);
  }

  const mergedConfig = {
    thresholds: { ...template.defaultThresholds, ...spec.config.thresholds },
    alertRules: spec.config.alertRules?.length
      ? spec.config.alertRules
      : template.defaultAlertRules,
    checkIntervalSeconds: spec.config.checkIntervalSeconds || template.checkIntervalSeconds,
    resourceEndpoint: spec.config.resourceEndpoint || template.dataResources[0],
  };

  return { template, mergedConfig };
}
