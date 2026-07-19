/**
 * Integration Tools
 *
 * MCP tools for reading patient vitals, medications, lab results,
 * bed status, and blood bank inventory.
 */

import {
  ControllerDecorator as Controller,
  ToolDecorator as Tool,
  Cache,
  z,
  ExecutionContext,
  Widget,
} from '@nitrostack/core';
import { FhirAdapter } from '../../data/integrations/fhir-adapter.js';

@Controller('integration')
export class IntegrationTools {
  constructor(private readonly fhir: FhirAdapter) {}

  @Tool({
    name: 'get_patient_vitals',
    description: 'Get the latest vital signs for a specific patient (heart rate, BP, SpO2, temperature, respiratory rate). Returns FHIR Observation-shaped data.',
    inputSchema: z.object({
      patientId: z.string().describe('Patient ID (e.g. PAT-001)'),
    }),
  })
  @Widget('patient-vitals')
  @Cache({ ttl: 15 })
  async getPatientVitals(input: { patientId: string }, ctx: ExecutionContext) {
    ctx.logger.info(`Fetching vitals for patient ${input.patientId}`);
    return this.fhir.getPatientVitals(input.patientId);
  }

  @Tool({
    name: 'get_medications',
    description: 'Get the current medication schedule for a patient, including last administration times. Returns FHIR MedicationRequest-shaped data.',
    inputSchema: z.object({
      patientId: z.string().describe('Patient ID (e.g. PAT-001)'),
    }),
  })
  @Widget('patient-medications')
  @Cache({ ttl: 30 })
  async getMedications(input: { patientId: string }, ctx: ExecutionContext) {
    ctx.logger.info(`Fetching medications for patient ${input.patientId}`);
    return this.fhir.getPatientMedications(input.patientId);
  }

  @Tool({
    name: 'get_lab_results',
    description: 'Get lab results for a patient, including status (normal/abnormal/critical) and review state. Returns FHIR DiagnosticReport-shaped data.',
    inputSchema: z.object({
      patientId: z.string().describe('Patient ID (e.g. PAT-001)'),
    }),
  })
  @Widget('patient-labs')
  @Cache({ ttl: 30 })
  async getLabResults(input: { patientId: string }, ctx: ExecutionContext) {
    ctx.logger.info(`Fetching lab results for patient ${input.patientId}`);
    return this.fhir.getPatientLabResults(input.patientId);
  }

  @Tool({
    name: 'get_bed_status',
    description: 'Get ward-level bed occupancy data across all wards (ICU, General, Emergency, etc.). Returns FHIR Location-shaped data.',
    inputSchema: z.object({}),
  })
  @Widget('bed-status')
  @Cache({ ttl: 60 })
  async getBedStatus(input: {}, ctx: ExecutionContext) {
    ctx.logger.info('Fetching bed status');
    return this.fhir.getBedStatus();
  }

  @Tool({
    name: 'get_blood_bank_inventory',
    description: 'Get current blood bank stock levels by type, including units remaining and expiry countdown. Returns FHIR SupplyDelivery-shaped data.',
    inputSchema: z.object({}),
  })
  @Widget('blood-bank')
  @Cache({ ttl: 60 })
  async getBloodBankInventory(input: {}, ctx: ExecutionContext) {
    ctx.logger.info('Fetching blood bank inventory');
    return this.fhir.getBloodBankInventory();
  }

  @Tool({
    name: 'get_all_patients',
    description: 'Get a summary list of all patients with ID, name, age, department, and bed assignment.',
    inputSchema: z.object({}),
  })
  @Widget('patient-list')
  @Cache({ ttl: 30 })
  async getAllPatients(input: {}, ctx: ExecutionContext) {
    ctx.logger.info('Fetching all patients');
    return this.fhir.getAllPatients();
  }

  @Tool({
    name: 'check_drug_interaction',
    description: 'Check if two drugs have a known interaction (openFDA-shaped data).',
    inputSchema: z.object({
      drug1: z.string().describe('First drug name'),
      drug2: z.string().describe('Second drug name'),
    }),
  })
  async checkDrugInteraction(input: { drug1: string; drug2: string }, ctx: ExecutionContext) {
    ctx.logger.info(`Checking interaction: ${input.drug1} x ${input.drug2}`);
    return this.fhir.checkDrugInteraction(input.drug1, input.drug2);
  }
}
