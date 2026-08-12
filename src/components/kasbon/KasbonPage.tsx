'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import type { Employee, Project } from '@/types';

export default function KasbonPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [advances, setAdvances] = useState<Record<string, unknown>[]>([]);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    employeeId: '',
    amount: '',
    projectId: '',
    description: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const { data: emps } = await supabase.from('employees').select('*').eq('active', true).order('name');
      const { data: projs } = await supabase.from('projects').select('*').eq('active', true).order('name');
      const { data: advs } = await supabase
        .from('advances')
        .select('*, employees(name), projects(name)')
        .order('advance_date', { ascending: false })
        .limit(50);
      setEmployees(emps || []);
      setProjects(projs || []);
      setAdvances(advs || []);
    } catch {
      // Demo mode
    }
  }

  async function handleSave() {
    setError('');
    setSuccess('');

    if (!form.employeeId) { setError('Pilih pekerja.'); return; }
    if (!form.amount || Number(form.amount) <= 0) { setError('Jumlah kasbon harus lebih dari 0.'); return; }

    try {
      await supabase.from('advances').insert({
        employee_id: form.employeeId,
        advance_date: form.date,
        amount: Number(form.amount),
        project_id: form.projectId || null,
        description: form.description || null,
      });

      setSuccess('Kasbon berhasil disimpan.');
      setForm(f => ({ ...f, employeeId: '', amount: '', description: '' }));
      loadData();
    } catch {
      setError('Gagal menyimpan kasbon.');
    }
  }

  const formatRp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Kasbon</h2>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Input form */}
        <div className="card">
          <h3 className="font-semibold text-lg mb-4">Input Kasbon</h3>
          <div className="space-y-4">
            <div>
              <label className="label">Tanggal</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="input-field"
              />
            </div>
            <div>
              <label className="label">Nama Pekerja</label>
              <select
                value={form.employeeId}
                onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}
                className="input-field"
              >
                <option value="">-- Pilih Pekerja --</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Jumlah</label>
              <input
                type="number"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="input-field"
                placeholder="200000"
              />
            </div>
            <div>
              <label className="label">Alokasi Proyek</label>
              <select
                value={form.projectId}
                onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))}
                className="input-field"
              >
                <option value="">-- Pilih Proyek (opsional) --</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Keterangan</label>
              <input
                type="text"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="input-field"
                placeholder="Keterangan kasbon..."
              />
            </div>

            {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg">{error}</div>}
            {success && <div className="bg-green-50 text-green-700 p-3 rounded-lg">{success}</div>}

            <button onClick={handleSave} className="btn-primary w-full text-lg py-4">
              Simpan Kasbon
            </button>
          </div>
        </div>

        {/* History */}
        <div className="card">
          <h3 className="font-semibold text-lg mb-4">Riwayat Kasbon</h3>
          {advances.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Belum ada kasbon.</p>
          ) : (
            <div className="space-y-3">
              {advances.map((adv, i) => (
                <div key={i} className="border-b border-gray-100 pb-3 last:border-0">
                  <div className="flex justify-between">
                    <span className="font-medium">
                      {(adv.employees as { name: string } | undefined)?.name || '-'}
                    </span>
                    <span className="font-bold text-red-600">
                      {formatRp(Number(adv.amount))}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>{String(adv.advance_date)}</span>
                    <span>{(adv.projects as { name: string } | undefined)?.name || '-'}</span>
                  </div>
                  {adv.description ? (
                    <p className="text-sm text-gray-400 mt-1">{String(adv.description)}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
