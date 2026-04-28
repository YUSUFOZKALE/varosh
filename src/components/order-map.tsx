"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const KADIRLI: [number, number] = [37.3730, 36.0761];

interface Props {
  onPick: (lat: number, lng: number) => void;
  onAddress?: (address: string) => void;
  pickedLat: number | null;
  pickedLng: number | null;
  autoLocate?: boolean;
}

export default function OrderMap({ onPick, onAddress, pickedLat, pickedLng, autoLocate }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ display_name: string; lat: string; lon: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState("");

  useEffect(() => {
    if (!ref.current || mapRef.current) return;

    const map = L.map(ref.current, {
      maxBounds: [[37.30, 35.98], [37.45, 36.16]],
      maxBoundsViscosity: 0.9,
      minZoom: 13,
      maxZoom: 18,
    }).setView(KADIRLI, 15);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OSM",
    }).addTo(map);

    const shopIcon = L.divIcon({
      html: '<div style="background:#f59e0b;width:22px;height:22px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center"><span style="font-size:11px">V</span></div>',
      className: "",
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
    L.marker(KADIRLI, { icon: shopIcon }).addTo(map).bindPopup("<b>Varosh</b>");

    map.getContainer().style.cursor = "crosshair";

    map.on("click", (e: L.LeafletMouseEvent) => {
      pickAndReverse(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;

    if (autoLocate && !pickedLat && navigator.geolocation) {
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          onPick(latitude, longitude);
          if (onAddress) {
            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`, { headers: { "Accept-Language": "tr" } })
              .then(r => r.json())
              .then(data => {
                const a = data.address || {};
                const parts = [a.road, a.neighbourhood || a.suburb, a.town || a.city_district || a.city].filter(Boolean);
                onAddress(parts.join(", ") || data.display_name?.split(",").slice(0, 3).join(",") || "");
              }).catch(() => {});
          }
          map.setView([latitude, longitude], 17);
          setLocating(false);
        },
        () => { setLocating(false); },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }

    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    if (pickedLat && pickedLng) {
      const latlng = L.latLng(pickedLat, pickedLng);
      if (markerRef.current) {
        markerRef.current.setLatLng(latlng);
      } else {
        const icon = L.divIcon({
          html: '<div style="background:#22c55e;width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.5)"></div>',
          className: "",
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        markerRef.current = L.marker(latlng, { icon }).addTo(mapRef.current);
      }
    }
  }, [pickedLat, pickedLng]);

  async function searchLocation() {
    if (!query.trim()) return;
    setSearching(true);
    setResults([]);
    try {
      const q = encodeURIComponent(query.trim() + ", Kadirli, Osmaniye");
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=5&bounded=1&viewbox=35.98,37.45,36.16,37.30`,
        { headers: { "Accept-Language": "tr" } }
      );
      const data = await res.json();
      if (data.length > 0) {
        setResults(data);
      } else {
        const res2 = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query.trim())}&limit=5`,
          { headers: { "Accept-Language": "tr" } }
        );
        setResults(await res2.json());
      }
    } catch { /* ignore */ }
    setSearching(false);
  }

  function selectResult(lat: string, lon: string) {
    const la = parseFloat(lat);
    const ln = parseFloat(lon);
    pickAndReverse(la, ln);
    mapRef.current?.setView([la, ln], 17);
    setResults([]);
    setQuery("");
  }

  async function reverseGeocode(lat: number, lng: number) {
    if (!onAddress) return;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { "Accept-Language": "tr" } }
      );
      const data = await res.json();
      const a = data.address || {};
      const parts = [a.road, a.neighbourhood || a.suburb, a.town || a.city_district || a.city].filter(Boolean);
      onAddress(parts.join(", ") || data.display_name?.split(",").slice(0, 3).join(",") || "");
    } catch { /* ignore */ }
  }

  function pickAndReverse(lat: number, lng: number) {
    onPick(lat, lng);
    reverseGeocode(lat, lng);
  }

  function useMyLocation() {
    if (!navigator.geolocation) { setLocError("Tarayici konum desteklemiyor"); return; }
    setLocating(true);
    setLocError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        pickAndReverse(latitude, longitude);
        mapRef.current?.setView([latitude, longitude], 17);
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        if (err.code === 1) setLocError("Konum izni verilmedi");
        else if (err.code === 2) setLocError("Konum alinamadi");
        else setLocError("Konum zaman asimi");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div>
      {/* Konumumu Kullan */}
      <button
        onClick={useMyLocation}
        disabled={locating}
        className="w-full mb-2 py-3 rounded-xl bg-blue-600 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition-transform disabled:opacity-50"
      >
        {locating ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Konum aliniyor...
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0013 3.06V1h-2v2.06A8.994 8.994 0 003.06 11H1v2h2.06A8.994 8.994 0 0011 20.94V23h2v-2.06A8.994 8.994 0 0020.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" /></svg>
            Konumumu Kullan
          </>
        )}
      </button>
      {locError && <p className="text-xs text-red-400 text-center mb-2">{locError}</p>}

      {/* Arama */}
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && searchLocation()}
          placeholder="Mahalle, sokak veya yer ara..."
          className="flex-1 bg-neutral-800 rounded-xl px-3 py-2 text-sm border border-neutral-700 text-white placeholder:text-white/25 focus:outline-none focus:border-amber-500/50"
        />
        <button
          onClick={searchLocation}
          disabled={searching || !query.trim()}
          className="bg-amber-500 text-black px-3 py-2 rounded-xl text-sm font-bold disabled:opacity-40 shrink-0"
        >
          {searching ? "..." : "Ara"}
        </button>
      </div>

      {/* Arama sonuclari */}
      {results.length > 0 && (
        <div className="bg-neutral-800 rounded-xl border border-neutral-700 mb-2 max-h-[150px] overflow-y-auto">
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => selectResult(r.lat, r.lon)}
              className="w-full text-left px-3 py-2.5 text-xs text-white/70 hover:bg-neutral-700 border-b border-neutral-700/50 last:border-0 transition-colors"
            >
              {r.display_name.length > 80 ? r.display_name.slice(0, 80) + "..." : r.display_name}
            </button>
          ))}
        </div>
      )}

      {/* Harita */}
      <div ref={ref} className="w-full h-[250px] rounded-xl overflow-hidden border border-border map-dark" />
      <p className="text-xs text-white/30 mt-1 text-center">Haritaya dokunarak veya arama yaparak konumunuzu secin</p>
    </div>
  );
}
