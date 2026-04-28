import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const categories = db.select()
    .from(schema.menuCategories)
    .orderBy(asc(schema.menuCategories.sortOrder))
    .all();
  return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, sortOrder = 0, isActive = true } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Kategori adi gerekli" }, { status: 400 });
  }

  const db = getDb();
  const result = db.insert(schema.menuCategories)
    .values({ name: name.trim(), sortOrder, isActive })
    .returning()
    .get();

  return NextResponse.json(result, { status: 201 });
}
