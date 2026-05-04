import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq, and, sql, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const db = getDb();
  const date = req.nextUrl.searchParams.get("date");

  let query = db.select().from(schema.payments);
  if (date) {
    query = query.where(sql`date(${schema.payments.createdAt}) = ${date}`) as typeof query;
  }
  const payments = query.orderBy(desc(schema.payments.createdAt)).all();
  return NextResponse.json(payments);
}

export async function POST(req: NextRequest) {
  const { orderId, amount, method, receivedAmount } = await req.json();

  if (!orderId || !amount || !method) {
    return NextResponse.json({ error: "orderId, amount ve method gerekli" }, { status: 400 });
  }

  const db = getDb();

  const order = db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).get();
  if (!order) return NextResponse.json({ error: "Siparis bulunamadi" }, { status: 404 });

  const changeGiven = method === "cash" && receivedAmount ? Math.max(0, receivedAmount - amount) : 0;

  const payment = db.insert(schema.payments)
    .values({ orderId, amount, method, receivedAmount: receivedAmount || amount, changeGiven })
    .returning()
    .get();

  db.insert(schema.cashRegister)
    .values({ type: "sale", amount, orderId, description: `Siparis #${orderId} - ${method}` })
    .run();

  if (amount < order.total) {
    db.update(schema.orders)
      .set({ discountAmount: order.total - amount })
      .where(eq(schema.orders.id, orderId))
      .run();
  }

  db.update(schema.orders)
    .set({
      paymentMethod: method,
      paymentConfirmedAt: sql`(datetime('now','localtime'))`,
    })
    .where(eq(schema.orders.id, orderId))
    .run();

  if (order.tableNumber) {
    const openSession = db
      .select()
      .from(schema.tableSessions)
      .where(
        and(
          eq(schema.tableSessions.tableNumber, order.tableNumber),
          eq(schema.tableSessions.status, "open")
        )
      )
      .get();

    if (openSession) {
      const remainingUnpaid = db
        .select()
        .from(schema.orders)
        .where(
          sql`${schema.orders.tableNumber} = ${order.tableNumber}
            AND ${schema.orders.paymentMethod} IS NULL
            AND ${schema.orders.status} != 'cancelled'
            AND ${schema.orders.id} != ${orderId}
            AND ${schema.orders.createdAt} >= ${openSession.openedAt}`
        )
        .all();

      if (remainingUnpaid.length === 0) {
        db.update(schema.tableSessions)
          .set({
            status: "closed" as const,
            closedAt: new Date().toISOString().replace("T", " ").slice(0, 19),
          })
          .where(eq(schema.tableSessions.id, openSession.id))
          .run();
      }
    }
  }

  return NextResponse.json(payment, { status: 201 });
}
