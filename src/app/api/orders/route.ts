import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { desc, eq, and, sql } from "drizzle-orm";
import crypto from "crypto";
import { getDeliveryFee } from "@/lib/settings";
import { updateCustomerStats, findOrCreateCustomer } from "@/lib/customer-stats";

export const dynamic = "force-dynamic";

function purgeOldCancelled() {
  const db = getDb();
  db.delete(schema.orderItems)
    .where(
      sql`${schema.orderItems.orderId} IN (
        SELECT ${schema.orders.id} FROM ${schema.orders}
        WHERE ${schema.orders.status} = 'cancelled'
        AND ${schema.orders.cancelledAt} < datetime('now', '-7 days')
      )`
    )
    .run();
  db.delete(schema.orders)
    .where(
      and(
        eq(schema.orders.status, "cancelled"),
        sql`${schema.orders.cancelledAt} < datetime('now', '-7 days')`
      )
    )
    .run();
}

export async function GET(req: NextRequest) {
  purgeOldCancelled();
  const db = getDb();
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status");
  const source = sp.get("source");
  const limit = parseInt(sp.get("limit") || "50");

  const conditions: ReturnType<typeof eq>[] = [];
  if (status) conditions.push(eq(schema.orders.status, status as typeof schema.orders.status.enumValues[number]));
  if (source) conditions.push(eq(schema.orders.source, source as typeof schema.orders.source.enumValues[number]));

  const orders = conditions.length > 0
    ? db.select().from(schema.orders)
        .where(and(...conditions))
        .orderBy(desc(schema.orders.createdAt))
        .limit(limit)
        .all()
    : db.select().from(schema.orders)
        .orderBy(desc(schema.orders.createdAt))
        .limit(limit)
        .all();

  return NextResponse.json(orders);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const db = getDb();

  const {
    source = "manual",
    customerName,
    customerPhone,
    tableNumber,
    deliveryAddress,
    paymentMethod,
    notes,
    items,
  } = body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "En az bir urun gerekli" }, { status: 400 });
  }

  let subtotal = 0;
  const orderItems: { menuItemId: number; name: string; quantity: number; unitPrice: number; totalPrice: number; notes?: string; selectedOptions?: string; removedIngredients?: string }[] = [];

  for (const item of items) {
    const menuItem = db.select().from(schema.menuItems)
      .where(eq(schema.menuItems.id, item.menuItemId))
      .get();

    if (!menuItem) {
      return NextResponse.json({ error: `Urun bulunamadi: ${item.menuItemId}` }, { status: 400 });
    }

    const qty = item.quantity || 1;
    let price = deliveryAddress ? (menuItem.deliveryPrice || menuItem.price) : menuItem.price;

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

  const deliveryFee = deliveryAddress ? getDeliveryFee() : 0;
  const total = subtotal + deliveryFee;
  const trackingToken = crypto.randomBytes(16).toString("hex");

  const order = db.insert(schema.orders)
    .values({
      source: source as typeof schema.orders.source.enumValues[number],
      status: "new",
      customerName: customerName || null,
      customerPhone: customerPhone || null,
      tableNumber: tableNumber || null,
      deliveryAddress: deliveryAddress || null,
      paymentMethod: paymentMethod || null,
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

  if (customerPhone) {
    findOrCreateCustomer(customerPhone, customerName);
    updateCustomerStats(customerPhone, total);
  }

  return NextResponse.json(order, { status: 201 });
}
