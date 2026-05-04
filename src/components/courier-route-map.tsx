"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { usePublicSettings } from "@/hooks/use-public-settings";

interface RoutePoint {
  id: number;
  customerName: string | null;
  customerPhone: string | null;
  deliveryAddress: string | null;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  status: string;
  total: number;
}

interface Props {
  orders: RoutePoint[];
}

export default function CourierRouteMap({ orders }: Props) {
  const ps = usePublicSettings();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const shopLocation: [number, number] = [ps.shopLatitude, ps.shopLongitude];

  useEffect(() => {
    if (!mapRef.current) return;

    if (mapInstance.current) {
      mapInstance.current.remove();
      mapInstance.current = null;
    }

    const located = orders.filter((o) => o.deliveryLatitude && o.deliveryLongitude);
    if (located.length === 0) return;

    const map = L.map(mapRef.current, {
      zoomControl: true,
      attributionControl: false,
      maxBoundsViscosity: 0.9,
      minZoom: 13,
      maxZoom: 18,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    const shopIcon = L.divIcon({
      html: `<div style="background:#f59e0b;width:26px;height:26px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center">
        <span style="font-size:13px">&#127965;</span>
      </div>`,
      className: "",
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
    L.marker(shopLocation, { icon: shopIcon }).addTo(map)
      .bindPopup(`<b>${ps.businessName}</b><br/><small>${ps.businessAddress}</small>`);

    const routePoints: [number, number][] = [shopLocation];

    located.forEach((order, idx) => {
      const pos: [number, number] = [order.deliveryLatitude!, order.deliveryLongitude!];
      routePoints.push(pos);

      const isDone = order.status === "delivered";
      const isNext = !isDone && idx === located.findIndex((o) => o.status !== "delivered");
      const color = isDone ? "#22c55e" : isNext ? "#f59e0b" : "#94a3b8";
      const size = isNext ? 30 : 22;
      const ring = isNext ? "border:3px solid white;box-shadow:0 0 0 3px #f59e0b,0 2px 8px rgba(0,0,0,0.5);"
        : isDone ? "border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);opacity:0.7;"
        : "border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);";

      const icon = L.divIcon({
        html: `<div style="background:${color};width:${size}px;height:${size}px;border-radius:50%;${ring}display:flex;align-items:center;justify-content:center;color:white;font-size:${isNext ? 14 : 11}px;font-weight:bold">${isDone ? "&#10003;" : idx + 1}</div>`,
        className: "",
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const phoneLink = order.customerPhone
        ? `<br/><a href="tel:${order.customerPhone}" style="color:#3b82f6;font-size:12px">${order.customerPhone}</a>`
        : "";
      const navLink = `<br/><a href="https://www.google.com/maps/dir/?api=1&destination=${order.deliveryLatitude},${order.deliveryLongitude}&travelmode=driving" target="_blank" style="color:#f59e0b;font-size:11px;font-weight:bold">Navigasyon &#8599;</a>`;
      const statusText = isDone
        ? '<span style="color:#22c55e;font-size:10px">&#10003; Teslim Edildi</span>'
        : isNext
        ? '<span style="color:#f59e0b;font-size:10px;font-weight:bold">SIRADAKI</span>'
        : `<span style="color:#94a3b8;font-size:10px">${idx + 1}. sirada</span>`;

      L.marker(pos, { icon }).addTo(map).bindPopup(
        `<div style="min-width:160px;line-height:1.5">
          <b>#${order.id}</b> — ${order.total.toFixed(0)} TL<br/>
          <span style="font-size:13px">${order.customerName || "Isimsiz"}</span>
          ${phoneLink}
          <br/><span style="font-size:11px;color:#888">${order.deliveryAddress || ""}</span>
          <br/>${statusText}
          ${!isDone ? navLink : ""}
        </div>`
      );
    });

    routePoints.push(shopLocation);

    for (let i = 0; i < routePoints.length - 1; i++) {
      const fromOrder = i === 0 ? null : located[i - 1];
      const isDoneSegment = fromOrder?.status === "delivered";

      L.polyline([routePoints[i], routePoints[i + 1]], {
        color: isDoneSegment ? "#22c55e" : "#f59e0b",
        weight: isDoneSegment ? 2 : 3,
        opacity: isDoneSegment ? 0.3 : 0.7,
        dashArray: isDoneSegment ? "4, 8" : "8, 6",
      }).addTo(map);
    }

    const bounds = L.latLngBounds(routePoints);
    map.fitBounds(bounds, { padding: [40, 40] });

    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, [orders]);

  const hasLocated = orders.some((o) => o.deliveryLatitude && o.deliveryLongitude);
  if (!hasLocated) return null;

  return (
    <div ref={mapRef} className="w-full h-[300px] rounded-xl overflow-hidden border border-border" />
  );
}
