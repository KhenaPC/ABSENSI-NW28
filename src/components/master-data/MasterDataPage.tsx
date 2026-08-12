'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import type { Employee, Project, PayrollPeriod, EmployeeRateHistory } from '@/types';
import { clsx } from 'clsx';

type Section = 'pekerja' | 'proyek' | 'upah' | 'periode';

export default function MasterDataPage() {
  const [section, setSection] = useState<Section>('pekerja');

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Master Data</h2>

      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { id: 'pekerja' as Section, label: '👷 Nama Pekerja' },
          { id: 'proyek' as Section, label: '🏗️ Proyek' },
          { id: 'upah' as Section, label: '💵 Upah Harian' },
          { id: 'periode' as Section, label: '📅 Periode Gaji' },
        ].map(s => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={clsx(
              'px-4 py-2 rounded-lg font-medium',
              section === s.id ? 'bg-nw28-accent text-white' : 'bg-gray-100'
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === 'pekerja' && <EmployeeSection />}
      {section === 'proyek' && <ProjectSection />}
      {section === 'upah' && <RateSection />}
      {section === 'periode' && <PeriodSection />}
    </div>
  );
}

// ─── Employee Section ─────────────────────────────────────────────

function EmployeeSection() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [dailyRate, setDailyRate] = useState('160000');
  const [msg, setMsg] = useState('');

  const supabase = createClient();

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('employees').select('*').order('name');
    setEmployees((data || []) as Employee[]);
  }

  async function handleAdd() {
    if (!name) { setMsg('Nama harus diisi.'); return; }
    const rate = Number(dailyRate);
    const overtimeRate = rate / 8;

    await supabase.from('employees').insert({ name: name.toUpperCase(), position });
    // Get the new employee
    const { data: newEmp } = await supabase.from('employees').select('id').eq('name', name.toUpperCase()).single();
    if (newEmp) {
      await supabase.from('employee_rate_history').insert({
        employee_id: newEmp.id,
        effective_from: new Date().toISOString().split('T')[0],
        daily_rate: rate,
        overtime_rate: overtimeRate,
      });
    }
    setName(''); setPosition(''); setMsg('Pekerja berhasil ditambahkan.');
    load();
  }

  async function toggleActive(emp: Employee) {
    await supabase.from('employees').update({ active: !emp.active }).eq('id', emp.id);
    load();
  }

  return (
    <div className="card">
      <h3 className="font-semibold text-lg mb-4">Nama Pekerja</h3>

      <div className="flex flex-wrap gap-3 mb-6">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Nama"
          className="input-field flex-1 min-w-[200px]"
        />
        <input
          value={position}
          onChange={e => setPosition(e.target.value)}
          placeholder="Jabatan"
          className="input-field flex-1 min-w-[150px]"
        />
        <input
          value={dailyRate}
          onChange={e => setDailyRate(e.target.value)}
          placeholder="Upah Harian"
          type="number"
          className="input-field w-40"
        />
        <button onClick={handleAdd} className="btn-primary">+ Tambah Pekerja</button>
      </div>

      {msg && <p className="text-green-600 text-sm mb-4">{msg}</p>}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2">
            <th className="text-left py-2">Nama</th>
            <th className="text-left py-2">Jabatan</th>
            <th className="text-center py-2">Status</th>
            <th className="text-center py-2">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {employees.map(emp => (
            <tr key={emp.id} className="border-b border-gray-100">
              <td className="py-2 font-medium">{emp.name}</td>
              <td className="py-2">{emp.position}</td>
              <td className="py-2 text-center">
                <span className={clsx(
                  'px-2 py-1 rounded-full text-xs font-semibold',
                  emp.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                )}>
                  {emp.active ? 'Aktif' : 'Nonaktif'}
                </span>
              </td>
              <td className="py-2 text-center">
                <button
                  onClick={() => toggleActive(emp)}
                  className="text-sm text-nw28-accent hover:underline"
                >
                  {emp.active ? 'Nonaktifkan' : 'Aktifkan'}
                </button>
              </td>
            </tr>
          ))}
          {employees.length === 0 && (
            <tr><td colSpan={4} className="py-8 text-center text-gray-400">Belum ada pekerja.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Project Section ──────────────────────────────────────────────

function ProjectSection() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');

  const supabase = createClient();
  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('projects').select('*').order('name');
    setProjects((data || []) as Project[]);
  }

  async function handleAdd() {
    if (!name || !code) { setMsg('Nama dan kode harus diisi.'); return; }
    await supabase.from('projects').insert({ name: name.toUpperCase(), code: code.toUpperCase() });
    setName(''); setCode(''); setMsg('Proyek berhasil ditambahkan.');
    load();
  }

  async function toggleActive(proj: Project) {
    await supabase.from('projects').update({ active: !proj.active }).eq('id', proj.id);
    load();
  }

  return (
    <div className="card">
      <h3 className="font-semibold text-lg mb-4">Proyek</h3>

      <div className="flex flex-wrap gap-3 mb-6">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nama Proyek" className="input-field flex-1 min-w-[200px]" />
        <input value={code} onChange={e => setCode(e.target.value)} placeholder="Kode" className="input-field w-32" />
        <button onClick={handleAdd} className="btn-primary">+ Tambah Proyek</button>
      </div>

      {msg && <p className="text-green-600 text-sm mb-4">{msg}</p>}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2">
            <th className="text-left py-2">Nama</th>
            <th className="text-left py-2">Kode</th>
            <th className="text-center py-2">Status</th>
            <th className="text-center py-2">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {projects.map(p => (
            <tr key={p.id} className="border-b border-gray-100">
              <td className="py-2 font-medium">{p.name}</td>
              <td className="py-2">{p.code}</td>
              <td className="py-2 text-center">
                <span className={clsx(
                  'px-2 py-1 rounded-full text-xs font-semibold',
                  p.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                )}>
                  {p.active ? 'Aktif' : 'Nonaktif'}
                </span>
              </td>
              <td className="py-2 text-center">
                <button onClick={() => toggleActive(p)} className="text-sm text-nw28-accent hover:underline">
                  {p.active ? 'Nonaktifkan' : 'Aktifkan'}
                </button>
              </td>
            </tr>
          ))}
          {projects.length === 0 && (
            <tr><td colSpan={4} className="py-8 text-center text-gray-400">Belum ada proyek.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Rate Section ─────────────────────────────────────────────────

function RateSection() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmp, setSelectedEmp] = useState('');
  const [history, setHistory] = useState<EmployeeRateHistory[]>([]);
  const [newRate, setNewRate] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [msg, setMsg] = useState('');

  const supabase = createClient();
  useEffect(() => { loadEmps(); }, []);

  async function loadEmps() {
    const { data } = await supabase.from('employees').select('*').eq('active', true).order('name');
    setEmployees((data || []) as Employee[]);
  }

  useEffect(() => {
    if (selectedEmp) loadHistory();
  }, [selectedEmp]);

  async function loadHistory() {
    const { data } = await supabase
      .from('employee_rate_history')
      .select('*')
      .eq('employee_id', selectedEmp)
      .order('effective_from', { ascending: false });
    setHistory((data || []) as EmployeeRateHistory[]);
  }

  async function handleChangeRate() {
    if (!newRate || !effectiveFrom) { setMsg('Isi upah baru dan tanggal berlaku.'); return; }

    const rate = Number(newRate);
    const overtimeRate = rate / 8;

    // Close current rate
    const { data: current } = await supabase
      .from('employee_rate_history')
      .select('id')
      .eq('employee_id', selectedEmp)
      .is('effective_to', null)
      .order('effective_from', { ascending: false })
      .limit(1);

    if (current && current.length > 0) {
      await supabase.from('employee_rate_history').update({ effective_to: effectiveFrom }).eq('id', current[0].id);
    }

    await supabase.from('employee_rate_history').insert({
      employee_id: selectedEmp,
      effective_from: effectiveFrom,
      daily_rate: rate,
      overtime_rate: overtimeRate,
    });

    setMsg('Upah baru berhasil disimpan.');
    setNewRate(''); setEffectiveFrom('');
    loadHistory();
  }

  const formatRp = (n: number) => `Rp ${Number(n).toLocaleString('id-ID')}`;

  return (
    <div className="card">
      <h3 className="font-semibold text-lg mb-4">Upah Harian (Riwayat Upah)</h3>

      <div className="mb-6">
        <label className="label">Pilih Pekerja</label>
        <select value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)} className="input-field">
          <option value="">-- Pilih Pekerja --</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>

      {selectedEmp && (
        <>
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-500">Upah Saat Ini</p>
            <p className="text-2xl font-bold">
              {history.length > 0 ? formatRp(history[0].daily_rate) : '-'}
            </p>
          </div>

          <div className="flex flex-wrap gap-3 mb-6">
            <input type="number" value={newRate} onChange={e => setNewRate(e.target.value)} placeholder="Upah baru" className="input-field flex-1 min-w-[150px]" />
            <div>
              <label className="label">Berlaku mulai</label>
              <input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} className="input-field" />
            </div>
            <button onClick={handleChangeRate} className="btn-primary self-end">Ubah Upah</button>
          </div>

          {msg && <p className="text-green-600 text-sm mb-4">{msg}</p>}

          <h4 className="font-medium mb-2">Riwayat</h4>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2">
                <th className="text-left py-2">Berlaku Mulai</th>
                <th className="text-left py-2">Sampai</th>
                <th className="text-right py-2">Upah Harian</th>
                <th className="text-right py-2">Lembur/Jam</th>
              </tr>
            </thead>
            <tbody>
              {history.map(h => (
                <tr key={h.id} className="border-b border-gray-100">
                  <td className="py-2">{h.effective_from}</td>
                  <td className="py-2">{h.effective_to || 'Sekarang'}</td>
                  <td className="py-2 text-right font-medium">{formatRp(h.daily_rate)}</td>
                  <td className="py-2 text-right">{formatRp(h.overtime_rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

// ─── Period Section ───────────────────────────────────────────────

function PeriodSection() {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [msg, setMsg] = useState('');

  const supabase = createClient();
  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('payroll_periods').select('*').order('start_date', { ascending: false });
    setPeriods((data || []) as PayrollPeriod[]);
  }

  async function handleAdd() {
    if (!name || !startDate || !endDate) { setMsg('Semua field harus diisi.'); return; }
    await supabase.from('payroll_periods').insert({ name, start_date: startDate, end_date: endDate });
    setMsg('Periode berhasil ditambahkan.');
    setName(''); setStartDate(''); setEndDate('');
    load();
  }

  async function changeStatus(id: string, status: string) {
    await supabase.from('payroll_periods').update({ status }).eq('id', id);
    load();
  }

  return (
    <div className="card">
      <h3 className="font-semibold text-lg mb-4">Periode Gaji</h3>

      <div className="flex flex-wrap gap-3 mb-6">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nama Periode" className="input-field flex-1 min-w-[200px]" />
        <div>
          <label className="label">Mulai</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="label">Selesai</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input-field" />
        </div>
        <button onClick={handleAdd} className="btn-primary self-end">+ Tambah Periode</button>
      </div>

      {msg && <p className="text-green-600 text-sm mb-4">{msg}</p>}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2">
            <th className="text-left py-2">Nama</th>
            <th className="text-left py-2">Mulai</th>
            <th className="text-left py-2">Selesai</th>
            <th className="text-center py-2">Status</th>
            <th className="text-center py-2">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {periods.map(p => (
            <tr key={p.id} className="border-b border-gray-100">
              <td className="py-2 font-medium">{p.name}</td>
              <td className="py-2">{p.start_date}</td>
              <td className="py-2">{p.end_date}</td>
              <td className="py-2 text-center">
                <span className={clsx(
                  'px-2 py-1 rounded-full text-xs font-semibold',
                  p.status === 'OPEN' ? 'bg-green-100 text-green-700' :
                  p.status === 'LOCKED' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-500'
                )}>
                  {p.status}
                </span>
              </td>
              <td className="py-2 text-center space-x-2">
                {p.status === 'OPEN' && (
                  <button onClick={() => changeStatus(p.id, 'LOCKED')} className="text-sm text-yellow-600 hover:underline">Lock</button>
                )}
                {p.status === 'LOCKED' && (
                  <>
                    <button onClick={() => changeStatus(p.id, 'OPEN')} className="text-sm text-blue-600 hover:underline">Unlock</button>
                    <button onClick={() => changeStatus(p.id, 'PAID')} className="text-sm text-green-600 hover:underline">Set Paid</button>
                  </>
                )}
              </td>
            </tr>
          ))}
          {periods.length === 0 && (
            <tr><td colSpan={5} className="py-8 text-center text-gray-400">Belum ada periode gaji.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
