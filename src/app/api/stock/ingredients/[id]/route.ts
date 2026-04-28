import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  const body = await req.json();
  const db = getDb();

  const existing = db.select().from(schema.ingredients).where(eq(schema.ingredients.id, id)).get();
  if (!existing) return NextResponse.json({ error: "Hammadde bulunamadi" }, { status: 404 });

  const updated = db.update(schema.ingredients)
    .set({
      name: body.name ?? existing.name,
      unit: body.unit ?? existing.unit,
      unitCost: body.unitCost ?? existing.unitCost,
      currentStock: body.currentStock ?? existing.currentStock,
      minStockAlert: body.minStockAlert !== undefined ? body.minStockAlert : existing.minStockAlert,
      supplier: body.supplier !== undefined ? body.supplier : existing.supplier,
    })
    .where(eq(schema.ingredients.id, id))
    .returning()
    .get();

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  db.delete(schema.ingredients).where(eq(schema.ingredients.id, parseInt(params.id))).run();
  return NextResponse.json({ ok: true });
}
