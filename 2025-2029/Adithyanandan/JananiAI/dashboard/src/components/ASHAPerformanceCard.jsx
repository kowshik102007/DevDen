import React from 'react';

/**
 * ASHAPerformanceCard — Enhanced with icon stats, progress bars, and hover elevation.
 * Inspired by ASHAShield's StatTile and DashboardScreen stat cards.
 */

function ASHAPerformanceCard({ asha }) {
  const highRiskPercent = ((asha.high_risk / asha.total_patients) * 100).toFixed(0);
  const dataCompleteness = Math.min(100, (asha.total_patients * 3.5)).toFixed(0);

  return (
    <div
      className="glass-card animate-fade-in-up"
      style={{ padding: 20, position: 'relative', overflow: 'hidden' }}
    >
      {/* Background accent circle */}
      <div
        style={{
          position: 'absolute',
          top: -20,
          right: -20,
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'var(--primary)',
          opacity: 0.06,
        }}
      />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--primary), var(--primary-light))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: 16,
              fontWeight: 800,
            }}
          >
            {asha.name ? asha.name.split(' ').pop()[0] : '?'}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', fontFamily: "'Poppins', sans-serif" }}>
              {asha.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {asha.id}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <StatItem icon="👥" label="Total Patients" value={asha.total_patients} color="var(--primary)" />
        <StatItem icon="📋" label="Visits / Month" value={asha.visits_this_month} color="var(--accent)" />
        <StatItem icon="🚨" label="HIGH Risk" value={asha.high_risk} color="var(--risk-high)" />
        <StatItem icon="📊" label="Data Completeness" value={`${dataCompleteness}%`} color="#6A5ACD" />
      </div>

      {/* HIGH Risk Progress */}
      <div style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>
            HIGH Risk Ratio
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--risk-high)' }}>
            {highRiskPercent}%
          </span>
        </div>
        <div className="progress-bar">
          <div
            className="fill"
            style={{
              width: `${highRiskPercent}%`,
              background: `linear-gradient(90deg, var(--risk-high), #FF6B60)`,
            }}
          />
        </div>
      </div>

      {/* Data Completeness Progress */}
      <div style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>
            Data Completeness
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#6A5ACD' }}>
            {dataCompleteness}%
          </span>
        </div>
        <div className="progress-bar">
          <div
            className="fill"
            style={{
              width: `${dataCompleteness}%`,
              background: `linear-gradient(90deg, #6A5ACD, #9B8FD8)`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function StatItem({ icon, label, value, color }) {
  return (
    <div
      style={{
        background: `${color}10`,
        borderRadius: 'var(--radius-sm)',
        padding: '10px 12px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 18, marginBottom: 2 }}>{icon}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

export default ASHAPerformanceCard;