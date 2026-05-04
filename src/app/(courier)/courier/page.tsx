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

interface OrderItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  extras: { id: number; name: string; price: number }[];
  removed: string[];
  notes: string | null;
}

interface OrderDetail {
  id: number;
  total: number;
  subtotal: number;
  deliveryFee: number;
  customerName: string | null;
  items: OrderItem[];
}

export default function CourierPage() {
  const [deliveries, setDeliveries] = useState<CourierDelivery[]>([]);
  const [shopLocation, setShopLocation] = useState<[number, number]>(SHOP_DEFAULT);
  const [paymentModal, setPaymentModal] = useState<CourierDelivery | null>(null);
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);
  const [paying, setPaying] = useState(false);

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

  async function openPayment(d: CourierDelivery) {
    setPaymentModal(d);
    const res = await fetch(`/api/orders/${d.id}`);
    if (res.ok) setOrderDetail(await res.json());
  }

  async function markDelivered(orderId: number, paymentMethod: "cash" | "card") {
    setPaying(true);
    await fetch(`/api/orders/${orderId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "delivered", paymentMethod }),
    });
    setPaying(false);
    setPaymentModal(null);
    setOrderDetail(null);
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
              onClick={() => openPayment(d)}
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

      {/* Payment Modal with Order Details */}
      {paymentModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={() => !paying && (setPaymentModal(null), setOrderDetail(null))}>
          <div className="bg-neutral-900 rounded-t-3xl w-full max-w-md max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="p-5 text-center border-b border-neutral-800/60 shrink-0">
              <h3 className="text-lg font-bold text-white">Siparis #{paymentModal.id}</h3>
              <p className="text-white/40 text-sm mt-1">{paymentModal.customerName || "Isimsiz"}{paymentModal.customerPhone ? ` • ${paymentModal.customerPhone}` : ""}</p>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto p-5">
              {orderDetail ? (
                <>
                  <div className="space-y-2.5">
                    {orderDetail.items.map((item, i) => (
                      <div key={i} className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-white/50 text-sm font-bold">{item.quantity}x</span>
                            <span className="text-white text-sm font-medium">{item.name}</span>
                          </div>
                          {item.removed.length > 0 && (
                            <p className="text-red-400/60 text-[11px] ml-7">- {item.removed.join(", ")}</p>
                          )}
                          {item.extras.length > 0 && (
                            <p className="text-amber-400/60 text-[11px] ml-7">+ {item.extras.map((e) => e.name).join(", ")}</p>
                          )}
                          {item.notes && (
                            <p className="text-blue-400/50 text-[11px] ml-7 italic">{item.notes}</p>
                          )}
                        </div>
                        <span className="text-white/70 text-sm font-semibold shrink-0">{item.totalPrice.toFixed(0)} TL</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-3 border-t border-neutral-800/60 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-white/40">Ara Toplam</span>
                      <span className="text-white/60">{orderDetail.subtotal.toFixed(0)} TL</span>
                    </div>
                    {orderDetail.deliveryFee > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-white/40">Teslimat</span>
                        <span className="text-white/60">{orderDetail.deliveryFee.toFixed(0)} TL</span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
                </div>
              )}

              {/* Total */}
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-neutral-800/60">
                <span className="text-white text-lg font-bold">Toplam</span>
                <span className="text-amber-400 text-2xl font-extrabold">{paymentModal.total.toFixed(0)} TL</span>
              </div>
            </div>

            {/* Actions */}
            <div className="p-5 border-t border-neutral-800/60 space-y-3 shrink-0">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => markDelivered(paymentModal.id, "cash")}
                  disabled={paying}
                  className="py-4 rounded-2xl bg-green-600 hover:bg-green-500 text-white font-bold text-lg transition-all active:scale-[0.97] disabled:opacity-40"
                >
                  Nakit
                </button>
                <button
                  onClick={() => markDelivered(paymentModal.id, "card")}
                  disabled={paying}
                  className="py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg transition-all active:scale-[0.97] disabled:opacity-40"
                >
                  Kart
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => window.open(`/receipt/${paymentModal.id}`, "_blank")}
                  className="py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white/60 font-medium text-sm transition-all active:scale-[0.97] flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                  Fis Yazdir
                </button>
                <button
                  onClick={() => { setPaymentModal(null); setOrderDetail(null); }}
                  disabled={paying}
                  className="py-3 rounded-xl bg-neutral-800 text-white/40 font-medium text-sm"
                >
                  Iptal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
