import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq, sql } from "drizzle-orm";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  const { paymentMethod } = await req.json();
  const db = getDb();

  const order = db.select().from(schema.orders).where(eq(schema.orders.id, id)).get();
  if (!order) return NextResponse.json({ error: "Siparis bulunamadi" }, { status: 404 });

  db.update(schema.orders)
    .set({
      paymentMethod,
      paymentConfirmedAt: sql`(datetime('now','localtime'))`,
    })
    .where(eq(schema.orders.id, id))
    .run();

  db.insert(schema.payments)
    .values({
      orderId: id,
      amount: order.total,
      method: paymentMethod,
      receivedAmount: order.total,
      changeGiven: 0,
    })
    .run();

  db.insert(schema.cashRegister)
    .values({
      type: "sale",
      amount: order.total,
      orderId: id,
      description: `Siparis #${id} - ${paymentMethod}`,
    })
    .run();

  return NextResponse.json({ ok: true });
}
