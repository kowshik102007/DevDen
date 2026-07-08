import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  School, Class, Subject, Teacher, ClassSubject,
  TeacherAssignment, TeacherAvailability, TimetableMatrix,
  ConstraintViolation, User,
} from '../types';

// ==================== Auth Store ====================
interface AuthState {
  user: User | null;
  setUser: (user: User | null) => void;
}
export const useAuthStore = create<AuthState>()(
  persist((set) => ({ user: null, setUser: (user) => set({ user }) }), { name: 'auth-store' })
);

// ==================== App Store ====================
interface AppState {
  school: School | null;
  classes: Class[];
  subjects: Subject[];
  teachers: Teacher[];
  classSubjects: ClassSubject[];
  teacherAssignments: TeacherAssignment[];
  teacherAvailability: TeacherAvailability[];
  timetableMatrix: TimetableMatrix | null;
  violations: ConstraintViolation[];
  timetableStatus: 'idle' | 'generating' | 'generated' | 'failed' | 'paid';
  timetableId: string | null;
  activeSchoolId: string | null;

  setSchool: (school: School) => void;
  setClasses: (classes: Class[]) => void;
  addClass: (cls: Class) => void;
  removeClass: (id: string) => void;
  setSubjects: (subjects: Subject[]) => void;
  addSubject: (subject: Subject) => void;
  removeSubject: (id: string) => void;
  setTeachers: (teachers: Teacher[]) => void;
  addTeacher: (teacher: Teacher) => void;
  removeTeacher: (id: string) => void;
  setClassSubjects: (cs: ClassSubject[]) => void;
  addClassSubject: (cs: ClassSubject) => void;
  removeClassSubject: (id: string) => void;
  updateClassSubject: (cs: ClassSubject) => void;
  addTeacherAssignment: (ta: TeacherAssignment) => void;
  removeTeacherAssignment: (id: string) => void;
  setTeacherAssignments: (tas: TeacherAssignment[]) => void;
  setTeacherAvailability: (av: TeacherAvailability[]) => void;
  setTimetableMatrix: (matrix: TimetableMatrix) => void;
  setViolations: (violations: ConstraintViolation[]) => void;
  setTimetableStatus: (status: AppState['timetableStatus']) => void;
  setTimetableId: (id: string) => void;
  setActiveSchoolId: (id: string) => void;
  resetTimetable: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      school: null,
      classes: [],
      subjects: [],
      teachers: [],
      classSubjects: [],
      teacherAssignments: [],
      teacherAvailability: [],
      timetableMatrix: null,
      violations: [],
      timetableStatus: 'idle',
      timetableId: null,
      activeSchoolId: null,

      setSchool: (school) => set({ school }),
      setClasses: (classes) => set({ classes }),
      addClass: (cls) => set((s) => ({ classes: [...s.classes, cls] })),
      removeClass: (id) => set((s) => ({ classes: s.classes.filter(c => c.id !== id) })),
      setSubjects: (subjects) => set({ subjects }),
      addSubject: (subject) => set((s) => ({ subjects: [...s.subjects, subject] })),
      removeSubject: (id) => set((s) => ({ subjects: s.subjects.filter(x => x.id !== id) })),
      setTeachers: (teachers) => set({ teachers }),
      addTeacher: (teacher) => set((s) => ({ teachers: [...s.teachers, teacher] })),
      removeTeacher: (id) => set((s) => ({ teachers: s.teachers.filter(t => t.id !== id) })),
      setClassSubjects: (cs) => set({ classSubjects: cs }),
      addClassSubject: (cs) => set((s) => ({ classSubjects: [...s.classSubjects, cs] })),
      removeClassSubject: (id) => set((s) => ({ classSubjects: s.classSubjects.filter(c => c.id !== id) })),
      updateClassSubject: (cs) => set((s) => ({
        classSubjects: s.classSubjects.map(c => c.id === cs.id ? cs : c),
      })),
      addTeacherAssignment: (ta) => set((s) => ({
        teacherAssignments: [...s.teacherAssignments, ta],
      })),
      removeTeacherAssignment: (id) => set((s) => ({
        teacherAssignments: s.teacherAssignments.filter(t => t.id !== id),
      })),
      setTeacherAssignments: (tas) => set({ teacherAssignments: tas }),
      setTeacherAvailability: (av) => set({ teacherAvailability: av }),
      setTimetableMatrix: (matrix) => set({ timetableMatrix: matrix }),
      setViolations: (violations) => set({ violations }),
      setTimetableStatus: (status) => set({ timetableStatus: status }),
      setTimetableId: (id) => set({ timetableId: id }),
      setActiveSchoolId: (id) => set({ activeSchoolId: id }),
      resetTimetable: () => set({
        timetableMatrix: null, violations: [], timetableStatus: 'idle', timetableId: null,
      }),
    }),
    {
      name: 'timetable-app-store-v2', // bump version to clear old persisted data
      partialize: (state) => ({
        school: state.school,
        classes: state.classes,
        subjects: state.subjects,
        teachers: state.teachers,
        classSubjects: state.classSubjects,
        teacherAssignments: state.teacherAssignments,
        timetableStatus: state.timetableStatus,
        timetableId: state.timetableId,
        activeSchoolId: state.activeSchoolId,
      }),
    }
  )
);
