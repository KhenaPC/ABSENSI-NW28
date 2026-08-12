import { describe, it, expect } from 'vitest';
import {
  calculateAttendance,
  calculatePayroll,
  validatePaidOvertime,
  validateNormalAllocation,
  validateOvertimeAllocation,
  calculateHourlyRate,
  calculateProjectCost,
  checkBalance,
} from '@/lib/engine/nw28-attendance-engine';
import type { ProjectAllocationInput } from '@/lib/engine/nw28-attendance-engine';

// ═══════════════════════════════════════════════════════════════
// MANDATORY TESTS (per business rules document)
// ═══════════════════════════════════════════════════════════════

describe('NW28 Mandatory Tests', () => {
  // TEST 1: 08-16 normal workday
  it('TEST 1: 08:00-16:00 = 1 day, 8 payroll hours, 0 OT', () => {
    const r = calculateAttendance({ clockIn: '08:00', clockOut: '16:00' });
    expect(r.normalDay).toBe(1);
    expect(r.normalPayrollHours).toBe(8);
    expect(r.actualOvertimeHours).toBe(0);
    expect(r.isException).toBe(false);
  });

  // TEST 2: 08-18
  it('TEST 2: 08:00-18:00 = 1 day, 8 payroll hours, 2 OT', () => {
    const r = calculateAttendance({ clockIn: '08:00', clockOut: '18:00' });
    expect(r.normalDay).toBe(1);
    expect(r.normalPayrollHours).toBe(8);
    expect(r.actualOvertimeHours).toBe(2);
  });

  // TEST 3: 08-19 (18-19 is break, so OT still 2)
  it('TEST 3: 08:00-19:00 = 1 day, 8 payroll hours, 2 OT (18-19 break)', () => {
    const r = calculateAttendance({ clockIn: '08:00', clockOut: '19:00' });
    expect(r.normalDay).toBe(1);
    expect(r.normalPayrollHours).toBe(8);
    expect(r.actualOvertimeHours).toBe(2);
  });

  // TEST 4: COLAY GOLDEN TEST 08-22
  it('TEST 4 (COLAY): 08:00-22:00 = 1 day, 8 payroll hours, 5 OT', () => {
    const r = calculateAttendance({ clockIn: '08:00', clockOut: '22:00' });
    expect(r.normalDay).toBe(1);
    expect(r.normalPayrollHours).toBe(8);
    expect(r.actualOvertimeHours).toBe(5);
  });

  // TEST 5: CEPOT GOLDEN TEST 10-22
  it('TEST 5 (CEPOT): 10:00-22:00 = 1 day, 8 payroll hours, 3 OT, 120 min late', () => {
    const r = calculateAttendance({ clockIn: '10:00', clockOut: '22:00' });
    expect(r.normalDay).toBe(1);
    expect(r.normalPayrollHours).toBe(8);
    expect(r.actualOvertimeHours).toBe(3);
    expect(r.lateMinutes).toBe(120);
  });

  // TEST 6: Project allocation validation
  it('TEST 6: Normal 8 + OT 5 allocation valid', () => {
    const alloc: ProjectAllocationInput[] = [
      { projectId: 'parfum', normalHours: 4, overtimeHours: 0 },
      { projectId: 'bin', normalHours: 4, overtimeHours: 2 },
      { projectId: 'suryalaya', normalHours: 0, overtimeHours: 3 },
    ];
    const normalV = validateNormalAllocation(alloc, 8);
    expect(normalV.valid).toBe(true);
    expect(normalV.actual).toBe(8);

    const otV = validateOvertimeAllocation(alloc, 5);
    expect(otV.valid).toBe(true);
    expect(otV.actual).toBe(5);
  });

  // TEST 7: Project normal costing
  it('TEST 7: Normal cost = hours × (daily_rate/8)', () => {
    const dailyRate = 160000;
    const otRate = 20000;

    const parfum = calculateProjectCost(
      { projectId: 'parfum', normalHours: 4, overtimeHours: 0 },
      dailyRate, otRate
    );
    expect(parfum.normalCost).toBe(80000);
    expect(parfum.overtimeCost).toBe(0);
    expect(parfum.totalCost).toBe(80000);

    const bin = calculateProjectCost(
      { projectId: 'bin', normalHours: 4, overtimeHours: 0 },
      dailyRate, otRate
    );
    expect(bin.normalCost).toBe(80000);
  });

  // TEST 8: Project OT costing
  it('TEST 8: OT cost = hours × overtime_rate', () => {
    const dailyRate = 160000;
    const otRate = 20000;

    const bin = calculateProjectCost(
      { projectId: 'bin', normalHours: 0, overtimeHours: 2 },
      dailyRate, otRate
    );
    expect(bin.overtimeCost).toBe(40000);

    const sury = calculateProjectCost(
      { projectId: 'suryalaya', normalHours: 0, overtimeHours: 3 },
      dailyRate, otRate
    );
    expect(sury.overtimeCost).toBe(60000);
  });

  // TEST 9: Check/Balance
  it('TEST 9: Project total = Employee payroll = VALID', () => {
    const dailyRate = 160000;
    const otRate = 20000;

    // Employee payroll
    const payroll = calculatePayroll({
      normalDay: 1,
      actualOvertimeHours: 5,
      paidOvertimeHours: 5,
      dailyRate,
      overtimeRate: otRate,
    });
    expect(payroll.totalPay).toBe(260000);

    // Project totals
    const parfum = calculateProjectCost({ projectId: 'p', normalHours: 4, overtimeHours: 0 }, dailyRate, otRate);
    const bin = calculateProjectCost({ projectId: 'b', normalHours: 4, overtimeHours: 2 }, dailyRate, otRate);
    const sury = calculateProjectCost({ projectId: 's', normalHours: 0, overtimeHours: 3 }, dailyRate, otRate);
    const projectTotal = parfum.totalCost + bin.totalCost + sury.totalCost;
    expect(projectTotal).toBe(260000);

    const cb = checkBalance(payroll.totalPay, projectTotal);
    expect(cb.isValid).toBe(true);
  });

  // TEST 10: Normal allocation invalid (7 instead of 8)
  it('TEST 10: Normal allocation = 7 → INVALID', () => {
    const alloc: ProjectAllocationInput[] = [
      { projectId: 'parfum', normalHours: 4, overtimeHours: 0 },
      { projectId: 'bin', normalHours: 3, overtimeHours: 0 },
    ];
    const v = validateNormalAllocation(alloc, 8);
    expect(v.valid).toBe(false);
    expect(v.actual).toBe(7);
    expect(v.expected).toBe(8);
  });

  // TEST 11: OT allocation invalid (4 vs paid 5)
  it('TEST 11: OT allocation = 4, paid OT = 5 → INVALID', () => {
    const alloc: ProjectAllocationInput[] = [
      { projectId: 'bin', normalHours: 0, overtimeHours: 2 },
      { projectId: 'sury', normalHours: 0, overtimeHours: 2 },
    ];
    const v = validateOvertimeAllocation(alloc, 5);
    expect(v.valid).toBe(false);
    expect(v.actual).toBe(4);
    expect(v.expected).toBe(5);
  });

  // TEST 12: Actual OT = 5, Paid OT = 3
  it('TEST 12: Actual OT=5, Paid OT=3 → payroll uses 3, actual remains 5', () => {
    const result = calculateAttendance({ clockIn: '08:00', clockOut: '22:00' });
    expect(result.actualOvertimeHours).toBe(5);

    const payroll = calculatePayroll({
      normalDay: 1,
      actualOvertimeHours: 5,
      paidOvertimeHours: 3,
      dailyRate: 160000,
      overtimeRate: 20000,
    });
    expect(payroll.normalPay).toBe(160000);
    expect(payroll.overtimePay).toBe(60000);
    expect(payroll.totalPay).toBe(220000);

    // Actual OT stays 5
    expect(result.actualOvertimeHours).toBe(5);
  });

  // TEST 13: Paid OT > actual OT → invalid
  it('TEST 13: Paid OT > actual OT → INVALID', () => {
    const v = validatePaidOvertime(5, 7);
    expect(v.valid).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// ADDITIONAL TESTS
// ═══════════════════════════════════════════════════════════════

describe('NW28 Engine — Additional Tests', () => {
  it('Hourly rate = daily / 8', () => {
    expect(calculateHourlyRate(160000)).toBe(20000);
    expect(calculateHourlyRate(200000)).toBe(25000);
  });

  it('09:00-22:00 = 1 day, 8 payroll, 4 OT, 60 min late', () => {
    const r = calculateAttendance({ clockIn: '09:00', clockOut: '22:00' });
    expect(r.normalDay).toBe(1);
    expect(r.normalPayrollHours).toBe(8);
    expect(r.actualOvertimeHours).toBe(4);
    expect(r.lateMinutes).toBe(60);
  });

  it('11:00-22:00 = 1 day, 8 payroll, 2 OT, 180 min late', () => {
    const r = calculateAttendance({ clockIn: '11:00', clockOut: '22:00' });
    expect(r.normalDay).toBe(1);
    expect(r.normalPayrollHours).toBe(8);
    expect(r.actualOvertimeHours).toBe(2);
    expect(r.lateMinutes).toBe(180);
  });

  it('12:00-22:00 = 1 day, 8 payroll, 1 OT, 240 min late', () => {
    const r = calculateAttendance({ clockIn: '12:00', clockOut: '22:00' });
    expect(r.normalDay).toBe(1);
    expect(r.normalPayrollHours).toBe(8);
    expect(r.actualOvertimeHours).toBe(1);
    expect(r.lateMinutes).toBe(240);
  });

  it('08:00-17:00 = 1 day, 8 payroll, 1 OT', () => {
    const r = calculateAttendance({ clockIn: '08:00', clockOut: '17:00' });
    expect(r.normalDay).toBe(1);
    expect(r.normalPayrollHours).toBe(8);
    expect(r.actualOvertimeHours).toBe(1);
  });

  it('Clock out before 16:00 → exception', () => {
    const r = calculateAttendance({ clockIn: '08:00', clockOut: '15:00' });
    expect(r.isException).toBe(true);
  });

  it('Clock in >= 16:00 → exception', () => {
    const r = calculateAttendance({ clockIn: '16:00', clockOut: '22:00' });
    expect(r.isException).toBe(true);
  });

  it('Clock out <= clock in → exception', () => {
    const r = calculateAttendance({ clockIn: '20:00', clockOut: '08:00' });
    expect(r.isException).toBe(true);
  });

  it('Paid overtime = 0 is valid', () => {
    const v = validatePaidOvertime(5, 0);
    expect(v.valid).toBe(true);
  });

  it('Paid overtime negative → invalid', () => {
    const v = validatePaidOvertime(5, -1);
    expect(v.valid).toBe(false);
  });

  it('Check/Balance with mismatch → invalid', () => {
    const cb = checkBalance(260000, 250000);
    expect(cb.isValid).toBe(false);
  });

  it('Multi-project golden test with full costing', () => {
    const dailyRate = 160000;
    const otRate = 20000;

    const alloc: ProjectAllocationInput[] = [
      { projectId: 'parfum', normalHours: 4, overtimeHours: 0 },
      { projectId: 'bin', normalHours: 4, overtimeHours: 2 },
      { projectId: 'suryalaya', normalHours: 0, overtimeHours: 3 },
    ];

    // Validate allocations
    expect(validateNormalAllocation(alloc, 8).valid).toBe(true);
    expect(validateOvertimeAllocation(alloc, 5).valid).toBe(true);

    // Calculate costs
    const costs = alloc.map(a => calculateProjectCost(a, dailyRate, otRate));
    expect(costs[0].totalCost).toBe(80000);  // PARFUM: 4×20k
    expect(costs[1].totalCost).toBe(120000); // BIN: 4×20k + 2×20k
    expect(costs[2].totalCost).toBe(60000);  // SURYALAYA: 3×20k

    const projectTotal = costs.reduce((s, c) => s + c.totalCost, 0);
    expect(projectTotal).toBe(260000);

    // Payroll
    const payroll = calculatePayroll({
      normalDay: 1, actualOvertimeHours: 5, paidOvertimeHours: 5,
      dailyRate, overtimeRate: otRate,
    });
    expect(payroll.totalPay).toBe(260000);

    // Balance
    expect(checkBalance(payroll.totalPay, projectTotal).isValid).toBe(true);
  });

  it('COLAY timeline segments correct', () => {
    const r = calculateAttendance({ clockIn: '08:00', clockOut: '22:00' });
    const types = r.timelineSegments.map(s => s.type);
    expect(types).toEqual(['NORMAL', 'BREAK', 'NORMAL', 'OVERTIME', 'BREAK', 'OVERTIME']);
  });

  it('Normal payroll hours is always 8 regardless of late arrival', () => {
    for (const clockIn of ['08:00', '09:00', '10:00', '11:00', '12:00']) {
      const r = calculateAttendance({ clockIn, clockOut: '22:00' });
      expect(r.normalPayrollHours).toBe(8);
    }
  });
});
