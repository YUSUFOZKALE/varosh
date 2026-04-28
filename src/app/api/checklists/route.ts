import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { desc, eq, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const FALLBACK_OPENING = ["Mutfak temizligi yapildi", "Malzemeler kontrol edildi", "Kasalar acildi ve sayildi"];
const FALLBACK_CLOSING = ["Kasalar sayildi ve kapatildi", "Mutfak temizlendi", "Kapilar kilitlendi"];

function getTemplates(db: ReturnType<typeof getDb>) {
  const openRow = db.select().from(schema.settings).where(eq(schema.settings.key, "checklist_opening")).get();
  const closeRow = db.select().from(schema.settings).where(eq(schema.settings.key, "checklist_closing")).get();
  return {
    opening: openRow ? JSON.parse(openRow.value) : FALLBACK_OPENING,
    closing: closeRow ? JSON.parse(closeRow.value) : FALLBACK_CLOSING,
  };
}

export async function GET(req: NextRequest) {
  const db = getDb();
  const date = req.nextUrl.searchParams.get("date") || new Date().toISOString().split("T")[0];

  const lists = db.select()
    .from(schema.checklists)
    .where(sql`${schema.checklists.date} = ${date}`)
    .orderBy(desc(schema.checklists.createdAt))
    .all();

  return NextResponse.json({ lists, defaults: getTemplates(db) });
}

export async function POST(req: NextRequest) {
  const { type, items } = await req.json();
  const session = getSession();
  const staffId = session?.staffId || 1;
  const db = getDb();
  const date = new Date().toISOString().split("T")[0];

  const entry = db.insert(schema.checklists)
    .values({ type, date, staffId, items: JSON.stringify(items) })
    .returning()
    .get();

  return NextResponse.json(entry, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const { opening, closing } = await req.json();
  const db = getDb();

  if (opening) {
    db.insert(schema.settings)
      .values({ key: "checklist_opening", value: JSON.stringify(opening), updatedAt: sql`(datetime('now','localtime'))` })
      .onConflictDoUpdate({ target: schema.settings.key, set: { value: JSON.stringify(opening), updatedAt: sql`(datetime('now','localtime'))` } })
      .run();
  }
  if (closing) {
    db.insert(schema.settings)
      .values({ key: "checklist_closing", value: JSON.stringify(closing), updatedAt: sql`(datetime('now','localtime'))` })
      .onConflictDoUpdate({ target: schema.settings.key, set: { value: JSON.stringify(closing), updatedAt: sql`(datetime('now','localtime'))` } })
      .run();
  }

  return NextResponse.json({ ok: true });
}
