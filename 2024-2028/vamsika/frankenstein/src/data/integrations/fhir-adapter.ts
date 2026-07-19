/**
 * FHIR-shaped Adapter
 *
 * Reads from seeded synthetic data and returns FHIR-shaped responses.
 * In production, this would call real FHIR R4 endpoints.
 * For the hackathon, all data is local and seeded.
 */

import { Injectable } from '@nitrostack/core';
import { SEEDED_PATIENTS } from '../seed-data.js';
import { BLOOD_BANK_INVENTORY, WARD_BEDS, DRUG_INTERACTIONS } from '../seed-data-inventory.js';

@Injectable()
export class FhirAdapter {

  /**
   * Get patient vitals (FHIR Observation-shaped)
   */
  getPatientVitals(patientId: string) {
    const patient = SEEDED_PATIENTS.find(p => p.id === patientId);
    if (!patient) {
      return { resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'not-found', details: `Patient ${patientId} not found` }] };
    }
    return {
      resourceType: 'Bundle',
      type: 'collection',
      entry: Object.entries(patient.vitals).map(([code, value]) => ({
        resource: {
          resourceType: 'Observation',
          id: `${patientId}-${code}`,
          status: 'final',
          subject: { reference: `Patient/${patientId}`, display: patient.name },
          effectiveDateTime: patient.vitals.lastUpdated,
          code: { coding: [{ system: 'http://loinc.org', code, display: code }] },
          valueQuantity: { value, unit: this.getUnit(code) },
        },
      })),
    };
  }

  /**
   * Get patient medications (FHIR MedicationRequest-shaped)
   */
  getPatientMedications(patientId: string) {
    const patient = SEEDED_PATIENTS.find(p => p.id === patientId);
    if (!patient) return { resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'not-found' }] };
    return {
      resourceType: 'Bundle',
      type: 'collection',
      entry: patient.medications.map((med, i) => ({
        resource: {
          resourceType: 'MedicationRequest',
          id: `${patientId}-med-${i}`,
          status: 'active',
          subject: { reference: `Patient/${patientId}` },
          medicationCodeableConcept: { text: med.name },
          dosageInstruction: [{ text: `${med.dose} — ${med.schedule}`, timingAdditional: { lastAdministered: med.lastAdministered } }],
        },
      })),
    };
  }

  /**
   * Get patient lab results (FHIR DiagnosticReport-shaped)
   */
  getPatientLabResults(patientId: string) {
    const patient = SEEDED_PATIENTS.find(p => p.id === patientId);
    if (!patient) return { resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'not-found' }] };
    return {
      resourceType: 'Bundle',
      type: 'collection',
      entry: patient.labResults.map((lab, i) => ({
        resource: {
          resourceType: 'DiagnosticReport',
          id: `${patientId}-lab-${i}`,
          status: lab.reviewed ? 'final' : 'preliminary',
          subject: { reference: `Patient/${patientId}` },
          code: { text: lab.testName },
          result: [{ value: lab.value, status: lab.status, reviewed: lab.reviewed }],
          effectiveDateTime: lab.timestamp,
        },
      })),
    };
  }

  /**
   * Get patient notes (FHIR DocumentReference-shaped)
   */
  getPatientNotes(patientId: string) {
    const patient = SEEDED_PATIENTS.find(p => p.id === patientId);
    if (!patient) return { resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'not-found' }] };
    return {
      resourceType: 'Bundle',
      type: 'collection',
      entry: patient.notes.map((note, i) => ({
        resource: {
          resourceType: 'DocumentReference',
          id: `${patientId}-note-${i}`,
          subject: { reference: `Patient/${patientId}` },
          author: { display: note.author },
          content: [{ attachment: { contentType: 'text/plain', data: note.text } }],
          date: note.time,
        },
      })),
    };
  }

  /**
   * Get bed/ward status
   */
  getBedStatus() {
    return {
      resourceType: 'Bundle',
      type: 'collection',
      entry: WARD_BEDS.map((ward, i) => ({
        resource: {
          resourceType: 'Location',
          id: `ward-${i}`,
          name: ward.ward,
          physicalType: { coding: [{ code: 'ward' }] },
          extension: [
            { url: 'totalBeds', valueInteger: ward.totalBeds },
            { url: 'occupied', valueInteger: ward.occupied },
            { url: 'occupancyPercent', valueDecimal: Math.round((ward.occupied / ward.totalBeds) * 100) },
          ],
        },
      })),
    };
  }

  /**
   * Get blood bank inventory
   */
  getBloodBankInventory() {
    return {
      resourceType: 'Bundle',
      type: 'collection',
      entry: BLOOD_BANK_INVENTORY.map((item, i) => ({
        resource: {
          resourceType: 'SupplyDelivery',
          id: `blood-${i}`,
          status: 'completed',
          product: { code: { text: item.bloodType } },
          quantity: { value: item.unitsRemaining },
          extension: [
            { url: 'expiryDays', valueInteger: item.expiryDays },
          ],
        },
      })),
    };
  }

  /**
   * Get all patients summary
   */
  getAllPatients() {
    return {
      resourceType: 'Bundle',
      type: 'collection',
      total: SEEDED_PATIENTS.length,
      entry: SEEDED_PATIENTS.map(p => ({
        resource: {
          resourceType: 'Patient',
          id: p.id,
          name: [{ text: p.name }],
          extension: [
            { url: 'age', valueInteger: p.age },
            { url: 'department', valueString: p.department },
            { url: 'bed', valueString: p.bed },
          ],
        },
      })),
    };
  }

  /**
   * Check drug interactions (openFDA-shaped)
   */
  checkDrugInteraction(drug1: string, drug2: string) {
    const interaction = DRUG_INTERACTIONS.find(
      d => (d.drug1.toLowerCase() === drug1.toLowerCase() && d.drug2.toLowerCase() === drug2.toLowerCase()) ||
           (d.drug1.toLowerCase() === drug2.toLowerCase() && d.drug2.toLowerCase() === drug1.toLowerCase())
    );
    return {
      source: 'openFDA',
      drug1,
      drug2,
      interaction: interaction || null,
    };
  }

  private getUnit(code: string): string {
    const units: Record<string, string> = {
      heartRate: 'bpm',
      bloodPressureSystolic: 'mmHg',
      bloodPressureDiastolic: 'mmHg',
      spo2: '%',
      temperature: '°C',
      respiratoryRate: 'breaths/min',
    };
    return units[code] || '';
  }
}
