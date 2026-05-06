import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function PUT(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });
  const { orderId, latitude, longitude } = await req.json();
  const db = getDb();

  db.update(schema.orders)
    .set({ deliveryLatitude: latitude, deliveryLongitude: longitude })
    .where(eq(schema.orders.id, orderId))
    .run();

  return NextResponse.json({ ok: true });
}
