import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const db = getDb();
  const period = req.nextUrl.searchParams.get("period") || "7";
  const days = parseInt(period);

  const hourly = db.select({
    hour: sql<number>`CAST(strftime('%H', ${schema.orders.createdAt}) AS INTEGER)`.as("hour"),
    orders: sql<number>`COUNT(*)`,
    revenue: sql<number>`COALESCE(SUM(${schema.orders.total}), 0)`,
  })
    .from(schema.orders)
    .where(sql`date(${schema.orders.createdAt}) >= date('now','localtime','-${sql.raw(String(days))} days') AND ${schema.orders.status} != 'cancelled'`)
    .groupBy(sql`CAST(strftime('%H', ${schema.orders.createdAt}) AS INTEGER)`)
    .orderBy(sql`hour`)
    .all();

  const weekday = db.select({
    day: sql<number>`CAST(strftime('%w', ${schema.orders.createdAt}) AS INTEGER)`.as("day"),
    orders: sql<number>`COUNT(*)`,
    revenue: sql<number>`COALESCE(SUM(${schema.orders.total}), 0)`,
    avgOrder: sql<number>`COALESCE(AVG(${schema.orders.total}), 0)`,
  })
    .from(schema.orders)
    .where(sql`date(${schema.orders.createdAt}) >= date('now','localtime','-${sql.raw(String(days))} days') AND ${schema.orders.status} != 'cancelled'`)
    .groupBy(sql`CAST(strftime('%w', ${schema.orders.createdAt}) AS INTEGER)`)
    .orderBy(sql`day`)
    .all();

  const heatmap = db.select({
    day: sql<number>`CAST(strftime('%w', ${schema.orders.createdAt}) AS INTEGER)`.as("day"),
    hour: sql<number>`CAST(strftime('%H', ${schema.orders.createdAt}) AS INTEGER)`.as("hour"),
    orders: sql<number>`COUNT(*)`,
  })
    .from(schema.orders)
    .where(sql`date(${schema.orders.createdAt}) >= date('now','localtime','-${sql.raw(String(days))} days') AND ${schema.orders.status} != 'cancelled'`)
    .groupBy(sql`CAST(strftime('%w', ${schema.orders.createdAt}) AS INTEGER)`, sql`CAST(strftime('%H', ${schema.orders.createdAt}) AS INTEGER)`)
    .all();

  return NextResponse.json({ hourly, weekday, heatmap });
}
