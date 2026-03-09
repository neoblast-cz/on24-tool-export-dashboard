import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { readFile, readdir, existsSync } from 'fs';
import { promisify } from 'util';
import * as XLSX from 'xlsx';

const readFileAsync = promisify(readFile);
const readdirAsync = promisify(readdir);

export const dynamic = 'force-dynamic';

export interface ProgramRevenue {
  programName: string;
  opportunityCount: number;      // unique opportunity IDs
  opportunityIds: string[];      // first 20 unique opp IDs
  ftCreated: number;             // sum(credit × amountUSD)
  ftWon: number;
  mtCreated: number;
  mtWon: number;
  totalOpportunityValue: number; // sum of all amountUSD (raw pipeline)
}

export interface RevenueData {
  fileName: string;
  fileDate: string;             // YYYY-MM-DD prefix from filename
  programs: ProgramRevenue[];
  totals: {
    ftCreated: number;
    ftWon: number;
    mtCreated: number;
    mtWon: number;
    opportunityCount: number;
  };
}

const REPORTS_DIR = process.env.REPORTS_DIR
  ? process.env.REPORTS_DIR
  : path.join(process.cwd(), 'reports');

function extractDate(filename: string): string {
  const m = filename.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '0000-00-00';
}

async function getLatestXlsx(): Promise<{ filePath: string; fileName: string; fileDate: string } | null> {
  if (!existsSync(REPORTS_DIR)) return null;
  const allFiles = await readdirAsync(REPORTS_DIR);
  const files = allFiles
    .filter(f => f.endsWith('.xlsx') && !f.startsWith('~$') && !/program\s*membership/i.test(f))
    .sort((a, b) => extractDate(b).localeCompare(extractDate(a)));
  if (files.length === 0) return null;
  const fileName = files[0];
  return {
    filePath: path.join(REPORTS_DIR, fileName),
    fileName,
    fileDate: extractDate(fileName),
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fileParam = searchParams.get('file');

    let target: { filePath: string; fileName: string; fileDate: string } | null;
    if (fileParam) {
      if (fileParam.includes('/') || fileParam.includes('\\') || fileParam.includes('..')) {
        return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
      }
      const filePath = path.join(REPORTS_DIR, fileParam);
      if (!existsSync(filePath)) {
        return NextResponse.json({ error: `File "${fileParam}" not found` }, { status: 404 });
      }
      target = { filePath, fileName: fileParam, fileDate: extractDate(fileParam) };
    } else {
      target = await getLatestXlsx();
    }

    if (!target) {
      return NextResponse.json({ error: 'No report file found in /reports directory' }, { status: 404 });
    }
    const latest = target;

    // Read as buffer to avoid Windows/OneDrive file-lock issues with XLSX.readFile
    let buffer: Buffer;
    try {
      buffer = await readFileAsync(latest.filePath);
    } catch {
      return NextResponse.json({
        error: `Could not read "${latest.fileName}". If it is open in Excel, close it and try again.`,
      }, { status: 503 });
    }
    const wb = XLSX.read(buffer);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: Record<string, string | number>[] = XLSX.utils.sheet_to_json(ws, { defval: 0 });

    // Aggregate by program name
    const programMap = new Map<string, {
      oppIds: Set<string>;
      ftCreated: number;
      ftWon: number;
      mtCreated: number;
      mtWon: number;
      totalOpportunityValue: number;
    }>();

    for (const row of rows) {
      const programName = String(row['Program Name'] ?? '').trim();
      if (!programName) continue;

      const amountUSD = parseFloat(String(row['Amount USD'])) || 0;
      const oppId = String(row['Opportunity ID 18'] ?? '').trim();
      const ftCreatedCredit = Number(row['(FT) Opportunities Created']) || 0;
      const ftWonCredit = Number(row['(FT) Opportunities Won']) || 0;
      const mtCreatedCredit = Number(row['(MT) Opportunities Created']) || 0;
      const mtWonCredit = Number(row['(MT) Opportunities Won']) || 0;

      if (!programMap.has(programName)) {
        programMap.set(programName, {
          oppIds: new Set(),
          ftCreated: 0, ftWon: 0, mtCreated: 0, mtWon: 0,
          totalOpportunityValue: 0,
        });
      }
      const entry = programMap.get(programName)!;
      if (oppId) entry.oppIds.add(oppId);
      entry.ftCreated += ftCreatedCredit * amountUSD;
      entry.ftWon += ftWonCredit * amountUSD;
      entry.mtCreated += mtCreatedCredit * amountUSD;
      entry.mtWon += mtWonCredit * amountUSD;
      // Only count opportunity value once per unique opp
      if (oppId && !entry.oppIds.has(oppId)) {
        entry.totalOpportunityValue += amountUSD;
      }
    }

    // Re-compute totalOpportunityValue correctly (per-unique-opp, need a second pass)
    const oppValueMap = new Map<string, number>();
    for (const row of rows) {
      const oppId = String(row['Opportunity ID 18'] ?? '').trim();
      if (oppId && !oppValueMap.has(oppId)) {
        oppValueMap.set(oppId, parseFloat(String(row['Amount USD'])) || 0);
      }
    }
    // Per-program unique opp value
    const programOppValues = new Map<string, Map<string, number>>();
    for (const row of rows) {
      const programName = String(row['Program Name'] ?? '').trim();
      const oppId = String(row['Opportunity ID 18'] ?? '').trim();
      if (!programName || !oppId) continue;
      if (!programOppValues.has(programName)) programOppValues.set(programName, new Map());
      const pMap = programOppValues.get(programName)!;
      if (!pMap.has(oppId)) {
        pMap.set(oppId, parseFloat(String(row['Amount USD'])) || 0);
      }
    }

    const programs: ProgramRevenue[] = [];
    for (const [programName, entry] of Array.from(programMap.entries())) {
      const oppValMap = programOppValues.get(programName) ?? new Map<string, number>();
      let totalOpportunityValue = 0;
      for (const v of Array.from(oppValMap.values())) totalOpportunityValue += v;

      programs.push({
        programName,
        opportunityCount: entry.oppIds.size,
        opportunityIds: Array.from(entry.oppIds).slice(0, 20),
        ftCreated: Math.round(entry.ftCreated * 100) / 100,
        ftWon: Math.round(entry.ftWon * 100) / 100,
        mtCreated: Math.round(entry.mtCreated * 100) / 100,
        mtWon: Math.round(entry.mtWon * 100) / 100,
        totalOpportunityValue: Math.round(totalOpportunityValue * 100) / 100,
      });
    }

    // Sort by MT Won + FT Won descending
    programs.sort((a, b) => (b.mtWon + b.ftWon) - (a.mtWon + a.ftWon));

    const totals = programs.reduce(
      (acc, p) => ({
        ftCreated: acc.ftCreated + p.ftCreated,
        ftWon: acc.ftWon + p.ftWon,
        mtCreated: acc.mtCreated + p.mtCreated,
        mtWon: acc.mtWon + p.mtWon,
        opportunityCount: acc.opportunityCount + p.opportunityCount,
      }),
      { ftCreated: 0, ftWon: 0, mtCreated: 0, mtWon: 0, opportunityCount: 0 },
    );

    const data: RevenueData = {
      fileName: latest.fileName,
      fileDate: latest.fileDate,
      programs,
      totals,
    };

    return NextResponse.json(data);
  } catch (err) {
    console.error('[revenue/data]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
