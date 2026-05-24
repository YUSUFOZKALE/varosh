import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function PUT(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });
  const { orderId, latitude, longitude } = await req.json();

  if (!orderId || typeof latitude !== "number" || typeof longitude !== "number") {
    return NextResponse.json({ error: "Gecersiz parametre" }, { status: 400 });
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return NextResponse.json({ error: "Gecersiz koordinat" }, { status: 400 });
  }

  const db = getDb();
  const order = db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).get();
  if (!order) return NextResponse.json({ error: "Siparis bulunamadi" }, { status: 404 });

  db.update(schema.orders)
    .set({ deliveryLatitude: latitude, deliveryLongitude: longitude })
    .where(eq(schema.orders.id, orderId))
    .run();

  return NextResponse.json({ ok: true });
}
