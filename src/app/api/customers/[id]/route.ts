import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  const customer = db.select().from(schema.users).where(eq(schema.users.id, parseInt(params.id))).get();
  if (!customer) return NextResponse.json({ error: "Musteri bulunamadi" }, { status: 404 });
  return NextResponse.json(customer);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  const body = await req.json();
  const db = getDb();

  const existing = db.select().from(schema.users).where(eq(schema.users.id, id)).get();
  if (!existing) return NextResponse.json({ error: "Musteri bulunamadi" }, { status: 404 });

  const updated = db.update(schema.users)
    .set({
      name: body.name !== undefined ? body.name : existing.name,
      phone: body.phone ?? existing.phone,
      address: body.address !== undefined ? body.address : existing.address,
      notes: body.notes !== undefined ? body.notes : existing.notes,
      latitude: body.latitude !== undefined ? body.latitude : existing.latitude,
      longitude: body.longitude !== undefined ? body.longitude : existing.longitude,
      isBlacklisted: body.isBlacklisted !== undefined ? body.isBlacklisted : existing.isBlacklisted,
    })
    .where(eq(schema.users.id, id))
    .returning()
    .get();

  return NextResponse.json(updated);
}
