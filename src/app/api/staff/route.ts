import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const staff = db.select().from(schema.staff).orderBy(asc(schema.staff.name)).all();
  return NextResponse.json(staff);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, phone, role, pin, salary } = body;

  if (!name?.trim() || !phone?.trim() || !role) {
    return NextResponse.json({ error: "Ad, telefon ve rol gerekli" }, { status: 400 });
  }

  const db = getDb();
  const result = db.insert(schema.staff)
    .values({
      name: name.trim(),
      phone: phone.trim(),
      role,
      pin: pin || null,
      salary: salary || null,
      isActive: true,
    })
    .returning()
    .get();

  return NextResponse.json(result, { status: 201 });
}
