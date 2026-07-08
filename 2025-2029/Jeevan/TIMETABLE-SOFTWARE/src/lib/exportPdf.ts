import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { TimetableMatrix, Class, Subject, Teacher, School } from '../types';
import { DAYS_MON_FRI, DAYS_MON_SAT } from './algorithm';

interface ExportOptions {
  matrix: TimetableMatrix;
  classes: Class[];
  subjects: Subject[];
  teachers: Teacher[];
  school: School;
}

export function exportTimetablePDF({ matrix, classes, subjects, teachers, school }: ExportOptions) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
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

  // Title page
  doc.setFontSize(20);
  doc.setTextColor(60, 60, 60);
  doc.text(school.name, 148, 20, { align: 'center' });
  doc.setFontSize(14);
  doc.text(`Academic Year: ${school.academic_year}`, 148, 30, { align: 'center' });
  doc.setFontSize(12);
  doc.text('SCHOOL TIMETABLE', 148, 40, { align: 'center' });
  doc.setLineWidth(0.5);
  doc.line(20, 44, 277, 44);

  let currentY = 50;

  classes.forEach((cls, idx) => {
    if (idx > 0) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(13);
    doc.setTextColor(40, 40, 40);
    doc.text(`Class: ${cls.name}`, 20, currentY);
    currentY += 8;

    const head = [['Day / Period', ...periods.map(p => `P${p}`)]];
    const body = days.map(day => {
      const row: string[] = [day];
      periods.forEach(period => {
        const slot = matrix[cls.id]?.[day]?.[period];
        if (!slot) {
          row.push('');
        } else {
          const subName = getSubjectName(slot.subjectId);
          const teacherCode = getTeacherCode(slot.teacherId);
          row.push(teacherCode ? `${subName}\n${teacherCode}` : subName);
        }
      });
      return row;
    });

    autoTable(doc, {
      startY: currentY,
      head,
      body,
      theme: 'grid',
      headStyles: { fillColor: [67, 56, 202], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 8, halign: 'center', cellPadding: 3 },
      alternateRowStyles: { fillColor: [245, 245, 255] },
      columnStyles: { 0: { fontStyle: 'bold', halign: 'left', fillColor: [230, 230, 250] } },
    });
  });

  doc.save(`${school.name}_Timetable_${school.academic_year}.pdf`);
}

export function exportTeacherTimetablePDF({ matrix, classes, subjects, teachers, school }: ExportOptions) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const days = school.working_days === 'MON_SAT' ? DAYS_MON_SAT : DAYS_MON_FRI;
  const periods = Array.from({ length: school.periods_per_day }, (_, i) => i + 1);

  const getSubjectName = (id?: string) => {
    if (!id || id === 'FREE') return '-';
    if (id === 'LUNCH') return 'Lunch';
    if (id === 'ASSEMBLY') return 'Assembly';
    return subjects.find(s => s.id === id)?.code || id;
  };

  const getClassName = (id: string) => classes.find(c => c.id === id)?.name || id;

  teachers.forEach((teacher, idx) => {
    if (idx > 0) doc.addPage();

    doc.setFontSize(14);
    doc.text(`Teacher: ${teacher.name} (${teacher.code})`, 20, 20);

    const head = [['Day / Period', ...periods.map(p => `P${p}`)]];
    const body = days.map(day => {
      const row: string[] = [day];
      periods.forEach(period => {
        // Find if this teacher is assigned anywhere at this slot
        let cellContent = '-';
        for (const cls of classes) {
          const slot = matrix[cls.id]?.[day]?.[period];
          if (slot?.teacherId === teacher.id) {
            cellContent = `${getSubjectName(slot.subjectId)}\n${getClassName(cls.id)}`;
            break;
          }
        }
        row.push(cellContent);
      });
      return row;
    });

    autoTable(doc, {
      startY: 28,
      head,
      body,
      theme: 'grid',
      headStyles: { fillColor: [5, 150, 105], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 8, halign: 'center', cellPadding: 3 },
      alternateRowStyles: { fillColor: [245, 255, 250] },
      columnStyles: { 0: { fontStyle: 'bold', halign: 'left', fillColor: [220, 252, 231] } },
    });
  });

  doc.save(`${school.name}_Teacher_Timetable_${school.academic_year}.pdf`);
}
