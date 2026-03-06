import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

const REPORTS_DIR = process.env.REPORTS_DIR
  ? process.env.REPORTS_DIR
  : path.join(process.cwd(), 'reports');

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!file.name.endsWith('.xlsx')) {
      return NextResponse.json({ error: 'Only .xlsx files are accepted' }, { status: 400 });
    }

    // Ensure reports directory exists
    if (!fs.existsSync(REPORTS_DIR)) {
      fs.mkdirSync(REPORTS_DIR, { recursive: true });
    }

    // Prefix with today's date if filename doesn't already start with a date
    let saveName = file.name;
    if (!/^\d{4}-\d{2}-\d{2}/.test(saveName)) {
      const today = new Date().toISOString().slice(0, 10);
      saveName = `${today} ${saveName}`;
    }

    const savePath = path.join(REPORTS_DIR, saveName);
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(savePath, buffer);

    return NextResponse.json({ success: true, savedAs: saveName });
  } catch (err) {
    console.error('[revenue/upload]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
