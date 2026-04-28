import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq, sql } from "drizzle-orm";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  const body = await req.json();
  const db = getDb();

  const shift = db.select().from(schema.shifts).where(eq(schema.shifts.id, id)).get();
  if (!shift) return NextResponse.json({ error: "Vardiya bulunamadi" }, { status: 404 });

  const updated = db.update(schema.shifts)
    .set({
      endTime: body.endTime || sql`(datetime('now','localtime'))`,
      endCash: body.endCash ?? shift.endCash,
      notes: body.notes !== undefined ? body.notes : shift.notes,
    })
    .where(eq(schema.shifts.id, id))
    .returning()
    .get();

  return NextResponse.json(updated);
}
