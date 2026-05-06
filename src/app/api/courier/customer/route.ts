import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get("phone");
  const orderId = req.nextUrl.searchParams.get("orderId");

  const db = getDb();

  if (orderId) {
    const order = db.select().from(schema.orders).where(eq(schema.orders.id, parseInt(orderId))).get();
    if (!order) return NextResponse.json({ error: "Siparis bulunamadi" }, { status: 404 });

    let user = null;
    let addresses: any[] = [];

    if (order.customerPhone) {
      const clean = order.customerPhone.trim().replace(/\s+/g, "");
      user = db.select().from(schema.users).where(eq(schema.users.phone, clean)).get();
      if (user) {
        addresses = db.select().from(schema.userAddresses).where(eq(schema.userAddresses.userId, user.id)).all();
      }
    }

    return NextResponse.json({
      order: {
        id: order.id,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        deliveryAddress: order.deliveryAddress,
        deliveryLatitude: order.deliveryLatitude,
        deliveryLongitude: order.deliveryLongitude,
      },
      customer: user ? {
        id: user.id,
        name: user.name,
        phone: user.phone,
        address: user.address,
        latitude: user.latitude,
        longitude: user.longitude,
      } : null,
      addresses,
    });
  }

  if (phone) {
    const clean = phone.trim().replace(/\s+/g, "");
    const user = db.select().from(schema.users).where(eq(schema.users.phone, clean)).get();
    if (!user) return NextResponse.json({ customer: null, addresses: [] });
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

  return NextResponse.json({ error: "phone or orderId required" }, { status: 400 });
}

export async function PUT(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });
  const body = await req.json();
  const { orderId, name, phone, addresses: addrList } = body;

  if (!phone?.trim()) {
    return NextResponse.json({ error: "Telefon gerekli" }, { status: 400 });
  }

  const db = getDb();
  const clean = phone.trim().replace(/\s+/g, "");

  let user = db.select().from(schema.users).where(eq(schema.users.phone, clean)).get();

  if (user) {
    db.update(schema.users)
      .set({
        name: name?.trim() || user.name,
        address: addrList?.[0]?.address?.trim() || user.address,
        latitude: addrList?.[0]?.latitude ?? user.latitude,
        longitude: addrList?.[0]?.longitude ?? user.longitude,
      })
      .where(eq(schema.users.id, user.id))
      .run();
    user = db.select().from(schema.users).where(eq(schema.users.id, user.id)).get()!;
  } else {
    user = db.insert(schema.users)
      .values({
        phone: clean,
        name: name?.trim() || null,
        address: addrList?.[0]?.address?.trim() || null,
        latitude: addrList?.[0]?.latitude ?? null,
        longitude: addrList?.[0]?.longitude ?? null,
      })
      .returning()
      .get();
  }

  if (addrList && Array.isArray(addrList)) {
    const existingAddrs = db.select().from(schema.userAddresses).where(eq(schema.userAddresses.userId, user.id)).all();

    for (let i = 0; i < Math.min(addrList.length, 2); i++) {
      const addr = addrList[i];
      if (!addr.address?.trim()) continue;

      if (existingAddrs[i]) {
        db.update(schema.userAddresses)
          .set({
            label: addr.label || (i === 0 ? "Adres 1" : "Adres 2"),
            address: addr.address.trim(),
            latitude: addr.latitude ?? null,
            longitude: addr.longitude ?? null,
            isVerifiedByCourier: true,
          })
          .where(eq(schema.userAddresses.id, existingAddrs[i].id))
          .run();
      } else {
        db.insert(schema.userAddresses)
          .values({
            userId: user.id,
            label: addr.label || (i === 0 ? "Adres 1" : "Adres 2"),
            address: addr.address.trim(),
            latitude: addr.latitude ?? null,
            longitude: addr.longitude ?? null,
            isVerifiedByCourier: true,
          })
          .run();
      }
    }
  }

  if (orderId && addrList) {
    const selectedIdx = body.selectedAddressIndex ?? 0;
    const selected = addrList[selectedIdx];
    if (selected?.address?.trim()) {
      db.update(schema.orders)
        .set({
          customerName: name?.trim() || undefined,
          deliveryAddress: selected.address.trim(),
          deliveryLatitude: selected.latitude ?? null,
          deliveryLongitude: selected.longitude ?? null,
        })
        .where(eq(schema.orders.id, orderId))
        .run();
    }
  }

  const finalAddresses = db.select().from(schema.userAddresses).where(eq(schema.userAddresses.userId, user.id)).all();

  return NextResponse.json({
    customer: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      address: user.address,
      latitude: user.latitude,
      longitude: user.longitude,
    },
    addresses: finalAddresses,
  });
}
