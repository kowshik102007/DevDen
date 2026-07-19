/**
 * Database Service
 *
 * Zero-ops SQLite persistence for agent configs, audit events,
 * and alert history. Uses better-sqlite3 — synchronous, fast,
 * no connection pool needed.
 */

import { initSqlite, PureDatabase } from './pure-sqlite.js';
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nitrostack/core';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private db!: any;

  async onModuleInit() {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const dbPath = path.resolve(__dirname, '..', '..', 'data', 'frankenstein.db');

    // Ensure data directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    await initSqlite();
    this.db = new PureDatabase(dbPath);
    this.db.pragma('journal_mode = WAL');

    this.createTables();
  }

  onModuleDestroy() {
    this.db?.close();
  }

  private createTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        template_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        config_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        last_checked_at TEXT,
        alert_count INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS audit_events (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        agent_id TEXT,
        timestamp TEXT NOT NULL,
        resource TEXT,
        result TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'info'
      );

      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        condition TEXT NOT NULL,
        severity TEXT NOT NULL,
        message TEXT NOT NULL,
        resolved INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        resolved_at TEXT
      );
    `);
  }

  // ── Agent CRUD ──────────────────────────────────────────────

  insertAgent(agent: {
    id: string; templateId: string; name: string; description: string;
    status: string; config: any; createdAt: string;
  }) {
    const stmt = this.db.prepare(`
      INSERT INTO agents (id, template_id, name, description, status, config_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      agent.id, agent.templateId, agent.name, agent.description,
      agent.status, JSON.stringify(agent.config), agent.createdAt,
    );
  }

  getAllAgents(): any[] {
    return this.db.prepare('SELECT * FROM agents ORDER BY created_at DESC').all()
      .map((row: any) => ({
        id: row.id,
        templateId: row.template_id,
        name: row.name,
        description: row.description,
        status: row.status,
        config: JSON.parse(row.config_json),
        createdAt: row.created_at,
        lastCheckedAt: row.last_checked_at,
        alertCount: row.alert_count ?? 0,
      }));
  }

  getAgent(id: string): any | undefined {
    const row = this.db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      templateId: row.template_id,
      name: row.name,
      description: row.description,
      status: row.status,
      config: JSON.parse(row.config_json),
      createdAt: row.created_at,
      lastCheckedAt: row.last_checked_at,
      alertCount: row.alert_count ?? 0,
    };
  }

  updateAgent(id: string, updates: { status?: string; config?: any; lastCheckedAt?: string; alertCount?: number }) {
    const sets: string[] = [];
    const values: any[] = [];

    if (updates.status !== undefined) { sets.push('status = ?'); values.push(updates.status); }
    if (updates.config !== undefined) { sets.push('config_json = ?'); values.push(JSON.stringify(updates.config)); }
    if (updates.lastCheckedAt !== undefined) { sets.push('last_checked_at = ?'); values.push(updates.lastCheckedAt); }
    if (updates.alertCount !== undefined) { sets.push('alert_count = ?'); values.push(updates.alertCount); }

    if (sets.length === 0) return;
    values.push(id);
    this.db.prepare(`UPDATE agents SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  }

  // ── Audit Events ───────────────────────────────────────────

  appendAuditEvent(event: {
    id: string; action: string; agentId?: string;
    timestamp: string; resource?: string; result: string; severity: string;
  }) {
    this.db.prepare(`
      INSERT INTO audit_events (id, action, agent_id, timestamp, resource, result, severity)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(event.id, event.action, event.agentId, event.timestamp, event.resource, event.result, event.severity);
  }

  getAuditEvents(limit = 100): any[] {
    return this.db.prepare('SELECT * FROM audit_events ORDER BY timestamp DESC LIMIT ?').all(limit)
      .map((row: any) => ({
        id: row.id,
        action: row.action,
        agentId: row.agent_id,
        agent_id: row.agent_id,
        timestamp: row.timestamp,
        resource: row.resource,
        result: row.result,
        severity: row.severity,
      }));
  }

  // ── Alerts ───────────────────────────────────────────────────

  insertAlert(alert: {
    id: string; agentId: string; condition: string;
    severity: string; message: string; createdAt: string;
  }) {
    this.db.prepare(`
      INSERT INTO alerts (id, agent_id, condition, severity, message, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(alert.id, alert.agentId, alert.condition, alert.severity, alert.message, alert.createdAt);
  }

  getAlerts(agentId?: string, includeResolved = false): any[] {
    let rows: any[] = [];
    if (!includeResolved) {
      if (agentId) {
        rows = this.db.prepare('SELECT * FROM alerts WHERE agent_id = ? AND resolved = 0 ORDER BY created_at DESC').all(agentId);
      } else {
        rows = this.db.prepare('SELECT * FROM alerts WHERE resolved = 0 ORDER BY created_at DESC').all();
      }
    } else {
      if (agentId) {
        rows = this.db.prepare('SELECT * FROM alerts WHERE agent_id = ? ORDER BY created_at DESC').all(agentId);
      } else {
        rows = this.db.prepare('SELECT * FROM alerts ORDER BY created_at DESC').all();
      }
    }
    return rows.map((row: any) => ({
      id: row.id,
      agentId: row.agent_id,
      condition: row.condition,
      severity: row.severity,
      message: row.message,
      patientId: row.patient_id,
      resolved: row.resolved === 1,
      createdAt: row.created_at,
    }));
  }

  resolveAlert(id: string) {
    this.db.prepare("UPDATE alerts SET resolved = 1, resolved_at = ? WHERE id = ?")
      .run(new Date().toISOString(), id);
  }
}
