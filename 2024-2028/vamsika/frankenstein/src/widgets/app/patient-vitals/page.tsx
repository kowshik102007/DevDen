'use client';

import React from 'react';
import { useTheme, useWidgetSDK } from '@nitrostack/widgets';

interface FhirObservation {
  resource: {
    resourceType: 'Observation';
    id: string;
    status: string;
    subject: { reference: string; display: string };
    effectiveDateTime: string;
    code: { coding: Array<{ system: string; code: string; display: string }> };
    valueQuantity: { value: number; unit: string };
  };
}

interface VitalsBundle {
  resourceType: 'Bundle';
  type: string;
  entry: FhirObservation[];
}

const getVitalThresholdStatus = (code: string, val: number) => {
  // Returns: 'critical' | 'warning' | 'normal'
  switch (code) {
    case 'heartRate':
      if (val > 120 || val < 50) return 'critical';
      if (val > 100 || val < 60) return 'warning';
      return 'normal';
    case 'bloodPressureSystolic':
      if (val > 160 || val < 90) return 'critical';
      if (val > 140 || val < 100) return 'warning';
      return 'normal';
    case 'bloodPressureDiastolic':
      if (val > 100 || val < 60) return 'critical';
      if (val > 90 || val < 65) return 'warning';
      return 'normal';
    case 'spo2':
      if (val < 90) return 'critical';
      if (val < 95) return 'warning';
      return 'normal';
    case 'temperature':
      if (val > 38.5 || val < 35.0) return 'critical';
      if (val > 37.5 || val < 36.0) return 'warning';
      return 'normal';
    case 'respiratoryRate':
      if (val > 25 || val < 10) return 'critical';
      if (val > 20 || val < 12) return 'warning';
      return 'normal';
    default:
      return 'normal';
  }
};

const getStatusStyles = (status: 'critical' | 'warning' | 'normal', isDark: boolean) => {
  if (status === 'critical') {
    return {
      color: '#ef4444',
      bg: isDark ? 'rgba(239,68,68,0.15)' : '#fee2e2',
      border: '1px solid #fca5a5'
    };
  }
  if (status === 'warning') {
    return {
      color: '#f59e0b',
      bg: isDark ? 'rgba(245,158,11,0.15)' : '#fef3c7',
      border: '1px solid #fde047'
    };
  }
  return {
    color: '#10b981',
    bg: isDark ? 'rgba(16,185,129,0.1)' : '#d1fae5',
    border: '1px solid #a7f3d0'
  };
};

export default function PatientVitals() {
  const theme = useTheme();
  const { isReady, getToolOutput } = useWidgetSDK();
  const data = getToolOutput<VitalsBundle>();

  if (!isReady) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280', fontFamily: 'monospace' }}>
        🩺 Loading patient telemetry...
      </div>
    );
  }

  // Handle error codes or empty data
  if (!data || data.resourceType !== 'Bundle' || !data.entry) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#ef4444', fontFamily: 'monospace' }}>
        ⚠️ No vitals data found for this patient.
      </div>
    );
  }

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0f172a' : '#f8fafc';
  const cardBgColor = isDark ? '#1e293b' : '#ffffff';
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';
  const borderStyle = `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`;

  // Parse entries out
  const vitals: Record<string, { value: number; unit: string; date: string }> = {};
  let patientName = 'Unknown Patient';
  let patientRef = '';

  data.entry.forEach(e => {
    const obs = e.resource;
    if (obs.resourceType === 'Observation') {
      const code = obs.code.coding[0].code;
      vitals[code] = {
        value: obs.valueQuantity.value,
        unit: obs.valueQuantity.unit,
        date: obs.effectiveDateTime,
      };
      if (obs.subject) {
        patientName = obs.subject.display || patientName;
        patientRef = obs.subject.reference || patientRef;
      }
    }
  });

  const renderVitalCard = (icon: string, label: string, code: string) => {
    const item = vitals[code];
    if (!item) return null;

    const status = getVitalThresholdStatus(code, item.value);
    const styles = getStatusStyles(status, isDark);

    return (
      <div style={{
        background: cardBgColor,
        border: borderStyle,
        borderRadius: '12px',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: textMuted, fontWeight: 500 }}>
            {icon} {label}
          </span>
          <span style={{
            fontSize: '9px',
            fontWeight: 700,
            color: styles.color,
            background: styles.bg,
            padding: '2px 6px',
            borderRadius: '4px',
            textTransform: 'uppercase',
          }}>
            {status}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <span style={{
            fontSize: '24px',
            fontWeight: 800,
            fontFamily: 'monospace',
            color: status !== 'normal' ? styles.color : textColor
          }}>
            {item.value}
          </span>
          <span style={{ fontSize: '12px', color: textMuted, fontFamily: 'monospace' }}>
            {item.unit}
          </span>
        </div>
      </div>
    );
  };

  // Special double rendering for BP systolic / diastolic
  const renderBPCard = () => {
    const sys = vitals['bloodPressureSystolic'];
    const dia = vitals['bloodPressureDiastolic'];
    if (!sys || !dia) return null;

    const sysStatus = getVitalThresholdStatus('bloodPressureSystolic', sys.value);
    const diaStatus = getVitalThresholdStatus('bloodPressureDiastolic', dia.value);
    const status = sysStatus === 'critical' || diaStatus === 'critical'
      ? 'critical'
      : (sysStatus === 'warning' || diaStatus === 'warning' ? 'warning' : 'normal');

    const styles = getStatusStyles(status, isDark);

    return (
      <div style={{
        background: cardBgColor,
        border: borderStyle,
        borderRadius: '12px',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: textMuted, fontWeight: 500 }}>
            🩺 Blood Pressure
          </span>
          <span style={{
            fontSize: '9px',
            fontWeight: 700,
            color: styles.color,
            background: styles.bg,
            padding: '2px 6px',
            borderRadius: '4px',
            textTransform: 'uppercase',
          }}>
            {status}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <span style={{
            fontSize: '24px',
            fontWeight: 800,
            fontFamily: 'monospace',
            color: status !== 'normal' ? styles.color : textColor
          }}>
            {sys.value}/{dia.value}
          </span>
          <span style={{ fontSize: '12px', color: textMuted, fontFamily: 'monospace' }}>
            {sys.unit}
          </span>
        </div>
      </div>
    );
  };

  // Get timestamp from any vital
  const firstVital = Object.values(vitals)[0];
  const lastUpdated = firstVital ? new Date(firstVital.date).toLocaleString() : 'N/A';

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
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
            👤 Patient: {patientName}
          </h2>
          <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: textMuted }}>
            FHIR Observational Telemetry Data
          </p>
        </div>
        <span style={{
          fontSize: '11px',
          color: textMuted,
          fontFamily: 'monospace'
        }}>
          Ref: {patientRef || 'Patient ID'}
        </span>
      </div>

      {/* Grid containing Vitals Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '12px',
        marginBottom: '16px',
      }}>
        {renderVitalCard('❤️', 'Heart Rate', 'heartRate')}
        {renderBPCard()}
        {renderVitalCard('🫁', 'SpO2 (Oxygen)', 'spo2')}
        {renderVitalCard('🌡️', 'Temperature', 'temperature')}
        {renderVitalCard('💨', 'Respiratory Rate', 'respiratoryRate')}
      </div>

      {/* Footer metadata */}
      <div style={{
        fontSize: '11px',
        color: textMuted,
        textAlign: 'right',
        borderTop: borderStyle,
        paddingTop: '10px',
      }}>
        Last Updated: <strong style={{ color: textColor }}>{lastUpdated}</strong>
      </div>
    </div>
  );
}
