import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });

  const db = getDb();
  const date = req.nextUrl.searchParams.get("date") || new Date().toISOString().split("T")[0];

  const existing = db.select().from(schema.dailySummaries).where(eq(schema.dailySummaries.date, date)).get();

  const orderIncome = db.all(sql`
    SELECT
      COALESCE(SUM(CASE WHEN p.method = 'cash' THEN p.amount ELSE 0 END), 0) AS cashIncome,
      COALESCE(SUM(CASE WHEN p.method = 'card' THEN p.amount ELSE 0 END), 0) AS cardIncome,
      COALESCE(SUM(p.amount), 0) AS totalIncome
    FROM payments p
    WHERE date(p.created_at) = ${date}
  `) as any[];

  const kasaTotals = db.all(sql`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'income' AND payment_method = 'cash' THEN amount ELSE 0 END), 0) AS extraCashIncome,
      COALESCE(SUM(CASE WHEN type = 'income' AND payment_method = 'card' THEN amount ELSE 0 END), 0) AS extraCardIncome,
      COALESCE(SUM(CASE WHEN type = 'expense' AND payment_method = 'cash' THEN amount ELSE 0 END), 0) AS cashExpense,
      COALESCE(SUM(CASE WHEN type = 'expense' AND payment_method = 'card' THEN amount ELSE 0 END), 0) AS cardExpense,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS totalExpense,
      COALESCE(SUM(CASE WHEN type = 'trust' AND is_returned = 0 THEN amount ELSE 0 END), 0) AS trustGiven,
      COALESCE(SUM(CASE WHEN type = 'trust' AND is_returned = 1 THEN amount ELSE 0 END), 0) AS trustReturned,
      COALESCE(SUM(CASE WHEN type = 'staff_payment' THEN amount ELSE 0 END), 0) AS staffPayments
    FROM kasa_transactions
    WHERE date(created_at) = ${date}
  `) as any[];

  const courierCollected = db.all(sql`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM cash_register
    WHERE type = 'sale' AND description LIKE '%kuryeden tahsil%' AND date(created_at) = ${date}
  `) as any[];

  const openingEntry = db.all(sql`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM cash_register
    WHERE type = 'opening' AND date(created_at) = ${date}
  `) as any[];

  const oi = orderIncome[0] || { cashIncome: 0, cardIncome: 0, totalIncome: 0 };
  const kt = kasaTotals[0] || { extraCashIncome: 0, extraCardIncome: 0, cashExpense: 0, cardExpense: 0, totalExpense: 0, trustGiven: 0, trustReturned: 0, staffPayments: 0 };
  const cc = courierCollected[0]?.total || 0;
  const opening = openingEntry[0]?.total || 0;

  const cashIncome = oi.cashIncome + kt.extraCashIncome;
  const cardIncome = oi.cardIncome + kt.extraCardIncome;
  const totalExpense = kt.totalExpense;
  const cashExpenseTotal = kt.cashExpense + kt.staffPayments + kt.trustGiven - kt.trustReturned;
  const netCashBalance = opening + cashIncome - cashExpenseTotal;
  const netBalance = cashIncome + cardIncome - totalExpense - kt.staffPayments - kt.trustGiven + kt.trustReturned;

  const orderCount = db.all(sql`
    SELECT COUNT(*) AS cnt FROM orders WHERE date(created_at) = ${date} AND status != 'cancelled'
  `) as any[];

  const courierSummary = db.all(sql`
    SELECT
      s.id AS courierId,
      s.name AS courierName,
      COALESCE(SUM(CASE WHEN p.method = 'cash' THEN p.amount ELSE 0 END), 0) AS cashCollected,
      COALESCE(SUM(CASE WHEN p.method = 'card' THEN p.amount ELSE 0 END), 0) AS cardCollected,
      COUNT(o.id) AS deliveryCount
    FROM orders o
    JOIN payments p ON p.order_id = o.id
    JOIN staff s ON s.id = o.staff_courier_id
    WHERE o.status = 'delivered'
      AND o.staff_courier_id IS NOT NULL
      AND date(o.delivered_at) = ${date}
    GROUP BY s.id, s.name
  `) as any[];

  const courierDeposits = db.all(sql`
    SELECT
      s.id AS courierId,
      s.name AS courierName,
      COALESCE(SUM(CASE WHEN cr.type = 'deposit' THEN cr.amount ELSE 0 END), 0) AS deposited,
      COALESCE(SUM(CASE WHEN cr.type = 'withdrawal' THEN cr.amount ELSE 0 END), 0) AS withdrawn
    FROM cash_register cr
    JOIN staff s ON s.id = cr.staff_id
    WHERE cr.type IN ('deposit', 'withdrawal')
      AND date(cr.created_at) = ${date}
    GROUP BY s.id, s.name
  `) as any[];

  const depositMap = new Map(courierDeposits.map((d: any) => [d.courierId, d]));
  const couriers = courierSummary.map((c: any) => {
    const dep = depositMap.get(c.courierId) || { deposited: 0, withdrawn: 0 };
    return {
      courierId: c.courierId,
      name: c.courierName,
      deliveryCount: c.deliveryCount,
      cashCollected: c.cashCollected,
      cardCollected: c.cardCollected,
      deposited: dep.deposited,
      withdrawn: dep.withdrawn,
      cashOnHand: c.cashCollected + dep.withdrawn - dep.deposited,
    };
  });

  const courierCashOnHand = couriers.reduce((sum: number, c: any) => sum + c.cashOnHand, 0);

  return NextResponse.json({
    date,
    isClosed: existing?.isClosed || false,
    closedBy: existing?.closedBy || null,
    notes: existing?.notes || null,
    cashIncome,
    cardIncome,
    totalExpense,
    staffPayments: kt.staffPayments,
    trustGiven: kt.trustGiven,
    trustReturned: kt.trustReturned,
    courierCashCollected: cc,
    openingCash: opening,
    closingCash: existing?.closingCash ?? null,
    netBalance,
    netCashBalance,
    orderCount: orderCount[0]?.cnt || 0,
    courierCashOnHand,
    couriers,
  });
}
