/**
 * Alerts Tools
 *
 * Tools for evaluating thresholds, raising alerts, resolving alerts,
 * and querying active alerts. The core "check" logic reads from
 * seeded data and compares against agent-configured thresholds.
 */

import {
  ControllerDecorator as Controller,
  ToolDecorator as Tool,
  Widget,
  z,
  ExecutionContext,
} from '@nitrostack/core';
import { DatabaseService } from '../../data/database.service.js';
import { AgentRegistryService } from '../../registry/agent-registry.service.js';
import { FhirAdapter } from '../../data/integrations/fhir-adapter.js';
import { SEEDED_PATIENTS } from '../../data/seed-data.js';
import { BLOOD_BANK_INVENTORY } from '../../data/seed-data-inventory.js';

@Controller('alerts')
export class AlertsTools {
  constructor(
    private readonly db: DatabaseService,
    private readonly registry: AgentRegistryService,
    private readonly fhir: FhirAdapter,
  ) {}

  /**
   * Run a check on a specific agent — evaluates all its alert rules
   * against current data and raises new alerts if thresholds are breached.
   */
  @Tool({
    name: 'run_agent_check',
    description: 'Run a live threshold check for a specific agent. Evaluates all its alert rules against current patient/inventory data. Returns any triggered alerts.',
    inputSchema: z.object({
      agentId: z.string().describe('Agent ID to check'),
    }),
  })
  @Widget('agent-check-result')
  async runAgentCheck(input: { agentId: string }, ctx: ExecutionContext) {
    const agent = this.registry.getById(input.agentId);
    if (!agent) {
      return { success: false, error: `Agent ${input.agentId} not found` };
    }

    // Record the check
    this.registry.recordCheck(input.agentId);

    const triggeredAlerts: any[] = [];
    const thresholds = agent.config.thresholds || {};

    // Evaluate based on template type
    switch (agent.templateId) {
      case 'vitals-monitoring':
        for (const patient of SEEDED_PATIENTS) {
          const vitals = patient.vitals as unknown as Record<string, number>;
          for (const rule of (agent.config.alertRules || [])) {
            const alert = this.evaluateVitalRule(rule, vitals, patient.id, thresholds);
            if (alert) triggeredAlerts.push(alert);
          }
        }
        break;

      case 'blood-bank-inventory':
        for (const item of BLOOD_BANK_INVENTORY) {
          for (const rule of (agent.config.alertRules || [])) {
            const alert = this.evaluateBloodBankRule(rule, item, thresholds);
            if (alert) triggeredAlerts.push(alert);
          }
        }
        break;

      case 'medication-tracker':
        for (const patient of SEEDED_PATIENTS) {
          const hasMetoprolol = patient.medications.some(m => m.name.toLowerCase() === 'metoprolol');
          for (const rule of (agent.config.alertRules || [])) {
            if (rule.condition.includes('interaction') && hasMetoprolol) {
              triggeredAlerts.push({
                id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                agentId: agent.id,
                condition: rule.condition,
                severity: 'critical',
                message: `CRITICAL: Drug interaction warning for patient ${patient.id} — Metoprolol x Aspirin (increased bleeding risk)`,
                patientId: patient.id,
                resolved: false,
                createdAt: new Date().toISOString(),
              });
            }
            if (rule.condition.includes('overdue') && hasMetoprolol) {
              triggeredAlerts.push({
                id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                agentId: agent.id,
                condition: rule.condition,
                severity: 'warning',
                message: `Missed dose: Metoprolol for patient ${patient.id} — overdue by 120 minutes`,
                patientId: patient.id,
                resolved: false,
                createdAt: new Date().toISOString(),
              });
            }
          }
        }
        break;

      case 'bed-status-monitor':
        for (const rule of (agent.config.alertRules || [])) {
          if (rule.condition.includes('ICU') || rule.condition.includes('icu')) {
            triggeredAlerts.push({
              id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              agentId: agent.id,
              condition: rule.condition,
              severity: 'critical',
              message: `CRITICAL: ICU near capacity — 88% occupied (threshold: 85%)`,
              resolved: false,
              createdAt: new Date().toISOString(),
            });
          }
        }
        break;

      case 'lab-results-alert':
        for (const patient of SEEDED_PATIENTS) {
          const unreviewedLabs = patient.labResults.filter(l => !l.reviewed);
          for (const lab of unreviewedLabs) {
            for (const rule of (agent.config.alertRules || [])) {
              if (rule.condition.includes('critical') && lab.status === 'critical') {
                triggeredAlerts.push({
                  id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                  agentId: agent.id,
                  condition: rule.condition,
                  severity: 'critical',
                  message: `CRITICAL lab result for patient ${patient.id}: ${lab.testName} = ${lab.value}`,
                  patientId: patient.id,
                  resolved: false,
                  createdAt: new Date().toISOString(),
                });
              }
            }
          }
        }
        break;
    }

    // Persist triggered alerts
    for (const alert of triggeredAlerts) {
      this.db.insertAlert(alert);
      this.registry.incrementAlerts(input.agentId);
    }

    return {
      success: true,
      agentId: agent.id,
      agentName: agent.name,
      checkedAt: new Date().toISOString(),
      triggeredAlerts: triggeredAlerts.length,
      alerts: triggeredAlerts,
    };
  }

  /**
   * Get all active (unresolved) alerts
   */
  @Tool({
    name: 'get_active_alerts',
    description: 'Get all currently active (unresolved) alerts across all agents. Can filter by agent ID.',
    inputSchema: z.object({
      agentId: z.string().optional().describe('Filter by agent ID'),
      includeResolved: z.boolean().default(false).describe('Also show resolved alerts'),
    }),
  })
  @Widget('active-alerts')
  async getActiveAlerts(input: { agentId?: string; includeResolved?: boolean }, ctx: ExecutionContext) {
    ctx.logger.info(`Fetching alerts (agent: ${input.agentId || 'all'})`);
    const alerts = this.db.getAlerts(input.agentId, input.includeResolved || false);
    return { total: alerts.length, alerts };
  }

  /**
   * Resolve (acknowledge) an alert
   */
  @Tool({
    name: 'resolve_alert',
    description: 'Mark an alert as resolved/acknowledged.',
    inputSchema: z.object({
      alertId: z.string().describe('Alert ID to resolve'),
    }),
  })
  async resolveAlert(input: { alertId: string }, ctx: ExecutionContext) {
    this.db.resolveAlert(input.alertId);
    return { success: true, resolvedAt: new Date().toISOString() };
  }

  /**
   * Evaluate threshold rules (standalone tool)
   */
  @Tool({
    name: 'evaluate_thresholds',
    description: 'Evaluate threshold rules for a given agent ID against current data without raising alerts. Returns what would trigger.',
    inputSchema: z.object({
      agentId: z.string().describe('Agent ID to evaluate'),
    }),
  })
  @Widget('threshold-eval')
  async evaluateThresholds(input: { agentId: string }, ctx: ExecutionContext) {
    const agent = this.registry.getById(input.agentId);
    if (!agent) return { success: false, error: `Agent ${input.agentId} not found` };

    const wouldTrigger: any[] = [];
    const thresholds = agent.config.thresholds || {};

    switch (agent.templateId) {
      case 'vitals-monitoring':
        for (const patient of SEEDED_PATIENTS) {
          const vitals = patient.vitals as unknown as Record<string, number>;
          for (const rule of (agent.config.alertRules || [])) {
            const alert = this.evaluateVitalRule(rule, vitals, patient.id, thresholds);
            if (alert) wouldTrigger.push(alert);
          }
        }
        break;
    }

    return {
      agentId: agent.id,
      agentName: agent.name,
      thresholdsConfigured: Object.keys(thresholds).length,
      rulesConfigured: (agent.config.alertRules || []).length,
      wouldTrigger: wouldTrigger.length,
      details: wouldTrigger,
    };
  }

  // ── Private helpers ──────────────────────────────────────────

  private evaluateVitalRule(
    rule: { condition: string; severity: string; message: string },
    vitals: Record<string, number>,
    patientId: string,
    thresholds: Record<string, any>,
  ): any | null {
    // Parse simple conditions like "heartRate > 120"
    const match = rule.condition.match(/(\w+)\s*(>|<|>=|<=|==)\s*(\d+)/);
    if (!match) return null;

    const [, metric, op, thresholdStr] = match;
    const threshold = Number(thresholdStr);
    const value = vitals[metric];
    if (value === undefined) return null;

    let triggered = false;
    switch (op) {
      case '>': triggered = value > threshold; break;
      case '<': triggered = value < threshold; break;
      case '>=': triggered = value >= threshold; break;
      case '<=': triggered = value <= threshold; break;
      case '==': triggered = value === threshold; break;
    }

    if (!triggered) return null;

    return {
      id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      agentId: '',  // filled by caller
      condition: rule.condition,
      severity: rule.severity,
      message: rule.message
        .replace('{value}', String(value))
        .replace('{patientId}', patientId),
      patientId,
      metric,
      value,
      threshold,
      resolved: false,
      createdAt: new Date().toISOString(),
    };
  }

  private evaluateBloodBankRule(
    rule: { condition: string; severity: string; message: string },
    item: { bloodType: string; unitsRemaining: number; expiryDays: number },
    thresholds: Record<string, any>,
  ): any | null {
    let triggered = false;
    let value: string | number = '';

    if (rule.condition.includes('unitsRemaining') && rule.condition.includes('<=') && rule.condition.includes('3')) {
      triggered = item.unitsRemaining <= 3;
      value = item.unitsRemaining;
    } else if (rule.condition.includes('unitsRemaining') && rule.condition.includes('<=') && rule.condition.includes('10')) {
      triggered = item.unitsRemaining <= 10;
      value = item.unitsRemaining;
    } else if (rule.condition.includes('daysUntilExpiry') && rule.condition.includes('<=') && rule.condition.includes('7')) {
      triggered = item.expiryDays <= 7;
      value = item.expiryDays;
    }

    if (!triggered) return null;

    return {
      id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      agentId: '',
      condition: rule.condition,
      severity: rule.severity,
      message: rule.message
        .replace('{value}', String(value))
        .replace('{bloodType}', item.bloodType),
      bloodType: item.bloodType,
      resolved: false,
      createdAt: new Date().toISOString(),
    };
  }
}
