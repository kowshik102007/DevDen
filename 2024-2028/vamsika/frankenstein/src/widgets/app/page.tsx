'use client';

import React, { useState, useEffect, useRef } from 'react';

// --- TYPES FROM BACKEND MODULES ---
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

interface AuditEvent {
  id: string;
  action: string;
  timestamp: string;
  agentId?: string;
  resource?: string;
  result: string;
  severity: 'info' | 'warning' | 'critical';
}

interface Alert {
  id: string;
  agentId: string;
  condition: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  createdAt: string;
}

interface Patient {
  id: string;
  name: string;
  age: number;
  department: string;
  bed: string;
}

interface VitalObservation {
  code: string;
  value: number;
  unit: string;
}

interface BloodInventoryItem {
  bloodType: string;
  unitsRemaining: number;
  expiryDays: number;
}

interface BedStatusItem {
  name: string;
  totalBeds: number;
  occupied: number;
  percent: number;
}

const EXAMPLES = [
  "Alert the doctor when a patient's heartbeat crosses 120 bpm",
  "Tell me when the blood bank runs low on O-negative",
  "Watch ICU bed occupancy and warn at 85% capacity",
  "Flag any critical lab results not reviewed within an hour"
];

export default function StandaloneDashboard() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'factory' | 'alerts' | 'patients' | 'inventory' | 'audit'>('dashboard');
  const [isDark, setIsDark] = useState(true);
  
  // MCP Connection States
  const [connected, setConnected] = useState(false);
  const [mcpEndpoint, setMcpEndpoint] = useState<string | null>(null);
  
  const getApiBaseUrl = () => {
    if (typeof window !== 'undefined') {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        if (window.location.port === '3000') {
          return window.location.origin;
        }
        return 'http://localhost:3000';
      }
      return window.location.origin;
    }
    return 'http://localhost:3000';
  };

  const apiBaseUrl = getApiBaseUrl();
  const [connectingMsg, setConnectingMsg] = useState(`Connecting to Frankenstein backend at ${apiBaseUrl}...`);
  
  // Data States
  const [agents, setAgents] = useState<Agent[]>([]);
  const [stats, setStats] = useState<any>({ total: 0, active: 0, paused: 0, error: 0, totalAlerts: 0, byTemplate: {} });
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEvent[]>([]);
  const [beds, setBeds] = useState<BedStatusItem[]>([]);
  const [bloodBank, setBloodBank] = useState<BloodInventoryItem[]>([]);

  // Selected Patient Details Drawer
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [patientVitals, setPatientVitals] = useState<VitalObservation[]>([]);
  const [patientMeds, setPatientMeds] = useState<any[]>([]);
  const [patientLabs, setPatientLabs] = useState<any[]>([]);
  const [loadingPatientData, setLoadingPatientData] = useState(false);

  // Form States (Factory)
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<any>(null);

  // Local statuses
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [runningChecks, setRunningChecks] = useState<Record<string, boolean>>({});

  // Pending request correlation
  const pendingRequests = useRef<Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>>(new Map());

  // 1. Establish SSE Connection
  useEffect(() => {
    let es: EventSource | null = null;

    const connectSSE = () => {
      console.log(`Connecting to SSE stream at ${apiBaseUrl}/sse...`);
      es = new EventSource(`${apiBaseUrl}/sse`);

      es.addEventListener('endpoint', (event: any) => {
        const url = event.data; // e.g. "/mcp?sessionId=123"
        const fullUrl = new URL(url, apiBaseUrl).toString();
        setMcpEndpoint(fullUrl);
        setConnected(true);
        console.log('MCP Endpoint established:', fullUrl);
      });

      // Handle incoming JSON-RPC responses over the SSE stream
      es.onmessage = (event: any) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Received SSE message:', data);
          if (data.id && pendingRequests.current.has(Number(data.id))) {
            const { resolve, reject } = pendingRequests.current.get(Number(data.id))!;
            pendingRequests.current.delete(Number(data.id));
            
            if (data.error) {
              reject(new Error(data.error.message || 'JSON-RPC error'));
            } else {
              // The tool execution response is in data.result
              const content = data.result?.content?.[0];
              if (content && content.type === 'text') {
                try {
                  resolve(JSON.parse(content.text));
                } catch {
                  resolve(content.text);
                }
              } else {
                resolve(data.result);
              }
            }
          }
        } catch (err) {
          console.error('Failed to parse SSE message:', err);
        }
      };

      es.onerror = (err) => {
        console.error('SSE connection error:', err);
        setConnected(false);
        setMcpEndpoint(null);
        setConnectingMsg(`Cannot reach server on ${apiBaseUrl}. Is "npx nitrostack-cli start" running?`);
      };
    };

    connectSSE();

    return () => {
      if (es) es.close();
    };
  }, []);

  // Helper to make JSON-RPC calls over the SSE-established HTTP endpoint
  const callTool = (toolName: string, args: any = {}): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (!mcpEndpoint) return reject(new Error('MCP server not connected'));
      
      const id = Date.now() + Math.floor(Math.random() * 1000);
      pendingRequests.current.set(id, { resolve, reject });
      
      fetch(mcpEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id,
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: args
          }
        })
      }).then(res => {
        if (!res.ok) {
          pendingRequests.current.delete(id);
          reject(new Error(`HTTP error ${res.status}`));
        }
        // POST returns 202 Accepted. We wait for the SSE message response.
      }).catch(err => {
        pendingRequests.current.delete(id);
        reject(err);
      });
    });
  };

  // 2. Fetch all telemetry lists when connected
  const refreshTelemetry = async () => {
    if (!connected || !mcpEndpoint) return;
    try {
      // Fetch agents & stats
      const agentsRes = await callTool('agents_list_agents');
      if (agentsRes) {
        setAgents(agentsRes.agents || []);
        setStats(agentsRes.stats || { total: 0, active: 0, paused: 0, error: 0, totalAlerts: 0, byTemplate: {} });
      }

      // Fetch active alerts
      const alertsRes = await callTool('alerts_get_active_alerts');
      if (alertsRes) {
        setAlerts(alertsRes.alerts || []);
      }

      // Fetch patients directory
      const patientsRes = await callTool('integration_get_all_patients');
      if (patientsRes && patientsRes.entry) {
        setPatients(patientsRes.entry.map((e: any) => ({
          id: e.resource.id,
          name: e.resource.name[0]?.text || 'Unknown',
          age: e.resource.extension.find((ext: any) => ext.url === 'age')?.valueInteger ?? 0,
          department: e.resource.extension.find((ext: any) => ext.url === 'department')?.valueString ?? 'GW',
          bed: e.resource.extension.find((ext: any) => ext.url === 'bed')?.valueString ?? 'N/A'
        })));
      }

      // Fetch audit logs
      const auditRes = await callTool('audit_get_audit_log', { limit: 20 });
      if (auditRes) {
        setAuditLogs(auditRes.events || []);
      }

      // Fetch beds
      const bedsRes = await callTool('integration_get_bed_status');
      if (bedsRes && bedsRes.entry) {
        setBeds(bedsRes.entry.map((e: any) => ({
          name: e.resource.name,
          totalBeds: e.resource.extension.find((ext: any) => ext.url === 'totalBeds')?.valueInteger ?? 0,
          occupied: e.resource.extension.find((ext: any) => ext.url === 'occupied')?.valueInteger ?? 0,
          percent: e.resource.extension.find((ext: any) => ext.url === 'occupancyPercent')?.valueDecimal ?? 0
        })));
      }

      // Fetch blood bank
      const bloodRes = await callTool('integration_get_blood_bank_inventory');
      if (bloodRes && bloodRes.entry) {
        setBloodBank(bloodRes.entry.map((e: any) => ({
          bloodType: e.resource.product.code.text,
          unitsRemaining: e.resource.quantity.value,
          expiryDays: e.resource.extension.find((ext: any) => ext.url === 'expiryDays')?.valueInteger ?? 0
        })));
      }
    } catch (err) {
      console.error('Error refreshing telemetry:', err);
    }
  };

  // Poll refresh every 5 seconds
  useEffect(() => {
    if (connected) {
      refreshTelemetry();
      const interval = setInterval(refreshTelemetry, 5000);
      return () => clearInterval(interval);
    }
  }, [connected, mcpEndpoint]);

  // Load detailed patient data (Vitals, Meds, Labs) on selection
  useEffect(() => {
    if (!selectedPatientId || !connected) return;

    const fetchPatientDetails = async () => {
      setLoadingPatientData(true);
      try {
        // Vitals
        const vitalsRes = await callTool('integration_get_patient_vitals', { patientId: selectedPatientId });
        if (vitalsRes && vitalsRes.entry) {
          setPatientVitals(vitalsRes.entry.map((e: any) => ({
            code: e.resource.code.coding[0].code,
            value: e.resource.valueQuantity.value,
            unit: e.resource.valueQuantity.unit
          })));
        } else {
          setPatientVitals([]);
        }

        // Meds
        const medsRes = await callTool('integration_get_medications', { patientId: selectedPatientId });
        if (medsRes && medsRes.entry) {
          setPatientMeds(medsRes.entry.map((e: any) => ({
            name: e.resource.medicationCodeableConcept.text,
            instruction: e.resource.dosageInstruction[0]?.text || '',
            lastAdmin: e.resource.dosageInstruction[0]?.timingAdditional?.lastAdministered || 'N/A'
          })));
        } else {
          setPatientMeds([]);
        }

        // Labs
        const labsRes = await callTool('integration_get_lab_results', { patientId: selectedPatientId });
        if (labsRes && labsRes.entry) {
          setPatientLabs(labsRes.entry.map((e: any) => ({
            name: e.resource.code.text,
            value: e.resource.result[0]?.value || 'N/A',
            status: e.resource.result[0]?.status || 'normal',
            reviewed: e.resource.result[0]?.reviewed ?? true,
            time: e.resource.effectiveDateTime
          })));
        } else {
          setPatientLabs([]);
        }
      } catch (err) {
        console.error('Error fetching patient details:', err);
      } finally {
        setLoadingPatientData(false);
      }
    };

    fetchPatientDetails();
  }, [selectedPatientId, connected]);

  // Tool Action Handlers
  const handleRunCheck = async (agentId: string) => {
    setRunningChecks(prev => ({ ...prev, [agentId]: true }));
    setActionStatus(null);
    try {
      const res = await callTool('alerts_run_agent_check', { agentId });
      if (res && res.success) {
        setActionStatus(`✅ Check run complete for agent. Alerts triggered: ${res.triggeredAlerts}`);
        refreshTelemetry();
      }
    } catch (err) {
      setActionStatus('❌ Failed to run agent check.');
    } finally {
      setRunningChecks(prev => ({ ...prev, [agentId]: false }));
    }
  };

  const handleToggleStatus = async (agentId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'paused' : 'active';
    try {
      await callTool('agents_set_agent_status', { agentId, status: nextStatus });
      setActionStatus(`🔄 Agent status updated to ${nextStatus}`);
      refreshTelemetry();
    } catch (err) {
      setActionStatus('❌ Failed to toggle status');
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      await callTool('alerts_resolve_alert', { alertId });
      setActionStatus('✅ Alert resolved.');
      refreshTelemetry();
    } catch (err) {
      setActionStatus('❌ Failed to resolve alert.');
    }
  };

  const handleGenerateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setGenerating(true);
    setGenResult(null);
    try {
      const res = await callTool('factory_generate_agent_from_prompt', { prompt, useLLM: false });
      setGenResult(res);
      setPrompt('');
      refreshTelemetry();
    } catch (err) {
      setGenResult({ success: false, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setGenerating(false);
    }
  };

  // Color mappings
  const getStatusColor = (status: string) => {
    if (status === 'active') return '#10b981';
    if (status === 'paused') return '#f59e0b';
    return '#ef4444';
  };

  const getSeverityStyles = (sev: string) => {
    if (sev === 'critical') return { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', border: '1px solid #fca5a5' };
    if (sev === 'warning') return { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: '1px solid #fde047' };
    return { color: '#6b7280', bg: 'rgba(107,114,128,0.1)', border: '1px solid #cbd5e1' };
  };

  // Styling Variables
  const bgColor = isDark ? '#0f172a' : '#f8fafc';
  const cardBgColor = isDark ? '#1e293b' : '#ffffff';
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';
  const borderStyle = `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`;

  if (!connected) {
    return (
      <div style={{
        background: bgColor,
        color: textColor,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif',
        padding: '20px',
      }}>
        <div style={{
          background: cardBgColor,
          border: borderStyle,
          borderRadius: '16px',
          padding: '30px',
          maxWidth: '500px',
          textAlign: 'center',
          boxShadow: '0 10px 30px rgba(0,0,0,0.15)'
        }}>
          <div style={{ fontSize: '50px', marginBottom: '16px', animation: 'spin 2s linear infinite' }}>⚙️</div>
          <h2 style={{ margin: '0 0 12px 0' }}>Frankenstein Web Portal</h2>
          <p style={{ color: textMuted, fontSize: '14px', lineHeight: '1.5', marginBottom: '24px' }}>
            {connectingMsg}
          </p>
          <div style={{ fontSize: '12px', color: '#3b82f6', fontWeight: 600 }}>
            Make sure "npx nitrostack-cli start" is running in your project terminal.
          </div>
        </div>
        <style jsx global>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{
      background: bgColor,
      color: textColor,
      minHeight: '100vh',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      boxSizing: 'border-box',
    }}>
      {/* Dynamic override for NitroStack widget layout scroll lock */}
      <style dangerouslySetInnerHTML={{ __html: `
        body, html {
          overflow: auto !important;
          height: auto !important;
        }
      ` }} />
      {/* 1. TOP HEADER NAVIGATION BAR */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 24px',
        borderBottom: borderStyle,
        background: cardBgColor,
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '28px' }}>🏥</span>
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Frankenstein Control Center</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#10b981', fontWeight: 600, marginTop: '2px' }}>
              <span style={{ display: 'inline-block', width: '6px', height: '6px', background: '#10b981', borderRadius: '50%' }} />
              Connected to Local MCP Server (Port 3000)
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', gap: '6px' }}>
          {[
            { id: 'dashboard', label: '🖥️ Dashboard' },
            { id: 'factory', label: '⚡ Agent Factory' },
            { id: 'alerts', label: '🚨 Alerts Board' },
            { id: 'patients', label: '👥 Patient Directory' },
            { id: 'inventory', label: '🏥 Ward Capacity' },
            { id: 'audit', label: '📜 Audit Log' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setActionStatus(null);
              }}
              style={{
                background: activeTab === tab.id
                  ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)')
                  : 'transparent',
                border: activeTab === tab.id ? borderStyle : 'none',
                color: activeTab === tab.id ? textColor : textMuted,
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Theme and stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{
            fontSize: '11px',
            background: 'rgba(239,68,68,0.1)',
            color: '#ef4444',
            padding: '4px 10px',
            borderRadius: '20px',
            fontWeight: 700,
            fontFamily: 'monospace'
          }}>
            🚨 {alerts.length} ALERTS
          </span>
          <button
            onClick={() => setIsDark(!isDark)}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '18px',
              cursor: 'pointer'
            }}
          >
            {isDark ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      {/* Main Layout Container */}
      <main style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Action feedback bar */}
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

        {/* TAB CONTENT: 1. DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Stats Cards Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
              {[
                { label: 'Total AI Agents', val: stats.total, color: '#3b82f6', icon: '🤖' },
                { label: 'Active Monitors', val: stats.active, color: '#10b981', icon: '🟢' },
                { label: 'Paused Monitors', val: stats.paused, color: '#f59e0b', icon: '🟡' },
                { label: 'Critical Alerts', val: alerts.length, color: '#ef4444', icon: '🚨' }
              ].map((item, idx) => (
                <div key={idx} style={{
                  background: cardBgColor,
                  border: borderStyle,
                  borderRadius: '14px',
                  padding: '16px',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.02)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                }}>
                  <span style={{ fontSize: '32px' }}>{item.icon}</span>
                  <div>
                    <div style={{ fontSize: '11px', color: textMuted, fontWeight: 500, textTransform: 'uppercase' }}>{item.label}</div>
                    <div style={{ fontSize: '24px', fontWeight: 800, fontFamily: 'monospace', color: item.color }}>{item.val}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Deployed Agents Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.02em', margin: '10px 0 0 0' }}>
                Active Factory Agents ({agents.length})
              </h2>

              {agents.map((agent) => (
                <div key={agent.id} style={{
                  background: cardBgColor,
                  border: borderStyle,
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{agent.templateId === 'vitals-monitoring' ? '💓' : agent.templateId === 'blood-bank-inventory' ? '🩸' : '🤖'}</span>
                        {agent.name}
                        <span style={{
                          display: 'inline-block',
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: getStatusColor(agent.status)
                        }} />
                      </h3>
                      <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: textMuted }}>{agent.description}</p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                      {agent.alertCount > 0 && (
                        <span style={{ background: '#ef4444', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 700, fontFamily: 'monospace' }}>
                          🚨 {agent.alertCount} ALERTS
                        </span>
                      )}
                      <span style={{ fontSize: '11px', color: textMuted, fontFamily: 'monospace' }}>ID: {agent.id.slice(6, 12)}</span>
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: isDark ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.02)',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    border: borderStyle,
                  }}>
                    <div style={{ display: 'flex', gap: '16px', color: textMuted }}>
                      <span>Interval: <strong style={{ color: textColor }}>{agent.config.checkIntervalSeconds}s</strong></span>
                      <span>Checked: <strong style={{ color: textColor }}>{agent.lastCheckedAt ? new Date(agent.lastCheckedAt).toLocaleTimeString() : 'Never'}</strong></span>
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button
                        onClick={() => handleToggleStatus(agent.id, agent.status)}
                        style={{ background: 'transparent', border: 'none', color: agent.status === 'active' ? '#f59e0b' : '#10b981', fontWeight: 600, cursor: 'pointer' }}
                      >
                        {agent.status === 'active' ? '⏸️ Pause' : '▶️ Activate'}
                      </button>
                      <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
                      <button
                        onClick={() => handleRunCheck(agent.id)}
                        disabled={runningChecks[agent.id] || agent.status !== 'active'}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: agent.status !== 'active' ? '#6b7280' : '#10b981',
                          fontWeight: 600,
                          cursor: agent.status !== 'active' ? 'not-allowed' : 'pointer'
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
        )}

        {/* TAB CONTENT: 2. AGENT FACTORY */}
        {activeTab === 'factory' && (
          <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{
              background: cardBgColor,
              border: borderStyle,
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
            }}>
              <h2 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 800 }}>⚡ Natural Language Agent Creator</h2>
              <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: textMuted }}>
                No code needed. Explain what you want to monitor, and Frankenstein compiles the rules.
              </p>

              {/* Chips */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: textMuted, marginBottom: '8px', textTransform: 'uppercase' }}>Examples:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {EXAMPLES.map((ex, idx) => (
                    <button
                      key={idx}
                      onClick={() => setPrompt(ex)}
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                        border: borderStyle,
                        borderRadius: '20px',
                        padding: '6px 12px',
                        fontSize: '12px',
                        color: textColor,
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input Form */}
              <form onSubmit={handleGenerateAgent} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe your monitoring rules..."
                  rows={3}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '12px',
                    borderRadius: '8px',
                    background: isDark ? 'rgba(0,0,0,0.2)' : '#ffffff',
                    border: borderStyle,
                    color: textColor,
                    outline: 'none',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                  }}
                />
                <button
                  type="submit"
                  disabled={generating || !prompt.trim()}
                  style={{
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    color: 'white',
                    border: 'none',
                    padding: '12px',
                    borderRadius: '8px',
                    fontWeight: 700,
                    cursor: generating || !prompt.trim() ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(59,130,246,0.2)'
                  }}
                >
                  {generating ? '⚡ Instantiating Agent...' : '🚀 Generate AI Agent'}
                </button>
              </form>
            </div>

            {/* Generation result */}
            {genResult && (
              <div style={{
                background: genResult.success ? (isDark ? 'rgba(16,185,129,0.05)' : '#d1fae5') : (isDark ? 'rgba(239,68,68,0.05)' : '#fee2e2'),
                border: genResult.success ? '1px solid #10b98144' : '1px solid #ef444444',
                borderRadius: '12px',
                padding: '16px',
              }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '15px', color: genResult.success ? '#10b981' : '#ef4444' }}>
                  {genResult.success ? '✅ Success: Agent Deployed' : '⚠️ Generation Failed'}
                </h3>
                {genResult.success && genResult.agent ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                    <div>Name: <strong>{genResult.agent.name}</strong></div>
                    <div>Description: <span style={{ color: textMuted }}>{genResult.agent.description}</span></div>
                    <div style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,0.1)', padding: '6px', borderRadius: '4px', fontSize: '11px', marginTop: '6px' }}>
                      ID: {genResult.agent.id}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '13px' }}>{genResult.error || genResult.message || 'Verification check failed.'}</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB CONTENT: 3. ALERTS BOARD */}
        {activeTab === 'alerts' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h2 style={{ fontSize: '16px', margin: 0, fontWeight: 700 }}>Unresolved Triaged Alerts ({alerts.length})</h2>
            
            {alerts.length === 0 ? (
              <div style={{
                background: isDark ? 'rgba(16,185,129,0.05)' : 'rgba(16,185,129,0.02)',
                border: '1px solid #10b98133',
                borderRadius: '12px',
                padding: '30px',
                textAlign: 'center',
                color: '#10b981'
              }}>
                <div style={{ fontSize: '32px' }}>🟢</div>
                <h3>All Clinical Stations Clear</h3>
                <p style={{ color: textMuted, fontSize: '13px' }}>No threshold breaches currently require triaging.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {alerts.map((alert) => {
                  const styles = getSeverityStyles(alert.severity);
                  return (
                    <div key={alert.id} style={{
                      background: cardBgColor,
                      border: borderStyle,
                      borderLeft: `5px solid ${styles.color}`,
                      borderRadius: '12px',
                      padding: '16px',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '16px',
                    }}>
                      <div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{
                            fontSize: '9px',
                            fontWeight: 700,
                            color: styles.color,
                            background: styles.bg,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            textTransform: 'uppercase'
                          }}>{alert.severity}</span>
                          <span style={{ fontSize: '11px', color: textMuted, fontFamily: 'monospace' }}>
                            {new Date(alert.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>{alert.message}</h3>
                        <div style={{ fontSize: '11px', color: textMuted, marginTop: '4px', fontFamily: 'monospace' }}>
                          Agent ID: {alert.agentId.slice(6, 12)} | Condition: {alert.condition}
                        </div>
                      </div>

                      <button
                        onClick={() => handleResolveAlert(alert.id)}
                        style={{
                          background: 'transparent',
                          border: borderStyle,
                          borderRadius: '6px',
                          padding: '6px 12px',
                          color: textColor,
                          fontWeight: 600,
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        ✓ Resolve
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB CONTENT: 4. PATIENT DIRECTORY */}
        {activeTab === 'patients' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px', alignItems: 'start' }}>
            
            {/* Table side */}
            <div style={{
              background: cardBgColor,
              border: borderStyle,
              borderRadius: '14px',
              overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', borderBottom: borderStyle, color: textMuted }}>
                    <th style={{ textAlign: 'left', padding: '12px' }}>ID</th>
                    <th style={{ textAlign: 'left', padding: '12px' }}>Patient Name</th>
                    <th style={{ textAlign: 'left', padding: '12px' }}>Age</th>
                    <th style={{ textAlign: 'left', padding: '12px' }}>Department</th>
                    <th style={{ textAlign: 'left', padding: '12px' }}>Bed</th>
                    <th style={{ textAlign: 'right', padding: '12px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map((pat) => (
                    <tr
                      key={pat.id}
                      onClick={() => setSelectedPatientId(pat.id)}
                      style={{
                        borderBottom: borderStyle,
                        background: selectedPatientId === pat.id
                          ? (isDark ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.05)')
                          : 'transparent',
                        cursor: 'pointer',
                        fontWeight: selectedPatientId === pat.id ? 700 : 'normal'
                      }}
                    >
                      <td style={{ padding: '12px', fontFamily: 'monospace' }}>{pat.id}</td>
                      <td style={{ padding: '12px' }}>{pat.name}</td>
                      <td style={{ padding: '12px' }}>{pat.age}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          background: pat.department === 'ICU' ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)',
                          color: pat.department === 'ICU' ? '#ef4444' : '#3b82f6',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600
                        }}>{pat.department}</span>
                      </td>
                      <td style={{ padding: '12px', fontFamily: 'monospace' }}>{pat.bed}</td>
                      <td style={{ padding: '12px', textAlign: 'right', color: '#3b82f6', fontWeight: 600 }}>
                        Select 🗂️
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Sidebar Details Drawer */}
            <div style={{
              background: cardBgColor,
              border: borderStyle,
              borderRadius: '14px',
              padding: '16px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
              minHeight: '400px'
            }}>
              {!selectedPatientId ? (
                <div style={{ color: textMuted, fontStyle: 'italic', textAlign: 'center', marginTop: '150px', fontSize: '13px' }}>
                  Select a patient to inspect telemetry, medication trackers, and lab diagnostic reports.
                </div>
              ) : loadingPatientData ? (
                <div style={{ color: textMuted, textAlign: 'center', marginTop: '150px', fontSize: '13px' }}>
                  Loading patient files...
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Demographics */}
                  <div>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>
                      {patients.find(p => p.id === selectedPatientId)?.name}
                    </h3>
                    <div style={{ fontSize: '11px', color: textMuted, marginTop: '2px', fontFamily: 'monospace' }}>
                      ID: {selectedPatientId} | Bed: {patients.find(p => p.id === selectedPatientId)?.bed}
                    </div>
                  </div>

                  {/* Vitals list */}
                  <div style={{ borderTop: borderStyle, paddingTop: '10px' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: textMuted, textTransform: 'uppercase' }}>Vitals Sign</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {patientVitals.map(v => (
                        <div key={v.code} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', background: isDark ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.01)', padding: '6px 10px', borderRadius: '6px' }}>
                          <span style={{ textTransform: 'capitalize' }}>{v.code.replace(/([A-Z])/g, ' $1')}</span>
                          <strong style={{ fontFamily: 'monospace' }}>{v.value} {v.unit}</strong>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Medications schedule */}
                  <div style={{ borderTop: borderStyle, paddingTop: '10px' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: textMuted, textTransform: 'uppercase' }}>Prescription Track</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {patientMeds.map((m, idx) => (
                        <div key={idx} style={{ fontSize: '12px', borderBottom: idx < patientMeds.length - 1 ? `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` : 'none', paddingBottom: '6px' }}>
                          <div style={{ fontWeight: 700 }}>{m.name}</div>
                          <div style={{ color: textMuted, fontSize: '11px' }}>{m.instruction}</div>
                          <div style={{ fontSize: '10px', color: textMuted, marginTop: '2px' }}>Last admin: {m.lastAdmin}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Labs Diagnostic reports */}
                  <div style={{ borderTop: borderStyle, paddingTop: '10px' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: textMuted, textTransform: 'uppercase' }}>Diagnostic Reports</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {patientLabs.map((l, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>{l.name}</div>
                            <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{l.value}</span>
                          </div>
                          <span style={{
                            fontSize: '9px',
                            fontWeight: 700,
                            color: l.status === 'critical' ? '#ef4444' : l.status === 'abnormal' ? '#f59e0b' : '#10b981',
                            textTransform: 'uppercase'
                          }}>{l.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB CONTENT: 5. WARD CAPACITY */}
        {activeTab === 'inventory' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Beds capacity */}
            <div style={{ background: cardBgColor, border: borderStyle, borderRadius: '14px', padding: '16px' }}>
              <h2 style={{ fontSize: '15px', margin: '0 0 16px 0', color: textMuted, textTransform: 'uppercase' }}>🏥 Ward Bed Occupancy</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {beds.map((w, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ fontWeight: 600 }}>{w.name}</span>
                      <span style={{ fontFamily: 'monospace' }}>{w.occupied}/{w.totalBeds} beds ({w.percent}%)</span>
                    </div>
                    {/* Bar */}
                    <div style={{ width: '100%', height: '8px', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${w.percent}%`,
                        height: '100%',
                        background: w.name === 'ICU' && w.percent > 85 ? '#ef4444' : w.percent > 90 ? '#ef4444' : w.percent > 75 ? '#f59e0b' : '#10b981',
                        borderRadius: '4px'
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Blood bank */}
            <div style={{ background: cardBgColor, border: borderStyle, borderRadius: '14px', padding: '16px' }}>
              <h2 style={{ fontSize: '15px', margin: '0 0 16px 0', color: textMuted, textTransform: 'uppercase' }}>🩸 Blood Bank Inventory</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '10px' }}>
                {bloodBank.map((item, idx) => {
                  const critical = item.unitsRemaining <= 3;
                  const low = item.unitsRemaining <= 10;
                  const color = critical ? '#ef4444' : low ? '#f59e0b' : '#10b981';
                  
                  return (
                    <div key={idx} style={{
                      border: borderStyle,
                      borderRadius: '8px',
                      padding: '10px',
                      textAlign: 'center',
                      background: isDark ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.01)'
                    }}>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#ef4444' }}>{item.bloodType}</div>
                      <div style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'monospace', margin: '4px 0' }}>{item.unitsRemaining}</div>
                      <div style={{ fontSize: '10px', color: color, fontWeight: 700 }}>
                        {critical ? 'CRITICAL' : low ? 'LOW STOCK' : 'STABLE'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB CONTENT: 6. AUDIT LOG */}
        {activeTab === 'audit' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h2 style={{ fontSize: '16px', margin: 0, fontWeight: 700 }}>Security & Execution Logs</h2>
            <div style={{
              background: cardBgColor,
              border: borderStyle,
              borderRadius: '14px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}>
              {auditLogs.map((log) => (
                <div key={log.id} style={{
                  borderBottom: borderStyle,
                  paddingBottom: '10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '12px'
                }}>
                  <div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <strong style={{ textTransform: 'capitalize' }}>{log.action.replace(/_/g, ' ')}</strong>
                      <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: log.severity === 'critical' ? 'rgba(239,68,68,0.15)' : 'rgba(0,0,0,0.1)', color: log.severity === 'critical' ? '#ef4444' : textMuted }}>
                        {log.severity}
                      </span>
                    </div>
                    <div style={{ color: textColor, marginTop: '4px' }}>{log.result}</div>
                  </div>
                  <span style={{ fontFamily: 'monospace', color: textMuted }}>
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
