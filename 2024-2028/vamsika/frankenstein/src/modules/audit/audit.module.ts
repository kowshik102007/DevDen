/**
 * Audit Module
 *
 * Every tool call writes one row: action, timestamp, resource, result.
 * Uses an interceptor so no tool needs to manually log — it's automatic.
 */

import { Module } from '@nitrostack/core';
import { AuditTools } from './audit.tools.js';
import { DatabaseModule } from '../../data/database.module.js';

@Module({
  name: 'audit',
  description: 'Audit logging service — every action is recorded',
  imports: [DatabaseModule],
  providers: [],
  controllers: [AuditTools],
  exports: [AuditTools],
})
export class AuditModule {}
