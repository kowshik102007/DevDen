import { useState } from 'react';
import { Plus, Trash2, GraduationCap, User } from 'lucide-react';
import { useAppStore } from '../store';
import toast from 'react-hot-toast';
import type { Class } from '../types';

export default function ClassManagement() {
  const { classes, addClass, removeClass, teachers } = useAppStore();
  const [form, setForm] = useState({ grade: '', division: '', class_teacher_id: '' });
  const [showForm, setShowForm] = useState(false);

  const handleAdd = () => {
    if (!form.grade.trim() || !form.division.trim()) {
      toast.error('Please fill in grade and division');
      return;
    }
    const name = `${form.grade}${form.division}`;
    if (classes.find(c => c.name === name)) {
      toast.error(`Class ${name} already exists`);
      return;
    }
    const newClass: Class = {
      id: crypto.randomUUID(),
      school_id: 'current',
      name,
      grade: form.grade,
      division: form.division,
      class_teacher_id: form.class_teacher_id || undefined,
      created_at: new Date().toISOString(),
    };
    addClass(newClass);
    setForm({ grade: '', division: '', class_teacher_id: '' });
    setShowForm(false);
    toast.success(`Class ${name} added!`);
  };

  // Group classes by grade
  const grouped = classes.reduce<Record<string, Class[]>>((acc, cls) => {
    if (!acc[cls.grade]) acc[cls.grade] = [];
    acc[cls.grade].push(cls);
    return acc;
  }, {});

  const grades = Object.keys(grouped).sort((a, b) => Number(a) - Number(b));

  return (
    <div className="animate-fade-in max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="section-header">Class Management</h1>
          <p className="section-subtitle">{classes.length} classes configured</p>
        </div>
        <button
          id="add-class-btn"
          onClick={() => setShowForm(!showForm)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} />
          Add Class
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="form-section mb-6 animate-slide-up">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <GraduationCap size={18} className="text-primary-400" />
            New Class
          </h2>
          <div className="grid md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="label">Grade / Standard *</label>
              <input
                id="class-grade"
                type="text"
                value={form.grade}
                onChange={e => setForm({ ...form, grade: e.target.value.toUpperCase() })}
                placeholder="e.g., 10, 11, 12"
                className="input-field"
              />
            </div>
            <div>
              <label className="label">Division *</label>
              <input
                id="class-division"
                type="text"
                value={form.division}
                onChange={e => setForm({ ...form, division: e.target.value.toUpperCase() })}
                placeholder="e.g., A, B, C"
                className="input-field"
              />
            </div>
            <div>
              <label className="label">Class Teacher</label>
              <select
                id="class-teacher"
                value={form.class_teacher_id}
                onChange={e => setForm({ ...form, class_teacher_id: e.target.value })}
                className="input-field"
              >
                <option value="">Select teacher (optional)</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button id="save-class" onClick={handleAdd} className="btn-primary">
              Add Class
            </button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Bulk Add Helper */}
      {classes.length === 0 && !showForm && (
        <div className="card mb-6 text-center py-8">
          <GraduationCap size={40} className="mx-auto text-white/20 mb-3" />
          <p className="text-white/50 mb-4">No classes added yet. Start by adding your first class.</p>
          <div className="flex flex-wrap gap-2 justify-center mb-4">
            <p className="text-white/40 text-sm">Quick add examples:</p>
            {['10A', '10B', '11A', '11B', '12A'].map(name => (
              <button
                key={name}
                onClick={() => {
                  const newClass: Class = {
                    id: crypto.randomUUID(),
                    school_id: 'current',
                    name,
                    grade: name.slice(0, -1),
                    division: name.slice(-1),
                    created_at: new Date().toISOString(),
                  };
                  addClass(newClass);
                  toast.success(`Class ${name} added!`);
                }}
                className="badge-primary hover:bg-primary-500/30 cursor-pointer transition-colors"
              >
                + {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Classes Grid */}
      {grades.map(grade => (
        <div key={grade} className="mb-6">
          <h2 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-3 flex items-center gap-2">
            <div className="w-px h-4 bg-primary-500" />
            Grade / Standard {grade}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {grouped[grade].sort((a, b) => a.division.localeCompare(b.division)).map(cls => {
              const classTeacher = teachers.find(t => t.id === cls.class_teacher_id);
              return (
                <div
                  key={cls.id}
                  className="glass rounded-xl p-4 flex flex-col gap-2 hover:bg-white/10 transition-colors group relative"
                >
                  <div className="text-2xl font-display font-black text-white">{cls.name}</div>
                  {classTeacher && (
                    <div className="flex items-center gap-1.5 text-xs text-white/50">
                      <User size={10} />
                      <span className="truncate">{classTeacher.name}</span>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      removeClass(cls.id);
                      toast.success(`Class ${cls.name} removed`);
                    }}
                    id={`remove-class-${cls.id}`}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded-lg text-red-400 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
