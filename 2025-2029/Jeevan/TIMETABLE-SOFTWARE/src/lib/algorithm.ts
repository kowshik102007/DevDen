/**
 * School Timetable Generator — Constraint Satisfaction Algorithm
 *
 * Approach:
 * 1. Build eligible-teacher map from TeacherAssignment records
 * 2. Sort requirements by difficulty (fewest eligible teachers first)
 * 3. For each requirement, greedily assign periods using valid (slot, teacher) pairs
 *    — prefers balanced day distribution
 *    — respects teacher daily/weekly limits and availability
 * 4. Report exact missing counts and reasons in violations
 */

import type {
  AlgorithmInput,
  TimetableMatrix,
  SlotEntry,
  SlotType,
  ConstraintViolation,
  GenerationResult,
  DayOfWeek,
  DiagnosticEntry,
} from '../types';

export const DAYS_MON_FRI: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
export const DAYS_MON_SAT: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const SUBJECT_COLORS: Record<string, string> = {
  language: 'subject-language',
  math: 'subject-math',
  science: 'subject-science',
  social: 'subject-social',
  it: 'subject-it',
  pt: 'subject-pt',
  art: 'subject-art',
  other: 'subject-default',
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ==================== MAIN ENTRY POINT ====================

export function generateTimetable(input: AlgorithmInput): GenerationResult {
  const { school, classes, subjects, teachers, classSubjects, teacherAssignments, teacherAvailability } = input;
  const days: DayOfWeek[] = school.working_days === 'MON_SAT' ? DAYS_MON_SAT : DAYS_MON_FRI;
  const periodsPerDay = school.periods_per_day;
  const lunchAfterPeriod = school.lunch_break?.after_period ?? 4;

  // ── Unavailability lookup ──────────────────────────────────────────────────
  const unavailableSet = new Set<string>();
  teacherAvailability.forEach(av => {
    if (!av.available) unavailableSet.add(`${av.teacher_id}:${av.day}:${av.period}`);
  });

  // ── Eligible teachers per (classId, subjectId) ────────────────────────────
  // Key: "classId::subjectId"  Value: teacherId[]
  const eligibleMap = new Map<string, string[]>();
  teacherAssignments.forEach(ta => {
    const key = `${ta.classId}::${ta.subjectId}`;
    if (!eligibleMap.has(key)) eligibleMap.set(key, []);
    eligibleMap.get(key)!.push(ta.teacherId);
  });

  // Also include teachers who have explicit subject_ids/class_ids on their profile
  teachers.forEach(t => {
    if (!t.subject_ids || !t.class_ids) return;
    t.class_ids.forEach(cid => {
      t.subject_ids!.forEach(sid => {
        const key = `${cid}::${sid}`;
        if (!eligibleMap.has(key)) eligibleMap.set(key, []);
        const arr = eligibleMap.get(key)!;
        if (!arr.includes(t.id)) arr.push(t.id);
      });
    });
  });

  // ── Runtime state ──────────────────────────────────────────────────────────
  const matrix: TimetableMatrix = {};
  // teacherBusy[teacherId][day][period] = classId or undefined
  const teacherBusy: Record<string, Record<string, Record<number, string>>> = {};
  const teacherDailyCount: Record<string, Record<string, number>> = {};
  const teacherWeeklyCount: Record<string, number> = {};

  teachers.forEach(t => {
    teacherBusy[t.id] = {};
    teacherDailyCount[t.id] = {};
    teacherWeeklyCount[t.id] = 0;
    days.forEach(d => {
      teacherBusy[t.id][d] = {};
      teacherDailyCount[t.id][d] = 0;
    });
  });

  // ── Initialize matrix with fixed periods ───────────────────────────────────
  classes.forEach(cls => {
    matrix[cls.id] = {};
    days.forEach(day => {
      matrix[cls.id][day] = {};
      for (let p = 1; p <= periodsPerDay; p++) {
        const isLunch = p === lunchAfterPeriod + 1;
        const isAssembly = p === 1 && day === 'MON';
        if (isLunch) {
          matrix[cls.id][day][p] = { subjectId: 'LUNCH', teacherId: '', slotType: 'lunch' };
        } else if (isAssembly) {
          matrix[cls.id][day][p] = { subjectId: 'ASSEMBLY', teacherId: '', slotType: 'assembly' };
        } else {
          matrix[cls.id][day][p] = null;
        }
      }
    });
  });

  // ── Build & sort requirements by difficulty ────────────────────────────────
  const requirements = classSubjects.map(cs => {
    const key = `${cs.class_id}::${cs.subject_id}`;
    return {
      ...cs,
      eligibleTeacherIds: eligibleMap.get(key) ?? [],
    };
  });
  // Sort: fewest eligible teachers first → hardest to schedule first
  requirements.sort((a, b) => a.eligibleTeacherIds.length - b.eligibleTeacherIds.length);

  const violations: ConstraintViolation[] = [];
  let totalSlotsExpected = 0;
  let totalSlotsFilled = 0;

  // ── Assign each requirement ────────────────────────────────────────────────
  for (const req of requirements) {
    totalSlotsExpected += req.weekly_periods;

    if (req.eligibleTeacherIds.length === 0) {
      const cls = classes.find(c => c.id === req.class_id);
      const subj = subjects.find(s => s.id === req.subject_id);
      violations.push({
        type: 'missing_periods',
        message: `Class ${cls?.name}: "${subj?.name}" — No teacher assignment found. Please assign a teacher in Teacher Management.`,
        severity: 'warning',
        classId: req.class_id,
        subjectId: req.subject_id,
      });
      continue;
    }

    // Track how many of this subject are on each day (for balance)
    const subjDayCount: Record<string, number> = {};
    days.forEach(d => { subjDayCount[d] = 0; });

    let periodsPlaced = 0;

    for (let i = 0; i < req.weekly_periods; i++) {
      // Collect all null slots for this class
      const availSlots: Array<{ day: DayOfWeek; period: number }> = [];
      days.forEach(day => {
        for (let p = 1; p <= periodsPerDay; p++) {
          if (matrix[req.class_id][day][p] === null) {
            availSlots.push({ day, period: p });
          }
        }
      });

      // Sort slots: prefer days where this subject appears less
      availSlots.sort((a, b) => (subjDayCount[a.day] ?? 0) - (subjDayCount[b.day] ?? 0));

      const shuffledTeachers = shuffle([...req.eligibleTeacherIds]);
      let placed = false;

      outer: for (const slot of availSlots) {
        for (const teacherId of shuffledTeachers) {
          // Check teacher exists in our records
          const teacher = teachers.find(t => t.id === teacherId);
          if (!teacher) continue;

          // Teacher already busy at this slot?
          if (teacherBusy[teacherId]?.[slot.day]?.[slot.period]) continue;

          // Teacher marked unavailable?
          if (unavailableSet.has(`${teacherId}:${slot.day}:${slot.period}`)) continue;

          // Teacher over daily limit?
          if ((teacherDailyCount[teacherId]?.[slot.day] ?? 0) >= teacher.max_periods_per_day) continue;

          // Teacher over weekly limit?
          if ((teacherWeeklyCount[teacherId] ?? 0) >= teacher.max_periods_per_week) continue;

          // ── Place the lesson ───────────────────────────────────────────
          const subj = subjects.find(s => s.id === req.subject_id);
          let slotType: SlotType = 'regular';
          if (subj?.is_lab) slotType = 'lab';
          else if (subj?.category === 'pt') slotType = 'pt';
          else if (subj?.category === 'art') slotType = 'ae';

          matrix[req.class_id][slot.day][slot.period] = {
            subjectId: req.subject_id,
            teacherId,
            slotType,
          } satisfies SlotEntry;

          if (!teacherBusy[teacherId]) teacherBusy[teacherId] = {};
          if (!teacherBusy[teacherId][slot.day]) teacherBusy[teacherId][slot.day] = {};
          teacherBusy[teacherId][slot.day][slot.period] = req.class_id;

          teacherWeeklyCount[teacherId] = (teacherWeeklyCount[teacherId] ?? 0) + 1;
          if (!teacherDailyCount[teacherId]) teacherDailyCount[teacherId] = {};
          teacherDailyCount[teacherId][slot.day] = (teacherDailyCount[teacherId][slot.day] ?? 0) + 1;
          subjDayCount[slot.day] = (subjDayCount[slot.day] ?? 0) + 1;

          periodsPlaced++;
          placed = true;
          break outer;
        }
      }

      if (!placed) {
        // No more valid placements for this subject — stop trying
        break;
      }
    }

    totalSlotsFilled += periodsPlaced;

    if (periodsPlaced < req.weekly_periods) {
      const cls = classes.find(c => c.id === req.class_id);
      const subj = subjects.find(s => s.id === req.subject_id);
      const short = req.weekly_periods - periodsPlaced;
      violations.push({
        type: 'missing_periods',
        message: `Class ${cls?.name}: "${subj?.name}" — Placed ${periodsPlaced}/${req.weekly_periods} periods. ${short} period(s) could not be scheduled (teacher overloaded or all slots taken).`,
        severity: 'warning',
        classId: req.class_id,
        subjectId: req.subject_id,
      });
    }
  }

  // ── Fill remaining null slots with FREE ────────────────────────────────────
  classes.forEach(cls => {
    days.forEach(day => {
      for (let p = 1; p <= periodsPerDay; p++) {
        if (matrix[cls.id][day][p] === null) {
          matrix[cls.id][day][p] = { subjectId: 'FREE', teacherId: '', slotType: 'free' };
        }
      }
    });
  });

  // ── Post-generation clash detection ────────────────────────────────────────
  const clashes = detectTeacherClashes(matrix, classes, teachers, days, periodsPerDay);
  violations.push(...clashes);

  const completionPercent = totalSlotsExpected > 0
    ? Math.round((totalSlotsFilled / totalSlotsExpected) * 100)
    : 0;

  const criticalErrors = violations.filter(v => v.severity === 'error').length;
  const success = completionPercent === 100 && criticalErrors === 0;

  return {
    success,
    matrix,
    violations,
    stats: { totalSlotsFilled, totalSlotsExpected, completionPercent },
  };
}

// ==================== TEACHER CLASH DETECTION ====================

function detectTeacherClashes(
  matrix: TimetableMatrix,
  classes: AlgorithmInput['classes'],
  teachers: AlgorithmInput['teachers'],
  days: DayOfWeek[],
  periodsPerDay: number,
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];
  // teacherSlotMap[teacherId][day][period] = classIds[]
  const teacherSlotMap: Record<string, Record<string, Record<number, string[]>>> = {};

  teachers.forEach(t => {
    teacherSlotMap[t.id] = {};
    days.forEach(d => { teacherSlotMap[t.id][d] = {}; });
  });

  classes.forEach(cls => {
    days.forEach(day => {
      for (let p = 1; p <= periodsPerDay; p++) {
        const slot = matrix[cls.id]?.[day]?.[p];
        if (slot?.teacherId && slot.teacherId !== '') {
          if (!teacherSlotMap[slot.teacherId]) return;
          if (!teacherSlotMap[slot.teacherId][day][p]) {
            teacherSlotMap[slot.teacherId][day][p] = [];
          }
          teacherSlotMap[slot.teacherId][day][p].push(cls.id);
        }
      }
    });
  });

  teachers.forEach(teacher => {
    days.forEach(day => {
      for (let p = 1; p <= periodsPerDay; p++) {
        const classIds = teacherSlotMap[teacher.id]?.[day]?.[p] ?? [];
        if (classIds.length > 1) {
          violations.push({
            type: 'teacher_clash',
            message: `CLASH: Teacher "${teacher.name}" (${teacher.code}) is scheduled in ${classIds.length} classes on ${day} Period ${p}.`,
            severity: 'error',
            teacherId: teacher.id,
            day,
            period: p,
          });
        }
      }
    });
  });

  return violations;
}

// ==================== DIAGNOSTICS BUILD ====================

export function buildDiagnostics(
  input: AlgorithmInput,
  matrix: TimetableMatrix | null,
): DiagnosticEntry[] {
  const { classes, subjects, teachers, classSubjects, teacherAssignments } = input;
  const days: DayOfWeek[] = input.school.working_days === 'MON_SAT' ? DAYS_MON_SAT : DAYS_MON_FRI;
  const periodsPerDay = input.school.periods_per_day;

  const eligibleMap = new Map<string, string[]>();
  teacherAssignments.forEach(ta => {
    const key = `${ta.classId}::${ta.subjectId}`;
    if (!eligibleMap.has(key)) eligibleMap.set(key, []);
    eligibleMap.get(key)!.push(ta.teacherId);
  });

  const entries: DiagnosticEntry[] = [];

  classSubjects.forEach(cs => {
    const cls = classes.find(c => c.id === cs.class_id);
    const subj = subjects.find(s => s.id === cs.subject_id);
    if (!cls || !subj) return;

    const key = `${cs.class_id}::${cs.subject_id}`;
    const eligibleTeacherIds = eligibleMap.get(key) ?? [];
    const eligibleTeacherNames = eligibleTeacherIds
      .map(id => teachers.find(t => t.id === id))
      .filter(Boolean)
      .map(t => `${t!.name} (${t!.code})`);

    // Count scheduled periods from matrix
    let scheduled = 0;
    if (matrix) {
      days.forEach(day => {
        for (let p = 1; p <= periodsPerDay; p++) {
          const slot = matrix[cs.class_id]?.[day]?.[p];
          if (slot?.subjectId === cs.subject_id) scheduled++;
        }
      });
    }

    let reason: string | undefined;
    if (eligibleTeacherIds.length === 0) {
      reason = 'No teacher assigned to this class-subject combination.';
    } else if (scheduled < cs.weekly_periods) {
      reason = `Only ${scheduled}/${cs.weekly_periods} periods placed — teacher may be overloaded or schedule is full.`;
    }

    entries.push({
      classId: cs.class_id,
      className: cls.name,
      subjectId: cs.subject_id,
      subjectName: subj.name,
      required: cs.weekly_periods,
      scheduled,
      eligibleTeachers: eligibleTeacherNames,
      reason,
    });
  });

  return entries;
}

// ==================== SUBJECT COLOR ====================

export function getSubjectColorClass(category?: string, subjectId?: string): string {
  if (subjectId === 'LUNCH') return 'subject-break';
  if (subjectId === 'ASSEMBLY') return 'subject-social';
  if (subjectId === 'FREE') return 'subject-free';
  return SUBJECT_COLORS[category ?? ''] ?? 'subject-default';
}

export function verifyTimetable(matrix: TimetableMatrix, input: AlgorithmInput): ConstraintViolation[] {
  const days: DayOfWeek[] = input.school.working_days === 'MON_SAT' ? DAYS_MON_SAT : DAYS_MON_FRI;
  return detectTeacherClashes(matrix, input.classes, input.teachers, days, input.school.periods_per_day);
}
