import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { sql, eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const db = getDb();
  const period = parseInt(req.nextUrl.searchParams.get("period") || "7");

  const current = db.select({
    revenue: sql<number>`COALESCE(SUM(CASE WHEN ${schema.orders.status} != 'cancelled' THEN ${schema.orders.total} ELSE 0 END), 0)`,
    orders: sql<number>`COALESCE(SUM(CASE WHEN ${schema.orders.status} != 'cancelled' THEN 1 ELSE 0 END), 0)`,
    cancelled: sql<number>`COALESCE(SUM(CASE WHEN ${schema.orders.status} = 'cancelled' THEN 1 ELSE 0 END), 0)`,
    discount: sql<number>`COALESCE(SUM(${schema.orders.discountAmount}), 0)`,
    avgOrder: sql<number>`COALESCE(AVG(CASE WHEN ${schema.orders.status} != 'cancelled' THEN ${schema.orders.total} END), 0)`,
    deliveryFees: sql<number>`COALESCE(SUM(CASE WHEN ${schema.orders.status} != 'cancelled' THEN ${schema.orders.deliveryFee} ELSE 0 END), 0)`,
  })
    .from(schema.orders)
    .where(sql`date(${schema.orders.createdAt}) >= date('now','localtime','-${sql.raw(String(period))} days')`)
    .get();

  const previous = db.select({
    revenue: sql<number>`COALESCE(SUM(CASE WHEN ${schema.orders.status} != 'cancelled' THEN ${schema.orders.total} ELSE 0 END), 0)`,
    orders: sql<number>`COALESCE(SUM(CASE WHEN ${schema.orders.status} != 'cancelled' THEN 1 ELSE 0 END), 0)`,
    avgOrder: sql<number>`COALESCE(AVG(CASE WHEN ${schema.orders.status} != 'cancelled' THEN ${schema.orders.total} END), 0)`,
    cancelled: sql<number>`COALESCE(SUM(CASE WHEN ${schema.orders.status} = 'cancelled' THEN 1 ELSE 0 END), 0)`,
  })
    .from(schema.orders)
    .where(sql`date(${schema.orders.createdAt}) >= date('now','localtime','-${sql.raw(String(period * 2))} days') AND date(${schema.orders.createdAt}) < date('now','localtime','-${sql.raw(String(period))} days')`)
    .get();

  const sources = db.select({
    source: schema.orders.source,
    count: sql<number>`COUNT(*)`,
    revenue: sql<number>`COALESCE(SUM(${schema.orders.total}), 0)`,
  })
    .from(schema.orders)
    .where(sql`date(${schema.orders.createdAt}) >= date('now','localtime','-${sql.raw(String(period))} days') AND ${schema.orders.status} != 'cancelled'`)
    .groupBy(schema.orders.source)
    .orderBy(desc(sql`COALESCE(SUM(${schema.orders.total}), 0)`))
    .all();

  const payments = db.select({
    method: schema.orders.paymentMethod,
    count: sql<number>`COUNT(*)`,
    total: sql<number>`COALESCE(SUM(${schema.orders.total}), 0)`,
  })
    .from(schema.orders)
    .where(sql`date(${schema.orders.createdAt}) >= date('now','localtime','-${sql.raw(String(period))} days') AND ${schema.orders.status} != 'cancelled' AND ${schema.orders.paymentMethod} IS NOT NULL`)
    .groupBy(schema.orders.paymentMethod)
    .all();

  const topProduct = db.select({
    name: schema.orderItems.name,
    quantity: sql<number>`SUM(${schema.orderItems.quantity})`,
    revenue: sql<number>`SUM(${schema.orderItems.totalPrice})`,
  })
    .from(schema.orderItems)
    .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
    .where(sql`date(${schema.orders.createdAt}) >= date('now','localtime','-${sql.raw(String(period))} days') AND ${schema.orders.status} != 'cancelled'`)
    .groupBy(schema.orderItems.name)
    .orderBy(desc(sql`SUM(${schema.orderItems.quantity})`))
    .limit(1)
    .get();

  const peakHourRow = db.select({
    hour: sql<number>`CAST(strftime('%H', ${schema.orders.createdAt}) AS INTEGER)`,
    orders: sql<number>`COUNT(*)`,
  })
    .from(schema.orders)
    .where(sql`date(${schema.orders.createdAt}) >= date('now','localtime','-${sql.raw(String(period))} days') AND ${schema.orders.status} != 'cancelled'`)
    .groupBy(sql`CAST(strftime('%H', ${schema.orders.createdAt}) AS INTEGER)`)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(1)
    .get();

  const recentDaily = db.select({
    date: sql<string>`date(${schema.orders.createdAt})`.as("date"),
    revenue: sql<number>`COALESCE(SUM(CASE WHEN ${schema.orders.status} != 'cancelled' THEN ${schema.orders.total} ELSE 0 END), 0)`,
    orders: sql<number>`COALESCE(SUM(CASE WHEN ${schema.orders.status} != 'cancelled' THEN 1 ELSE 0 END), 0)`,
  })
    .from(schema.orders)
    .where(sql`date(${schema.orders.createdAt}) >= date('now','localtime','-${sql.raw(String(Math.min(period, 30)))} days')`)
    .groupBy(sql`date(${schema.orders.createdAt})`)
    .orderBy(sql`date(${schema.orders.createdAt})`)
    .all();

  // Dine-in vs takeaway vs delivery split
  const orderTypes = db.select({
    dineIn: sql<number>`COALESCE(SUM(CASE WHEN ${schema.orders.tableNumber} IS NOT NULL THEN 1 ELSE 0 END), 0)`,
    delivery: sql<number>`COALESCE(SUM(CASE WHEN ${schema.orders.deliveryAddress} IS NOT NULL AND ${schema.orders.tableNumber} IS NULL THEN 1 ELSE 0 END), 0)`,
    takeaway: sql<number>`COALESCE(SUM(CASE WHEN ${schema.orders.tableNumber} IS NULL AND ${schema.orders.deliveryAddress} IS NULL THEN 1 ELSE 0 END), 0)`,
  })
    .from(schema.orders)
    .where(sql`date(${schema.orders.createdAt}) >= date('now','localtime','-${sql.raw(String(period))} days') AND ${schema.orders.status} != 'cancelled'`)
    .get();

  const g = (cur: number, prev: number) => prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0;

  return NextResponse.json({
    current: {
      revenue: current?.revenue || 0,
      orders: current?.orders || 0,
      avgOrder: current?.avgOrder || 0,
      cancelled: current?.cancelled || 0,
      discount: current?.discount || 0,
      deliveryFees: current?.deliveryFees || 0,
    },
    previous: {
      revenue: previous?.revenue || 0,
      orders: previous?.orders || 0,
      avgOrder: previous?.avgOrder || 0,
      cancelled: previous?.cancelled || 0,
    },
    growth: {
      revenue: g(current?.revenue || 0, previous?.revenue || 0),
      orders: g(current?.orders || 0, previous?.orders || 0),
      avgOrder: g(current?.avgOrder || 0, previous?.avgOrder || 0),
    },
    sources,
    payments,
    orderTypes: orderTypes || { dineIn: 0, delivery: 0, takeaway: 0 },
    topProduct: topProduct || null,
    peakHour: peakHourRow?.hour ?? null,
    recentDaily,
    period,
  });
}
