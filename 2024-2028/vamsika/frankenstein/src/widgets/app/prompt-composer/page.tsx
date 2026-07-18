'use client';

import React, { useState } from 'react';
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

interface GenerationResponse {
  success: boolean;
  message?: string;
  error?: string;
  prompt?: string;
  matchedTemplate?: string;
  templateLabel?: string;
  agent?: Agent;
}

const EXAMPLES = [
  "Alert the doctor when a patient's heartbeat crosses 120 bpm",
  "Tell me when the blood bank runs low on O-negative",
  "Watch ICU bed occupancy and warn at 85% capacity",
  "Flag any critical lab results not reviewed within an hour"
];

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

export default function PromptComposer() {
  const theme = useTheme();
  const { isReady, callTool, sendFollowUpMessage } = useWidgetSDK();
  const [promptValue, setPromptValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerationResponse | null>(null);

  if (!isReady) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280', fontFamily: 'monospace' }}>
        🔋 Initializing factory workspace...
      </div>
    );
  }

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0f172a' : '#f8fafc';
  const cardBgColor = isDark ? '#1e293b' : '#ffffff';
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';
  const borderStyle = `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`;

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!promptValue.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      // callTool uses 'factory_generate_agent_from_prompt'
      // useLLM is false for deterministic/no-key hackathon demo compatibility
      const res = await callTool('factory_generate_agent_from_prompt', {
        prompt: promptValue,
        useLLM: false
      }) as GenerationResponse;

      setResult(res);
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : String(err)
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      background: bgColor,
      color: textColor,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '24px',
      borderRadius: '16px',
      border: borderStyle,
      maxWidth: '650px',
      boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
      margin: '0 auto',
    }}>
      {/* Brand Header */}
      <div style={{
        background: isDark
          ? 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(147,51,234,0.05) 100%)'
          : 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(147,51,234,0.03) 100%)',
        padding: '20px 24px',
        borderRadius: '12px',
        border: `1px solid ${isDark ? 'rgba(59,130,246,0.25)' : 'rgba(59,130,246,0.15)'}`,
        marginBottom: '24px',
        position: 'relative',
      }}>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🧪</span> AI Agent Composer
        </h2>
        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: textMuted }}>
          Type a plain-English instruction to instantiate a micro-agent configuration.
        </p>
      </div>

      {/* Suggestion Chips */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '11px', color: textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
          💡 SUGGESTED INSTRUCTIONS
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {EXAMPLES.map((ex, idx) => (
            <button
              key={idx}
              onClick={() => {
                setPromptValue(ex);
                setResult(null);
              }}
              style={{
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                border: borderStyle,
                color: textColor,
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                cursor: 'pointer',
                textAlign: 'left',
                lineHeight: '1.4',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.08)';
                e.currentTarget.style.borderColor = '#3b82f6';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
                e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
              }}
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {/* Input Form */}
      <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
        <textarea
          value={promptValue}
          onChange={(e) => setPromptValue(e.target.value)}
          placeholder="E.g., alert the doctor when a patient's heartbeat crosses 120 bpm..."
          rows={3}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '14px',
            borderRadius: '10px',
            background: cardBgColor,
            color: textColor,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`,
            fontSize: '14px',
            fontFamily: 'inherit',
            resize: 'vertical',
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
          onBlur={(e) => e.target.style.borderColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}
        />
        
        <button
          type="submit"
          disabled={loading || !promptValue.trim()}
          style={{
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            border: 'none',
            color: 'white',
            padding: '12px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 700,
            cursor: loading || !promptValue.trim() ? 'not-allowed' : 'pointer',
            opacity: loading || !promptValue.trim() ? 0.6 : 1,
            boxShadow: '0 4px 14px rgba(59,130,246,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'transform 0.1s',
          }}
        >
          {loading ? (
            <>
              <span className="spinner" style={{
                display: 'inline-block',
                width: '14px',
                height: '14px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: 'white',
                borderRadius: '50%',
                animation: 'spin 0.6s linear infinite',
              }} />
              <span>Synthesizing Config...</span>
            </>
          ) : (
            <>
              <span>⚡</span>
              <span>Generate Agent</span>
            </>
          )}
        </button>
      </form>

      {/* Result Display */}
      {result && (
        <div style={{ borderTop: borderStyle, paddingTop: '20px' }}>
          {result.success && result.agent ? (
            <div style={{
              background: isDark ? 'rgba(16,185,129,0.05)' : 'rgba(16,185,129,0.02)',
              border: `1px solid ${isDark ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.15)'}`,
              borderRadius: '12px',
              padding: '16px',
            }}>
              {/* Header success */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <span style={{ fontSize: '20px' }}>✅</span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#10b981' }}>SUCCESSFULLY INSTANTIATED</div>
                  <div style={{ fontSize: '11px', color: textMuted }}>Template: {result.templateLabel}</div>
                </div>
              </div>

              {/* Agent card preview */}
              <div style={{
                background: cardBgColor,
                border: borderStyle,
                borderRadius: '8px',
                padding: '14px',
                marginBottom: '14px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span>{getTemplateIcon(result.matchedTemplate || '')}</span>
                    {result.agent.name}
                  </h4>
                  <span style={{ fontSize: '11px', color: textMuted, fontFamily: 'monospace' }}>
                    {result.agent.id}
                  </span>
                </div>
                <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: textMuted }}>
                  {result.agent.description}
                </p>

                {/* Rules count */}
                <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: textMuted }}>
                  <span>📋 {result.agent.config.alertRules?.length || 0} active conditions</span>
                  <span>⏱️ {result.agent.config.checkIntervalSeconds}s interval</span>
                </div>
              </div>

              {/* View Dashboard command */}
              <div style={{ textAlign: 'center' }}>
                <button
                  onClick={() => sendFollowUpMessage("List all agents")}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#3b82f6',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  🖥️ Open Dashboard to Run Check
                </button>
              </div>
            </div>
          ) : (
            <div style={{
              background: isDark ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.03)',
              border: `1px solid ${isDark ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.15)'}`,
              borderRadius: '8px',
              padding: '12px 16px',
              color: '#ef4444',
              fontSize: '13px',
            }}>
              <strong>⚠️ Generation Failed:</strong> {result.error || result.message || 'Unknown error'}
            </div>
          )}
        </div>
      )}

      {/* Inject css animation for spinner */}
      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
