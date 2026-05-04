import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq, sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const { orderIds, paymentMethod } = await req.json();

  if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0 || !paymentMethod) {
    return NextResponse.json({ error: "orderIds ve paymentMethod gerekli" }, { status: 400 });
  }

  const db = getDb();
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  let count = 0;

  for (const id of orderIds) {
    const order = db.select().from(schema.orders).where(eq(schema.orders.id, id)).get();
    if (!order || order.status !== "on_the_way") continue;

    db.update(schema.orders)
      .set({ status: "delivered" as const, deliveredAt: now })
      .where(eq(schema.orders.id, id))
      .run();

    if (order.staffCourierId) {
      db.update(schema.staff)
        .set({ totalDeliveries: sql`${schema.staff.totalDeliveries} + 1` })
        .where(eq(schema.staff.id, order.staffCourierId))
        .run();
    }

    db.insert(schema.payments)
      .values({
        orderId: id,
        amount: order.total,
        method: paymentMethod,
        receivedAmount: order.total,
        changeGiven: 0,
      })
      .run();

    db.update(schema.orders)
      .set({
        paymentMethod,
        paymentConfirmedAt: sql`(datetime('now','localtime'))`,
      })
      .where(eq(schema.orders.id, id))
      .run();

    if (order.customerPhone) {
      const botPort = process.env.BOT_PORT || "3003";
      fetch(`http://localhost:${botPort}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: order.customerPhone, status: "delivered", orderId: id }),
      }).catch(() => {});
    }

    count++;
  }

  return NextResponse.json({ delivered: count });
}
