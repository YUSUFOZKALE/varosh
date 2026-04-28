import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum yok" }, { status: 401 });
  }
  return NextResponse.json({ name: session.name, role: session.role, staffId: session.staffId });
}
