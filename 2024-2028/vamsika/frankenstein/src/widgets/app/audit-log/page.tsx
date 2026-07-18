'use client';

import React from 'react';
import { useTheme, useWidgetSDK } from '@nitrostack/widgets';

interface AuditEvent {
  id: string;
  action: string;
  timestamp: string;
  agentId?: string;
  resource?: string;
  result: string;
  severity: 'info' | 'warning' | 'critical';
}

interface AuditLogData {
  total: number;
  events: AuditEvent[];
}

const getSeverityStyles = (severity: AuditEvent['severity'], isDark: boolean) => {
  const styles: Record<AuditEvent['severity'], { color: string; bg: string; dot: string }> = {
    info: {
      color: isDark ? '#94a3b8' : '#475569',
      bg: isDark ? 'rgba(148,163,184,0.1)' : 'rgba(71,85,105,0.06)',
      dot: isDark ? '#64748b' : '#94a3b8'
    },
    warning: {
      color: '#d97706',
      bg: isDark ? 'rgba(217,119,6,0.1)' : 'rgba(217,119,6,0.06)',
      dot: '#f59e0b'
    },
    critical: {
      color: '#dc2626',
      bg: isDark ? 'rgba(220,38,38,0.1)' : 'rgba(220,38,38,0.06)',
      dot: '#ef4444'
    }
  };
  return styles[severity] || styles.info;
};

const formatActionName = (action: string) => {
  return action
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

export default function AuditLog() {
  const theme = useTheme();
  const { isReady, getToolOutput } = useWidgetSDK();
  const data = getToolOutput<AuditLogData>();

  if (!isReady) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280', fontFamily: 'monospace' }}>
        ⏳ Loading audit records...
      </div>
    );
  }

  if (!data || !data.events || data.events.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280', fontFamily: 'monospace' }}>
        📭 Audit log is empty. No actions recorded yet.
      </div>
    );
  }

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0f172a' : '#f8fafc';
  const cardBgColor = isDark ? '#1e293b' : '#ffffff';
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';
  const borderStyle = `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`;

  const formatRelativeTime = (isoString: string) => {
    const date = new Date(isoString);
    const diffMs = Date.now() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);

    if (diffSec < 10) return 'just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    return date.toLocaleDateString();
  };

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
            <span>📜</span> System Audit Log
          </h2>
          <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: textMuted }}>
            Chronological log of factory actions & alert checks
          </p>
        </div>
        <span style={{
          fontSize: '11px',
          fontWeight: 700,
          background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
          padding: '4px 8px',
          borderRadius: '12px',
          color: textMuted,
          fontFamily: 'monospace'
        }}>
          Total: {data.total}
        </span>
      </div>

      {/* Timeline List */}
      <div style={{
        position: 'relative',
        paddingLeft: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}>
        {/* Continuous Line */}
        <div style={{
          position: 'absolute',
          left: '5px',
          top: '8px',
          bottom: '8px',
          width: '2px',
          background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
        }} />

        {data.events.map((event) => {
          const sevStyle = getSeverityStyles(event.severity, isDark);
          return (
            <div key={event.id} style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}>
              {/* Dot indicator */}
              <div style={{
                position: 'absolute',
                left: '-15px',
                top: '5px',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: sevStyle.dot,
                border: `2px solid ${bgColor}`,
                boxShadow: `0 0 0 2px ${sevStyle.dot}33`,
              }} />

              {/* Event card header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>
                    {formatActionName(event.action)}
                  </span>
                  <span style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: sevStyle.color,
                    background: sevStyle.bg,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    letterSpacing: '0.05em'
                  }}>
                    {event.severity}
                  </span>
                </div>
                <span
                  title={new Date(event.timestamp).toLocaleString()}
                  style={{
                    fontSize: '11px',
                    color: textMuted,
                    fontFamily: 'monospace'
                  }}
                >
                  {formatRelativeTime(event.timestamp)}
                </span>
              </div>

              {/* Event payload text */}
              <div style={{
                background: cardBgColor,
                border: borderStyle,
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '13px',
                lineHeight: '1.4',
                color: textColor,
              }}>
                {event.result}
              </div>

              {/* Resource indicator */}
              {event.resource && (
                <div style={{
                  fontSize: '11px',
                  color: textMuted,
                  display: 'flex',
                  gap: '12px'
                }}>
                  <span>Component: <strong style={{ color: isDark ? '#cbd5e1' : '#475569' }}>{event.resource}</strong></span>
                  {event.agentId && (
                    <span>Agent: <strong style={{ fontFamily: 'monospace', color: isDark ? '#cbd5e1' : '#475569' }}>{event.agentId.slice(6, 12)}</strong></span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
