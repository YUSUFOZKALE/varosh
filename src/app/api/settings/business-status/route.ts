import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const current = db.select()
    .from(schema.businessStatus)
    .orderBy(desc(schema.businessStatus.createdAt))
    .limit(1)
    .get();
  return NextResponse.json(current || { status: "closed" });
}

export async function PUT(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });
  const { status, reason } = await req.json();
  const db = getDb();

  const result = db.insert(schema.businessStatus)
    .values({ status, reason: reason || null, changedBy: "admin" })
    .returning()
    .get();

  return NextResponse.json(result);
}
