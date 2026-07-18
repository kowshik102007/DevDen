/**
 * Audit Interceptor
 *
 * Automatically logs every tool call to the audit trail.
 * No tool needs to manually call the audit service — this
 * interceptor wraps all tool executions transparently.
 */

import { Injectable, InterceptorInterface, ExecutionContext } from '@nitrostack/core';
import { initSqlite, PureDatabase } from '../data/pure-sqlite.js';
import * as path from 'path';

@Injectable()
export class AuditInterceptor implements InterceptorInterface {
  private db: any = null;

  private async getDb(): Promise<any> {
    if (this.db) return this.db;
    try {
      const dbPath = path.join(process.cwd(), 'data', 'frankenstein.db');
      await initSqlite();
      this.db = new PureDatabase(dbPath);
      return this.db;
    } catch {
      return null;
    }
  }

  async intercept(context: ExecutionContext, next: () => Promise<unknown>): Promise<unknown> {
    const startTime = Date.now();
    const result = await next();
    const duration = Date.now() - startTime;

    // Don't audit the audit tools themselves (prevent infinite logging)
    if (context.toolName?.startsWith('get_audit_log') || context.toolName?.startsWith('append_audit_event')) {
      return result;
    }

    const db = await this.getDb();
    if (db) {
      try {
        const id = `auto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        db.prepare(`
          INSERT INTO audit_events (id, action, timestamp, resource, result, severity)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          id,
          context.toolName || 'unknown',
          new Date().toISOString(),
          `${context.toolName}`,
          `Completed in ${duration}ms`,
          duration > 5000 ? 'warning' : 'info',
        );
      } catch {
        // Silent — audit should never break the tool flow
      }
    }

    return result;
  }
}
