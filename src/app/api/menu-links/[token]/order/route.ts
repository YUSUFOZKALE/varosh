import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { getDeliveryFee } from "@/lib/settings";
import { updateCustomerStats } from "@/lib/customer-stats";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
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
    return NextResponse.json({ error: "Bu link zaten kullanildi" }, { status: 409 });
  }

  const body = await req.json();
  const { items, notes } = body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "En az bir urun secin" }, { status: 400 });
  }

  let subtotal = 0;
  const orderItems: { menuItemId: number; name: string; quantity: number; unitPrice: number; totalPrice: number; notes?: string; selectedOptions?: string; removedIngredients?: string }[] = [];

  for (const item of items) {
    const menuItem = db.select().from(schema.menuItems)
      .where(eq(schema.menuItems.id, item.menuItemId))
      .get();

    if (!menuItem) continue;

    const qty = item.quantity || 1;
    let price = menuItem.deliveryPrice || menuItem.price;

    let extraCost = 0;
    if (item.selectedOptions && Array.isArray(item.selectedOptions)) {
      for (const optId of item.selectedOptions) {
        const opt = db.select().from(schema.menuItemOptions).where(eq(schema.menuItemOptions.id, optId)).get();
        if (opt && opt.priceModifier > 0) extraCost += opt.priceModifier;
      }
    }
    price += extraCost;

    const total = price * qty;
    subtotal += total;

    orderItems.push({
      menuItemId: menuItem.id,
      name: menuItem.name,
      quantity: qty,
      unitPrice: price,
      totalPrice: total,
      notes: item.notes,
      selectedOptions: item.selectedOptions ? JSON.stringify(item.selectedOptions) : undefined,
      removedIngredients: item.removedIngredients ? JSON.stringify(item.removedIngredients) : undefined,
    });
  }

  const deliveryFee = getDeliveryFee();
  const total = subtotal + deliveryFee;
  const trackingToken = crypto.randomBytes(16).toString("hex");

  const order = db.insert(schema.orders)
    .values({
      source: "whatsapp",
      status: "new",
      userId: link.userId,
      customerName: link.name || null,
      customerPhone: link.phone,
      deliveryAddress: link.address || null,
      deliveryLatitude: link.latitude,
      deliveryLongitude: link.longitude,
      notes: notes || null,
      subtotal,
      deliveryFee,
      total,
      trackingToken,
    })
    .returning()
    .get();

  for (const oi of orderItems) {
    db.insert(schema.orderItems)
      .values({ orderId: order.id, ...oi })
      .run();
  }

  db.update(schema.menuLinks)
    .set({ usedAt: new Date().toISOString(), orderId: order.id })
    .where(eq(schema.menuLinks.id, link.id))
    .run();

  if (link.phone) {
    updateCustomerStats(link.phone, total);
  }

  return NextResponse.json({
    orderId: order.id,
    trackingToken: order.trackingToken,
    total,
  }, { status: 201 });
}
