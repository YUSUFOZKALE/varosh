import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });
  const body = await req.json();
  const { phone, name, address, latitude, longitude } = body;

  if (!phone?.trim()) {
    return NextResponse.json({ error: "Telefon numarasi gerekli" }, { status: 400 });
  }

  const db = getDb();

  let user = db.select().from(schema.users)
    .where(eq(schema.users.phone, phone.trim()))
    .get();

  if (!user) {
    user = db.insert(schema.users)
      .values({
        phone: phone.trim(),
        name: name?.trim() || null,
        address: address?.trim() || null,
        latitude: latitude || null,
        longitude: longitude || null,
      })
      .returning()
      .get();
  } else if (name || address || latitude) {
    db.update(schema.users)
      .set({
        ...(name ? { name: name.trim() } : {}),
        ...(address ? { address: address.trim() } : {}),
        ...(latitude ? { latitude } : {}),
        ...(longitude ? { longitude } : {}),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.users.id, user.id))
      .run();
  }

  const token = crypto.randomBytes(8).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const link = db.insert(schema.menuLinks)
    .values({
      token,
      userId: user.id,
      phone: phone.trim(),
      name: name?.trim() || user.name || null,
      address: address?.trim() || user.address || null,
      latitude: latitude || user.latitude || null,
      longitude: longitude || user.longitude || null,
      expiresAt,
    })
    .returning()
    .get();

  return NextResponse.json({ ...link, user }, { status: 201 });
}

export async function GET() {
  const db = getDb();
  const links = db.select().from(schema.menuLinks)
    .orderBy(schema.menuLinks.id)
    .all();
  return NextResponse.json(links);
}
