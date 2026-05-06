import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });
  const db = getDb();
  db.delete(schema.menuItemOptions)
    .where(eq(schema.menuItemOptions.id, parseInt(params.id)))
    .run();

  return NextResponse.json({ ok: true });
}
