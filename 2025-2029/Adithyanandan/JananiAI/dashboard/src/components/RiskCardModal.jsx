import React from 'react';

/**
 * RiskCardModal — Inspired by ASHAShield's RiskCardScreen.js
 *
 * Full-screen color-coded modal showing:
 *  1. Large risk label (Hindi + English)
 *  2. Patient vitals summary
 *  3. Risk reasons in Hindi + English
 *  4. Emergency contacts
 *
 * Activated when supervisor clicks "View Details" on a patient row.
 */

const RISK_CONFIG = {
  HIGH: {
    color: '#FF3B30',
    gradient: 'linear-gradient(135deg, #FF3B30, #FF6B60)',
    icon: '🚨',
    labelHi: 'KHATRA / उच्च जोखिम',
    labelEn: 'HIGH RISK — Immediate referral needed',
  },
  MODERATE: {
    color: '#FF9500',
    gradient: 'linear-gradient(135deg, #FF9500, #FFAD33)',
    icon: '⚠️',
    labelHi: 'SAVDHAN / मध्यम जोखिम',
    labelEn: 'MODERATE RISK — Close monitoring required',
  },
  LOW: {
    color: '#34C759',
    gradient: 'linear-gradient(135deg, #34C759, #5DD67B)',
    icon: '✅',
    labelHi: 'SURAKSHIT / कम जोखिम',
    labelEn: 'LOW RISK — Continue routine care',
  },
};

const HINDI_REASONS = {
  bp_high: 'BP bahut zyada hai — aaj PHC jaana zaroori hai',
  bp_borderline: 'BP upar border par hai — dhyan rakhein',
  hemoglobin_low: 'Khoon ki kami hai — iron injection ki zaroorat ho sakti hai',
  hemoglobin_moderate: 'Khoon ki kami mild hai — iron tablet lein',
  complications: 'Pehle ki takleef ki wajah se dhyan rakhein',
  default_1: 'Doctor se milkar salah lein',
  default_2: 'Regular checkup zaroori hai',
  default_3: 'Swasthya ki dekhbhal karein',
};

const EMERGENCY_CONTACTS = [
  { label: '108 Ambulance', phone: '108', type: 'ambulance', icon: '🚑' },
  { label: 'PHC Barmer', phone: '02982-220123', type: 'phc', icon: '🏥' },
  { label: 'ANM Supervisor', phone: '9876543210', type: 'anm', icon: '👩‍⚕️' },
  { label: 'District Hospital', phone: '102', type: 'phc', icon: '🏨' },
];

function getReasons(patient) {
  const reasons = [];

  if (patient.bp_systolic >= 140) {
    reasons.push({
      hi: HINDI_REASONS.bp_high,
      en: `Blood pressure is elevated (${patient.bp_systolic}/${patient.bp_diastolic} mmHg). Refer to PHC.`,
    });
  } else if (patient.bp_systolic >= 130) {
    reasons.push({
      hi: HINDI_REASONS.bp_borderline,
      en: `Blood pressure is borderline (${patient.bp_systolic}/${patient.bp_diastolic} mmHg). Monitor closely.`,
    });
  }

  if (patient.hemoglobin < 7.0) {
    reasons.push({
      hi: HINDI_REASONS.hemoglobin_low,
      en: `Haemoglobin critically low (${patient.hemoglobin} g/dL). Urgent blood assessment needed.`,
    });
  } else if (patient.hemoglobin < 9.0) {
    reasons.push({
      hi: HINDI_REASONS.hemoglobin_moderate,
      en: `Haemoglobin low (${patient.hemoglobin} g/dL). Start iron supplements.`,
    });
  }

  if (patient.previous_complications >= 1) {
    reasons.push({
      hi: HINDI_REASONS.complications,
      en: 'Previous complications on record — additional monitoring required.',
    });
  }

  // Fill to 3
  const defaults = [
    { hi: HINDI_REASONS.default_1, en: 'Consult a doctor for proper guidance.' },
    { hi: HINDI_REASONS.default_2, en: 'Regular antenatal checkups are essential.' },
    { hi: HINDI_REASONS.default_3, en: 'Take care of health and nutrition.' },
  ];
  while (reasons.length < 3) {
    reasons.push(defaults[reasons.length]);
  }

  return reasons.slice(0, 3);
}

export default function RiskCardModal({ patient, onClose }) {
  if (!patient) return null;

  const config = RISK_CONFIG[patient.risk_label] || RISK_CONFIG.LOW;
  const reasons = patient.reasons || getReasons(patient);
  const isHigh = patient.risk_label === 'HIGH';
  const confidence = patient.confidence !== undefined ? `${patient.confidence}%` : `${(patient.risk_score * 100).toFixed(0)}%`;

  return (
    <div className="modal-overlay" onClick={onClose} id="risk-card-modal">
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ padding: 0, overflow: 'hidden' }}>

        {/* ── Risk Header ────────────────────────────────────────────────── */}
        <div
          style={{
            background: config.gradient,
            padding: '40px 24px 28px',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Pulse ring for HIGH risk */}
          {isHigh && (
            <div
              className="animate-pulse-subtle"
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 160,
                height: 160,
                borderRadius: '50%',
                border: '3px solid rgba(255,255,255,0.3)',
              }}
            />
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.2)',
              border: 'none',
              color: 'white',
              fontSize: 18,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            id="risk-card-close"
          >
            ✕
          </button>

          {/* Risk icon */}
          <div className="animate-bounce-in" style={{ fontSize: 56, lineHeight: 1, marginBottom: 8 }}>
            {config.icon}
          </div>

          {/* Hindi label */}
          <div
            className="animate-fade-in-up"
            style={{
              fontSize: 22,
              fontWeight: 900,
              color: 'white',
              letterSpacing: 0.5,
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            {config.labelHi}
          </div>

          {/* English sub-label */}
          <div
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.85)',
              marginTop: 4,
            }}
          >
            {config.labelEn}
          </div>

          {/* Patient name */}
          <div
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.95)',
              marginTop: 14,
            }}
          >
            {patient.name}
          </div>

          {/* Visit info */}
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
            {patient.village}, {patient.district} · Age {patient.age} · GA {patient.gestational_age_weeks}w
          </div>
        </div>

        {/* ── Vitals Summary ─────────────────────────────────────────────── */}
        <div style={{ padding: '20px 24px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 12, fontFamily: "'Poppins', sans-serif" }}>
            📋 Vitals Summary
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <VitalItem label="Blood Pressure" value={`${patient.bp_systolic}/${patient.bp_diastolic} mmHg`} warn={patient.bp_systolic >= 140} />
            <VitalItem label="Haemoglobin" value={`${patient.hemoglobin} g/dL`} warn={patient.hemoglobin < 9} />
            <VitalItem label="Gestational Age" value={`${patient.gestational_age_weeks} weeks`} />
            <VitalItem label="Risk Confidence" value={confidence} />
          </div>
        </div>

        {/* ── Risk Reasons ───────────────────────────────────────────────── */}
        <div style={{ padding: '0 24px 20px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 12, fontFamily: "'Poppins', sans-serif" }}>
            Why this risk level?
          </div>
          {reasons.map((r, i) => (
            <div
              key={i}
              className="animate-slide-in-right"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                background: 'var(--bg)',
                borderRadius: 'var(--radius-sm)',
                padding: 12,
                marginBottom: 8,
                animationDelay: `${i * 100}ms`,
              }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: config.color,
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 800,
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                  {r.hi || r}
                </div>
                {r.en && (
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {r.en}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ── Emergency Contacts ──────────────────────────────────────────── */}
        {isHigh && (
          <div style={{ padding: '0 24px 24px' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 12, fontFamily: "'Poppins', sans-serif" }}>
              📞 Emergency Contacts
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {EMERGENCY_CONTACTS.map((c, i) => (
                <div
                  key={i}
                  className={`contact-card ${c.type === 'ambulance' ? 'emergency' : ''}`}
                  style={{ padding: 12 }}
                >
                  <div style={{ fontSize: 24, marginBottom: 4 }}>{c.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 600 }}>{c.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 900, marginTop: 2 }}>{c.phone}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ASHA Worker Info ─────────────────────────────────────────────── */}
        <div
          style={{
            padding: '14px 24px',
            background: 'var(--bg)',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 12,
            color: 'var(--text-secondary)',
          }}
        >
          <span>ASHA: {patient.asha_worker} ({patient.asha_id})</span>
          <span>Last visit: {patient.last_visit}</span>
        </div>
      </div>
    </div>
  );
}

function VitalItem({ label, value, warn }) {
  return (
    <div
      style={{
        background: warn ? 'var(--risk-high-bg)' : 'var(--bg)',
        borderRadius: 'var(--radius-sm)',
        padding: '10px 12px',
        borderLeft: warn ? '3px solid var(--risk-high)' : '3px solid var(--border)',
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: warn ? 'var(--risk-high)' : 'var(--text-primary)', marginTop: 2 }}>{value}</div>
    </div>
  );
}
