import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { recordPayment } from "@/lib/payment";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });

  const id = parseInt(params.id);
  if (isNaN(id)) return NextResponse.json({ error: "Gecersiz ID" }, { status: 400 });

  const { paymentMethod } = await req.json();
  const result = recordPayment({
    orderId: id,
    method: paymentMethod,
    staffId: session.staffId,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
