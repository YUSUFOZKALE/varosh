import { NextRequest, NextResponse } from "next/server";
import { getDb, getSqliteDb, schema } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { recordPayment, refundPayment } from "@/lib/payment";

const VALID_TRANSITIONS: Record<string, string[]> = {
  new: ["preparing", "cancelled"],
  pending_approval: ["new", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["on_the_way", "delivered", "cancelled"],
  on_the_way: ["delivered", "cancelled"],
  delivered: ["cancelled"],
};

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });

  const id = parseInt(params.id);
  if (isNaN(id)) return NextResponse.json({ error: "Gecersiz ID" }, { status: 400 });

  const body = await req.json();
  const { status, cancelReason, paymentMethod } = body;
  const db = getDb();
  const sqlite = getSqliteDb();

  const order = db.select().from(schema.orders).where(eq(schema.orders.id, id)).get();
  if (!order) return NextResponse.json({ error: "Siparis bulunamadi" }, { status: 404 });

  const allowed = VALID_TRANSITIONS[order.status];
  if (!allowed || !allowed.includes(status)) {
    return NextResponse.json({ error: `${order.status} -> ${status} gecisi gecersiz` }, { status: 400 });
  }

  if (status === "cancelled" && order.paymentConfirmedAt) {
    const result = refundPayment(id, session.staffId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status || 400 });
    return NextResponse.json({ ok: true, refunded: true });
  }

  const txn = sqlite.transaction(() => {
    const updates: Record<string, any> = { status };

    if (status === "preparing") {
      if (!order.batchId) {
        const maxBatch = db.select({ max: sql<number>`COALESCE(MAX(${schema.orders.batchId}), 0)` }).from(schema.orders).get();
        updates.batchId = (maxBatch?.max || 0) + 1;
      }
    }
    if (status === "ready") updates.preparedAt = sql`(datetime('now','localtime'))`;
    if (status === "on_the_way") updates.pickedUpAt = sql`(datetime('now','localtime'))`;
    if (status === "delivered") updates.deliveredAt = sql`(datetime('now','localtime'))`;
    if (status === "cancelled") {
      updates.cancelledAt = sql`(datetime('now','localtime'))`;
      updates.cancelReason = cancelReason || null;
    }

    db.update(schema.orders)
      .set(updates)
      .where(eq(schema.orders.id, id))
      .run();

    if (status === "delivered" && order.staffCourierId) {
      db.update(schema.staff)
        .set({ totalDeliveries: sql`${schema.staff.totalDeliveries} + 1` })
        .where(eq(schema.staff.id, order.staffCourierId))
        .run();
    }
  });

  txn();

  if (status === "delivered" && paymentMethod) {
    const payResult = recordPayment({
      orderId: id,
      method: paymentMethod,
      staffId: session.staffId,
      isCourierDelivery: !!order.staffCourierId,
    });
    if (!payResult.ok) {
      return NextResponse.json({ error: payResult.error }, { status: payResult.status || 400 });
    }
  }

  if (order.customerPhone && ["preparing", "ready", "on_the_way", "delivered", "cancelled"].includes(status)) {
    const botPort = process.env.BOT_PORT || "3003";
    fetch(`http://localhost:${botPort}/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: order.customerPhone, status, orderId: id }),
    }).catch((e) => console.error("WhatsApp bildirim hatasi:", e.message));
  }

  return NextResponse.json({ ok: true });
}
