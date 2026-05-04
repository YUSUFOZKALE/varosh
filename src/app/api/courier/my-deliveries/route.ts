import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });

  const db = getDb();
  const today = new Date().toISOString().split("T")[0];

  const orders = db.all(sql`
    SELECT o.id, o.customer_name AS customerName, o.customer_phone AS customerPhone,
           o.delivery_address AS deliveryAddress, o.total, o.status,
           o.payment_method AS paymentMethod, o.delivered_at AS deliveredAt,
           o.created_at AS createdAt,
           CASE WHEN p.id IS NOT NULL THEN p.amount ELSE NULL END AS paidAmount,
           CASE WHEN p.id IS NOT NULL THEN p.method ELSE NULL END AS payMethod,
           CASE WHEN cr.id IS NOT NULL THEN 1 ELSE 0 END AS cashCollected
    FROM orders o
    LEFT JOIN payments p ON p.order_id = o.id
    LEFT JOIN cash_register cr ON cr.order_id = o.id AND cr.type = 'sale'
    WHERE o.staff_courier_id = ${session.staffId}
      AND date(o.created_at) = ${today}
    ORDER BY o.created_at DESC
  `);

  return NextResponse.json(orders);
}
