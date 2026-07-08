import { useState } from 'react';
import { Plus, Trash2, Users, ChevronDown, ChevronUp, Link2, BookOpen } from 'lucide-react';
import { useAppStore } from '../store';
import toast from 'react-hot-toast';
import type { Teacher, TeacherAvailability, TeacherAssignment } from '../types';

const DAYS_LABELS = { MON: 'MON', TUE: 'TUE', WED: 'WED', THU: 'THU', FRI: 'FRI', SAT: 'SAT' };

export default function TeacherManagement() {
  const {
    teachers, addTeacher, removeTeacher,
    subjects, classes, school,
    teacherAvailability, setTeacherAvailability,
    teacherAssignments, addTeacherAssignment, removeTeacherAssignment,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'teachers' | 'assignments'>('teachers');
  const [showForm, setShowForm] = useState(false);
  const [expandedTeacher, setExpandedTeacher] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', code: '', email: '',
    max_periods_per_day: 6, max_periods_per_week: 30,
    subject_ids: [] as string[],
    class_ids: [] as string[],
  });
  const [assignForm, setAssignForm] = useState({
    teacherId: '', subjectId: '', classId: '',
  });

  const days = (school?.working_days === 'MON_SAT'
    ? ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
    : ['MON', 'TUE', 'WED', 'THU', 'FRI']) as Array<keyof typeof DAYS_LABELS>;
  const periods = school
    ? Array.from({ length: school.periods_per_day }, (_, i) => i + 1)
    : [1, 2, 3, 4, 5, 6, 7, 8];

  // ── Teacher CRUD ────────────────────────────────────────────────────────────
  const handleAddTeacher = () => {
    if (!form.name.trim() || !form.code.trim()) { toast.error('Name and code required'); return; }
    if (teachers.find(t => t.code.toLowerCase() === form.code.toLowerCase())) {
      toast.error('Teacher code already exists'); return;
    }
    const teacher: Teacher = {
      id: crypto.randomUUID(), school_id: 'current',
      name: form.name, code: form.code.toUpperCase(), email: form.email,
      max_periods_per_day: form.max_periods_per_day,
      max_periods_per_week: form.max_periods_per_week,
      subject_ids: form.subject_ids,
      class_ids: form.class_ids,
      created_at: new Date().toISOString(),
    };
    addTeacher(teacher);
    setForm({ name: '', code: '', email: '', max_periods_per_day: 6, max_periods_per_week: 30, subject_ids: [], class_ids: [] });
    setShowForm(false);
    toast.success(`Teacher ${teacher.name} (${teacher.code}) added!`);
  };

  // ── Availability ────────────────────────────────────────────────────────────
  const toggleAvailability = (teacherId: string, day: string, period: number) => {
    const existing = teacherAvailability.find(
      a => a.teacher_id === teacherId && a.day === day && a.period === period
    );
    if (existing) {
      setTeacherAvailability(teacherAvailability.filter(
        a => !(a.teacher_id === teacherId && a.day === day && a.period === period)
      ));
    } else {
      const newAv: TeacherAvailability = {
        id: `${teacherId}:${day}:${period}`,
        teacher_id: teacherId, day: day as any, period, available: false,
      };
      setTeacherAvailability([...teacherAvailability, newAv]);
    }
  };
  const isUnavailable = (teacherId: string, day: string, period: number) =>
    teacherAvailability.some(a => a.teacher_id === teacherId && a.day === day && a.period === period && !a.available);

  // ── Teacher Assignments ─────────────────────────────────────────────────────
  const handleAddAssignment = () => {
    if (!assignForm.teacherId || !assignForm.subjectId || !assignForm.classId) {
      toast.error('Select teacher, subject, and class'); return;
    }
    const exists = teacherAssignments.find(
      ta => ta.teacherId === assignForm.teacherId &&
        ta.subjectId === assignForm.subjectId &&
        ta.classId === assignForm.classId
    );
    if (exists) { toast.error('This assignment already exists'); return; }

    const ta: TeacherAssignment = {
      id: crypto.randomUUID(),
      teacherId: assignForm.teacherId,
      subjectId: assignForm.subjectId,
      classId: assignForm.classId,
    };
    addTeacherAssignment(ta);
    setAssignForm({ ...assignForm, classId: '' }); // keep teacher/subject for bulk adding
    toast.success('Assignment added!');
  };

  // Bulk: assign a teacher to ALL classes for a subject
  const handleBulkAssign = () => {
    if (!assignForm.teacherId || !assignForm.subjectId) {
      toast.error('Select teacher and subject first'); return;
    }
    let added = 0;
    classes.forEach(cls => {
      const exists = teacherAssignments.find(
        ta => ta.teacherId === assignForm.teacherId &&
          ta.subjectId === assignForm.subjectId &&
          ta.classId === cls.id
      );
      if (!exists) {
        addTeacherAssignment({
          id: crypto.randomUUID(),
          teacherId: assignForm.teacherId,
          subjectId: assignForm.subjectId,
          classId: cls.id,
        });
        added++;
      }
    });
    toast.success(added > 0 ? `Added ${added} assignments for all classes!` : 'All classes already assigned');
  };

  const getTeacher = (id: string) => teachers.find(t => t.id === id);
  const getSubject = (id: string) => subjects.find(s => s.id === id);
  const getClass = (id: string) => classes.find(c => c.id === id);

  return (
    <div className="animate-fade-in max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="section-header">Teacher Management</h1>
          <p className="section-subtitle">
            {teachers.length} teachers · {teacherAssignments.length} subject-class assignments
          </p>
        </div>
        {activeTab === 'teachers' && (
          <button id="add-teacher-btn" onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
            <Plus size={18} /> Add Teacher
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-dark-800 rounded-xl mb-6 w-fit">
        {([['teachers', 'Teachers'], ['assignments', 'Subject-Class Assignments']] as const).map(([tab, label]) => (
          <button key={tab} id={`tab-${tab}`} onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab
              ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30'
              : 'text-white/50 hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── TEACHERS TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'teachers' && (
        <>
          {showForm && (
            <div className="form-section mb-6 animate-slide-up">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Users size={18} className="text-primary-400" /> New Teacher
              </h2>
              <div className="grid md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="label">Full Name *</label>
                  <input id="teacher-name" type="text" value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g., Leena Thomas" className="input-field" />
                </div>
                <div>
                  <label className="label">Teacher Code *</label>
                  <input id="teacher-code" type="text" value={form.code}
                    onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="e.g., LT" maxLength={6} className="input-field" />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input id="teacher-email" type="email" value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    placeholder="teacher@school.edu" className="input-field" />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="label">Max Periods / Day</label>
                  <input id="teacher-max-day" type="number" min={1} max={12}
                    value={form.max_periods_per_day}
                    onChange={e => setForm({ ...form, max_periods_per_day: Number(e.target.value) })}
                    className="input-field" />
                </div>
                <div>
                  <label className="label">Max Periods / Week</label>
                  <input id="teacher-max-week" type="number" min={1} max={60}
                    value={form.max_periods_per_week}
                    onChange={e => setForm({ ...form, max_periods_per_week: Number(e.target.value) })}
                    className="input-field" />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="label">Subjects (select multiple)</label>
                  <select multiple value={form.subject_ids} onChange={e => {
                    const opts = Array.from(e.target.selectedOptions).map(o => o.value);
                    setForm({ ...form, subject_ids: opts });
                  }} className="input-field h-32">
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Assigned Classes (select multiple)</label>
                  <select multiple value={form.class_ids} onChange={e => {
                    const opts = Array.from(e.target.selectedOptions).map(o => o.value);
                    setForm({ ...form, class_ids: opts });
                  }} className="input-field h-32">
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <button id="save-teacher" onClick={handleAddTeacher} className="btn-primary">Add Teacher</button>
                <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          )}

          {teachers.length === 0 ? (
            <div className="card text-center py-12">
              <Users size={40} className="mx-auto text-white/20 mb-3" />
              <p className="text-white/50 mb-2">No teachers added yet.</p>
              <p className="text-white/30 text-sm">After adding teachers, go to "Subject-Class Assignments" tab to link teachers to subjects and classes.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {teachers.map(teacher => {
                // Show teacher's assignments summary
                const myAssignments = teacherAssignments.filter(ta => ta.teacherId === teacher.id);
                const mySubjects = [...new Set(myAssignments.map(ta => ta.subjectId))];
                const myClasses = [...new Set(myAssignments.map(ta => ta.classId))];

                // include explicit teacher.subject_ids / class_ids if present
                if ((teacher as any).subject_ids && (teacher as any).subject_ids.length > 0) {
                  (teacher as any).subject_ids.forEach((sid: string) => { if (!mySubjects.includes(sid)) mySubjects.push(sid); });
                }
                if ((teacher as any).class_ids && (teacher as any).class_ids.length > 0) {
                  (teacher as any).class_ids.forEach((cid: string) => { if (!myClasses.includes(cid)) myClasses.push(cid); });
                }

                return (
                  <div key={teacher.id} className="glass rounded-2xl overflow-hidden">
                    <div className="flex items-center gap-4 p-4">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-sm font-bold flex-shrink-0">
                        {teacher.code.slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-white">{teacher.name}</p>
                          <span className="badge-primary text-xs">{teacher.code}</span>
                          {mySubjects.length > 0 && (
                            <span className="text-xs text-white/40">
                              {mySubjects.map(id => getSubject(id)?.code).filter(Boolean).join(', ')}
                              {' → '}
                              {myClasses.map(id => getClass(id)?.name).filter(Boolean).join(', ')}
                            </span>
                          )}
                          {mySubjects.length === 0 && (
                            <span className="badge-warning text-xs">No assignments</span>
                          )}
                        </div>
                        <p className="text-xs text-white/40">
                          Max {teacher.max_periods_per_day}/day · {teacher.max_periods_per_week}/week
                          {' · '}{myAssignments.length} assignment(s)
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setExpandedTeacher(expandedTeacher === teacher.id ? null : teacher.id)}
                          id={`expand-teacher-${teacher.id}`}
                          className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1">
                          Availability
                          {expandedTeacher === teacher.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        <button
                          onClick={() => { removeTeacher(teacher.id); toast.success('Teacher removed'); }}
                          id={`remove-teacher-${teacher.id}`}
                          className="btn-danger py-1.5 px-3 text-xs">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {expandedTeacher === teacher.id && (
                      <div className="border-t border-white/10 p-4 bg-dark-700/50 animate-slide-up">
                        <p className="text-xs text-white/50 mb-3">Click to mark slots as <span className="text-red-400">unavailable</span> (red = blocked).</p>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-xs">
                            <thead>
                              <tr>
                                <th className="w-16 text-left text-white/40 pb-2">Day</th>
                                {periods.map(p => <th key={p} className="px-2 pb-2 text-center text-white/40">P{p}</th>)}
                              </tr>
                            </thead>
                            <tbody>
                              {days.map(day => (
                                <tr key={day}>
                                  <td className="text-white/60 font-medium py-1 pr-4">{day}</td>
                                  {periods.map(period => {
                                    const unavail = isUnavailable(teacher.id, day, period);
                                    return (
                                      <td key={period} className="px-1 py-1 text-center">
                                        <button
                                          onClick={() => toggleAvailability(teacher.id, day, period)}
                                          id={`avail-${teacher.id}-${day}-${period}`}
                                          className={`w-8 h-7 rounded-md text-xs font-medium transition-all ${unavail
                                            ? 'bg-red-500/30 text-red-400 border border-red-500/40 hover:bg-red-500/50'
                                            : 'bg-green-500/20 text-green-400 border border-green-500/20 hover:bg-green-500/30'}`}>
                                          {unavail ? '✗' : '✓'}
                                        </button>
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── ASSIGNMENTS TAB ──────────────────────────────────────────────────── */}
      {activeTab === 'assignments' && (
        <div>
          <div className="form-section mb-6">
            <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
              <Link2 size={18} className="text-accent-400" /> Assign Teacher → Subject → Class
            </h2>
            <p className="text-white/40 text-xs mb-5">
              This tells the generator which teacher is eligible to teach a subject to a specific class.
              The generator will only schedule a lesson if a matching assignment exists here.
            </p>
            <div className="grid md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="label">Teacher *</label>
                <select id="assign-teacher" value={assignForm.teacherId}
                  onChange={e => setAssignForm({ ...assignForm, teacherId: e.target.value })}
                  className="input-field">
                  <option value="">Select Teacher</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}
                </select>
              </div>
              <div>
                <label className="label">Subject *</label>
                <select id="assign-subject" value={assignForm.subjectId}
                  onChange={e => setAssignForm({ ...assignForm, subjectId: e.target.value })}
                  className="input-field">
                  <option value="">Select Subject</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                </select>
              </div>
              <div>
                <label className="label">Class *</label>
                <select id="assign-class" value={assignForm.classId}
                  onChange={e => setAssignForm({ ...assignForm, classId: e.target.value })}
                  className="input-field">
                  <option value="">Select Class</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button id="save-teacher-assignment" onClick={handleAddAssignment}
                className="btn-primary flex items-center gap-2">
                <Plus size={16} /> Add Assignment
              </button>
              <button id="bulk-assign" onClick={handleBulkAssign}
                className="btn-secondary flex items-center gap-2 text-sm"
                title="Assign this teacher+subject to ALL classes at once">
                <BookOpen size={16} /> Assign to All Classes
              </button>
            </div>
          </div>

          {/* Assignments grouped by teacher */}
          {teacherAssignments.length === 0 ? (
            <div className="card text-center py-12">
              <Link2 size={40} className="mx-auto text-white/20 mb-3" />
              <p className="text-white/50 mb-2">No teacher assignments yet.</p>
              <p className="text-white/30 text-sm max-w-sm mx-auto">
                Without assignments, the generator cannot schedule any lessons.
                Add at least one assignment above.
              </p>
            </div>
          ) : (
            <div className="glass rounded-2xl overflow-hidden">
              <div className="p-3 border-b border-white/10 flex items-center justify-between">
                <span className="text-sm font-semibold text-white">{teacherAssignments.length} assignments</span>
                <span className="text-xs text-white/40">Teacher → Subject → Class</span>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/50 uppercase">Teacher</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/50 uppercase">Subject</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/50 uppercase">Class</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white/50 uppercase">Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {teacherAssignments.map((ta, i) => {
                    const t = getTeacher(ta.teacherId);
                    const s = getSubject(ta.subjectId);
                    const c = getClass(ta.classId);
                    return (
                      <tr key={ta.id} className={`border-b border-white/5 hover:bg-white/3 transition-colors ${i % 2 === 0 ? '' : 'bg-white/2'}`}>
                        <td className="px-4 py-3">
                          <span className="text-sm font-semibold text-white">{t?.name ?? '?'}</span>
                          <span className="ml-2 badge-primary text-xs">{t?.code}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${s?.color_class ?? 'subject-default'}`} />
                            <span className="text-sm text-white/80">{s?.name ?? '?'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-white">{c?.name ?? '?'}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => { removeTeacherAssignment(ta.id); toast.success('Assignment removed'); }}
                            id={`remove-ta-${ta.id}`}
                            className="p-1 hover:bg-red-500/20 rounded text-red-400 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
