import { useState } from 'react';
import { Save, Plus, Trash2, Clock, Info } from 'lucide-react';
import { useAppStore } from '../store';
import toast from 'react-hot-toast';
import type { School, PeriodTiming, LunchBreak } from '../types';

export default function SchoolSetup() {
  const { school, setSchool } = useAppStore();

  const defaultTimings: PeriodTiming[] = Array.from({ length: 8 }, (_, i) => ({
    period: i + 1,
    start_time: `${8 + Math.floor((i * 45) / 60)}:${String((i * 45) % 60).padStart(2, '0')}`,
    end_time: `${8 + Math.floor(((i + 1) * 45) / 60)}:${String(((i + 1) * 45) % 60).padStart(2, '0')}`,
  }));

  const [form, setForm] = useState({
    name: school?.name || '',
    academic_year: school?.academic_year || '2024-2025',
    working_days: school?.working_days || ('MON_FRI' as const),
    periods_per_day: school?.periods_per_day || 8,
    period_timings: school?.period_timings || defaultTimings,
    lunch_break: school?.lunch_break || { after_period: 4, start_time: '12:00', end_time: '12:45' },
  });

  const handlePeriodsChange = (n: number) => {
    const newTimings = Array.from({ length: n }, (_, i) => {
      return form.period_timings[i] || {
        period: i + 1,
        start_time: `${8 + Math.floor((i * 45) / 60)}:${String((i * 45) % 60).padStart(2, '0')}`,
        end_time: `${8 + Math.floor(((i + 1) * 45) / 60)}:${String(((i + 1) * 45) % 60).padStart(2, '0')}`,
      };
    });
    setForm({ ...form, periods_per_day: n, period_timings: newTimings });
  };

  const updateTiming = (index: number, field: keyof PeriodTiming, value: string | number) => {
    const newTimings = [...form.period_timings];
    newTimings[index] = { ...newTimings[index], [field]: value };
    setForm({ ...form, period_timings: newTimings });
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error('Please enter a school name');
      return;
    }

    const schoolData: School = {
      id: school?.id || crypto.randomUUID(),
      user_id: 'current-user',
      ...form,
      created_at: school?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setSchool(schoolData);
    toast.success('School settings saved successfully!');
  };

  return (
    <div className="animate-fade-in max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="section-header">School Setup</h1>
        <p className="section-subtitle">Configure your school's basic information and timetable structure.</p>
      </div>

      {/* Basic Info */}
      <div className="form-section">
        <h2 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
          <Info size={18} className="text-primary-400" />
          Basic Information
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="label">School Name *</label>
            <input
              id="school-name"
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., GHSS Trivandrum"
              className="input-field"
            />
          </div>
          <div>
            <label className="label">Academic Year</label>
            <input
              id="academic-year"
              type="text"
              value={form.academic_year}
              onChange={e => setForm({ ...form, academic_year: e.target.value })}
              placeholder="e.g., 2024-2025"
              className="input-field"
            />
          </div>
        </div>
      </div>

      {/* Working Days */}
      <div className="form-section">
        <h2 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
          <Clock size={18} className="text-primary-400" />
          Working Schedule
        </h2>
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="label">Working Days</label>
            <div className="flex gap-3">
              {(['MON_FRI', 'MON_SAT'] as const).map(option => (
                <button
                  key={option}
                  id={`days-${option}`}
                  onClick={() => setForm({ ...form, working_days: option })}
                  className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-all ${
                    form.working_days === option
                      ? 'border-primary-500 bg-primary-500/15 text-primary-300'
                      : 'border-white/10 bg-white/3 text-white/60 hover:bg-white/5'
                  }`}
                >
                  {option === 'MON_FRI' ? 'Mon – Fri' : 'Mon – Sat'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Periods Per Day</label>
            <div className="flex items-center gap-3">
              <input
                id="periods-per-day"
                type="number"
                min={4}
                max={12}
                value={form.periods_per_day}
                onChange={e => handlePeriodsChange(Number(e.target.value))}
                className="input-field w-28"
              />
              <span className="text-white/40 text-sm">periods (4–12)</span>
            </div>
          </div>
        </div>

        {/* Lunch Break */}
        <div className="p-4 glass rounded-xl">
          <h3 className="text-sm font-semibold text-white/80 mb-3">Lunch Break</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">After Period</label>
              <select
                id="lunch-after-period"
                value={form.lunch_break.after_period}
                onChange={e => setForm({ ...form, lunch_break: { ...form.lunch_break, after_period: Number(e.target.value) } })}
                className="input-field"
              >
                {Array.from({ length: form.periods_per_day - 1 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>After Period {i + 1}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Start Time</label>
              <input
                id="lunch-start"
                type="time"
                value={form.lunch_break.start_time}
                onChange={e => setForm({ ...form, lunch_break: { ...form.lunch_break, start_time: e.target.value } })}
                className="input-field"
              />
            </div>
            <div>
              <label className="label">End Time</label>
              <input
                id="lunch-end"
                type="time"
                value={form.lunch_break.end_time}
                onChange={e => setForm({ ...form, lunch_break: { ...form.lunch_break, end_time: e.target.value } })}
                className="input-field"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Period Timings */}
      <div className="form-section">
        <h2 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
          <Clock size={18} className="text-accent-400" />
          Period Timings
        </h2>
        <div className="space-y-2">
          {form.period_timings.map((timing, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-white/3 rounded-xl">
              <div className="w-20 text-sm font-medium text-white/70">Period {timing.period}</div>
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="time"
                  value={timing.start_time}
                  onChange={e => updateTiming(i, 'start_time', e.target.value)}
                  className="input-field text-sm py-2"
                  id={`period-${i + 1}-start`}
                />
                <span className="text-white/30">—</span>
                <input
                  type="time"
                  value={timing.end_time}
                  onChange={e => updateTiming(i, 'end_time', e.target.value)}
                  className="input-field text-sm py-2"
                  id={`period-${i + 1}-end`}
                />
              </div>
              <input
                type="text"
                value={timing.label || ''}
                onChange={e => updateTiming(i, 'label', e.target.value)}
                placeholder="Label (optional)"
                className="input-field text-sm py-2 w-36"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <button
        id="save-school"
        onClick={handleSave}
        className="btn-primary flex items-center gap-2"
      >
        <Save size={18} />
        Save School Settings
      </button>
    </div>
  );
}
