'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { checkBalance } from '@/lib/engine/nw28-attendance-engine';
import type { PayrollPeriod } from '@/types';
import { clsx } from 'clsx';

type Tab = 'pegawai' | 'proyek' | 'kasbon';

interface EmpRecap {
  name: string;
  days: number;
  otHours: number;
  totalPay: number;
  kasbon: number;
  netPay: number;
}

interface ProjRecap {
  name: string;
  dailyTotal: number;
  otTotal: number;
  grandTotal: number;
}

export default function RekapPage() {
  const [tab, setTab] = useState<Tab>('pegawai');
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [empRecaps, setEmpRecaps] = useState<EmpRecap[]>([]);
  const [projRecaps, setProjRecaps] = useState<ProjRecap[]>([]);
  const [kasbonList, setKasbonList] = useState<Record<string, unknown>[]>([]);
  const [balance, setBalance] = useState<{ emp: number; proj: number; valid: boolean } | null>(null);

  const supabase = createClient();

  useEffect(() => {
    loadPeriods();
  }, []);

  useEffect(() => {
    if (selectedPeriod) loadRecap();
  }, [selectedPeriod]);

  async function loadPeriods() {
    try {
      const { data } = await supabase.from('payroll_periods').select('*').order('start_date', { ascending: false });
      setPeriods((data || []) as PayrollPeriod[]);
      if (data && data.length > 0) setSelectedPeriod(data[0].id);
    } catch { /* demo */ }
  }

  async function loadRecap() {
    const period = periods.find(p => p.id === selectedPeriod);
    if (!period) return;

    try {
      // Employee recap
      const { data: attendance } = await supabase
        .from('attendance')
        .select('*, employees(name), attendance_projects(*, projects(name))')
        .gte('work_date', period.start_date)
        .lte('work_date', period.end_date);

      // Kasbon
      const { data: kasbon } = await supabase
        .from('advances')
        .select('*, employees(name), projects(name)')
        .gte('advance_date', period.start_date)
        .lte('advance_date', period.end_date);

      // Build employee recap
      const empMap = new Map<string, EmpRecap>();
      for (const att of (attendance || [])) {
        const name = (att.employees as { name: string })?.name || '-';
        const existing = empMap.get(name) || { name, days: 0, otHours: 0, totalPay: 0, kasbon: 0, netPay: 0 };
        existing.days += Number(att.normal_day);
        existing.otHours += Number(att.paid_overtime_hours);
        existing.totalPay += Number(att.normal_pay) + Number(att.overtime_pay);
        empMap.set(name, existing);
      }

      // Add kasbon to employee recap
      for (const k of (kasbon || [])) {
        const name = (k.employees as { name: string })?.name || '-';
        const existing = empMap.get(name);
        if (existing) {
          existing.kasbon += Number(k.amount);
        }
      }

      // Calculate net pay
      for (const [, emp] of empMap) {
        emp.netPay = emp.totalPay - emp.kasbon;
      }

      // Build project recap — direct costing: hours × rate
      const projMap = new Map<string, ProjRecap>();
      for (const att of (attendance || [])) {
        const projs = att.attendance_projects as { normal_hours: number; overtime_hours: number; projects: { name: string } }[];
        const hourlyRate = Number(att.daily_rate_snapshot) / 8;
        const otRate = Number(att.overtime_rate_snapshot);
        for (const ap of (projs || [])) {
          const projName = ap.projects?.name || '-';
          const existing = projMap.get(projName) || { name: projName, dailyTotal: 0, otTotal: 0, grandTotal: 0 };
          existing.dailyTotal += Number(ap.normal_hours) * hourlyRate;
          existing.otTotal += Number(ap.overtime_hours) * otRate;
          existing.grandTotal = existing.dailyTotal + existing.otTotal;
          projMap.set(projName, existing);
        }
      }

      const empArr = Array.from(empMap.values());
      const projArr = Array.from(projMap.values());

      setEmpRecaps(empArr);
      setProjRecaps(projArr);
      setKasbonList(kasbon || []);

      // Check balance
      const empTotal = empArr.reduce((s, e) => s + e.totalPay, 0);
      const projTotal = projArr.reduce((s, p) => s + p.grandTotal, 0);
      const cb = checkBalance(empTotal, projTotal);
      setBalance({ emp: empTotal, proj: projTotal, valid: cb.isValid });
    } catch { /* demo */ }
  }

  const formatRp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Rekap</h2>

      {/* Period selector */}
      <div className="card mb-6">
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="label">Periode</label>
            <select
              value={selectedPeriod}
              onChange={e => setSelectedPeriod(e.target.value)}
              className="input-field"
            >
              <option value="">-- Pilih Periode --</option>
              {periods.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          {balance && (
            <div className={clsx(
              'card border-2 min-w-[200px]',
              balance.valid ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'
            )}>
              <p className="text-sm font-semibold mb-1">CHECK / BALANCE</p>
              <p className="text-xs">Total Upah: {formatRp(balance.emp)}</p>
              <p className="text-xs">Total Proyek: {formatRp(balance.proj)}</p>
              <p className={clsx('font-bold mt-1', balance.valid ? 'text-green-700' : 'text-red-700')}>
                {balance.valid ? 'VALID ✓' : 'SALAH ✗'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {[
          { id: 'pegawai' as Tab, label: 'Rekap Pegawai' },
          { id: 'proyek' as Tab, label: 'Rekap Proyek' },
          { id: 'kasbon' as Tab, label: 'Rekap Kasbon' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              'px-4 py-2 rounded-t-lg font-medium',
              tab === t.id ? 'bg-white border-t-2 border-x border-nw28-accent' : 'bg-gray-100 text-gray-500'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card rounded-tl-none">
        {tab === 'pegawai' && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-2">Nama</th>
                <th className="text-center py-2">Jml Hari</th>
                <th className="text-center py-2">Jml Lembur</th>
                <th className="text-right py-2">Total Upah</th>
                <th className="text-right py-2">Kasbon</th>
                <th className="text-right py-2">Diterima</th>
              </tr>
            </thead>
            <tbody>
              {empRecaps.map((e, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-2 font-medium">{e.name}</td>
                  <td className="text-center">{e.days}</td>
                  <td className="text-center">{e.otHours} Jam</td>
                  <td className="text-right">{formatRp(e.totalPay)}</td>
                  <td className="text-right text-red-600">{formatRp(e.kasbon)}</td>
                  <td className="text-right font-bold">{formatRp(e.netPay)}</td>
                </tr>
              ))}
              {empRecaps.length > 0 && (
                <tr className="border-t-2 border-gray-300 font-bold">
                  <td className="py-2">TOTAL</td>
                  <td className="text-center">{empRecaps.reduce((s, e) => s + e.days, 0)}</td>
                  <td className="text-center">{empRecaps.reduce((s, e) => s + e.otHours, 0)} Jam</td>
                  <td className="text-right">{formatRp(empRecaps.reduce((s, e) => s + e.totalPay, 0))}</td>
                  <td className="text-right text-red-600">{formatRp(empRecaps.reduce((s, e) => s + e.kasbon, 0))}</td>
                  <td className="text-right">{formatRp(empRecaps.reduce((s, e) => s + e.netPay, 0))}</td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {tab === 'proyek' && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-2">Proyek</th>
                <th className="text-right py-2">Harian/Proyek</th>
                <th className="text-right py-2">Lembur/Proyek</th>
                <th className="text-right py-2">Total/Proyek</th>
              </tr>
            </thead>
            <tbody>
              {projRecaps.map((p, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-2 font-medium">{p.name}</td>
                  <td className="text-right">{formatRp(p.dailyTotal)}</td>
                  <td className="text-right">{formatRp(p.otTotal)}</td>
                  <td className="text-right font-bold">{formatRp(p.grandTotal)}</td>
                </tr>
              ))}
              {projRecaps.length > 0 && (
                <tr className="border-t-2 border-gray-300 font-bold">
                  <td className="py-2">JUMLAH</td>
                  <td className="text-right">{formatRp(projRecaps.reduce((s, p) => s + p.dailyTotal, 0))}</td>
                  <td className="text-right">{formatRp(projRecaps.reduce((s, p) => s + p.otTotal, 0))}</td>
                  <td className="text-right">{formatRp(projRecaps.reduce((s, p) => s + p.grandTotal, 0))}</td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {tab === 'kasbon' && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-2">Tanggal</th>
                <th className="text-left py-2">Nama</th>
                <th className="text-right py-2">Jumlah</th>
                <th className="text-left py-2">Proyek</th>
                <th className="text-left py-2">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {kasbonList.map((k, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-2">{String(k.advance_date)}</td>
                  <td className="py-2 font-medium">{(k.employees as { name: string } | undefined)?.name || '-'}</td>
                  <td className="py-2 text-right text-red-600 font-bold">{formatRp(Number(k.amount))}</td>
                  <td className="py-2">{(k.projects as { name: string } | undefined)?.name || '-'}</td>
                  <td className="py-2 text-gray-500">{String(k.description || '-')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {empRecaps.length === 0 && projRecaps.length === 0 && (
          <p className="text-gray-400 text-center py-8">Pilih periode untuk melihat rekap.</p>
        )}
      </div>
    </div>
  );
}
