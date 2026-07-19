/**
 * Audit Tools
 *
 * Tools for reading the audit log and appending events.
 * The AuditInterceptor (in middleware/) auto-writes events on every tool call.
 */

import {
  ControllerDecorator as Controller,
  ToolDecorator as Tool,
  Widget,
  z,
  ExecutionContext,
} from '@nitrostack/core';
import { DatabaseService } from '../../data/database.service.js';

@Controller('audit')
export class AuditTools {
  constructor(private readonly db: DatabaseService) {}

  @Tool({
    name: 'get_audit_log',
    description: 'Get the audit log of all actions performed on the system. Each entry has action, timestamp, agent ID, resource touched, and result. Returns most recent first.',
    inputSchema: z.object({
      limit: z.number().optional().default(50).describe('Max events to return'),
    }),
  })
  @Widget('audit-log')
  async getAuditLog(input: { limit?: number }, ctx: ExecutionContext) {
    ctx.logger.info(`Fetching audit log (limit: ${input.limit})`);
    const events = this.db.getAuditEvents(input.limit || 50);
    return {
      total: events.length,
      events,
    };
  }

  @Tool({
    name: 'append_audit_event',
    description: 'Manually append an event to the audit log. (Most events are auto-logged by the interceptor.)',
    inputSchema: z.object({
      action: z.string().describe('Action name (e.g. agent_generated, alert_triggered)'),
      agentId: z.string().optional().describe('Related agent ID'),
      resource: z.string().optional().describe('Resource that was touched'),
      result: z.string().describe('Result or outcome of the action'),
      severity: z.enum(['info', 'warning', 'critical']).default('info'),
    }),
  })
  async appendAuditEvent(
    input: { action: string; agentId?: string; resource?: string; result: string; severity?: string },
    ctx: ExecutionContext,
  ) {
    const id = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const event = {
      id,
      action: input.action,
      agentId: input.agentId,
      timestamp: new Date().toISOString(),
      resource: input.resource,
      result: input.result,
      severity: input.severity || 'info',
    };
    this.db.appendAuditEvent(event);
    return { success: true, eventId: id };
  }
}
