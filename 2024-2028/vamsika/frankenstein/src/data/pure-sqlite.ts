/**
 * Pure WebAssembly SQLite Adapter
 * 
 * Replaces better-sqlite3 with sql.js to avoid native compile steps
 * in cloud environments (like arm64 Alpine Linux container builders).
 */

import initSqlJs from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';

let SQL: any = null;

export async function initSqlite() {
  if (!SQL) {
    SQL = await initSqlJs();
  }
  return SQL;
}

export class PureDatabase {
  private db: any;
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    if (!SQL) {
      throw new Error("sql.js is not initialized yet. Call initSqlite() first!");
    }
    
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(filePath)) {
      try {
        const fileBuffer = fs.readFileSync(filePath);
        this.db = new SQL.Database(fileBuffer);
      } catch (e) {
        console.warn("Failed to load existing SQLite database file, starting fresh:", e);
        this.db = new SQL.Database();
      }
    } else {
      this.db = new SQL.Database();
    }
  }

  pragma(sql: string) {
    // No-op for WASM in-memory DB
    return this;
  }

  exec(sql: string) {
    this.db.run(sql);
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.filePath, buffer);
    } catch (e) {
      console.error("Failed to write SQLite changes to disk:", e);
    }
    return this;
  }

  prepare(sql: string) {
    const db = this.db;
    const filePath = this.filePath;
    
    return {
      run(...args: any[]) {
        // Flatten array if args is nested (e.g. run([...]))
        const flatArgs = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
        db.run(sql, flatArgs);
        
        // Persist database changes back to disk synchronously
        try {
          const data = db.export();
          const buffer = Buffer.from(data);
          fs.writeFileSync(filePath, buffer);
        } catch (e) {
          console.error("Failed to write SQLite changes to disk:", e);
        }
        
        return { changes: 1, lastInsertRowid: 0 };
      },
      
      all(...args: any[]) {
        const flatArgs = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
        const stmt = db.prepare(sql, flatArgs);
        const rows: any[] = [];
        while (stmt.step()) {
          rows.push(stmt.getAsObject());
        }
        stmt.free();
        return rows;
      },
      
      get(...args: any[]) {
        const flatArgs = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
        const stmt = db.prepare(sql, flatArgs);
        let row = undefined;
        if (stmt.step()) {
          row = stmt.getAsObject();
        }
        stmt.free();
        return row;
      }
    };
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}
