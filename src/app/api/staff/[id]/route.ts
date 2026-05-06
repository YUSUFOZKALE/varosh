import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });
  const id = parseInt(params.id);
  const body = await req.json();
  const db = getDb();

  const existing = db.select().from(schema.staff).where(eq(schema.staff.id, id)).get();
  if (!existing) return NextResponse.json({ error: "Personel bulunamadi" }, { status: 404 });

  const updated = db.update(schema.staff)
    .set({
      name: body.name ?? existing.name,
      phone: body.phone ?? existing.phone,
      role: body.role ?? existing.role,
      pin: body.pin !== undefined ? body.pin : existing.pin,
      salary: body.salary !== undefined ? body.salary : existing.salary,
      isActive: body.isActive !== undefined ? body.isActive : existing.isActive,
    })
    .where(eq(schema.staff.id, id))
    .returning()
    .get();

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });
  const db = getDb();
  db.update(schema.staff)
    .set({ isActive: false })
    .where(eq(schema.staff.id, parseInt(params.id)))
    .run();
  return NextResponse.json({ ok: true });
}
