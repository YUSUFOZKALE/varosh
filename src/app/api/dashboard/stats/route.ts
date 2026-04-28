import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { sql, and, gte, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

function todayStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} 00:00:00`;
}

export async function GET() {
  const db = getDb();
  const start = todayStart();

  const todayOrders = db.select({ count: sql<number>`count(*)` })
    .from(schema.orders).where(gte(schema.orders.createdAt, start)).get();

  const todayRevenue = db.select({ total: sql<number>`coalesce(sum(total), 0)` })
    .from(schema.orders)
    .where(and(gte(schema.orders.createdAt, start), sql`${schema.orders.status} != 'cancelled'`))
    .get();

  const activeOrders = db.select({ count: sql<number>`count(*)` })
    .from(schema.orders)
    .where(sql`${schema.orders.status} IN ('new', 'preparing', 'ready', 'on_the_way')`)
    .get();

  const totalCustomers = db.select({ count: sql<number>`count(*)` })
    .from(schema.users).get();

  const bizStatus = db.select()
    .from(schema.businessStatus)
    .orderBy(desc(schema.businessStatus.createdAt))
    .limit(1).get();

  return NextResponse.json({
    todayOrderCount: todayOrders?.count ?? 0,
    todayRevenue: todayRevenue?.total ?? 0,
    activeOrderCount: activeOrders?.count ?? 0,
    totalCustomers: totalCustomers?.count ?? 0,
    businessStatus: bizStatus?.status ?? "closed",
  });
}
