import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const tableNumber = parseInt(req.nextUrl.searchParams.get("table") || "0");
  if (!tableNumber) return NextResponse.json({ error: "table param gerekli" }, { status: 400 });

  const db = getDb();

  let tableSession = db
    .select()
    .from(schema.tableSessions)
    .where(
      and(
        eq(schema.tableSessions.tableNumber, tableNumber),
        eq(schema.tableSessions.status, "open")
      )
    )
    .get();

  if (!tableSession) {
    return NextResponse.json({ session: null, orders: [] });
  }

  const orders = db
    .select()
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.tableNumber, tableNumber),
        sql`${schema.orders.createdAt} >= ${tableSession.openedAt}`
      )
    )
    .orderBy(desc(schema.orders.createdAt))
    .all();

  const orderIds = orders.map((o) => o.id);
  const allItems =
    orderIds.length > 0
      ? db
          .select()
          .from(schema.orderItems)
          .where(sql`${schema.orderItems.orderId} IN (${sql.join(orderIds.map((id) => sql`${id}`), sql`,`)})`)
          .all()
      : [];

  const total = orders.reduce((s, o) => s + o.total, 0);

  return NextResponse.json({
    session: { ...tableSession, total },
    orders: orders.map((o) => ({
      ...o,
      items: allItems.filter((i) => i.orderId === o.id),
    })),
  });
}

export async function POST(req: NextRequest) {
  const authSession = getSession();
  if (!authSession) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });

  const { tableNumber, action } = await req.json();
  if (!tableNumber) return NextResponse.json({ error: "tableNumber gerekli" }, { status: 400 });

  const db = getDb();

  if (action === "close") {
    db.update(schema.tableSessions)
      .set({
        status: "closed" as const,
        closedAt: sql`(datetime('now','localtime'))`,
      })
      .where(
        and(
          eq(schema.tableSessions.tableNumber, tableNumber),
          eq(schema.tableSessions.status, "open")
        )
      )
      .run();
    return NextResponse.json({ ok: true });
  }

  let tableSession = db
    .select()
    .from(schema.tableSessions)
    .where(
      and(
        eq(schema.tableSessions.tableNumber, tableNumber),
        eq(schema.tableSessions.status, "open")
      )
    )
    .get();

  if (!tableSession) {
    tableSession = db
      .insert(schema.tableSessions)
      .values({ tableNumber, status: "open", total: 0 })
      .returning()
      .get();
  }

  return NextResponse.json({ session: tableSession });
}
