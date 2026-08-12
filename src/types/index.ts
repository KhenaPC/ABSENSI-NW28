// ─── Database Types ───────────────────────────────────────────────────

export interface Employee {
  id: string;
  name: string;
  position: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmployeeRateHistory {
  id: string;
  employee_id: string;
  effective_from: string;
  effective_to: string | null;
  daily_rate: number;
  overtime_rate: number;
  created_by: string | null;
  created_at: string;
}

export type PayrollPeriodStatus = 'OPEN' | 'LOCKED' | 'PAID';

export interface PayrollPeriod {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: PayrollPeriodStatus;
  created_at: string;
  updated_at: string;
}

export interface Attendance {
  id: string;
  employee_id: string;
  work_date: string;
  clock_in: string;
  clock_out: string;
  normal_day: number;
  normal_hours: number;
  normal_payroll_hours: number;
  late_minutes: number;
  actual_overtime_hours: number;
  paid_overtime_hours: number;
  paid_overtime_reason: string | null;
  daily_rate_snapshot: number;
  hourly_rate_snapshot: number;
  overtime_rate_snapshot: number;
  normal_pay: number;
  overtime_pay: number;
  is_exception: boolean;
  exception_reason: string | null;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttendanceProject {
  id: string;
  attendance_id: string;
  project_id: string;
  normal_hours: number;
  overtime_hours: number;
  allocation_hours: number; // legacy, kept for compat
  allocation_note: string | null;
}

export interface Advance {
  id: string;
  employee_id: string;
  advance_date: string;
  amount: number;
  project_id: string | null;
  description: string | null;
  deducted: boolean;
  deducted_period_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

// ─── UI Types ─────────────────────────────────────────────────────────

export type UserRole = 'OWNER' | 'ADMIN';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  name: string;
}

export interface AttendanceFormData {
  employeeId: string;
  workDate: string;
  clockIn: string;
  clockOut: string;
  projects: { projectId: string; normalHours: number; overtimeHours: number }[];
  paidOvertimeHours?: number;
  paidOvertimeReason?: string;
  notes?: string;
}

export interface EmployeeRecap {
  employeeId: string;
  employeeName: string;
  position: string;
  totalDays: number;
  totalOvertimeHours: number;
  totalNormalPay: number;
  totalOvertimePay: number;
  totalPay: number;
  totalKasbon: number;
  netPay: number;
  dailyRate: number;
  hourlyRate: number;
  overtimeRate: number;
}

export interface ProjectRecap {
  projectId: string;
  projectName: string;
  normalHours: number;
  overtimeHours: number;
  normalCost: number;
  overtimeCost: number;
  grandTotal: number;
}

export interface ExcelEmployeeData {
  name: string;
  position: string;
  period: string;
  kasbonAmount: number;
  kasbonProject: string;
  dailyRate: number;
  hourlyRate: number;
  overtimeRate: number;
  projects: {
    name: string;
    normalHours: number;
    overtimeHours: number;
    normalCost: number;
    overtimeCost: number;
    total: number;
  }[];
  checkBalance: {
    totalUpah: number;
    totalRekapProyek: number;
    isValid: boolean;
  };
  attendances: {
    dayName: string;
    clockIn: string | null;
    clockOut: string | null;
    workHours: number;
    overtimeHours: number;
    normalDay: number;
    activeOvertime: number;
    projectName: string;
    dailyPay: number;
    overtimePay: number;
  }[];
  totalUpah: number;
  totalUpahDiterima: number;
}
