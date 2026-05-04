import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq, sql, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();

  const sessions = db
    .select()
    .from(schema.tableSessions)
    .where(eq(schema.tableSessions.status, "open"))
    .all();

  if (sessions.length === 0) {
    return NextResponse.json({ sessions: [] });
  }

  const result = sessions.map((s) => {
    const orders = db
      .select()
      .from(schema.orders)
      .where(
        sql`${schema.orders.tableNumber} = ${s.tableNumber} AND ${schema.orders.createdAt} >= ${s.openedAt} AND ${schema.orders.status} != 'cancelled'`
      )
      .orderBy(desc(schema.orders.createdAt))
      .all();

    const orderIds = orders.map((o) => o.id);
    const allItems =
      orderIds.length > 0
        ? db
            .select()
            .from(schema.orderItems)
            .where(
              sql`${schema.orderItems.orderId} IN (${sql.join(
                orderIds.map((id) => sql`${id}`),
                sql`,`
              )})`
            )
            .all()
        : [];

    const enrichedItems = allItems.map((item) => {
      let extras: { id: number; name: string; price: number }[] = [];
      let removed: string[] = [];
      if (item.selectedOptions) {
        try {
          const ids: number[] = JSON.parse(item.selectedOptions);
          for (const optId of ids) {
            const opt = db
              .select()
              .from(schema.menuItemOptions)
              .where(eq(schema.menuItemOptions.id, optId))
              .get();
            if (opt) extras.push({ id: opt.id, name: opt.optionName, price: opt.priceModifier });
          }
        } catch {}
      }
      if (item.removedIngredients) {
        try { removed = JSON.parse(item.removedIngredients); } catch {}
      }
      return { ...item, extras, removed };
    });

    const total = orders.reduce((sum, o) => sum + o.total, 0);
    const unpaidCount = orders.filter((o) => !o.paymentMethod).length;

    return {
      session: { ...s, total },
      unpaidCount,
      orders: orders.map((o) => ({
        ...o,
        items: enrichedItems.filter((i) => i.orderId === o.id),
      })),
    };
  });

  result.sort((a, b) => a.session.tableNumber - b.session.tableNumber);

  return NextResponse.json({ sessions: result });
}
