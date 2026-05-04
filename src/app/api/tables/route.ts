import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq, asc, sql } from "drizzle-orm";
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
  const body = await request.json();
  const db = getDb();

  if (body.count) {
    const count = body.count as number;
    if (count < 1 || count > 200) {
      return NextResponse.json({ error: "Masa sayisi 1-200 arasi olmali" }, { status: 400 });
    }
    const existing = db.select().from(schema.tables).orderBy(asc(schema.tables.number)).all();
    const existingNumbers = new Set(existing.map((t) => t.number));
    let added = 0;
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
    const updated = db.select().from(schema.tables).where(eq(schema.tables.isActive, true)).orderBy(asc(schema.tables.number)).all();
    return NextResponse.json({ tables: updated, added });
  }

  const existing = db.select().from(schema.tables).orderBy(asc(schema.tables.number)).all();
  const usedNumbers = new Set(existing.map((t) => t.number));
  let nextNumber = 1;
  while (usedNumbers.has(nextNumber)) nextNumber++;

  const label = body.label || `Masa ${nextNumber}`;

  db.insert(schema.tables)
    .values({
      number: nextNumber,
      label,
      token: crypto.randomBytes(16).toString("hex"),
      capacity: body.capacity || 4,
      isActive: true,
    })
    .run();

  const created = db.select().from(schema.tables).where(eq(schema.tables.number, nextNumber)).get();
  return NextResponse.json(created, { status: 201 });
}
