import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  const order = db.select().from(schema.orders).where(eq(schema.orders.id, parseInt(params.id))).get();
  if (!order) return NextResponse.json({ error: "Siparis bulunamadi" }, { status: 404 });

  const rawItems = db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, order.id)).all();

  const allOptions = db.select().from(schema.menuItemOptions).all();
  const optMap = new Map(allOptions.map((o) => [o.id, o]));

  const items = rawItems.map((item) => {
    let parsedExtras: { id: number; name: string; price: number }[] = [];
    if (item.selectedOptions) {
      try {
        const ids: number[] = JSON.parse(item.selectedOptions);
        parsedExtras = ids.map((id) => {
          const opt = optMap.get(id);
          return opt ? { id: opt.id, name: opt.optionName, price: opt.priceModifier } : { id, name: `#${id}`, price: 0 };
        });
      } catch {}
    }

    let parsedRemoved: string[] = [];
    if (item.removedIngredients) {
      try { parsedRemoved = JSON.parse(item.removedIngredients); } catch {}
    }

    return {
      ...item,
      extras: parsedExtras,
      removed: parsedRemoved,
    };
  });

  return NextResponse.json({ ...order, items });
}
