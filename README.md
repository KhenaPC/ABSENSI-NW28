# NW28 Absensi System

Sistem Absensi & Payroll Internal NW28 — Full Web Application.

## Architecture

```
ADMIN → WEB APP → SUPABASE → NW28 CALCULATION ENGINE → EXCEL OUTPUT
```

**Stack:** Next.js 14 · React · TypeScript · Tailwind CSS · Supabase (PostgreSQL) · ExcelJS

## Features

| Feature | Status |
|---|---|
| Frontend berjalan | ✅ |
| TypeScript strict compile | ✅ |
| Production build | ✅ |
| Supabase schema + RLS | ✅ |
| Authentication (email/password) | ✅ |
| Role (OWNER/ADMIN) | ✅ |
| Master Nama Pekerja | ✅ |
| Master Proyek | ✅ |
| Upah Harian + History | ✅ |
| Periode Gaji (OPEN/LOCKED/PAID) | ✅ |
| Attendance Input | ✅ |
| Quick Entry | ✅ |
| Copy Previous Day | ✅ |
| Missing Attendance tracker | ✅ |
| Calculation Engine (pure TS) | ✅ |
| GOLDEN TEST: COLAY (08→22 = 1d+5OT) | ✅ |
| GOLDEN TEST: CEPOT (10→22 = 1d+3OT) | ✅ |
| Overtime break 18–19 deduction | ✅ |
| Actual vs Paid Overtime | ✅ |
| Multi Project allocation | ✅ |
| Kasbon | ✅ |
| Payroll calculation | ✅ |
| Project Costing | ✅ |
| Check / Balance | ✅ |
| Historical payroll safe | ✅ |
| Locked payroll protection | ✅ |
| Export validation | ✅ |
| Excel generator (template-based) | ✅ |
| Automated tests (39 tests) | ✅ |
| Audit log schema | ✅ |

## Business Rules (Hardcoded in Engine)

- **Normal workday**: 08:00–16:00 (7 jam efektif = 1 HARI NORMAL)
- **Lunch break**: 12:00–13:00
- **OT break**: 18:00–19:00 (NOT counted as overtime)
- **Late arrival**: Normal day tetap 1, overtime opportunity berkurang
- **Overtime formula**: `rawOT = max(0, span - 8h)`, then deduct 1h if clockOut > 18:00
- **Hourly rate**: daily_rate / 8

## Quick Start

### 1. Clone & Install

```bash
git clone <repo>
cd nw28-absensi
npm install
```

### 2. Supabase Setup

1. Create a new Supabase project
2. Run `supabase/schema.sql` in the SQL Editor
3. Create `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

4. Create initial user in Supabase Auth dashboard

### 3. Run

```bash
npm run dev    # Development
npm run build  # Production build
npm run test   # Run all 39 tests
```

### 4. Seed Data

Add via Master Data UI:
- Pekerja: COLAI, YADI, DEDEN, UCUP, MANTRI, EPUL, etc.
- Proyek: SURYALAYA, BU MIA, PARFUM, KAMOJANG, BBK, BIN, MALEER, etc.
- Periode: 2-8 AGUSTUS 2026

## Project Structure

```
src/
├── app/
│   ├── api/export/route.ts    # Excel generation API
│   ├── layout.tsx
│   ├── page.tsx               # Main SPA entry
│   └── globals.css
├── components/
│   ├── attendance/            # Absensi input + Quick Entry
│   ├── kasbon/                # Kasbon management
│   ├── recap/                 # Rekap Pegawai/Proyek/Kasbon
│   ├── master-data/           # Employee/Project/Rate/Period CRUD
│   ├── export/                # Export validation + Excel gen
│   ├── ui/                    # Sidebar, shared components
│   ├── Dashboard.tsx
│   └── LoginPage.tsx
├── lib/
│   ├── engine/
│   │   └── nw28-attendance-engine.ts  # Pure calculation engine
│   ├── excel/
│   │   └── excel-generator.ts         # Excel template mapper
│   ├── db/
│   │   └── service.ts                 # Database service layer
│   ├── supabase.ts                    # Browser client
│   └── supabase-server.ts            # Server client
└── types/
    └── index.ts                       # All TypeScript types

__tests__/
└── nw28-engine.test.ts               # 39 automated tests

supabase/
└── schema.sql                        # Full DB schema + RLS
```

## Calculation Engine

The engine is a **pure TypeScript module** with zero dependencies on database or UI.

```typescript
import { calculateAttendance } from '@/lib/engine/nw28-attendance-engine';

const result = calculateAttendance({ clockIn: '08:00', clockOut: '22:00' });
// → { normalDay: 1, normalHours: 7, actualOvertimeHours: 5, ... }
```

## Excel Output

The Excel generator preserves the NW28 template format:
- Font, colors, borders, merges
- Column widths, row heights
- Project table (up to 6 projects)
- Check/Balance section
- Per-employee weekly attendance grid
- Total Upah / Total Upah Diterima

## Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |

## Testing

```bash
npm run test
```

All 39 tests cover:
- Golden tests (COLAY, CEPOT)
- Normal workday (08-16)
- Overtime calculations (various times)
- OT break 18-19 deduction
- Late arrival OT reduction (09→22, 10→22, 11→22, 12→22)
- Paid vs Actual OT validation
- Multi-project allocation
- Check/Balance
- Kasbon deduction
- Rate change isolation
- Payroll calculation

## License

Internal NW28 — Proprietary
