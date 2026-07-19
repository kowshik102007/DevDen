import { useTriage } from '../context/TriageContext';
import { Package, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';

export default function ResourcesPage() {
  const { resources, setResources, getStats } = useTriage();
  const stats = getStats();

  const resourceMeta = {
    ambulances: { icon: '🚑', label: 'Ambulances', desc: 'Emergency medical transport vehicles' },
    beds: { icon: '🛏️', label: 'Hospital Beds', desc: 'Available beds across all nearby hospitals' },
    surgeons: { icon: '👨‍⚕️', label: 'Surgeons on Duty', desc: 'Trauma and emergency surgeons available' },
    bloodUnits: { icon: '🩸', label: 'Blood Units', desc: 'Available blood units in blood bank' },
    ventilators: { icon: '💨', label: 'Ventilators', desc: 'Mechanical ventilation support units' },
    operatingRooms: { icon: '🏥', label: 'Operating Rooms', desc: 'Available surgical operating theaters' },
  };

  const updateResource = (key, field, value) => {
    setResources(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: Math.max(0, parseInt(value) || 0) }
    }));
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title" id="resources-title">Resource Management</h1>
          <p className="page-subtitle">Track and manage available emergency resources in real-time</p>
        </div>
      </div>

      {/* Demand forecast */}
      <div className="card" style={{ marginBottom: 24, borderColor: 'rgba(245, 158, 11, 0.3)', background: 'linear-gradient(135deg, rgba(245,158,11,0.05), rgba(239,68,68,0.03))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <AlertTriangle size={20} color="var(--severity-yellow)" />
          <span style={{ fontWeight: 700, fontSize: 15 }}>AI Resource Forecast</span>
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          Based on <strong>{stats.total}</strong> triaged patients ({stats.red} critical, {stats.yellow} delayed), 
          estimated resource demand: <strong>{stats.red * 2 + stats.yellow}</strong> bed-hours, 
          <strong> {stats.red}</strong> surgical interventions, 
          <strong> {Math.ceil((stats.red + stats.yellow) * 0.6)}</strong> ambulance dispatches. 
          {stats.red > 3 && <span style={{ color: 'var(--severity-red)', fontWeight: 600 }}> ⚠️ Consider requesting mutual aid from adjacent districts.</span>}
        </div>
      </div>

      {/* Resource cards grid */}
      <div className="grid-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        {Object.entries(resources).map(([key, val]) => {
          const meta = resourceMeta[key];
          const pct = (val.available / val.total) * 100;
          const status = pct < 25 ? 'critical' : pct < 50 ? 'warning' : 'good';
          const used = val.total - val.available;

          return (
            <div className="card" key={key} style={{ 
              borderColor: status === 'critical' ? 'rgba(239,68,68,0.3)' : 'var(--border-color)' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: 28 }}>{meta.icon}</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{meta.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{meta.desc}</div>
                </div>
              </div>

              {/* Visual */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 32, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: status === 'critical' ? 'var(--severity-red)' : status === 'warning' ? 'var(--severity-yellow)' : 'var(--severity-green)' }}>
                    {val.available}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Available</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 32, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>
                    {val.total}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Capacity</div>
                </div>
              </div>

              <div className="resource-track" style={{ height: 10, marginBottom: 16 }}>
                <div className={`resource-fill ${status}`} style={{ width: `${pct}%` }}></div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Available</label>
                  <input
                    type="number"
                    className="form-input"
                    value={val.available}
                    onChange={e => updateResource(key, 'available', e.target.value)}
                    min={0}
                    max={val.total}
                    style={{ padding: '8px 12px' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Total</label>
                  <input
                    type="number"
                    className="form-input"
                    value={val.total}
                    onChange={e => updateResource(key, 'total', e.target.value)}
                    min={0}
                    style={{ padding: '8px 12px' }}
                  />
                </div>
              </div>

              {status === 'critical' && (
                <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--severity-red-bg)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--severity-red)', fontWeight: 600 }}>
                  ⚠️ Critical — Only {val.available} remaining ({Math.round(pct)}%)
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
