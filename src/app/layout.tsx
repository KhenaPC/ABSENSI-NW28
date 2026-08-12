import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NW28 Absensi System',
  description: 'Sistem Absensi & Payroll Internal NW28',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="bg-gray-50 text-gray-900 min-h-screen">
        {children}
      </body>
    </html>
  );
}
