import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const db = getDb();
  const period = req.nextUrl.searchParams.get("period") || "7";
  const days = parseInt(period);

  const daily = db.select({
    date: sql<string>`date(${schema.orders.createdAt})`.as("date"),
    orders: sql<number>`COUNT(*)`,
    revenue: sql<number>`COALESCE(SUM(CASE WHEN ${schema.orders.status} != 'cancelled' THEN ${schema.orders.total} ELSE 0 END), 0)`,
    cancelled: sql<number>`SUM(CASE WHEN ${schema.orders.status} = 'cancelled' THEN 1 ELSE 0 END)`,
    avgOrder: sql<number>`COALESCE(AVG(CASE WHEN ${schema.orders.status} != 'cancelled' THEN ${schema.orders.total} END), 0)`,
  })
    .from(schema.orders)
    .where(sql`date(${schema.orders.createdAt}) >= date('now','localtime','-${sql.raw(String(days))} days')`)
    .groupBy(sql`date(${schema.orders.createdAt})`)
    .orderBy(sql`date(${schema.orders.createdAt})`)
    .all();

  const totals = db.select({
    totalOrders: sql<number>`COUNT(*)`,
    totalRevenue: sql<number>`COALESCE(SUM(CASE WHEN ${schema.orders.status} != 'cancelled' THEN ${schema.orders.total} ELSE 0 END), 0)`,
    avgDaily: sql<number>`COALESCE(SUM(CASE WHEN ${schema.orders.status} != 'cancelled' THEN ${schema.orders.total} ELSE 0 END) / MAX(1, ${days}), 0)`,
  })
    .from(schema.orders)
    .where(sql`date(${schema.orders.createdAt}) >= date('now','localtime','-${sql.raw(String(days))} days')`)
    .get();

  return NextResponse.json({ daily, totals, period: days });
}
