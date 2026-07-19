'use client';

import React from 'react';
import { useTheme, useWidgetSDK } from '@nitrostack/widgets';

interface FactoryStatsData {
  total: number;
  active: number;
  paused: number;
  error: number;
  totalAlerts: number;
  byTemplate: Record<string, number>;
}

const getTemplateLabel = (templateId: string) => {
  const labels: Record<string, string> = {
    'vitals-monitoring': 'Vitals Monitor 💓',
    'blood-bank-inventory': 'Blood Bank Tracker 🩸',
    'nurse-notes-summarizer': 'Nurse Notes Summarizer 📝',
    'medication-tracker': 'Medication Tracker 💊',
    'bed-status-monitor': 'Bed Status Monitor 🏥',
    'lab-results-alert': 'Lab Results Alert 🔬',
  };
  return labels[templateId] || templateId;
};

export default function FactoryStats() {
  const theme = useTheme();
  const { isReady, getToolOutput, sendFollowUpMessage } = useWidgetSDK();
  const data = getToolOutput<FactoryStatsData>();

  if (!isReady) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280', fontFamily: 'monospace' }}>
        📊 Compiling factory analytics...
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#ef4444', fontFamily: 'monospace' }}>
        ⚠️ No factory statistics available.
      </div>
    );
  }

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0f172a' : '#f8fafc';
  const cardBgColor = isDark ? '#1e293b' : '#ffffff';
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';
  const borderStyle = `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`;

  // Find max template count for relative bar width
  const templateCounts = Object.values(data.byTemplate);
  const maxCount = templateCounts.length > 0 ? Math.max(...templateCounts) : 1;

  return (
    <div style={{
      background: bgColor,
      color: textColor,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '20px',
      borderRadius: '16px',
      border: borderStyle,
      maxWidth: '600px',
      boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
      margin: '0 auto',
    }}>
      {/* Title */}
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
            <span>📊</span> Factory Statistics
          </h2>
          <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: textMuted }}>
            Deployment and operational stats across all templates
          </p>
        </div>
        <button
          onClick={() => sendFollowUpMessage('List all agents')}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#3b82f6',
            fontWeight: 600,
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          🖥️ View Agents
        </button>
      </div>

      {/* Grid counters */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '10px',
        marginBottom: '20px',
      }}>
        {[
          { label: 'Deployed Agents', value: data.total, color: '#3b82f6' },
          { label: 'Active Monitors', value: data.active, color: '#10b981' },
          { label: 'Paused Monitors', value: data.paused, color: '#f59e0b' },
          { label: 'System Errors', value: data.error, color: '#ef4444' },
          { label: 'Alerts Triaged', value: data.totalAlerts, color: '#ef4444' }
        ].map((c, idx) => (
          <div key={idx} style={{
            background: cardBgColor,
            border: borderStyle,
            borderRadius: '10px',
            padding: '12px',
            textAlign: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
            // Span last item full row if odd number
            gridColumn: idx === 4 ? 'span 2' : 'auto',
          }}>
            <div style={{ fontSize: '11px', color: textMuted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              {c.label}
            </div>
            <div style={{
              fontSize: '24px',
              fontWeight: 800,
              fontFamily: 'monospace',
              color: c.color,
              marginTop: '4px'
            }}>
              {c.value}
            </div>
          </div>
        ))}
      </div>

      {/* Template distribution */}
      <div style={{
        background: cardBgColor,
        border: borderStyle,
        borderRadius: '12px',
        padding: '16px',
      }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 600, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          📈 Agent Distribution by Template
        </h3>

        {Object.keys(data.byTemplate).length === 0 ? (
          <div style={{ fontSize: '12px', color: textMuted, fontStyle: 'italic', textAlign: 'center', padding: '12px' }}>
            No templates currently instantiated.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {Object.entries(data.byTemplate).map(([templateId, count]) => {
              const percentage = (count / maxCount) * 100;
              return (
                <div key={templateId} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ fontWeight: 500 }}>{getTemplateLabel(templateId)}</span>
                    <strong style={{ fontFamily: 'monospace' }}>
                      {count} agent{count > 1 ? 's' : ''}
                    </strong>
                  </div>
                  {/* Progress bar container */}
                  <div style={{
                    width: '100%',
                    height: '8px',
                    background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${percentage}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)',
                      borderRadius: '4px',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
