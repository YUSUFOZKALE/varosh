"use client";

import { useState, useEffect, useCallback } from "react";

interface CourierDelivery {
  id: number;
  customerName: string | null;
  customerPhone: string | null;
  deliveryAddress: string | null;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  total: number;
  status: string;
  createdAt: string;
  paymentMethod: string | null;
}

const SHOP_DEFAULT: [number, number] = [37.372986, 36.076054];

export default function CourierPage() {
  const [deliveries, setDeliveries] = useState<CourierDelivery[]>([]);
  const [shopLocation, setShopLocation] = useState<[number, number]>(SHOP_DEFAULT);

  const load = useCallback(async () => {
    const [res, settingsRes] = await Promise.all([
      fetch("/api/orders?status=on_the_way"),
      fetch("/api/settings/public"),
    ]);
    if (res.ok) {
      const orders: CourierDelivery[] = await res.json();
      setDeliveries(orders.filter((o) => o.deliveryAddress));
    }
    try {
      const s = await settingsRes.json();
      if (s.shopLatitude && s.shopLongitude) {
        setShopLocation([s.shopLatitude, s.shopLongitude]);
      }
    } catch {}
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, [load]);

  async function markDelivered(orderId: number) {
    await fetch(`/api/orders/${orderId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "delivered" }),
    });
    load();
  }

  function getElapsed(createdAt: string) {
    return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  }

  function openFullRoute() {
    const located = deliveries.filter((d) => d.deliveryLatitude && d.deliveryLongitude);
    if (located.length === 0) return;

    const shop = `${shopLocation[0]},${shopLocation[1]}`;
    const waypoints = located.map((d) => `${d.deliveryLatitude},${d.deliveryLongitude}`).join("|");
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    if (isIOS) {
      const daddr = located.map((d) => `${d.deliveryLatitude},${d.deliveryLongitude}`);
      daddr.push(shop);
      window.location.href = `maps://?saddr=${shop}&daddr=${daddr.join("+to:")}`;
    } else {
      window.location.href = `https://www.google.com/maps/dir/?api=1&origin=${shop}&destination=${shop}&waypoints=${encodeURIComponent(waypoints)}&travelmode=driving`;
    }
  }

  function openSingleNav(d: CourierDelivery) {
    if (!d.deliveryLatitude || !d.deliveryLongitude) return;
    const shop = `${shopLocation[0]},${shopLocation[1]}`;
    const dest = `${d.deliveryLatitude},${d.deliveryLongitude}`;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    if (isIOS) {
      window.location.href = `maps://?saddr=${shop}&daddr=${dest}`;
    } else {
      window.location.href = `https://www.google.com/maps/dir/?api=1&origin=${shop}&destination=${dest}&travelmode=driving`;
    }
  }

  const locatedCount = deliveries.filter((d) => d.deliveryLatitude && d.deliveryLongitude).length;

  return (
    <div className="p-4 space-y-4">
      <div className="text-center mb-4">
        <h1 className="text-xl font-bold">Teslimatlarim</h1>
        <p className="text-white/40 text-sm">{deliveries.length} aktif teslimat</p>
      </div>

      {locatedCount > 1 && (
        <button
          onClick={openFullRoute}
          className="w-full py-4 rounded-2xl bg-accent text-black font-bold text-center text-lg transition-all active:scale-[0.97] shadow-lg shadow-accent/30"
        >
          Tum Guzergahi Ac ({locatedCount} durak + donus)
        </button>
      )}

      {deliveries.map((d) => (
        <div key={d.id} className="bg-surface-1 rounded-2xl p-4 border border-border">
          <div className="flex justify-between items-start mb-3">
            <div>
              <span className="font-bold text-lg">#{d.id}</span>
              <span className="ml-2 text-xs bg-purple-600/20 text-purple-400 px-2 py-0.5 rounded">YOLDA</span>
            </div>
            <span className="text-white/40 text-sm">{getElapsed(d.createdAt)}dk</span>
          </div>

          <div className="space-y-2 mb-4">
            <div>
              <p className="text-xs text-white/40">Musteri</p>
              <p className="font-medium">{d.customerName || "Isimsiz"}</p>
            </div>
            {d.customerPhone && (
              <div>
                <p className="text-xs text-white/40">Telefon</p>
                <a href={`tel:${d.customerPhone}`} className="text-blue-400 font-medium">{d.customerPhone}</a>
              </div>
            )}
            <div>
              <p className="text-xs text-white/40">Adres</p>
              <p className="font-medium">{d.deliveryAddress}</p>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-surface-2 rounded-xl mb-4">
            <span className="text-white/40 text-sm">Tutar</span>
            <span className="text-xl font-bold text-accent">{d.total.toFixed(0)} TL</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {d.deliveryLatitude && d.deliveryLongitude && (
              <button
                onClick={() => openSingleNav(d)}
                className="py-3 rounded-xl bg-amber-600 text-white font-bold text-sm text-center transition-all active:scale-[0.97]"
              >
                YOL TARiFi
              </button>
            )}
            {d.customerPhone && (
              <a
                href={`tel:${d.customerPhone}`}
                className="py-3 rounded-xl bg-blue-600 text-white font-bold text-sm text-center"
              >
                ARA
              </a>
            )}
            <button
              onClick={() => markDelivered(d.id)}
              className={`py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold text-sm transition-all active:scale-[0.97] ${
                !d.deliveryLatitude && !d.customerPhone ? "col-span-3" :
                !d.deliveryLatitude || !d.customerPhone ? "col-span-2" : ""
              }`}
            >
              TESLiM
            </button>
          </div>
        </div>
      ))}

      {deliveries.length === 0 && (
        <div className="text-center py-20">
          <p className="text-white/20 text-lg">Aktif teslimat yok</p>
          <p className="text-white/10 text-sm mt-1">8s yenileme</p>
        </div>
      )}
    </div>
  );
}
