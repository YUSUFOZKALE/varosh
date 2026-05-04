import { getDb, schema } from "./db";
import { eq } from "drizzle-orm";

export function getSetting(key: string): string | null {
  const db = getDb();
  const row = db.select().from(schema.settings).where(eq(schema.settings.key, key)).get();
  return row?.value ?? null;
}

export function getBusinessName(): string {
  return getSetting("business_name") || "Isletme";
}

export function getBusinessAddress(): string {
  return getSetting("business_address") || "";
}

export function getBusinessPhone(): string {
  return getSetting("business_phone") || "";
}

export function getLogoUrl(): string {
  return getSetting("business_logo_url") || "/images/branding/logo.png";
}

export function getHeaderLogoUrl(): string {
  return getSetting("business_header_logo_url") || "/images/branding/header-logo.png";
}

export function getDeliveryFee(): number {
  if (getSetting("delivery_fee_enabled") !== "true") return 0;
  return parseFloat(getSetting("default_delivery_fee") || "0");
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
