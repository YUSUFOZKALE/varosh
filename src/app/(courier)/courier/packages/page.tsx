"use client";

import { useState, useEffect, useCallback } from "react";

interface MyOrder {
  id: number;
  customerName: string | null;
  customerPhone: string | null;
  deliveryAddress: string | null;
  total: number;
  status: string;
  paymentMethod: string | null;
  payMethod: string | null;
  paidAmount: number | null;
  cashCollected: number;
  deliveredAt: string | null;
  createdAt: string;
}

export default function CourierPackagesPage() {
  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/courier/my-deliveries");
    if (res.ok) setOrders(await res.json());
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
  }, [load]);

  const delivered = orders.filter((o) => o.status === "delivered");
  const active = orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled");
  const uncollectedCash = delivered.filter((o) => o.payMethod === "cash" && !o.cashCollected);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (uncollectedCash.every((o) => selected.has(o.id))) {
      setSelected(new Set());
    } else {
      setSelected(new Set(uncollectedCash.map((o) => o.id)));
    }
  }

  async function depositToRegister() {
    if (selected.size === 0) return;
    setLoading(true);
    await fetch("/api/payments/courier-collect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderIds: Array.from(selected), method: "cash" }),
    });
    setSelected(new Set());
    setLoading(false);
    load();
  }

  const selectedTotal = uncollectedCash.filter((o) => selected.has(o.id)).reduce((s, o) => s + (o.paidAmount || o.total), 0);
  const totalCashOnHand = uncollectedCash.reduce((s, o) => s + (o.paidAmount || o.total), 0);
  const totalDelivered = delivered.reduce((s, o) => s + (o.paidAmount || o.total), 0);

  return (
    <div className="p-4 space-y-4">
      <div className="text-center mb-2">
        <h1 className="text-xl font-bold">Paketlerim</h1>
        <p className="text-white/40 text-sm">Bugunun teslimatları</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-surface-1 rounded-xl p-3 text-center border border-border">
          <p className="text-2xl font-bold text-white">{active.length}</p>
          <p className="text-[10px] text-white/40">Aktif</p>
        </div>
        <div className="bg-surface-1 rounded-xl p-3 text-center border border-border">
          <p className="text-2xl font-bold text-green-400">{delivered.length}</p>
          <p className="text-[10px] text-white/40">Teslim</p>
        </div>
        <div className="bg-surface-1 rounded-xl p-3 text-center border border-border">
          <p className="text-2xl font-bold text-amber-400">{totalDelivered.toFixed(0)}</p>
          <p className="text-[10px] text-white/40">Toplam TL</p>
        </div>
      </div>

      {/* Uncollected cash section */}
      {uncollectedCash.length > 0 && (
        <div className="bg-orange-500/5 border border-orange-500/20 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-orange-400 font-bold text-sm">Kasaya Teslim Edilmemis Nakit</p>
              <p className="text-orange-400/60 text-xs">{uncollectedCash.length} siparis &middot; {totalCashOnHand.toFixed(0)} TL</p>
            </div>
            <button onClick={selectAll} className="text-orange-400/60 text-xs underline">
              {uncollectedCash.every((o) => selected.has(o.id)) ? "Secimi kaldir" : "Tumunu sec"}
            </button>
          </div>

          <div className="space-y-1.5">
            {uncollectedCash.map((o) => (
              <label key={o.id} className={`flex items-center gap-2 p-2.5 rounded-xl cursor-pointer transition-all ${selected.has(o.id) ? "bg-orange-600/10 border border-orange-500/30" : "bg-surface-1 border border-transparent"}`}>
                <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggle(o.id)} className="accent-orange-500 w-4 h-4" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-white/50 text-xs font-bold">#{o.id}</span>
                    <span className="text-white/40 text-xs truncate">{o.customerName || "Isimsiz"}</span>
                  </div>
                </div>
                <span className="text-white font-semibold text-sm">{(o.paidAmount || o.total).toFixed(0)} TL</span>
              </label>
            ))}
          </div>

          {selectedTotal > 0 && (
            <button
              onClick={depositToRegister}
              disabled={loading}
              className="w-full mt-3 py-3.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-base transition-all active:scale-[0.97] disabled:opacity-40"
            >
              Kasaya {selectedTotal.toFixed(0)} TL Teslim Et
            </button>
          )}
        </div>
      )}

      {/* All delivered orders */}
      {delivered.length > 0 && (
        <div>
          <p className="text-xs text-white/30 font-semibold mb-2">Teslim Edilenler</p>
          <div className="space-y-1.5">
            {delivered.map((o) => (
              <div key={o.id} className="bg-surface-1 rounded-xl p-3 border border-border flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white/60">#{o.id}</span>
                    <span className="text-xs text-white/30 truncate">{o.customerName || "Isimsiz"}</span>
                  </div>
                  <p className="text-xs text-white/20 truncate">{o.deliveryAddress}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-white/60">{(o.paidAmount || o.total).toFixed(0)} TL</p>
                  <div className="flex items-center gap-1 justify-end">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${o.payMethod === "cash" ? "bg-green-600/20 text-green-400" : "bg-blue-600/20 text-blue-400"}`}>
                      {o.payMethod === "cash" ? "Nakit" : "Kart"}
                    </span>
                    {o.payMethod === "cash" && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${o.cashCollected ? "bg-green-600/20 text-green-400" : "bg-orange-600/20 text-orange-400"}`}>
                        {o.cashCollected ? "Teslim" : "Bekliyor"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active orders */}
      {active.length > 0 && (
        <div>
          <p className="text-xs text-white/30 font-semibold mb-2">Aktif Teslimatlar</p>
          <div className="space-y-1.5">
            {active.map((o) => (
              <div key={o.id} className="bg-surface-1 rounded-xl p-3 border border-purple-500/20 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">#{o.id}</span>
                    <span className="text-xs bg-purple-600/20 text-purple-400 px-1.5 py-0.5 rounded">YOLDA</span>
                  </div>
                  <p className="text-xs text-white/30 truncate">{o.customerName || "Isimsiz"}</p>
                </div>
                <span className="text-accent font-bold">{o.total.toFixed(0)} TL</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {orders.length === 0 && (
        <div className="text-center py-16">
          <p className="text-white/20 text-lg">Bugun teslimat yok</p>
        </div>
      )}
    </div>
  );
}
