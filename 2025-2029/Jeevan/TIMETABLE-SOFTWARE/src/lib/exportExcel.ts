import * as XLSX from 'xlsx';
import type { TimetableMatrix, Class, Subject, Teacher, School } from '../types';
import { DAYS_MON_FRI, DAYS_MON_SAT } from './algorithm';

interface ExportOptions {
  matrix: TimetableMatrix;
  classes: Class[];
  subjects: Subject[];
  teachers: Teacher[];
  school: School;
}

export function exportTimetableExcel({ matrix, classes, subjects, teachers, school }: ExportOptions) {
  const days = school.working_days === 'MON_SAT' ? DAYS_MON_SAT : DAYS_MON_FRI;
  const periods = Array.from({ length: school.periods_per_day }, (_, i) => i + 1);

  const wb = XLSX.utils.book_new();

  const getSubjectName = (id?: string) => {
    if (!id || id === 'FREE') return 'Free';
    if (id === 'LUNCH') return 'Lunch';
    if (id === 'ASSEMBLY') return 'Assembly';
    return subjects.find(s => s.id === id)?.name || id;
  };

  const getTeacherCode = (id?: string) => {
    if (!id) return '';
    return teachers.find(t => t.id === id)?.code || '';
  };

  // Create a sheet per class
  classes.forEach(cls => {
    const rows: string[][] = [];
    rows.push([`Class: ${cls.name} — ${school.name} (${school.academic_year})`]);
    rows.push(['Day / Period', ...periods.map(p => `Period ${p}`)]);

    days.forEach(day => {
      const row: string[] = [day];
      periods.forEach(period => {
        const slot = matrix[cls.id]?.[day]?.[period];
        if (!slot) {
          row.push('');
        } else {
          const subName = getSubjectName(slot.subjectId);
          const teacherCode = getTeacherCode(slot.teacherId);
          row.push(teacherCode ? `${subName} (${teacherCode})` : subName);
        }
      });
      rows.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 12 }, ...periods.map(() => ({ wch: 18 }))];
    XLSX.utils.book_append_sheet(wb, ws, cls.name.slice(0, 31));
  });

  // Summary sheet
  const summaryRows: string[][] = [
    [`School: ${school.name}`],
    [`Academic Year: ${school.academic_year}`],
    [`Working Days: ${school.working_days}`],
    [`Periods Per Day: ${school.periods_per_day}`],
    [],
    ['Class', 'Total Periods', 'Subjects'],
  ];

  classes.forEach(cls => {
    let count = 0;
    const subjectSet = new Set<string>();
    days.forEach(day => {
      periods.forEach(period => {
        const slot = matrix[cls.id]?.[day]?.[period];
        if (slot?.subjectId && !['FREE', 'LUNCH', 'ASSEMBLY'].includes(slot.subjectId)) {
          count++;
          subjectSet.add(slot.subjectId);
        }
      });
    });
    const subjectNames = Array.from(subjectSet)
      .map(id => subjects.find(s => s.id === id)?.name || id)
      .join(', ');
    summaryRows.push([cls.name, String(count), subjectNames]);
  });

  const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

  XLSX.writeFile(wb, `${school.name}_Timetable_${school.academic_year}.xlsx`);
}

export function exportTimetableCSV({ matrix, classes, subjects, teachers, school }: ExportOptions) {
  const days = school.working_days === 'MON_SAT' ? DAYS_MON_SAT : DAYS_MON_FRI;
  const periods = Array.from({ length: school.periods_per_day }, (_, i) => i + 1);

  const getSubjectName = (id?: string) => {
    if (!id || id === 'FREE') return 'Free';
    if (id === 'LUNCH') return 'Lunch';
    if (id === 'ASSEMBLY') return 'Assembly';
    return subjects.find(s => s.id === id)?.name || id;
  };

  const getTeacherCode = (id?: string) => {
    if (!id) return '';
    return teachers.find(t => t.id === id)?.code || '';
  };

  let csvContent = `School Timetable — ${school.name} (${school.academic_year})\n\n`;

  classes.forEach(cls => {
    csvContent += `Class: ${cls.name}\n`;
    csvContent += `Day,${periods.map(p => `Period ${p}`).join(',')}\n`;

    days.forEach(day => {
      const row = [day];
      periods.forEach(period => {
        const slot = matrix[cls.id]?.[day]?.[period];
        if (!slot) {
          row.push('');
        } else {
          const subName = getSubjectName(slot.subjectId);
          const teacherCode = getTeacherCode(slot.teacherId);
          row.push(teacherCode ? `"${subName} (${teacherCode})"` : `"${subName}"`);
        }
      });
      csvContent += `${row.join(',')}\n`;
    });

    csvContent += '\n';
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${school.name}_Timetable_${school.academic_year}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
