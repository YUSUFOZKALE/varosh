import { NextRequest, NextResponse } from "next/server";
import { getDb, getSqliteDb, schema } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });

  const db = getDb();
  const courierId = session.staffId;
  const today = new Date().toISOString().split("T")[0];

  const uncollected = db.all(sql`
    SELECT o.id, o.customer_name AS customerName, o.total,
           p.amount AS paidAmount, p.method AS payMethod, o.delivered_at AS deliveredAt
    FROM orders o
    JOIN payments p ON p.order_id = o.id
    WHERE o.status = 'delivered'
      AND o.staff_courier_id = ${courierId}
      AND p.method = 'cash'
      AND o.id NOT IN (
        SELECT order_id FROM cash_register WHERE order_id IS NOT NULL AND type = 'sale'
      )
    ORDER BY o.delivered_at DESC
  `) as { id: number; customerName: string | null; total: number; paidAmount: number; deliveredAt: string | null }[];

  const cashFromDeliveries = uncollected.reduce((sum, o) => sum + o.paidAmount, 0);

  const todayMovements = db.all(sql`
    SELECT id, type, amount, description, created_at AS createdAt
    FROM cash_register
    WHERE staff_id = ${courierId}
      AND type IN ('deposit', 'withdrawal')
      AND date(created_at) = ${today}
    ORDER BY created_at DESC
  `) as { id: number; type: string; amount: number; description: string | null; createdAt: string }[];

  const todayDeposits = todayMovements.filter(m => m.type === "deposit").reduce((s, m) => s + m.amount, 0);
  const todayWithdrawals = todayMovements.filter(m => m.type === "withdrawal").reduce((s, m) => s + m.amount, 0);

  const cashOnHand = cashFromDeliveries + todayWithdrawals - todayDeposits;

  const cardDeliveries = db.all(sql`
    SELECT COALESCE(SUM(p.amount), 0) AS total, COUNT(*) AS cnt
    FROM orders o
    JOIN payments p ON p.order_id = o.id
    WHERE o.status = 'delivered'
      AND o.staff_courier_id = ${courierId}
      AND p.method = 'card'
      AND date(o.delivered_at) = ${today}
  `) as { total: number; cnt: number }[];

  const todayDeliveredCount = db.all(sql`
    SELECT COUNT(*) AS cnt FROM orders
    WHERE status = 'delivered' AND staff_courier_id = ${courierId} AND date(delivered_at) = ${today}
  `) as { cnt: number }[];

  return NextResponse.json({
    cashOnHand,
    cashFromDeliveries,
    cardFromDeliveries: cardDeliveries[0]?.total || 0,
    todayDeposits,
    todayWithdrawals,
    todayDeliveryCount: todayDeliveredCount[0]?.cnt || 0,
    uncollectedOrders: uncollected,
    todayMovements,
  });
}

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });

  const { type, amount } = await req.json();

  if (!type || !amount || amount <= 0) {
    return NextResponse.json({ error: "Gecersiz islem" }, { status: 400 });
  }
  if (type !== "deposit" && type !== "withdrawal") {
    return NextResponse.json({ error: "Gecersiz tip" }, { status: 400 });
  }

  const db = getDb();
  const sqlite = getSqliteDb();
  const courierId = session.staffId;

  const description = type === "deposit"
    ? `Kurye kasaya birakti: ${amount.toFixed(0)} TL`
    : `Kurye kasadan aldi: ${amount.toFixed(0)} TL`;

  sqlite.transaction(() => {
    db.insert(schema.cashRegister)
      .values({
        type,
        amount,
        staffId: courierId,
        description,
      })
      .run();

    if (type === "deposit") {
      const uncollected = db.all(sql`
        SELECT o.id, p.amount AS paidAmount
        FROM orders o
        JOIN payments p ON p.order_id = o.id
        WHERE o.status = 'delivered'
          AND o.staff_courier_id = ${courierId}
          AND p.method = 'cash'
          AND o.id NOT IN (
            SELECT order_id FROM cash_register WHERE order_id IS NOT NULL AND type = 'sale'
          )
        ORDER BY o.delivered_at ASC
      `) as { id: number; paidAmount: number }[];

      let remaining = amount;
      for (const ord of uncollected) {
        if (remaining < ord.paidAmount) break;
        db.insert(schema.cashRegister)
          .values({
            type: "sale",
            amount: ord.paidAmount,
            orderId: ord.id,
            staffId: courierId,
            description: `Siparis #${ord.id} - nakit (kuryeden tahsil)`,
          })
          .run();
        remaining -= ord.paidAmount;
      }
    }
  })();

  const today = new Date().toISOString().split("T")[0];

  const uncollectedAfter = db.all(sql`
    SELECT o.id, p.amount AS paidAmount
    FROM orders o
    JOIN payments p ON p.order_id = o.id
    WHERE o.status = 'delivered'
      AND o.staff_courier_id = ${courierId}
      AND p.method = 'cash'
      AND o.id NOT IN (
        SELECT order_id FROM cash_register WHERE order_id IS NOT NULL AND type = 'sale'
      )
  `) as { paidAmount: number }[];

  const cashFromDeliveries = uncollectedAfter.reduce((s, o) => s + o.paidAmount, 0);

  const todayMovements = db.all(sql`
    SELECT type, amount FROM cash_register
    WHERE staff_id = ${courierId}
      AND type IN ('deposit', 'withdrawal')
      AND date(created_at) = ${today}
  `) as { type: string; amount: number }[];

  const todayDeposits = todayMovements.filter(m => m.type === "deposit").reduce((s, m) => s + m.amount, 0);
  const todayWithdrawals = todayMovements.filter(m => m.type === "withdrawal").reduce((s, m) => s + m.amount, 0);

  const cashOnHand = cashFromDeliveries + todayWithdrawals - todayDeposits;

  return NextResponse.json({ cashOnHand, cashFromDeliveries, todayDeposits, todayWithdrawals });
}
