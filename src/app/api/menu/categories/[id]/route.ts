import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  const body = await req.json();
  const db = getDb();

  const existing = db.select().from(schema.menuCategories).where(eq(schema.menuCategories.id, id)).get();
  if (!existing) {
    return NextResponse.json({ error: "Kategori bulunamadi" }, { status: 404 });
  }

  const updated = db.update(schema.menuCategories)
    .set({
      name: body.name ?? existing.name,
      sortOrder: body.sortOrder ?? existing.sortOrder,
      isActive: body.isActive ?? existing.isActive,
    })
    .where(eq(schema.menuCategories.id, id))
    .returning()
    .get();

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  const db = getDb();

  const existing = db.select().from(schema.menuCategories).where(eq(schema.menuCategories.id, id)).get();
  if (!existing) {
    return NextResponse.json({ error: "Kategori bulunamadi" }, { status: 404 });
  }

  db.delete(schema.menuCategories).where(eq(schema.menuCategories.id, id)).run();
  return NextResponse.json({ ok: true });
}
