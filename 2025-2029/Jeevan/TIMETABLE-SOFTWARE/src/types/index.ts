// ==================== Core Types ====================

export interface School {
  id: string;
  user_id: string;
  name: string;
  academic_year: string;
  working_days: 'MON_FRI' | 'MON_SAT';
  periods_per_day: number;
  period_timings: PeriodTiming[];
  lunch_break: LunchBreak;
  created_at: string;
  updated_at: string;
}

export interface PeriodTiming {
  period: number;
  start_time: string;
  end_time: string;
  label?: string;
}

export interface LunchBreak {
  after_period: number;
  start_time: string;
  end_time: string;
}

export interface Class {
  id: string;
  school_id: string;
  name: string;          // e.g. "10A"
  grade: string;         // e.g. "10"
  division: string;      // e.g. "A"
  class_teacher_id?: string;
  created_at: string;
}

export interface Subject {
  id: string;
  school_id: string;
  name: string;
  code: string;
  category: SubjectCategory;
  color_class: string;
  is_lab?: boolean;
  allows_double?: boolean;
  created_at: string;
}

export type SubjectCategory =
  | 'language'
  | 'science'
  | 'math'
  | 'social'
  | 'it'
  | 'art'
  | 'pt'
  | 'other';

export interface Teacher {
  id: string;
  school_id: string;
  name: string;
  code: string;
  email?: string;
  max_periods_per_day: number;
  max_periods_per_week: number;
  subject_ids?: string[];
  class_ids?: string[];
  created_at: string;
}

export interface TeacherAvailability {
  id: string;
  teacher_id: string;
  day: DayOfWeek;
  period: number;
  available: boolean;
}

// ClassSubject: defines weekly period REQUIREMENT for a class-subject pair (no teacher here)
export interface ClassSubject {
  id: string;
  class_id: string;
  subject_id: string;
  weekly_periods: number;
}

// TeacherAssignment: defines WHICH teacher can teach WHICH subject to WHICH class
export interface TeacherAssignment {
  id: string;
  teacherId: string;
  subjectId: string;
  classId: string;
}

// ==================== Timetable Types ====================

export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT';

export interface TimetableSlot {
  id: string;
  timetable_id: string;
  class_id: string;
  day: DayOfWeek;
  period: number;
  subject_id?: string;
  teacher_id?: string;
  slot_type: SlotType;
  is_fixed: boolean;
  is_double: boolean;
}

export type SlotType =
  | 'regular'
  | 'lunch'
  | 'assembly'
  | 'pt'
  | 'lab'
  | 'elective'
  | 'free'
  | 'sargam'
  | 'sports'
  | 'we'  // Work Education
  | 'ae'; // Art Education

export interface Timetable {
  id: string;
  school_id: string;
  name: string;
  status: 'draft' | 'generated' | 'paid' | 'published';
  payment_id?: string;
  slots: TimetableSlot[];
  created_at: string;
}

// ==================== Algorithm Types ====================

export interface AlgorithmInput {
  school: School;
  classes: Class[];
  subjects: Subject[];
  teachers: Teacher[];
  classSubjects: ClassSubject[];
  teacherAssignments: TeacherAssignment[];
  teacherAvailability: TeacherAvailability[];
}

// ==================== Diagnostic Types ====================

export interface DiagnosticEntry {
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  required: number;
  scheduled: number;
  eligibleTeachers: string[]; // teacher names
  reason?: string; // why it failed
}

export interface TimetableMatrix {
  [classId: string]: {
    [day: string]: {
      [period: number]: SlotEntry | null;
    };
  };
}

export interface SlotEntry {
  subjectId: string;
  teacherId: string;
  slotType: SlotType;
  isDouble?: boolean;
}

export interface ConstraintViolation {
  type: 'teacher_clash' | 'class_clash' | 'missing_periods' | 'extra_periods' | 'availability';
  message: string;
  severity: 'error' | 'warning';
  classId?: string;
  teacherId?: string;
  subjectId?: string;
  day?: DayOfWeek;
  period?: number;
}

export interface GenerationResult {
  success: boolean;
  matrix: TimetableMatrix;
  violations: ConstraintViolation[];
  stats: {
    totalSlotsFilled: number;
    totalSlotsExpected: number;
    completionPercent: number;
  };
}

// ==================== Auth Types ====================

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  avatar_url?: string;
}

// ==================== Payment Types ====================

export interface Payment {
  id: string;
  school_id: string;
  timetable_id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'success' | 'failed';
  payment_method?: string;
  razorpay_payment_id?: string;
  created_at: string;
}

// ==================== Form Types ====================

export interface SchoolFormData {
  name: string;
  academic_year: string;
  working_days: 'MON_FRI' | 'MON_SAT';
  periods_per_day: number;
  period_timings: PeriodTiming[];
  lunch_break: LunchBreak;
}

export interface ClassFormData {
  name: string;
  grade: string;
  division: string;
  class_teacher_id?: string;
}

export interface SubjectFormData {
  name: string;
  code: string;
  category: SubjectCategory;
  color_class: string;
  is_lab: boolean;
  allows_double: boolean;
}

export interface TeacherFormData {
  name: string;
  code: string;
  email: string;
  max_periods_per_day: number;
  max_periods_per_week: number;
  subject_ids: string[];
  class_ids: string[];
}

export interface ClassSubjectFormData {
  class_id: string;
  subject_id: string;
  teacher_id: string;
  weekly_periods: number;
}

// ==================== Dashboard Types ====================

export interface DashboardStats {
  totalSchools: number;
  totalTimetables: number;
  totalRevenue: number;
  recentPayments: Payment[];
}
