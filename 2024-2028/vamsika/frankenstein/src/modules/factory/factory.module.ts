/**
 * Factory Module
 *
 * The heart of Frankenstein: takes a natural-language prompt,
 * calls an LLM to parse it into an AgentSpec, validates the output,
 * maps it to a template, and assembles a new agent.
 *
 * No code generation — only config injection into pre-built templates.
 */

import { Module } from '@nitrostack/core';
import { FactoryTools } from './factory.tools.js';
import { FactoryPrompts } from './factory.prompts.js';
import { DatabaseModule } from '../../data/database.module.js';
import { RegistryModule } from '../../registry/registry.module.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  name: 'factory',
  description: 'Agent factory — generate new agents from natural language prompts',
  imports: [DatabaseModule, RegistryModule, AuditModule],
  providers: [],
  controllers: [FactoryTools, FactoryPrompts],
  exports: [FactoryTools],
})
export class FactoryModule {}
