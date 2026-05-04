import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq, and, sql, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const tableNumber = parseInt(req.nextUrl.searchParams.get("table") || "0");
  if (!tableNumber) return NextResponse.json({ error: "table param gerekli" }, { status: 400 });

  const db = getDb();

  let session = db
    .select()
    .from(schema.tableSessions)
    .where(
      and(
        eq(schema.tableSessions.tableNumber, tableNumber),
        eq(schema.tableSessions.status, "open")
      )
    )
    .get();

  if (!session) {
    return NextResponse.json({ session: null, orders: [] });
  }

  const orders = db
    .select()
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.tableNumber, tableNumber),
        sql`${schema.orders.createdAt} >= ${session.openedAt}`
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
    session: { ...session, total },
    orders: orders.map((o) => ({
      ...o,
      items: allItems.filter((i) => i.orderId === o.id),
    })),
  });
}

export async function POST(req: NextRequest) {
  const { tableNumber, action } = await req.json();
  if (!tableNumber) return NextResponse.json({ error: "tableNumber gerekli" }, { status: 400 });

  const db = getDb();

  if (action === "close") {
    db.update(schema.tableSessions)
      .set({
        status: "closed" as const,
        closedAt: new Date().toISOString().replace("T", " ").slice(0, 19),
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

  let session = db
    .select()
    .from(schema.tableSessions)
    .where(
      and(
        eq(schema.tableSessions.tableNumber, tableNumber),
        eq(schema.tableSessions.status, "open")
      )
    )
    .get();

  if (!session) {
    session = db
      .insert(schema.tableSessions)
      .values({ tableNumber, status: "open", total: 0 })
      .returning()
      .get();
  }

  return NextResponse.json({ session });
}
