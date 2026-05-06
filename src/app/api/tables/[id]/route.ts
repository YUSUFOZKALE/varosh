import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });
  const tableId = parseInt(params.id);
  if (!tableId) return NextResponse.json({ error: "Gecersiz ID" }, { status: 400 });

  const db = getDb();
  const table = db.select().from(schema.tables).where(eq(schema.tables.id, tableId)).get();
  if (!table) return NextResponse.json({ error: "Masa bulunamadi" }, { status: 404 });

  db.delete(schema.tables).where(eq(schema.tables.id, tableId)).run();
  return NextResponse.json({ ok: true, deleted: table.number });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });
  const tableId = parseInt(params.id);
  if (!tableId) return NextResponse.json({ error: "Gecersiz ID" }, { status: 400 });

  const body = await request.json();
  const db = getDb();

  const table = db.select().from(schema.tables).where(eq(schema.tables.id, tableId)).get();
  if (!table) return NextResponse.json({ error: "Masa bulunamadi" }, { status: 404 });

  const updates: Record<string, unknown> = {};

  if (body.regenerateToken) {
    updates.token = crypto.randomBytes(16).toString("hex");
  }
  if (body.label !== undefined) {
    updates.label = body.label;
  }
  if (body.capacity !== undefined) {
    updates.capacity = body.capacity;
  }
  if (body.isActive !== undefined) {
    updates.isActive = body.isActive;
  }

  if (Object.keys(updates).length > 0) {
    db.update(schema.tables)
      .set(updates)
      .where(eq(schema.tables.id, tableId))
      .run();
  }

  const updated = db.select().from(schema.tables).where(eq(schema.tables.id, tableId)).get();
  return NextResponse.json(updated);
}
