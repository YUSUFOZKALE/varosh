import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const options = db
    .select()
    .from(schema.menuItemOptions)
    .orderBy(asc(schema.menuItemOptions.menuItemId), asc(schema.menuItemOptions.groupName))
    .all();

  return NextResponse.json(options);
}
