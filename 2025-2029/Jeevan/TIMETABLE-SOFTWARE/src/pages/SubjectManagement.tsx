import { useState } from 'react';
import { Plus, Trash2, BookOpen, Edit2, X } from 'lucide-react';
import { useAppStore } from '../store';
import toast from 'react-hot-toast';
import type { Subject, SubjectCategory, ClassSubject } from '../types';

const CATEGORIES: { value: SubjectCategory; label: string; color: string }[] = [
  { value: 'language', label: 'Language', color: 'subject-language' },
  { value: 'math', label: 'Mathematics', color: 'subject-math' },
  { value: 'science', label: 'Science', color: 'subject-science' },
  { value: 'social', label: 'Social Science', color: 'subject-social' },
  { value: 'it', label: 'IT / Computer', color: 'subject-it' },
  { value: 'pt', label: 'Physical Training', color: 'subject-pt' },
  { value: 'art', label: 'Art / WE / AE', color: 'subject-art' },
  { value: 'other', label: 'Other', color: 'subject-default' },
];

const SAMPLE_SUBJECTS = [
  { name: 'Malayalam', code: 'MAL', category: 'language' as SubjectCategory, color_class: 'subject-language' },
  { name: 'English', code: 'ENG', category: 'language' as SubjectCategory, color_class: 'subject-language' },
  { name: 'Hindi', code: 'HIN', category: 'language' as SubjectCategory, color_class: 'subject-language' },
  { name: 'Mathematics', code: 'MAT', category: 'math' as SubjectCategory, color_class: 'subject-math' },
  { name: 'Social Science', code: 'SSC', category: 'social' as SubjectCategory, color_class: 'subject-social' },
  { name: 'Physics', code: 'PHY', category: 'science' as SubjectCategory, color_class: 'subject-science' },
  { name: 'Chemistry', code: 'CHE', category: 'science' as SubjectCategory, color_class: 'subject-science' },
  { name: 'Biology', code: 'BIO', category: 'science' as SubjectCategory, color_class: 'subject-science' },
  { name: 'IT', code: 'IT', category: 'it' as SubjectCategory, color_class: 'subject-it' },
  { name: 'Physical Training', code: 'PT', category: 'pt' as SubjectCategory, color_class: 'subject-pt' },
  { name: 'Work Education', code: 'WE', category: 'art' as SubjectCategory, color_class: 'subject-art' },
  { name: 'Art Education', code: 'AE', category: 'art' as SubjectCategory, color_class: 'subject-art' },
];

export default function SubjectManagement() {
  const { subjects, addSubject, removeSubject, classes, classSubjects, addClassSubject, removeClassSubject, updateClassSubject } = useAppStore();
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'subjects' | 'requirements'>('subjects');
  const [form, setForm] = useState({
    name: '', code: '', category: 'other' as SubjectCategory,
    color_class: 'subject-default', is_lab: false, allows_double: false,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reqForm, setReqForm] = useState({ class_id: '', subject_id: '', weekly_periods: 1 });

  const handleAddSubject = () => {
    if (!form.name.trim() || !form.code.trim()) { toast.error('Name and code required'); return; }
    if (subjects.find(s => s.code === form.code.toUpperCase())) { toast.error('Code already exists'); return; }
    const cat = CATEGORIES.find(c => c.value === form.category);
    const subject: Subject = {
      id: crypto.randomUUID(), school_id: 'current',
      ...form,
      code: form.code.toUpperCase(),
      color_class: cat?.color ?? 'subject-default',
      created_at: new Date().toISOString(),
    };
    addSubject(subject);
    setForm({ name: '', code: '', category: 'other', color_class: 'subject-default', is_lab: false, allows_double: false });
    setShowForm(false);
    toast.success(`Subject "${subject.name}" added!`);
  };

  const handleAddRequirement = () => {
    if (!reqForm.class_id || !reqForm.subject_id) { toast.error('Select class and subject'); return; }
    if (classSubjects.find(cs => cs.class_id === reqForm.class_id && cs.subject_id === reqForm.subject_id)) {
      toast.error('This class-subject requirement already exists'); return;
    }
    const cs: ClassSubject = {
      id: crypto.randomUUID(),
      class_id: reqForm.class_id,
      subject_id: reqForm.subject_id,
      weekly_periods: Number(reqForm.weekly_periods),
    };
    addClassSubject(cs);
    setReqForm({ ...reqForm, weekly_periods: 1 });
    toast.success('Requirement added!');
  };

  const addSampleSubjects = () => {
    SAMPLE_SUBJECTS.forEach(s => {
      if (!subjects.find(ex => ex.code === s.code)) {
        addSubject({
          id: crypto.randomUUID(), school_id: 'current', ...s,
          is_lab: s.category === 'science', allows_double: s.category === 'science',
          created_at: new Date().toISOString(),
        });
      }
    });
    toast.success('Sample subjects loaded!');
  };

  return (
    <div className="animate-fade-in max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="section-header">Subject Management</h1>
          <p className="section-subtitle">{subjects.length} subjects · {classSubjects.length} weekly requirements</p>
        </div>
        <div className="flex gap-3">
          {subjects.length === 0 && (
            <button onClick={addSampleSubjects} className="btn-secondary text-sm">Load Sample Subjects</button>
          )}
          <button id="add-subject-btn" onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
            <Plus size={18} /> Add Subject
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-dark-800 rounded-xl mb-6 w-fit">
        {([['subjects', 'Subjects'], ['requirements', 'Weekly Requirements']] as const).map(([tab, label]) => (
          <button key={tab} id={`tab-${tab}`} onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab
              ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30'
              : 'text-white/50 hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── SUBJECTS TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'subjects' && (
        <>
          {showForm && (
            <div className="form-section animate-slide-up">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <BookOpen size={18} className="text-primary-400" /> New Subject
              </h2>
              <div className="grid md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="label">Subject Name *</label>
                  <input id="subject-name" type="text" value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g., Mathematics" className="input-field" />
                </div>
                <div>
                  <label className="label">Subject Code *</label>
                  <input id="subject-code" type="text" value={form.code}
                    onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="e.g., MAT" className="input-field" maxLength={6} />
                </div>
                <div>
                  <label className="label">Category</label>
                  <select id="subject-category" value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value as SubjectCategory })}
                    className="input-field">
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-6 mb-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-white/70">
                  <input type="checkbox" id="subject-is-lab" checked={form.is_lab}
                    onChange={e => setForm({ ...form, is_lab: e.target.checked })} />
                  Lab Subject (consecutive periods)
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-white/70">
                  <input type="checkbox" id="subject-double" checked={form.allows_double}
                    onChange={e => setForm({ ...form, allows_double: e.target.checked })} />
                  Allow Double Periods
                </label>
              </div>
              <div className="flex gap-3">
                <button id="save-subject" onClick={handleAddSubject} className="btn-primary">Add Subject</button>
                <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          )}

          {subjects.length === 0 ? (
            <div className="card text-center py-12">
              <BookOpen size={40} className="mx-auto text-white/20 mb-3" />
              <p className="text-white/50 mb-4">No subjects added yet.</p>
              <button onClick={addSampleSubjects} className="btn-primary">Load Sample Subjects (Standard 10)</button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {subjects.map(subject => (
                <div key={subject.id} className="glass rounded-xl p-4 flex items-start gap-3 group relative hover:bg-white/10 transition-colors">
                  <div className={`w-10 h-10 rounded-lg ${subject.color_class} flex items-center justify-center flex-shrink-0 text-xs font-bold text-white`}>
                    {subject.code.slice(0, 3)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm">{subject.name}</p>
                    <p className="text-xs text-white/40">{CATEGORIES.find(c => c.value === subject.category)?.label}</p>
                    <div className="flex gap-2 mt-1">
                      {subject.is_lab && <span className="badge bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs py-0.5">Lab</span>}
                      {subject.allows_double && <span className="badge bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs py-0.5">Double</span>}
                    </div>
                  </div>
                  <button onClick={() => { removeSubject(subject.id); toast.success('Subject removed'); }}
                    id={`remove-subject-${subject.id}`}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded-lg text-red-400 transition-all flex-shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── REQUIREMENTS TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'requirements' && (
        <div>
          <div className="form-section mb-6">
            <h2 className="text-lg font-semibold text-white mb-2">Weekly Period Requirements</h2>
            <p className="text-white/40 text-xs mb-5">
              Define how many periods per week each subject needs for each class.
              <strong className="text-white/60"> Note:</strong> Teacher assignment is done in Teacher Management → "Subject-Class Assignments".
            </p>
            <div className="grid md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="label">Class *</label>
                <select id="req-class" value={reqForm.class_id}
                  onChange={e => setReqForm({ ...reqForm, class_id: e.target.value })} className="input-field">
                  <option value="">Select Class</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Subject *</label>
                <select id="req-subject" value={reqForm.subject_id}
                  onChange={e => setReqForm({ ...reqForm, subject_id: e.target.value })} className="input-field">
                  <option value="">Select Subject</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                </select>
              </div>
              <div>
                <label className="label">Periods / Week</label>
                <input id="req-periods" type="number" min={1} max={12} value={reqForm.weekly_periods}
                  onChange={e => setReqForm({ ...reqForm, weekly_periods: Number(e.target.value) })}
                  className="input-field" />
              </div>
            </div>
            <button id="save-requirement" onClick={handleAddRequirement} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> Add Requirement
            </button>
          </div>

          {classSubjects.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-white/50">No requirements yet. Add class-subject weekly period requirements above.</p>
            </div>
          ) : (
            <div className="glass rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/60 uppercase">Class</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/60 uppercase">Subject</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white/60 uppercase">Periods/Week</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white/60 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {classSubjects.map((cs, i) => {
                    const cls = classes.find(c => c.id === cs.class_id);
                    const subj = subjects.find(s => s.id === cs.subject_id);
                    return (
                      <tr key={cs.id} className={`border-b border-white/5 hover:bg-white/3 transition-colors ${i % 2 === 0 ? '' : 'bg-white/2'}`}>
                        <td className="px-4 py-3 text-sm font-semibold text-white">{cls?.name ?? '?'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${subj?.color_class ?? 'subject-default'}`} />
                            <span className="text-sm text-white/80">{subj?.name ?? '?'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {editingId === cs.id ? (
                            <input type="number" min={1} max={12} defaultValue={cs.weekly_periods}
                              className="input-field w-16 text-center text-sm py-1"
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  updateClassSubject({ ...cs, weekly_periods: Number((e.target as HTMLInputElement).value) });
                                  setEditingId(null);
                                  toast.success('Updated!');
                                }
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                              autoFocus />
                          ) : (
                            <span className="badge-primary text-xs">{cs.weekly_periods}× / week</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            {editingId === cs.id
                              ? <button onClick={() => setEditingId(null)} className="p-1 hover:bg-white/10 rounded text-white/60"><X size={14} /></button>
                              : <button onClick={() => setEditingId(cs.id)} className="p-1 hover:bg-white/10 rounded text-white/40 hover:text-white"><Edit2 size={14} /></button>
                            }
                            <button onClick={() => { removeClassSubject(cs.id); toast.success('Requirement removed'); }}
                              id={`remove-req-${cs.id}`}
                              className="p-1 hover:bg-red-500/20 rounded text-red-400">
                              <Trash2 size={14} />
                            </button>
                          </div>
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
