import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { asc, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();

  const orders = db.select()
    .from(schema.orders)
    .where(sql`${schema.orders.status} IN ('new', 'preparing', 'ready')`)
    .orderBy(asc(schema.orders.createdAt))
    .all();

  const result = [];
  for (const order of orders) {
    const items = db.select()
      .from(schema.orderItems)
      .where(eq(schema.orderItems.orderId, order.id))
      .all();
    result.push({ ...order, items });
  }

  return NextResponse.json(result);
}
