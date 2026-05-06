import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq, sql, inArray } from "drizzle-orm";
import { getShopLocation } from "@/lib/settings";
import { getSession } from "@/lib/auth";

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

function bearing(lat1: number, lng1: number, lat2: number, lng2: number) {
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const r1 = (lat1 * Math.PI) / 180;
  const r2 = (lat2 * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(r2);
  const x = Math.cos(r1) * Math.sin(r2) - Math.sin(r1) * Math.cos(r2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const DIRECTIONS = [
  { name: "Kuzey", emoji: "⬆️", min: 337.5, max: 22.5 },
  { name: "Kuzeydogu", emoji: "↗️", min: 22.5, max: 67.5 },
  { name: "Dogu", emoji: "➡️", min: 67.5, max: 112.5 },
  { name: "Guneydogu", emoji: "↘️", min: 112.5, max: 157.5 },
  { name: "Guney", emoji: "⬇️", min: 157.5, max: 202.5 },
  { name: "Guneybati", emoji: "↙️", min: 202.5, max: 247.5 },
  { name: "Bati", emoji: "⬅️", min: 247.5, max: 292.5 },
  { name: "Kuzeybati", emoji: "↖️", min: 292.5, max: 337.5 },
];

function getDirection(lat: number, lng: number, shopLat: number, shopLng: number) {
  const b = bearing(shopLat, shopLng, lat, lng);
  for (const d of DIRECTIONS) {
    if (d.name === "Kuzey") {
      if (b >= d.min || b < d.max) return d;
    } else {
      if (b >= d.min && b < d.max) return d;
    }
  }
  return DIRECTIONS[0];
}

interface Order {
  id: number;
  status: string;
  customerName: string | null;
  customerPhone: string | null;
  deliveryAddress: string | null;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  total: number;
  createdAt: string;
  preparedAt: string | null;
}

function clusterByDirection(orders: Order[], shopLat: number, shopLng: number) {
  const groups: Record<string, { direction: typeof DIRECTIONS[0]; orders: Order[]; distFromShop: number }> = {};
  const noLocation: Order[] = [];

  for (const o of orders) {
    if (!o.deliveryLatitude || !o.deliveryLongitude) {
      noLocation.push(o);
      continue;
    }
    const dir = getDirection(o.deliveryLatitude, o.deliveryLongitude, shopLat, shopLng);
    if (!groups[dir.name]) {
      groups[dir.name] = { direction: dir, orders: [], distFromShop: 0 };
    }
    groups[dir.name].orders.push(o);
    groups[dir.name].distFromShop += haversine(shopLat, shopLng, o.deliveryLatitude, o.deliveryLongitude);
  }

  for (const g of Object.values(groups)) {
    g.distFromShop = g.orders.length > 0 ? g.distFromShop / g.orders.length : 0;
  }

  const sorted = Object.values(groups).sort((a, b) => b.orders.length - a.orders.length);

  for (const g of sorted) {
    g.orders.sort((a, b) => {
      const da = haversine(shopLat, shopLng, a.deliveryLatitude!, a.deliveryLongitude!);
      const db2 = haversine(shopLat, shopLng, b.deliveryLatitude!, b.deliveryLongitude!);
      return da - db2;
    });
  }

  if (noLocation.length > 0) {
    sorted.push({ direction: { name: "Konumsuz", emoji: "📍", min: 0, max: 0 }, orders: noLocation, distFromShop: 0 });
  }

  return sorted;
}

export async function GET() {
  const db = getDb();
  const [SHOP_LAT, SHOP_LNG] = getShopLocation();

  const allOrders = db
    .select()
    .from(schema.orders)
    .where(
      sql`${schema.orders.deliveryAddress} IS NOT NULL AND ${schema.orders.status} IN ('new','preparing','ready')`
    )
    .all() as Order[];

  const preparing = allOrders.filter((o) => o.status === "preparing");
  const ready = allOrders.filter((o) => o.status === "ready");
  const newOrders = allOrders.filter((o) => o.status === "new");

  const now = Date.now();
  const readyWithWait = ready.map((o) => {
    const readyAt = o.preparedAt ? new Date(o.preparedAt).getTime() : now;
    const waitMin = Math.floor((now - readyAt) / 60000);
    return { ...o, waitMinutes: waitMin, urgent: waitMin >= MAX_WAIT_MINUTES };
  });

  const newClusters = clusterByDirection(newOrders, SHOP_LAT, SHOP_LNG);
  const readyClusters = clusterByDirection(ready, SHOP_LAT, SHOP_LNG);

  return NextResponse.json({
    preparing,
    readyClusters: readyClusters.map((c) => ({
      direction: c.direction.name,
      emoji: c.direction.emoji,
      avgDist: +c.distFromShop.toFixed(2),
      orders: c.orders.map((o) => {
        const rw = readyWithWait.find((r) => r.id === o.id);
        return { ...o, waitMinutes: rw?.waitMinutes || 0, urgent: rw?.urgent || false };
      }),
    })),
    newClusters: newClusters.map((c) => ({
      direction: c.direction.name,
      emoji: c.direction.emoji,
      avgDist: +c.distFromShop.toFixed(2),
      orderIds: c.orders.map((o) => o.id),
      orders: c.orders,
    })),
    stats: {
      preparing: preparing.length,
      ready: ready.length,
      waiting: newOrders.length,
      urgentReady: readyWithWait.filter((r) => r.urgent).length,
    },
  });
}

// Toplu kabul: bir kümedeki tüm siparişleri "preparing" yap
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });
  const { orderIds } = await req.json();
  if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
    return NextResponse.json({ error: "orderIds gerekli" }, { status: 400 });
  }

  const db = getDb();
  let accepted = 0;

  const maxBatch = db.select({ max: sql<number>`COALESCE(MAX(${schema.orders.batchId}), 0)` }).from(schema.orders).get();
  const batchId = (maxBatch?.max || 0) + 1;

  for (const id of orderIds) {
    const order = db.select().from(schema.orders).where(eq(schema.orders.id, id)).get();
    if (!order || order.status !== "new") continue;

    db.update(schema.orders)
      .set({ status: "preparing" as const, batchId })
      .where(eq(schema.orders.id, id))
      .run();
    accepted++;

    if (order.customerPhone) {
      const botPort = process.env.BOT_PORT || "3003";
      fetch(`http://localhost:${botPort}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: order.customerPhone, status: "preparing", orderId: id }),
      }).catch((e) => console.error("WhatsApp bildirim hatasi:", e.message));
    }
  }

  return NextResponse.json({ ok: true, accepted, batchId });
}
