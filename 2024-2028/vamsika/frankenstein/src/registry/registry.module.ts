/**
 * Registry Module
 */

import { Module } from '@nitrostack/core';
import { AgentRegistryService } from './agent-registry.service.js';
import { DatabaseModule } from '../data/database.module.js';

@Module({
  name: 'registry',
  description: 'In-memory + persisted agent registry',
  imports: [DatabaseModule],
  providers: [AgentRegistryService],
  exports: [AgentRegistryService],
})
export class RegistryModule {}
