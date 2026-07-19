'use client';

import React, { useState } from 'react';
import { useTheme, useWidgetSDK } from '@nitrostack/widgets';

interface SimulatedAlert {
  id: string;
  condition: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  patientId?: string;
  metric?: string;
  value?: any;
  threshold?: any;
}

interface EvalData {
  agentId: string;
  agentName: string;
  thresholdsConfigured: number;
  rulesConfigured: number;
  wouldTrigger: number;
  details: SimulatedAlert[];
}

export default function ThresholdEval() {
  const theme = useTheme();
  const { isReady, getToolOutput, callTool, sendFollowUpMessage } = useWidgetSDK();
  const data = getToolOutput<EvalData>();
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  if (!isReady) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280', fontFamily: 'monospace' }}>
        🔬 Simulating threshold models...
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#ef4444', fontFamily: 'monospace' }}>
        ⚠️ No simulation results available.
      </div>
    );
  }

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0f172a' : '#f8fafc';
  const cardBgColor = isDark ? '#1e293b' : '#ffffff';
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';
  const borderStyle = `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`;

  const handleCommitCheck = async () => {
    setRunning(true);
    setStatus(null);
    try {
      const res = (await callTool('alerts_run_agent_check', { agentId: data.agentId })) as any;
      if (res && res.success) {
        setStatus(`✅ Check run complete. Triggered ${res.triggeredAlerts} alerts.`);
      } else {
        setStatus(`❌ Failed: ${res?.error || 'Unknown error'}`);
      }
    } catch (err) {
      setStatus(`❌ Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRunning(false);
    }
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
            <span>🔬</span> Dry-Run Rule Evaluation
          </h2>
          <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: textMuted }}>
            Simulation run against current data sets without database writes
          </p>
        </div>
        <span style={{
          fontSize: '11px',
          fontWeight: 700,
          background: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.05)',
          padding: '4px 8px',
          borderRadius: '12px',
          color: '#3b82f6',
        }}>
          Simulation
        </span>
      </div>

      {status && (
        <div style={{
          background: status.includes('✅') ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
          border: `1px solid ${status.includes('✅') ? '#10b98144' : '#ef444444'}`,
          borderRadius: '8px',
          padding: '10px 14px',
          marginBottom: '20px',
          fontSize: '13px',
          color: status.includes('✅') ? '#10b981' : '#ef4444',
          fontWeight: 500,
        }}>
          {status}
        </div>
      )}

      {/* Grid counters */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px',
        marginBottom: '20px',
      }}>
        <div style={{ background: cardBgColor, border: borderStyle, padding: '12px', borderRadius: '10px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: textMuted, fontWeight: 500 }}>ACTIVE RULES</div>
          <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'monospace', marginTop: '4px' }}>{data.rulesConfigured}</div>
        </div>
        <div style={{ background: cardBgColor, border: borderStyle, padding: '12px', borderRadius: '10px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: textMuted, fontWeight: 500 }}>PARAMETERS</div>
          <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'monospace', marginTop: '4px' }}>{data.thresholdsConfigured}</div>
        </div>
        <div style={{
          background: data.wouldTrigger > 0 ? (isDark ? 'rgba(245,158,11,0.15)' : '#fef3c7') : cardBgColor,
          border: data.wouldTrigger > 0 ? '1px solid #fde047' : borderStyle,
          padding: '12px',
          borderRadius: '10px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '11px', color: data.wouldTrigger > 0 ? '#d97706' : textMuted, fontWeight: 500 }}>BREACHES</div>
          <div style={{
            fontSize: '20px',
            fontWeight: 700,
            fontFamily: 'monospace',
            color: data.wouldTrigger > 0 ? '#f59e0b' : textColor,
            marginTop: '4px'
          }}>
            {data.wouldTrigger}
          </div>
        </div>
      </div>

      {/* Simulated alerts detail */}
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 600, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Simulated Breach Output
        </h3>

        {data.wouldTrigger === 0 ? (
          <div style={{
            background: isDark ? 'rgba(16,185,129,0.05)' : 'rgba(16,185,129,0.02)',
            border: `1px solid ${isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.08)'}`,
            borderRadius: '12px',
            padding: '16px',
            textAlign: 'center',
            color: '#10b981',
            fontSize: '13px',
          }}>
            ✓ No threshold breaches simulated. Config is stable for current patient data.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {data.details.map((alert, idx) => (
              <div key={idx} style={{
                background: cardBgColor,
                border: borderStyle,
                borderLeft: `4px solid ${alert.severity === 'critical' ? '#ef4444' : '#f59e0b'}`,
                borderRadius: '8px',
                padding: '12px',
                fontSize: '13px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '11px', color: textMuted }}>
                  <span style={{ fontWeight: 700, color: alert.severity === 'critical' ? '#ef4444' : '#f59e0b', textTransform: 'uppercase' }}>
                    {alert.severity}
                  </span>
                  {alert.patientId && <span>Patient: {alert.patientId}</span>}
                </div>
                <div style={{ fontWeight: 600 }}>{alert.message}</div>
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  marginTop: '8px',
                  fontSize: '11px',
                  color: textMuted,
                  fontFamily: 'monospace',
                }}>
                  <span>Metric: <strong>{alert.metric}</strong></span>
                  <span>Sim Value: <strong>{alert.value}</strong></span>
                  <span>Threshold: <strong>{alert.threshold}</strong></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div style={{
        borderTop: borderStyle,
        paddingTop: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <button
          onClick={() => sendFollowUpMessage('List all agents')}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#3b82f6',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          🖥️ Cancel & Dashboard
        </button>

        <button
          onClick={handleCommitCheck}
          disabled={running}
          style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            border: 'none',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: running ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 12px rgba(16,185,129,0.15)',
            opacity: running ? 0.7 : 1,
          }}
        >
          {running ? '⚡ Running...' : '⚡ Commit Live Run Check'}
        </button>
      </div>
    </div>
  );
}
