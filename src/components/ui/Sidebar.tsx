'use client';

import { clsx } from 'clsx';

type Page = 'dashboard' | 'absen' | 'kasbon' | 'rekap' | 'master-data' | 'export';

const NAV_ITEMS: { id: Page; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'absen', label: 'Absensi', icon: '📋' },
  { id: 'kasbon', label: 'Kasbon', icon: '💰' },
  { id: 'rekap', label: 'Rekap', icon: '📑' },
  { id: 'master-data', label: 'Master Data', icon: '⚙️' },
  { id: 'export', label: 'Export', icon: '📥' },
];

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <aside className="w-64 bg-nw28-dark min-h-screen p-4 flex flex-col shrink-0 max-md:w-16">
      {/* Logo */}
      <div className="mb-8 px-2">
        <h1 className="text-2xl font-bold text-white max-md:hidden">NW28</h1>
        <p className="text-sm text-gray-400 max-md:hidden">Absensi System</p>
        <h1 className="text-xl font-bold text-white md:hidden text-center">N</h1>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={clsx(
              'nav-item',
              currentPage === item.id && 'nav-item-active'
            )}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="max-md:hidden">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Logout */}
      <div className="mt-auto">
        <button className="nav-item w-full text-gray-400 hover:text-white">
          <span className="text-xl">🚪</span>
          <span className="max-md:hidden">Logout</span>
        </button>
      </div>
    </aside>
  );
}
