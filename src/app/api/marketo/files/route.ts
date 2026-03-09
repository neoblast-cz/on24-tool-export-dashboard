import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

const REPORTS_DIR = process.env.REPORTS_DIR
  ? process.env.REPORTS_DIR
  : path.join(process.cwd(), 'reports');

function extractDate(filename: string): string {
  const m = filename.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '0000-00-00';
}

export async function GET() {
  try {
    if (!fs.existsSync(REPORTS_DIR)) return NextResponse.json({ files: [] });
    const files = fs.readdirSync(REPORTS_DIR)
      .filter(f => f.endsWith('.xlsx') && !f.startsWith('~$') && /program\s*membership/i.test(f))
      .sort((a, b) => extractDate(b).localeCompare(extractDate(a)));
    return NextResponse.json({ files });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const file = searchParams.get('file');
    if (!file) return NextResponse.json({ error: 'No file specified' }, { status: 400 });
    if (file.includes('/') || file.includes('\\') || file.includes('..')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }
    const filePath = path.join(REPORTS_DIR, file);
    if (!fs.existsSync(filePath)) return NextResponse.json({ error: 'File not found' }, { status: 404 });
    fs.unlinkSync(filePath);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
