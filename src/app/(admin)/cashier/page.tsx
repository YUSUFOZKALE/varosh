"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

interface Order {
  id: number;
  customerName: string | null;
  tableNumber: number | null;
  source: string;
  total: number;
  paymentMethod: string | null;
  status: string;
  deliveryAddress: string | null;
  createdAt: string;
}

interface CashRegisterEntry {
  id: number;
  type: string;
  amount: number;
  description: string | null;
  createdAt: string;
}

interface FinanceEntry {
  id: number;
  type: string;
  category: string;
  amount: number;
  description: string | null;
  date: string;
  createdAt: string;
}

interface ZReport {
  date: string;
  orders: { totalOrders: number; totalRevenue: number; totalDiscount: number; cancelledOrders: number };
  paymentBreakdown: { method: string; total: number; count: number }[];
  cashMovements: { type: string; total: number }[];
  sourceBreakdown: { source: string; count: number; total: number }[];
}

type Tab = "orders" | "expenses" | "register" | "zreport";

const SOURCE_LABELS: Record<string, string> = {
  manual: "Mekan / Masa",
  whatsapp: "WhatsApp Paket",
  phone: "Telefonla",
  walk_in: "Gel-Al",
  qr: "QR Siparis",
};

const EXPENSE_CATEGORIES = [
  "Malzeme / Hammadde",
  "Personel",
  "Kira",
  "Elektrik / Su / Dogalgaz",
  "Ambalaj / Paket",
  "Temizlik",
  "Bakim / Onarim",
  "Ulasim / Akaryakit",
  "Vergi / Sigorta",
  "Diger",
];

const TYPE_LABELS: Record<string, string> = {
  sale: "Satis",
  refund: "Iade",
  deposit: "Para Girisi",
  withdrawal: "Para Cikisi",
  opening: "Kasa Acilis",
  closing: "Kasa Kapanis",
};

const TYPE_COLORS: Record<string, string> = {
  sale: "text-green-400",
  refund: "text-red-400",
  deposit: "text-blue-400",
  withdrawal: "text-orange-400",
  opening: "text-purple-400",
  closing: "text-white/40",
};

export default function CashierPage() {
  const [tab, setTab] = useState<Tab>("orders");
  const [unpaid, setUnpaid] = useState<Order[]>([]);
  const [payModal, setPayModal] = useState<Order | null>(null);
  const [register, setRegister] = useState<{ movements: CashRegisterEntry[]; balance: number }>({ movements: [], balance: 0 });
  const [zReport, setZReport] = useState<ZReport | null>(null);
  const [addCashModal, setAddCashModal] = useState(false);
  const [zDate, setZDate] = useState(new Date().toISOString().split("T")[0]);

  const [expenses, setExpenses] = useState<{ entries: FinanceEntry[]; totals: { income: number; expense: number; net: number } }>({ entries: [], totals: { income: 0, expense: 0, net: 0 } });
  const [expenseModal, setExpenseModal] = useState(false);
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);

  const loadUnpaid = useCallback(async () => {
    const res = await fetch("/api/orders?limit=100");
    const orders: Order[] = await res.json();
    setUnpaid(orders.filter((o) => !o.paymentMethod && o.status !== "cancelled"));
  }, []);

  const loadRegister = useCallback(async () => {
    const res = await fetch("/api/payments/cash-register");
    setRegister(await res.json());
  }, []);

  const loadZReport = useCallback(async () => {
    const res = await fetch(`/api/payments/z-report?date=${zDate}`);
    setZReport(await res.json());
  }, [zDate]);

  const loadExpenses = useCallback(async () => {
    const res = await fetch(`/api/expenses?date=${expenseDate}`);
    setExpenses(await res.json());
  }, [expenseDate]);

  useEffect(() => {
    loadUnpaid();
    loadRegister();
    loadZReport();
    loadExpenses();
  }, [loadUnpaid, loadRegister, loadZReport, loadExpenses]);

  async function processPayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!payModal) return;
    const fd = new FormData(e.currentTarget);
    const method = fd.get("method") as string;
    const receivedAmount = parseFloat(fd.get("received") as string) || payModal.total;

    await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: payModal.id,
        amount: payModal.total,
        method,
        receivedAmount,
      }),
    });
    setPayModal(null);
    loadUnpaid();
    loadRegister();
    loadZReport();
  }

  async function addCashMovement(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await fetch("/api/payments/cash-register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: fd.get("type") as string,
        amount: parseFloat(fd.get("amount") as string),
        description: fd.get("description") as string || null,
      }),
    });
    setAddCashModal(false);
    loadRegister();
    loadZReport();
  }

  async function addExpense(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "expense",
        category: fd.get("category") as string,
        amount: parseFloat(fd.get("amount") as string),
        description: fd.get("description") as string || null,
        date: expenseDate,
      }),
    });
    setExpenseModal(false);
    loadExpenses();
    loadZReport();
  }

  function getSourceLabel(source: string) {
    return SOURCE_LABELS[source] || source;
  }

  function getOrderLabel(order: Order) {
    if (order.tableNumber) return `Masa ${order.tableNumber}`;
    if (order.deliveryAddress) return "Paket";
    return "Gel-Al";
  }

  const change = payModal ? (
    parseFloat((document.querySelector<HTMLInputElement>('input[name="received"]')?.value || "0")) - payModal.total
  ) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Kasa</h2>
        <div className="flex gap-1 bg-surface-2 rounded-xl p-1">
          {([
            ["orders", "Siparisler"],
            ["expenses", "Giderler"],
            ["register", "Kasa"],
            ["zreport", "Z Raporu"],
          ] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t ? "bg-accent text-black" : "text-white/40 hover:text-white"
              }`}
            >
              {label}
              {t === "orders" && unpaid.length > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5">
                  {unpaid.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Orders / Payment Tab */}
      {tab === "orders" && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Odenmemis Siparisler ({unpaid.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {unpaid.map((order) => (
              <div key={order.id} className="card">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="font-bold text-lg">#{order.id}</span>
                    <span className="ml-2 text-xs text-white/40">{getOrderLabel(order)}</span>
                  </div>
                  <span className="text-2xl font-bold text-accent">{order.total.toFixed(0)} TL</span>
                </div>
                <div className="space-y-1 text-sm text-white/50 mb-3">
                  {order.customerName && <p>{order.customerName}</p>}
                  <p className="text-xs">{getSourceLabel(order.source)}</p>
                </div>
                <Button className="w-full" onClick={() => setPayModal(order)}>Odeme Al</Button>
              </div>
            ))}
            {unpaid.length === 0 && (
              <div className="col-span-full text-center py-8 text-white/30">Odenmemis siparis yok</div>
            )}
          </div>
        </div>
      )}

      {/* Expenses Tab */}
      {tab === "expenses" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="bg-surface-2 rounded-lg px-3 py-1.5 text-sm text-white border border-border"
              />
              <div className="flex gap-4 text-sm">
                <span className="text-red-400">Gider: {expenses.totals.expense.toFixed(0)} TL</span>
                <span className="text-green-400">Gelir: {expenses.totals.income.toFixed(0)} TL</span>
                <span className={expenses.totals.net >= 0 ? "text-green-400" : "text-red-400"}>
                  Net: {expenses.totals.net.toFixed(0)} TL
                </span>
              </div>
            </div>
            <Button onClick={() => setExpenseModal(true)}>+ Gider Ekle</Button>
          </div>

          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-white/40 text-xs">
                  <th className="px-4 py-3 text-left">Tarih</th>
                  <th className="px-4 py-3 text-left">Kategori</th>
                  <th className="px-4 py-3 text-left">Aciklama</th>
                  <th className="px-4 py-3 text-right">Tutar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {expenses.entries.map((e) => (
                  <tr key={e.id} className="hover:bg-surface-2">
                    <td className="px-4 py-3 text-white/40 text-xs">{e.date}</td>
                    <td className="px-4 py-3 font-medium">{e.category}</td>
                    <td className="px-4 py-3 text-white/50">{e.description || "-"}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${e.type === "expense" ? "text-red-400" : "text-green-400"}`}>
                      {e.type === "expense" ? "-" : "+"}{e.amount.toFixed(0)} TL
                    </td>
                  </tr>
                ))}
                {expenses.entries.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-white/30">Bu tarihte gider yok</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cash Register Tab */}
      {tab === "register" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="bg-surface-2 rounded-xl px-6 py-3">
              <span className="text-white/40 text-sm">Kasa Bakiyesi</span>
              <p className="text-3xl font-bold text-accent">{register.balance.toFixed(0)} TL</p>
            </div>
            <Button onClick={() => setAddCashModal(true)}>+ Hareket Ekle</Button>
          </div>

          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-white/40 text-xs">
                  <th className="px-4 py-3 text-left">Saat</th>
                  <th className="px-4 py-3 text-left">Tur</th>
                  <th className="px-4 py-3 text-left">Aciklama</th>
                  <th className="px-4 py-3 text-right">Tutar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {register.movements.map((m) => (
                  <tr key={m.id} className="hover:bg-surface-2">
                    <td className="px-4 py-3 text-white/40">{m.createdAt.split(" ")[1]?.slice(0, 5)}</td>
                    <td className={`px-4 py-3 font-medium ${TYPE_COLORS[m.type] || ""}`}>
                      {TYPE_LABELS[m.type] || m.type}
                    </td>
                    <td className="px-4 py-3 text-white/50">{m.description || "-"}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${
                      ["refund", "withdrawal"].includes(m.type) ? "text-red-400" : "text-green-400"
                    }`}>
                      {["refund", "withdrawal"].includes(m.type) ? "-" : "+"}{m.amount.toFixed(0)} TL
                    </td>
                  </tr>
                ))}
                {register.movements.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-white/30">Bugun hareket yok</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Z Report Tab */}
      {tab === "zreport" && zReport && (
        <div className="space-y-6">
          <div className="flex items-center justify-center gap-3 mb-2">
            <button
              onClick={() => { const d = new Date(zDate); d.setDate(d.getDate() - 1); setZDate(d.toISOString().split("T")[0]); }}
              className="px-3 py-1 bg-surface-2 rounded-lg text-white/40 hover:text-white"
            >&larr;</button>
            <input
              type="date"
              value={zDate}
              onChange={(e) => setZDate(e.target.value)}
              className="bg-surface-2 rounded-lg px-3 py-1 text-sm text-white border border-border"
            />
            <button
              onClick={() => { const d = new Date(zDate); d.setDate(d.getDate() + 1); setZDate(d.toISOString().split("T")[0]); }}
              className="px-3 py-1 bg-surface-2 rounded-lg text-white/40 hover:text-white"
            >&rarr;</button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card text-center">
              <p className="text-3xl font-bold">{zReport.orders.totalOrders}</p>
              <p className="text-xs text-white/40">Toplam Siparis</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-green-400">{zReport.orders.totalRevenue.toFixed(0)}</p>
              <p className="text-xs text-white/40">Toplam Ciro (TL)</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-orange-400">{zReport.orders.totalDiscount.toFixed(0)}</p>
              <p className="text-xs text-white/40">Indirim (TL)</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-red-400">{zReport.orders.cancelledOrders || 0}</p>
              <p className="text-xs text-white/40">Iptal</p>
            </div>
          </div>

          {zReport.paymentBreakdown.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold mb-3">Odeme Yontemleri</h3>
              <div className="space-y-2">
                {zReport.paymentBreakdown.map((p) => (
                  <div key={p.method} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                    <span>{p.method === "cash" ? "Nakit" : p.method === "card" ? "Kart" : "Online"}</span>
                    <div className="text-right">
                      <span className="font-semibold">{p.total.toFixed(0)} TL</span>
                      <span className="text-white/40 text-xs ml-2">({p.count} islem)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {zReport.sourceBreakdown.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold mb-3">Kaynak Dagilimi</h3>
              <div className="space-y-2">
                {zReport.sourceBreakdown.map((s) => (
                  <div key={s.source} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                    <span>{getSourceLabel(s.source)}</span>
                    <div className="text-right">
                      <span className="font-semibold">{s.total.toFixed(0)} TL</span>
                      <span className="text-white/40 text-xs ml-2">({s.count} siparis)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Payment Modal */}
      <Modal open={!!payModal} onClose={() => setPayModal(null)} title={`Siparis #${payModal?.id} Odeme`}>
        {payModal && (
          <form onSubmit={processPayment} className="space-y-4">
            <div className="bg-surface-2 rounded-xl p-4 text-center">
              <p className="text-sm text-white/40">Odenecek Tutar</p>
              <p className="text-4xl font-bold text-accent">{payModal.total.toFixed(0)} TL</p>
              <p className="text-xs text-white/30 mt-1">{getOrderLabel(payModal)} — {getSourceLabel(payModal.source)}</p>
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1 block">Odeme Yontemi</label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center justify-center gap-2 p-3 bg-surface-2 rounded-xl cursor-pointer has-[:checked]:bg-green-600/20 has-[:checked]:border-green-500/50 border border-transparent transition-all">
                  <input type="radio" name="method" value="cash" defaultChecked className="hidden" />
                  <span className="text-lg">💵</span>
                  <span className="font-medium">Nakit</span>
                </label>
                <label className="flex items-center justify-center gap-2 p-3 bg-surface-2 rounded-xl cursor-pointer has-[:checked]:bg-blue-600/20 has-[:checked]:border-blue-500/50 border border-transparent transition-all">
                  <input type="radio" name="method" value="card" className="hidden" />
                  <span className="text-lg">💳</span>
                  <span className="font-medium">Kart</span>
                </label>
              </div>
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1 block">Alinan Tutar (Nakit icin)</label>
              <input name="received" type="number" step="1" className="input-field" placeholder={payModal.total.toFixed(0)} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" type="button" onClick={() => setPayModal(null)}>Iptal</Button>
              <Button type="submit">Odemeyi Onayla</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Add Cash Movement Modal */}
      <Modal open={addCashModal} onClose={() => setAddCashModal(false)} title="Kasa Hareketi Ekle">
        <form onSubmit={addCashMovement} className="space-y-4">
          <div>
            <label className="text-xs text-white/40 mb-1 block">Tur</label>
            <select name="type" className="input-field" required>
              <option value="opening">Kasa Acilis</option>
              <option value="deposit">Para Girisi</option>
              <option value="withdrawal">Para Cikisi</option>
              <option value="refund">Iade</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-white/40 mb-1 block">Tutar (TL)</label>
            <input name="amount" type="number" step="1" className="input-field" required />
          </div>
          <div>
            <label className="text-xs text-white/40 mb-1 block">Aciklama</label>
            <input name="description" className="input-field" />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" type="button" onClick={() => setAddCashModal(false)}>Iptal</Button>
            <Button type="submit">Ekle</Button>
          </div>
        </form>
      </Modal>

      {/* Add Expense Modal */}
      <Modal open={expenseModal} onClose={() => setExpenseModal(false)} title="Gider Ekle">
        <form onSubmit={addExpense} className="space-y-4">
          <div>
            <label className="text-xs text-white/40 mb-1 block">Kategori</label>
            <select name="category" className="input-field" required>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-white/40 mb-1 block">Tutar (TL)</label>
            <input name="amount" type="number" step="1" className="input-field" required />
          </div>
          <div>
            <label className="text-xs text-white/40 mb-1 block">Aciklama</label>
            <input name="description" className="input-field" placeholder="Orn: Haftalik et alimi" />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" type="button" onClick={() => setExpenseModal(false)}>Iptal</Button>
            <Button type="submit">Kaydet</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
