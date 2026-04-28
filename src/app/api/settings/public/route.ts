import { NextResponse } from "next/server";
import { getDeliveryFee, getShopLocation, getMinOrderAmount, getEstimatedDeliveryMinutes, getDeliveryRadiusKm } from "@/lib/settings";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const [lat, lng] = getShopLocation();
  const db = getDb();
  const phoneRow = db.select().from(schema.settings).where(eq(schema.settings.key, "business_phone")).get();

  return NextResponse.json({
    shopLatitude: lat,
    shopLongitude: lng,
    deliveryFee: getDeliveryFee(),
    minOrderAmount: getMinOrderAmount(),
    estimatedDeliveryMinutes: getEstimatedDeliveryMinutes(),
    deliveryRadiusKm: getDeliveryRadiusKm(),
    businessPhone: phoneRow?.value || null,
  });
}
