import { useState } from 'react';
import { Zap, AlertTriangle, CheckCircle, RefreshCw, Eye, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import { generateTimetable, verifyTimetable } from '../lib/algorithm';
import toast from 'react-hot-toast';
import type { ConstraintViolation } from '../types';

export default function TimetableGenerator() {
  const navigate = useNavigate();
  const {
    school, classes, subjects, teachers, classSubjects, teacherAvailability,
    setTimetableMatrix, setViolations, setTimetableStatus, timetableStatus,
  } = useAppStore();

  const [isGenerating, setIsGenerating] = useState(false);
  const [localViolations, setLocalViolations] = useState<ConstraintViolation[]>([]);
  const [stats, setStats] = useState<{ totalSlotsFilled: number; totalSlotsExpected: number; completionPercent: number } | null>(null);

  const prerequisites = [
    { label: 'School Setup', ok: !!school, fix: '/setup' },
    { label: 'Classes Added', ok: classes.length > 0, fix: '/classes' },
    { label: 'Subjects Added', ok: subjects.length > 0, fix: '/subjects' },
    { label: 'Teachers Added', ok: teachers.length > 0, fix: '/teachers' },
    { label: 'Subject Assignments', ok: classSubjects.length > 0, fix: '/subjects' },
  ];

  const allReady = prerequisites.every(p => p.ok);

  const handleGenerate = async () => {
    if (!allReady || !school) {
      toast.error('Please complete all setup steps first');
      return;
    }

    setIsGenerating(true);
    setTimetableStatus('generating');

    try {
      // Simulate processing time for better UX
      await new Promise(r => setTimeout(r, 1500));

      const result = generateTimetable({
        school,
        classes,
        subjects,
        teachers,
        classSubjects,
        teacherAvailability,
      });

      setTimetableMatrix(result.matrix);
      setLocalViolations(result.violations);
      setViolations(result.violations);
      setStats(result.stats);
      setTimetableStatus('generated');

      if (result.violations.filter(v => v.severity === 'error').length > 0) {
        toast.error(`Timetable generated with ${result.violations.length} issues. Please review.`);
      } else {
        toast.success('✅ Clash-free timetable generated!');
      }
    } catch (error) {
      toast.error('Generation failed. Please try again.');
      setTimetableStatus('idle');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerate = () => {
    setTimetableStatus('idle');
    setLocalViolations([]);
    setStats(null);
    handleGenerate();
  };

  const errors = localViolations.filter(v => v.severity === 'error');
  const warnings = localViolations.filter(v => v.severity === 'warning');

  return (
    <div className="animate-fade-in max-w-4xl">
      <div className="mb-8">
        <h1 className="section-header">Timetable Generator</h1>
        <p className="section-subtitle">Run the constraint-satisfaction algorithm to create your clash-free timetable.</p>
      </div>

      {/* Prerequisites Check */}
      <div className="form-section mb-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <CheckCircle size={18} className="text-primary-400" />
          Pre-Generation Checklist
        </h2>
        <div className="space-y-2">
          {prerequisites.map(p => (
            <div key={p.label} className={`flex items-center justify-between p-3 rounded-xl border ${
              p.ok ? 'border-green-500/20 bg-green-500/5' : 'border-yellow-500/20 bg-yellow-500/5'
            }`}>
              <div className="flex items-center gap-3">
                {p.ok
                  ? <CheckCircle size={16} className="text-green-400" />
                  : <AlertTriangle size={16} className="text-yellow-400" />
                }
                <span className={`text-sm font-medium ${p.ok ? 'text-green-300' : 'text-yellow-300'}`}>
                  {p.label}
                </span>
              </div>
              {!p.ok && (
                <button onClick={() => navigate(p.fix)} className="text-xs text-yellow-400 hover:text-yellow-300 flex items-center gap-1">
                  Complete <ArrowRight size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      {allReady && (
        <div className="form-section mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Generation Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Classes', value: classes.length },
              { label: 'Subjects', value: subjects.length },
              { label: 'Teachers', value: teachers.length },
              { label: 'Assignments', value: classSubjects.length },
            ].map(item => (
              <div key={item.label} className="bg-white/3 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-white">{item.value}</div>
                <div className="text-xs text-white/40 mt-1">{item.label}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 glass rounded-xl text-sm text-white/60">
            <p>📅 <strong className="text-white">{school?.working_days === 'MON_SAT' ? '6' : '5'} working days</strong> per week</p>
            <p>⏱️ <strong className="text-white">{school?.periods_per_day}</strong> periods per day</p>
            <p>🍱 Lunch break after Period <strong className="text-white">{school?.lunch_break?.after_period}</strong></p>
          </div>
        </div>
      )}

      {/* Generate Button */}
      <div className="flex gap-4 mb-8">
        <button
          id="generate-timetable"
          onClick={handleGenerate}
          disabled={!allReady || isGenerating}
          className={`btn-primary flex items-center gap-2 text-lg px-8 py-4 ${(!allReady || isGenerating) ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isGenerating ? (
            <>
              <RefreshCw size={20} className="animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Zap size={20} />
              Generate Timetable
            </>
          )}
        </button>

        {timetableStatus === 'generated' && (
          <>
            <button onClick={handleRegenerate} disabled={isGenerating} className="btn-secondary flex items-center gap-2">
              <RefreshCw size={18} />
              Regenerate
            </button>
            <button id="view-generated" onClick={() => navigate('/timetable')} className="btn-accent flex items-center gap-2">
              <Eye size={18} />
              View Timetable
            </button>
          </>
        )}
      </div>

      {/* Generation Progress Bar */}
      {isGenerating && (
        <div className="form-section mb-6 animate-fade-in">
          <p className="text-sm text-white/60 mb-3">Running constraint satisfaction algorithm...</p>
          <div className="w-full bg-white/5 rounded-full h-2">
            <div className="h-2 rounded-full bg-gradient-to-r from-primary-500 to-accent-500 shimmer" style={{ width: '100%' }} />
          </div>
          <p className="text-xs text-white/40 mt-2">Checking: no teacher clashes · fulfilling weekly periods · balancing workload...</p>
        </div>
      )}

      {/* Results */}
      {stats && timetableStatus === 'generated' && (
        <div className="form-section mb-6 animate-slide-up">
          <h2 className="text-lg font-semibold text-white mb-4">Generation Results</h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-white/3 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-white">{stats.completionPercent}%</div>
              <div className="text-xs text-white/40 mt-1">Completion</div>
            </div>
            <div className="bg-white/3 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-green-400">{stats.totalSlotsFilled}</div>
              <div className="text-xs text-white/40 mt-1">Slots Filled</div>
            </div>
            <div className="bg-white/3 rounded-xl p-4 text-center">
              <div className={`text-2xl font-bold ${errors.length > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {errors.length}
              </div>
              <div className="text-xs text-white/40 mt-1">Critical Errors</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-white/5 rounded-full h-3 mb-6">
            <div
              className={`h-3 rounded-full transition-all duration-700 ${
                stats.completionPercent === 100 ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gradient-to-r from-primary-500 to-accent-500'
              }`}
              style={{ width: `${stats.completionPercent}%` }}
            />
          </div>

          {/* Violations */}
          {localViolations.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-white/80 mb-3">Verification Results</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {errors.map((v, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm">
                    <AlertTriangle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
                    <span className="text-red-300">{v.message}</span>
                  </div>
                ))}
                {warnings.map((v, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-sm">
                    <AlertTriangle size={14} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                    <span className="text-yellow-300">{v.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {localViolations.length === 0 && (
            <div className="flex items-center gap-2 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
              <CheckCircle size={20} className="text-green-400" />
              <span className="text-green-300 font-medium">Perfect! No clashes or missing periods detected.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
