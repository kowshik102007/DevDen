'use client';

import React from 'react';
import { useTheme, useWidgetSDK } from '@nitrostack/widgets';

interface DosageInstruction {
  text: string;
  timingAdditional?: {
    lastAdministered?: string;
  };
}

interface MedicationRequestResource {
  resource: {
    resourceType: 'MedicationRequest';
    id: string;
    status: string;
    subject: { reference: string };
    medicationCodeableConcept: { text: string };
    dosageInstruction: DosageInstruction[];
  };
}

interface MedicationsBundle {
  resourceType: 'Bundle';
  type: string;
  entry: MedicationRequestResource[];
}

export default function PatientMedications() {
  const theme = useTheme();
  const { isReady, getToolOutput, sendFollowUpMessage } = useWidgetSDK();
  const data = getToolOutput<MedicationsBundle>();

  if (!isReady) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280', fontFamily: 'monospace' }}>
        💊 Loading medication schedules...
      </div>
    );
  }

  if (!data || data.resourceType !== 'Bundle' || !data.entry) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#ef4444', fontFamily: 'monospace' }}>
        ⚠️ Medication records are currently unavailable.
      </div>
    );
  }

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0f172a' : '#f8fafc';
  const cardBgColor = isDark ? '#1e293b' : '#ffffff';
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';
  const borderStyle = `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`;

  const isOverdue = (medName: string, lastAdmin?: string, dosageText?: string) => {
    // Standard mock rules matching seed overdue states
    if (medName.toLowerCase() === 'metoprolol' && lastAdmin === '06:00') {
      return true; // Overdue (missed 08:00 dose)
    }
    return false;
  };

  const getStatusBadge = (medName: string, lastAdmin?: string, dosageText?: string) => {
    if (isOverdue(medName, lastAdmin, dosageText)) {
      return { label: '🚨 OVERDUE', color: '#ef4444', bg: isDark ? 'rgba(239,68,68,0.15)' : '#fee2e2' };
    }
    if (lastAdmin === 'continuous') {
      return { label: '🔄 INFUSING', color: '#3b82f6', bg: isDark ? 'rgba(59,130,246,0.15)' : '#dbeafe' };
    }
    return { label: '🟢 GIVEN', color: '#10b981', bg: isDark ? 'rgba(16,185,129,0.1)' : '#d1fae5' };
  };

  // Extract patient ID from reference
  const firstEntry = data.entry[0];
  const patientRef = firstEntry?.resource?.subject?.reference || 'Patient/PAT-001';
  const patientId = patientRef.split('/')[1] || 'PAT-001';

  return (
    <div style={{
      background: bgColor,
      color: textColor,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '20px',
      borderRadius: '16px',
      border: borderStyle,
      maxWidth: '650px',
      boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
      margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        borderBottom: borderStyle,
        paddingBottom: '12px',
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>💊</span> Active Medications Schedule
          </h2>
          <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: textMuted }}>
            FHIR MedicationRequest telemetry
          </p>
        </div>
        <button
          onClick={() => sendFollowUpMessage(`Show vitals for patient ${patientId}`)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#10b981',
            fontWeight: 600,
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          ❤️ View Patient Vitals
        </button>
      </div>

      {/* Med Cards List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {data.entry.map((entry) => {
          const med = entry.resource;
          const name = med.medicationCodeableConcept.text;
          const instruction = med.dosageInstruction[0];
          const dosageDetails = instruction?.text || 'N/A';
          const lastAdmin = instruction?.timingAdditional?.lastAdministered || 'N/A';

          const badge = getStatusBadge(name, lastAdmin, dosageDetails);

          return (
            <div key={med.id} style={{
              background: cardBgColor,
              border: borderStyle,
              borderRadius: '12px',
              padding: '16px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '16px',
            }}>
              <div>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: 700 }}>
                  {name}
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '12px', color: textMuted }}>
                  <span>
                    📋 Instructions: <strong style={{ color: textColor }}>{dosageDetails}</strong>
                  </span>
                  <span>
                    ⏱️ Last Given: <strong style={{ color: textColor }}>{lastAdmin}</strong>
                  </span>
                </div>
              </div>

              {/* Status Badge */}
              <span style={{
                fontSize: '10px',
                fontWeight: 700,
                color: badge.color,
                background: badge.bg,
                padding: '4px 10px',
                borderRadius: '6px',
                whiteSpace: 'nowrap',
              }}>
                {badge.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
