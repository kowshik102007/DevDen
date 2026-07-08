import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, Settings, GraduationCap, BookOpen, Users,
  Calendar, CheckCircle, AlertTriangle, TrendingUp, Zap
} from 'lucide-react';
import { useAppStore, useAuthStore } from '../store';

const steps = [
  { path: '/setup', icon: Settings, label: 'School Setup', desc: 'Configure your school settings, periods, and timings.' },
  { path: '/classes', icon: GraduationCap, label: 'Classes', desc: 'Add all classes and divisions.' },
  { path: '/subjects', icon: BookOpen, label: 'Subjects', desc: 'Add subjects with weekly period requirements.' },
  { path: '/teachers', icon: Users, label: 'Teachers', desc: 'Add teachers with subject and class assignments.' },
  { path: '/generate', icon: Calendar, label: 'Generate', desc: 'Run the algorithm to generate your timetable.' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { school, classes, subjects, teachers, classSubjects, timetableStatus } = useAppStore();

  const completedSteps = [
    !!school,
    classes.length > 0,
    subjects.length > 0,
    teachers.length > 0,
    timetableStatus !== 'idle',
  ];

  const completionCount = completedSteps.filter(Boolean).length;

  const stats = [
    { label: 'Classes', value: classes.length, icon: GraduationCap, color: 'from-blue-500 to-cyan-500' },
    { label: 'Subjects', value: subjects.length, icon: BookOpen, color: 'from-purple-500 to-pink-500' },
    { label: 'Teachers', value: teachers.length, icon: Users, color: 'from-green-500 to-emerald-500' },
    { label: 'Assignments', value: classSubjects.length, icon: Calendar, color: 'from-orange-500 to-red-500' },
  ];

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-white mb-1">
            Welcome back, {user?.name?.split(' ')[0]}! 👋
          </h1>
          <p className="text-white/50">
            {school ? `Managing ${school.name}` : 'Let\'s set up your school to get started.'}
          </p>
        </div>
        {timetableStatus === 'generated' || timetableStatus === 'paid' ? (
          <button
            onClick={() => navigate('/timetable')}
            id="view-timetable-btn"
            className="btn-primary flex items-center gap-2"
          >
            <Zap size={18} />
            View Timetable
          </button>
        ) : (
          <button
            onClick={() => navigate('/generate')}
            id="generate-btn"
            className="btn-accent flex items-center gap-2"
            disabled={completionCount < 4}
          >
            <Zap size={18} />
            Generate Timetable
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(stat => (
          <div key={stat.label} className="stat-card">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center flex-shrink-0`}>
              <stat.icon size={20} className="text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="text-white/50 text-xs">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div className="card mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white">Setup Progress</h2>
          <span className="badge-primary">{completionCount}/{steps.length} steps</span>
        </div>
        <div className="w-full bg-white/5 rounded-full h-2 mb-6">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-primary-500 to-accent-500 transition-all duration-700"
            style={{ width: `${(completionCount / steps.length) * 100}%` }}
          />
        </div>
        <div className="grid md:grid-cols-5 gap-3">
          {steps.map((step, i) => (
            <button
              key={step.path}
              id={`step-${i + 1}`}
              onClick={() => navigate(step.path)}
              className={`flex flex-col gap-2 p-4 rounded-xl border transition-all duration-200 text-left
                ${completedSteps[i]
                  ? 'border-green-500/30 bg-green-500/5 hover:bg-green-500/10'
                  : 'border-white/10 bg-white/3 hover:bg-white/5'
                }`}
            >
              <div className="flex items-center justify-between">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                  ${completedSteps[i]
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-white/5 text-white/40'
                  }`}>
                  {completedSteps[i]
                    ? <CheckCircle size={16} />
                    : <step.icon size={16} />
                  }
                </div>
                <ArrowRight size={14} className="text-white/20" />
              </div>
              <div>
                <p className={`text-sm font-medium ${completedSteps[i] ? 'text-green-300' : 'text-white/80'}`}>
                  {step.label}
                </p>
                <p className="text-xs text-white/40 mt-0.5">{step.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Actions + Info */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="card">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-primary-400" />
            Quick Actions
          </h2>
          <div className="space-y-2">
            {[
              { label: 'Add New Class', path: '/classes', icon: GraduationCap },
              { label: 'Add New Subject', path: '/subjects', icon: BookOpen },
              { label: 'Add New Teacher', path: '/teachers', icon: Users },
              { label: 'Configure School', path: '/setup', icon: Settings },
            ].map(action => (
              <button
                key={action.path}
                onClick={() => navigate(action.path)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors text-left group"
              >
                <div className="w-8 h-8 rounded-lg bg-primary-500/10 flex items-center justify-center">
                  <action.icon size={16} className="text-primary-400" />
                </div>
                <span className="text-sm text-white/70 group-hover:text-white transition-colors">{action.label}</span>
                <ArrowRight size={14} className="ml-auto text-white/20 group-hover:text-white/60 transition-colors" />
              </button>
            ))}
          </div>
        </div>

        {/* Timetable Status */}
        <div className="card">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Calendar size={18} className="text-accent-400" />
            Timetable Status
          </h2>
          {timetableStatus === 'idle' && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                <Calendar size={28} className="text-white/20" />
              </div>
              <p className="text-white/50 text-sm mb-4">No timetable generated yet.</p>
              <button
                onClick={() => navigate('/generate')}
                disabled={completionCount < 4}
                className="btn-primary text-sm"
              >
                Generate Now
              </button>
              {completionCount < 4 && (
                <p className="text-yellow-400/70 text-xs mt-2 flex items-center gap-1">
                  <AlertTriangle size={12} />
                  Complete all setup steps first
                </p>
              )}
            </div>
          )}

          {(timetableStatus === 'generated' || timetableStatus === 'paid') && (
            <div>
              <div className={`flex items-center gap-2 mb-4 p-3 rounded-xl 
                ${timetableStatus === 'paid' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-primary-500/10 text-primary-400 border border-primary-500/20'}`}
              >
                <CheckCircle size={18} />
                <span className="text-sm font-medium">
                  {timetableStatus === 'paid' ? 'Timetable Generated & Unlocked!' : 'Timetable Generated'}
                </span>
              </div>
              <button
                onClick={() => navigate('/timetable')}
                className="btn-primary w-full"
              >
                View Full Timetable
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
