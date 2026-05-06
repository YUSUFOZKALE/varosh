import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });
  const { orderId, courierId } = await req.json();
  const db = getDb();

  const order = db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).get();
  if (!order) return NextResponse.json({ error: "Siparis bulunamadi" }, { status: 404 });

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  const goOnTheWay = order.status === "ready";

  db.update(schema.orders)
    .set({
      staffCourierId: courierId,
      ...(goOnTheWay ? { status: "on_the_way" as const, pickedUpAt: now } : {}),
    })
    .where(eq(schema.orders.id, orderId))
    .run();

  return NextResponse.json({ ok: true });
}
