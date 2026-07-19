'use client';

import React from 'react';
import { useTheme, useWidgetSDK } from '@nitrostack/widgets';

interface Rule {
  condition: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
}

interface AgentTemplate {
  id: string;
  label: string;
  description: string;
  icon: string;
  defaultThresholds: Record<string, any>;
  defaultAlertRules: Rule[];
  dataResources: string[];
  checkIntervalSeconds: number;
}

interface PreviewResponse {
  success: boolean;
  error?: string;
  template?: AgentTemplate;
  availableTemplates?: Array<{ id: string; label: string; description: string }>;
}

export default function TemplatePreview() {
  const theme = useTheme();
  const { isReady, getToolOutput, sendFollowUpMessage } = useWidgetSDK();
  const data = getToolOutput<PreviewResponse>();

  if (!isReady) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280', fontFamily: 'monospace' }}>
        🔬 Inspecting template parameters...
      </div>
    );
  }

  if (!data || !data.success || !data.template) {
    return (
      <div style={{
        padding: '20px',
        background: theme === 'dark' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        borderRadius: '12px',
        color: '#ef4444',
        maxWidth: '500px',
        margin: '20px auto',
      }}>
        <h3 style={{ marginTop: 0 }}>⚠️ Template Not Found</h3>
        <p>{data?.error || 'The requested template could not be loaded.'}</p>
        
        {data?.availableTemplates && (
          <div style={{ marginTop: '16px', textAlign: 'left', borderTop: '1px solid rgba(239,68,68,0.2)', paddingTop: '12px' }}>
            <div style={{ fontWeight: 600, fontSize: '12px', color: theme === 'dark' ? '#cbd5e1' : '#475569', marginBottom: '8px' }}>AVAILABLE TEMPLATES:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {data.availableTemplates.map(t => (
                <button
                  key={t.id}
                  onClick={() => sendFollowUpMessage(`Preview template ${t.id}`)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#3b82f6',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  📄 {t.label} — <span style={{ fontWeight: 'normal', color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>{t.description}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const { template } = data;
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
      {/* Title */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        borderBottom: borderStyle,
        paddingBottom: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '32px', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', padding: '6px', borderRadius: '10px' }}>
            {template.icon}
          </span>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
              {template.label} Template
            </h2>
            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: textMuted }}>
              Blueprint specifications for Frankenstein AI agents
            </p>
          </div>
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
          {template.id}
        </span>
      </div>

      <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: textMuted, lineHeight: '1.5' }}>
        {template.description}
      </p>

      {/* Grid: Details */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '12px',
        marginBottom: '20px',
      }}>
        <div style={{ background: cardBgColor, border: borderStyle, padding: '12px', borderRadius: '10px' }}>
          <div style={{ fontSize: '11px', color: textMuted, fontWeight: 500 }}>CONSUMED FHIR DATA RESOURCES</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
            {template.dataResources.map((res, i) => (
              <code key={i} style={{ fontSize: '11px', color: '#3b82f6', background: isDark ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.05)', padding: '2px 6px', borderRadius: '4px', wordBreak: 'break-all' }}>
                {res}
              </code>
            ))}
          </div>
        </div>

        <div style={{ background: cardBgColor, border: borderStyle, padding: '12px', borderRadius: '10px' }}>
          <div style={{ fontSize: '11px', color: textMuted, fontWeight: 500 }}>DEFAULT CHECK INTERVAL</div>
          <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '4px' }}>⏱️ Every {template.checkIntervalSeconds} seconds</div>
        </div>
      </div>

      {/* Two Column details: default thresholds & rules */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '20px' }}>
        
        {/* Left Col: Default thresholds */}
        <div>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 600, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            🎛️ Default Thresholds
          </h3>
          <div style={{
            background: cardBgColor,
            border: borderStyle,
            borderRadius: '12px',
            padding: '14px',
          }}>
            {Object.keys(template.defaultThresholds).length === 0 ? (
              <div style={{ fontSize: '12px', color: textMuted, fontStyle: 'italic', textAlign: 'center' }}>No thresholds defined.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: borderStyle }}>
                    <th style={{ textAlign: 'left', fontSize: '11px', color: textMuted, paddingBottom: '6px' }}>Parameter</th>
                    <th style={{ textAlign: 'right', fontSize: '11px', color: textMuted, paddingBottom: '6px' }}>Default Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(template.defaultThresholds).map(([k, v]) => (
                    <tr key={k} style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` }}>
                      <td style={{ fontSize: '13px', padding: '6px 0', fontFamily: 'monospace' }}>{k}</td>
                      <td style={{ textAlign: 'right', fontSize: '13px', padding: '6px 0', fontFamily: 'monospace', fontWeight: 600 }}>{String(v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Col: Default Alert Rules */}
        <div>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 600, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            📋 Preset Alert Rules ({template.defaultAlertRules.length})
          </h3>
          <div style={{
            background: cardBgColor,
            border: borderStyle,
            borderRadius: '12px',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            maxHeight: '280px',
            overflowY: 'auto'
          }}>
            {template.defaultAlertRules.map((rule, i) => (
              <div key={i} style={{
                borderBottom: i < template.defaultAlertRules.length - 1 ? borderStyle : 'none',
                paddingBottom: i < template.defaultAlertRules.length - 1 ? '10px' : 0,
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
                <div style={{ color: textMuted, lineHeight: '1.4' }}>{rule.message}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Composer CTA */}
      <div style={{
        borderTop: borderStyle,
        paddingTop: '16px',
        textAlign: 'center',
      }}>
        <button
          onClick={() => sendFollowUpMessage(`Build an agent with template "${template.id}"`)}
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
          ⚡ Compose Agent from this Blueprint
        </button>
      </div>
    </div>
  );
}
