'use client';

import React from 'react';
import { useTheme, useWidgetSDK } from '@nitrostack/widgets';

interface Alert {
  id: string;
  agentId: string;
  condition: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  patientId?: string;
  metric?: string;
  value?: any;
  threshold?: any;
  createdAt: string;
}

interface CheckResultData {
  success: boolean;
  error?: string;
  agentId?: string;
  agentName?: string;
  checkedAt?: string;
  triggeredAlerts?: number;
  alerts?: Alert[];
}

export default function AgentCheckResult() {
  const theme = useTheme();
  const { isReady, getToolOutput, sendFollowUpMessage } = useWidgetSDK();
  const data = getToolOutput<CheckResultData>();

  if (!isReady) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280', fontFamily: 'monospace' }}>
        ⚡ Evaluating agent rule sets...
      </div>
    );
  }

  if (!data || !data.success) {
    return (
      <div style={{
        padding: '24px',
        textAlign: 'center',
        background: theme === 'dark' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        borderRadius: '12px',
        color: '#ef4444',
        maxWidth: '500px',
        margin: '20px auto',
      }}>
        <h3 style={{ marginTop: 0 }}>⚠️ Check Run Failed</h3>
        <p>{data?.error || 'Could not complete the agent check run.'}</p>
      </div>
    );
  }

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0f172a' : '#f8fafc';
  const cardBgColor = isDark ? '#1e293b' : '#ffffff';
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';
  const borderStyle = `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`;

  const count = data.triggeredAlerts || 0;
  const timeStr = data.checkedAt ? new Date(data.checkedAt).toLocaleString() : 'N/A';

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
            <span>⚡</span> Check Run Report
          </h2>
          <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: textMuted }}>
            Telemetry audit results for {data.agentName || 'Agent'}
          </p>
        </div>
        <span style={{
          fontSize: '11px',
          color: textMuted,
          fontFamily: 'monospace'
        }}>
          {timeStr}
        </span>
      </div>

      {/* Summary Box */}
      {count === 0 ? (
        <div style={{
          background: isDark ? 'rgba(16,185,129,0.15)' : '#d1fae5',
          border: `1px solid ${isDark ? 'rgba(16,185,129,0.3)' : '#a7f3d0'}`,
          borderRadius: '12px',
          padding: '20px',
          textAlign: 'center',
          color: '#10b981',
          marginBottom: '20px',
        }}>
          <span style={{ fontSize: '32px' }}>🟢</span>
          <h3 style={{ margin: '8px 0 4px 0', fontSize: '16px', fontWeight: 700 }}>Telemetry Status: OK</h3>
          <p style={{ margin: 0, fontSize: '13px', color: isDark ? '#a7f3d0' : '#065f46' }}>
            All metrics matched standard thresholds. No alerts were raised.
          </p>
        </div>
      ) : (
        <div style={{
          background: isDark ? 'rgba(239,68,68,0.15)' : '#fee2e2',
          border: `1px solid ${isDark ? 'rgba(239,68,68,0.3)' : '#fca5a5'}`,
          borderRadius: '12px',
          padding: '20px',
          textAlign: 'center',
          color: '#ef4444',
          marginBottom: '20px',
        }}>
          <span style={{ fontSize: '32px' }}>🚨</span>
          <h3 style={{ margin: '8px 0 4px 0', fontSize: '16px', fontWeight: 700 }}>Telemetry status: ALERT</h3>
          <p style={{ margin: 0, fontSize: '13px', color: isDark ? '#fca5a5' : '#991b1b' }}>
            This check run triggered <strong>{count}</strong> active alert{count > 1 ? 's' : ''} in the database.
          </p>
        </div>
      )}

      {/* Raised alerts listing */}
      {count > 0 && data.alerts && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
          <h4 style={{ margin: 0, fontSize: '12px', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Triggered Telemetry Breaches
          </h4>
          {data.alerts.map((alert) => (
            <div key={alert.id} style={{
              background: cardBgColor,
              border: borderStyle,
              borderLeft: `4px solid ${alert.severity === 'critical' ? '#ef4444' : '#f59e0b'}`,
              borderRadius: '8px',
              padding: '12px 14px',
              fontSize: '13px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: alert.severity === 'critical' ? '#ef4444' : '#f59e0b',
                  textTransform: 'uppercase',
                }}>
                  {alert.severity}
                </span>
                {alert.patientId && (
                  <span style={{ fontSize: '11px', color: textMuted, fontFamily: 'monospace' }}>
                    Patient: {alert.patientId}
                  </span>
                )}
              </div>
              <div style={{ fontWeight: 600, color: textColor, lineHeight: '1.4' }}>
                {alert.message}
              </div>
              <div style={{
                display: 'flex',
                gap: '16px',
                marginTop: '8px',
                fontSize: '11px',
                color: textMuted,
                fontFamily: 'monospace',
                borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                paddingTop: '6px'
              }}>
                {alert.metric && (
                  <span>Metric: <strong>{alert.metric}</strong></span>
                )}
                {alert.value !== undefined && (
                  <span>Value: <strong style={{ color: alert.severity === 'critical' ? '#ef4444' : '#f59e0b' }}>{alert.value}</strong></span>
                )}
                {alert.threshold !== undefined && (
                  <span>Threshold: <strong>{alert.threshold}</strong></span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Buttons */}
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <button
          onClick={() => sendFollowUpMessage('Show active alerts')}
          style={{
            background: 'transparent',
            border: borderStyle,
            color: textColor,
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          🚨 View Active Alerts Board
        </button>
        <button
          onClick={() => sendFollowUpMessage('List all agents')}
          style={{
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            border: 'none',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 10px rgba(59,130,246,0.15)',
          }}
        >
          🖥️ Return to Dashboard
        </button>
      </div>
    </div>
  );
}
