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
    avgPrice: sql<number>`COALESCE(AVG(${schema.orderItems.unitPrice}), 0)`,
  })
    .from(schema.orderItems)
    .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
    .where(sql`date(${schema.orders.createdAt}) >= date('now','localtime','-${sql.raw(String(days))} days') AND ${schema.orders.status} != 'cancelled'`)
    .groupBy(schema.orderItems.name)
    .orderBy(desc(sql`SUM(${schema.orderItems.quantity})`))
    .all();

  const grandTotal = db.select({
    totalRevenue: sql<number>`COALESCE(SUM(${schema.orderItems.totalPrice}), 0)`,
    totalQuantity: sql<number>`COALESCE(SUM(${schema.orderItems.quantity}), 0)`,
  })
    .from(schema.orderItems)
    .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
    .where(sql`date(${schema.orders.createdAt}) >= date('now','localtime','-${sql.raw(String(days))} days') AND ${schema.orders.status} != 'cancelled'`)
    .get();

  // Previous period for comparison (top product growth)
  const prevProducts = db.select({
    name: schema.orderItems.name,
    totalQuantity: sql<number>`SUM(${schema.orderItems.quantity})`,
  })
    .from(schema.orderItems)
    .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
    .where(sql`date(${schema.orders.createdAt}) >= date('now','localtime','-${sql.raw(String(days * 2))} days') AND date(${schema.orders.createdAt}) < date('now','localtime','-${sql.raw(String(days))} days') AND ${schema.orders.status} != 'cancelled'`)
    .groupBy(schema.orderItems.name)
    .all();

  const prevMap = new Map(prevProducts.map(p => [p.name, p.totalQuantity]));

  const enriched = products.map(p => ({
    ...p,
    revenuePercent: (grandTotal?.totalRevenue || 0) > 0 ? (p.totalRevenue / grandTotal!.totalRevenue) * 100 : 0,
    quantityPercent: (grandTotal?.totalQuantity || 0) > 0 ? (p.totalQuantity / grandTotal!.totalQuantity) * 100 : 0,
    growth: (() => {
      const prev = prevMap.get(p.name) || 0;
      return prev > 0 ? ((p.totalQuantity - prev) / prev) * 100 : p.totalQuantity > 0 ? 100 : 0;
    })(),
  }));

  return NextResponse.json({
    products: enriched,
    grandTotal: {
      revenue: grandTotal?.totalRevenue || 0,
      quantity: grandTotal?.totalQuantity || 0,
    },
    period: days,
  });
}
