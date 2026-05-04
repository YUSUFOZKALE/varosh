"use client";

import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { usePublicSettings } from "@/hooks/use-public-settings";

interface Customer {
  id: number;
  phone: string;
  name: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  orderCount: number;
  totalSpent: number;
  loyaltyTier: string;
}

interface Props {
  customers: Customer[];
  onSelectCustomer?: (c: Customer) => void;
  pickMode?: boolean;
  onPickLocation?: (lat: number, lng: number) => void;
}

const TIER_COLORS: Record<string, string> = {
  bronze: "#b45309",
  silver: "#9ca3af",
  gold: "#eab308",
  vip: "#a855f7",
};

export default function CustomerMap({ customers, onSelectCustomer, pickMode, onPickLocation }: Props) {
  const ps = usePublicSettings();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const pickMarkerRef = useRef<L.Marker | null>(null);
  const shopMarkerRef = useRef<L.Marker | null>(null);

  const handleMapClick = useCallback((e: L.LeafletMouseEvent) => {
    if (!pickMode || !onPickLocation) return;
    onPickLocation(e.latlng.lat, e.latlng.lng);

    if (pickMarkerRef.current) {
      pickMarkerRef.current.setLatLng(e.latlng);
    } else if (mapInstance.current) {
      const icon = L.divIcon({
        html: `<div style="background:#22c55e;width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center"><span style="font-size:11px;color:white">+</span></div>`,
        className: "",
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      pickMarkerRef.current = L.marker(e.latlng, { icon }).addTo(mapInstance.current);
    }
  }, [pickMode, onPickLocation]);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const center: [number, number] = [ps.shopLatitude, ps.shopLongitude];
    const map = L.map(mapRef.current, {
      maxBoundsViscosity: 0.9,
      minZoom: 13,
      maxZoom: 18,
    }).setView(center, 15);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    mapInstance.current = map;

    return () => { map.remove(); mapInstance.current = null; };
  }, []);

  useEffect(() => {
    if (!mapInstance.current) return;
    if (shopMarkerRef.current) shopMarkerRef.current.remove();
    const shopIcon = L.divIcon({
      html: `<div style="background:#f59e0b;width:26px;height:26px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center"><span style="font-size:13px">&#127965;</span></div>`,
      className: "",
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
    shopMarkerRef.current = L.marker([ps.shopLatitude, ps.shopLongitude], { icon: shopIcon })
      .addTo(mapInstance.current)
      .bindPopup(`<b>${ps.businessName}</b><br/><small>${ps.businessAddress}</small>`);
  }, [ps.shopLatitude, ps.shopLongitude, ps.businessName, ps.businessAddress]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    if (pickMode) {
      map.getContainer().style.cursor = "crosshair";
      map.on("click", handleMapClick);
    } else {
      map.getContainer().style.cursor = "";
      map.off("click", handleMapClick);
      if (pickMarkerRef.current) {
        pickMarkerRef.current.remove();
        pickMarkerRef.current = null;
      }
    }

    return () => {
      map.off("click", handleMapClick);
      map.getContainer().style.cursor = "";
    };
  }, [pickMode, handleMapClick]);

  useEffect(() => {
    if (!mapInstance.current || !markersRef.current) return;
    markersRef.current.clearLayers();

    customers.forEach((c) => {
      if (!c.latitude || !c.longitude) return;

      const color = TIER_COLORS[c.loyaltyTier] || "#8b5cf6";
      const size = c.orderCount >= 10 ? 18 : c.orderCount >= 3 ? 14 : 10;

      const icon = L.divIcon({
        html: `<div style="background:${color};width:${size}px;height:${size}px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);cursor:pointer"></div>`,
        className: "",
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([c.latitude, c.longitude], { icon });
      marker.bindPopup(`
        <div style="min-width:150px;line-height:1.6">
          <b style="font-size:14px">${c.name || "Isimsiz"}</b><br/>
          <span style="font-size:12px;color:#666">${c.phone}</span><br/>
          <span style="font-size:11px;color:#888">${c.address || ""}</span><br/>
          <span style="font-size:12px;color:${color};font-weight:bold">${c.loyaltyTier.toUpperCase()}</span>
          <span style="font-size:11px;color:#888"> &middot; ${c.orderCount} siparis &middot; ${c.totalSpent.toFixed(0)} TL</span>
        </div>
      `);
      if (onSelectCustomer) {
        marker.on("click", () => onSelectCustomer(c));
      }
      markersRef.current!.addLayer(marker);
    });
  }, [customers, onSelectCustomer]);

  const located = customers.filter((c) => c.latitude && c.longitude);

  return (
    <div>
      <div ref={mapRef} className="w-full h-[400px] rounded-xl overflow-hidden border border-border map-dark" />
      {pickMode && (
        <div className="bg-green-600/20 border border-green-600/30 rounded-xl p-3 mt-3 text-center">
          <p className="text-green-400 text-sm font-medium">Haritaya tiklayarak musteri konumunu sec</p>
        </div>
      )}
      {!pickMode && (
        <div className="flex items-center gap-4 mt-2 px-1">
          <div className="flex items-center gap-4 text-[11px] text-white/40">
            <span className="flex items-center gap-1"><span style={{background:"#b45309",width:8,height:8,borderRadius:"50%",display:"inline-block"}}></span> Bronze</span>
            <span className="flex items-center gap-1"><span style={{background:"#9ca3af",width:8,height:8,borderRadius:"50%",display:"inline-block"}}></span> Silver</span>
            <span className="flex items-center gap-1"><span style={{background:"#eab308",width:8,height:8,borderRadius:"50%",display:"inline-block"}}></span> Gold</span>
            <span className="flex items-center gap-1"><span style={{background:"#a855f7",width:8,height:8,borderRadius:"50%",display:"inline-block"}}></span> VIP</span>
          </div>
          <span className="text-[11px] text-white/30 ml-auto">{located.length} / {customers.length} konumlu</span>
        </div>
      )}
    </div>
  );
}
