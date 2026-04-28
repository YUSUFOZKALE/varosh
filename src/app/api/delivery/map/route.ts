import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

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
    courierId: schema.orders.staffCourierId,
  })
    .from(schema.orders)
    .where(sql`${schema.orders.deliveryAddress} IS NOT NULL AND ${schema.orders.status} IN ('new','preparing','ready','on_the_way')`)
    .all();

  return NextResponse.json(deliveries);
}
