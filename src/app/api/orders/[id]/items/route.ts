import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });
  const orderId = parseInt(params.id);
  const body = await req.json();
  const db = getDb();

  const order = db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).get();
  if (!order) return NextResponse.json({ error: "Siparis bulunamadi" }, { status: 404 });

  if (body.removeItemId) {
    db.delete(schema.orderItems)
      .where(eq(schema.orderItems.id, body.removeItemId))
      .run();
  }

  if (body.updateItem) {
    const { itemId, quantity } = body.updateItem;
    if (quantity <= 0) {
      db.delete(schema.orderItems).where(eq(schema.orderItems.id, itemId)).run();
    } else {
      const item = db.select().from(schema.orderItems).where(eq(schema.orderItems.id, itemId)).get();
      if (item) {
        const newTotal = item.unitPrice * quantity;
        db.update(schema.orderItems)
          .set({ quantity, totalPrice: newTotal })
          .where(eq(schema.orderItems.id, itemId))
          .run();
      }
    }
  }

  const remaining = db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, orderId)).all();
  const subtotal = remaining.reduce((s, i) => s + i.totalPrice, 0);
  const total = subtotal + (order.deliveryFee || 0);

  db.update(schema.orders)
    .set({ subtotal, total })
    .where(eq(schema.orders.id, orderId))
    .run();

  return NextResponse.json({ ok: true, subtotal, total });
}
