'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import Sidebar from '@/components/ui/Sidebar';
import Dashboard from '@/components/Dashboard';
import AttendancePage from '@/components/attendance/AttendancePage';
import KasbonPage from '@/components/kasbon/KasbonPage';
import RekapPage from '@/components/recap/RekapPage';
import MasterDataPage from '@/components/master-data/MasterDataPage';
import ExportPage from '@/components/export/ExportPage';
import LoginPage from '@/components/LoginPage';

type Page = 'dashboard' | 'absen' | 'kasbon' | 'rekap' | 'master-data' | 'export';

export default function Home() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [session, setSession] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(false);

  const supabase = createClient();

  const checkSession = useCallback(async () => {
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      setSession(s);
    } catch {
      // Supabase not configured — run in demo mode
      setDemoMode(true);
    }
    setLoading(false);
  }, [supabase.auth]);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-500">Memuat NW28...</div>
      </div>
    );
  }

  if (!session && !demoMode) {
    return <LoginPage onLogin={() => checkSession()} />;
  }

  return (
    <div className="min-h-screen flex">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="flex-1 p-4 md:p-8 overflow-auto">
        {currentPage === 'dashboard' && <Dashboard />}
        {currentPage === 'absen' && <AttendancePage />}
        {currentPage === 'kasbon' && <KasbonPage />}
        {currentPage === 'rekap' && <RekapPage />}
        {currentPage === 'master-data' && <MasterDataPage />}
        {currentPage === 'export' && <ExportPage />}
      </main>
    </div>
  );
}
