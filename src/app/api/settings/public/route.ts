import { NextResponse } from "next/server";
import {
  getDeliveryFee,
  getShopLocation,
  getMinOrderAmount,
  getEstimatedDeliveryMinutes,
  getDeliveryRadiusKm,
  getBusinessName,
  getBusinessAddress,
  getBusinessPhone,
  getLogoUrl,
  getHeaderLogoUrl,
} from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const [lat, lng] = getShopLocation();

  return NextResponse.json({
    businessName: getBusinessName(),
    businessAddress: getBusinessAddress(),
    businessPhone: getBusinessPhone(),
    logoUrl: getLogoUrl(),
    headerLogoUrl: getHeaderLogoUrl(),
    shopLatitude: lat,
    shopLongitude: lng,
    deliveryFee: getDeliveryFee(),
    minOrderAmount: getMinOrderAmount(),
    estimatedDeliveryMinutes: getEstimatedDeliveryMinutes(),
    deliveryRadiusKm: getDeliveryRadiusKm(),
    siteUrl: process.env.SITE_URL || "",
  });
}
