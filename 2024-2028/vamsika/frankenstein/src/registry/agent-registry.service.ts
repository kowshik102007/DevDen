/**
 * Agent Registry Service
 *
 * Manages the lifecycle of all agents: creation, retrieval,
 * status updates, threshold evolution, and deletion.
 *
 * Reads from / writes to DatabaseService for persistence.
 * Keeps a hot in-memory cache for fast lookups.
 */

import { Injectable, OnModuleInit } from '@nitrostack/core';
import { DatabaseService } from '../data/database.service.js';
import { Agent, AgentSpec } from '../schemas/agent-spec.schema.js';

@Injectable()
export class AgentRegistryService implements OnModuleInit {
  private agents: Map<string, Agent> = new Map();

  constructor(private readonly db: DatabaseService) {}

  onModuleInit() {
    // Load persisted agents from DB into memory
    const rows = this.db.getAllAgents();
    for (const row of rows) {
      this.agents.set(row.id, row as Agent);
    }
  }

  // ── Create ─────────────────────────────────────────────────

  createFromSpec(spec: AgentSpec): Agent {
    const agent: Agent = {
      id: `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      templateId: spec.templateId,
      name: spec.name,
      description: spec.description,
      status: 'active',
      config: spec.config,
      createdAt: new Date().toISOString(),
      alertCount: 0,
    };

    this.db.insertAgent({
      id: agent.id,
      templateId: agent.templateId,
      name: agent.name,
      description: agent.description,
      status: agent.status,
      config: agent.config,
      createdAt: agent.createdAt,
    });

    this.agents.set(agent.id, agent);
    return agent;
  }

  // ── Read ────────────────────────────────────────────────────

  getAll(): Agent[] {
    return Array.from(this.agents.values());
  }

  getById(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  getByTemplate(templateId: string): Agent[] {
    return this.getAll().filter(a => a.templateId === templateId);
  }

  // ── Update ──────────────────────────────────────────────────

  updateStatus(id: string, status: Agent['status']): Agent | undefined {
    const agent = this.agents.get(id);
    if (!agent) return undefined;
    agent.status = status;
    this.db.updateAgent(id, { status });
    return agent;
  }

  updateConfig(id: string, config: Partial<Agent['config']>): Agent | undefined {
    const agent = this.agents.get(id);
    if (!agent) return undefined;
    agent.config = { ...agent.config, ...config };
    this.db.updateAgent(id, { config: agent.config });
    return agent;
  }

  recordCheck(id: string): Agent | undefined {
    const agent = this.agents.get(id);
    if (!agent) return undefined;
    agent.lastCheckedAt = new Date().toISOString();
    this.db.updateAgent(id, { lastCheckedAt: agent.lastCheckedAt });
    return agent;
  }

  incrementAlerts(id: string): Agent | undefined {
    const agent = this.agents.get(id);
    if (!agent) return undefined;
    agent.alertCount += 1;
    this.db.updateAgent(id, { alertCount: agent.alertCount });
    return agent;
  }

  // ── Evolve (threshold changes) ──────────────────────────────

  evolve(id: string, updates: {
    thresholds?: Record<string, any>;
    alertRules?: Array<{ condition: string; severity: 'info' | 'warning' | 'critical'; message: string }>;
    checkIntervalSeconds?: number;
  }): Agent | undefined {
    const agent = this.agents.get(id);
    if (!agent) return undefined;

    if (updates.thresholds) {
      agent.config.thresholds = { ...agent.config.thresholds, ...updates.thresholds };
    }
    if (updates.alertRules) {
      agent.config.alertRules = updates.alertRules as any;
    }
    if (updates.checkIntervalSeconds) {
      agent.config.checkIntervalSeconds = updates.checkIntervalSeconds;
    }

    this.db.updateAgent(id, { config: agent.config });
    return agent;
  }

  // ── Stats ───────────────────────────────────────────────────

  getStats() {
    const agents = this.getAll();
    return {
      total: agents.length,
      active: agents.filter(a => a.status === 'active').length,
      paused: agents.filter(a => a.status === 'paused').length,
      error: agents.filter(a => a.status === 'error').length,
      totalAlerts: agents.reduce((sum, a) => sum + a.alertCount, 0),
      byTemplate: agents.reduce<Record<string, number>>((acc, a) => {
        acc[a.templateId] = (acc[a.templateId] || 0) + 1;
        return acc;
      }, {}),
    };
  }
}
