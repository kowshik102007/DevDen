/**
 * Agents Tools
 *
 * MCP tools for the agent lifecycle: list all agents, get status,
 * run a check, evolve thresholds/alerts.
 */

import {
  ControllerDecorator as Controller,
  ToolDecorator as Tool,
  InitialTool,
  Widget,
  z,
  ExecutionContext,
} from '@nitrostack/core';
import { AgentRegistryService } from '../../registry/agent-registry.service.js';

@Controller('agents')
export class AgentsTools {
  constructor(private readonly registry: AgentRegistryService) {}

  /**
   * Auto-invoked on client connect — returns all agents as a greeting
   */
  @Tool({
    name: 'list_agents',
    description: 'List all registered agents with their status, template type, alert count, and last check time. Auto-invoked on client connect.',
    inputSchema: z.object({}),
  })
  @InitialTool()
  @Widget('agent-dashboard')
  async listAgents(input: {}, ctx: ExecutionContext) {
    ctx.logger.info('Listing all agents');
    const agents = this.registry.getAll();
    const stats = this.registry.getStats();
    return {
      stats,
      agents,
    };
  }

  /**
   * Get detailed status of a single agent
   */
  @Tool({
    name: 'get_agent_status',
    description: 'Get detailed status of a specific agent including config, thresholds, and alert rules.',
    inputSchema: z.object({
      agentId: z.string().describe('Agent ID'),
    }),
  })
  @Widget('agent-detail')
  async getAgentStatus(input: { agentId: string }, ctx: ExecutionContext) {
    const agent = this.registry.getById(input.agentId);
    if (!agent) {
      return { success: false, error: `Agent ${input.agentId} not found` };
    }
    ctx.logger.info(`Getting status for agent ${input.agentId}`);
    return { success: true, agent };
  }

  /**
   * Evolve an agent — change thresholds, alert rules, or check interval
   */
  @Tool({
    name: 'evolve_agent',
    description: 'Evolve an agent by updating its thresholds, alert rules, or check interval. This modifies the running agent config without recreating it.',
    inputSchema: z.object({
      agentId: z.string().describe('Agent ID to evolve'),
      thresholds: z.record(z.union([z.number(), z.string(), z.boolean()])).optional()
        .describe('New threshold values to merge (e.g. { heartRateHigh: 130 })'),
      alertRules: z.array(z.object({
        condition: z.string(),
        severity: z.enum(['info', 'warning', 'critical']).default('warning'),
        message: z.string(),
      })).optional().describe('Replace all alert rules'),
      checkIntervalSeconds: z.number().optional().describe('New check interval in seconds'),
    }),
  })
  @Widget('agent-evolved')
  async evolveAgent(
    input: {
      agentId: string;
      thresholds?: Record<string, any>;
      alertRules?: Array<{ condition: string; severity: 'info' | 'warning' | 'critical'; message: string }>;
      checkIntervalSeconds?: number;
    },
    ctx: ExecutionContext,
  ) {
    ctx.logger.info(`Evolving agent ${input.agentId}`);
    const evolved = this.registry.evolve(input.agentId, {
      thresholds: input.thresholds,
      alertRules: input.alertRules,
      checkIntervalSeconds: input.checkIntervalSeconds,
    });

    if (!evolved) {
      return { success: false, error: `Agent ${input.agentId} not found` };
    }

    return {
      success: true,
      message: `Agent "${evolved.name}" evolved successfully`,
      agent: evolved,
    };
  }

  /**
   * Pause or activate an agent
   */
  @Tool({
    name: 'set_agent_status',
    description: 'Pause or activate an agent. Paused agents skip threshold checks.',
    inputSchema: z.object({
      agentId: z.string().describe('Agent ID'),
      status: z.enum(['active', 'paused', 'error']).describe('New status'),
    }),
  })
  async setAgentStatus(input: { agentId: string; status: 'active' | 'paused' | 'error' }, ctx: ExecutionContext) {
    const updated = this.registry.updateStatus(input.agentId, input.status);
    if (!updated) {
      return { success: false, error: `Agent ${input.agentId} not found` };
    }
    return { success: true, agent: updated };
  }
}
