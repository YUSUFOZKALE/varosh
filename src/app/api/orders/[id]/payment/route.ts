import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { recordPayment } from "@/lib/payment";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });

  const id = parseInt(params.id);
  if (isNaN(id)) return NextResponse.json({ error: "Gecersiz ID" }, { status: 400 });

  const body = await req.json();
  const { paymentMethod, amount, splitPayment } = body;
  const result = recordPayment({
    orderId: id,
    method: paymentMethod,
    amount: splitPayment && amount ? amount : undefined,
    staffId: session.staffId,
    splitPayment: !!splitPayment,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, totalPaid: result.totalPaid, remaining: result.remaining });
}
