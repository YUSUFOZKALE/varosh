import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq, asc } from "drizzle-orm";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const rows = db
    .select()
    .from(schema.tables)
    .orderBy(asc(schema.tables.number))
    .all();
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const { count } = (await request.json()) as { count: number };

  if (!count || count < 1 || count > 200) {
    return NextResponse.json({ error: "Masa sayisi 1-200 arasi olmali" }, { status: 400 });
  }

  const db = getDb();
  const existing = db.select().from(schema.tables).orderBy(asc(schema.tables.number)).all();
  const existingNumbers = new Set(existing.map((t) => t.number));

  let added = 0;
  let deactivated = 0;

  for (let i = 1; i <= count; i++) {
    if (!existingNumbers.has(i)) {
      db.insert(schema.tables)
        .values({
          number: i,
          label: `Masa ${i}`,
          token: crypto.randomBytes(16).toString("hex"),
          capacity: 4,
          isActive: true,
        })
        .run();
      added++;
    } else {
      db.update(schema.tables)
        .set({ isActive: true })
        .where(eq(schema.tables.number, i))
        .run();
    }
  }

  for (const t of existing) {
    if (t.number > count) {
      db.update(schema.tables)
        .set({ isActive: false })
        .where(eq(schema.tables.id, t.id))
        .run();
      deactivated++;
    }
  }

  const updated = db.select().from(schema.tables).where(eq(schema.tables.isActive, true)).orderBy(asc(schema.tables.number)).all();
  return NextResponse.json({ tables: updated, added, deactivated });
}
