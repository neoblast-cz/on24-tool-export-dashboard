import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

const MARKETO_DIR = process.env.MARKETO_DIR
  ? process.env.MARKETO_DIR
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

    // Ensure marketo-reports directory exists
    if (!fs.existsSync(MARKETO_DIR)) {
      fs.mkdirSync(MARKETO_DIR, { recursive: true });
    }

    // Apply naming convention: YYYY-MM-DD Program Membership.xlsx
    const dateMatch = file.name.match(/^(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10);
    const saveName = `${date} Program Membership.xlsx`;

    const savePath = path.join(MARKETO_DIR, saveName);
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(savePath, buffer);

    return NextResponse.json({ success: true, savedAs: saveName });
  } catch (err) {
    console.error('[marketo/upload]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
