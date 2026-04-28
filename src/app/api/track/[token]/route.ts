import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const db = getDb();
  const order = db.select().from(schema.orders)
    .where(eq(schema.orders.trackingToken, params.token))
    .get();

  if (!order) {
    return NextResponse.json({ error: "Siparis bulunamadi" }, { status: 404 });
  }

  const items = db.select().from(schema.orderItems)
    .where(eq(schema.orderItems.orderId, order.id))
    .all();

  let courierName: string | null = null;
  let courierPhone: string | null = null;
  if (order.staffCourierId) {
    const courier = db.select().from(schema.staff)
      .where(eq(schema.staff.id, order.staffCourierId))
      .get();
    if (courier) {
      courierName = courier.name;
      courierPhone = courier.phone;
    }
  }

  return NextResponse.json({
    id: order.id,
    status: order.status,
    customerName: order.customerName,
    deliveryAddress: order.deliveryAddress,
    items: items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      totalPrice: i.totalPrice,
    })),
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    total: order.total,
    courierName,
    courierPhone,
    createdAt: order.createdAt,
    preparedAt: order.preparedAt,
    pickedUpAt: order.pickedUpAt,
    deliveredAt: order.deliveredAt,
    estimatedDeliveryMinutes: order.estimatedDeliveryMinutes,
  });
}
