import { getDb, schema } from "./db";
import { eq } from "drizzle-orm";

function getSetting(key: string): string | null {
  const db = getDb();
  const row = db.select().from(schema.settings).where(eq(schema.settings.key, key)).get();
  return row?.value ?? null;
}

export function getDeliveryFee(): number {
  return parseFloat(getSetting("default_delivery_fee") || "20");
}

export function getShopLocation(): [number, number] {
  const lat = parseFloat(getSetting("shop_latitude") || "37.3730");
  const lng = parseFloat(getSetting("shop_longitude") || "36.0761");
  return [lat, lng];
}

export function getMinOrderAmount(): number {
  return parseFloat(getSetting("min_order_amount") || "100");
}

export function getEstimatedDeliveryMinutes(): number {
  return parseInt(getSetting("estimated_delivery_minutes") || "30");
}

export function getLoyaltyPointsPerTL(): number {
  return parseFloat(getSetting("loyalty_points_per_tl") || "0.1");
}

export function getDeliveryRadiusKm(): number {
  return parseFloat(getSetting("delivery_radius_km") || "5");
}
