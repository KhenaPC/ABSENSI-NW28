import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { generateNW28Excel } from '@/lib/excel/excel-generator';
import { calculateAttendance, calculatePayroll, checkBalance } from '@/lib/engine/nw28-attendance-engine';
import type { ExcelEmployeeData } from '@/types';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { periodId } = await request.json();

    if (!periodId) {
      return NextResponse.json({ error: 'Period ID required' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    // Get period
    const { data: period, error: periodErr } = await supabase
      .from('payroll_periods')
      .select('*')
      .eq('id', periodId)
      .single();

    if (periodErr || !period) {
      return NextResponse.json({ error: 'Periode tidak ditemukan.' }, { status: 404 });
    }

    // Get all attendance for this period with related data
    const { data: attendance, error: attErr } = await supabase
      .from('attendance')
      .select(`
        *,
        employees(id, name, position),
        attendance_projects(
          normal_hours,
          overtime_hours,
          projects(id, name, code)
        )
      `)
      .gte('work_date', period.start_date)
      .lte('work_date', period.end_date)
      .order('employee_id')
      .order('work_date');

    if (attErr) {
      return NextResponse.json({ error: 'Gagal mengambil data absensi.' }, { status: 500 });
    }

    // Get advances for this period
    const { data: advances } = await supabase
      .from('advances')
      .select('*, projects(name)')
      .gte('advance_date', period.start_date)
      .lte('advance_date', period.end_date);

    // Group attendance by employee
    const employeeMap = new Map<string, typeof attendance>();
    for (const att of (attendance || [])) {
      const empId = att.employee_id;
      if (!employeeMap.has(empId)) {
        employeeMap.set(empId, []);
      }
      employeeMap.get(empId)!.push(att);
    }

    // Build ExcelEmployeeData for each employee
    const employeeDataList: ExcelEmployeeData[] = [];
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

    // Determine the week's days (Sun-Sat)
    const startDate = new Date(period.start_date + 'T00:00:00');
    const endDate = new Date(period.end_date + 'T00:00:00');

    for (const [empId, empAttendance] of employeeMap) {
      const firstAtt = empAttendance[0];
      const emp = firstAtt.employees as { id: string; name: string; position: string };
      
      // Get kasbon for this employee
      const empAdvances = (advances || []).filter(a => a.employee_id === empId);
      const totalKasbon = empAdvances.reduce((sum, a) => sum + Number(a.amount), 0);
      const kasbonProject = empAdvances.length > 0
        ? ((empAdvances[0].projects as { name: string } | undefined)?.name || '')
        : '';

      // Build attendance rows
      const attendanceRows: ExcelEmployeeData['attendances'] = [];
      
      // Create 7-day grid (Sun-Sat)
      for (let d = 0; d < 7; d++) {
        const targetDate = new Date(startDate);
        targetDate.setDate(startDate.getDate() + d);
        const targetDateStr = targetDate.toISOString().split('T')[0];
        const dayOfWeek = targetDate.getDay(); // 0=Sun

        const dayAtt = empAttendance.find(a => a.work_date === targetDateStr);

        if (dayAtt) {
          const projects = (dayAtt.attendance_projects as {
            normal_hours: number; overtime_hours: number;
            projects: { name: string };
          }[]) || [];
          const projectNames = projects.map(p => p.projects?.name).filter(Boolean).join('/');

          attendanceRows.push({
            dayName: dayNames[dayOfWeek],
            clockIn: String(dayAtt.clock_in || '').substring(0, 5),
            clockOut: String(dayAtt.clock_out || '').substring(0, 5),
            workHours: Number(dayAtt.normal_hours) + Number(dayAtt.actual_overtime_hours),
            overtimeHours: Number(dayAtt.actual_overtime_hours),
            normalDay: Number(dayAtt.normal_day),
            activeOvertime: Number(dayAtt.paid_overtime_hours),
            projectName: projectNames,
            dailyPay: Number(dayAtt.normal_pay),
            overtimePay: Number(dayAtt.overtime_pay),
          });
        } else {
          attendanceRows.push({
            dayName: dayNames[dayOfWeek],
            clockIn: null,
            clockOut: null,
            workHours: 0,
            overtimeHours: 0,
            normalDay: 0,
            activeOvertime: 0,
            projectName: '',
            dailyPay: 0,
            overtimePay: 0,
          });
        }
      }

      // Calculate project recap — direct costing: hours × rate
      const projectRecapMap = new Map<string, { normalHours: number; overtimeHours: number; dailyTotal: number; overtimeTotal: number }>();
      for (const att of empAttendance) {
        const projects = (att.attendance_projects as {
          normal_hours: number; overtime_hours: number;
          projects: { name: string };
        }[]) || [];
        
        const hourlyRate = Number(att.daily_rate_snapshot) / 8;
        const otRate = Number(att.overtime_rate_snapshot);
        
        for (const proj of projects) {
          const projName = proj.projects?.name || 'Unknown';
          const existing = projectRecapMap.get(projName) || { normalHours: 0, overtimeHours: 0, dailyTotal: 0, overtimeTotal: 0 };
          existing.normalHours += Number(proj.normal_hours);
          existing.overtimeHours += Number(proj.overtime_hours);
          existing.dailyTotal += Number(proj.normal_hours) * hourlyRate;
          existing.overtimeTotal += Number(proj.overtime_hours) * otRate;
          projectRecapMap.set(projName, existing);
        }
      }

      const projectRecaps = Array.from(projectRecapMap.entries()).map(([name, data]) => ({
        name,
        normalHours: data.normalHours,
        overtimeHours: data.overtimeHours,
        normalCost: Math.round(data.dailyTotal),
        overtimeCost: Math.round(data.overtimeTotal),
        total: Math.round(data.dailyTotal + data.overtimeTotal),
      }));

      const totalUpah = empAttendance.reduce(
        (sum, a) => sum + Number(a.normal_pay) + Number(a.overtime_pay), 0
      );
      const totalRekapProyek = projectRecaps.reduce((sum, p) => sum + p.total, 0);
      const cb = checkBalance(totalUpah, totalRekapProyek);

      employeeDataList.push({
        name: emp.name,
        position: emp.position,
        period: period.name,
        kasbonAmount: totalKasbon,
        kasbonProject,
        dailyRate: Number(firstAtt.daily_rate_snapshot),
        hourlyRate: Number(firstAtt.hourly_rate_snapshot),
        overtimeRate: Number(firstAtt.overtime_rate_snapshot),
        projects: projectRecaps,
        checkBalance: {
          totalUpah,
          totalRekapProyek,
          isValid: cb.isValid,
        },
        attendances: attendanceRows,
        totalUpah,
        totalUpahDiterima: totalUpah - totalKasbon,
      });
    }

    // Generate Excel
    const templatePath = path.join(process.cwd(), 'public', 'template.xlsx');
    const buffer = await generateNW28Excel(templatePath, employeeDataList, period.name);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="ABSENSI_NW28_${period.name.replace(/\s+/g, '_')}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Gagal generate Excel.' },
      { status: 500 }
    );
  }
}
