import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();

  const rows = db.all(sql`
    SELECT o.id, o.customer_name AS customerName, o.customer_phone AS customerPhone,
           o.delivery_address AS deliveryAddress, o.total, o.status,
           o.staff_courier_id AS staffCourierId, o.delivered_at AS deliveredAt,
           o.created_at AS createdAt,
           p.amount AS paidAmount, p.method AS payMethod,
           s.name AS courierName, s.id AS courierId
    FROM orders o
    JOIN payments p ON p.order_id = o.id
    JOIN staff s ON s.id = o.staff_courier_id
    WHERE o.status = 'delivered'
      AND o.staff_courier_id IS NOT NULL
      AND o.id NOT IN (
        SELECT order_id FROM cash_register WHERE order_id IS NOT NULL AND type = 'sale'
      )
    ORDER BY s.name, o.delivered_at DESC
  `);

  interface Row {
    courierId: number;
    courierName: string;
    id: number;
    customerName: string | null;
    customerPhone: string | null;
    deliveryAddress: string | null;
    total: number;
    paidAmount: number;
    payMethod: string;
    deliveredAt: string | null;
    createdAt: string;
  }

  const grouped: Record<number, {
    courierId: number;
    courierName: string;
    orders: { id: number; customerName: string | null; total: number; paidAmount: number; payMethod: string; deliveredAt: string | null }[];
    total: number;
  }> = {};

  for (const row of rows as Row[]) {
    if (!grouped[row.courierId]) {
      grouped[row.courierId] = { courierId: row.courierId, courierName: row.courierName, orders: [], total: 0 };
    }
    grouped[row.courierId].orders.push({
      id: row.id,
      customerName: row.customerName,
      total: row.total,
      paidAmount: row.paidAmount,
      payMethod: row.payMethod,
      deliveredAt: row.deliveredAt,
    });
    grouped[row.courierId].total += row.paidAmount;
  }

  return NextResponse.json(Object.values(grouped));
}
