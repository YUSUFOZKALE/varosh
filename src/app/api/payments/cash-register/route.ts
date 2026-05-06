import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { desc, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const db = getDb();
  const date = req.nextUrl.searchParams.get("date") || new Date().toISOString().split("T")[0];

  const movements = db.select()
    .from(schema.cashRegister)
    .where(sql`date(${schema.cashRegister.createdAt}) = ${date}`)
    .orderBy(desc(schema.cashRegister.createdAt))
    .all();

  const totals = {
    sales: 0,
    refunds: 0,
    deposits: 0,
    withdrawals: 0,
    opening: 0,
  };

  for (const m of movements) {
    if (m.type === "sale") totals.sales += m.amount;
    else if (m.type === "refund") totals.refunds += m.amount;
    else if (m.type === "deposit") totals.deposits += m.amount;
    else if (m.type === "withdrawal") totals.withdrawals += m.amount;
    else if (m.type === "opening") totals.opening += m.amount;
  }

  const balance = totals.opening + totals.sales + totals.deposits - totals.refunds - totals.withdrawals;

  return NextResponse.json({ movements, totals, balance, date });
}

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });
  const { type, amount, description } = await req.json();
  const db = getDb();

  const entry = db.insert(schema.cashRegister)
    .values({ type, amount, description })
    .returning()
    .get();

  return NextResponse.json(entry, { status: 201 });
}
