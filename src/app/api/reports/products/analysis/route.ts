import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { sql, eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

const SEASON_LABELS: Record<string, string> = { spring: "Ilkbahar", summer: "Yaz", fall: "Sonbahar", winter: "Kis" };
const MONTH_LABELS = ["", "Ocak", "Subat", "Mart", "Nisan", "Mayis", "Haziran", "Temmuz", "Agustos", "Eylul", "Ekim", "Kasim", "Aralik"];

export async function GET(req: NextRequest) {
  const db = getDb();
  const view = req.nextUrl.searchParams.get("view") || "hourly";
  const period = parseInt(req.nextUrl.searchParams.get("period") || "30");

  type ProductRow = { groupKey: string; name: string; quantity: number; revenue: number };

  let rows: ProductRow[] = [];

  if (view === "hourly") {
    rows = db.select({
      groupKey: sql<string>`printf('%02d', CAST(strftime('%H', ${schema.orders.createdAt}) AS INTEGER))`.as("groupKey"),
      name: schema.orderItems.name,
      quantity: sql<number>`SUM(${schema.orderItems.quantity})`,
      revenue: sql<number>`SUM(${schema.orderItems.totalPrice})`,
    })
      .from(schema.orderItems)
      .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
      .where(sql`date(${schema.orders.createdAt}) >= date('now','localtime','-${sql.raw(String(period))} days') AND ${schema.orders.status} != 'cancelled'`)
      .groupBy(sql`printf('%02d', CAST(strftime('%H', ${schema.orders.createdAt}) AS INTEGER))`, schema.orderItems.name)
      .orderBy(sql`groupKey`, desc(sql`SUM(${schema.orderItems.quantity})`))
      .all();
  } else if (view === "daily") {
    rows = db.select({
      groupKey: sql<string>`date(${schema.orders.createdAt})`.as("groupKey"),
      name: schema.orderItems.name,
      quantity: sql<number>`SUM(${schema.orderItems.quantity})`,
      revenue: sql<number>`SUM(${schema.orderItems.totalPrice})`,
    })
      .from(schema.orderItems)
      .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
      .where(sql`date(${schema.orders.createdAt}) >= date('now','localtime','-${sql.raw(String(period))} days') AND ${schema.orders.status} != 'cancelled'`)
      .groupBy(sql`date(${schema.orders.createdAt})`, schema.orderItems.name)
      .orderBy(desc(sql`date(${schema.orders.createdAt})`), desc(sql`SUM(${schema.orderItems.quantity})`))
      .all();
  } else if (view === "weekly") {
    rows = db.select({
      groupKey: sql<string>`strftime('%Y-W%W', ${schema.orders.createdAt})`.as("groupKey"),
      name: schema.orderItems.name,
      quantity: sql<number>`SUM(${schema.orderItems.quantity})`,
      revenue: sql<number>`SUM(${schema.orderItems.totalPrice})`,
    })
      .from(schema.orderItems)
      .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
      .where(sql`date(${schema.orders.createdAt}) >= date('now','localtime','-${sql.raw(String(period))} days') AND ${schema.orders.status} != 'cancelled'`)
      .groupBy(sql`strftime('%Y-W%W', ${schema.orders.createdAt})`, schema.orderItems.name)
      .orderBy(desc(sql`strftime('%Y-W%W', ${schema.orders.createdAt})`), desc(sql`SUM(${schema.orderItems.quantity})`))
      .all();
  } else if (view === "monthly") {
    rows = db.select({
      groupKey: sql<string>`strftime('%Y-%m', ${schema.orders.createdAt})`.as("groupKey"),
      name: schema.orderItems.name,
      quantity: sql<number>`SUM(${schema.orderItems.quantity})`,
      revenue: sql<number>`SUM(${schema.orderItems.totalPrice})`,
    })
      .from(schema.orderItems)
      .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
      .where(sql`${schema.orders.status} != 'cancelled'`)
      .groupBy(sql`strftime('%Y-%m', ${schema.orders.createdAt})`, schema.orderItems.name)
      .orderBy(desc(sql`strftime('%Y-%m', ${schema.orders.createdAt})`), desc(sql`SUM(${schema.orderItems.quantity})`))
      .all();
  } else if (view === "seasonal") {
    rows = db.select({
      groupKey: sql<string>`strftime('%Y', ${schema.orders.createdAt}) || '-' || CASE WHEN CAST(strftime('%m', ${schema.orders.createdAt}) AS INTEGER) IN (3,4,5) THEN 'spring' WHEN CAST(strftime('%m', ${schema.orders.createdAt}) AS INTEGER) IN (6,7,8) THEN 'summer' WHEN CAST(strftime('%m', ${schema.orders.createdAt}) AS INTEGER) IN (9,10,11) THEN 'fall' ELSE 'winter' END`.as("groupKey"),
      name: schema.orderItems.name,
      quantity: sql<number>`SUM(${schema.orderItems.quantity})`,
      revenue: sql<number>`SUM(${schema.orderItems.totalPrice})`,
    })
      .from(schema.orderItems)
      .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
      .where(sql`${schema.orders.status} != 'cancelled'`)
      .groupBy(sql`strftime('%Y', ${schema.orders.createdAt}) || '-' || CASE WHEN CAST(strftime('%m', ${schema.orders.createdAt}) AS INTEGER) IN (3,4,5) THEN 'spring' WHEN CAST(strftime('%m', ${schema.orders.createdAt}) AS INTEGER) IN (6,7,8) THEN 'summer' WHEN CAST(strftime('%m', ${schema.orders.createdAt}) AS INTEGER) IN (9,10,11) THEN 'fall' ELSE 'winter' END`, schema.orderItems.name)
      .orderBy(desc(sql`groupKey`), desc(sql`SUM(${schema.orderItems.quantity})`))
      .all();
  } else if (view === "yearly") {
    rows = db.select({
      groupKey: sql<string>`strftime('%Y', ${schema.orders.createdAt})`.as("groupKey"),
      name: schema.orderItems.name,
      quantity: sql<number>`SUM(${schema.orderItems.quantity})`,
      revenue: sql<number>`SUM(${schema.orderItems.totalPrice})`,
    })
      .from(schema.orderItems)
      .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
      .where(sql`${schema.orders.status} != 'cancelled'`)
      .groupBy(sql`strftime('%Y', ${schema.orders.createdAt})`, schema.orderItems.name)
      .orderBy(desc(sql`strftime('%Y', ${schema.orders.createdAt})`), desc(sql`SUM(${schema.orderItems.quantity})`))
      .all();
  }

  const groupMap = new Map<string, { products: { name: string; quantity: number; revenue: number }[]; totalQty: number; totalRev: number }>();
  for (const r of rows) {
    if (!groupMap.has(r.groupKey)) groupMap.set(r.groupKey, { products: [], totalQty: 0, totalRev: 0 });
    const g = groupMap.get(r.groupKey)!;
    g.products.push({ name: r.name, quantity: r.quantity, revenue: r.revenue });
    g.totalQty += r.quantity;
    g.totalRev += r.revenue;
  }

  const groups = Array.from(groupMap.entries()).map(([key, data]) => {
    let label = key;
    if (view === "hourly") label = `${key}:00 - ${String(parseInt(key) + 1).padStart(2, "0")}:00`;
    else if (view === "monthly") {
      const [y, m] = key.split("-");
      label = `${MONTH_LABELS[parseInt(m)] || m} ${y}`;
    } else if (view === "seasonal") {
      const [y, s] = key.split("-");
      label = `${SEASON_LABELS[s] || s} ${y}`;
    } else if (view === "weekly") {
      const [y, w] = key.split("-W");
      label = `${y} Hafta ${w}`;
    }
    return { key, label, products: data.products, totalQuantity: data.totalQty, totalRevenue: data.totalRev };
  });

  return NextResponse.json({ view, groups });
}
