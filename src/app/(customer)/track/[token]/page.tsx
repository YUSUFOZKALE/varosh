"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";

interface OrderItem { name: string; quantity: number; totalPrice: number }
interface TrackData {
  id: number;
  status: string;
  customerName: string | null;
  deliveryAddress: string | null;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  courierName: string | null;
  courierPhone: string | null;
  createdAt: string;
  preparedAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  estimatedDeliveryMinutes: number | null;
}

const STEPS = [
  { key: "new", label: "Siparis Alindi", icon: "📋" },
  { key: "preparing", label: "Hazirlaniyor", icon: "👨‍🍳" },
  { key: "ready", label: "Hazir", icon: "✅" },
  { key: "on_the_way", label: "Yolda", icon: "🛵" },
  { key: "delivered", label: "Teslim Edildi", icon: "🎉" },
];

export default function TrackOrderPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<TrackData | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/track/${token}`);
    if (!res.ok) {
      setError("Siparis bulunamadi");
      return;
    }
    setData(await res.json());
  }, [token]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
        <p className="text-red-400 text-lg">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <p className="text-white/40">Yukleniyor...</p>
      </div>
    );
  }

  const currentStepIdx = STEPS.findIndex((s) => s.key === data.status);
  const isCancelled = data.status === "cancelled";

  return (
    <div className="min-h-screen bg-neutral-950 p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center pt-4">
          <img src="/logo.png" alt="VAROSH" className="h-10 mx-auto" />
          <p className="text-white/60 text-sm mt-3">Siparis #{data.id}</p>
        </div>

        {/* Status Steps */}
        {isCancelled ? (
          <div className="bg-red-600/10 border border-red-500/30 rounded-2xl p-6 text-center">
            <p className="text-3xl mb-2">❌</p>
            <p className="text-red-400 font-bold text-lg">Siparis Iptal Edildi</p>
          </div>
        ) : (
          <div className="bg-neutral-900 rounded-2xl p-5">
            <div className="space-y-4">
              {STEPS.map((step, idx) => {
                const isDone = idx <= currentStepIdx;
                const isCurrent = idx === currentStepIdx;
                return (
                  <div key={step.key} className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 ${
                      isDone
                        ? isCurrent ? "bg-amber-500 shadow-lg shadow-amber-500/30" : "bg-green-500/20"
                        : "bg-neutral-800"
                    }`}>
                      {isDone ? step.icon : <span className="text-white/20 text-sm">{idx + 1}</span>}
                    </div>
                    <div className="flex-1">
                      <p className={`font-medium text-sm ${isDone ? "text-white" : "text-white/30"}`}>{step.label}</p>
                      {isCurrent && step.key === "on_the_way" && data.courierName && (
                        <p className="text-xs text-amber-400 mt-0.5">Kurye: {data.courierName}</p>
                      )}
                    </div>
                    {isDone && !isCurrent && <span className="text-green-400 text-sm">✓</span>}
                    {isCurrent && <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span></span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Courier Contact */}
        {data.status === "on_the_way" && data.courierPhone && (
          <a
            href={`tel:${data.courierPhone}`}
            className="block w-full py-3 rounded-xl bg-blue-600 text-white font-bold text-center text-sm"
          >
            Kuryeyi Ara - {data.courierName}
          </a>
        )}

        {/* Order Details */}
        <div className="bg-neutral-900 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white/60 mb-3">Siparis Detayi</h3>
          <div className="space-y-2">
            {data.items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-white/80">{item.quantity}x {item.name}</span>
                <span className="text-white/60">{item.totalPrice.toFixed(0)} TL</span>
              </div>
            ))}
          </div>
          <div className="border-t border-neutral-800 mt-3 pt-3 space-y-1">
            <div className="flex justify-between text-sm text-white/40">
              <span>Ara Toplam</span>
              <span>{data.subtotal.toFixed(0)} TL</span>
            </div>
            {data.deliveryFee > 0 && (
              <div className="flex justify-between text-sm text-white/40">
                <span>Teslimat</span>
                <span>{data.deliveryFee.toFixed(0)} TL</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-white">
              <span>Toplam</span>
              <span className="text-amber-400">{data.total.toFixed(0)} TL</span>
            </div>
          </div>
        </div>

        {/* Delivery Address */}
        {data.deliveryAddress && (
          <div className="bg-neutral-900 rounded-2xl p-4">
            <p className="text-xs text-white/40 mb-1">Teslimat Adresi</p>
            <p className="text-sm text-white/80">{data.deliveryAddress}</p>
          </div>
        )}

        <p className="text-center text-white/20 text-xs pb-4">
          Sayfa otomatik guncellenir &middot; Varosh Streetfood
        </p>
      </div>
    </div>
  );
}
