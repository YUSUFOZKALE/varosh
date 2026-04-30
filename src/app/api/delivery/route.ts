import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { getShopLocation } from "@/lib/settings";

export const dynamic = "force-dynamic";

const MAX_WAIT_MINUTES = 5;

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET() {
  const db = getDb();

  const deliveries = db.select({
    id: schema.orders.id,
    customerName: schema.orders.customerName,
    customerPhone: schema.orders.customerPhone,
    deliveryAddress: schema.orders.deliveryAddress,
    deliveryLatitude: schema.orders.deliveryLatitude,
    deliveryLongitude: schema.orders.deliveryLongitude,
    total: schema.orders.total,
    status: schema.orders.status,
    createdAt: schema.orders.createdAt,
    preparedAt: schema.orders.preparedAt,
    courierId: schema.orders.staffCourierId,
    courierName: schema.staff.name,
    courierPhone: schema.staff.phone,
  })
    .from(schema.orders)
    .leftJoin(schema.staff, eq(schema.orders.staffCourierId, schema.staff.id))
    .where(sql`${schema.orders.deliveryAddress} IS NOT NULL AND ${schema.orders.status} IN ('new','preparing','ready','on_the_way')`)
    .all();

  // Akıllı sıralama
  const [SHOP_LAT, SHOP_LNG] = getShopLocation();
  const now = Date.now();
  const sorted = deliveries.map((d) => {
    const readyAt = d.preparedAt ? new Date(d.preparedAt).getTime() : null;
    const waitMin = readyAt ? Math.floor((now - readyAt) / 60000) : 0;
    const urgent = d.status === "ready" && waitMin >= MAX_WAIT_MINUTES;
    const distToShop = d.deliveryLatitude && d.deliveryLongitude
      ? haversine(SHOP_LAT, SHOP_LNG, d.deliveryLatitude, d.deliveryLongitude) : 99;

    // Sıralama puanı: urgent > ready > preparing > new, sonra mesafeye göre
    const statusWeight =
      urgent ? 0 :
      d.status === "ready" ? 1 :
      d.status === "on_the_way" ? 2 :
      d.status === "preparing" ? 3 : 4;

    return { ...d, waitMin, urgent, distToShop, sortScore: statusWeight * 100 + distToShop };
  });
  sorted.sort((a, b) => a.sortScore - b.sortScore);

  const couriers = db.select()
    .from(schema.staff)
    .where(sql`${schema.staff.role} = 'courier' AND ${schema.staff.isActive} = 1`)
    .all();

  return NextResponse.json({ deliveries: sorted, couriers });
}
