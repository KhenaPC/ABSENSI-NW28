-- ═══════════════════════════════════════════════════════════════════
-- NW28 ABSENSI SYSTEM — Database Schema
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- ─── User Profiles ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'ADMIN' CHECK (role IN ('OWNER', 'ADMIN')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Employees ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  position TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Projects ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Employee Rate History ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_rate_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  effective_from DATE NOT NULL,
  effective_to DATE,
  daily_rate NUMERIC NOT NULL,
  overtime_rate NUMERIC NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rate_history_employee ON employee_rate_history(employee_id, effective_from);

-- ─── Payroll Periods ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'LOCKED', 'PAID')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Attendance ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  work_date DATE NOT NULL,
  clock_in TIME NOT NULL,
  clock_out TIME NOT NULL,
  normal_day NUMERIC NOT NULL DEFAULT 0,
  normal_hours NUMERIC NOT NULL DEFAULT 0,
  late_minutes INTEGER NOT NULL DEFAULT 0,
  actual_overtime_hours NUMERIC NOT NULL DEFAULT 0,
  paid_overtime_hours NUMERIC NOT NULL DEFAULT 0,
  paid_overtime_reason TEXT,
  daily_rate_snapshot NUMERIC NOT NULL,
  hourly_rate_snapshot NUMERIC NOT NULL,
  overtime_rate_snapshot NUMERIC NOT NULL,
  normal_pay NUMERIC NOT NULL DEFAULT 0,
  overtime_pay NUMERIC NOT NULL DEFAULT 0,
  is_exception BOOLEAN NOT NULL DEFAULT FALSE,
  exception_reason TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, work_date)
);

CREATE INDEX idx_attendance_date ON attendance(work_date);
CREATE INDEX idx_attendance_employee ON attendance(employee_id, work_date);

-- ─── Attendance Projects (Multi-project allocation) ───────────────
CREATE TABLE IF NOT EXISTS attendance_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID NOT NULL REFERENCES attendance(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id),
  allocation_hours NUMERIC NOT NULL,
  allocation_note TEXT
);

CREATE INDEX idx_atten_proj ON attendance_projects(attendance_id);

-- ─── Advances (Kasbon) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS advances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  advance_date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  project_id UUID REFERENCES projects(id),
  description TEXT,
  deducted BOOLEAN NOT NULL DEFAULT FALSE,
  deducted_period_id UUID REFERENCES payroll_periods(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_advances_employee ON advances(employee_id, advance_date);

-- ─── Audit Logs ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);

-- ═══════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_rate_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read everything
CREATE POLICY "Authenticated read all" ON employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read all" ON projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read all" ON employee_rate_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read all" ON payroll_periods FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read all" ON attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read all" ON attendance_projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read all" ON advances FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read all" ON audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read own profile" ON user_profiles FOR SELECT TO authenticated USING (auth.uid() = id);

-- Authenticated users can insert/update (business logic enforced in app)
CREATE POLICY "Auth insert" ON employees FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update" ON employees FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth insert" ON projects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update" ON projects FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth insert" ON employee_rate_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth insert" ON payroll_periods FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update" ON payroll_periods FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth insert" ON attendance FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update" ON attendance FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete" ON attendance FOR DELETE TO authenticated USING (true);
CREATE POLICY "Auth insert" ON attendance_projects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update" ON attendance_projects FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete" ON attendance_projects FOR DELETE TO authenticated USING (true);
CREATE POLICY "Auth insert" ON advances FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update" ON advances FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth insert" ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth insert profile" ON user_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Auth update profile" ON user_profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- ═══════════════════════════════════════════════════════════════════
-- HELPER FUNCTION: Get effective rate for employee on a date
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_employee_rate(p_employee_id UUID, p_date DATE)
RETURNS TABLE(daily_rate NUMERIC, overtime_rate NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT erh.daily_rate, erh.overtime_rate
  FROM employee_rate_history erh
  WHERE erh.employee_id = p_employee_id
    AND erh.effective_from <= p_date
    AND (erh.effective_to IS NULL OR erh.effective_to > p_date)
  ORDER BY erh.effective_from DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
