import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { desc, eq, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const shifts = db.select({
    id: schema.shifts.id,
    staffId: schema.shifts.staffId,
    staffName: schema.staff.name,
    startTime: schema.shifts.startTime,
    endTime: schema.shifts.endTime,
    startCash: schema.shifts.startCash,
    endCash: schema.shifts.endCash,
    notes: schema.shifts.notes,
  })
    .from(schema.shifts)
    .leftJoin(schema.staff, eq(schema.shifts.staffId, schema.staff.id))
    .orderBy(desc(schema.shifts.startTime))
    .limit(50)
    .all();
  return NextResponse.json(shifts);
}

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });
  const { staffId, startCash } = await req.json();
  const db = getDb();

  const openShift = db.select()
    .from(schema.shifts)
    .where(sql`${schema.shifts.staffId} = ${staffId} AND ${schema.shifts.endTime} IS NULL`)
    .get();

  if (openShift) {
    return NextResponse.json({ error: "Bu personelin acik vardiyasi var" }, { status: 400 });
  }

  const shift = db.insert(schema.shifts)
    .values({ staffId, startCash: startCash || 0 })
    .returning()
    .get();

  return NextResponse.json(shift, { status: 201 });
}
