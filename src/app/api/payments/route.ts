import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { sql, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { recordPayment } from "@/lib/payment";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const db = getDb();
  const date = req.nextUrl.searchParams.get("date");

  let query = db.select().from(schema.payments);
  if (date) {
    query = query.where(sql`date(${schema.payments.createdAt}) = ${date}`) as typeof query;
  }
  const payments = query.orderBy(desc(schema.payments.createdAt)).all();
  return NextResponse.json(payments);
}

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });

  const { orderId, amount, method, receivedAmount } = await req.json();

  if (!orderId || !amount || !method) {
    return NextResponse.json({ error: "orderId, amount ve method gerekli" }, { status: 400 });
  }

  const result = recordPayment({
    orderId,
    method,
    amount,
    receivedAmount,
    staffId: session.staffId,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true }, { status: 201 });
}
