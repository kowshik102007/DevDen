import { useTriage } from '../context/TriageContext';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Users, Heart, Activity, Ambulance, Bed, Syringe, Clock, ChevronRight, Stethoscope, Zap, Shield, TrendingUp, MapPin } from 'lucide-react';

export default function Dashboard() {
  const { patients, resources, getStats, activeEvent, hospitals } = useTriage();
  const navigate = useNavigate();
  const stats = getStats();

  const timeElapsed = () => {
    const start = new Date(activeEvent.startTime);
    const now = new Date();
    const diff = Math.floor((now - start) / 60000);
    if (diff < 60) return `${diff}m`;
    return `${Math.floor(diff / 60)}h ${diff % 60}m`;
  };

  return (
    <div className="fade-in">
      {/* Hero Section */}
      <div className="hero-section">
        <div className="hero-content">
          <div className="hero-badge">
            <Zap size={14} />
            <span>AI-Powered Emergency Response</span>
          </div>
          <h1 className="hero-title">
            Command & Control Center
          </h1>
          <p className="hero-subtitle">
            Real-time triage intelligence powered by Google Gemini AI. Coordinate mass casualty response with precision and speed.
          </p>
          <div className="hero-actions">
            <button className="btn btn-danger btn-lg" onClick={() => navigate('/triage')} id="new-triage-btn">
              <Stethoscope size={20} />
              Start New Triage
            </button>
            <button className="btn btn-outline btn-lg" onClick={() => navigate('/map')}>
              <MapPin size={20} />
              View Hospital Map
            </button>
          </div>
          <div className="hero-stats">
            <div className="hero-stat-item">
              <Shield size={18} />
              <div>
                <div className="hero-stat-value">{stats.total}</div>
                <div className="hero-stat-label">Patients Triaged</div>
              </div>
            </div>
            <div className="hero-stat-divider"></div>
            <div className="hero-stat-item">
              <Activity size={18} />
              <div>
                <div className="hero-stat-value">{resources.ambulances.available}</div>
                <div className="hero-stat-label">Ambulances Ready</div>
              </div>
            </div>
            <div className="hero-stat-divider"></div>
            <div className="hero-stat-item">
              <TrendingUp size={18} />
              <div>
                <div className="hero-stat-value">{hospitals.length}</div>
                <div className="hero-stat-label">Hospitals Online</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Event Banner */}
      <div className="card" style={{ 
        marginBottom: 24, 
        background: 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(245,158,11,0.05))',
        borderColor: 'rgba(239,68,68,0.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ 
              width: 48, height: 48, borderRadius: 'var(--radius-md)',
              background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <AlertTriangle size={24} color="var(--severity-red)" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="live-dot" style={{ background: 'var(--severity-red)' }}></span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--severity-red)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Active Crisis
                </span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{activeEvent.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                {activeEvent.location} • {activeEvent.type}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>
                {timeElapsed()}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Elapsed</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: 'var(--severity-yellow)' }}>
                ~{activeEvent.estimatedCasualties}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Est. Casualties</div>
            </div>
          </div>
        </div>
      </div>

      {/* Triage Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon red"><AlertTriangle size={22} /></div>
          <div>
            <div className="stat-value" style={{ color: 'var(--severity-red)' }}>{stats.red}</div>
            <div className="stat-label">Immediate (Red)</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow"><Clock size={22} /></div>
          <div>
            <div className="stat-value" style={{ color: 'var(--severity-yellow)' }}>{stats.yellow}</div>
            <div className="stat-label">Delayed (Yellow)</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><Heart size={22} /></div>
          <div>
            <div className="stat-value" style={{ color: 'var(--severity-green)' }}>{stats.green}</div>
            <div className="stat-label">Minor (Green)</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><Users size={22} /></div>
          <div>
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Triaged</div>
          </div>
        </div>
      </div>

      {/* Two column layout */}
      <div className="grid-2">
        {/* Recent Patients */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Recent Patients</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/patients')}>
              View All <ChevronRight size={14} />
            </button>
          </div>
          
          {patients.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🏥</div>
              <div className="empty-state-text">No patients triaged yet</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Start a new triage to add patients</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {patients.slice(0, 5).map(p => (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                  background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)',
                  transition: 'background 0.2s'
                }}>
                  <div className={`severity-indicator ${p.severity}`}></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="patient-id">{p.id}</span>
                      <span className={`badge badge-${p.severity}`}>
                        {p.severity === 'red' ? 'Immediate' : p.severity === 'yellow' ? 'Delayed' : p.severity === 'green' ? 'Minor' : 'Deceased'}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                      {p.injuryType || p.description?.substring(0, 50) || 'Assessment pending'}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resource Overview */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Resource Status</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/resources')}>
              Manage <ChevronRight size={14} />
            </button>
          </div>

          {Object.entries(resources).map(([key, val]) => {
            const pct = (val.available / val.total) * 100;
            const status = pct < 25 ? 'critical' : pct < 50 ? 'warning' : 'good';
            const icons = { ambulances: '🚑', beds: '🛏️', surgeons: '👨‍⚕️', bloodUnits: '🩸', ventilators: '💨', operatingRooms: '🏥' };
            const labels = { ambulances: 'Ambulances', beds: 'Hospital Beds', surgeons: 'Surgeons', bloodUnits: 'Blood Units', ventilators: 'Ventilators', operatingRooms: 'Operating Rooms' };
            return (
              <div className="resource-bar" key={key}>
                <div className="resource-header">
                  <span className="resource-name">{icons[key]} {labels[key]}</span>
                  <span className="resource-value">{val.available}/{val.total}</span>
                </div>
                <div className="resource-track">
                  <div className={`resource-fill ${status}`} style={{ width: `${pct}%` }}></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Nearby Hospitals */}
      <div className="card" style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Nearby Hospitals</h2>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/map')}>
            View Map <ChevronRight size={14} />
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="patient-table">
            <thead>
              <tr>
                <th>Hospital</th>
                <th>Specialty</th>
                <th>Beds Available</th>
                <th>Distance</th>
                <th>ETA</th>
              </tr>
            </thead>
            <tbody>
              {hospitals.map(h => (
                <tr key={h.id}>
                  <td style={{ fontWeight: 600 }}>{h.name}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{h.speciality}</td>
                  <td>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                      {h.beds}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{h.distance}</td>
                  <td>
                    <span className={`badge ${parseFloat(h.eta) < 15 ? 'badge-green' : 'badge-yellow'}`}>
                      {h.eta}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
