import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { phone } = await req.json();
  if (!phone?.trim()) {
    return NextResponse.json({ error: "Telefon gerekli" }, { status: 400 });
  }

  const db = getDb();
  const clean = phone.trim().replace(/\s+/g, "");
  const user = db.select().from(schema.users).where(eq(schema.users.phone, clean)).get();

  if (user) {
    const addresses = db.select().from(schema.userAddresses).where(eq(schema.userAddresses.userId, user.id)).all();
    return NextResponse.json({
      exists: true,
      customer: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        address: user.address,
        latitude: user.latitude,
        longitude: user.longitude,
      },
      addresses,
    });
  }

  return NextResponse.json({ exists: false });
}

export async function PUT(req: NextRequest) {
  const { phone, name, address, latitude, longitude } = await req.json();
  if (!phone?.trim() || !name?.trim()) {
    return NextResponse.json({ error: "Telefon ve isim gerekli" }, { status: 400 });
  }

  const db = getDb();
  const clean = phone.trim().replace(/\s+/g, "");

  let user = db.select().from(schema.users).where(eq(schema.users.phone, clean)).get();

  if (user) {
    db.update(schema.users)
      .set({
        name: name.trim(),
        address: address?.trim() || user.address,
        latitude: latitude ?? user.latitude,
        longitude: longitude ?? user.longitude,
      })
      .where(eq(schema.users.id, user.id))
      .run();
    user = db.select().from(schema.users).where(eq(schema.users.id, user.id)).get()!;
  } else {
    user = db.insert(schema.users)
      .values({
        phone: clean,
        name: name.trim(),
        address: address?.trim() || null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
      })
      .returning()
      .get();
  }

  if (address?.trim() && latitude && longitude) {
    const existing = db.select().from(schema.userAddresses)
      .where(eq(schema.userAddresses.userId, user.id))
      .all();

    const duplicate = existing.find(
      (a) => a.address === address.trim() || (Math.abs((a.latitude || 0) - latitude) < 0.001 && Math.abs((a.longitude || 0) - longitude) < 0.001)
    );

    if (!duplicate) {
      db.insert(schema.userAddresses)
        .values({
          userId: user.id,
          label: existing.length === 0 ? "Ev" : `Adres ${existing.length + 1}`,
          address: address.trim(),
          latitude,
          longitude,
        })
        .run();
    }
  }

  const addresses = db.select().from(schema.userAddresses).where(eq(schema.userAddresses.userId, user.id)).all();

  return NextResponse.json({
    customer: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      address: user.address,
      latitude: user.latitude,
      longitude: user.longitude,
    },
    addresses,
  });
}
