import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const rows = db.select().from(schema.settings).all();
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const db = getDb();

  for (const [key, value] of Object.entries(body)) {
    db.insert(schema.settings)
      .values({ key, value: String(value), updatedAt: sql`(datetime('now','localtime'))` })
      .onConflictDoUpdate({
        target: schema.settings.key,
        set: { value: String(value), updatedAt: sql`(datetime('now','localtime'))` },
      })
      .run();
  }

  return NextResponse.json({ ok: true });
}
