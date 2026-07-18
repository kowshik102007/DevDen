'use client';

import React from 'react';
import { useTheme, useWidgetSDK } from '@nitrostack/widgets';

interface Agent {
  id: string;
  templateId: string;
  name: string;
  description: string;
  status: 'active' | 'paused' | 'error';
  createdAt: string;
  config: {
    thresholds?: Record<string, any>;
    alertRules?: Array<{ condition: string; severity: string; message: string }>;
    checkIntervalSeconds?: number;
    resourceEndpoint?: string;
  };
}

interface GenerationData {
  success: boolean;
  message: string;
  prompt: string;
  matchedTemplate: string;
  templateLabel: string;
  agent: Agent;
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

const SUGGESTIONS = [
  "Tell me when the blood bank runs low on O-negative",
  "Watch ICU bed occupancy and warn at 85% capacity",
  "Flag any critical lab results not reviewed within an hour",
  "Summarize nurse notes and alert on fall risk keywords"
];

export default function AgentGenerated() {
  const theme = useTheme();
  const { isReady, getToolOutput, sendFollowUpMessage } = useWidgetSDK();
  const data = getToolOutput<GenerationData>();

  if (!isReady) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280', fontFamily: 'monospace' }}>
        ⚙️ Assembling agent neural circuits...
      </div>
    );
  }

  if (!data || !data.success || !data.agent) {
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
        <h3 style={{ marginTop: 0 }}>⚠️ Agent Generation Failed</h3>
        <p>{data?.message || 'The factory could not understand or validate the agent configuration.'}</p>
      </div>
    );
  }

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0f172a' : '#f8fafc';
  const cardBgColor = isDark ? '#1e293b' : '#ffffff';
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';
  const borderStyle = `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`;

  const handleCreateAnother = () => {
    // Pick a random suggestion
    const randomPrompt = SUGGESTIONS[Math.floor(Math.random() * SUGGESTIONS.length)];
    sendFollowUpMessage(`Build an agent to: "${randomPrompt}"`);
  };

  return (
    <div style={{
      background: bgColor,
      color: textColor,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '24px',
      borderRadius: '16px',
      border: borderStyle,
      maxWidth: '600px',
      boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
      margin: '0 auto',
    }}>
      {/* Celebration Header */}
      <div style={{
        textAlign: 'center',
        padding: '24px 16px',
        background: isDark
          ? 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(59,130,246,0.05) 100%)'
          : 'linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(59,130,246,0.05) 100%)',
        borderRadius: '12px',
        border: `1px solid ${isDark ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.2)'}`,
        marginBottom: '24px',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '8px' }}>🚀</div>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: 700, color: '#10b981' }}>
          Agent Created Successfully!
        </h2>
        <p style={{ margin: 0, fontSize: '13px', color: textMuted }}>
          Frankenstein Factory instantiated config into active memory.
        </p>
      </div>

      {/* Prompt Echo */}
      <div style={{ marginBottom: '20px' }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Original Prompt
        </span>
        <blockquote style={{
          margin: '4px 0 0 0',
          padding: '12px 16px',
          background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
          borderLeft: '4px solid #10b981',
          borderRadius: '4px',
          fontSize: '14px',
          fontStyle: 'italic',
          color: textColor,
        }}>
          "{data.prompt}"
        </blockquote>
      </div>

      {/* Matched Template */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        background: cardBgColor,
        border: borderStyle,
        borderRadius: '12px',
        marginBottom: '20px',
      }}>
        <span style={{ fontSize: '28px' }}>
          {getTemplateIcon(data.matchedTemplate)}
        </span>
        <div>
          <div style={{ fontSize: '11px', color: textMuted, fontWeight: 500 }}>MATCHED TEMPLATE</div>
          <div style={{ fontSize: '14px', fontWeight: 600 }}>{data.templateLabel}</div>
        </div>
      </div>

      {/* Agent details */}
      <div style={{
        background: cardBgColor,
        border: borderStyle,
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '24px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>🤖 {data.agent.name}</h3>
          <span style={{
            background: 'rgba(16,185,129,0.1)',
            color: '#10b981',
            padding: '2px 8px',
            borderRadius: '20px',
            fontSize: '11px',
            fontWeight: 600,
          }}>
            🟢 ACTIVE
          </span>
        </div>
        
        <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: textMuted }}>
          ID: <span style={{ fontFamily: 'monospace' }}>{data.agent.id}</span>
        </p>

        {/* Config metrics */}
        <div style={{ borderTop: borderStyle, paddingTop: '12px' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: textMuted }}>INJECTED RULES</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {data.agent.config.alertRules?.map((rule, index) => (
              <div key={index} style={{
                background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                padding: '8px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                border: borderStyle,
              }}>
                <span style={{ fontFamily: 'monospace', color: '#3b82f6' }}>{rule.condition}</span>
                <span style={{
                  color: rule.severity === 'critical' ? '#ef4444' : '#f59e0b',
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}>
                  {rule.severity}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Suggestion Section */}
      <div style={{ borderTop: borderStyle, paddingTop: '20px', textAlign: 'center' }}>
        <button
          onClick={handleCreateAnother}
          style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            border: 'none',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(16,185,129,0.2)',
            marginBottom: '16px',
          }}
        >
          ➕ Generate Another Agent
        </button>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
          {SUGGESTIONS.slice(0, 3).map((promptText, index) => (
            <button
              key={index}
              onClick={() => sendFollowUpMessage(`Build an agent to: "${promptText}"`)}
              style={{
                background: 'transparent',
                border: borderStyle,
                color: textMuted,
                padding: '6px 10px',
                borderRadius: '20px',
                fontSize: '11px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#10b981';
                e.currentTarget.style.color = '#10b981';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
                e.currentTarget.style.color = textMuted;
              }}
            >
              💡 {promptText.length > 35 ? promptText.slice(0, 35) + '...' : promptText}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
