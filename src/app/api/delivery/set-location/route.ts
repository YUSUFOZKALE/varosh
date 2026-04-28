import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function PUT(req: NextRequest) {
  const { orderId, latitude, longitude } = await req.json();
  const db = getDb();

  db.update(schema.orders)
    .set({ deliveryLatitude: latitude, deliveryLongitude: longitude })
    .where(eq(schema.orders.id, orderId))
    .run();

  return NextResponse.json({ ok: true });
}
