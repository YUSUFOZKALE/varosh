"use client";

import { useState, useEffect, useCallback } from "react";

interface CashEntry {
  id: number;
  type: string;
  amount: number;
  description: string | null;
  createdAt: string;
}

interface MyOrder {
  id: number;
  total: number;
  paidAmount: number | null;
  payMethod: string | null;
  cashCollected: number;
}

export default function CourierWalletPage() {
  const [movements, setMovements] = useState<CashEntry[]>([]);
  const [cashOnHand, setCashOnHand] = useState(0);
  const [showForm, setShowForm] = useState<"deposit" | "withdrawal" | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [courierName, setCourierName] = useState("");
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    const [meRes, ordersRes] = await Promise.all([
      fetch("/api/auth/me"),
      fetch("/api/courier/my-deliveries"),
    ]);

    if (meRes.ok) {
      const me = await meRes.json();
      setCourierName(me.name);
    }

    if (ordersRes.ok) {
      const orders: MyOrder[] = await ordersRes.json();
      const uncollected = orders.filter((o: MyOrder) => o.payMethod === "cash" && !o.cashCollected);
      setCashOnHand(uncollected.reduce((s: number, o: MyOrder) => s + (o.paidAmount || o.total), 0));
    }

    const movRes = await fetch("/api/payments/cash-register");
    if (movRes.ok) {
      const data = await movRes.json();
      const courierRelated = (data.movements as CashEntry[]).filter((m) =>
        m.description?.toLowerCase().includes("kurye")
      );
      setMovements(courierRelated.slice(0, 20));
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function submitMovement() {
    if (!amount || !showForm) return;
    setLoading(true);
    await fetch("/api/payments/cash-register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: showForm,
        amount: parseFloat(amount),
        description: showForm === "deposit"
          ? `Kurye ${courierName} - kasaya para teslim${description ? ` (${description})` : ""}`
          : `Kurye ${courierName} - kasadan avans${description ? ` (${description})` : ""}`,
      }),
    });
    setLoading(false);
    setShowForm(null);
    setAmount("");
    setDescription("");
    loadData();
  }

  return (
    <div className="p-4 space-y-4">
      <div className="text-center mb-2">
        <h1 className="text-xl font-bold">Kasa Islemleri</h1>
        <p className="text-white/40 text-sm">{courierName || "Kurye"}</p>
      </div>

      {/* Cash on hand */}
      <div className="bg-surface-1 rounded-2xl p-5 border border-border text-center">
        <p className="text-white/40 text-xs mb-1">Uzerimde Nakit</p>
        <p className="text-4xl font-black text-orange-400">{cashOnHand.toFixed(0)} TL</p>
        <p className="text-white/20 text-xs mt-1">Kasaya teslim edilmemis</p>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => { setShowForm("deposit"); setAmount(""); setDescription(""); }}
          className="py-4 rounded-2xl bg-green-600/20 border border-green-500/30 text-green-400 font-bold text-sm transition-all active:scale-[0.97]"
        >
          <svg className="w-5 h-5 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m0 0l-4-4m4 4l4-4" /></svg>
          Kasaya Para Birak
        </button>
        <button
          onClick={() => { setShowForm("withdrawal"); setAmount(""); setDescription(""); }}
          className="py-4 rounded-2xl bg-red-600/20 border border-red-500/30 text-red-400 font-bold text-sm transition-all active:scale-[0.97]"
        >
          <svg className="w-5 h-5 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 20V4m0 0l-4 4m4-4l4 4" /></svg>
          Kasadan Para Al
        </button>
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="bg-surface-1 rounded-2xl p-4 border border-border space-y-3">
          <h3 className="text-sm font-bold text-center">
            {showForm === "deposit" ? "Kasaya Para Teslim" : "Kasadan Avans Al"}
          </h3>
          <div>
            <label className="text-xs text-white/40 mb-1 block">Tutar (TL)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-center text-2xl font-bold text-amber-400 focus:outline-none focus:border-amber-500/50"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs text-white/40 mb-1 block">Aciklama (opsiyonel)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Orn: Gun sonu teslimat"
              className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-white/20"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setShowForm(null)}
              className="py-3 rounded-xl bg-surface-2 text-white/30 font-medium text-sm"
            >
              Iptal
            </button>
            <button
              onClick={submitMovement}
              disabled={!amount || parseFloat(amount) <= 0 || loading}
              className={`py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.97] disabled:opacity-40 ${showForm === "deposit" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}
            >
              {loading ? "..." : "Onayla"}
            </button>
          </div>
        </div>
      )}

      {/* Recent courier-related movements */}
      {movements.length > 0 && (
        <div>
          <p className="text-xs text-white/30 font-semibold mb-2">Son Hareketler</p>
          <div className="space-y-1.5">
            {movements.map((m) => (
              <div key={m.id} className="bg-surface-1 rounded-xl p-3 border border-border flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/50 truncate">{m.description || m.type}</p>
                  <p className="text-[10px] text-white/20">{m.createdAt.split(" ")[1]?.slice(0, 5)}</p>
                </div>
                <span className={`font-bold text-sm ${["withdrawal", "refund"].includes(m.type) ? "text-red-400" : "text-green-400"}`}>
                  {["withdrawal", "refund"].includes(m.type) ? "-" : "+"}{m.amount.toFixed(0)} TL
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
