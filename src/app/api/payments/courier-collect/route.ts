import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });
  const { orderIds, method } = await req.json();

  if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
    return NextResponse.json({ error: "orderIds gerekli" }, { status: 400 });
  }

  const db = getDb();
  let totalCollected = 0;

  for (const orderId of orderIds) {
    const order = db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).get();
    if (!order || order.status !== "delivered" || !order.staffCourierId) continue;

    const existing = db.select().from(schema.cashRegister)
      .where(sql`${schema.cashRegister.orderId} = ${orderId} AND ${schema.cashRegister.type} = 'sale'`)
      .get();
    if (existing) continue;

    const payment = db.select().from(schema.payments)
      .where(sql`${schema.payments.orderId} = ${orderId}`)
      .get();
    if (!payment) continue;

    const label = method || payment.method;

    db.insert(schema.cashRegister)
      .values({
        type: "sale",
        amount: payment.amount,
        orderId,
        description: `Siparis #${orderId} - ${label} (kuryeden tahsil)`,
      })
      .run();

    totalCollected += payment.amount;
  }

  return NextResponse.json({ collected: orderIds.length, totalCollected });
}
