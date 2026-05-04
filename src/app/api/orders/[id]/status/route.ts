import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq, sql } from "drizzle-orm";


const VALID_TRANSITIONS: Record<string, string[]> = {
  new: ["preparing", "cancelled"],
  pending_approval: ["new", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["on_the_way", "delivered", "cancelled"],
  on_the_way: ["delivered", "cancelled"],
};

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  const body = await req.json();
  const { status, cancelReason, paymentMethod } = body;
  const db = getDb();

  const order = db.select().from(schema.orders).where(eq(schema.orders.id, id)).get();
  if (!order) return NextResponse.json({ error: "Siparis bulunamadi" }, { status: 404 });

  const allowed = VALID_TRANSITIONS[order.status];
  if (!allowed || !allowed.includes(status)) {
    return NextResponse.json({ error: `${order.status} -> ${status} gecisi gecersiz` }, { status: 400 });
  }

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  const updates: Record<string, string | number | null> = { status };

  if (status === "preparing") {
    updates.preparedAt = null;
    if (!order.batchId) {
      const maxBatch = db.select({ max: sql<number>`COALESCE(MAX(${schema.orders.batchId}), 0)` }).from(schema.orders).get();
      updates.batchId = (maxBatch?.max || 0) + 1;
    }
  }
  if (status === "ready") updates.preparedAt = now;
  if (status === "on_the_way") updates.pickedUpAt = now;
  if (status === "delivered") updates.deliveredAt = now;
  if (status === "cancelled") {
    updates.cancelledAt = now;
    updates.cancelReason = cancelReason || null;
  }

  const updated = db.update(schema.orders)
    .set(updates)
    .where(eq(schema.orders.id, id))
    .returning()
    .get();

  if (status === "delivered") {
    if (order.staffCourierId) {
      db.update(schema.staff)
        .set({ totalDeliveries: sql`${schema.staff.totalDeliveries} + 1` })
        .where(eq(schema.staff.id, order.staffCourierId))
        .run();
    }

    if (paymentMethod) {
      db.insert(schema.payments)
        .values({
          orderId: id,
          amount: order.total,
          method: paymentMethod,
          receivedAmount: order.total,
          changeGiven: 0,
        })
        .run();

      if (!order.staffCourierId) {
        db.insert(schema.cashRegister)
          .values({
            type: "sale",
            amount: order.total,
            orderId: id,
            description: `Siparis #${id} - ${paymentMethod} (kurye teslim)`,
          })
          .run();
      }

      db.update(schema.orders)
        .set({
          paymentMethod,
          paymentConfirmedAt: sql`(datetime('now','localtime'))`,
        })
        .where(eq(schema.orders.id, id))
        .run();
    }
  }

  // WhatsApp bildirim
  if (order.customerPhone && ["preparing", "ready", "on_the_way", "delivered", "cancelled"].includes(status)) {
    const botPort = process.env.BOT_PORT || "3003";
    fetch(`http://localhost:${botPort}/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: order.customerPhone, status, orderId: id }),
    }).catch((e) => console.error("WhatsApp bildirim hatasi:", e.message));
  }

  return NextResponse.json(updated);
}
