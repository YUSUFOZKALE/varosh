"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const [deliveries, setDeliveries] = useState<CourierDelivery[]>([]);
  const [shopLocation, setShopLocation] = useState<[number, number]>(SHOP_DEFAULT);
  const [paymentModal, setPaymentModal] = useState<CourierDelivery | null>(null);
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);
  const [paying, setPaying] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<number>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [pendingPackages, setPendingPackages] = useState<CourierDelivery[]>([]);
  const [pickSelected, setPickSelected] = useState<Set<number>>(new Set());
  const [picking, setPicking] = useState(false);
  const [myStaffId, setMyStaffId] = useState<number | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const scannerRef = useRef<any>(null);
  const autoStarted = useRef(false);

  const load = useCallback(async () => {
    const [res, settingsRes, readyRes, meRes] = await Promise.all([
      fetch("/api/orders?status=on_the_way"),
      fetch("/api/settings/public"),
      fetch("/api/orders?status=ready"),
      fetch("/api/auth/me"),
    ]);
    if (res.ok) {
      const orders: CourierDelivery[] = await res.json();
      setDeliveries(orders.filter((o) => o.deliveryAddress));
    }
    if (readyRes.ok) {
      const readyOrders: CourierDelivery[] = await readyRes.json();
      setPendingPackages(readyOrders.filter((o) => o.deliveryAddress));
    }
    try {
      const me = await meRes.json();
      if (me.staffId) setMyStaffId(me.staffId);
    } catch {}
    try {
      const s = await settingsRes.json();
      if (s.shopLatitude && s.shopLongitude) {
        setShopLocation([s.shopLatitude, s.shopLongitude]);
      }
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (loaded && !autoStarted.current && deliveries.length === 0) {
      autoStarted.current = true;
      startScanner();
    }
  }, [loaded]);

  async function startScanner() {
    setScanning(true);
    setScanError("");

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          const match = decodedText.match(/\/courier\/batch\/([a-z0-9]+)/i);
          if (match) {
            stopScanner();
            router.push(`/courier/batch/${match[1]}`);
          } else {
            setScanError("Gecersiz QR kod");
          }
        },
        () => {}
      );
    } catch (err: any) {
      setScanError("Kamera acilamadi: " + (err?.message || "Izin verin"));
    }
  }

  function stopScanner() {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
    setScanning(false);
    setScanError("");
  }

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

  function toggleBulk(id: number) {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function bulkDeliver(paymentMethod: "cash" | "card") {
    if (bulkSelected.size === 0) return;
    setPaying(true);
    await fetch("/api/orders/bulk-deliver", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderIds: Array.from(bulkSelected), paymentMethod }),
    });
    setPaying(false);
    setBulkSelected(new Set());
    setBulkMode(false);
    load();
  }

  function togglePick(id: number) {
    setPickSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function assignAndRoute() {
    if (pickSelected.size === 0 || !myStaffId) return;
    setPicking(true);
    const ids = Array.from(pickSelected);
    for (const orderId of ids) {
      await fetch("/api/delivery/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, courierId: myStaffId }),
      });
    }
    const batchRes = await fetch("/api/delivery/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderIds: ids, courierId: myStaffId, baseUrl: window.location.origin }),
    });
    if (batchRes.ok) {
      const { token } = await batchRes.json();
      setPickSelected(new Set());
      setPicking(false);
      router.push(`/courier/batch/${token}`);
    } else {
      setPicking(false);
      load();
    }
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
      {/* QR Scanner - inline at top */}
      <div className="rounded-2xl overflow-hidden border border-border bg-black">
        {scanning ? (
          <>
            <div id="qr-reader" className="w-full" />
            {scanError && (
              <div className="bg-red-600/90 text-white text-center py-2 text-xs font-medium">{scanError}</div>
            )}
            <button onClick={stopScanner} className="w-full py-2.5 bg-neutral-800 text-white/40 text-xs font-medium">Kamerayi Kapat</button>
          </>
        ) : (
          <button
            onClick={startScanner}
            className="w-full py-5 flex flex-col items-center gap-1.5 bg-purple-600/10 active:bg-purple-600/20 transition-all"
          >
            <svg className="w-7 h-7 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            <span className="text-purple-400 font-bold text-sm">QR Kod Okut</span>
            <span className="text-white/20 text-xs">Kamerayi ac</span>
          </button>
        )}
      </div>

      {/* Pending packages - selectable list */}
      {pendingPackages.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div>
                <p className="text-orange-400 font-bold text-sm">{pendingPackages.length} paket hazir</p>
                <p className="text-white/30 text-[11px]">Sec ve rotani olustur</p>
              </div>
            </div>
            {pickSelected.size > 0 && (
              <span className="bg-orange-500 text-black font-bold text-xs px-2.5 py-1 rounded-full">{pickSelected.size} secili</span>
            )}
          </div>

          {pendingPackages.map((p) => {
            const selected = pickSelected.has(p.id);
            return (
              <div
                key={p.id}
                onClick={() => togglePick(p.id)}
                className={`rounded-xl p-3 border transition-all active:scale-[0.98] cursor-pointer ${
                  selected ? "bg-orange-500/15 border-orange-500/50" : "bg-surface-1 border-border"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                    selected ? "bg-orange-500 border-orange-500" : "border-white/20"
                  }`}>
                    {selected && (
                      <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm">#{p.id} {p.customerName || "Isimsiz"}</span>
                      <span className="text-orange-400 font-bold text-sm">{p.total.toFixed(0)} TL</span>
                    </div>
                    <p className="text-white/40 text-xs truncate mt-0.5">{p.deliveryAddress}</p>
                  </div>
                </div>
              </div>
            );
          })}

          {pickSelected.size > 0 && (
            <button
              onClick={assignAndRoute}
              disabled={picking}
              className="w-full py-4 rounded-2xl bg-orange-500 hover:bg-orange-400 text-black font-bold text-lg transition-all active:scale-[0.97] disabled:opacity-40"
            >
              {picking ? "Ataniyor..." : `Rota Olustur (${pickSelected.size} paket)`}
            </button>
          )}
        </div>
      )}

      {/* Header + Bulk toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Teslimatlarim</h1>
          <p className="text-white/40 text-xs">{deliveries.length} aktif teslimat</p>
        </div>
        {deliveries.length > 0 && (
          <button
            onClick={() => { setBulkMode(!bulkMode); setBulkSelected(new Set()); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-[0.97] ${bulkMode ? "bg-amber-500 text-black" : "bg-surface-2 text-white/50"}`}
          >
            {bulkMode ? "Toplu Aktif" : "Toplu Teslim"}
          </button>
        )}
      </div>

      {/* Bulk action bar */}
      {bulkMode && bulkSelected.size > 0 && (
        <div className="sticky top-0 z-40 bg-neutral-900/95 backdrop-blur-sm rounded-2xl p-4 border border-amber-500/30 space-y-3">
          <p className="text-center text-white font-semibold">{bulkSelected.size} siparis secildi &middot; {deliveries.filter((d) => bulkSelected.has(d.id)).reduce((s, d) => s + d.total, 0).toFixed(0)} TL</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => bulkDeliver("cash")}
              disabled={paying}
              className="py-4 rounded-2xl bg-green-600 hover:bg-green-500 text-white font-bold text-lg transition-all active:scale-[0.97] disabled:opacity-40"
            >
              Toplu Nakit
            </button>
            <button
              onClick={() => bulkDeliver("card")}
              disabled={paying}
              className="py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg transition-all active:scale-[0.97] disabled:opacity-40"
            >
              Toplu Kart
            </button>
          </div>
        </div>
      )}

      {locatedCount > 1 && (
        <button
          onClick={openFullRoute}
          className="w-full py-4 rounded-2xl bg-accent text-black font-bold text-center text-lg transition-all active:scale-[0.97] shadow-lg shadow-accent/30"
        >
          Tum Guzergahi Ac ({locatedCount} durak + donus)
        </button>
      )}

      {deliveries.map((d) => (
        <div key={d.id} className={`bg-surface-1 rounded-2xl p-4 border transition-all ${bulkMode && bulkSelected.has(d.id) ? "border-amber-500/50" : "border-border"}`} onClick={bulkMode ? () => toggleBulk(d.id) : undefined}>
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-2">
              {bulkMode && (
                <input type="checkbox" checked={bulkSelected.has(d.id)} onChange={() => toggleBulk(d.id)} className="accent-amber-500 w-5 h-5" onClick={(e) => e.stopPropagation()} />
              )}
              <span className="font-bold text-lg">#{d.id}</span>
              <span className="text-xs bg-purple-600/20 text-purple-400 px-2 py-0.5 rounded">YOLDA</span>
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

          {!bulkMode && (
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
          )}
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
