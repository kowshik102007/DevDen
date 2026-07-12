import React, { useState, useMemo } from 'react';
import PatientRiskTable from './components/PatientRiskTable';
import ASHAPerformanceCard from './components/ASHAPerformanceCard';
import RiskTrendChart from './components/RiskTrendChart';
import DistrictHeatmap from './components/DistrictHeatmap';
import RiskCardModal from './components/RiskCardModal';
import mockPatients from './data/mock_patients.json';

/**
 * App.jsx — JananiAI Dashboard
 *
 * Redesigned merging the best of ASHAShield's mobile UX into a web supervisor dashboard:
 *  - Gradient header with greeting + shield branding (ASHAShield DashboardScreen)
 *  - Animated stat cards with icons (ASHAShield StatCard)
 *  - Quick action buttons (ASHAShield quick actions)
 *  - High-risk patient alerts (ASHAShield alerts section)
 *  - Risk card modal (ASHAShield RiskCardScreen)
 *  - Backend status indicator (ASHAShield SupervisorScreen)
 */

function App() {
  const [filter, setFilter] = useState('ALL');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [activeSection, setActiveSection] = useState('dashboard');

  const filteredPatients = useMemo(() => {
    if (filter === 'ALL') return mockPatients;
    return mockPatients.filter(p => p.risk_label === filter);
  }, [filter]);

  const stats = useMemo(() => {
    const total = mockPatients.length;
    const high = mockPatients.filter(p => p.risk_label === 'HIGH').length;
    const moderate = mockPatients.filter(p => p.risk_label === 'MODERATE').length;
    const low = mockPatients.filter(p => p.risk_label === 'LOW').length;
    return { total, high, moderate, low };
  }, []);

  const highRiskPatients = useMemo(() =>
    mockPatients.filter(p => p.risk_label === 'HIGH'),
  []);

  const ashaWorkers = useMemo(() => {
    const map = {};
    mockPatients.forEach(p => {
      if (!map[p.asha_worker]) {
        map[p.asha_worker] = {
          name: p.asha_worker,
          id: p.asha_id,
          total_patients: 0,
          high_risk: 0,
          visits_this_month: 0,
        };
      }
      map[p.asha_worker].total_patients++;
      if (p.risk_label === 'HIGH') map[p.asha_worker].high_risk++;
      map[p.asha_worker].visits_this_month++;
    });
    return Object.values(map);
  }, []);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* ═══════════════════════════════════════════════════════════════════
          HEADER — Inspired by ASHAShield's DashboardScreen gradient header
          ═══════════════════════════════════════════════════════════════════ */}
      <header className="gradient-header" id="header">
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px' }}>

          {/* Top bar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            paddingTop: 24, paddingBottom: 8,
          }}>
            <div className="animate-fade-in-down">
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24,
                }}>
                  🛡️
                </div>
                <div>
                  <h1 style={{
                    fontSize: 24, fontWeight: 800, color: 'white',
                    fontFamily: "'Poppins', sans-serif", margin: 0, lineHeight: 1.2,
                  }}>
                    जननी AI Dashboard
                  </h1>
                  <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, margin: 0, marginTop: 2 }}>
                    Har maa surakshit ho — Every mother is safe
                  </p>
                </div>
              </div>
            </div>

            <div className="animate-fade-in-down" style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Last Updated</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'white' }}>
                {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
              {/* Backend status — Inspired by ASHAShield's SupervisorScreen */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                justifyContent: 'flex-end', marginTop: 4,
              }}>
                <div style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: '#34C759',
                }} />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>API Connected</span>
              </div>
            </div>
          </div>

          {/* ── Stat Cards Row — ASHAShield StatCard style ──────────────── */}
          <div
            className="stagger-children"
            style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 14, paddingBottom: 24, paddingTop: 12,
            }}
          >
            <StatCard
              icon="👥" value={stats.total} label="Total Patients"
              bgColor="rgba(255,255,255,0.12)" accentColor="var(--accent)"
            />
            <StatCard
              icon="🚨" value={stats.high} label="HIGH Risk"
              bgColor="rgba(255,59,48,0.15)" accentColor="var(--risk-high)"
              subtitle={`${((stats.high / stats.total) * 100).toFixed(1)}%`}
              pulse={stats.high > 0}
            />
            <StatCard
              icon="⚠️" value={stats.moderate} label="MODERATE Risk"
              bgColor="rgba(255,149,0,0.15)" accentColor="var(--risk-moderate)"
              subtitle={`${((stats.moderate / stats.total) * 100).toFixed(1)}%`}
            />
            <StatCard
              icon="✅" value={stats.low} label="LOW Risk"
              bgColor="rgba(52,199,89,0.15)" accentColor="var(--risk-low)"
              subtitle={`${((stats.low / stats.total) * 100).toFixed(1)}%`}
            />
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════
          BODY
          ═══════════════════════════════════════════════════════════════════ */}
      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 24px 80px' }}>

        {/* ── Quick Actions — Inspired by ASHAShield DashboardScreen ──── */}
        <div className="animate-fade-in-up" style={{ marginBottom: 28 }}>
          <SectionTitle>Quick Actions</SectionTitle>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              className="action-btn"
              style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-light))' }}
              onClick={() => scrollTo('patients-section')}
            >
              <span style={{ fontSize: 24 }}>📋</span>
              View All Patients
            </button>
            <button
              className="action-btn"
              style={{ background: 'linear-gradient(135deg, var(--risk-high), #FF6B60)' }}
              onClick={() => { setFilter('HIGH'); scrollTo('patients-section'); }}
            >
              <span style={{ fontSize: 24 }}>🚨</span>
              HIGH Risk Only
            </button>
            <button
              className="action-btn"
              style={{ background: 'linear-gradient(135deg, var(--accent), #FFB84D)' }}
              onClick={() => scrollTo('asha-section')}
            >
              <span style={{ fontSize: 24 }}>👩‍⚕️</span>
              ASHA Performance
            </button>
            <button
              className="action-btn"
              style={{ background: 'linear-gradient(135deg, #6A5ACD, #9B8FD8)' }}
              onClick={() => scrollTo('trend-section')}
            >
              <span style={{ fontSize: 24 }}>📈</span>
              Trend Analysis
            </button>
          </div>
        </div>

        {/* ── High-Risk Alerts — ASHAShield "Today's Alerts" ──────────── */}
        <div className="animate-fade-in-up" style={{ marginBottom: 28, animationDelay: '100ms' }}>
          <SectionTitle>
            🚨 High-Risk Patient Alerts ({highRiskPatients.length})
          </SectionTitle>

          {highRiskPatients.length === 0 ? (
            <div
              className="glass-card"
              style={{ padding: 32, textAlign: 'center' }}
            >
              <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
              <div style={{ color: 'var(--risk-low)', fontWeight: 600 }}>
                No high-risk patients. Good work!
              </div>
            </div>
          ) : (
            <div className="stagger-children" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
              {highRiskPatients.map((patient) => (
                <div
                  key={patient.id}
                  className="alert-card animate-slide-in-left"
                  onClick={() => setSelectedPatient(patient)}
                  id={`alert-${patient.id}`}
                >
                  {/* Risk dot */}
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: 'var(--risk-high)', marginRight: 12,
                    flexShrink: 0,
                  }} />

                  {/* Patient info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                      {patient.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {patient.village}, {patient.district} · Age {patient.age} · GA {patient.gestational_age_weeks}w
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--risk-high)', marginTop: 4, fontWeight: 600 }}>
                      BP {patient.bp_systolic}/{patient.bp_diastolic} · Hb {patient.hemoglobin}
                    </div>
                  </div>

                  {/* Chevron */}
                  <span style={{ color: 'var(--text-secondary)', fontSize: 18, marginLeft: 8 }}>›</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── District Heatmap ─────────────────────────────────────────── */}
        <div className="animate-fade-in-up" style={{ marginBottom: 28, animationDelay: '150ms' }} id="district-section">
          <div className="glass-card" style={{ padding: 24 }}>
            <SectionTitle noMargin>Risk Distribution by District</SectionTitle>
            <DistrictHeatmap patients={mockPatients} />
          </div>
        </div>

        {/* ── Risk Trend Chart ────────────────────────────────────────── */}
        <div className="animate-fade-in-up" style={{ marginBottom: 28, animationDelay: '200ms' }} id="trend-section">
          <div className="glass-card" style={{ padding: 24 }}>
            <SectionTitle noMargin>HIGH Risk Trend (Last 8 Weeks)</SectionTitle>
            <RiskTrendChart />
          </div>
        </div>

        {/* ── Filter Buttons ──────────────────────────────────────────── */}
        <div id="patients-section" style={{ marginBottom: 16 }}>
          <SectionTitle>Patient Registry</SectionTitle>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { key: 'ALL', label: `ALL (${stats.total})`, bg: 'var(--primary)' },
              { key: 'HIGH', label: `HIGH (${stats.high})`, bg: 'var(--risk-high)' },
              { key: 'MODERATE', label: `MODERATE (${stats.moderate})`, bg: 'var(--risk-moderate)' },
              { key: 'LOW', label: `LOW (${stats.low})`, bg: 'var(--risk-low)' },
            ].map(btn => (
              <button
                key={btn.key}
                onClick={() => setFilter(btn.key)}
                className={`filter-pill ${filter === btn.key ? 'active' : ''}`}
                style={filter === btn.key ? { background: btn.bg } : {}}
                id={`filter-${btn.key.toLowerCase()}`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Patient Table ───────────────────────────────────────────── */}
        <div className="animate-fade-in-up glass-card" style={{ padding: 24, marginBottom: 28 }}>
          <PatientRiskTable
            patients={filteredPatients}
            onViewPatient={setSelectedPatient}
          />
        </div>

        {/* ── ASHA Worker Performance ─────────────────────────────────── */}
        <div id="asha-section" style={{ marginBottom: 28 }}>
          <SectionTitle>ASHA Worker Performance</SectionTitle>
          <div
            className="stagger-children"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 16,
            }}
          >
            {ashaWorkers.map(asha => (
              <ASHAPerformanceCard key={asha.id} asha={asha} />
            ))}
          </div>
        </div>
      </main>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer
        style={{
          background: 'var(--primary-dark)',
          color: 'rgba(255,255,255,0.6)',
          padding: '20px 24px',
          textAlign: 'center',
          fontSize: 12,
        }}
      >
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: 4, fontSize: 14 }}>
            🛡️ JananiAI — Maternal Risk Intelligence
          </div>
          <div>Prevention over reaction. Intelligence at the last mile.</div>
          <div style={{ marginTop: 4, opacity: 0.7 }}>
            Hackathon Project · MIT License · April 2026
          </div>
        </div>
      </footer>

      {/* ── Risk Card Modal ───────────────────────────────────────────── */}
      {selectedPatient && (
        <RiskCardModal
          patient={selectedPatient}
          onClose={() => setSelectedPatient(null)}
        />
      )}
    </div>
  );
}

/* ── Stat Card Component — ASHAShield StatCard style ───────────────────── */
function StatCard({ icon, value, label, bgColor, accentColor, subtitle, pulse }) {
  return (
    <div
      className={`animate-fade-in-up ${pulse ? 'animate-pulse-subtle' : ''}`}
      style={{
        background: bgColor,
        borderRadius: 'var(--radius-md)',
        padding: '16px 18px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Icon */}
      <div style={{
        width: 42, height: 42, borderRadius: '50%',
        background: `${accentColor}20`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 8px', fontSize: 20,
      }}>
        {icon}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: 'white', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>
        {label}
      </div>
      {subtitle && (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

/* ── Section Title Component ───────────────────────────────────────────── */
function SectionTitle({ children, noMargin }) {
  return (
    <h2
      style={{
        fontSize: 17,
        fontWeight: 700,
        color: 'var(--text-primary)',
        fontFamily: "'Poppins', sans-serif",
        marginTop: noMargin ? 0 : 0,
        marginBottom: 14,
      }}
    >
      {children}
    </h2>
  );
}

export default App;