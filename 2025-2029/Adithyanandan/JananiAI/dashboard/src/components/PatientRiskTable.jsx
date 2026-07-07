import React, { useState, useMemo } from 'react';

/**
 * PatientRiskTable — Enhanced with search bar, animated rows, and clickable details.
 * Inspired by ASHAShield's PatientListScreen (search, risk badges with dots, avatars).
 */

function PatientRiskTable({ patients, onViewPatient }) {
  const [sortBy, setSortBy] = useState('risk_label');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAndSorted = useMemo(() => {
    let list = [...patients];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        p =>
          p.name?.toLowerCase().includes(q) ||
          p.village?.toLowerCase().includes(q) ||
          p.district?.toLowerCase().includes(q) ||
          p.asha_worker?.toLowerCase().includes(q)
      );
    }

    // Sort
    const riskOrder = { HIGH: 0, MODERATE: 1, LOW: 2 };
    list.sort((a, b) => {
      if (sortBy === 'risk_label') {
        return riskOrder[a.risk_label] - riskOrder[b.risk_label];
      }
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'gestational_age_weeks') return b.gestational_age_weeks - a.gestational_age_weeks;
      return 0;
    });

    return list;
  }, [patients, searchQuery, sortBy]);

  const SortHeader = ({ field, children }) => (
    <th
      onClick={() => setSortBy(field)}
      style={{
        cursor: 'pointer',
        userSelect: 'none',
        position: 'relative',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {children}
        {sortBy === field && (
          <span style={{ fontSize: 10 }}>▼</span>
        )}
      </span>
    </th>
  );

  return (
    <div>
      {/* Search Bar — Inspired by ASHAShield's PatientListScreen */}
      <div className="search-bar" style={{ marginBottom: 16 }} id="patient-search">
        <span style={{ marginRight: 8, fontSize: 18, color: 'var(--text-secondary)' }}>🔍</span>
        <input
          type="text"
          placeholder="Search by name, village, district, or ASHA worker…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 16,
              color: 'var(--text-secondary)',
              padding: 4,
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Results count */}
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
        Showing {filteredAndSorted.length} of {patients.length} patients
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}></th>
              <SortHeader field="name">Name</SortHeader>
              <th>Village</th>
              <th>District</th>
              <SortHeader field="gestational_age_weeks">GA (Weeks)</SortHeader>
              <th>Last Visit</th>
              <SortHeader field="risk_label">Risk</SortHeader>
              <th>ASHA Worker</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.map((patient, idx) => (
              <tr
                key={patient.id}
                className="animate-fade-in-up"
                style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
              >
                {/* Avatar — ASHAShield style */}
                <td>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      background: `${patient.risk_label === 'HIGH' ? 'var(--risk-high)' : patient.risk_label === 'MODERATE' ? 'var(--risk-moderate)' : 'var(--primary)'}18`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 14,
                      fontWeight: 700,
                      color: patient.risk_label === 'HIGH' ? 'var(--risk-high)' : patient.risk_label === 'MODERATE' ? 'var(--risk-moderate)' : 'var(--primary)',
                    }}
                  >
                    {patient.name ? patient.name[0].toUpperCase() : '?'}
                  </div>
                </td>
                <td style={{ fontWeight: 600 }}>{patient.name}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{patient.village}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{patient.district}</td>
                <td>
                  <span
                    style={{
                      background: patient.gestational_age_weeks >= 36 ? 'var(--risk-moderate-bg)' : 'var(--bg)',
                      color: patient.gestational_age_weeks >= 36 ? 'var(--risk-moderate)' : 'var(--text-primary)',
                      padding: '3px 10px',
                      borderRadius: 'var(--radius-full)',
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    {patient.gestational_age_weeks}w
                  </span>
                </td>
                <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{patient.last_visit}</td>
                <td>
                  <span className={`risk-badge ${patient.risk_label?.toLowerCase()}`}>
                    {patient.risk_label}
                  </span>
                </td>
                <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{patient.asha_worker}</td>
                <td>
                  <button
                    onClick={() => onViewPatient && onViewPatient(patient)}
                    style={{
                      background: 'none',
                      border: '1.5px solid var(--primary)',
                      color: 'var(--primary)',
                      padding: '5px 14px',
                      borderRadius: 'var(--radius-full)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={e => {
                      e.target.style.background = 'var(--primary)';
                      e.target.style.color = 'white';
                    }}
                    onMouseLeave={e => {
                      e.target.style.background = 'none';
                      e.target.style.color = 'var(--primary)';
                    }}
                    id={`view-patient-${patient.id}`}
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredAndSorted.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>👤</div>
            <div>{searchQuery ? 'No patients match your search.' : 'No patients in this category.'}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PatientRiskTable;