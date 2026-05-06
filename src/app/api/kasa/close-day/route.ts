import { NextRequest, NextResponse } from "next/server";
import { getDb, getSqliteDb, schema } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { eq, sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });
  if (session.role !== "owner" && session.role !== "cashier") {
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  }

  const { date, closingCash, notes } = await req.json();
  const targetDate = date || new Date().toISOString().split("T")[0];
  const db = getDb();

  const oi = db.all(sql`
    SELECT
      COALESCE(SUM(CASE WHEN method = 'cash' THEN amount ELSE 0 END), 0) AS cashIncome,
      COALESCE(SUM(CASE WHEN method = 'card' THEN amount ELSE 0 END), 0) AS cardIncome
    FROM payments WHERE date(created_at) = ${targetDate}
  `) as any[];

  const kt = db.all(sql`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'income' AND payment_method = 'cash' THEN amount ELSE 0 END), 0) AS extraCash,
      COALESCE(SUM(CASE WHEN type = 'income' AND payment_method = 'card' THEN amount ELSE 0 END), 0) AS extraCard,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS totalExpense,
      COALESCE(SUM(CASE WHEN type = 'trust' AND is_returned = 0 THEN amount ELSE 0 END), 0) AS trustGiven,
      COALESCE(SUM(CASE WHEN type = 'trust' AND is_returned = 1 THEN amount ELSE 0 END), 0) AS trustReturned,
      COALESCE(SUM(CASE WHEN type = 'staff_payment' THEN amount ELSE 0 END), 0) AS staffPayments
    FROM kasa_transactions WHERE date(created_at) = ${targetDate}
  `) as any[];

  const cc = db.all(sql`
    SELECT COALESCE(SUM(amount), 0) AS total FROM cash_register
    WHERE type = 'sale' AND description LIKE '%kuryeden tahsil%' AND date(created_at) = ${targetDate}
  `) as any[];

  const op = db.all(sql`
    SELECT COALESCE(SUM(amount), 0) AS total FROM cash_register
    WHERE type = 'opening' AND date(created_at) = ${targetDate}
  `) as any[];

  const o = oi[0] || { cashIncome: 0, cardIncome: 0 };
  const k = kt[0] || { extraCash: 0, extraCard: 0, totalExpense: 0, trustGiven: 0, trustReturned: 0, staffPayments: 0 };

  const cashIncome = o.cashIncome + k.extraCash;
  const cardIncome = o.cardIncome + k.extraCard;
  const netBalance = cashIncome + cardIncome - k.totalExpense - k.staffPayments - k.trustGiven + k.trustReturned;

  const existing = db.select().from(schema.dailySummaries).where(eq(schema.dailySummaries.date, targetDate)).get();

  const values = {
    date: targetDate,
    cashIncome,
    cardIncome,
    totalExpense: k.totalExpense,
    netBalance,
    courierCashCollected: cc[0]?.total || 0,
    trustGiven: k.trustGiven,
    trustReturned: k.trustReturned,
    staffPayments: k.staffPayments,
    openingCash: op[0]?.total || 0,
    closingCash: closingCash ?? null,
    isClosed: true,
    closedBy: session.staffId,
    notes: notes?.trim() || null,
  };

  const sqlite = getSqliteDb();
  sqlite.transaction(() => {
    if (existing) {
      db.update(schema.dailySummaries)
        .set(values)
        .where(eq(schema.dailySummaries.id, existing.id))
        .run();
    } else {
      db.insert(schema.dailySummaries).values(values).run();
    }

    if (closingCash != null) {
      db.run(sql`DELETE FROM cash_register WHERE type = 'closing' AND description LIKE ${'%' + targetDate + '%'}`);
      db.insert(schema.cashRegister)
        .values({
          type: "closing",
          amount: closingCash,
          staffId: session.staffId,
          description: `Gun sonu kasa: ${targetDate}`,
        })
        .run();
    }
  })();

  return NextResponse.json({ ok: true, summary: values });
}
