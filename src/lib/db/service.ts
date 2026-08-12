import { SupabaseClient } from '@supabase/supabase-js';
import type {
  Employee, Project, EmployeeRateHistory, PayrollPeriod,
  Attendance, AttendanceProject, Advance, PayrollPeriodStatus,
} from '@/types';

// ─── Employees ────────────────────────────────────────────────────

export async function getEmployees(supabase: SupabaseClient, activeOnly = false) {
  let query = supabase.from('employees').select('*').order('name');
  if (activeOnly) query = query.eq('active', true);
  const { data, error } = await query;
  if (error) throw error;
  return data as Employee[];
}

export async function createEmployee(
  supabase: SupabaseClient,
  data: { name: string; position: string; daily_rate: number; overtime_rate: number }
) {
  const { data: emp, error: empErr } = await supabase
    .from('employees')
    .insert({ name: data.name, position: data.position })
    .select()
    .single();
  if (empErr) throw empErr;

  const { error: rateErr } = await supabase
    .from('employee_rate_history')
    .insert({
      employee_id: emp.id,
      effective_from: new Date().toISOString().split('T')[0],
      daily_rate: data.daily_rate,
      overtime_rate: data.overtime_rate,
    });
  if (rateErr) throw rateErr;
  return emp as Employee;
}

export async function updateEmployee(
  supabase: SupabaseClient,
  id: string,
  data: Partial<Pick<Employee, 'name' | 'position' | 'active'>>
) {
  const { data: emp, error } = await supabase
    .from('employees')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return emp as Employee;
}

// ─── Employee Rates ───────────────────────────────────────────────

export async function getEmployeeRate(supabase: SupabaseClient, employeeId: string, date: string) {
  const { data, error } = await supabase
    .from('employee_rate_history')
    .select('*')
    .eq('employee_id', employeeId)
    .lte('effective_from', date)
    .or(`effective_to.is.null,effective_to.gt.${date}`)
    .order('effective_from', { ascending: false })
    .limit(1)
    .single();
  if (error) throw error;
  return data as EmployeeRateHistory;
}

export async function getEmployeeRateHistory(supabase: SupabaseClient, employeeId: string) {
  const { data, error } = await supabase
    .from('employee_rate_history')
    .select('*')
    .eq('employee_id', employeeId)
    .order('effective_from', { ascending: false });
  if (error) throw error;
  return data as EmployeeRateHistory[];
}

export async function addEmployeeRate(
  supabase: SupabaseClient,
  data: { employee_id: string; effective_from: string; daily_rate: number; overtime_rate: number }
) {
  // Close the previous rate
  const { data: prev } = await supabase
    .from('employee_rate_history')
    .select('id')
    .eq('employee_id', data.employee_id)
    .is('effective_to', null)
    .order('effective_from', { ascending: false })
    .limit(1);

  if (prev && prev.length > 0) {
    await supabase
      .from('employee_rate_history')
      .update({ effective_to: data.effective_from })
      .eq('id', prev[0].id);
  }

  const { error } = await supabase.from('employee_rate_history').insert(data);
  if (error) throw error;
}

// ─── Projects ─────────────────────────────────────────────────────

export async function getProjects(supabase: SupabaseClient, activeOnly = false) {
  let query = supabase.from('projects').select('*').order('name');
  if (activeOnly) query = query.eq('active', true);
  const { data, error } = await query;
  if (error) throw error;
  return data as Project[];
}

export async function createProject(supabase: SupabaseClient, data: { code: string; name: string }) {
  const { data: proj, error } = await supabase.from('projects').insert(data).select().single();
  if (error) throw error;
  return proj as Project;
}

export async function updateProject(
  supabase: SupabaseClient,
  id: string,
  data: Partial<Pick<Project, 'name' | 'code' | 'active'>>
) {
  const { data: proj, error } = await supabase
    .from('projects')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return proj as Project;
}

// ─── Payroll Periods ──────────────────────────────────────────────

export async function getPayrollPeriods(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('payroll_periods')
    .select('*')
    .order('start_date', { ascending: false });
  if (error) throw error;
  return data as PayrollPeriod[];
}

export async function createPayrollPeriod(
  supabase: SupabaseClient,
  data: { name: string; start_date: string; end_date: string }
) {
  const { data: period, error } = await supabase
    .from('payroll_periods')
    .insert(data)
    .select()
    .single();
  if (error) throw error;
  return period as PayrollPeriod;
}

export async function updatePayrollPeriodStatus(
  supabase: SupabaseClient,
  id: string,
  status: PayrollPeriodStatus
) {
  const { data, error } = await supabase
    .from('payroll_periods')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as PayrollPeriod;
}

// ─── Attendance ───────────────────────────────────────────────────

export async function getAttendanceByDate(supabase: SupabaseClient, date: string) {
  const { data, error } = await supabase
    .from('attendance')
    .select(`*, employees(name, position), attendance_projects(*, projects(name, code))`)
    .eq('work_date', date)
    .order('created_at');
  if (error) throw error;
  return data;
}

export async function getAttendanceByPeriod(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string
) {
  const { data, error } = await supabase
    .from('attendance')
    .select(`*, employees(name, position), attendance_projects(*, projects(name, code))`)
    .gte('work_date', startDate)
    .lte('work_date', endDate)
    .order('work_date')
    .order('created_at');
  if (error) throw error;
  return data;
}

export async function getAttendanceByEmployeeAndPeriod(
  supabase: SupabaseClient,
  employeeId: string,
  startDate: string,
  endDate: string
) {
  const { data, error } = await supabase
    .from('attendance')
    .select(`*, attendance_projects(*, projects(name, code))`)
    .eq('employee_id', employeeId)
    .gte('work_date', startDate)
    .lte('work_date', endDate)
    .order('work_date');
  if (error) throw error;
  return data;
}

export async function saveAttendance(
  supabase: SupabaseClient,
  attendance: Omit<Attendance, 'id' | 'created_at' | 'updated_at'>,
  projects: { project_id: string; normal_hours: number; overtime_hours: number; allocation_note?: string }[]
) {
  // Check if attendance exists for this employee+date
  const { data: existing } = await supabase
    .from('attendance')
    .select('id')
    .eq('employee_id', attendance.employee_id)
    .eq('work_date', attendance.work_date)
    .limit(1);

  let attendanceId: string;

  if (existing && existing.length > 0) {
    // Update
    attendanceId = existing[0].id;
    const { error } = await supabase
      .from('attendance')
      .update({ ...attendance, updated_at: new Date().toISOString() })
      .eq('id', attendanceId);
    if (error) throw error;

    // Delete old project allocations
    await supabase.from('attendance_projects').delete().eq('attendance_id', attendanceId);
  } else {
    // Insert
    const { data: newAtt, error } = await supabase
      .from('attendance')
      .insert(attendance)
      .select()
      .single();
    if (error) throw error;
    attendanceId = newAtt.id;
  }

  // Insert project allocations
  if (projects.length > 0) {
    const projData = projects.map(p => ({
      attendance_id: attendanceId,
      project_id: p.project_id,
      normal_hours: p.normal_hours,
      overtime_hours: p.overtime_hours,
      allocation_hours: p.normal_hours + p.overtime_hours,
      allocation_note: p.allocation_note || null,
    }));
    const { error } = await supabase.from('attendance_projects').insert(projData);
    if (error) throw error;
  }

  return attendanceId;
}

// ─── Advances (Kasbon) ───────────────────────────────────────────

export async function getAdvances(supabase: SupabaseClient, filters?: {
  employeeId?: string;
  startDate?: string;
  endDate?: string;
}) {
  let query = supabase
    .from('advances')
    .select(`*, employees(name), projects(name)`)
    .order('advance_date', { ascending: false });

  if (filters?.employeeId) query = query.eq('employee_id', filters.employeeId);
  if (filters?.startDate) query = query.gte('advance_date', filters.startDate);
  if (filters?.endDate) query = query.lte('advance_date', filters.endDate);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createAdvance(
  supabase: SupabaseClient,
  data: Omit<Advance, 'id' | 'created_at' | 'deducted' | 'deducted_period_id'>
) {
  const { data: adv, error } = await supabase.from('advances').insert(data).select().single();
  if (error) throw error;
  return adv;
}

// ─── Audit Logs ───────────────────────────────────────────────────

export async function createAuditLog(
  supabase: SupabaseClient,
  data: {
    user_id?: string;
    entity_type: string;
    entity_id: string;
    action: string;
    old_value?: unknown;
    new_value?: unknown;
  }
) {
  await supabase.from('audit_logs').insert({
    user_id: data.user_id || null,
    entity_type: data.entity_type,
    entity_id: data.entity_id,
    action: data.action,
    old_value: data.old_value ? JSON.stringify(data.old_value) : null,
    new_value: data.new_value ? JSON.stringify(data.new_value) : null,
  });
}

// ─── Period Helpers ───────────────────────────────────────────────

export async function getPeriodForDate(supabase: SupabaseClient, date: string) {
  const { data, error } = await supabase
    .from('payroll_periods')
    .select('*')
    .lte('start_date', date)
    .gte('end_date', date)
    .limit(1);
  if (error) throw error;
  return data?.[0] as PayrollPeriod | undefined;
}

export async function isPeriodLocked(supabase: SupabaseClient, date: string): Promise<boolean> {
  const period = await getPeriodForDate(supabase, date);
  if (!period) return false;
  return period.status === 'LOCKED' || period.status === 'PAID';
}
