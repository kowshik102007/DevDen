'use client';

import React, { useState, useEffect } from 'react';
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
  alertCount: number;
  config: {
    thresholds?: Record<string, any>;
    alertRules?: Rule[];
    checkIntervalSeconds?: number;
    resourceEndpoint?: string;
  };
}

interface AgentDetailResponse {
  success: boolean;
  error?: string;
  agent?: Agent;
}

export default function AgentDetail() {
  const theme = useTheme();
  const { isReady, getToolOutput, callTool } = useWidgetSDK();
  const data = getToolOutput<AgentDetailResponse>();
  const [thresholds, setThresholds] = useState<Record<string, any>>({});
  const [evolving, setEvolving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Initialize form thresholds once data is loaded
  useEffect(() => {
    if (data?.agent?.config?.thresholds) {
      setThresholds(data.agent.config.thresholds);
    }
  }, [data]);

  if (!isReady) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280', fontFamily: 'monospace' }}>
        🔍 Fetching agent metadata...
      </div>
    );
  }

  if (!data || !data.success || !data.agent) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#ef4444', fontFamily: 'monospace' }}>
        ⚠️ Failed to load agent status. {data?.error || 'Agent not found.'}
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

  const handleInputChange = (key: string, value: string) => {
    // If numeric, parse it
    const num = Number(value);
    setThresholds(prev => ({
      ...prev,
      [key]: isNaN(num) || value.trim() === '' ? value : num
    }));
  };

  const handleEvolve = async (e: React.FormEvent) => {
    e.preventDefault();
    setEvolving(true);
    setMessage(null);
    try {
      const res = (await callTool('agents_evolve_agent', {
        agentId: agent.id,
        thresholds
      })) as any;
      if (res && res.success) {
        setMessage('✅ Agent thresholds evolved successfully!');
      } else {
        setMessage(`❌ Failed: ${res?.error || 'Unknown error'}`);
      }
    } catch (err) {
      setMessage(`❌ Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setEvolving(false);
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
      maxWidth: '750px',
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
            <span>⚙️</span> Agent Inspector & Evolution
          </h2>
          <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: textMuted }}>
            Evolve thresholds and examine injected rules
          </p>
        </div>
        <span style={{
          background: agent.status === 'active' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
          color: agent.status === 'active' ? '#10b981' : '#f59e0b',
          fontSize: '11px',
          fontWeight: 700,
          padding: '4px 10px',
          borderRadius: '12px',
          textTransform: 'uppercase'
        }}>
          {agent.status}
        </span>
      </div>

      {message && (
        <div style={{
          background: message.includes('✅') ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
          border: `1px solid ${message.includes('✅') ? '#10b98144' : '#ef444444'}`,
          borderRadius: '8px',
          padding: '10px 14px',
          marginBottom: '20px',
          fontSize: '13px',
          fontWeight: 500,
          color: message.includes('✅') ? '#10b981' : '#ef4444',
        }}>
          {message}
        </div>
      )}

      {/* Meta Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '12px',
        marginBottom: '20px',
      }}>
        <div style={{ background: cardBgColor, border: borderStyle, padding: '12px', borderRadius: '10px' }}>
          <div style={{ fontSize: '11px', color: textMuted, fontWeight: 500 }}>AGENT NAME</div>
          <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '2px' }}>{agent.name}</div>
        </div>
        <div style={{ background: cardBgColor, border: borderStyle, padding: '12px', borderRadius: '10px' }}>
          <div style={{ fontSize: '11px', color: textMuted, fontWeight: 500 }}>RESOURCE ENDPOINT</div>
          <div style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'monospace', marginTop: '2px', wordBreak: 'break-all' }}>
            {agent.config.resourceEndpoint || 'N/A'}
          </div>
        </div>
        <div style={{ background: cardBgColor, border: borderStyle, padding: '12px', borderRadius: '10px' }}>
          <div style={{ fontSize: '11px', color: textMuted, fontWeight: 500 }}>TELEMETRY INTERVAL</div>
          <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '2px' }}>{agent.config.checkIntervalSeconds || 30}s</div>
        </div>
      </div>

      {/* Two Column Layout: Edit Thresholds & Rules */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        
        {/* Left Col: Threshold Editor */}
        <form onSubmit={handleEvolve} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            🎛️ Evolve Thresholds
          </h3>
          
          <div style={{
            background: cardBgColor,
            border: borderStyle,
            borderRadius: '12px',
            padding: '14px',
          }}>
            {Object.keys(thresholds).length === 0 ? (
              <div style={{ fontSize: '13px', color: textMuted, fontStyle: 'italic', textAlign: 'center', padding: '12px' }}>
                No configurable thresholds for this agent type.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: borderStyle }}>
                    <th style={{ textAlign: 'left', fontSize: '11px', color: textMuted, paddingBottom: '6px' }}>Parameter</th>
                    <th style={{ textAlign: 'right', fontSize: '11px', color: textMuted, paddingBottom: '6px' }}>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(thresholds).map(([key, val]) => (
                    <tr key={key} style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` }}>
                      <td style={{ fontSize: '13px', padding: '8px 0', fontFamily: 'monospace' }}>
                        {key}
                      </td>
                      <td style={{ textAlign: 'right', padding: '8px 0' }}>
                        <input
                          type="text"
                          value={String(val)}
                          onChange={(e) => handleInputChange(key, e.target.value)}
                          style={{
                            width: '80px',
                            textAlign: 'right',
                            padding: '4px 8px',
                            background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,1)',
                            border: borderStyle,
                            borderRadius: '4px',
                            color: textColor,
                            fontSize: '13px',
                            fontFamily: 'monospace',
                            outline: 'none',
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <button
            type="submit"
            disabled={evolving || Object.keys(thresholds).length === 0}
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              color: 'white',
              padding: '10px 14px',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '13px',
              cursor: evolving ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(16,185,129,0.15)',
              opacity: evolving ? 0.7 : 1,
            }}
          >
            {evolving ? '🔄 Committing changes...' : '🧬 Evolve Threshold Config'}
          </button>
        </form>

        {/* Right Col: Alert Rules Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            📋 Configured Alert Rules
          </h3>
          
          <div style={{
            background: cardBgColor,
            border: borderStyle,
            borderRadius: '12px',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            maxHeight: '320px',
            overflowY: 'auto'
          }}>
            {!agent.config.alertRules || agent.config.alertRules.length === 0 ? (
              <div style={{ fontSize: '13px', color: textMuted, fontStyle: 'italic', textAlign: 'center', padding: '12px' }}>
                No active rules configured.
              </div>
            ) : (
              agent.config.alertRules.map((rule, idx) => (
                <div key={idx} style={{
                  borderBottom: idx < agent.config.alertRules!.length - 1 ? borderStyle : 'none',
                  paddingBottom: idx < agent.config.alertRules!.length - 1 ? '10px' : 0,
                  fontSize: '12px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{
                      fontFamily: 'monospace',
                      color: '#3b82f6',
                      fontWeight: 600,
                      background: isDark ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.05)',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}>
                      {rule.condition}
                    </span>
                    <span style={{
                      color: rule.severity === 'critical' ? '#ef4444' : rule.severity === 'warning' ? '#f59e0b' : '#6b7280',
                      fontWeight: 700,
                      fontSize: '10px',
                      textTransform: 'uppercase'
                    }}>
                      {rule.severity}
                    </span>
                  </div>
                  <div style={{ color: textMuted, lineHeight: '1.4' }}>
                    {rule.message}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
