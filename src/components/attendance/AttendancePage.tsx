'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import {
  calculateAttendance,
  calculatePayroll,
  validatePaidOvertime,
  validateNormalAllocation,
  validateOvertimeAllocation,
} from '@/lib/engine/nw28-attendance-engine';
import type { AttendanceResult, TimelineSegment, ProjectAllocationInput } from '@/lib/engine/nw28-attendance-engine';
import type { Employee, Project } from '@/types';
import { clsx } from 'clsx';

interface AllocRow {
  projectId: string;
  normalHours: number;
  overtimeHours: number;
}

interface QuickEntry {
  employeeId: string;
  employeeName: string;
  clockIn: string;
  clockOut: string;
  saved: boolean;
}

export default function AttendancePage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [clockIn, setClockIn] = useState('08:00');
  const [clockOut, setClockOut] = useState('18:00');
  const [calcResult, setCalcResult] = useState<AttendanceResult | null>(null);
  const [entries, setEntries] = useState<QuickEntry[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [paidOT, setPaidOT] = useState<number>(0);

  // Multi-project allocation
  const [allocations, setAllocations] = useState<AllocRow[]>([]);
  const [newProjId, setNewProjId] = useState('');
  const [newNormal, setNewNormal] = useState(0);
  const [newOT, setNewOT] = useState(0);

  const supabase = createClient();

  useEffect(() => { loadData(); }, []);
  useEffect(() => { loadExisting(); }, [date]);

  async function loadData() {
    try {
      const { data: emps } = await supabase.from('employees').select('*').eq('active', true).order('name');
      const { data: projs } = await supabase.from('projects').select('*').eq('active', true).order('name');
      setEmployees(emps || []);
      setProjects(projs || []);
    } catch { /* demo */ }
  }

  async function loadExisting() {
    try {
      const { data } = await supabase
        .from('attendance')
        .select('*, employees(name)')
        .eq('work_date', date);
      if (data) {
        setEntries(data.map((a: Record<string, unknown>) => ({
          employeeId: String(a.employee_id),
          employeeName: ((a.employees as { name: string } | undefined)?.name) || '-',
          clockIn: String(a.clock_in || '').substring(0, 5),
          clockOut: String(a.clock_out || '').substring(0, 5),
          saved: true,
        })));
      }
    } catch { /* demo */ }
  }

  function handleCalculate() {
    setError(''); setSuccess('');
    if (!selectedEmployee) { setError('Pilih pekerja.'); return; }
    if (!clockIn || !clockOut) { setError('Jam masuk/keluar harus diisi.'); return; }

    try {
      const result = calculateAttendance({ clockIn, clockOut });
      setCalcResult(result);
      setPaidOT(result.actualOvertimeHours);
      setAllocations([]);
      setShowResult(true);
      if (result.isException) setError(result.exceptionReason || 'Data tidak valid.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error perhitungan.');
    }
  }

  function addAllocation() {
    if (!newProjId) { setError('Pilih proyek.'); return; }
    if (allocations.some(a => a.projectId === newProjId)) { setError('Proyek sudah ada.'); return; }
    setAllocations(prev => [...prev, { projectId: newProjId, normalHours: newNormal, overtimeHours: newOT }]);
    setNewProjId(''); setNewNormal(0); setNewOT(0); setError('');
  }

  function removeAllocation(idx: number) {
    setAllocations(prev => prev.filter((_, i) => i !== idx));
  }

  function updateAllocation(idx: number, field: 'normalHours' | 'overtimeHours', value: number) {
    setAllocations(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a));
  }

  // Live allocation balance
  const totalAllocNormal = allocations.reduce((s, a) => s + a.normalHours, 0);
  const totalAllocOT = allocations.reduce((s, a) => s + a.overtimeHours, 0);
  const expectedNormal = calcResult?.normalPayrollHours || 0;
  const expectedOT = paidOT;
  const normalValid = Math.abs(totalAllocNormal - expectedNormal) < 0.01;
  const otValid = Math.abs(totalAllocOT - expectedOT) < 0.01;
  const allocValid = normalValid && otValid && allocations.length > 0;

  async function handleSave() {
    if (!calcResult || calcResult.isException) return;
    setError('');

    // Validate paid OT
    const otV = validatePaidOvertime(calcResult.actualOvertimeHours, paidOT);
    if (!otV.valid) { setError(otV.error!); return; }

    // Validate allocations
    const allocInput: ProjectAllocationInput[] = allocations.map(a => ({
      projectId: a.projectId, normalHours: a.normalHours, overtimeHours: a.overtimeHours,
    }));
    const nv = validateNormalAllocation(allocInput, calcResult.normalPayrollHours);
    if (!nv.valid) { setError(nv.error!); return; }
    const ov = validateOvertimeAllocation(allocInput, paidOT);
    if (!ov.valid) { setError(ov.error!); return; }

    // Get rate
    let dailyRate = 160000;
    let overtimeRate = 20000;
    try {
      const { data: rate } = await supabase
        .from('employee_rate_history').select('*')
        .eq('employee_id', selectedEmployee)
        .lte('effective_from', date)
        .or(`effective_to.is.null,effective_to.gt.${date}`)
        .order('effective_from', { ascending: false }).limit(1);
      if (rate && rate.length > 0) {
        dailyRate = Number(rate[0].daily_rate);
        overtimeRate = Number(rate[0].overtime_rate);
      }
    } catch { /* defaults */ }

    const hourlyRate = dailyRate / 8;
    const payroll = calculatePayroll({
      normalDay: calcResult.normalDay,
      actualOvertimeHours: calcResult.actualOvertimeHours,
      paidOvertimeHours: paidOT,
      dailyRate,
      overtimeRate,
    });

    try {
      // Check locked period
      const { data: period } = await supabase
        .from('payroll_periods').select('status')
        .lte('start_date', date).gte('end_date', date).limit(1);
      if (period && period.length > 0 && period[0].status !== 'OPEN') {
        setError('Periode gaji sudah LOCKED.'); return;
      }

      const attData = {
        employee_id: selectedEmployee,
        work_date: date,
        clock_in: clockIn + ':00',
        clock_out: clockOut + ':00',
        normal_day: calcResult.normalDay,
        normal_hours: calcResult.normalEffectiveHours,
        normal_payroll_hours: calcResult.normalPayrollHours,
        late_minutes: calcResult.lateMinutes,
        actual_overtime_hours: calcResult.actualOvertimeHours,
        paid_overtime_hours: paidOT,
        paid_overtime_reason: paidOT < calcResult.actualOvertimeHours ? 'Disesuaikan admin' : null,
        daily_rate_snapshot: dailyRate,
        hourly_rate_snapshot: hourlyRate,
        overtime_rate_snapshot: overtimeRate,
        normal_pay: payroll.normalPay,
        overtime_pay: payroll.overtimePay,
        is_exception: false,
        exception_reason: null,
        notes: null,
        created_by: null,
        updated_by: null,
      };

      // Upsert attendance
      const { data: existing } = await supabase
        .from('attendance').select('id')
        .eq('employee_id', selectedEmployee).eq('work_date', date);

      let attId: string;
      if (existing && existing.length > 0) {
        attId = existing[0].id;
        await supabase.from('attendance').update(attData).eq('id', attId);
        await supabase.from('attendance_projects').delete().eq('attendance_id', attId);
      } else {
        const { data: newAtt } = await supabase.from('attendance').insert(attData).select().single();
        attId = newAtt?.id;
      }

      // Save project allocations with normal_hours + overtime_hours
      if (attId && allocations.length > 0) {
        const projData = allocations.map(a => ({
          attendance_id: attId,
          project_id: a.projectId,
          normal_hours: a.normalHours,
          overtime_hours: a.overtimeHours,
          allocation_hours: a.normalHours + a.overtimeHours, // legacy compat
        }));
        await supabase.from('attendance_projects').insert(projData);
      }

      const empName = employees.find(e => e.id === selectedEmployee)?.name || '-';
      setEntries(prev => [
        ...prev.filter(e => e.employeeId !== selectedEmployee),
        { employeeId: selectedEmployee, employeeName: empName, clockIn, clockOut, saved: true },
      ]);
      setSuccess(`${empName} berhasil disimpan!`);
      setShowResult(false); setCalcResult(null); setAllocations([]);

      // Next employee
      const savedIds = new Set([...entries.map(e => e.employeeId), selectedEmployee]);
      const next = employees.find(e => !savedIds.has(e.id));
      if (next) setSelectedEmployee(next.id);
      else setSelectedEmployee('');
    } catch {
      setError('Gagal menyimpan.');
    }
  }

  async function handleCopyPrevious() {
    try {
      const prev = new Date(date);
      prev.setDate(prev.getDate() - 1);
      const { data } = await supabase
        .from('attendance').select('*, employees(name)')
        .eq('work_date', prev.toISOString().split('T')[0]);
      if (data && data.length > 0) {
        setEntries(data.map((a: Record<string, unknown>) => ({
          employeeId: String(a.employee_id),
          employeeName: ((a.employees as { name: string } | undefined)?.name) || '-',
          clockIn: String(a.clock_in || '').substring(0, 5),
          clockOut: String(a.clock_out || '').substring(0, 5),
          saved: false,
        })));
        setSuccess('Data hari sebelumnya disalin.');
      } else setError('Tidak ada data hari sebelumnya.');
    } catch { setError('Gagal menyalin.'); }
  }

  const savedCount = entries.filter(e => e.saved).length;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Absensi Harian</h2>

      {/* Date bar */}
      <div className="card mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="label">Tanggal</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input-field" />
          </div>
          <button onClick={handleCopyPrevious} className="btn-secondary">Copy Previous</button>
          <button onClick={loadExisting} className="btn-secondary">Refresh</button>
          <div className="ml-auto text-right">
            <p className="text-sm text-gray-500">Progress</p>
            <p className="text-lg font-bold">{savedCount} / {employees.length}</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Input */}
        <div className="card">
          <h3 className="font-semibold text-lg mb-4">Input Absensi</h3>
          <div className="space-y-4">
            <div>
              <label className="label">Nama Pekerja</label>
              <select value={selectedEmployee} onChange={e => setSelectedEmployee(e.target.value)} className="input-field">
                <option value="">-- Pilih --</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} {entries.some(e => e.employeeId === emp.id && e.saved) ? '✓' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Jam Masuk</label>
                <input type="time" value={clockIn} onChange={e => setClockIn(e.target.value)} className="input-field text-center text-xl" />
              </div>
              <div>
                <label className="label">Jam Keluar</label>
                <input type="time" value={clockOut} onChange={e => setClockOut(e.target.value)} className="input-field text-center text-xl" />
              </div>
            </div>
            {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg">{error}</div>}
            {success && <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg">{success}</div>}
            <button onClick={handleCalculate} className="btn-primary w-full text-lg py-4">Hitung</button>
          </div>
        </div>

        {/* Result + Allocation */}
        {showResult && calcResult && !calcResult.isException && (
          <div className="card border-2 border-green-300">
            <div className="flex items-center gap-2 mb-4">
              <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">DATA VALID</span>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center">
                <p className="text-sm text-gray-500">Hari Normal</p>
                <p className="text-2xl font-bold">{calcResult.normalDay}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">Payroll Hours</p>
                <p className="text-2xl font-bold">{calcResult.normalPayrollHours}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">Lembur Aktual</p>
                <p className="text-2xl font-bold text-blue-600">{calcResult.actualOvertimeHours}</p>
              </div>
            </div>
            {calcResult.lateMinutes > 0 && (
              <p className="text-yellow-600 text-sm mb-2">Terlambat: {calcResult.lateMinutes} menit</p>
            )}

            {/* Paid OT */}
            <div className="mb-4">
              <label className="label">Lembur Dibayar</label>
              <input type="number" value={paidOT} onChange={e => setPaidOT(Number(e.target.value))}
                min={0} max={calcResult.actualOvertimeHours} className="input-field" />
            </div>

            {/* Timeline */}
            <h4 className="font-semibold mb-2 text-sm">Timeline</h4>
            <div className="space-y-1 mb-4">
              {calcResult.timelineSegments.map((seg, i) => <TimelineRow key={i} segment={seg} />)}
            </div>

            {/* PROJECT ALLOCATION */}
            <h4 className="font-semibold mb-2">Alokasi Proyek</h4>

            {/* Existing allocations */}
            {allocations.length > 0 && (
              <table className="w-full text-sm mb-3">
                <thead>
                  <tr className="border-b-2">
                    <th className="text-left py-1">Proyek</th>
                    <th className="text-center py-1">Normal</th>
                    <th className="text-center py-1">OT</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {allocations.map((a, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-1">{projects.find(p => p.id === a.projectId)?.name}</td>
                      <td className="py-1">
                        <input type="number" value={a.normalHours} min={0} step={0.5}
                          onChange={e => updateAllocation(i, 'normalHours', Number(e.target.value))}
                          className="w-16 text-center border rounded px-1 py-0.5" />
                      </td>
                      <td className="py-1">
                        <input type="number" value={a.overtimeHours} min={0} step={0.5}
                          onChange={e => updateAllocation(i, 'overtimeHours', Number(e.target.value))}
                          className="w-16 text-center border rounded px-1 py-0.5" />
                      </td>
                      <td className="py-1">
                        <button onClick={() => removeAllocation(i)} className="text-red-400 hover:text-red-600">✗</button>
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 font-bold">
                    <td className="py-1">TOTAL</td>
                    <td className={clsx('py-1 text-center', normalValid ? 'text-green-600' : 'text-red-600')}>
                      {totalAllocNormal} / {expectedNormal}
                    </td>
                    <td className={clsx('py-1 text-center', otValid ? 'text-green-600' : 'text-red-600')}>
                      {totalAllocOT} / {expectedOT}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            )}

            {/* Live balance status */}
            <div className={clsx(
              'p-2 rounded text-sm font-semibold text-center mb-3',
              allocations.length === 0 ? 'bg-gray-100 text-gray-500' :
              allocValid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            )}>
              {allocations.length === 0 ? 'Tambahkan proyek' :
               allocValid ? 'ALLOCATION VALID ✓' : 'BELUM BALANCE'}
            </div>

            {/* Add allocation */}
            <div className="flex gap-2 items-end flex-wrap mb-4">
              <div className="flex-1 min-w-[120px]">
                <label className="label">Proyek</label>
                <select value={newProjId} onChange={e => setNewProjId(e.target.value)} className="input-field text-sm py-2">
                  <option value="">-- Proyek --</option>
                  {projects.filter(p => !allocations.some(a => a.projectId === p.id)).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="w-20">
                <label className="label">Normal</label>
                <input type="number" value={newNormal} onChange={e => setNewNormal(Number(e.target.value))}
                  min={0} step={0.5} className="input-field text-sm py-2 text-center" />
              </div>
              <div className="w-20">
                <label className="label">OT</label>
                <input type="number" value={newOT} onChange={e => setNewOT(Number(e.target.value))}
                  min={0} step={0.5} className="input-field text-sm py-2 text-center" />
              </div>
              <button onClick={addAllocation} className="btn-primary text-sm py-2 px-4">+ Tambah</button>
            </div>

            <button onClick={handleSave} disabled={!allocValid}
              className={clsx('w-full text-lg py-4 rounded-lg font-semibold',
                allocValid ? 'btn-success' : 'bg-gray-300 text-gray-500 cursor-not-allowed')}>
              KONFIRMASI & SIMPAN
            </button>
          </div>
        )}
      </div>

      {/* Quick Entry List */}
      <div className="card mt-6">
        <h3 className="font-semibold text-lg mb-4">Quick Entry — {date}</h3>
        {entries.length === 0 && employees.length === 0 ? (
          <p className="text-gray-400 text-center py-4">Belum ada data.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-2 px-3">Nama</th>
                  <th className="text-center py-2 px-3">Masuk</th>
                  <th className="text-center py-2 px-3">Keluar</th>
                  <th className="text-center py-2 px-3">Status</th>
                  <th className="text-center py-2 px-3">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2 px-3 font-medium">{entry.employeeName}</td>
                    <td className="py-2 px-3 text-center">{entry.clockIn}</td>
                    <td className="py-2 px-3 text-center">{entry.clockOut}</td>
                    <td className="py-2 px-3 text-center">
                      {entry.saved ? <span className="text-green-600">✓</span> : <span className="text-yellow-600">Belum</span>}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button onClick={() => {
                        setSelectedEmployee(entry.employeeId);
                        setClockIn(entry.clockIn);
                        setClockOut(entry.clockOut);
                      }} className="text-nw28-accent hover:underline text-sm">Edit</button>
                    </td>
                  </tr>
                ))}
                {employees.filter(e => !entries.some(en => en.employeeId === e.id)).map(emp => (
                  <tr key={emp.id} className="border-b border-gray-100 bg-red-50/50">
                    <td className="py-2 px-3 text-gray-400">{emp.name}</td>
                    <td className="py-2 px-3 text-center text-gray-300">-</td>
                    <td className="py-2 px-3 text-center text-gray-300">-</td>
                    <td className="py-2 px-3 text-center"><span className="text-red-400">Belum</span></td>
                    <td className="py-2 px-3 text-center">
                      <button onClick={() => setSelectedEmployee(emp.id)} className="text-nw28-accent hover:underline text-sm">Input</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineRow({ segment }: { segment: TimelineSegment }) {
  const fmt = (h: number) => {
    const hr = Math.floor(h);
    const mn = Math.round((h - hr) * 60);
    return `${String(hr).padStart(2, '0')}:${String(mn).padStart(2, '0')}`;
  };
  const labels: Record<string, string> = { NORMAL: 'Normal', BREAK: 'Istirahat', OVERTIME: 'Lembur' };
  const styles: Record<string, string> = { NORMAL: 'timeline-normal', BREAK: 'timeline-break', OVERTIME: 'timeline-overtime' };
  return (
    <div className={clsx(styles[segment.type], 'flex justify-between text-sm')}>
      <span className="font-medium">{fmt(segment.start)} – {fmt(segment.end)}</span>
      <span>{labels[segment.type]}</span>
    </div>
  );
}
