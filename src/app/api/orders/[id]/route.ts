import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  const order = db.select().from(schema.orders).where(eq(schema.orders.id, parseInt(params.id))).get();
  if (!order) return NextResponse.json({ error: "Siparis bulunamadi" }, { status: 404 });

  const items = db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, order.id)).all();

  return NextResponse.json({ ...order, items });
}
