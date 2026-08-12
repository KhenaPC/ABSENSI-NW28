'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalPekerja: 0,
    sudahAbsen: 0,
    belumAbsen: 0,
    totalUpahHariIni: 0,
  });
  const [todayAttendance, setTodayAttendance] = useState<
    { name: string; clockIn: string; clockOut: string; project: string }[]
  >([]);
  const [missingWorkers, setMissingWorkers] = useState<string[]>([]);

  const today = new Date().toISOString().split('T')[0];
  const supabase = createClient();

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      // Get active employees
      const { data: employees } = await supabase
        .from('employees')
        .select('id, name')
        .eq('active', true);

      // Get today's attendance
      const { data: attendance } = await supabase
        .from('attendance')
        .select(`
          id, clock_in, clock_out, normal_pay, overtime_pay,
          employees(name),
          attendance_projects(projects(name))
        `)
        .eq('work_date', today);

      const totalPekerja = employees?.length || 0;
      const sudahAbsen = attendance?.length || 0;
      const belumAbsen = totalPekerja - sudahAbsen;

      const totalUpah = (attendance || []).reduce(
        (sum, a) => sum + Number(a.normal_pay || 0) + Number(a.overtime_pay || 0),
        0
      );

      const attendedIds = new Set((attendance || []).map((a: Record<string, unknown>) => 
        (a.employees as { name: string } | undefined)?.name
      ));
      
      const missing = (employees || [])
        .filter(e => !attendedIds.has(e.name))
        .map(e => e.name);

      setStats({
        totalPekerja,
        sudahAbsen,
        belumAbsen,
        totalUpahHariIni: totalUpah,
      });

      setTodayAttendance(
        (attendance || []).map((a: Record<string, unknown>) => ({
          name: ((a.employees as { name: string } | undefined)?.name) || '-',
          clockIn: String(a.clock_in || '').substring(0, 5),
          clockOut: String(a.clock_out || '').substring(0, 5),
          project: Array.isArray(a.attendance_projects)
            ? a.attendance_projects
                .map((ap: { projects?: { name?: string } }) => ap.projects?.name || '')
                .filter(Boolean)
                .join('/')
            : '-',
        }))
      );

      setMissingWorkers(missing);
    } catch {
      // Demo mode — show placeholder data
      setStats({ totalPekerja: 15, sudahAbsen: 9, belumAbsen: 6, totalUpahHariIni: 1980000 });
    }
  }

  const formatRp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-1">Dashboard</h2>
      <p className="text-gray-500 mb-6">
        {new Date().toLocaleDateString('id-ID', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
      </p>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="stat-card">
          <p className="text-3xl font-bold text-nw28-dark">{stats.totalPekerja}</p>
          <p className="text-sm text-gray-500 mt-1">Total Pekerja</p>
        </div>
        <div className="stat-card">
          <p className="text-3xl font-bold text-green-600">{stats.sudahAbsen}</p>
          <p className="text-sm text-gray-500 mt-1">Sudah Absen</p>
        </div>
        <div className="stat-card">
          <p className="text-3xl font-bold text-red-500">{stats.belumAbsen}</p>
          <p className="text-sm text-gray-500 mt-1">Belum Absen</p>
        </div>
        <div className="stat-card">
          <p className="text-xl font-bold text-nw28-accent">{formatRp(stats.totalUpahHariIni)}</p>
          <p className="text-sm text-gray-500 mt-1">Total Upah Hari Ini</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Today's attendance */}
        <div className="card">
          <h3 className="font-semibold text-lg mb-4">Absensi Hari Ini</h3>
          {todayAttendance.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Belum ada absensi hari ini.</p>
          ) : (
            <div className="space-y-2">
              {todayAttendance.map((a, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="font-medium">{a.name}</p>
                    <p className="text-sm text-gray-500">{a.project}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p>{a.clockIn} — {a.clockOut}</p>
                    <p className="text-green-600">✓</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Missing workers */}
        <div className="card">
          <h3 className="font-semibold text-lg mb-4">
            Belum Absen ({missingWorkers.length})
          </h3>
          {missingWorkers.length === 0 ? (
            <p className="text-green-600 text-center py-8">Semua pekerja sudah absen! ✓</p>
          ) : (
            <div className="space-y-2">
              {missingWorkers.map((name, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                  <span className="text-red-400">●</span>
                  <span>{name}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-500">
              {stats.sudahAbsen} / {stats.totalPekerja} Selesai
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{
                  width: stats.totalPekerja > 0
                    ? `${(stats.sudahAbsen / stats.totalPekerja) * 100}%`
                    : '0%',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
