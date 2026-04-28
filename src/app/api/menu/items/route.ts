import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { asc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const db = getDb();
  const categoryId = req.nextUrl.searchParams.get("categoryId");

  const items = categoryId
    ? db.select().from(schema.menuItems)
        .where(eq(schema.menuItems.categoryId, parseInt(categoryId)))
        .orderBy(asc(schema.menuItems.sortOrder))
        .all()
    : db.select().from(schema.menuItems)
        .orderBy(asc(schema.menuItems.sortOrder))
        .all();

  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, categoryId, price, deliveryPrice, description, prepTimeMinutes = 10, isAvailable = true } = body;

  if (!name?.trim() || !categoryId || price == null) {
    return NextResponse.json({ error: "Urun adi, kategori ve fiyat gerekli" }, { status: 400 });
  }

  const db = getDb();
  const result = db.insert(schema.menuItems)
    .values({
      name: name.trim(),
      categoryId,
      price,
      deliveryPrice: deliveryPrice ?? price,
      description: description?.trim() || null,
      prepTimeMinutes,
      isAvailable,
      sortOrder: 0,
    })
    .returning()
    .get();

  return NextResponse.json(result, { status: 201 });
}
