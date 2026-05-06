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

  const item = db.select().from(schema.menuItems).where(eq(schema.menuItems.id, id)).get();
  if (!item) return NextResponse.json({ error: "Urun bulunamadi" }, { status: 404 });

  db.update(schema.menuItems)
    .set({
      ...(body.name !== undefined && { name: body.name }),
      ...(body.categoryId !== undefined && { categoryId: body.categoryId }),
      ...(body.price !== undefined && { price: body.price }),
      ...(body.deliveryPrice !== undefined && { deliveryPrice: body.deliveryPrice }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl }),
      ...(body.isAvailable !== undefined && { isAvailable: body.isAvailable }),
      ...(body.prepTimeMinutes !== undefined && { prepTimeMinutes: body.prepTimeMinutes }),
      ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
    })
    .where(eq(schema.menuItems.id, id))
    .run();

  const updated = db.select().from(schema.menuItems).where(eq(schema.menuItems.id, id)).get();
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });
  const db = getDb();
  db.delete(schema.menuItems).where(eq(schema.menuItems.id, parseInt(params.id))).run();
  return NextResponse.json({ ok: true });
}
