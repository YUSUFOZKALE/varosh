import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { asc, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();

  const orders = db.select()
    .from(schema.orders)
    .where(sql`${schema.orders.status} IN ('new', 'preparing', 'ready', 'on_the_way')
      OR (${schema.orders.status} = 'delivered' AND ${schema.orders.deliveredAt} >= datetime('now', 'localtime', '-2 hours'))`)
    .orderBy(asc(schema.orders.createdAt))
    .all();

  const allOptions = db.select().from(schema.menuItemOptions).all();
  const optMap = new Map(allOptions.map((o) => [o.id, o]));

  const result = [];
  for (const order of orders) {
    const rawItems = db.select()
      .from(schema.orderItems)
      .where(eq(schema.orderItems.orderId, order.id))
      .all();

    const items = rawItems.map((item) => {
      let extras: { id: number; name: string; price: number }[] = [];
      if (item.selectedOptions) {
        try {
          const ids: number[] = JSON.parse(item.selectedOptions);
          extras = ids.map((id) => {
            const opt = optMap.get(id);
            return opt ? { id: opt.id, name: opt.optionName, price: opt.priceModifier } : { id, name: `#${id}`, price: 0 };
          });
        } catch {}
      }

      let removed: string[] = [];
      if (item.removedIngredients) {
        try { removed = JSON.parse(item.removedIngredients); } catch {}
      }

      return { ...item, extras, removed };
    });

    result.push({ ...order, items });
  }

  return NextResponse.json(result);
}
