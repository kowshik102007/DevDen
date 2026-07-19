import { useTriage } from '../context/TriageContext';
import { useNavigate } from 'react-router-dom';
import { Users, Stethoscope, Download } from 'lucide-react';

export default function PatientsPage() {
  const { patients } = useTriage();
  const navigate = useNavigate();

  const severityOrder = { red: 0, yellow: 1, green: 2, black: 3 };
  const sorted = [...patients].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title" id="patients-title">Patient Registry</h1>
          <p className="page-subtitle">{patients.length} patients triaged • Sorted by severity</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" id="export-btn">
            <Download size={16} /> Export CSV
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/triage')} id="add-patient-btn">
            <Stethoscope size={16} /> New Triage
          </button>
        </div>
      </div>

      {patients.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-text">No patients in registry</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              Start triaging patients to build the registry
            </div>
            <button className="btn btn-primary" onClick={() => navigate('/triage')}>
              <Stethoscope size={16} /> Begin Triage
            </button>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="patient-table" id="patients-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: 24 }}>Severity</th>
                  <th>Patient ID</th>
                  <th>Name</th>
                  <th>Age/Gender</th>
                  <th>Injury</th>
                  <th>Priority</th>
                  <th>Hospital</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(p => (
                  <tr key={p.id}>
                    <td style={{ paddingLeft: 24 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className={`severity-indicator ${p.severity}`}></div>
                        <span className={`badge badge-${p.severity}`}>
                          {p.severityLabel || p.severity}
                        </span>
                      </div>
                    </td>
                    <td><span className="patient-id">{p.id}</span></td>
                    <td style={{ fontWeight: 600 }}>{p.name || 'Unknown'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {p.age || '?'} / {p.gender || '?'}
                    </td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                      {p.injuryType || 'Assessment pending'}
                    </td>
                    <td>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: p.priorityScore >= 7 ? 'var(--severity-red)' : p.priorityScore >= 4 ? 'var(--severity-yellow)' : 'var(--severity-green)' }}>
                        {p.priorityScore?.toFixed(1) || '—'}
                      </span>
                    </td>
                    <td style={{ fontSize: 13 }}>{p.assignedHospital || 'Pending'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
