'use client';

import React, { useState } from 'react';
import { useTheme, useWidgetSDK } from '@nitrostack/widgets';

interface Agent {
  id: string;
  templateId: string;
  name: string;
  description: string;
  status: 'active' | 'paused' | 'error';
  alertCount: number;
  lastCheckedAt?: string;
  config: {
    thresholds?: Record<string, any>;
    alertRules?: Array<{ condition: string; severity: string; message: string }>;
    checkIntervalSeconds?: number;
    resourceEndpoint?: string;
  };
}

interface DashboardData {
  stats: {
    total: number;
    active: number;
    paused: number;
    error: number;
    totalAlerts: number;
    byTemplate: Record<string, number>;
  };
  agents: Agent[];
}

const getTemplateIcon = (templateId: string) => {
  const icons: Record<string, string> = {
    'vitals-monitoring': '💓',
    'blood-bank-inventory': '🩸',
    'nurse-notes-summarizer': '📝',
    'medication-tracker': '💊',
    'bed-status-monitor': '🏥',
    'lab-results-alert': '🔬',
  };
  return icons[templateId] || '🤖';
};

const getStatusColor = (status: Agent['status']) => {
  if (status === 'active') return '#10b981'; // Green
  if (status === 'paused') return '#f59e0b'; // Amber
  return '#ef4444'; // Red
};

export default function AgentDashboard() {
  const theme = useTheme();
  const { isReady, getToolOutput, callTool, sendFollowUpMessage } = useWidgetSDK();
  const data = getToolOutput<DashboardData>();
  const [runningChecks, setRunningChecks] = useState<Record<string, boolean>>({});
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  if (!isReady) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280', fontFamily: 'monospace' }}>
        🔄 Connecting to Frankenstein Factory...
      </div>
    );
  }

  if (!data || !data.agents) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#ef4444', fontFamily: 'monospace' }}>
        ⚠️ No agent dashboard data available. Create an agent first.
      </div>
    );
  }

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0f172a' : '#f8fafc';
  const cardBgColor = isDark ? '#1e293b' : '#ffffff';
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';
  const borderStyle = `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`;

  const handleRunCheck = async (agentId: string) => {
    setRunningChecks(prev => ({ ...prev, [agentId]: true }));
    setActionStatus(null);
    try {
      const res = (await callTool('alerts_run_agent_check', { agentId })) as any;
      if (res && res.success) {
        setActionStatus(`✅ Check run complete. Alerts triggered: ${res.triggeredAlerts}`);
      } else {
        setActionStatus(`❌ Check failed: ${res?.error || 'Unknown error'}`);
      }
    } catch (err) {
      setActionStatus(`❌ Error running check: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRunningChecks(prev => ({ ...prev, [agentId]: false }));
    }
  };

  const handleToggleStatus = async (agentId: string, currentStatus: Agent['status']) => {
    const nextStatus = currentStatus === 'active' ? 'paused' : 'active';
    try {
      await callTool('agents_set_agent_status', { agentId, status: nextStatus });
      setActionStatus(`🔄 Agent status updated to ${nextStatus}`);
    } catch (err) {
      setActionStatus(`❌ Failed to update status`);
    }
  };

  const formatRelativeTime = (isoString?: string) => {
    if (!isoString) return 'Never checked';
    const date = new Date(isoString);
    const diffMs = Date.now() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    if (diffSec < 10) return 'just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    return `${diffMin}m ago`;
  };

  return (
    <div style={{
      background: bgColor,
      color: textColor,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '20px',
      borderRadius: '16px',
      border: borderStyle,
      maxWidth: '850px',
      boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
      margin: '0 auto',
    }}>
      {/* Dashboard Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        borderBottom: borderStyle,
        paddingBottom: '16px',
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🏥</span> Hospital AI Agent Factory
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: textMuted }}>
            Real-time telemetry and control board
          </p>
        </div>
        <button
          onClick={() => sendFollowUpMessage('List all templates')}
          style={{
            background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
            border: borderStyle,
            color: textColor,
            padding: '6px 12px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          📄 View Templates
        </button>
      </div>

      {/* Action Notification */}
      {actionStatus && (
        <div style={{
          background: isDark ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.05)',
          border: `1px solid ${isDark ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.15)'}`,
          borderRadius: '8px',
          padding: '10px 14px',
          marginBottom: '20px',
          fontSize: '13px',
          fontWeight: 500,
          color: isDark ? '#60a5fa' : '#2563eb',
        }}>
          {actionStatus}
        </div>
      )}

      {/* Stats Section */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: '12px',
        marginBottom: '24px',
      }}>
        {[
          { label: 'Total Agents', value: data.stats.total, icon: '🤖', color: '#3b82f6' },
          { label: 'Active', value: data.stats.active, icon: '🟢', color: '#10b981' },
          { label: 'Paused', value: data.stats.paused, icon: '🟡', color: '#f59e0b' },
          { label: 'Alerts Triggered', value: data.stats.totalAlerts, icon: '🚨', color: '#ef4444' }
        ].map((item, idx) => (
          <div key={idx} style={{
            background: cardBgColor,
            border: borderStyle,
            borderRadius: '12px',
            padding: '12px 16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <span style={{ fontSize: '24px' }}>{item.icon}</span>
            <div>
              <div style={{ fontSize: '11px', color: textMuted, fontWeight: 500 }}>{item.label}</div>
              <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'monospace', color: item.color }}>{item.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Agent Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 600, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Registered Agents ({data.agents.length})
        </h3>
        
        {data.agents.map((agent) => (
          <div key={agent.id} style={{
            background: cardBgColor,
            border: borderStyle,
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
            transition: 'border-color 0.2s',
          }}>
            {/* Top row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ fontSize: '32px', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', padding: '6px', borderRadius: '10px' }}>
                  {getTemplateIcon(agent.templateId)}
                </span>
                <div>
                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {agent.name}
                    <span style={{
                      display: 'inline-block',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: getStatusColor(agent.status),
                    }} />
                  </h4>
                  <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: textMuted }}>{agent.description}</p>
                </div>
              </div>

              {/* Status Badge */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                {agent.alertCount > 0 && (
                  <span style={{
                    background: '#ef4444',
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 700,
                    fontFamily: 'monospace',
                  }}>
                    🚨 {agent.alertCount} alert{agent.alertCount > 1 ? 's' : ''}
                  </span>
                )}
                <span style={{ fontSize: '11px', color: textMuted }}>
                  ID: <span style={{ fontFamily: 'monospace' }}>{agent.id.slice(6, 12)}</span>
                </span>
              </div>
            </div>

            {/* Bottom Controls / Config summary */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '12px',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
            }}>
              <div style={{ display: 'flex', gap: '16px', color: textMuted }}>
                <span>
                  ⏱️ Interval: <strong style={{ color: textColor }}>{agent.config.checkIntervalSeconds || 30}s</strong>
                </span>
                <span>
                  🔍 Checked: <strong style={{ color: textColor }}>{formatRelativeTime(agent.lastCheckedAt)}</strong>
                </span>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                {/* Active/Pause Toggle */}
                <button
                  onClick={() => handleToggleStatus(agent.id, agent.status)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: agent.status === 'active' ? '#f59e0b' : '#10b981',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  {agent.status === 'active' ? '⏸️ Pause' : '▶️ Activate'}
                </button>

                <span style={{ color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }}>|</span>

                {/* Details query */}
                <button
                  onClick={() => sendFollowUpMessage(`Show details for agent ${agent.id}`)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#3b82f6',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  ⚙️ Config
                </button>

                <span style={{ color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }}>|</span>

                {/* Run check */}
                <button
                  onClick={() => handleRunCheck(agent.id)}
                  disabled={runningChecks[agent.id] || agent.status !== 'active'}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: agent.status !== 'active' ? '#6b7280' : '#10b981',
                    fontWeight: 600,
                    cursor: agent.status !== 'active' ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                  }}
                >
                  {runningChecks[agent.id] ? '⚡ Checking...' : '⚡ Run Check'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
