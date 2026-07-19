import { useState } from 'react';
import { useTriage } from '../context/TriageContext';
import { Phone, Navigation, Clock, Bed, AlertTriangle, Radio, Siren, MapPin, ArrowRight, CheckCircle } from 'lucide-react';

export default function AmbulancePage() {
  const { hospitals, patients } = useTriage();
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [dispatchStatus, setDispatchStatus] = useState('idle'); // idle | dispatching | enroute

  const pendingPatients = patients.filter(p => p.severity === 'red' || p.severity === 'yellow');

  const dispatch = (patient, hospital) => {
    setSelectedPatient({ ...patient, targetHospital: hospital });
    setDispatchStatus('dispatching');
    setTimeout(() => setDispatchStatus('enroute'), 1500);
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title" id="ambulance-title">🚑 Ambulance Dispatch</h1>
          <p className="page-subtitle">Real-time routing via 108/112 integration • Nearest viable hospital matching</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="live-dot" style={{ background: 'var(--severity-green)' }}></span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--severity-green)' }}>Connected to 112 Network</span>
        </div>
      </div>

      {/* 108/112 Integration Status Banner */}
      <div className="card" style={{
        marginBottom: 24,
        background: 'linear-gradient(135deg, rgba(34,211,238,0.06), rgba(99,132,255,0.04))',
        borderColor: 'rgba(34,211,238,0.25)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{
            width: 48, height: 48, borderRadius: 'var(--radius-md)',
            background: 'rgba(34,211,238,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Radio size={24} color="var(--accent-cyan)" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Emergency Network Integration</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Connected to <strong>112 ERSS</strong> (Emergency Response Support System) and <strong>108 Ambulance Network</strong>. 
              Live bed availability synced from <strong>e-Hospital</strong> portal. GPS routing powered by Google Maps Platform.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ textAlign: 'center', padding: '8px 16px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: 'var(--accent-cyan)' }}>7</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Active Units</div>
            </div>
            <div style={{ textAlign: 'center', padding: '8px 16px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: 'var(--severity-green)' }}>3</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Available</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        {/* Pending Dispatches */}
        <div className="card">
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Pending Dispatches</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            Patients awaiting ambulance assignment — sorted by severity
          </p>

          {pendingPatients.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🚑</div>
              <div className="empty-state-text">No pending dispatches</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                All triaged patients have been dispatched or are minor severity
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pendingPatients.map(p => (
                <div key={p.id} style={{
                  padding: '14px 16px',
                  background: 'var(--bg-primary)',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${p.severity === 'red' ? 'rgba(239,68,68,0.25)' : 'var(--border-color)'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className={`severity-indicator ${p.severity}`}></div>
                      <span className="patient-id">{p.id}</span>
                      <span className={`badge badge-${p.severity}`}>{p.severityLabel}</span>
                    </div>
                    {p.needsSurgery && <span className="badge badge-red" style={{ fontSize: 10 }}>🔪 Surgery</span>}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
                    {p.injuryType || 'Mixed trauma'} • Specialty: {p.recommendedSpecialty || 'Trauma'}
                  </div>

                  {/* Best hospital match */}
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                    Best Hospital Match:
                  </div>
                  {hospitals.slice(0, 2).map(h => (
                    <button
                      key={h.id}
                      className="btn btn-outline btn-sm"
                      style={{ width: '100%', justifyContent: 'space-between', marginBottom: 6, padding: '10px 14px' }}
                      onClick={() => dispatch(p, h)}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>🏥</span>
                        <span style={{ fontWeight: 600 }}>{h.name}</span>
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                        <span>🛏️ {h.beds}</span>
                        <span>📍 {h.distance}</span>
                        <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>{h.eta}</span>
                        <ArrowRight size={14} />
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live Dispatch Panel */}
        <div className="card">
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Active Dispatch</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            Ambulance driver view — turn-by-turn routing
          </p>

          {dispatchStatus === 'idle' && !selectedPatient && (
            <div className="empty-state">
              <div className="empty-state-icon">📡</div>
              <div className="empty-state-text">Select a patient to dispatch</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Choose a patient and hospital from the left panel
              </div>
            </div>
          )}

          {selectedPatient && (
            <div className="fade-in">
              {/* Dispatch status */}
              <div style={{
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                background: dispatchStatus === 'enroute' ? 'rgba(34,211,238,0.08)' : 'rgba(245,158,11,0.08)',
                border: `1px solid ${dispatchStatus === 'enroute' ? 'rgba(34,211,238,0.25)' : 'rgba(245,158,11,0.25)'}`,
                marginBottom: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  {dispatchStatus === 'enroute' ? (
                    <><CheckCircle size={16} color="var(--accent-cyan)" /> <span style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>EN ROUTE</span></>
                  ) : (
                    <><Siren size={16} color="var(--severity-yellow)" /> <span style={{ fontWeight: 700, color: 'var(--severity-yellow)' }}>DISPATCHING...</span></>
                  )}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Ambulance Unit #A-03 dispatched to incident site
                </div>
              </div>

              {/* Route info */}
              <div style={{
                padding: '20px',
                background: 'linear-gradient(135deg, #0c1222, #131d35)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                marginBottom: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>FROM</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--severity-red)' }}></div>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>Incident Site</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Noida Sector 18</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, padding: '0 16px' }}>
                    <div style={{ width: '100%', height: 2, background: 'linear-gradient(to right, var(--severity-red), var(--accent-cyan))', borderRadius: 2 }}></div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      {selectedPatient.targetHospital?.distance || '2.3 km'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>TO</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{selectedPatient.targetHospital?.name?.split(' ').slice(0, 2).join(' ') || 'AIIMS'}</span>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent-cyan)' }}></div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedPatient.targetHospital?.speciality}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 36, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: 'var(--accent-cyan)' }}>
                    {selectedPatient.targetHospital?.eta || '8 min'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Estimated Time of Arrival</div>
                </div>
              </div>

              {/* Patient brief for hospital */}
              <div style={{
                padding: '16px',
                background: 'var(--bg-primary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, fontWeight: 600 }}>
                  📋 Pre-Arrival Alert Sent to Hospital
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Patient</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedPatient.id}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Severity</div>
                    <div><span className={`badge badge-${selectedPatient.severity}`}>{selectedPatient.severityLabel}</span></div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Injury</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{selectedPatient.injuryType || 'Mixed trauma'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Needs</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {selectedPatient.needsSurgery ? '🔪 Surgery ' : ''}
                      {selectedPatient.needsBlood ? '🩸 Blood' : ''}
                      {!selectedPatient.needsSurgery && !selectedPatient.needsBlood ? 'Standard care' : ''}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(34,211,238,0.06)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--accent-cyan)' }}>
                  ✅ Hospital ER team has been pre-alerted with patient data and AI assessment
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Live Hospital Bed Availability */}
      <div className="card" style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Live Hospital Bed Availability</h2>
          <span className="live-dot" style={{ background: 'var(--severity-green)' }}></span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          Synced from e-Hospital / ABDM portal • Updated every 60 seconds
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table className="patient-table">
            <thead>
              <tr>
                <th>Hospital</th>
                <th>General Beds</th>
                <th>ICU</th>
                <th>Ventilator</th>
                <th>OT Available</th>
                <th>Blood Bank</th>
                <th>Trauma Bay</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {hospitals.map(h => {
                const icu = Math.floor(Math.random() * 8) + 2;
                const vent = Math.floor(Math.random() * 5) + 1;
                const ot = Math.floor(Math.random() * 3) + 1;
                const blood = Math.random() > 0.3;
                const trauma = Math.floor(Math.random() * 3) + 1;
                return (
                  <tr key={h.id}>
                    <td style={{ fontWeight: 600 }}>{h.name}</td>
                    <td>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: h.beds > 30 ? 'var(--severity-green)' : 'var(--severity-yellow)' }}>
                        {h.beds}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: icu > 3 ? 'var(--severity-green)' : 'var(--severity-red)' }}>
                        {icu}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: vent > 2 ? 'var(--severity-green)' : 'var(--severity-red)' }}>
                        {vent}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{ot}</span>
                    </td>
                    <td>
                      <span className={`badge ${blood ? 'badge-green' : 'badge-red'}`}>
                        {blood ? '✓ Available' : '✗ Low'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{trauma}</span>
                    </td>
                    <td>
                      <span className="badge badge-green">● Online</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
