/**
 * Integration Resources
 *
 * Exposes static reference data as MCP Resources.
 * Read-only data dictionaries for patient lookup, blood types, etc.
 */

import { ResourceDecorator as Resource, ExecutionContext } from '@nitrostack/core';
import { SEEDED_PATIENTS } from '../../data/seed-data.js';
import { BLOOD_BANK_INVENTORY } from '../../data/seed-data-inventory.js';

export class IntegrationResources {

  @Resource({
    uri: 'fhir://dictionary/patients',
    name: 'Patient Directory',
    description: 'Directory of all tracked patients with IDs, names, departments, and beds',
    mimeType: 'application/json',
  })
  async getPatientDirectory(ctx: ExecutionContext) {
    return {
      resourceType: 'Bundle',
      total: SEEDED_PATIENTS.length,
      entry: SEEDED_PATIENTS.map(p => ({
        id: p.id,
        name: p.name,
        department: p.department,
        bed: p.bed,
      })),
    };
  }

  @Resource({
    uri: 'fhir://dictionary/blood-types',
    name: 'Blood Type Reference',
    description: 'Available blood types and their current stock levels',
    mimeType: 'application/json',
  })
  async getBloodTypeReference(ctx: ExecutionContext) {
    return BLOOD_BANK_INVENTORY.map(b => ({
      type: b.bloodType,
      unitsAvailable: b.unitsRemaining,
      daysUntilExpiry: b.expiryDays,
    }));
  }
}
