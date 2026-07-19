/**
 * Integration Module
 *
 * Exposes FHIR-shaped and openFDA-shaped data access tools.
 * All data is seeded/synthetic — no real hospital connections.
 */

import { Module } from '@nitrostack/core';
import { IntegrationTools } from './integration.tools.js';
import { IntegrationResources } from './integration.resources.js';
import { DatabaseModule } from '../../data/database.module.js';
import { FhirAdapter } from '../../data/integrations/fhir-adapter.js';

@Module({
  name: 'integration',
  description: 'FHIR and openFDA data access layer — seeded synthetic data',
  imports: [DatabaseModule],
  providers: [FhirAdapter],
  controllers: [IntegrationTools, IntegrationResources],
  exports: [FhirAdapter],
})
export class IntegrationModule {}
