import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { sql, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const db = getDb();
  const period = parseInt(req.nextUrl.searchParams.get("period") || "30");

  const revenue = db.select({
    total: sql<number>`COALESCE(SUM(CASE WHEN ${schema.orders.status} != 'cancelled' THEN ${schema.orders.total} ELSE 0 END), 0)`,
    collected: sql<number>`COALESCE(SUM(CASE WHEN ${schema.orders.status} != 'cancelled' AND ${schema.orders.paymentMethod} IS NOT NULL THEN ${schema.orders.total} ELSE 0 END), 0)`,
  })
    .from(schema.orders)
    .where(sql`date(${schema.orders.createdAt}) >= date('now','localtime','-${sql.raw(String(period))} days')`)
    .get();

  const prevRevenue = db.select({
    total: sql<number>`COALESCE(SUM(CASE WHEN ${schema.orders.status} != 'cancelled' THEN ${schema.orders.total} ELSE 0 END), 0)`,
  })
    .from(schema.orders)
    .where(sql`date(${schema.orders.createdAt}) >= date('now','localtime','-${sql.raw(String(period * 2))} days') AND date(${schema.orders.createdAt}) < date('now','localtime','-${sql.raw(String(period))} days')`)
    .get();

  const expenses = db.select({
    total: sql<number>`COALESCE(SUM(${schema.financeEntries.amount}), 0)`,
  })
    .from(schema.financeEntries)
    .where(sql`${schema.financeEntries.type} = 'expense' AND ${schema.financeEntries.date} >= date('now','localtime','-${sql.raw(String(period))} days')`)
    .get();

  const prevExpenses = db.select({
    total: sql<number>`COALESCE(SUM(${schema.financeEntries.amount}), 0)`,
  })
    .from(schema.financeEntries)
    .where(sql`${schema.financeEntries.type} = 'expense' AND ${schema.financeEntries.date} >= date('now','localtime','-${sql.raw(String(period * 2))} days') AND ${schema.financeEntries.date} < date('now','localtime','-${sql.raw(String(period))} days')`)
    .get();

  const expensesByCategory = db.select({
    category: schema.financeEntries.category,
    total: sql<number>`COALESCE(SUM(${schema.financeEntries.amount}), 0)`,
    count: sql<number>`COUNT(*)`,
  })
    .from(schema.financeEntries)
    .where(sql`${schema.financeEntries.type} = 'expense' AND ${schema.financeEntries.date} >= date('now','localtime','-${sql.raw(String(period))} days')`)
    .groupBy(schema.financeEntries.category)
    .orderBy(desc(sql`COALESCE(SUM(${schema.financeEntries.amount}), 0)`))
    .all();

  const dailyRevenue = db.select({
    date: sql<string>`date(${schema.orders.createdAt})`.as("date"),
    revenue: sql<number>`COALESCE(SUM(CASE WHEN ${schema.orders.status} != 'cancelled' THEN ${schema.orders.total} ELSE 0 END), 0)`,
  })
    .from(schema.orders)
    .where(sql`date(${schema.orders.createdAt}) >= date('now','localtime','-${sql.raw(String(period))} days')`)
    .groupBy(sql`date(${schema.orders.createdAt})`)
    .orderBy(sql`date(${schema.orders.createdAt})`)
    .all();

  const dailyExpense = db.select({
    date: schema.financeEntries.date,
    expense: sql<number>`COALESCE(SUM(${schema.financeEntries.amount}), 0)`,
  })
    .from(schema.financeEntries)
    .where(sql`${schema.financeEntries.type} = 'expense' AND ${schema.financeEntries.date} >= date('now','localtime','-${sql.raw(String(period))} days')`)
    .groupBy(schema.financeEntries.date)
    .orderBy(schema.financeEntries.date)
    .all();

  const dailyMap = new Map<string, { revenue: number; expense: number }>();
  for (const r of dailyRevenue) dailyMap.set(r.date, { revenue: r.revenue, expense: 0 });
  for (const e of dailyExpense) {
    const existing = dailyMap.get(e.date);
    if (existing) existing.expense = e.expense;
    else dailyMap.set(e.date, { revenue: 0, expense: e.expense });
  }
  const daily = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({ date, revenue: data.revenue, expense: data.expense, profit: data.revenue - data.expense }));

  const totalRevenue = revenue?.total || 0;
  const totalExpense = expenses?.total || 0;
  const profit = totalRevenue - totalExpense;
  const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  const g = (cur: number, prev: number) => prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0;

  return NextResponse.json({
    revenue: totalRevenue,
    collected: revenue?.collected || 0,
    expenses: { total: totalExpense, byCategory: expensesByCategory },
    profit,
    margin,
    growth: {
      revenue: g(totalRevenue, prevRevenue?.total || 0),
      expense: g(totalExpense, prevExpenses?.total || 0),
      profit: g(profit, (prevRevenue?.total || 0) - (prevExpenses?.total || 0)),
    },
    daily,
    period,
  });
}
