"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";

interface BatchOrder {
  id: number;
  customerName: string | null;
  customerPhone: string | null;
  deliveryAddress: string | null;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  total: number;
  status: string;
}

const SHOP_DEFAULT: [number, number] = [37.372986, 36.076054];

export default function CourierBatchPage() {
  const { token } = useParams<{ token: string }>();
  const [orders, setOrders] = useState<BatchOrder[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [shopLocation, setShopLocation] = useState<[number, number]>(SHOP_DEFAULT);
  const [paymentModal, setPaymentModal] = useState<BatchOrder | null>(null);

  const load = useCallback(async () => {
    const [res, settingsRes] = await Promise.all([
      fetch(`/api/delivery/batch?token=${token}`),
      fetch("/api/settings/public"),
    ]);
    if (!res.ok) {
      setError("Gecersiz veya suresi dolmus link");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setOrders(data.orders);
    try {
      const s = await settingsRes.json();
      if (s.shopLatitude && s.shopLongitude) {
        setShopLocation([s.shopLatitude, s.shopLongitude]);
      }
    } catch {}
    setLoading(false);
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function markDelivered(orderId: number, paymentMethod: string) {
    await fetch(`/api/orders/${orderId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "delivered", paymentMethod }),
    });
    setPaymentModal(null);
    load();
  }

  function openFullRoute() {
    const located = orders
      .filter((o) => o.status !== "delivered" && o.deliveryLatitude && o.deliveryLongitude);
    if (located.length === 0) return;

    const shop = `${shopLocation[0]},${shopLocation[1]}`;
    const waypoints = located.map((o) => `${o.deliveryLatitude},${o.deliveryLongitude}`).join("|");

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    if (isIOS) {
      const daddr = located.map((o) => `${o.deliveryLatitude},${o.deliveryLongitude}`);
      daddr.push(shop);
      window.location.href = `maps://?saddr=${shop}&daddr=${daddr.join("+to:")}`;
    } else {
      window.location.href = `https://www.google.com/maps/dir/?api=1&origin=${shop}&destination=${shop}&waypoints=${encodeURIComponent(waypoints)}&travelmode=driving`;
    }
  }

  function openSingleNav(order: BatchOrder) {
    if (!order.deliveryLatitude || !order.deliveryLongitude) return;
    const shop = `${shopLocation[0]},${shopLocation[1]}`;
    const dest = `${order.deliveryLatitude},${order.deliveryLongitude}`;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    if (isIOS) {
      window.location.href = `maps://?saddr=${shop}&daddr=${dest}`;
    } else {
      window.location.href = `https://www.google.com/maps/dir/?api=1&origin=${shop}&destination=${dest}&travelmode=driving`;
    }
  }

  if (loading) {
    return (
      <div className="p-4 text-center py-20">
        <p className="text-white/40">Yukleniyor...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center py-20">
        <p className="text-red-400 text-lg">{error}</p>
      </div>
    );
  }

  const active = orders.filter((o) => o.status !== "delivered");
  const delivered = orders.filter((o) => o.status === "delivered");
  const current = active[0];
  const locatedActive = active.filter((o) => o.deliveryLatitude && o.deliveryLongitude);

  return (
    <div className="p-4 space-y-4">
      <div className="text-center mb-4">
        <h1 className="text-xl font-bold">Toplu Teslimat</h1>
        <p className="text-white/40 text-sm">
          {active.length} kalan / {orders.length} toplam
        </p>
      </div>

      {locatedActive.length > 0 && (
        <button
          onClick={openFullRoute}
          className="w-full py-4 rounded-2xl bg-accent text-black font-bold text-center text-lg transition-all active:scale-[0.97] shadow-lg shadow-accent/30"
        >
          Guzergahi Baslat ({locatedActive.length} durak + donus)
        </button>
      )}

      {active.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">&#10003;</div>
          <p className="text-green-400 text-lg font-bold">Tum teslimatlar tamamlandi!</p>
          <p className="text-white/30 text-sm mt-1">{delivered.length} siparis teslim edildi</p>
        </div>
      ) : (
        <>
          {current && (
            <div className="bg-accent/10 border-2 border-accent rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-accent text-black text-xs font-bold px-2 py-0.5 rounded">SIRADAKI</span>
                <span className="font-bold text-lg">#{current.id}</span>
              </div>
              <div className="space-y-2 mb-4">
                <div>
                  <p className="text-xs text-white/40">Musteri</p>
                  <p className="font-medium text-lg">{current.customerName || "Isimsiz"}</p>
                </div>
                {current.customerPhone && (
                  <div>
                    <p className="text-xs text-white/40">Telefon</p>
                    <a href={`tel:${current.customerPhone}`} className="text-blue-400 font-medium text-lg">
                      {current.customerPhone}
                    </a>
                  </div>
                )}
                <div>
                  <p className="text-xs text-white/40">Adres</p>
                  <p className="font-medium">{current.deliveryAddress}</p>
                </div>
                {current.deliveryLatitude && current.deliveryLongitude && (
                  <button
                    onClick={() => openSingleNav(current)}
                    className="inline-block bg-blue-600/20 text-blue-400 text-sm px-3 py-1.5 rounded-lg"
                  >
                    Navigasyonu Ac
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between p-3 bg-surface-2 rounded-xl mb-4">
                <span className="text-white/40">Tutar</span>
                <span className="text-xl font-bold text-accent">{current.total.toFixed(0)} TL</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {current.customerPhone && (
                  <a
                    href={`tel:${current.customerPhone}`}
                    className="py-3 rounded-xl bg-blue-600 text-white font-bold text-sm text-center"
                  >
                    ARA
                  </a>
                )}
                <button
                  onClick={() => setPaymentModal(current)}
                  className={`py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold text-sm transition-all active:scale-[0.97] ${
                    !current.customerPhone ? "col-span-2" : ""
                  }`}
                >
                  TESLiM EDiLDi
                </button>
              </div>
            </div>
          )}

          {active.length > 1 && (
            <div>
              <p className="text-xs text-white/40 mb-2">Sonraki teslimatlar</p>
              <div className="space-y-2">
                {active.slice(1).map((d, i) => (
                  <div key={d.id} className="bg-surface-1 rounded-xl p-3 border border-border flex items-center gap-3">
                    <span className="bg-surface-2 rounded-lg w-8 h-8 flex items-center justify-center text-xs font-bold text-white/50">
                      {i + 2}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">#{d.id}</span>
                        <span className="text-xs text-white/40 truncate">{d.customerName || "Isimsiz"}</span>
                      </div>
                      <p className="text-xs text-white/40 truncate">{d.deliveryAddress}</p>
                    </div>
                    <span className="text-sm font-semibold text-accent shrink-0">{d.total.toFixed(0)} TL</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {delivered.length > 0 && (
        <div>
          <p className="text-xs text-white/40 mb-2">Teslim edilenler</p>
          <div className="space-y-1">
            {delivered.map((d) => (
              <div key={d.id} className="flex items-center gap-2 text-sm text-white/30 py-1">
                <span>&#10003;</span>
                <span>#{d.id}</span>
                <span className="truncate">{d.customerName}</span>
                <span className="ml-auto">{d.total.toFixed(0)} TL</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {paymentModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center p-4">
          <div className="bg-neutral-900 rounded-2xl w-full max-w-sm p-6 space-y-4 animate-in slide-in-from-bottom">
            <div className="text-center">
              <p className="text-white/40 text-sm">Siparis #{paymentModal.id}</p>
              <p className="text-3xl font-bold text-amber-400 mt-1">{paymentModal.total.toFixed(0)} TL</p>
              <p className="text-white/50 text-sm mt-1">{paymentModal.customerName || "Isimsiz"}</p>
            </div>
            <p className="text-center text-white/60 text-sm font-medium">Odeme Yontemi</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => markDelivered(paymentModal.id, "cash")}
                className="py-4 rounded-xl bg-green-600 text-white font-bold text-lg transition-all active:scale-[0.97]"
              >
                Nakit
              </button>
              <button
                onClick={() => markDelivered(paymentModal.id, "card")}
                className="py-4 rounded-xl bg-blue-600 text-white font-bold text-lg transition-all active:scale-[0.97]"
              >
                Kart
              </button>
            </div>
            <button
              onClick={() => setPaymentModal(null)}
              className="w-full py-2 text-white/30 text-sm"
            >
              Iptal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
