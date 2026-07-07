import React, { useMemo } from 'react';

/**
 * DistrictHeatmap — Enhanced with animations, hover effects, and gradient tiles.
 * Inspired by ASHAShield's DashboardScreen stat cards with icon overlays.
 */

const DISTRICT_GRADIENTS = {
  Barmer:     { gradient: 'linear-gradient(135deg, #C62828, #EF5350)', icon: '🔴' },
  Jalore:     { gradient: 'linear-gradient(135deg, #EF6C00, #FF9800)', icon: '🟠' },
  Sirohi:     { gradient: 'linear-gradient(135deg, #F57F17, #FFCA28)', icon: '🟡' },
  Ajmer:      { gradient: 'linear-gradient(135deg, #E65100, #FF6D00)', icon: '🟧' },
  Bhilwara:   { gradient: 'linear-gradient(135deg, #33691E, #689F38)', icon: '🟢' },
  Udaipur:    { gradient: 'linear-gradient(135deg, #1565C0, #42A5F5)', icon: '🔵' },
  Pratapgarh: { gradient: 'linear-gradient(135deg, #4A148C, #7B1FA2)', icon: '🟣' },
};

function DistrictHeatmap({ patients }) {
  const districtStats = useMemo(() => {
    const stats = {};
    patients.forEach(p => {
      if (!stats[p.district]) {
        stats[p.district] = { total: 0, high: 0, moderate: 0, low: 0 };
      }
      stats[p.district].total++;
      if (p.risk_label === 'HIGH') stats[p.district].high++;
      else if (p.risk_label === 'MODERATE') stats[p.district].moderate++;
      else stats[p.district].low++;
    });
    return stats;
  }, [patients]);

  return (
    <div
      className="stagger-children"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 14,
      }}
    >
      {Object.entries(districtStats).map(([district, data]) => {
        const highPercent = (data.high / data.total * 100).toFixed(0);
        const config = DISTRICT_GRADIENTS[district] || { gradient: 'linear-gradient(135deg, #607D8B, #90A4AE)', icon: '⬜' };

        return (
          <div
            key={district}
            className="stat-card animate-fade-in-up"
            style={{
              background: config.gradient,
              color: 'white',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Background icon overlay */}
            <div
              style={{
                position: 'absolute',
                top: -10,
                right: -10,
                fontSize: 60,
                opacity: 0.15,
                lineHeight: 1,
              }}
            >
              {config.icon}
            </div>

            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 10, fontFamily: "'Poppins', sans-serif" }}>
              {district}
            </div>

            <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{data.total}</div>
                <div style={{ fontSize: 10, opacity: 0.8 }}>Total</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{data.high}</div>
                <div style={{ fontSize: 10, opacity: 0.8 }}>HIGH</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{data.moderate}</div>
                <div style={{ fontSize: 10, opacity: 0.8 }}>MOD</div>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ marginTop: 'auto' }}>
              <div style={{ fontSize: 10, opacity: 0.8, marginBottom: 4 }}>
                HIGH Risk: {highPercent}%
              </div>
              <div style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 'var(--radius-full)', height: 5, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${highPercent}%`,
                    background: 'white',
                    borderRadius: 'var(--radius-full)',
                    transition: 'width 1s ease-out',
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default DistrictHeatmap;