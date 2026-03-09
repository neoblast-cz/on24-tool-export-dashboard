import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { readFile, readdir, existsSync } from 'fs';
import { promisify } from 'util';
import * as XLSX from 'xlsx';

const readFileAsync = promisify(readFile);
const readdirAsync  = promisify(readdir);

export const dynamic = 'force-dynamic';

export interface MarketoProgramRow {
  programName: string;
  members: number;
  newNames: number;
  success: number;
  conversionRate: number;   // success / members
  newNamesRate: number;     // newNames / members
  flags: string[];          // suspicious-setup warnings
}

export interface MarketoData {
  fileName: string;
  fileDate: string;
  programs: MarketoProgramRow[];
  totals: {
    members: number;
    newNames: number;
    success: number;
  };
}

const MARKETO_DIR = process.env.MARKETO_DIR
  ? process.env.MARKETO_DIR
  : path.join(process.cwd(), 'reports');

function extractDate(filename: string): string {
  const m = filename.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '0000-00-00';
}

async function getLatestXlsx(): Promise<{ filePath: string; fileName: string; fileDate: string } | null> {
  if (!existsSync(MARKETO_DIR)) return null;
  const allFiles = await readdirAsync(MARKETO_DIR);
  const files = allFiles
    .filter(f => f.endsWith('.xlsx') && !f.startsWith('~$') && /program\s*membership/i.test(f))
    .sort((a, b) => extractDate(b).localeCompare(extractDate(a)));
  if (files.length === 0) return null;
  const fileName = files[0];
  return { filePath: path.join(MARKETO_DIR, fileName), fileName, fileDate: extractDate(fileName) };
}

function computeFlags(members: number, newNames: number, success: number): string[] {
  const flags: string[] = [];
  if (members > 0 && members < 500)       flags.push('Low members — invitees may not be tracked');
  if (members > 0 && newNames === 0)       flags.push('No new names — possible wrong setup');
  if (members > 0 && success > members)   flags.push('Success exceeds members — data error');
  if (members > 0 && success === 0)       flags.push('Zero successes');
  return flags;
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
      const filePath = path.join(MARKETO_DIR, fileParam);
      if (!existsSync(filePath)) {
        return NextResponse.json({ error: `File "${fileParam}" not found` }, { status: 404 });
      }
      target = { filePath, fileName: fileParam, fileDate: extractDate(fileParam) };
    } else {
      target = await getLatestXlsx();
    }

    if (!target) {
      return NextResponse.json({ error: 'No Marketo report found in /reports directory' }, { status: 404 });
    }
    const latest = target;

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

    const programMap = new Map<string, { members: number; newNames: number; success: number }>();

    for (const row of rows) {
      const programName = String(row['Program Name'] ?? '').trim();
      if (!programName) continue;
      const members  = Number(row['Members'])    || 0;
      const newNames = Number(row['New Names'])   || 0;
      const success  = Number(row['Success (Total)']) || 0;

      if (!programMap.has(programName)) {
        programMap.set(programName, { members: 0, newNames: 0, success: 0 });
      }
      const e = programMap.get(programName)!;
      e.members  += members;
      e.newNames += newNames;
      e.success  += success;
    }

    const programs: MarketoProgramRow[] = Array.from(programMap.entries()).map(([programName, e]) => ({
      programName,
      members:        e.members,
      newNames:       e.newNames,
      success:        e.success,
      conversionRate: e.members > 0 ? Math.round((e.success  / e.members) * 1000) / 10 : 0,
      newNamesRate:   e.members > 0 ? Math.round((e.newNames / e.members) * 1000) / 10 : 0,
      flags:          computeFlags(e.members, e.newNames, e.success),
    }));

    // Sort by members descending
    programs.sort((a, b) => b.members - a.members);

    const totals = programs.reduce(
      (acc, p) => ({ members: acc.members + p.members, newNames: acc.newNames + p.newNames, success: acc.success + p.success }),
      { members: 0, newNames: 0, success: 0 },
    );

    return NextResponse.json({ fileName: latest.fileName, fileDate: latest.fileDate, programs, totals } satisfies MarketoData);
  } catch (err) {
    console.error('[marketo/data]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
