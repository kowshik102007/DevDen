/**
 * Alerts Module
 *
 * Evaluates thresholds against live data, raises/resolves alerts,
 * and provides alert query tools.
 */

import { Module } from '@nitrostack/core';
import { AlertsTools } from './alerts.tools.js';
import { DatabaseModule } from '../../data/database.module.js';
import { RegistryModule } from '../../registry/registry.module.js';
import { IntegrationModule } from '../integration/integration.module.js';

@Module({
  name: 'alerts',
  description: 'Threshold evaluation and alert management',
  imports: [DatabaseModule, RegistryModule, IntegrationModule],
  providers: [],
  controllers: [AlertsTools],
  exports: [AlertsTools],
})
export class AlertsModule {}
