import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import QRCode from "qrcode";
import { getShopLocation } from "@/lib/settings";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token gerekli" }, { status: 400 });

  const db = getDb();
  const setting = db.select().from(schema.settings).where(eq(schema.settings.key, `batch_${token}`)).get();
  if (!setting) return NextResponse.json({ error: "Gecersiz token" }, { status: 404 });

  const batch = JSON.parse(setting.value) as { orderIds: number[]; courierId: number };
  const orders = [];
  for (const id of batch.orderIds) {
    const order = db.select().from(schema.orders).where(eq(schema.orders.id, id)).get();
    if (order) orders.push(order);
  }

  return NextResponse.json({ batch, orders });
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function sortByRoute(orders: { id: number; deliveryLatitude: number | null; deliveryLongitude: number | null }[], shopLat: number, shopLng: number) {
  if (orders.length <= 1) return orders.map((o) => o.id);
  const sorted: typeof orders = [];
  const remaining = [...orders];
  let curLat = shopLat;
  let curLng = shopLng;
  while (remaining.length > 0) {
    let nearest = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const o = remaining[i];
      if (!o.deliveryLatitude || !o.deliveryLongitude) continue;
      const d = haversine(curLat, curLng, o.deliveryLatitude, o.deliveryLongitude);
      if (d < nearestDist) { nearestDist = d; nearest = i; }
    }
    const pick = remaining.splice(nearest, 1)[0];
    sorted.push(pick);
    if (pick.deliveryLatitude && pick.deliveryLongitude) {
      curLat = pick.deliveryLatitude;
      curLng = pick.deliveryLongitude;
    }
  }
  return sorted.map((o) => o.id);
}

export async function POST(req: NextRequest) {
  const { orderIds, courierId, baseUrl } = await req.json();
  const db = getDb();
  const [SHOP_LAT, SHOP_LNG] = getShopLocation();

  const orders = orderIds.map((id: number) =>
    db.select().from(schema.orders).where(eq(schema.orders.id, id)).get()
  ).filter(Boolean);
  const routedIds = sortByRoute(orders, SHOP_LAT, SHOP_LNG);

  const token = Math.random().toString(36).slice(2, 10);

  db.insert(schema.settings)
    .values({
      key: `batch_${token}`,
      value: JSON.stringify({ orderIds: routedIds, courierId, createdAt: new Date().toISOString() }),
      updatedAt: sql`(datetime('now','localtime'))`,
    })
    .run();

  const url = `${baseUrl || process.env.SITE_URL || "http://localhost:3002"}/courier/batch/${token}`;
  const qrDataUrl = await QRCode.toDataURL(url, { width: 300, margin: 2 });

  return NextResponse.json({ token, url, qr: qrDataUrl, routedOrderIds: routedIds });
}
