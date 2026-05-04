"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface Extra { id: number; name: string; price: number }
interface OrderItem { id: number; name: string; quantity: number; notes: string | null; extras: Extra[]; removed: string[]; }
interface KitchenOrder {
  id: number;
  status: string;
  customerName: string | null;
  customerPhone: string | null;
  tableNumber: number | null;
  deliveryAddress: string | null;
  source: string;
  notes: string | null;
  total: number;
  batchId: number | null;
  createdAt: string;
  items: OrderItem[];
}

interface SmartCluster {
  direction: string;
  emoji: string;
  avgDist: number;
  orderIds: number[];
  orders: Array<{
    id: number;
    customerName: string | null;
    deliveryAddress: string | null;
    total: number;
    createdAt: string;
  }>;
}

interface SmartQueueData {
  newClusters: SmartCluster[];
  stats: { preparing: number; ready: number; waiting: number; urgentReady: number };
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [clusters, setClusters] = useState<SmartCluster[]>([]);
  const [acceptingCluster, setAcceptingCluster] = useState<string | null>(null);
  const prevCountRef = useRef(0);

  const playAlert = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.value = 1000;
        gain2.gain.value = 0.3;
        osc2.start();
        osc2.stop(ctx.currentTime + 0.15);
      }, 200);
    } catch {}
  }, []);

  const load = useCallback(async () => {
    const [kitchenRes, queueRes] = await Promise.all([
      fetch("/api/kitchen"),
      fetch("/api/delivery/smart-queue"),
    ]);
    if (kitchenRes.ok) {
      const data: KitchenOrder[] = await kitchenRes.json();
      const newCount = data.filter((o) => o.status === "new").length;
      if (newCount > prevCountRef.current && prevCountRef.current >= 0) {
        playAlert();
      }
      prevCountRef.current = newCount;
      setOrders(data);
    }
    try {
      const q: SmartQueueData = await queueRes.json();
      setClusters(q.newClusters || []);
    } catch {}
  }, [playAlert]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  async function updateStatus(orderId: number, status: string) {
    await fetch(`/api/orders/${orderId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (status === "preparing") {
      window.open(`/receipt/${orderId}`, "_blank", "width=400,height=700");
    }
    load();
  }

  async function acceptCluster(orderIds: number[], directionName: string) {
    setAcceptingCluster(directionName);
    await fetch("/api/delivery/smart-queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderIds }),
    });
    const printWin = window.open(`/receipt/${orderIds[0]}`, "batch_print", "width=400,height=700");
    for (let i = 1; i < orderIds.length; i++) {
      await new Promise((r) => setTimeout(r, 2500));
      if (printWin && !printWin.closed) {
        printWin.location.href = `/receipt/${orderIds[i]}`;
      } else {
        window.open(`/receipt/${orderIds[i]}`, "batch_print", "width=400,height=700");
      }
    }
    setAcceptingCluster(null);
    load();
  }

  async function acceptTableCluster(orderIds: number[]) {
    setAcceptingCluster("table");
    await fetch("/api/delivery/smart-queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderIds }),
    });
    const printWin = window.open(`/receipt/${orderIds[0]}`, "batch_print", "width=400,height=700");
    for (let i = 1; i < orderIds.length; i++) {
      await new Promise((r) => setTimeout(r, 2500));
      if (printWin && !printWin.closed) {
        printWin.location.href = `/receipt/${orderIds[i]}`;
      } else {
        window.open(`/receipt/${orderIds[i]}`, "batch_print", "width=400,height=700");
      }
    }
    setAcceptingCluster(null);
    load();
  }

  function getElapsed(createdAt: string) {
    return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  }

  function printReceipt(orderId: number) {
    window.open(`/receipt/${orderId}`, "_blank", "width=400,height=700");
  }

  const qtyColors: Record<string, string> = {
    blue: "bg-blue-500/20 text-blue-300",
    orange: "bg-orange-500/20 text-orange-300",
    green: "bg-green-500/20 text-green-300",
    purple: "bg-purple-500/20 text-purple-300",
    amber: "bg-amber-500/20 text-amber-300",
  };

  function renderItemDetail(item: OrderItem, color: string) {
    return (
      <div key={item.id} className="flex items-start gap-2">
        <span className={`${qtyColors[color] || qtyColors.blue} font-bold text-sm w-7 h-7 rounded-lg flex items-center justify-center shrink-0`}>
          {item.quantity}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{item.name}</p>
          {item.extras && item.extras.length > 0 && (
            <div className="mt-0.5 bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.5">
              {item.extras.map((ext, j) => (
                <p key={j} className="text-xs font-bold text-amber-400">+ {ext.name}</p>
              ))}
            </div>
          )}
          {item.removed && item.removed.length > 0 && (
            <div className="mt-0.5 bg-red-500/15 border border-red-500/40 rounded px-1.5 py-0.5">
              {item.removed.map((r, j) => (
                <p key={j} className="text-xs font-bold text-red-400">✕ {r}</p>
              ))}
            </div>
          )}
          {item.notes && (
            <div className="mt-0.5 bg-yellow-500/10 border border-dashed border-yellow-500/30 rounded px-1.5 py-0.5">
              <p className="text-xs font-bold text-yellow-400">{item.notes}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  function getBatchLabel(order: KitchenOrder) {
    if (!order.batchId) return null;
    const sameB = orders.filter((o) => o.batchId === order.batchId).sort((a, b) => a.id - b.id);
    const idx = sameB.findIndex((o) => o.id === order.id) + 1;
    return `${sameB.length}/${idx}`;
  }

  const newOrders = orders.filter((o) => o.status === "new");
  const preparingOrders = orders.filter((o) => o.status === "preparing");
  const readyOrders = orders.filter((o) => o.status === "ready");

  const newTableOrders = newOrders.filter((o) => !o.deliveryAddress);
  const clusterOrderIds = new Set(clusters.flatMap((c) => c.orderIds || c.orders.map((o) => o.id)));
  const newDeliveryUnclustered = newOrders.filter((o) => o.deliveryAddress && !clusterOrderIds.has(o.id));

  return (
    <div className="min-h-screen bg-surface p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-accent">MUTFAK</h1>
          <div className="flex gap-3 text-sm">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-blue-400 font-medium">{newOrders.length} Yeni</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
              <span className="text-orange-400">{preparingOrders.length} Hazirlaniyor</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="text-green-400">{readyOrders.length} Hazir</span>
            </span>
          </div>
        </div>
        <span className="text-white/20 text-xs">Otomatik yenileme (5s)</span>
      </div>

      {/* 3-Column Layout: New | Preparing | Ready */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* NEW ORDERS */}
        <div>
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl px-3 py-2 mb-3">
            <h2 className="text-blue-400 font-bold text-sm">YENI SIPARISLER</h2>
          </div>
          <div className="space-y-3">
            {/* Direction-based delivery clusters */}
            {clusters.map((cluster) => {
              const clusterItems = cluster.orders.map((co) => {
                const full = newOrders.find((o) => o.id === co.id);
                return full || co;
              });
              return (
                <div key={cluster.direction} className="bg-surface-1 rounded-xl border-l-4 border-purple-500 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-purple-500/5">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{cluster.emoji}</span>
                      <span className="font-bold text-sm">{cluster.direction}</span>
                      <span className="text-[10px] bg-purple-600/20 text-purple-400 px-1.5 py-0.5 rounded">
                        {cluster.orders.length} Paket
                      </span>
                    </div>
                    <span className="text-xs text-white/30">{cluster.avgDist} km</span>
                  </div>

                  <div className="p-3 space-y-2">
                    {clusterItems.map((order) => {
                      const elapsed = getElapsed(order.createdAt);
                      const full = order as KitchenOrder;
                      return (
                        <div key={order.id} className="bg-surface-2 rounded-lg p-2">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm">#{order.id}</span>
                              <span className="text-xs text-white/40">{order.customerName || "Isimsiz"}</span>
                            </div>
                            <span className={`text-xs font-mono ${elapsed > 10 ? "text-red-400 font-bold" : "text-white/40"}`}>
                              {elapsed}dk
                            </span>
                          </div>
                          {full.items && full.items.length > 0 && (
                            <div className="space-y-1.5">
                              {full.items.map((item) => renderItemDetail(item, "purple"))}
                            </div>
                          )}
                          <p className="text-[10px] text-white/20 mt-1 truncate">{order.deliveryAddress}</p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="p-3 pt-0">
                    <button
                      onClick={() => acceptCluster(cluster.orderIds || cluster.orders.map((o) => o.id), cluster.direction)}
                      disabled={acceptingCluster === cluster.direction}
                      className="w-full py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold text-base transition-all active:scale-[0.97]"
                    >
                      {acceptingCluster === cluster.direction
                        ? "Kabul ediliyor..."
                        : `KUMEYI KABUL ET (${cluster.orders.length})`}
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Unclustered delivery orders (no location) */}
            {newDeliveryUnclustered.map((order) => {
              const elapsed = getElapsed(order.createdAt);
              const isUrgent = elapsed > 10;
              return (
                <div
                  key={order.id}
                  className={`bg-surface-1 rounded-xl border-l-4 border-blue-500 overflow-hidden ${
                    isUrgent ? "ring-2 ring-red-500/50 animate-pulse" : ""
                  }`}
                >
                  <div className="flex items-center justify-between px-3 py-2 bg-blue-500/5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg">#{order.id}</span>
                      {order.source === "whatsapp" && <span className="text-[10px] bg-green-600/20 text-green-400 px-1.5 py-0.5 rounded">WA</span>}
                      <span className="text-xs text-purple-400">Paket</span>
                    </div>
                    <span className={`text-sm font-mono ${isUrgent ? "text-red-400 font-bold" : "text-white/40"}`}>
                      {elapsed}dk
                    </span>
                  </div>
                  {order.customerName && <p className="px-3 pt-1 text-xs text-white/40">{order.customerName}</p>}
                  <div className="p-3 space-y-1.5">
                    {order.items.map((item) => renderItemDetail(item, "blue"))}
                  </div>
                  {order.notes && (
                    <div className="px-3 pb-2">
                      <p className="text-xs text-yellow-400/80 bg-yellow-500/10 rounded-lg px-2 py-1 font-bold">SIPARIS NOTU: {order.notes}</p>
                    </div>
                  )}
                  <div className="p-3 pt-0">
                    <button
                      onClick={() => updateStatus(order.id, "preparing")}
                      className="w-full py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-base transition-all active:scale-[0.97]"
                    >
                      KABUL ET — HAZIRLA
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Table / in-store orders — grouped as cluster */}
            {newTableOrders.length > 1 ? (
              <div className="bg-surface-1 rounded-xl border-l-4 border-amber-500 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-amber-500/5">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🪑</span>
                    <span className="font-bold text-sm">Masa Siparisleri</span>
                    <span className="text-[10px] bg-amber-600/20 text-amber-400 px-1.5 py-0.5 rounded">
                      {newTableOrders.length} Siparis
                    </span>
                  </div>
                </div>
                <div className="p-3 space-y-2">
                  {newTableOrders.map((order) => {
                    const elapsed = getElapsed(order.createdAt);
                    return (
                      <div key={order.id} className="bg-surface-2 rounded-lg p-2">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm">#{order.id}</span>
                            {order.tableNumber && <span className="bg-amber-500/20 text-amber-400 text-[10px] font-bold px-1.5 py-0.5 rounded">Masa {order.tableNumber}</span>}
                            {order.source === "qr" && <span className="text-[10px] bg-blue-600/20 text-blue-400 px-1 py-0.5 rounded">QR</span>}
                          </div>
                          <span className={`text-xs font-mono ${elapsed > 10 ? "text-red-400 font-bold" : "text-white/40"}`}>{elapsed}dk</span>
                        </div>
                        <div className="space-y-1.5">
                          {order.items.map((item) => renderItemDetail(item, "amber"))}
                        </div>
                        {order.notes && (
                          <div className="mt-1.5">
                            <p className="text-xs text-yellow-400/80 bg-yellow-500/10 rounded px-1.5 py-0.5 font-bold">SIPARIS NOTU: {order.notes}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="p-3 pt-0">
                  <button
                    onClick={() => acceptTableCluster(newTableOrders.map((o) => o.id))}
                    disabled={acceptingCluster === "table"}
                    className="w-full py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold text-base transition-all active:scale-[0.97]"
                  >
                    {acceptingCluster === "table"
                      ? "Kabul ediliyor..."
                      : `KUMEYI KABUL ET (${newTableOrders.length} Masa)`}
                  </button>
                </div>
              </div>
            ) : (
              newTableOrders.map((order) => {
                const elapsed = getElapsed(order.createdAt);
                const isUrgent = elapsed > 10;
                return (
                  <div
                    key={order.id}
                    className={`bg-surface-1 rounded-xl border-l-4 border-amber-500 overflow-hidden ${
                      isUrgent ? "ring-2 ring-red-500/50 animate-pulse" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between px-3 py-2 bg-amber-500/5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg">#{order.id}</span>
                        {order.tableNumber && <span className="bg-amber-500/20 text-amber-400 text-xs font-bold px-1.5 py-0.5 rounded">Masa {order.tableNumber}</span>}
                        {order.source === "qr" && <span className="text-[10px] bg-blue-600/20 text-blue-400 px-1 py-0.5 rounded">QR</span>}
                      </div>
                      <span className={`text-sm font-mono ${isUrgent ? "text-red-400 font-bold" : "text-white/40"}`}>
                        {elapsed}dk
                      </span>
                    </div>
                    {order.customerName && <p className="px-3 pt-1 text-xs text-white/40">{order.customerName}</p>}
                    <div className="p-3 space-y-1.5">
                      {order.items.map((item) => renderItemDetail(item, "amber"))}
                    </div>
                    {order.notes && (
                      <div className="px-3 pb-2">
                        <p className="text-xs text-yellow-400/80 bg-yellow-500/10 rounded-lg px-2 py-1 font-bold">SIPARIS NOTU: {order.notes}</p>
                      </div>
                    )}
                    <div className="p-3 pt-0">
                      <button
                        onClick={() => updateStatus(order.id, "preparing")}
                        className="w-full py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-base transition-all active:scale-[0.97]"
                      >
                        KABUL ET — HAZIRLA
                      </button>
                    </div>
                  </div>
                );
              })
            )}

            {newOrders.length === 0 && clusters.length === 0 && (
              <div className="text-center py-8 text-white/20 text-sm">Yeni siparis yok</div>
            )}
          </div>
        </div>

        {/* PREPARING */}
        <div>
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl px-3 py-2 mb-3">
            <h2 className="text-orange-400 font-bold text-sm">HAZIRLANIYOR</h2>
          </div>
          <div className="space-y-3">
            {preparingOrders.map((order) => {
              const elapsed = getElapsed(order.createdAt);
              const isUrgent = elapsed > 20;
              const bl = getBatchLabel(order);
              return (
                <div
                  key={order.id}
                  className={`bg-surface-1 rounded-xl border-l-4 border-orange-500 overflow-hidden ${
                    isUrgent ? "ring-2 ring-red-500/50" : ""
                  }`}
                >
                  <div className="flex items-center justify-between px-3 py-2 bg-orange-500/5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg">#{order.id}</span>
                      {bl && <span className="text-[10px] bg-white/10 text-white/60 font-bold px-1.5 py-0.5 rounded">Kume {bl}</span>}
                      {order.tableNumber && <span className="text-xs text-amber-400 font-bold">Masa {order.tableNumber}</span>}
                      {order.deliveryAddress && <span className="text-xs text-purple-400">Paket</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => printReceipt(order.id)}
                        className="text-white/30 hover:text-white text-xs px-1.5 py-0.5 rounded bg-surface-2"
                        title="Fis Yazdir"
                      >
                        🖨
                      </button>
                      <span className={`text-sm font-mono ${isUrgent ? "text-red-400 font-bold" : "text-white/40"}`}>
                        {elapsed}dk
                      </span>
                    </div>
                  </div>

                  <div className="p-3 space-y-1.5">
                    {order.items.map((item) => renderItemDetail(item, "orange"))}
                  </div>

                  {order.notes && (
                    <div className="px-3 pb-2">
                      <p className="text-xs text-yellow-400/80 bg-yellow-500/10 rounded-lg px-2 py-1 font-bold">SIPARIS NOTU: {order.notes}</p>
                    </div>
                  )}

                  <div className="p-3 pt-0">
                    <button
                      onClick={() => updateStatus(order.id, "ready")}
                      className="w-full py-3.5 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold text-base transition-all active:scale-[0.97]"
                    >
                      HAZIR
                    </button>
                  </div>
                </div>
              );
            })}
            {preparingOrders.length === 0 && (
              <div className="text-center py-8 text-white/20 text-sm">Hazirlanan siparis yok</div>
            )}
          </div>
        </div>

        {/* READY */}
        <div>
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-3 py-2 mb-3">
            <h2 className="text-green-400 font-bold text-sm">HAZIR — TESLIM BEKLIYOR</h2>
          </div>
          <div className="space-y-3">
            {readyOrders.map((order) => {
              const elapsed = getElapsed(order.createdAt);
              const bl = getBatchLabel(order);
              return (
                <div
                  key={order.id}
                  className="bg-surface-1 rounded-xl border-l-4 border-green-500 overflow-hidden"
                >
                  <div className="flex items-center justify-between px-3 py-2 bg-green-500/5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg">#{order.id}</span>
                      {bl && <span className="text-[10px] bg-white/10 text-white/60 font-bold px-1.5 py-0.5 rounded">Kume {bl}</span>}
                      {order.tableNumber && <span className="text-xs text-amber-400 font-bold">Masa {order.tableNumber}</span>}
                      {order.deliveryAddress && <span className="text-xs text-purple-400">Paket</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => printReceipt(order.id)}
                        className="text-white/30 hover:text-white text-xs px-1.5 py-0.5 rounded bg-surface-2"
                        title="Fis Yazdir"
                      >
                        🖨
                      </button>
                      <span className="text-sm font-mono text-white/40">{elapsed}dk</span>
                    </div>
                  </div>

                  {order.customerName && (
                    <p className="px-3 pt-1 text-xs text-white/40">{order.customerName} {order.customerPhone && `— ${order.customerPhone}`}</p>
                  )}

                  <div className="p-3 space-y-1.5">
                    {order.items.map((item) => renderItemDetail(item, "green"))}
                  </div>

                  {order.deliveryAddress ? (
                    <div className="px-3 pb-3 text-center">
                      <span className="text-green-400/60 text-sm font-medium">Kurye atanmasi bekleniyor</span>
                    </div>
                  ) : (
                    <div className="px-3 pb-3 text-center">
                      <span className="text-green-400/60 text-sm font-medium">Teslim edilmeyi bekliyor</span>
                    </div>
                  )}
                </div>
              );
            })}
            {readyOrders.length === 0 && (
              <div className="text-center py-8 text-white/20 text-sm">Hazir siparis yok</div>
            )}
          </div>
        </div>
      </div>

      {orders.length === 0 && clusters.length === 0 && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <p className="text-4xl mb-3 opacity-20">👨‍🍳</p>
            <p className="text-white/20 text-lg">Aktif siparis yok</p>
          </div>
        </div>
      )}
    </div>
  );
}
