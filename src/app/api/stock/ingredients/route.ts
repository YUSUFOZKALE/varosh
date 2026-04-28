import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const ingredients = db.select().from(schema.ingredients).orderBy(asc(schema.ingredients.name)).all();
  return NextResponse.json(ingredients);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, unit, unitCost, currentStock = 0, minStockAlert, supplier } = body;

  if (!name?.trim() || !unit?.trim() || unitCost == null) {
    return NextResponse.json({ error: "Ad, birim ve birim maliyet gerekli" }, { status: 400 });
  }

  const db = getDb();
  const result = db.insert(schema.ingredients)
    .values({ name: name.trim(), unit: unit.trim(), unitCost, currentStock, minStockAlert, supplier })
    .returning()
    .get();

  return NextResponse.json(result, { status: 201 });
}
