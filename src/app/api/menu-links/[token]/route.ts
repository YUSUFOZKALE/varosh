import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq, asc } from "drizzle-orm";
import { getDeliveryFee, getMinOrderAmount } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const db = getDb();

  const link = db.select().from(schema.menuLinks)
    .where(eq(schema.menuLinks.token, params.token))
    .get();

  if (!link) {
    return NextResponse.json({ error: "Gecersiz link" }, { status: 404 });
  }

  if (new Date(link.expiresAt) < new Date()) {
    return NextResponse.json({ error: "Link suresi dolmus" }, { status: 410 });
  }

  if (link.usedAt) {
    return NextResponse.json({ error: "Bu link zaten kullanildi", orderId: link.orderId }, { status: 409 });
  }

  const categories = db.select().from(schema.menuCategories)
    .where(eq(schema.menuCategories.isActive, true))
    .orderBy(asc(schema.menuCategories.sortOrder))
    .all();

  const items = db.select().from(schema.menuItems)
    .where(eq(schema.menuItems.isAvailable, true))
    .orderBy(asc(schema.menuItems.sortOrder))
    .all();

  const options = db.select().from(schema.menuItemOptions)
    .orderBy(asc(schema.menuItemOptions.menuItemId), asc(schema.menuItemOptions.groupName))
    .all();

  return NextResponse.json({
    link: {
      name: link.name,
      phone: link.phone,
      address: link.address,
      expiresAt: link.expiresAt,
    },
    deliveryFee: getDeliveryFee(),
    minOrderAmount: getMinOrderAmount(),
    categories,
    items: items.map((i) => ({
      id: i.id,
      name: i.name,
      description: i.description,
      price: i.deliveryPrice || i.price,
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
