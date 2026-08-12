/**
 * NW28 Attendance Calculation Engine
 * 
 * Pure calculation module — no database, no UI, no side effects.
 * 
 * LOCKED BUSINESS RULES:
 * - 1 HARI KERJA NORMAL = 8 JAM PAYROLL (bukan 7)
 * - Istirahat 12:00–13:00 tidak mengurangi nilai hari normal
 * - Hourly rate = daily_rate / 8
 * - Normal block: 8 CALENDAR hours from clockIn
 * - Lunch break: 12:00–13:00 (display only, tidak kurangi payroll)
 * - Overtime break: 18:00–19:00 (deducted from overtime)
 * - Late arrival: normal_day tetap 1, overtime opportunity berkurang
 * 
 * Overtime formula:
 *   rawOvertime = max(0, (clockOut - clockIn) - 8)
 *   breakDeduction = (clockOut > 18:00 AND rawOvertime > 0) ? 1 : 0
 *   actualOvertime = max(0, rawOvertime - breakDeduction)
 */

// ─── Types ────────────────────────────────────────────────────────────

export type SegmentType = 'NORMAL' | 'BREAK' | 'OVERTIME';

export interface TimelineSegment {
  start: number;
  end: number;
  type: SegmentType;
  durationHours: number;
}

export interface AttendanceInput {
  clockIn: string;  // "HH:MM" format
  clockOut: string; // "HH:MM" format
}

export interface AttendanceResult {
  normalDay: number;
  normalPayrollHours: number;  // ALWAYS 8 for payroll
  normalEffectiveHours: number; // Timeline effective (ex break), for display
  lateMinutes: number;
  actualOvertimeHours: number;
  timelineSegments: TimelineSegment[];
  isException: boolean;
  exceptionReason?: string;
}

export interface PayrollInput {
  normalDay: number;
  actualOvertimeHours: number;
  paidOvertimeHours: number;
  dailyRate: number;
  overtimeRate: number;
}

export interface PayrollResult {
  normalPay: number;
  overtimePay: number;
  totalPay: number;
}

export interface ProjectAllocationInput {
  projectId: string;
  normalHours: number;
  overtimeHours: number;
}

export interface ProjectCostResult {
  projectId: string;
  normalCost: number;
  overtimeCost: number;
  totalCost: number;
}

// ─── Constants ────────────────────────────────────────────────────────

const NORMAL_START = 8;
const LUNCH_START = 12;
const LUNCH_END = 13;
const NORMAL_END = 16;
const OT_BREAK_START = 18;
const OT_BREAK_END = 19;
const NORMAL_BLOCK_HOURS = 8;
const NORMAL_PAYROLL_HOURS = 8;  // LOCKED: 1 day = 8 payroll hours
const DAILY_RATE_DIVISOR = 8;    // LOCKED: hourly = daily / 8

// ─── Helpers ──────────────────────────────────────────────────────────

function parseTime(time: string): number {
  const [h, m] = time.split(':').map(Number);
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    throw new Error(`Invalid time format: ${time}`);
  }
  return h + m / 60;
}

function formatHour(h: number): string {
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

// ─── Main Calculation ─────────────────────────────────────────────────

export function calculateAttendance(input: AttendanceInput): AttendanceResult {
  const clockIn = parseTime(input.clockIn);
  const clockOut = parseTime(input.clockOut);

  // ── Exception: clock_out <= clock_in ──
  if (clockOut <= clockIn) {
    return makeException('RULE NOT CONFIGURED: clock_out <= clock_in (overnight shift or missing data)');
  }

  // ── Exception: arrives at/after normal end ──
  if (clockIn >= NORMAL_END) {
    return makeException(`RULE NOT CONFIGURED: clock_in at ${formatHour(clockIn)} is after normal work end (16:00)`);
  }

  // ── Exception: leaves before normal end ──
  if (clockOut < NORMAL_END) {
    return makeException(`RULE NOT CONFIGURED: clock_out at ${formatHour(clockOut)} is before normal work end (16:00)`);
  }

  // ── Late minutes ──
  const lateMinutes = clockIn > NORMAL_START
    ? Math.round((clockIn - NORMAL_START) * 60)
    : 0;

  // ── Normal day is always 1 ──
  const normalDay = 1;

  // ── PAYROLL normal hours is ALWAYS 8 ──
  const normalPayrollHours = NORMAL_PAYROLL_HOURS;

  // ── Overtime calculation ──
  const totalSpan = clockOut - clockIn;
  const rawOvertime = Math.max(0, totalSpan - NORMAL_BLOCK_HOURS);
  const breakDeduction = (clockOut > OT_BREAK_START && rawOvertime > 0)
    ? Math.min(1, rawOvertime)
    : 0;
  const actualOvertimeHours = Math.max(0, rawOvertime - breakDeduction);

  // ── Normal block end ──
  const normalBlockEnd = clockIn + NORMAL_BLOCK_HOURS;

  // ── Build timeline segments for display ──
  const segments = buildTimeline(clockIn, clockOut, normalBlockEnd);

  // ── Effective normal hours = sum of NORMAL segments (for display) ──
  const normalEffectiveHours = segments
    .filter(s => s.type === 'NORMAL')
    .reduce((sum, s) => sum + s.durationHours, 0);

  return {
    normalDay,
    normalPayrollHours,
    normalEffectiveHours,
    lateMinutes,
    actualOvertimeHours,
    timelineSegments: segments,
    isException: false,
  };
}

function makeException(reason: string): AttendanceResult {
  return {
    normalDay: 0,
    normalPayrollHours: 0,
    normalEffectiveHours: 0,
    lateMinutes: 0,
    actualOvertimeHours: 0,
    timelineSegments: [],
    isException: true,
    exceptionReason: reason,
  };
}

function buildTimeline(clockIn: number, clockOut: number, normalBlockEnd: number): TimelineSegment[] {
  const segments: TimelineSegment[] = [];

  // Phase 1: Normal block (clockIn to normalBlockEnd)
  if (clockIn < LUNCH_START && normalBlockEnd > LUNCH_START) {
    segments.push(seg(clockIn, LUNCH_START, 'NORMAL'));
    const lunchEnd = Math.min(LUNCH_END, normalBlockEnd);
    segments.push(seg(LUNCH_START, lunchEnd, 'BREAK'));
    if (normalBlockEnd > LUNCH_END) {
      segments.push(seg(LUNCH_END, normalBlockEnd, 'NORMAL'));
    }
  } else if (clockIn >= LUNCH_START && clockIn < LUNCH_END) {
    segments.push(seg(clockIn, LUNCH_END, 'BREAK'));
    if (normalBlockEnd > LUNCH_END) {
      segments.push(seg(LUNCH_END, normalBlockEnd, 'NORMAL'));
    }
  } else {
    segments.push(seg(clockIn, normalBlockEnd, 'NORMAL'));
  }

  // Phase 2: Overtime zone (normalBlockEnd to clockOut)
  if (clockOut > normalBlockEnd) {
    const otStart = normalBlockEnd;
    
    if (otStart < OT_BREAK_START) {
      if (clockOut <= OT_BREAK_START) {
        segments.push(seg(otStart, clockOut, 'OVERTIME'));
      } else {
        segments.push(seg(otStart, OT_BREAK_START, 'OVERTIME'));
        if (clockOut <= OT_BREAK_END) {
          segments.push(seg(OT_BREAK_START, clockOut, 'BREAK'));
        } else {
          segments.push(seg(OT_BREAK_START, OT_BREAK_END, 'BREAK'));
          segments.push(seg(OT_BREAK_END, clockOut, 'OVERTIME'));
        }
      }
    } else if (otStart >= OT_BREAK_START && otStart < OT_BREAK_END) {
      if (clockOut <= OT_BREAK_END) {
        segments.push(seg(otStart, clockOut, 'BREAK'));
      } else {
        segments.push(seg(otStart, OT_BREAK_END, 'BREAK'));
        segments.push(seg(OT_BREAK_END, clockOut, 'OVERTIME'));
      }
    } else {
      segments.push(seg(otStart, clockOut, 'OVERTIME'));
    }
  }

  return segments;
}

function seg(start: number, end: number, type: SegmentType): TimelineSegment {
  return { start, end, type, durationHours: end - start };
}

// ─── Payroll Calculation ──────────────────────────────────────────────

export function calculatePayroll(input: PayrollInput): PayrollResult {
  const { normalDay, paidOvertimeHours, dailyRate, overtimeRate } = input;
  const normalPay = normalDay * dailyRate;
  const overtimePay = paidOvertimeHours * overtimeRate;
  return { normalPay, overtimePay, totalPay: normalPay + overtimePay };
}

export function calculateHourlyRate(dailyRate: number): number {
  return dailyRate / DAILY_RATE_DIVISOR;
}

// ─── Project Costing ──────────────────────────────────────────────────

export function calculateProjectCost(
  allocation: ProjectAllocationInput,
  dailyRate: number,
  overtimeRate: number
): ProjectCostResult {
  const normalHourlyRate = dailyRate / DAILY_RATE_DIVISOR;
  const normalCost = allocation.normalHours * normalHourlyRate;
  const overtimeCost = allocation.overtimeHours * overtimeRate;
  return {
    projectId: allocation.projectId,
    normalCost,
    overtimeCost,
    totalCost: normalCost + overtimeCost,
  };
}

// ─── Validation ───────────────────────────────────────────────────────

export function validatePaidOvertime(
  actualOvertime: number,
  paidOvertime: number
): { valid: boolean; error?: string } {
  if (paidOvertime > actualOvertime) {
    return { valid: false, error: 'Paid overtime tidak boleh lebih besar dari actual overtime.' };
  }
  if (paidOvertime < 0) {
    return { valid: false, error: 'Paid overtime tidak boleh negatif.' };
  }
  return { valid: true };
}

export function validateNormalAllocation(
  allocations: ProjectAllocationInput[],
  expectedNormalHours: number
): { valid: boolean; actual: number; expected: number; error?: string } {
  const total = allocations.reduce((sum, a) => sum + a.normalHours, 0);
  if (Math.abs(total - expectedNormalHours) > 0.01) {
    return {
      valid: false,
      actual: total,
      expected: expectedNormalHours,
      error: `Normal allocation (${total} jam) tidak sama dengan expected (${expectedNormalHours} jam).`,
    };
  }
  return { valid: true, actual: total, expected: expectedNormalHours };
}

export function validateOvertimeAllocation(
  allocations: ProjectAllocationInput[],
  paidOvertimeHours: number
): { valid: boolean; actual: number; expected: number; error?: string } {
  const total = allocations.reduce((sum, a) => sum + a.overtimeHours, 0);
  if (Math.abs(total - paidOvertimeHours) > 0.01) {
    return {
      valid: false,
      actual: total,
      expected: paidOvertimeHours,
      error: `OT allocation (${total} jam) tidak sama dengan paid OT (${paidOvertimeHours} jam).`,
    };
  }
  return { valid: true, actual: total, expected: paidOvertimeHours };
}

// ─── Check / Balance ──────────────────────────────────────────────────

export interface CheckBalanceResult {
  employeeTotal: number;
  projectTotal: number;
  isValid: boolean;
  difference: number;
}

export function checkBalance(
  employeeTotal: number,
  projectTotal: number
): CheckBalanceResult {
  const difference = Math.abs(employeeTotal - projectTotal);
  return {
    employeeTotal,
    projectTotal,
    isValid: difference < 1,
    difference,
  };
}
