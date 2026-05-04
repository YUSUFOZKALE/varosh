import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  const options = db
    .select()
    .from(schema.menuItemOptions)
    .where(eq(schema.menuItemOptions.menuItemId, parseInt(params.id)))
    .orderBy(asc(schema.menuItemOptions.groupName), asc(schema.menuItemOptions.id))
    .all();

  return NextResponse.json(options);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  const body = await req.json();
  const menuItemId = parseInt(params.id);

  const result = db
    .insert(schema.menuItemOptions)
    .values({
      menuItemId,
      groupName: body.groupName,
      optionName: body.optionName,
      priceModifier: body.priceModifier ?? 0,
      isDefault: body.isDefault ?? false,
    })
    .returning()
    .get();

  return NextResponse.json(result);
}
