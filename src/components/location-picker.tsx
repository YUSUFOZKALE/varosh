"use client";

import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";


interface Props {
  latitude: number;
  longitude: number;
  onLocationChange: (lat: number, lng: number) => void;
}

export default function LocationPicker({ latitude, longitude, onLocationChange }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onLocationChangeRef = useRef(onLocationChange);
  onLocationChangeRef.current = onLocationChange;

  const handleClick = useCallback((e: L.LeafletMouseEvent) => {
    const { lat, lng } = e.latlng;
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    }
    onLocationChangeRef.current(lat, lng);
  }, []);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, {
      maxBoundsViscosity: 0.9,
      minZoom: 13,
      maxZoom: 18,
    }).setView([latitude, longitude], 16);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const icon = L.divIcon({
      html: `<div style="background:#f59e0b;width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center"><span style="font-size:14px">&#127965;</span></div>`,
      className: "",
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    markerRef.current = L.marker([latitude, longitude], { icon, draggable: true }).addTo(map);

    markerRef.current.on("dragend", () => {
      const pos = markerRef.current!.getLatLng();
      onLocationChangeRef.current(pos.lat, pos.lng);
    });

    map.on("click", handleClick);
    map.getContainer().style.cursor = "crosshair";

    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  useEffect(() => {
    if (markerRef.current) {
      const pos = markerRef.current.getLatLng();
      if (Math.abs(pos.lat - latitude) > 0.00001 || Math.abs(pos.lng - longitude) > 0.00001) {
        markerRef.current.setLatLng([latitude, longitude]);
        mapInstance.current?.panTo([latitude, longitude]);
      }
    }
  }, [latitude, longitude]);

  return (
    <div>
      <div ref={mapRef} className="w-full h-[300px] rounded-xl overflow-hidden border border-border map-dark" />
      <p className="text-[11px] text-white/30 mt-1">Haritaya tikla veya pin&apos;i surukle</p>
    </div>
  );
}
