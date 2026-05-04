import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  db.delete(schema.menuItemOptions)
    .where(eq(schema.menuItemOptions.id, parseInt(params.id)))
    .run();

  return NextResponse.json({ ok: true });
}
