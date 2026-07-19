/**
 * AgentSpec Schema
 *
 * The canonical shape of every agent in Frankenstein.
 * This is what the LLM outputs, what templates consume,
 * and what the registry stores. Frozen at Hour 0.
 */

import { z } from 'zod';

// ── Template IDs ──────────────────────────────────────────────
// The fixed set of templates the factory can produce.
// Adding a new template here + a matching entry in the
// template registry is the only change needed to support
// a new agent type.

export const TEMPLATE_IDS = [
  'vitals-monitoring',
  'blood-bank-inventory',
  'nurse-notes-summarizer',
  'medication-tracker',
  'bed-status-monitor',
  'lab-results-alert',
] as const;

export type TemplateId = (typeof TEMPLATE_IDS)[number];

// ── Severity levels ───────────────────────────────────────────

export const SEVERITY_LEVELS = ['info', 'warning', 'critical'] as const;
export type SeverityLevel = (typeof SEVERITY_LEVELS)[number];

// ── Agent status ──────────────────────────────────────────────

export const AGENT_STATUSES = ['active', 'paused', 'error'] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

// ── AgentSpec ──────────────────────────────────────────────────
// What the LLM must produce when it parses a natural-language
// request. Every field is optional at parse time; the factory
// fills defaults from the chosen template.

export const AgentSpecSchema = z.object({
  templateId: z.string().describe('Which template to use (e.g. vitals-monitoring)'),
  name: z.string().describe('Human-readable agent name'),
  description: z.string().describe('What this agent does'),
  config: z.object({
    thresholds: z.record(z.union([z.number(), z.string(), z.boolean()])).optional()
      .describe('Key-value threshold / config pairs (e.g. { heartRateHigh: 120 })'),
    resourceEndpoint: z.string().optional()
      .describe('FHIR or data resource this agent monitors'),
    checkIntervalSeconds: z.number().optional().default(60)
      .describe('How often the agent checks (seconds)'),
    alertRules: z.array(z.object({
      condition: z.string().describe('Human-readable condition (e.g. "heartRate > 120")'),
      severity: z.enum(SEVERITY_LEVELS).default('warning'),
      message: z.string().describe('Alert message template'),
    })).optional().default([]),
  }).optional().default({}),
});

export type AgentSpec = z.infer<typeof AgentSpecSchema>;

// ── Agent (runtime) ───────────────────────────────────────────
// What the registry stores after an agent is assembled.

export const AgentSchema = z.object({
  id: z.string(),
  templateId: z.string(),
  name: z.string(),
  description: z.string(),
  status: z.enum(AGENT_STATUSES).default('active'),
  config: AgentSpecSchema.shape.config,
  createdAt: z.string().datetime(),
  lastCheckedAt: z.string().datetime().optional(),
  alertCount: z.number().default(0),
});

export type Agent = z.infer<typeof AgentSchema>;

// ── Audit Event ──────────────────────────────────────────────

export const AuditEventSchema = z.object({
  id: z.string(),
  action: z.string(),
  agentId: z.string().optional(),
  timestamp: z.string().datetime(),
  resource: z.string().optional(),
  result: z.string(),
  severity: z.enum(SEVERITY_LEVELS).default('info'),
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;
