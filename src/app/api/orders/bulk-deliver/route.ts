import { NextRequest, NextResponse } from "next/server";
import { getDb, getSqliteDb, schema } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { recordPayment } from "@/lib/payment";

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });

  const { orderIds, paymentMethod } = await req.json();

  if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0 || !paymentMethod) {
    return NextResponse.json({ error: "orderIds ve paymentMethod gerekli" }, { status: 400 });
  }

  if (paymentMethod !== "cash" && paymentMethod !== "card") {
    return NextResponse.json({ error: "Gecersiz odeme yontemi" }, { status: 400 });
  }

  const db = getDb();
  const sqlite = getSqliteDb();
  let count = 0;

  for (const id of orderIds) {
    const order = db.select().from(schema.orders).where(eq(schema.orders.id, id)).get();
    if (!order || order.status !== "on_the_way") continue;

    const txn = sqlite.transaction(() => {
      db.update(schema.orders)
        .set({ status: "delivered" as const, deliveredAt: sql`(datetime('now','localtime'))` })
        .where(eq(schema.orders.id, id))
        .run();

      if (order.staffCourierId) {
        db.update(schema.staff)
          .set({ totalDeliveries: sql`${schema.staff.totalDeliveries} + 1` })
          .where(eq(schema.staff.id, order.staffCourierId))
          .run();
      }
    });

    txn();

    recordPayment({
      orderId: id,
      method: paymentMethod,
      staffId: session.staffId,
      isCourierDelivery: !!order.staffCourierId,
    });

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
