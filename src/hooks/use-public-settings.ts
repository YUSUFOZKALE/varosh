"use client";

import { useState, useEffect } from "react";

export interface PublicSettings {
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  logoUrl: string;
  headerLogoUrl: string;
  shopLatitude: number;
  shopLongitude: number;
  deliveryFee: number;
  minOrderAmount: number;
  estimatedDeliveryMinutes: number;
  deliveryRadiusKm: number;
}

const defaults: PublicSettings = {
  businessName: "",
  businessAddress: "",
  businessPhone: "",
  logoUrl: "/images/branding/logo.png",
  headerLogoUrl: "/images/branding/header-logo.png",
  shopLatitude: 37.373,
  shopLongitude: 36.0761,
  deliveryFee: 20,
  minOrderAmount: 100,
  estimatedDeliveryMinutes: 30,
  deliveryRadiusKm: 5,
};

let cached: PublicSettings | null = null;
let fetchPromise: Promise<PublicSettings> | null = null;

function doFetch(): Promise<PublicSettings> {
  if (fetchPromise) return fetchPromise;
  const p = fetch("/api/settings/public")
    .then((r) => r.json())
    .then((data: Partial<PublicSettings>) => {
      cached = { ...defaults, ...data };
      fetchPromise = null;
      return cached;
    })
    .catch(() => {
      fetchPromise = null;
      return defaults;
    });
  fetchPromise = p;
  return p;
}

export function usePublicSettings(): PublicSettings {
  const [settings, setSettings] = useState<PublicSettings>(cached || defaults);

  useEffect(() => {
    if (cached) {
      setSettings(cached);
      return;
    }
    doFetch().then(setSettings);
  }, []);

  return settings;
}

export function invalidatePublicSettings() {
  cached = null;
  fetchPromise = null;
}
