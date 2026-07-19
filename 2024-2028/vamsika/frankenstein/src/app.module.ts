/**
 * Frankenstein — Root Application Module
 *
 * Hospital AI Agent Factory: turns plain English into deployed
 * healthcare MCP agents using template-driven config injection.
 *
 * Amrita University MCP Hackathon 2026 — HealthTech & Life Sciences
 */

import { McpApp, Module, ConfigModule, OnModuleInit, Injectable } from '@nitrostack/core';
import { NitroStackServer } from '@nitrostack/core';
// @ts-ignore
import express from 'express';
import path from 'path';
import { AgentsModule } from './modules/agents/agents.module.js';
import { FactoryModule } from './modules/factory/factory.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AlertsModule } from './modules/alerts/alerts.module.js';
import { IntegrationModule } from './modules/integration/integration.module.js';
import { AgentRegistryService } from './registry/agent-registry.service.js';
import { seedAgentsIfEmpty } from './shared/seed-agents.js';
import { SystemHealthCheck } from './health/system.health.js';

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(private readonly registry: AgentRegistryService) {}

  onModuleInit() {
    const count = seedAgentsIfEmpty(this.registry);
    if (count > 0) {
      console.log(`🌱 Seeded ${count} agents on first boot`);
    } else {
      console.log(`📦 ${this.registry.getAll().length} agents loaded from database`);
    }
  }
}

@Injectable()
export class RedirectService {
  constructor(private readonly server: NitroStackServer) {}

  onApplicationBootstrap() {
    const httpTransport = (this.server as any)._httpTransport;
    if (httpTransport) {
      const app = httpTransport.getApp();
      if (app) {
        // Serve the built widget assets statically
        const widgetsPath = path.join(process.cwd(), 'src', 'widgets', 'out');
        app.use('/widgets', express.static(widgetsPath));

        // Redirect browser visits on root URL to the main dashboard page
        app.use((req: any, res: any, next: any) => {
          if (req.path === '/' || req.path === '') {
            res.redirect('/widgets/index.html');
            return;
          }
          next();
        });
        console.log('🔄 Registered widgets static folder & root redirect ( / -> /widgets/index.html )');
      }
    }
  }
}

@McpApp({
  module: AppModule,
  server: {
    name: 'frankenstein-hospital-agent-factory',
    version: '1.0.0',
  },
  logging: {
    level: 'info',
  },
})
@Module({
  name: 'app',
  description: 'Frankenstein — Hospital AI Agent Factory. Turns plain English into working healthcare MCP agents.',
  imports: [
    ConfigModule.forRoot(),
    // Data & Registry
    IntegrationModule,         // FHIR/openFDA data adapters
    // Agent Lifecycle
    AgentsModule,             // List, status, evolve agents
    FactoryModule,            // Generate agents from natural language
    // Operations
    AuditModule,               // Audit log
    AlertsModule,             // Threshold evaluation & alerts
  ],
  providers: [
    SystemHealthCheck,
    SeedService,
    RedirectService,
  ],
})
export class AppModule {}
