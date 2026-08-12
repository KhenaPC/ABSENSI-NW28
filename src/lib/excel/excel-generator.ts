/**
 * NW28 Excel Generator
 * 
 * Flow: DATABASE → CALCULATION RESULT → EXCEL MAPPER → NW28 TEMPLATE → OUTPUT XLSX
 * 
 * This module clones the original NW28 template and injects data.
 * It preserves ALL formatting: fonts, colors, borders, merges, widths, etc.
 */

import ExcelJS from 'exceljs';
import type { ExcelEmployeeData } from '@/types';

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

// Each employee block in the template occupies ~21 rows
const BLOCK_SIZE = 21;

// Row offsets within each employee block (0-indexed from block start)
const OFFSETS = {
  HEADER_C: 0,          // Row with "C" merge
  PROJECT_HEADERS: 1,   // Harian/Proyek, Lembur/Proyek, Total/Proyek
  NAME: 2,              // Nama, PROJECT 1
  POSITION: 3,          // Jabatan, PROJECT 2
  PERIOD: 4,            // Periode, PROJECT 3
  KASBON: 5,            // Kasbon - Alokasi, PROJECT 4
  PROJ5: 6,             // PROJECT 5
  DAILY_RATE: 7,        // Upah Harian, PROJECT 6
  HOURLY_RATE: 8,       // Upah/jam, Lembur/jam
  TABLE_HEADER: 9,      // Hari, MASUK, KELUAR...
  TABLE_SUBHEADER: 10,  // (Jam), (Jam)...
  DAY_START: 11,        // First day row (Minggu/Senin)
  // Days occupy rows 11-17 (7 days)
  TOTAL_UPAH: 18,       // TOTAL UPAH
  TOTAL_DITERIMA: 19,   // TOTAL UPAH DITERIMA
};

// Column indices (1-based for ExcelJS)
const COLS = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, I: 9, J: 10, K: 11,
  N: 14, O: 15, P: 16,
};

export async function generateNW28Excel(
  templatePath: string,
  employees: ExcelEmployeeData[],
  periodName: string
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);

  const templateSheet = workbook.worksheets[0];
  if (!templateSheet) throw new Error('Template sheet not found');

  // For each employee, we need a block of rows
  // The template has blocks for multiple employees already
  // We'll create a new workbook with the same styling

  const outWorkbook = new ExcelJS.Workbook();
  const sheet = outWorkbook.addWorksheet(periodName, {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'landscape',
    },
  });

  // Copy column widths from template
  templateSheet.columns.forEach((col, idx) => {
    if (col.width) {
      const outCol = sheet.getColumn(idx + 1);
      outCol.width = col.width;
    }
  });

  let currentRow = 1;

  for (const emp of employees) {
    writeEmployeeBlock(sheet, currentRow, emp, templateSheet);
    currentRow += BLOCK_SIZE + 1; // gap between blocks
  }

  // Write summary recap at the end
  writeRecapSummary(sheet, currentRow, employees);

  const buffer = await outWorkbook.xlsx.writeBuffer();
  return Buffer.from(buffer) as unknown as Buffer;
}

function writeEmployeeBlock(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  emp: ExcelEmployeeData,
  templateSheet: ExcelJS.Worksheet
): void {
  // Copy styles from template first block (rows 1-20)
  copyBlockStyles(templateSheet, sheet, 1, startRow, BLOCK_SIZE);

  const r = (offset: number) => startRow + offset;

  // ── Header ──
  sheet.mergeCells(r(0), COLS.B, r(0), COLS.K);
  setCell(sheet, r(0), COLS.B, 'C');

  // Check / Balance header
  setCell(sheet, r(0), COLS.N, 'Check / Balance');

  // ── Project headers ──
  setCell(sheet, r(1), COLS.I, 'Harian/Proyek');
  setCell(sheet, r(1), COLS.J, 'Lembur/Proyek');
  setCell(sheet, r(1), COLS.K, 'Total/Proyek');

  // ── Employee info ──
  setCell(sheet, r(2), COLS.B, 'Nama:');
  setCell(sheet, r(2), COLS.C, emp.name);
  setCell(sheet, r(3), COLS.B, 'Jabatan:');
  setCell(sheet, r(3), COLS.C, emp.position);
  setCell(sheet, r(4), COLS.B, 'Periode:');
  setCell(sheet, r(4), COLS.C, emp.period);
  setCell(sheet, r(5), COLS.B, 'Kasbon - Alokasi:');
  setCell(sheet, r(5), COLS.C, emp.kasbonAmount, '#,##0');
  if (emp.kasbonProject) {
    setCell(sheet, r(5), COLS.D, emp.kasbonProject);
  }

  setCell(sheet, r(7), COLS.B, 'Upah Harian:');
  setCell(sheet, r(7), COLS.C, emp.dailyRate, '#,##0');
  setCell(sheet, r(8), COLS.B, 'Upah/jam :');
  setCell(sheet, r(8), COLS.C, emp.hourlyRate, '#,##0');
  setCell(sheet, r(8), COLS.D, 'Lembur/jam:');
  setCell(sheet, r(8), COLS.E, emp.overtimeRate, '#,##0');

  // ── Project table (up to 6) ──
  setCell(sheet, r(2), COLS.F, 'PROJECT');
  for (let i = 0; i < 6; i++) {
    const projRow = r(2) + i;
    setCell(sheet, projRow, COLS.G, `${i + 1}.`);
    if (i < emp.projects.length) {
      const proj = emp.projects[i];
      setCell(sheet, projRow, COLS.H, proj.name);
      setCell(sheet, projRow, COLS.I, proj.normalCost, '#,##0');
      setCell(sheet, projRow, COLS.J, proj.overtimeCost, '#,##0');
      setCell(sheet, projRow, COLS.K, proj.total, '#,##0');
    }
  }

  // ── Check / Balance ──
  setCell(sheet, r(2), COLS.N, 'Total Upah');
  setCell(sheet, r(2), COLS.O, ':');
  setCell(sheet, r(2), COLS.P, emp.checkBalance.totalUpah, '#,##0');
  setCell(sheet, r(3), COLS.N, 'Total Rekap/Proyek');
  setCell(sheet, r(3), COLS.O, ':');
  setCell(sheet, r(3), COLS.P, emp.checkBalance.totalRekapProyek, '#,##0');

  // Valid/Invalid status
  if (emp.checkBalance.isValid) {
    setCell(sheet, r(5), COLS.N, 'Angka Harus Sama!');
  } else {
    const cell = sheet.getCell(r(5), COLS.N);
    cell.value = 'SALAH - Angka Tidak Sama!';
    cell.font = { color: { argb: 'FFFF0000' }, bold: true };
  }

  // ── Table headers ──
  setCell(sheet, r(9), COLS.B, 'Hari');
  setCell(sheet, r(9), COLS.C, 'MASUK');
  setCell(sheet, r(9), COLS.D, 'KELUAR');
  setCell(sheet, r(9), COLS.E, 'Jam Kerja');
  setCell(sheet, r(9), COLS.F, 'Jam Lembur');
  setCell(sheet, r(9), COLS.G, 'Jml Hari');
  setCell(sheet, r(9), COLS.H, 'Lembur Aktif');
  setCell(sheet, r(9), COLS.I, 'Proyek');
  sheet.mergeCells(r(9), COLS.J, r(9), COLS.K);
  setCell(sheet, r(9), COLS.J, 'REKAP');

  setCell(sheet, r(10), COLS.C, '(Jam)');
  setCell(sheet, r(10), COLS.D, '(Jam)');
  setCell(sheet, r(10), COLS.H, '(Pot Istirahat)');
  setCell(sheet, r(10), COLS.J, 'JML Harian');
  setCell(sheet, r(10), COLS.K, 'Jml Lembur');

  // ── Day rows ──
  let totalNormalPay = 0;
  let totalOvertimePay = 0;
  let totalOvertimeHours = 0;
  let totalDays = 0;

  for (let d = 0; d < 7; d++) {
    const dayRow = r(11) + d;
    const att = emp.attendances[d];

    setCell(sheet, dayRow, COLS.B, DAY_NAMES[d]);

    if (att && att.clockIn) {
      setCell(sheet, dayRow, COLS.C, att.clockIn);
      setCell(sheet, dayRow, COLS.D, att.clockOut || '');
      setCell(sheet, dayRow, COLS.E, formatJamKerja(att.workHours));
      setCell(sheet, dayRow, COLS.F, formatJamLembur(att.overtimeHours));
      setCell(sheet, dayRow, COLS.G, att.normalDay);
      if (att.activeOvertime > 0) {
        setCell(sheet, dayRow, COLS.H, att.activeOvertime);
      }
      setCell(sheet, dayRow, COLS.I, att.projectName);
      setCell(sheet, dayRow, COLS.J, att.dailyPay, '#,##0');
      setCell(sheet, dayRow, COLS.K, att.overtimePay, '#,##0');

      totalNormalPay += att.dailyPay;
      totalOvertimePay += att.overtimePay;
      totalOvertimeHours += att.overtimeHours;
      totalDays += att.normalDay;
    }
  }

  // ── Totals ──
  setCell(sheet, r(18), COLS.B, 'TOTAL UPAH');
  setCell(sheet, r(18), COLS.D, totalNormalPay + totalOvertimePay, '#,##0');
  setCell(sheet, r(18), COLS.G, totalDays);
  setCell(sheet, r(18), COLS.J, totalNormalPay, '#,##0');
  setCell(sheet, r(18), COLS.K, totalOvertimePay, '#,##0');

  // TOTAL UPAH DITERIMA
  setCell(sheet, r(19), COLS.B, 'TOTAL UPAH DITERIMA (Potong Kasbon)');
  sheet.mergeCells(r(19), COLS.D, r(19), COLS.E);
  setCell(sheet, r(19), COLS.D, emp.totalUpahDiterima, '#,##0');
}

function writeRecapSummary(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  employees: ExcelEmployeeData[]
): void {
  setCell(sheet, startRow, COLS.B, 'REKAPITULASI UPAH MINGGUAN');
  const cell = sheet.getCell(startRow, COLS.B);
  cell.font = { bold: true, size: 12 };

  startRow++;
  setCell(sheet, startRow, COLS.B, 'NAMA PROYEK');
  setCell(sheet, startRow, COLS.C, 'TOTAL UPAH');
  setCell(sheet, startRow, COLS.D, 'KASBON');
  setCell(sheet, startRow, COLS.E, 'SISA');

  // Aggregate projects
  const projectMap = new Map<string, { total: number; kasbon: number }>();

  for (const emp of employees) {
    for (const proj of emp.projects) {
      const existing = projectMap.get(proj.name) || { total: 0, kasbon: 0 };
      existing.total += proj.total;
      projectMap.set(proj.name, existing);
    }
    // Map kasbon to project
    if (emp.kasbonProject && emp.kasbonAmount > 0) {
      const existing = projectMap.get(emp.kasbonProject) || { total: 0, kasbon: 0 };
      existing.kasbon += emp.kasbonAmount;
      projectMap.set(emp.kasbonProject, existing);
    }
  }

  startRow++;
  let grandTotal = 0;
  let grandKasbon = 0;

  for (const [name, data] of projectMap) {
    setCell(sheet, startRow, COLS.B, name);
    setCell(sheet, startRow, COLS.C, data.total, '#,##0');
    setCell(sheet, startRow, COLS.D, data.kasbon, '#,##0');
    setCell(sheet, startRow, COLS.E, data.total - data.kasbon, '#,##0');
    grandTotal += data.total;
    grandKasbon += data.kasbon;
    startRow++;
  }

  // Grand total
  setCell(sheet, startRow, COLS.C, grandTotal, '#,##0');
  setCell(sheet, startRow, COLS.D, grandKasbon, '#,##0');
  setCell(sheet, startRow, COLS.E, grandTotal - grandKasbon, '#,##0');
}

// ─── Utility Functions ────────────────────────────────────────────

function setCell(
  sheet: ExcelJS.Worksheet,
  row: number,
  col: number,
  value: string | number,
  numFmt?: string
): void {
  const cell = sheet.getCell(row, col);
  cell.value = value;
  if (numFmt) cell.numFmt = numFmt;
}

function formatJamKerja(hours: number): string {
  if (hours === 0) return '';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h},${m.toString().padStart(2, '0')} Jam`;
}

function formatJamLembur(hours: number): string {
  if (hours === 0) return '0,00 Jam';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h},${m.toString().padStart(2, '0')} Jam`;
}

function copyBlockStyles(
  source: ExcelJS.Worksheet,
  target: ExcelJS.Worksheet,
  sourceStart: number,
  targetStart: number,
  numRows: number
): void {
  for (let i = 0; i < numRows; i++) {
    const srcRow = source.getRow(sourceStart + i);
    const tgtRow = target.getRow(targetStart + i);
    tgtRow.height = srcRow.height;

    srcRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const tgtCell = tgtRow.getCell(colNumber);
      if (cell.style) {
        tgtCell.style = { ...cell.style };
      }
    });
  }
}

/**
 * Generate Excel from template file (preserving original formatting)
 * This is the preferred method — clones the original file.
 */
export async function generateFromTemplate(
  templateBuffer: Uint8Array,
  employees: ExcelEmployeeData[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateBuffer as unknown as ExcelJS.Buffer);

  // The template has the first employee block starting at row 1
  // We'll clone the template sheet for each employee or inject data into existing blocks

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('Template sheet not found');

  // For a proper template-based approach:
  // The template file has blocks of 21 rows per employee
  // We inject data into each block
  
  let blockStart = 1;
  for (let i = 0; i < employees.length; i++) {
    injectEmployeeData(sheet, blockStart, employees[i]);
    blockStart += BLOCK_SIZE + 1; // template has gaps
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer) as unknown as Buffer;
}

function injectEmployeeData(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  emp: ExcelEmployeeData
): void {
  const r = (offset: number) => startRow + offset;

  // Inject employee info
  sheet.getCell(r(2), COLS.C).value = emp.name;
  sheet.getCell(r(3), COLS.C).value = emp.position;
  sheet.getCell(r(4), COLS.C).value = emp.period;
  sheet.getCell(r(5), COLS.C).value = emp.kasbonAmount;
  if (emp.kasbonProject) sheet.getCell(r(5), COLS.D).value = emp.kasbonProject;
  sheet.getCell(r(7), COLS.C).value = emp.dailyRate;
  sheet.getCell(r(8), COLS.E).value = emp.overtimeRate;

  // Inject project data
  for (let i = 0; i < Math.min(6, emp.projects.length); i++) {
    const proj = emp.projects[i];
    sheet.getCell(r(2) + i, COLS.H).value = proj.name;
  }

  // Inject attendance data
  for (let d = 0; d < 7; d++) {
    const dayRow = r(11) + d;
    const att = emp.attendances[d];
    if (att && att.clockIn) {
      sheet.getCell(dayRow, COLS.C).value = att.clockIn;
      sheet.getCell(dayRow, COLS.D).value = att.clockOut || '';
      sheet.getCell(dayRow, COLS.G).value = att.normalDay;
      if (att.activeOvertime > 0) {
        sheet.getCell(dayRow, COLS.H).value = att.activeOvertime;
      }
      sheet.getCell(dayRow, COLS.I).value = att.projectName;
    }
  }

  // Check/Balance
  sheet.getCell(r(2), COLS.P).value = emp.checkBalance.totalUpah;
  sheet.getCell(r(3), COLS.P).value = emp.checkBalance.totalRekapProyek;
}
