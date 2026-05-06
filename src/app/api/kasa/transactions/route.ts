import { NextRequest, NextResponse } from "next/server";
import { getDb, getSqliteDb, schema } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });

  const db = getDb();
  const sp = req.nextUrl.searchParams;
  const date = sp.get("date") || new Date().toISOString().split("T")[0];
  const type = sp.get("type");
  const limit = parseInt(sp.get("limit") || "100");

  const transactions = type && type !== "all"
    ? db.all(sql`
        SELECT kt.*, s.name AS createdByName
        FROM kasa_transactions kt
        LEFT JOIN staff s ON s.id = kt.created_by
        WHERE date(kt.created_at) = ${date} AND kt.type = ${type}
        ORDER BY kt.created_at DESC
        LIMIT ${limit}
      `)
    : db.all(sql`
        SELECT kt.*, s.name AS createdByName
        FROM kasa_transactions kt
        LEFT JOIN staff s ON s.id = kt.created_by
        WHERE date(kt.created_at) = ${date}
        ORDER BY kt.created_at DESC
        LIMIT ${limit}
      `);

  const totals = db.all(sql`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'income' AND payment_method = 'cash' THEN amount ELSE 0 END), 0) AS cashIncome,
      COALESCE(SUM(CASE WHEN type = 'income' AND payment_method = 'card' THEN amount ELSE 0 END), 0) AS cardIncome,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS totalExpense,
      COALESCE(SUM(CASE WHEN type = 'trust' AND is_returned = 0 THEN amount ELSE 0 END), 0) AS trustOutstanding,
      COALESCE(SUM(CASE WHEN type = 'staff_payment' THEN amount ELSE 0 END), 0) AS staffPayments
    FROM kasa_transactions
    WHERE date(created_at) = ${date}
  `) as any[];

  return NextResponse.json({
    transactions,
    totals: totals[0] || { cashIncome: 0, cardIncome: 0, totalExpense: 0, trustOutstanding: 0, staffPayments: 0 },
  });
}

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });

  const body = await req.json();
  const { type, amount, paymentMethod, category, description, person, courierId } = body;

  if (!type || !amount || amount <= 0) {
    return NextResponse.json({ error: "type ve amount gerekli" }, { status: 400 });
  }

  if ((type === "trust" || type === "staff_payment") && !person?.trim()) {
    return NextResponse.json({ error: "Kisi adi gerekli" }, { status: 400 });
  }

  const db = getDb();
  const sqlite = getSqliteDb();

  const tx = sqlite.transaction(() => {
    const record = db.insert(schema.kasaTransactions)
      .values({
        type,
        amount,
        paymentMethod: paymentMethod || null,
        category: category || null,
        description: description?.trim() || null,
        person: person?.trim() || null,
        courierId: courierId || null,
        createdBy: session.staffId,
      })
      .returning()
      .get();

    if (paymentMethod === "cash") {
      if (type === "income") {
        db.insert(schema.cashRegister)
          .values({ type: "deposit", amount, staffId: session.staffId, description: `Nakit gelir: ${description || category || ""}` })
          .run();
      } else if (type === "expense") {
        db.insert(schema.cashRegister)
          .values({ type: "withdrawal", amount, staffId: session.staffId, description: `Gider: ${description || category || ""}` })
          .run();
      } else if (type === "trust") {
        db.insert(schema.cashRegister)
          .values({ type: "withdrawal", amount, staffId: session.staffId, description: `Emanet: ${person}` })
          .run();
      } else if (type === "staff_payment") {
        db.insert(schema.cashRegister)
          .values({ type: "withdrawal", amount, staffId: session.staffId, description: `Personel odeme: ${person}` })
          .run();
      }
    }

    return record;
  })();

  return NextResponse.json(tx, { status: 201 });
}
