import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const db = getDb();
  const date = req.nextUrl.searchParams.get("date") || new Date().toISOString().split("T")[0];

  const orderStats = db.select({
    totalOrders: sql<number>`COUNT(*)`,
    totalRevenue: sql<number>`COALESCE(SUM(${schema.orders.total}), 0)`,
    totalDiscount: sql<number>`COALESCE(SUM(${schema.orders.discountAmount}), 0)`,
    totalDeliveryFee: sql<number>`COALESCE(SUM(${schema.orders.deliveryFee}), 0)`,
    cancelledOrders: sql<number>`SUM(CASE WHEN ${schema.orders.status} = 'cancelled' THEN 1 ELSE 0 END)`,
  })
    .from(schema.orders)
    .where(sql`date(${schema.orders.createdAt}) = ${date}`)
    .get();

  const paymentBreakdown = db.select({
    method: schema.payments.method,
    total: sql<number>`COALESCE(SUM(${schema.payments.amount}), 0)`,
    count: sql<number>`COUNT(*)`,
  })
    .from(schema.payments)
    .where(sql`date(${schema.payments.createdAt}) = ${date}`)
    .groupBy(schema.payments.method)
    .all();

  const cashMovements = db.select({
    type: schema.cashRegister.type,
    total: sql<number>`COALESCE(SUM(${schema.cashRegister.amount}), 0)`,
  })
    .from(schema.cashRegister)
    .where(sql`date(${schema.cashRegister.createdAt}) = ${date}`)
    .groupBy(schema.cashRegister.type)
    .all();

  const sourceBreakdown = db.select({
    source: schema.orders.source,
    count: sql<number>`COUNT(*)`,
    total: sql<number>`COALESCE(SUM(${schema.orders.total}), 0)`,
  })
    .from(schema.orders)
    .where(sql`date(${schema.orders.createdAt}) = ${date} AND ${schema.orders.status} != 'cancelled'`)
    .groupBy(schema.orders.source)
    .all();

  return NextResponse.json({
    date,
    orders: orderStats,
    paymentBreakdown,
    cashMovements,
    sourceBreakdown,
  });
}
