import { useTriage } from '../context/TriageContext';
import { MapPin, Navigation, Clock, Bed, Star } from 'lucide-react';

export default function MapPage() {
  const { hospitals, patients } = useTriage();

  // Build hospital load data
  const hospitalLoad = hospitals.map(h => {
    const assigned = patients.filter(p => p.assignedHospital === h.name).length;
    return { ...h, assignedPatients: assigned };
  });

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title" id="map-title">Hospital Network & Routing</h1>
          <p className="page-subtitle">Real-time hospital availability and patient routing via Google Maps</p>
        </div>
      </div>

      {/* Map placeholder with visual hospital map */}
      <div className="card" style={{ marginBottom: 24, padding: 0, overflow: 'hidden' }}>
        <div className="map-container" style={{ 
          height: 450,
          background: 'linear-gradient(135deg, #0c1222 0%, #131d35 50%, #0e1628 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}>
          {/* Grid overlay */}
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.1,
            backgroundImage: 'linear-gradient(rgba(99,132,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(99,132,255,0.3) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}></div>
          
          {/* Simulated hospital markers */}
          {hospitals.map((h, i) => {
            const positions = [
              { top: '30%', left: '25%' },
              { top: '45%', left: '40%' },
              { top: '55%', left: '65%' },
              { top: '25%', left: '70%' },
              { top: '70%', left: '35%' },
            ];
            const pos = positions[i] || { top: '50%', left: '50%' };
            return (
              <div key={h.id} style={{
                position: 'absolute',
                ...pos,
                transform: 'translate(-50%, -50%)',
                zIndex: 10,
              }}>
                {/* Ping animation */}
                <div style={{
                  position: 'absolute',
                  width: 40, height: 40,
                  borderRadius: '50%',
                  background: 'rgba(99, 132, 255, 0.2)',
                  top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%)',
                  animation: `pulse 2s infinite ${i * 0.3}s`,
                }}></div>
                
                {/* Marker */}
                <div style={{
                  width: 32, height: 32,
                  borderRadius: '50%',
                  background: 'var(--gradient-main)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16,
                  boxShadow: '0 0 20px rgba(99,132,255,0.4)',
                  cursor: 'pointer',
                  position: 'relative',
                  zIndex: 2,
                }}>🏥</div>
                
                {/* Label */}
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginTop: 8,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px 10px',
                  whiteSpace: 'nowrap',
                  fontSize: 11,
                  fontWeight: 600,
                  zIndex: 2,
                }}>
                  {h.name.split(' ').slice(0, 2).join(' ')}
                </div>
              </div>
            );
          })}
          
          {/* Incident marker */}
          <div style={{
            position: 'absolute',
            top: '48%', left: '48%',
            transform: 'translate(-50%, -50%)',
            zIndex: 15,
          }}>
            <div style={{
              width: 44, height: 44,
              borderRadius: '50%',
              background: 'var(--gradient-red)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22,
              boxShadow: '0 0 30px rgba(239,68,68,0.5)',
              animation: 'recordPulse 1.5s infinite',
            }}>⚠️</div>
            <div style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginTop: 8,
              background: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 'var(--radius-sm)',
              padding: '4px 10px',
              whiteSpace: 'nowrap',
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--severity-red)',
            }}>
              Incident Site
            </div>
          </div>
          
          {/* Map overlay info */}
          <div style={{
            position: 'absolute', bottom: 16, left: 16,
            background: 'var(--bg-glass)',
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            fontSize: 12, color: 'var(--text-secondary)',
            zIndex: 20,
          }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
              📍 Noida Sector 18, Delhi NCR
            </div>
            <div>Showing {hospitals.length} hospitals in 10km radius</div>
            <div style={{ marginTop: 4, fontSize: 11, color: 'var(--accent-cyan)' }}>
              Powered by Google Maps Platform
            </div>
          </div>
        </div>
      </div>

      {/* Hospital details cards */}
      <div className="grid-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))' }}>
        {hospitalLoad.map((h, i) => (
          <div className="card" key={h.id} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 20 }}>🏥</span>
                  <h3 style={{ fontSize: 16, fontWeight: 700 }}>{h.name}</h3>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{h.speciality}</div>
              </div>
              {i === 0 && (
                <span className="badge" style={{ background: 'rgba(34,211,238,0.12)', color: 'var(--accent-cyan)', border: '1px solid rgba(34,211,238,0.3)' }}>
                  <Star size={12} /> Recommended
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <div style={{ textAlign: 'center', padding: '12px 8px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
                <Bed size={16} color="var(--accent-blue)" style={{ marginBottom: 4 }} />
                <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>{h.beds}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Beds</div>
              </div>
              <div style={{ textAlign: 'center', padding: '12px 8px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
                <Navigation size={16} color="var(--accent-purple)" style={{ marginBottom: 4 }} />
                <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>{h.distance}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Distance</div>
              </div>
              <div style={{ textAlign: 'center', padding: '12px 8px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
                <Clock size={16} color="var(--accent-cyan)" style={{ marginBottom: 4 }} />
                <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>{h.eta}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>ETA</div>
              </div>
              <div style={{ textAlign: 'center', padding: '12px 8px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
                <MapPin size={16} color="var(--severity-yellow)" style={{ marginBottom: 4 }} />
                <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>{h.assignedPatients}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Patients</div>
              </div>
            </div>

            <button 
              className="btn btn-outline" 
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => {
                // Open Google Maps with directions
                const destination = `${h.lat},${h.lng}`;
                const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
                window.open(url, '_blank');
              }}
            >
              <Navigation size={14} /> Get Directions
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
