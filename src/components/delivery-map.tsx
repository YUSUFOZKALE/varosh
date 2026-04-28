"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const KADIRLI_CENTER: [number, number] = [37.3730, 36.0761];
const SHOP_LOCATION: [number, number] = [37.3730, 36.0761];

const KADIRLI_BOUNDS: L.LatLngBoundsExpression = [
  [37.34, 36.04],
  [37.41, 36.12],
];

interface DeliveryPoint {
  id: number;
  customerName: string | null;
  deliveryAddress: string | null;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  total: number;
  status: string;
  selected?: boolean;
}

interface CustomerPoint {
  id: number;
  name: string | null;
  phone: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  orderCount: number;
  totalSpent: number;
}

interface Props {
  deliveries: DeliveryPoint[];
  selectedIds: number[];
  onToggleSelect: (id: number) => void;
  onSetLocation: (orderId: number, lat: number, lng: number) => void;
  routeOrder: number[];
  customers?: CustomerPoint[];
  radiusKm?: number;
}

const STATUS_COLORS: Record<string, string> = {
  new: "#3b82f6",
  preparing: "#f97316",
  ready: "#22c55e",
  on_the_way: "#a855f7",
};

export default function DeliveryMap({ deliveries, selectedIds, onToggleSelect, onSetLocation, routeOrder, customers = [], radiusKm }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const routeRef = useRef<L.Polyline | null>(null);
  const radiusRef = useRef<L.Circle | null>(null);
  const [placingOrderId, setPlacingOrderId] = useState<number | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, {
      maxBounds: KADIRLI_BOUNDS,
      maxBoundsViscosity: 0.9,
      minZoom: 13,
      maxZoom: 18,
    }).setView(KADIRLI_CENTER, 15);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const shopIcon = L.divIcon({
      html: `<div style="background:#f59e0b;width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center"><span style="font-size:12px">&#127965;</span></div>`,
      className: "",
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
    L.marker(SHOP_LOCATION, { icon: shopIcon })
      .addTo(map)
      .bindPopup("<b>Varosh Streetfood</b><br/><small>Kadirli Merkez, Osmaniye</small>");

    markersRef.current = L.layerGroup().addTo(map);
    mapInstance.current = map;

    return () => { map.remove(); mapInstance.current = null; };
  }, []);

  useEffect(() => {
    if (!mapInstance.current || !markersRef.current) return;
    markersRef.current.clearLayers();

    const map = mapInstance.current;

    if (placingOrderId) {
      map.getContainer().style.cursor = "crosshair";
      const handler = (e: L.LeafletMouseEvent) => {
        onSetLocation(placingOrderId, e.latlng.lat, e.latlng.lng);
        setPlacingOrderId(null);
        map.getContainer().style.cursor = "";
        map.off("click", handler);
      };
      map.on("click", handler);
      return () => { map.off("click", handler); map.getContainer().style.cursor = ""; };
    }

    deliveries.forEach((d) => {
      if (!d.deliveryLatitude || !d.deliveryLongitude) return;

      const isSelected = selectedIds.includes(d.id);
      const color = STATUS_COLORS[d.status] || "#888";
      const ring = isSelected ? "border:3px solid #f59e0b;" : "";

      const icon = L.divIcon({
        html: `<div style="background:${color};width:18px;height:18px;border-radius:50%;${ring}box-shadow:0 1px 4px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:white;font-size:9px;font-weight:bold">${d.id}</div>`,
        className: "",
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      const marker = L.marker([d.deliveryLatitude, d.deliveryLongitude], { icon });
      marker.bindPopup(`
        <div style="min-width:140px">
          <b>#${d.id}</b> — ${d.total.toFixed(0)} TL<br/>
          <span style="font-size:12px">${d.customerName || "Isimsiz"}</span><br/>
          <span style="font-size:11px;color:#888">${d.deliveryAddress || ""}</span>
        </div>
      `);
      marker.on("click", () => onToggleSelect(d.id));
      markersRef.current!.addLayer(marker);
    });

    customers.forEach((c) => {
      if (!c.latitude || !c.longitude) return;
      const custIcon = L.divIcon({
        html: `<div style="background:#8b5cf6;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);opacity:0.7"></div>`,
        className: "",
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });
      const m = L.marker([c.latitude, c.longitude], { icon: custIcon });
      m.bindPopup(`
        <div style="min-width:120px">
          <b>${c.name || "Isimsiz"}</b><br/>
          <span style="font-size:11px">${c.phone}</span><br/>
          <span style="font-size:11px;color:#888">${c.address || ""}</span><br/>
          <span style="font-size:10px;color:#a78bfa">${c.orderCount} siparis &middot; ${c.totalSpent.toFixed(0)} TL</span>
        </div>
      `);
      markersRef.current!.addLayer(m);
    });

    if (routeRef.current) {
      routeRef.current.remove();
      routeRef.current = null;
    }

    if (routeOrder.length > 0) {
      const points: [number, number][] = [SHOP_LOCATION];
      for (const id of routeOrder) {
        const d = deliveries.find((x) => x.id === id);
        if (d?.deliveryLatitude && d?.deliveryLongitude) {
          points.push([d.deliveryLatitude, d.deliveryLongitude]);
        }
      }
      points.push(SHOP_LOCATION);

      routeRef.current = L.polyline(points, {
        color: "#f59e0b",
        weight: 3,
        opacity: 0.7,
        dashArray: "8, 6",
      }).addTo(map);
    }
  }, [deliveries, selectedIds, placingOrderId, routeOrder, onSetLocation, onToggleSelect, customers]);

  useEffect(() => {
    if (!mapInstance.current) return;
    if (radiusRef.current) {
      radiusRef.current.remove();
      radiusRef.current = null;
    }
    if (radiusKm && radiusKm > 0) {
      radiusRef.current = L.circle(SHOP_LOCATION, {
        radius: radiusKm * 1000,
        color: "#f59e0b",
        fillColor: "#f59e0b",
        fillOpacity: 0.06,
        weight: 2,
        dashArray: "8, 5",
      }).addTo(mapInstance.current);
    }
  }, [radiusKm]);

  const unlocated = deliveries.filter((d) => !d.deliveryLatitude || !d.deliveryLongitude);

  return (
    <div>
      <div ref={mapRef} className="w-full h-[500px] rounded-xl overflow-hidden border border-border map-dark" />

      {placingOrderId && (
        <div className="bg-amber-600/20 border border-amber-600/30 rounded-xl p-3 mt-3 text-center">
          <p className="text-amber-400 text-sm font-medium">
            Haritaya tiklayarak siparis #{placingOrderId} konumunu isaretle
          </p>
          <button onClick={() => setPlacingOrderId(null)} className="text-xs text-white/40 mt-1 hover:text-white">Iptal</button>
        </div>
      )}

      {unlocated.length > 0 && !placingOrderId && (
        <div className="bg-surface-2 rounded-xl p-3 mt-3">
          <p className="text-xs text-white/40 mb-2">Konumu belirlenmemis siparisler:</p>
          <div className="flex flex-wrap gap-2">
            {unlocated.map((d) => (
              <button
                key={d.id}
                onClick={() => setPlacingOrderId(d.id)}
                className="bg-surface-1 border border-border rounded-lg px-3 py-1.5 text-xs hover:border-amber-500/50 transition-colors"
              >
                #{d.id} — {d.deliveryAddress?.slice(0, 25)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
