import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { asc, desc, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const db = getDb();
  const search = req.nextUrl.searchParams.get("search");
  const sort = req.nextUrl.searchParams.get("sort") || "name";

  let query = db.select().from(schema.users);

  if (search) {
    query = query.where(
      sql`${schema.users.name} LIKE ${'%' + search + '%'} OR ${schema.users.phone} LIKE ${'%' + search + '%'}`
    ) as typeof query;
  }

  const orderMap: Record<string, ReturnType<typeof asc>> = {
    name: asc(schema.users.name),
    spent: desc(schema.users.totalSpent),
    orders: desc(schema.users.orderCount),
    recent: desc(schema.users.lastOrderAt),
  };

  const customers = query.orderBy(orderMap[sort] || asc(schema.users.name)).all();
  return NextResponse.json(customers);
}

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });
  const body = await req.json();
  const { name, phone, address, notes, latitude, longitude } = body;

  if (!phone?.trim()) {
    return NextResponse.json({ error: "Telefon numarasi gerekli" }, { status: 400 });
  }

  const db = getDb();
  const result = db.insert(schema.users)
    .values({
      phone: phone.trim(),
      name: name?.trim() || null,
      address: address?.trim() || null,
      notes: notes?.trim() || null,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
    })
    .returning()
    .get();

  return NextResponse.json(result, { status: 201 });
}
