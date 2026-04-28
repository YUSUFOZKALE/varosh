import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();

  const categories = db
    .select()
    .from(schema.menuCategories)
    .where(eq(schema.menuCategories.isActive, true))
    .orderBy(asc(schema.menuCategories.sortOrder))
    .all();

  const items = db
    .select()
    .from(schema.menuItems)
    .where(eq(schema.menuItems.isAvailable, true))
    .orderBy(asc(schema.menuItems.sortOrder))
    .all();

  const options = db
    .select()
    .from(schema.menuItemOptions)
    .orderBy(
      asc(schema.menuItemOptions.menuItemId),
      asc(schema.menuItemOptions.groupName)
    )
    .all();

  return NextResponse.json({
    categories,
    items: items.map((i) => ({
      id: i.id,
      name: i.name,
      description: i.description,
      price: i.price,
      categoryId: i.categoryId,
      imageUrl: i.imageUrl,
    })),
    options: options.map((o) => ({
      id: o.id,
      menuItemId: o.menuItemId,
      groupName: o.groupName,
      optionName: o.optionName,
      priceModifier: o.priceModifier,
      isDefault: o.isDefault,
    })),
  });
}
