/**
 * Database Module
 *
 * Exports DatabaseService for use by all other modules.
 */

import { Module } from '@nitrostack/core';
import { DatabaseService } from './database.service.js';

@Module({
  name: 'database',
  description: 'SQLite persistence layer for agents, audit events, and alerts',
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
