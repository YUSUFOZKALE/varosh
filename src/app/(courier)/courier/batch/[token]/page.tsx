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

const SHOP_DEFAULT: [number, number] = [37.372986, 36.076054];

export default function CourierBatchPage() {
  const { token } = useParams<{ token: string }>();
  const [orders, setOrders] = useState<BatchOrder[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [shopLocation, setShopLocation] = useState<[number, number]>(SHOP_DEFAULT);
  const [paymentModal, setPaymentModal] = useState<BatchOrder | null>(null);
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);

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

  async function openPayment(d: BatchOrder) {
    setPaymentModal(d);
    const res = await fetch(`/api/orders/${d.id}`);
    if (res.ok) setOrderDetail(await res.json());
  }

  async function markDelivered(orderId: number, paymentMethod: string) {
    await fetch(`/api/orders/${orderId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "delivered", paymentMethod }),
    });
    setPaymentModal(null);
    setOrderDetail(null);
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
                  onClick={() => openPayment(current)}
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center" onClick={() => { setPaymentModal(null); setOrderDetail(null); }}>
          <div className="bg-neutral-900 rounded-t-3xl w-full max-w-md max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 text-center border-b border-neutral-800/60 shrink-0">
              <h3 className="text-lg font-bold text-white">Siparis #{paymentModal.id}</h3>
              <p className="text-white/40 text-sm mt-1">{paymentModal.customerName || "Isimsiz"}{paymentModal.customerPhone ? ` • ${paymentModal.customerPhone}` : ""}</p>
            </div>

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
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-neutral-800/60">
                <span className="text-white text-lg font-bold">Toplam</span>
                <span className="text-amber-400 text-2xl font-extrabold">{paymentModal.total.toFixed(0)} TL</span>
              </div>
            </div>

            <div className="p-5 border-t border-neutral-800/60 space-y-3 shrink-0">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => markDelivered(paymentModal.id, "cash")}
                  className="py-4 rounded-2xl bg-green-600 hover:bg-green-500 text-white font-bold text-lg transition-all active:scale-[0.97]"
                >
                  Nakit
                </button>
                <button
                  onClick={() => markDelivered(paymentModal.id, "card")}
                  className="py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg transition-all active:scale-[0.97]"
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
