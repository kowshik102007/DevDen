'use client';

import React from 'react';
import { useTheme, useWidgetSDK } from '@nitrostack/widgets';

interface LabResult {
  value: string;
  status: 'normal' | 'abnormal' | 'critical';
  reviewed: boolean;
}

interface DiagnosticReportResource {
  resource: {
    resourceType: 'DiagnosticReport';
    id: string;
    status: string;
    subject: { reference: string };
    code: { text: string };
    result: LabResult[];
    effectiveDateTime: string;
  };
}

interface LabsBundle {
  resourceType: 'Bundle';
  type: string;
  entry: DiagnosticReportResource[];
}

const getStatusStyles = (status: LabResult['status'], isDark: boolean) => {
  const styles: Record<LabResult['status'], { color: string; bg: string }> = {
    normal: {
      color: '#10b981',
      bg: isDark ? 'rgba(16,185,129,0.1)' : '#d1fae5'
    },
    abnormal: {
      color: '#f59e0b',
      bg: isDark ? 'rgba(245,158,11,0.15)' : '#fef3c7'
    },
    critical: {
      color: '#ef4444',
      bg: isDark ? 'rgba(239,68,68,0.15)' : '#fee2e2'
    }
  };
  return styles[status] || styles.normal;
};

export default function PatientLabs() {
  const theme = useTheme();
  const { isReady, getToolOutput, sendFollowUpMessage } = useWidgetSDK();
  const data = getToolOutput<LabsBundle>();

  if (!isReady) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280', fontFamily: 'monospace' }}>
        🔬 Loading diagnostic reports...
      </div>
    );
  }

  if (!data || data.resourceType !== 'Bundle' || !data.entry) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#ef4444', fontFamily: 'monospace' }}>
        ⚠️ Laboratory results are currently unavailable.
      </div>
    );
  }

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0f172a' : '#f8fafc';
  const cardBgColor = isDark ? '#1e293b' : '#ffffff';
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';
  const borderStyle = `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`;

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
            <span>🔬</span> Laboratory Reports Panel
          </h2>
          <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: textMuted }}>
            FHIR DiagnosticReport telemetry
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

      {/* Lab Results Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {data.entry.map((entry) => {
          const report = entry.resource;
          const name = report.code.text;
          const result = report.result[0];
          const val = result?.value || 'N/A';
          const status = result?.status || 'normal';
          const reviewed = result?.reviewed ?? true;
          const timestamp = new Date(report.effectiveDateTime).toLocaleString();

          const statusStyles = getStatusStyles(status, isDark);

          return (
            <div key={report.id} style={{
              background: cardBgColor,
              border: borderStyle,
              borderRadius: '12px',
              padding: '16px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              {/* Top Row: Title and Review */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '15px', fontWeight: 700 }}>
                  {name}
                </span>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {!reviewed && (
                    <span style={{
                      background: 'rgba(239,68,68,0.1)',
                      color: '#ef4444',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 700,
                      animation: 'pulse 1.5s infinite',
                    }}>
                      ⚠️ UNREVIEWED
                    </span>
                  )}
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: statusStyles.color,
                    background: statusStyles.bg,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    textTransform: 'uppercase',
                  }}>
                    {status}
                  </span>
                </div>
              </div>

              {/* Middle Row: Measured Value */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div>
                  <span style={{ fontSize: '12px', color: textMuted }}>RESULT VALUE:</span>
                  <div style={{
                    fontSize: '22px',
                    fontWeight: 800,
                    fontFamily: 'monospace',
                    color: status !== 'normal' ? statusStyles.color : textColor,
                    marginTop: '2px',
                  }}>
                    {val}
                  </div>
                </div>
                <div style={{ fontSize: '11px', color: textMuted, textAlign: 'right' }}>
                  Collected: <strong style={{ color: textColor }}>{timestamp}</strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <style jsx global>{`
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
