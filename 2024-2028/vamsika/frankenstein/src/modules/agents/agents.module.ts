/**
 * Agents Module
 *
 * Tools for listing agents, getting status, running checks,
 * and evolving agent configurations (threshold changes).
 */

import { Module } from '@nitrostack/core';
import { AgentsTools } from './agents.tools.js';
import { DatabaseModule } from '../../data/database.module.js';
import { RegistryModule } from '../../registry/registry.module.js';
import { AlertsModule } from '../alerts/alerts.module.js';

@Module({
  name: 'agents',
  description: 'Agent management — list, status, check, evolve',
  imports: [DatabaseModule, RegistryModule, AlertsModule],
  providers: [],
  controllers: [AgentsTools],
  exports: [AgentsTools],
})
export class AgentsModule {}
