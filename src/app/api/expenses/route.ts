import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq, desc, sql, and, gte, lte } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const db = getDb();
  const date = req.nextUrl.searchParams.get("date");
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");

  const conditions: ReturnType<typeof eq>[] = [];
  if (date) {
    conditions.push(eq(schema.financeEntries.date, date));
  } else {
    if (from) conditions.push(gte(schema.financeEntries.date, from));
    if (to) conditions.push(lte(schema.financeEntries.date, to));
  }

  const entries = conditions.length > 0
    ? db.select().from(schema.financeEntries).where(and(...conditions)).orderBy(desc(schema.financeEntries.createdAt)).all()
    : db.select().from(schema.financeEntries).orderBy(desc(schema.financeEntries.createdAt)).limit(100).all();

  const totals = db.select({
    totalIncome: sql<number>`coalesce(sum(case when type = 'income' then amount else 0 end), 0)`,
    totalExpense: sql<number>`coalesce(sum(case when type = 'expense' then amount else 0 end), 0)`,
  }).from(schema.financeEntries)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .get();

  return NextResponse.json({
    entries,
    totals: {
      income: totals?.totalIncome || 0,
      expense: totals?.totalExpense || 0,
      net: (totals?.totalIncome || 0) - (totals?.totalExpense || 0),
    },
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { type, category, amount, description, date } = body;

  if (!type || !category || !amount) {
    return NextResponse.json({ error: "type, category ve amount gerekli" }, { status: 400 });
  }

  const db = getDb();
  const entry = db.insert(schema.financeEntries)
    .values({
      type,
      category,
      amount: parseFloat(amount),
      description: description || null,
      date: date || new Date().toISOString().split("T")[0],
    })
    .returning()
    .get();

  return NextResponse.json(entry, { status: 201 });
}
