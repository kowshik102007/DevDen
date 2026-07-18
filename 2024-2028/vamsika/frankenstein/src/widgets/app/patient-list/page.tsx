'use client';

import React from 'react';
import { useTheme, useWidgetSDK } from '@nitrostack/widgets';

interface PatientExtension {
  url: string;
  valueInteger?: number;
  valueString?: string;
}

interface PatientResource {
  resource: {
    resourceType: 'Patient';
    id: string;
    name: Array<{ text: string }>;
    extension: PatientExtension[];
  };
}

interface PatientListBundle {
  resourceType: 'Bundle';
  type: string;
  total: number;
  entry: PatientResource[];
}

export default function PatientList() {
  const theme = useTheme();
  const { isReady, getToolOutput, sendFollowUpMessage } = useWidgetSDK();
  const data = getToolOutput<PatientListBundle>();

  if (!isReady) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280', fontFamily: 'monospace' }}>
        📋 Fetching patient directory...
      </div>
    );
  }

  if (!data || data.resourceType !== 'Bundle' || !data.entry) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#ef4444', fontFamily: 'monospace' }}>
        ⚠️ Patient directory is currently empty or unavailable.
      </div>
    );
  }

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0f172a' : '#f8fafc';
  const cardBgColor = isDark ? '#1e293b' : '#ffffff';
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';
  const borderStyle = `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`;

  return (
    <div style={{
      background: bgColor,
      color: textColor,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '20px',
      borderRadius: '16px',
      border: borderStyle,
      maxWidth: '750px',
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
            <span>👥</span> Admitted Patients Directory
          </h2>
          <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: textMuted }}>
            FHIR Patient Registry summary
          </p>
        </div>
        <span style={{
          fontSize: '11px',
          fontWeight: 700,
          background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
          padding: '4px 8px',
          borderRadius: '12px',
          color: textMuted,
          fontFamily: 'monospace',
        }}>
          Total: {data.total}
        </span>
      </div>

      {/* Patient Table Container */}
      <div style={{
        background: cardBgColor,
        border: borderStyle,
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{
                background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                borderBottom: borderStyle,
                color: textMuted,
                fontWeight: 600,
              }}>
                <th style={{ textAlign: 'left', padding: '12px 16px' }}>ID</th>
                <th style={{ textAlign: 'left', padding: '12px 16px' }}>Name</th>
                <th style={{ textAlign: 'left', padding: '12px 16px' }}>Age</th>
                <th style={{ textAlign: 'left', padding: '12px 16px' }}>Ward</th>
                <th style={{ textAlign: 'left', padding: '12px 16px' }}>Bed</th>
                <th style={{ textAlign: 'right', padding: '12px 16px' }}>Telemetry Quicklinks</th>
              </tr>
            </thead>
            <tbody>
              {data.entry.map((entry) => {
                const pat = entry.resource;
                const name = pat.name[0]?.text || 'N/A';
                const age = pat.extension.find(ext => ext.url === 'age')?.valueInteger ?? 'N/A';
                const dept = pat.extension.find(ext => ext.url === 'department')?.valueString ?? 'N/A';
                const bed = pat.extension.find(ext => ext.url === 'bed')?.valueString ?? 'N/A';

                return (
                  <tr key={pat.id} style={{
                    borderBottom: borderStyle,
                  }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 600 }}>
                      {pat.id}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                      {name}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {age}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        background: dept === 'ICU' ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)',
                        color: dept === 'ICU' ? '#ef4444' : '#3b82f6',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: 600,
                        fontSize: '11px',
                      }}>
                        {dept}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>
                      {bed}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => sendFollowUpMessage(`Show vitals for patient ${pat.id}`)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#10b981',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          💓 Vitals
                        </button>
                        <span style={{ color: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>|</span>
                        <button
                          onClick={() => sendFollowUpMessage(`Show medications for patient ${pat.id}`)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#3b82f6',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          💊 Meds
                        </button>
                        <span style={{ color: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>|</span>
                        <button
                          onClick={() => sendFollowUpMessage(`Show lab results for patient ${pat.id}`)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#f59e0b',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          🔬 Labs
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
