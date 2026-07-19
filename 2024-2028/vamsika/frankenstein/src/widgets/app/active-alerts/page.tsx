'use client';

import React, { useState } from 'react';
import { useTheme, useWidgetSDK } from '@nitrostack/widgets';

interface Alert {
  id: string;
  agentId: string;
  condition: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  createdAt: string;
}

interface AlertsData {
  total: number;
  alerts: Alert[];
}

const getSeverityColors = (severity: Alert['severity'], isDark: boolean) => {
  const themes: Record<Alert['severity'], { bg: string; border: string; text: string; indicator: string }> = {
    info: {
      bg: isDark ? 'rgba(107,114,128,0.1)' : 'rgba(243,244,246,1)',
      border: isDark ? 'rgba(107,114,128,0.2)' : 'rgba(229,231,235,1)',
      text: isDark ? '#d1d5db' : '#374151',
      indicator: '#6b7280'
    },
    warning: {
      bg: isDark ? 'rgba(245,158,11,0.1)' : 'rgba(254,243,199,1)',
      border: isDark ? 'rgba(245,158,11,0.25)' : 'rgba(253,230,138,1)',
      text: isDark ? '#fef3c7' : '#92400e',
      indicator: '#f59e0b'
    },
    critical: {
      bg: isDark ? 'rgba(239,68,68,0.1)' : 'rgba(254,226,226,1)',
      border: isDark ? 'rgba(239,68,68,0.3)' : 'rgba(252,165,165,1)',
      text: isDark ? '#fee2e2' : '#991b1b',
      indicator: '#ef4444'
    }
  };
  return themes[severity] || themes.info;
};

export default function ActiveAlerts() {
  const theme = useTheme();
  const { isReady, getToolOutput, callTool } = useWidgetSDK();
  const data = getToolOutput<AlertsData>();
  const [resolvingIds, setResolvingIds] = useState<Record<string, boolean>>({});
  const [resolvedIds, setResolvedIds] = useState<Record<string, boolean>>({});

  if (!isReady) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280', fontFamily: 'monospace' }}>
        🚨 Checking active alert status...
      </div>
    );
  }

  if (!data || !data.alerts || data.alerts.length === 0) {
    return (
      <div style={{
        padding: '30px',
        textAlign: 'center',
        background: theme === 'dark' ? 'rgba(16,185,129,0.05)' : 'rgba(16,185,129,0.02)',
        border: `1px solid ${theme === 'dark' ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.08)'}`,
        borderRadius: '12px',
        color: '#10b981',
        maxWidth: '500px',
        margin: '20px auto',
      }}>
        <div style={{ fontSize: '32px', marginBottom: '8px' }}>🟢</div>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>All Stations Clear</h3>
        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#6b7280' }}>
          No active patient or inventory alerts are pending.
        </p>
      </div>
    );
  }

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0f172a' : '#f8fafc';
  const cardBgColor = isDark ? '#1e293b' : '#ffffff';
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';
  const borderStyle = `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`;

  const handleResolve = async (alertId: string) => {
    setResolvingIds(prev => ({ ...prev, [alertId]: true }));
    try {
      await callTool('alerts_resolve_alert', { alertId });
      setResolvedIds(prev => ({ ...prev, [alertId]: true }));
    } catch (err) {
      console.error('Failed to resolve alert', err);
    } finally {
      setResolvingIds(prev => ({ ...prev, [alertId]: false }));
    }
  };

  const formatRelativeTime = (isoString: string) => {
    const date = new Date(isoString);
    const diffMs = Date.now() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);

    if (diffSec < 10) return 'just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    return `${diffMin}m ago`;
  };

  // Filter out locally resolved ones for smooth feedback
  const activeAlerts = data.alerts.filter(alert => !resolvedIds[alert.id]);

  if (activeAlerts.length === 0) {
    return (
      <div style={{
        padding: '30px',
        textAlign: 'center',
        background: isDark ? 'rgba(16,185,129,0.05)' : 'rgba(16,185,129,0.02)',
        border: `1px solid ${isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.08)'}`,
        borderRadius: '12px',
        color: '#10b981',
        maxWidth: '500px',
        margin: '20px auto',
      }}>
        <div style={{ fontSize: '32px', marginBottom: '8px' }}>✅</div>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Alerts Resolved</h3>
        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: textMuted }}>
          All active alerts have been resolved.
        </p>
      </div>
    );
  }

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
            <span>🚨</span> Active Command Alerts
          </h2>
          <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: textMuted }}>
            Clinician attention required for out-of-bounds conditions
          </p>
        </div>
        <span style={{
          background: '#ef4444',
          color: 'white',
          fontWeight: 700,
          fontSize: '12px',
          padding: '4px 10px',
          borderRadius: '20px',
          fontFamily: 'monospace',
        }}>
          {activeAlerts.length} Active
        </span>
      </div>

      {/* Alert Card List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {activeAlerts.map((alert) => {
          const colors = getSeverityColors(alert.severity, isDark);
          const isResolving = resolvingIds[alert.id];

          return (
            <div key={alert.id} style={{
              background: colors.bg,
              border: `1px solid ${colors.border}`,
              color: colors.text,
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              position: 'relative',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
              transition: 'opacity 0.2s',
              opacity: isResolving ? 0.6 : 1,
            }}>
              {/* Top Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: colors.indicator,
                  }} />
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    {alert.severity} ALERT
                  </span>
                </div>
                <span style={{ fontSize: '11px', opacity: 0.8, fontFamily: 'monospace' }}>
                  {formatRelativeTime(alert.createdAt)}
                </span>
              </div>

              {/* Message */}
              <div style={{
                fontSize: '14px',
                fontWeight: 600,
                lineHeight: '1.4',
              }}>
                {alert.message}
              </div>

              {/* Footer / Actions */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
                paddingTop: '10px',
                marginTop: '2px',
              }}>
                <div style={{ fontSize: '11px', opacity: 0.8 }}>
                  Agent: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{alert.agentId.slice(6, 12)}</span> | Condition: <span style={{ fontFamily: 'monospace' }}>{alert.condition}</span>
                </div>

                <button
                  onClick={() => handleResolve(alert.id)}
                  disabled={isResolving}
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: colors.text,
                    cursor: isResolving ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {isResolving ? '🔄 Resolving...' : '✓ Resolve'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
