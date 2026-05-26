import { NextRequest, NextResponse } from "next/server";
import { getDb, getSqliteDb, schema } from "@/lib/db";
import { eq, and, sql, min } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });

  const { fromTable, toTable } = await req.json();
  if (!fromTable || !toTable || fromTable === toTable) {
    return NextResponse.json({ error: "Gecersiz masa numarasi" }, { status: 400 });
  }

  const db = getDb();
  const sqlite = getSqliteDb();

  const openSession = db
    .select()
    .from(schema.tableSessions)
    .where(
      and(
        eq(schema.tableSessions.tableNumber, fromTable),
        eq(schema.tableSessions.status, "open")
      )
    )
    .get();

  if (!openSession) {
    return NextResponse.json({ error: "Kaynak masada acik oturum yok" }, { status: 400 });
  }

  sqlite.transaction(() => {
    // Find the earliest createdAt among the orders being transferred
    const earliest = db
      .select({ minCreatedAt: min(schema.orders.createdAt) })
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.tableNumber, fromTable),
          sql`${schema.orders.createdAt} >= ${openSession.openedAt}`
        )
      )
      .get();

    const earliestCreatedAt = earliest?.minCreatedAt ?? openSession.openedAt;

    // Update orders: move them to the target table
    db.update(schema.orders)
      .set({ tableNumber: toTable })
      .where(
        and(
          eq(schema.orders.tableNumber, fromTable),
          sql`${schema.orders.createdAt} >= ${openSession.openedAt}`
        )
      )
      .run();

    // Close the source session
    db.update(schema.tableSessions)
      .set({ status: "closed" as const, closedAt: sql`(datetime('now','localtime'))` })
      .where(eq(schema.tableSessions.id, openSession.id))
      .run();

    // Check if target table already has an open session
    const targetSession = db
      .select()
      .from(schema.tableSessions)
      .where(
        and(
          eq(schema.tableSessions.tableNumber, toTable),
          eq(schema.tableSessions.status, "open")
        )
      )
      .get();

    if (!targetSession) {
      // Create a new session with openedAt set to the earliest transferred order's createdAt
      db.insert(schema.tableSessions)
        .values({
          tableNumber: toTable,
          status: "open",
          total: 0,
          openedAt: earliestCreatedAt,
        })
        .run();
    } else {
      // Merging into existing session: if the target session's openedAt is AFTER
      // the earliest transferred order, push it back so those orders are visible
      if (targetSession.openedAt > earliestCreatedAt) {
        db.update(schema.tableSessions)
          .set({ openedAt: earliestCreatedAt })
          .where(eq(schema.tableSessions.id, targetSession.id))
          .run();
      }
    }
  })();

  return NextResponse.json({ ok: true });
}
