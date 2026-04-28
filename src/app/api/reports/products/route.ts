import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { sql, desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const db = getDb();
  const period = req.nextUrl.searchParams.get("period") || "30";
  const days = parseInt(period);

  const products = db.select({
    name: schema.orderItems.name,
    totalQuantity: sql<number>`SUM(${schema.orderItems.quantity})`,
    totalRevenue: sql<number>`SUM(${schema.orderItems.totalPrice})`,
    orderCount: sql<number>`COUNT(DISTINCT ${schema.orderItems.orderId})`,
  })
    .from(schema.orderItems)
    .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
    .where(sql`date(${schema.orders.createdAt}) >= date('now','localtime','-${sql.raw(String(days))} days') AND ${schema.orders.status} != 'cancelled'`)
    .groupBy(schema.orderItems.name)
    .orderBy(desc(sql`SUM(${schema.orderItems.quantity})`))
    .all();

  return NextResponse.json(products);
}
