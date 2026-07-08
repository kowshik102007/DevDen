-- ============================================
-- School Timetable Generator - Supabase Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Schools table
CREATE TABLE IF NOT EXISTS schools (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  academic_year TEXT NOT NULL DEFAULT '2024-2025',
  working_days TEXT NOT NULL DEFAULT 'MON_FRI' CHECK (working_days IN ('MON_FRI', 'MON_SAT')),
  periods_per_day INTEGER NOT NULL DEFAULT 8 CHECK (periods_per_day BETWEEN 4 AND 12),
  period_timings JSONB NOT NULL DEFAULT '[]',
  lunch_break JSONB NOT NULL DEFAULT '{"after_period": 4, "start_time": "12:00", "end_time": "12:45"}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Classes table
CREATE TABLE IF NOT EXISTS classes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  grade TEXT NOT NULL,
  division TEXT NOT NULL,
  class_teacher_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, name)
);

-- Subjects table
CREATE TABLE IF NOT EXISTS subjects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  color_class TEXT NOT NULL DEFAULT 'subject-default',
  is_lab BOOLEAN DEFAULT FALSE,
  allows_double BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, code)
);

-- Teachers table
CREATE TABLE IF NOT EXISTS teachers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  email TEXT,
  max_periods_per_day INTEGER DEFAULT 6,
  max_periods_per_week INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, code)
);

-- Class-Subject-Teacher assignments
CREATE TABLE IF NOT EXISTS class_subjects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  weekly_periods INTEGER NOT NULL DEFAULT 1 CHECK (weekly_periods > 0),
  UNIQUE(class_id, subject_id)
);

-- Teacher availability restrictions
CREATE TABLE IF NOT EXISTS teacher_availability (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
  day TEXT NOT NULL CHECK (day IN ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT')),
  period INTEGER NOT NULL,
  available BOOLEAN DEFAULT FALSE,
  UNIQUE(teacher_id, day, period)
);

-- Timetables (generated)
CREATE TABLE IF NOT EXISTS timetables (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled Timetable',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'paid', 'published')),
  matrix JSONB NOT NULL DEFAULT '{}',
  violations JSONB DEFAULT '[]',
  payment_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  timetable_id UUID REFERENCES timetables(id) ON DELETE SET NULL,
  amount DECIMAL(10,2) NOT NULL DEFAULT 20.00,
  currency TEXT DEFAULT 'INR',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  payment_method TEXT,
  razorpay_payment_id TEXT,
  upi_transaction_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetables ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Users can only see their own school's data
CREATE POLICY "Users own schools" ON schools
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users access own classes" ON classes
  FOR ALL USING (school_id IN (SELECT id FROM schools WHERE user_id = auth.uid()));

CREATE POLICY "Users access own subjects" ON subjects
  FOR ALL USING (school_id IN (SELECT id FROM schools WHERE user_id = auth.uid()));

CREATE POLICY "Users access own teachers" ON teachers
  FOR ALL USING (school_id IN (SELECT id FROM schools WHERE user_id = auth.uid()));

CREATE POLICY "Users access own class_subjects" ON class_subjects
  FOR ALL USING (class_id IN (
    SELECT c.id FROM classes c
    JOIN schools s ON c.school_id = s.id
    WHERE s.user_id = auth.uid()
  ));

CREATE POLICY "Users access own teacher_availability" ON teacher_availability
  FOR ALL USING (teacher_id IN (
    SELECT t.id FROM teachers t
    JOIN schools s ON t.school_id = s.id
    WHERE s.user_id = auth.uid()
  ));

CREATE POLICY "Users access own timetables" ON timetables
  FOR ALL USING (school_id IN (SELECT id FROM schools WHERE user_id = auth.uid()));

CREATE POLICY "Users access own payments" ON payments
  FOR ALL USING (school_id IN (SELECT id FROM schools WHERE user_id = auth.uid()));

-- ============================================
-- Indexes for performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_classes_school_id ON classes(school_id);
CREATE INDEX IF NOT EXISTS idx_subjects_school_id ON subjects(school_id);
CREATE INDEX IF NOT EXISTS idx_teachers_school_id ON teachers(school_id);
CREATE INDEX IF NOT EXISTS idx_class_subjects_class_id ON class_subjects(class_id);
CREATE INDEX IF NOT EXISTS idx_class_subjects_teacher_id ON class_subjects(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_availability_teacher_id ON teacher_availability(teacher_id);
CREATE INDEX IF NOT EXISTS idx_timetables_school_id ON timetables(school_id);
CREATE INDEX IF NOT EXISTS idx_payments_school_id ON payments(school_id);

-- ============================================
-- Updated_at trigger
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_schools_updated_at BEFORE UPDATE ON schools
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_timetables_updated_at BEFORE UPDATE ON timetables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
