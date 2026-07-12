import { useState } from 'react';
import { Download, Lock, QrCode, CreditCard, CheckCircle, Printer, X } from 'lucide-react';
import { useAppStore } from '../store';
import { getSubjectColorClass } from '../lib/algorithm';
import { exportTimetablePDF, exportTeacherTimetablePDF } from '../lib/exportPdf';
import { exportTimetableExcel, exportTimetableCSV } from '../lib/exportExcel';
import toast from 'react-hot-toast';
import type { DayOfWeek } from '../types';

const DAYS_LABEL: Record<DayOfWeek, string> = {
  MON: 'Monday',
  TUE: 'Tuesday',
  WED: 'Wednesday',
  THU: 'Thursday',
  FRI: 'Friday',
  SAT: 'Saturday',
};

type ViewMode = 'class' | 'teacher' | 'subject';

export default function TimetableView() {
  const {
    school, classes, subjects, teachers, timetableMatrix,
    timetableStatus, setTimetableStatus,
  } = useAppStore();

  const [viewMode, setViewMode] = useState<ViewMode>('class');
  const [selectedClass, setSelectedClass] = useState(classes[0]?.id || '');
  const [selectedTeacher, setSelectedTeacher] = useState(teachers[0]?.id || '');
  const [selectedSubject, setSelectedSubject] = useState(subjects[0]?.id || '');
  const [showPayment, setShowPayment] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'info' | 'qr' | 'verify'>('info');
  const [txnId, setTxnId] = useState('');

  if (!timetableMatrix || timetableStatus === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
        <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
          <Printer size={32} className="text-white/20" />
        </div>
        <p className="text-white/50 text-lg mb-2">No timetable generated yet.</p>
        <p className="text-white/30 text-sm">Go to the Generate page to create your timetable.</p>
      </div>
    );
  }

  const days: DayOfWeek[] = school?.working_days === 'MON_SAT'
    ? ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
    : ['MON', 'TUE', 'WED', 'THU', 'FRI'];
  const periods = school ? Array.from({ length: school.periods_per_day }, (_, i) => i + 1) : [1, 2, 3, 4, 5, 6, 7, 8];

  const getSubjectName = (id?: string) => {
    if (!id) return '';
    if (id === 'FREE') return 'Free';
    if (id === 'LUNCH') return '🍱 Lunch';
    if (id === 'ASSEMBLY') return '🎺 Assembly';
    return subjects.find(s => s.id === id)?.name || id;
  };

  const getTeacherCode = (id?: string) => {
    if (!id) return '';
    return teachers.find(t => t.id === id)?.code || '';
  };

  const getSubjectCode = (id?: string) => {
    if (!id) return '';
    if (['FREE', 'LUNCH', 'ASSEMBLY'].includes(id)) return id;
    return subjects.find(s => s.id === id)?.code || '';
  };

  const getSubjectCategory = (id?: string) => {
    if (!id) return undefined;
    return subjects.find(s => s.id === id)?.category;
  };

  const isPaid = timetableStatus === 'paid';

  const handleVerifyPayment = () => {
    if (!txnId.trim() || txnId.length < 8) {
      toast.error('Please enter a valid transaction ID');
      return;
    }
    // In production, verify with backend
    setTimetableStatus('paid');
    setShowPayment(false);
    setPaymentStep('info');
    toast.success('🎉 Payment verified! Downloads unlocked!');
  };

  const handleExport = (type: 'pdf' | 'excel' | 'csv' | 'teacher-pdf') => {
    if (!isPaid) { setShowPayment(true); return; }
    if (!school) return;

    const opts = { matrix: timetableMatrix, classes, subjects, teachers, school };
    if (type === 'pdf') exportTimetablePDF(opts);
    else if (type === 'excel') exportTimetableExcel(opts);
    else if (type === 'csv') exportTimetableCSV(opts);
    else if (type === 'teacher-pdf') exportTeacherTimetablePDF(opts);

    toast.success('Download started!');
  };

  const handlePrint = () => window.print();

  // ===== CLASS VIEW =====
  const renderClassView = () => {
    const cls = classes.find(c => c.id === selectedClass);
    if (!cls) return null;

    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] border-collapse">
          <thead>
            <tr>
              <th className="timetable-cell timetable-header w-24 rounded-tl-lg">Day \ Period</th>
              {periods.map(p => {
                const timing = school?.period_timings[p - 1];
                return (
                  <th key={p} className="timetable-cell timetable-header">
                    <div>P{p}</div>
                    {timing && <div className="text-[10px] font-normal opacity-60">{timing.start_time}</div>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {days.map((day, di) => (
              <tr key={day}>
                <td className={`timetable-cell font-semibold text-white/70 bg-dark-700/50 ${di === days.length - 1 ? 'rounded-bl-lg' : ''}`}>
                  {day}
                </td>
                {periods.map(period => {
                  const slot = timetableMatrix[cls.id]?.[day]?.[period];
                  const colorClass = getSubjectColorClass(getSubjectCategory(slot?.subjectId), slot?.subjectId);
                  const isEmpty = !slot || slot.subjectId === 'FREE';
                  return (
                    <td key={period} className="timetable-cell p-1.5">
                      {slot ? (
                        <div className={`timetable-subject ${colorClass} ${isEmpty ? 'opacity-30' : ''}`}>
                          <div className="font-semibold">{getSubjectCode(slot.subjectId)}</div>
                          {slot.teacherId && (
                            <div className="text-[10px] opacity-80 mt-0.5">{getTeacherCode(slot.teacherId)}</div>
                          )}
                        </div>
                      ) : (
                        <div className="text-white/20 text-xs">—</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // ===== TEACHER VIEW =====
  const renderTeacherView = () => {
    const teacher = teachers.find(t => t.id === selectedTeacher);
    if (!teacher) return null;

    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] border-collapse">
          <thead>
            <tr>
              <th className="timetable-cell timetable-header w-24 rounded-tl-lg">Day \ Period</th>
              {periods.map(p => <th key={p} className="timetable-cell timetable-header">P{p}</th>)}
            </tr>
          </thead>
          <tbody>
            {days.map((day, di) => (
              <tr key={day}>
                <td className={`timetable-cell font-semibold text-white/70 bg-dark-700/50 ${di === days.length - 1 ? 'rounded-bl-lg' : ''}`}>
                  {day}
                </td>
                {periods.map(period => {
                  let cellContent = null;
                  for (const cls of classes) {
                    const slot = timetableMatrix[cls.id]?.[day]?.[period];
                    if (slot?.teacherId === teacher.id) {
                      const colorClass = getSubjectColorClass(getSubjectCategory(slot.subjectId), slot.subjectId);
                      cellContent = (
                        <div className={`timetable-subject ${colorClass}`}>
                          <div className="font-semibold">{getSubjectCode(slot.subjectId)}</div>
                          <div className="text-[10px] opacity-80 mt-0.5">{cls.name}</div>
                        </div>
                      );
                      break;
                    }
                  }
                  return (
                    <td key={period} className="timetable-cell p-1.5">
                      {cellContent || <div className="text-white/20 text-xs">Free</div>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // ===== SUBJECT VIEW =====
  const renderSubjectView = () => {
    const subject = subjects.find(s => s.id === selectedSubject);
    if (!subject) return null;

    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="timetable-cell timetable-header w-24">Class \ Day</th>
              {days.map(d => <th key={d} className="timetable-cell timetable-header">{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {classes.map((cls, ci) => (
              <tr key={cls.id}>
                <td className="timetable-cell font-semibold text-white/70 bg-dark-700/50">{cls.name}</td>
                {days.map(day => {
                  const periodsForSubject: number[] = [];
                  periods.forEach(p => {
                    const slot = timetableMatrix[cls.id]?.[day]?.[p];
                    if (slot?.subjectId === subject.id) periodsForSubject.push(p);
                  });
                  return (
                    <td key={day} className="timetable-cell p-1.5">
                      {periodsForSubject.length > 0 ? (
                        <div className={`timetable-subject ${subject.color_class}`}>
                          <div>P{periodsForSubject.join(', ')}</div>
                          {(() => {
                            const slot = timetableMatrix[cls.id]?.[day]?.[periodsForSubject[0]];
                            return slot?.teacherId ? <div className="text-[10px] opacity-80">{getTeacherCode(slot.teacherId)}</div> : null;
                          })()}
                        </div>
                      ) : (
                        <div className="text-white/20 text-xs">—</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="section-header">Timetable View</h1>
          <p className="section-subtitle">{school?.name} · {school?.academic_year}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handlePrint} className="btn-secondary flex items-center gap-2 text-sm no-print">
            <Printer size={16} />
            Print
          </button>
          {[
            { label: 'PDF', id: 'export-pdf', type: 'pdf' as const, icon: Download },
            { label: 'Excel', id: 'export-excel', type: 'excel' as const, icon: Download },
            { label: 'CSV', id: 'export-csv', type: 'csv' as const, icon: Download },
            { label: 'Teacher PDF', id: 'export-teacher-pdf', type: 'teacher-pdf' as const, icon: Download },
          ].map(btn => (
            <button
              key={btn.type}
              id={btn.id}
              onClick={() => handleExport(btn.type)}
              className={`flex items-center gap-2 text-sm px-4 py-2 rounded-xl border font-medium transition-all no-print ${
                isPaid
                  ? 'border-primary-500/30 bg-primary-500/10 text-primary-300 hover:bg-primary-500/20'
                  : 'border-white/10 bg-white/5 text-white/50 hover:bg-white/10'
              }`}
            >
              {isPaid ? <btn.icon size={14} /> : <Lock size={14} />}
              {btn.label}
            </button>
          ))}
          {!isPaid && (
            <button
              id="unlock-downloads"
              onClick={() => setShowPayment(true)}
              className="btn-accent flex items-center gap-2 text-sm no-print"
            >
              <CreditCard size={16} />
              Unlock Downloads (₹20)
            </button>
          )}
        </div>
      </div>

      {!isPaid && (
        <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-sm text-yellow-300 flex items-center gap-2 no-print">
          <Lock size={14} />
          Your timetable is ready! Pay ₹20 to unlock PDF and Excel downloads.
        </div>
      )}

      {isPaid && (
        <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-sm text-green-300 flex items-center gap-2 no-print">
          <CheckCircle size={14} />
          Downloads unlocked! All export formats available.
        </div>
      )}

      {/* View Mode Tabs */}
      <div className="flex gap-1 p-1 bg-dark-800 rounded-xl mb-4 w-fit no-print">
        {(['class', 'teacher', 'subject'] as ViewMode[]).map(mode => (
          <button
            key={mode}
            id={`view-${mode}`}
            onClick={() => setViewMode(mode)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
              viewMode === mode
                ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30'
                : 'text-white/50 hover:text-white'
            }`}
          >
            {mode}-wise
          </button>
        ))}
      </div>

      {/* Selector */}
      <div className="mb-4 no-print">
        {viewMode === 'class' && (
          <select id="select-class" value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="input-field w-48">
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        {viewMode === 'teacher' && (
          <select id="select-teacher" value={selectedTeacher} onChange={e => setSelectedTeacher(e.target.value)} className="input-field w-48">
            {teachers.map(t => <option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}
          </select>
        )}
        {viewMode === 'subject' && (
          <select id="select-subject" value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} className="input-field w-48">
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      {/* Timetable Grid */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="p-2">
          {viewMode === 'class' && renderClassView()}
          {viewMode === 'teacher' && renderTeacherView()}
          {viewMode === 'subject' && renderSubjectView()}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-4 no-print">
        {subjects.slice(0, 8).map(s => (
          <div key={s.id} className="flex items-center gap-1.5 text-xs text-white/60">
            <div className={`w-3 h-3 rounded ${s.color_class}`} />
            <span>{s.code} = {s.name}</span>
          </div>
        ))}
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-strong rounded-3xl p-8 w-full max-w-md mx-4 relative animate-slide-up">
            <button
              onClick={() => { setShowPayment(false); setPaymentStep('info'); }}
              className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg text-white/50"
            >
              <X size={18} />
            </button>

            {paymentStep === 'info' && (
              <>
                <div className="text-center mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center mx-auto mb-4">
                    <CreditCard size={28} className="text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-white mb-1">Unlock Downloads</h2>
                  <p className="text-white/50 text-sm">One-time payment for this timetable</p>
                </div>
                <div className="bg-white/5 rounded-2xl p-4 mb-6">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-white/60">Timetable Download Unlock</span>
                    <span className="text-white font-semibold">₹20</span>
                  </div>
                  <div className="text-xs text-white/40">Includes: PDF, Excel, CSV, Teacher-wise PDF</div>
                  <div className="divider" />
                  <div className="flex justify-between font-bold">
                    <span className="text-white">Total</span>
                    <span className="gradient-text text-lg">₹20</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <button
                    id="pay-upi"
                    onClick={() => setPaymentStep('qr')}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    <QrCode size={18} />
                    Pay via UPI / QR Code
                  </button>
                  <button
                    id="pay-razorpay"
                    onClick={() => {
                      // Razorpay integration placeholder
                      toast('Razorpay integration requires backend setup.', { icon: '💳' });
                    }}
                    className="btn-secondary w-full flex items-center justify-center gap-2"
                  >
                    <CreditCard size={18} />
                    Pay via Razorpay (Card/Net Banking)
                  </button>
                </div>
              </>
            )}

            {paymentStep === 'qr' && (
              <>
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold text-white mb-1">Scan & Pay ₹20</h2>
                  <p className="text-white/50 text-sm">Use Google Pay, PhonePe, or any UPI app</p>
                </div>
                {/* QR Code Placeholder */}
                <div className="flex justify-center mb-6">
                  <div className="w-48 h-48 bg-white rounded-2xl flex items-center justify-center p-4">
                    <div className="text-center">
                      <QrCode size={80} className="text-dark-900 mx-auto mb-2" />
                      <p className="text-dark-900 text-xs font-medium">UPI: timetableai@upi</p>
                      <p className="text-dark-900 text-lg font-bold">₹20</p>
                    </div>
                  </div>
                </div>
                <p className="text-center text-xs text-white/40 mb-4">
                  UPI ID: <strong className="text-white/70">timetableai@upi</strong>
                </p>
                <button
                  id="done-payment"
                  onClick={() => setPaymentStep('verify')}
                  className="btn-primary w-full"
                >
                  I've Completed Payment
                </button>
              </>
            )}

            {paymentStep === 'verify' && (
              <>
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold text-white mb-1">Enter Transaction ID</h2>
                  <p className="text-white/50 text-sm">Enter the UPI transaction ID from your payment app</p>
                </div>
                <div className="mb-4">
                  <label className="label">Transaction ID *</label>
                  <input
                    id="txn-id"
                    type="text"
                    value={txnId}
                    onChange={e => setTxnId(e.target.value)}
                    placeholder="e.g., 123456789012 or UPI123ABC"
                    className="input-field"
                  />
                </div>
                <button
                  id="verify-payment"
                  onClick={handleVerifyPayment}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <CheckCircle size={18} />
                  Verify & Unlock Downloads
                </button>
                <button
                  onClick={() => setPaymentStep('qr')}
                  className="w-full text-center text-sm text-white/40 hover:text-white/70 mt-3 transition-colors"
                >
                  ← Back to QR
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
