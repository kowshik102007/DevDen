'use client';

import React from 'react';
import { useTheme, useWidgetSDK } from '@nitrostack/widgets';

interface Rule {
  condition: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
}

interface Agent {
  id: string;
  templateId: string;
  name: string;
  description: string;
  status: 'active' | 'paused' | 'error';
  createdAt: string;
  config: {
    thresholds?: Record<string, any>;
    alertRules?: Rule[];
    checkIntervalSeconds?: number;
    resourceEndpoint?: string;
  };
}

interface EvolvedResponse {
  success: boolean;
  message: string;
  agent: Agent;
}

export default function AgentEvolved() {
  const theme = useTheme();
  const { isReady, getToolOutput, sendFollowUpMessage } = useWidgetSDK();
  const data = getToolOutput<EvolvedResponse>();

  if (!isReady) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280', fontFamily: 'monospace' }}>
        🧬 Reconfiguring agent pathways...
      </div>
    );
  }

  if (!data || !data.success || !data.agent) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#ef4444', fontFamily: 'monospace' }}>
        ⚠️ Failed to load evolved agent data.
      </div>
    );
  }

  const { agent } = data;
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
      padding: '24px',
      borderRadius: '16px',
      border: borderStyle,
      maxWidth: '550px',
      boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
      margin: '0 auto',
    }}>
      {/* Success Badge */}
      <div style={{
        textAlign: 'center',
        padding: '20px 16px',
        background: isDark
          ? 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(16,185,129,0.05) 100%)'
          : 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(16,185,129,0.03) 100%)',
        borderRadius: '12px',
        border: `1px solid ${isDark ? 'rgba(59,130,246,0.3)' : 'rgba(59,130,246,0.15)'}`,
        marginBottom: '20px',
      }}>
        <div style={{ fontSize: '40px', marginBottom: '8px' }}>🧬</div>
        <h2 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: 700, color: '#3b82f6' }}>
          Agent Configuration Evolved!
        </h2>
        <p style={{ margin: 0, fontSize: '13px', color: textMuted }}>
          {data.message}
        </p>
      </div>

      {/* Stats Summary */}
      <div style={{
        background: cardBgColor,
        border: borderStyle,
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '20px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>🤖 {agent.name}</h3>
          <span style={{ fontSize: '11px', color: textMuted, fontFamily: 'monospace' }}>
            {agent.id.slice(6, 12)}
          </span>
        </div>

        {/* Threshold List */}
        {agent.config.thresholds && Object.keys(agent.config.thresholds).length > 0 && (
          <div style={{ marginTop: '12px', borderTop: borderStyle, paddingTop: '12px' }}>
            <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', color: textMuted }}>UPDATED THRESHOLDS</h4>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
              gap: '8px',
            }}>
              {Object.entries(agent.config.thresholds).map(([k, v]) => (
                <div key={k} style={{
                  background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                  border: borderStyle,
                  borderRadius: '6px',
                  padding: '6px 10px',
                  fontSize: '12px',
                }}>
                  <div style={{ color: textMuted, fontSize: '10px', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k}</div>
                  <strong style={{ fontFamily: 'monospace', fontSize: '13px' }}>{String(v)}</strong>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Button controls */}
      <div style={{ textAlign: 'center' }}>
        <button
          onClick={() => sendFollowUpMessage('List all agents')}
          style={{
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            border: 'none',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(59,130,246,0.2)',
          }}
        >
          🖥️ Return to Agent Dashboard
        </button>
      </div>
    </div>
  );
}
