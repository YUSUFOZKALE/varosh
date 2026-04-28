import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const orders = db.select({
    id: schema.orders.id,
    customerName: schema.orders.customerName,
    status: schema.orders.status,
    total: schema.orders.total,
    source: schema.orders.source,
    createdAt: schema.orders.createdAt,
  })
    .from(schema.orders)
    .orderBy(desc(schema.orders.createdAt))
    .limit(10)
    .all();

  return NextResponse.json(orders);
}
