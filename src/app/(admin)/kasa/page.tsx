"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/useToast";
import { ToastContainer } from "@/components/ToastContainer";

interface Transaction {
  id: number;
  type: "income" | "expense" | "trust" | "staff_payment";
  amount: number;
  payment_method: string | null;
  category: string | null;
  description: string | null;
  person: string | null;
  courier_id: number | null;
  is_returned: number;
  returned_at: string | null;
  created_by: number | null;
  createdByName: string | null;
  created_at: string;
}

interface CourierSummary {
  courierId: number;
  name: string;
  deliveryCount: number;
  cashCollected: number;
  cardCollected: number;
  deposited: number;
  withdrawn: number;
  cashOnHand: number;
}

interface Summary {
  date: string;
  isClosed: boolean;
  cashIncome: number;
  cardIncome: number;
  totalExpense: number;
  staffPayments: number;
  trustGiven: number;
  trustReturned: number;
  courierCashCollected: number;
  openingCash: number;
  closingCash: number | null;
  netBalance: number;
  netCashBalance: number;
  orderCount: number;
  courierCashOnHand: number;
  couriers: CourierSummary[];
}

interface Totals {
  cashIncome: number;
  cardIncome: number;
  totalExpense: number;
  trustOutstanding: number;
  staffPayments: number;
}

type Tab = "overview" | "transactions" | "trust" | "dayclose";
type ModalType = "income" | "expense" | "trust" | "staff_payment" | null;

const EXPENSE_CATEGORIES = [
  "Market / Hammadde",
  "Kira",
  "Personel",
  "Elektrik / Su / Dogalgaz",
  "Ambalaj / Paket",
  "Temizlik",
  "Bakim / Onarim",
  "Ulasim / Akaryakit",
  "Vergi / Sigorta",
  "Diger",
];

const STAFF_PAYMENT_TYPES = ["Maas", "Avans", "Prim", "Fazla Mesai", "Diger"];

export default function KasaPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totals, setTotals] = useState<Totals>({ cashIncome: 0, cardIncome: 0, totalExpense: 0, trustOutstanding: 0, staffPayments: 0 });
  const [summary, setSummary] = useState<Summary | null>(null);
  const [filterType, setFilterType] = useState("all");

  const [modal, setModal] = useState<ModalType>(null);
  const [formAmount, setFormAmount] = useState("");
  const [formMethod, setFormMethod] = useState<"cash" | "card">("cash");
  const [formCategory, setFormCategory] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPerson, setFormPerson] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);

  const [closingCash, setClosingCash] = useState("");
  const [closingNotes, setClosingNotes] = useState("");
  const [closing, setClosing] = useState(false);

  const [staffList, setStaffList] = useState<{ id: number; name: string }[]>([]);

  const toast = useToast();

  const loadTransactions = useCallback(async () => {
    try {
      const res = await fetch(`/api/kasa/transactions?date=${date}&type=${filterType}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
        setTotals(data.totals || { cashIncome: 0, cardIncome: 0, totalExpense: 0, trustOutstanding: 0, staffPayments: 0 });
      }
    } catch {}
  }, [date, filterType]);

  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch(`/api/kasa/summary?date=${date}`);
      if (res.ok) setSummary(await res.json());
    } catch {}
  }, [date]);

  useEffect(() => {
    loadTransactions();
    loadSummary();
  }, [loadTransactions, loadSummary]);

  useEffect(() => {
    fetch("/api/staff").then(r => r.json()).then(data => {
      if (Array.isArray(data)) setStaffList(data.map((s: any) => ({ id: s.id, name: s.name })));
    }).catch(() => {});
  }, []);

  function openModal(type: ModalType) {
    setModal(type);
    setFormAmount("");
    setFormMethod("cash");
    setFormCategory(type === "expense" ? EXPENSE_CATEGORIES[0] : type === "staff_payment" ? STAFF_PAYMENT_TYPES[0] : "");
    setFormDescription("");
    setFormPerson("");
  }

  async function submitTransaction() {
    const amount = parseFloat(formAmount);
    if (!modal || !amount || amount <= 0) return;
    setFormSubmitting(true);

    try {
      const res = await fetch("/api/kasa/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: modal,
          amount,
          paymentMethod: modal === "trust" ? "cash" : formMethod,
          category: formCategory || undefined,
          description: formDescription || undefined,
          person: formPerson || undefined,
        }),
      });

      if (!res.ok) {
        toast.error("Islem kaydedilemedi");
        setFormSubmitting(false);
        return;
      }

      toast.success("Islem basariyla kaydedildi");
      setModal(null);
      loadTransactions();
      loadSummary();
    } catch {
      toast.error("Islem kaydedilirken bir hata olustu");
    }
    setFormSubmitting(false);
  }

  async function markTrustReturned(id: number) {
    try {
      const res = await fetch(`/api/kasa/transactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isReturned: true }),
      });
      if (!res.ok) {
        toast.error("Emanet iade islemi basarisiz");
        return;
      }
      toast.success("Emanet iade edildi");
      loadTransactions();
      loadSummary();
    } catch {
      toast.error("Emanet iade edilirken bir hata olustu");
    }
  }

  async function closeDay() {
    setClosing(true);
    try {
      const res = await fetch("/api/kasa/close-day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          closingCash: closingCash ? parseFloat(closingCash) : undefined,
          notes: closingNotes || undefined,
        }),
      });
      if (!res.ok) {
        toast.error("Gun kapatma islemi basarisiz");
        setClosing(false);
        return;
      }
      toast.success("Gun basariyla kapatildi");
      loadSummary();
    } catch {
      toast.error("Gun kapatilirken bir hata olustu");
    }
    setClosing(false);
  }

  function getTypeLabel(type: string) {
    switch (type) {
      case "income": return "Gelir";
      case "expense": return "Gider";
      case "trust": return "Emanet";
      case "staff_payment": return "Personel";
      default: return type;
    }
  }

  function getTypeColor(type: string) {
    switch (type) {
      case "income": return "bg-green-500/20 text-green-400";
      case "expense": return "bg-red-500/20 text-red-400";
      case "trust": return "bg-purple-500/20 text-purple-400";
      case "staff_payment": return "bg-orange-500/20 text-orange-400";
      default: return "bg-white/10 text-white/50";
    }
  }

  function formatTime(dt: string) {
    try {
      return new Date(dt.replace(" ", "T")).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    } catch { return ""; }
  }

  const trustActive = transactions.filter(t => t.type === "trust" && !t.is_returned);
  const trustReturned = transactions.filter(t => t.type === "trust" && t.is_returned);

  return (
    <div className="max-w-2xl mx-auto px-3 py-4 sm:p-4 space-y-4 overflow-x-hidden">
      <ToastContainer toasts={toast.toasts} />
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl font-bold">Muhasebe</h1>
          <p className="text-white/40 text-xs">Kasa ve gelir-gider yonetimi</p>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-surface-1 border border-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/50 shrink-0"
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-3 sm:p-4">
          <p className="text-green-400/60 text-[10px] sm:text-xs font-medium">Nakit Gelir</p>
          <p className="text-lg sm:text-2xl font-bold text-green-400">{(summary?.cashIncome || 0).toFixed(0)} <span className="text-xs sm:text-sm font-normal">TL</span></p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-3 sm:p-4">
          <p className="text-blue-400/60 text-[10px] sm:text-xs font-medium">Kart / POS Gelir</p>
          <p className="text-lg sm:text-2xl font-bold text-blue-400">{(summary?.cardIncome || 0).toFixed(0)} <span className="text-xs sm:text-sm font-normal">TL</span></p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-3 sm:p-4">
          <p className="text-red-400/60 text-[10px] sm:text-xs font-medium">Toplam Gider</p>
          <p className="text-lg sm:text-2xl font-bold text-red-400">{(summary?.totalExpense || 0).toFixed(0)} <span className="text-xs sm:text-sm font-normal">TL</span></p>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 sm:p-4">
          <p className="text-amber-400/60 text-[10px] sm:text-xs font-medium">Net Bakiye</p>
          <p className="text-lg sm:text-2xl font-bold text-amber-400">{(summary?.netBalance || 0).toFixed(0)} <span className="text-xs sm:text-sm font-normal">TL</span></p>
        </div>
      </div>

      {/* Kasa Nakit + Kurye Nakit */}
      {summary && (
        <div className="grid grid-cols-1 gap-3">
          <div className="bg-surface-1 border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-white/50 text-xs font-medium">Kasadaki Nakit</p>
              <span className="text-xs text-white/30">{summary.orderCount} siparis</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-white">{summary.netCashBalance.toFixed(0)} <span className="text-sm font-normal text-white/40">TL</span></p>
            <div className="flex flex-wrap gap-2 mt-2 text-[11px]">
              {summary.openingCash > 0 && <span className="bg-white/5 text-white/40 px-2 py-0.5 rounded-lg">Acilis: {summary.openingCash.toFixed(0)}</span>}
              {summary.staffPayments > 0 && <span className="bg-orange-500/10 text-orange-400/70 px-2 py-0.5 rounded-lg">Personel: -{summary.staffPayments.toFixed(0)}</span>}
              {summary.trustGiven > 0 && <span className="bg-purple-500/10 text-purple-400/70 px-2 py-0.5 rounded-lg">Emanet: -{summary.trustGiven.toFixed(0)}</span>}
              {summary.courierCashCollected > 0 && <span className="bg-green-500/10 text-green-400/70 px-2 py-0.5 rounded-lg">Kurye teslim: +{summary.courierCashCollected.toFixed(0)}</span>}
            </div>
          </div>
          {summary.courierCashOnHand > 0 && (
            <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-2xl p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/20 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-cyan-400/60 text-xs font-medium">Kurye Nakit</p>
                    <p className="text-[10px] text-white/30">Teslim edilmemis nakit</p>
                  </div>
                </div>
                <p className="text-lg sm:text-2xl font-bold text-cyan-400 shrink-0">{summary.courierCashOnHand.toFixed(0)} <span className="text-xs sm:text-sm font-normal">TL</span></p>
              </div>
              {summary.couriers && summary.couriers.filter(c => c.cashOnHand > 0).length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2 text-[11px]">
                  {summary.couriers.filter(c => c.cashOnHand > 0).map(c => (
                    <span key={c.courierId} className="bg-cyan-500/10 text-cyan-400/80 px-2 py-0.5 rounded-lg">
                      {c.name}: {c.cashOnHand.toFixed(0)} TL
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => openModal("income")} className="py-3 sm:py-3.5 rounded-2xl bg-green-600/20 border border-green-500/30 text-green-300 font-bold text-xs sm:text-sm transition-all active:scale-[0.97] flex items-center justify-center gap-1.5 sm:gap-2">
          <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" /></svg>
          <span className="truncate">Nakit Gelir Ekle</span>
        </button>
        <button onClick={() => openModal("expense")} className="py-3 sm:py-3.5 rounded-2xl bg-red-600/20 border border-red-500/30 text-red-300 font-bold text-xs sm:text-sm transition-all active:scale-[0.97] flex items-center justify-center gap-1.5 sm:gap-2">
          <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" /></svg>
          <span className="truncate">Gider Ekle</span>
        </button>
        <button onClick={() => openModal("trust")} className="py-3 sm:py-3.5 rounded-2xl bg-purple-600/20 border border-purple-500/30 text-purple-300 font-bold text-xs sm:text-sm transition-all active:scale-[0.97] flex items-center justify-center gap-1.5 sm:gap-2">
          <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
          <span className="truncate">Emanet Al</span>
        </button>
        <button onClick={() => openModal("staff_payment")} className="py-3 sm:py-3.5 rounded-2xl bg-orange-600/20 border border-orange-500/30 text-orange-300 font-bold text-xs sm:text-sm transition-all active:scale-[0.97] flex items-center justify-center gap-1.5 sm:gap-2">
          <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          <span className="truncate">Personel Ode</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-1 rounded-xl p-1 overflow-x-auto">
        {(["overview", "transactions", "trust", "dayclose"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 min-w-0 py-2 rounded-lg text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap ${tab === t ? "bg-accent text-black" : "text-white/40"}`}
          >
            {t === "overview" ? "Ozet" : t === "transactions" ? "Islemler" : t === "trust" ? "Emanet" : "Gun Sonu"}
          </button>
        ))}
      </div>

      {/* TAB: Overview */}
      {tab === "overview" && (
        <div className="space-y-3">
          <p className="text-white/50 text-xs font-medium">Son Islemler</p>
          {transactions.length === 0 && <p className="text-center py-8 text-white/20 text-sm">Bugun islem yok</p>}
          {transactions.slice(0, 20).map((tx) => (
            <div key={tx.id} className="bg-surface-1 rounded-xl p-3 flex items-center justify-between border border-border">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${getTypeColor(tx.type)}`}>{getTypeLabel(tx.type)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{tx.description || tx.category || tx.person || "-"}</p>
                  <p className="text-[11px] text-white/30">{formatTime(tx.created_at)} {tx.person && `· ${tx.person}`}</p>
                </div>
              </div>
              <div className="text-right shrink-0 ml-2">
                <p className={`font-bold text-sm ${tx.type === "income" ? "text-green-400" : "text-red-400"}`}>
                  {tx.type === "income" ? "+" : "-"}{tx.amount.toFixed(0)} TL
                </p>
                {tx.payment_method && <p className="text-[10px] text-white/20">{tx.payment_method === "cash" ? "Nakit" : "Kart"}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB: Transactions */}
      {tab === "transactions" && (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            {["all", "income", "expense", "trust", "staff_payment"].map((f) => (
              <button
                key={f}
                onClick={() => setFilterType(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterType === f ? "bg-accent text-black" : "bg-surface-1 text-white/40"}`}
              >
                {f === "all" ? "Tumu" : getTypeLabel(f)}
              </button>
            ))}
          </div>
          {transactions.length === 0 && <p className="text-center py-8 text-white/20 text-sm">Islem bulunamadi</p>}
          {transactions.map((tx) => (
            <div key={tx.id} className="bg-surface-1 rounded-xl p-3 border border-border">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${getTypeColor(tx.type)}`}>{getTypeLabel(tx.type)}</span>
                  {tx.category && <span className="text-[10px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded">{tx.category}</span>}
                </div>
                <span className="text-[11px] text-white/30">{formatTime(tx.created_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">{tx.description || "-"}</p>
                  {tx.person && <p className="text-[11px] text-white/40">Kisi: {tx.person}</p>}
                  {tx.createdByName && <p className="text-[10px] text-white/20">Kaydeden: {tx.createdByName}</p>}
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className={`font-bold ${tx.type === "income" ? "text-green-400" : "text-red-400"}`}>
                    {tx.type === "income" ? "+" : "-"}{tx.amount.toFixed(0)} TL
                  </p>
                  {tx.payment_method && <p className="text-[10px] text-white/30">{tx.payment_method === "cash" ? "Nakit" : "Kart"}</p>}
                </div>
              </div>
              {tx.type === "trust" && tx.is_returned ? (
                <p className="text-[10px] text-green-400/60 mt-1">Iade edildi: {tx.returned_at}</p>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {/* TAB: Trust / Emanet */}
      {tab === "trust" && (
        <div className="space-y-4">
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4 text-center">
            <p className="text-purple-400/60 text-xs">Bekleyen Emanet</p>
            <p className="text-2xl sm:text-3xl font-bold text-purple-400">{totals.trustOutstanding.toFixed(0)} TL</p>
          </div>

          {trustActive.length > 0 && (
            <div className="space-y-2">
              <p className="text-white/50 text-xs font-medium">Aktif Emanetler</p>
              {trustActive.map((tx) => (
                <div key={tx.id} className="bg-surface-1 rounded-xl p-3 border border-purple-500/20 flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate">{tx.person}</p>
                    <p className="text-white/40 text-[11px] truncate">{tx.description || "-"} · {formatTime(tx.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-purple-400 font-bold text-sm">{tx.amount.toFixed(0)} TL</span>
                    <button
                      onClick={() => markTrustReturned(tx.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-green-600/20 border border-green-500/30 text-green-300 text-[11px] font-bold active:scale-[0.97]"
                    >
                      Iade
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {trustActive.length === 0 && (
            <p className="text-center py-8 text-white/20 text-sm">Bekleyen emanet yok</p>
          )}

          {trustReturned.length > 0 && (
            <div className="space-y-2">
              <p className="text-white/30 text-xs font-medium">Iade Edilen Emanetler</p>
              {trustReturned.map((tx) => (
                <div key={tx.id} className="bg-surface-1/50 rounded-xl p-3 border border-border opacity-60">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white/60 text-sm">{tx.person}</p>
                      <p className="text-white/20 text-[11px]">{tx.description || "-"}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-white/40 font-bold text-sm line-through">{tx.amount.toFixed(0)} TL</span>
                      <p className="text-green-400/50 text-[10px]">Iade edildi</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: Day Close */}
      {tab === "dayclose" && summary && (
        <div className="space-y-4">
          {summary.isClosed && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 text-center">
              <svg className="w-8 h-8 text-green-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-green-400 font-bold">Bu gun kapatilmis</p>
            </div>
          )}

          <div className="bg-surface-1 rounded-2xl border border-border p-4 space-y-3">
            <p className="text-white/50 text-xs font-bold uppercase">Gun Sonu Raporu — {date}</p>
            <div className="space-y-2">
              {[
                { label: "Toplam Siparis", value: `${summary.orderCount} adet`, color: "text-white" },
                { label: "Nakit Gelir", value: `${summary.cashIncome.toFixed(0)} TL`, color: "text-green-400" },
                { label: "Kart Gelir", value: `${summary.cardIncome.toFixed(0)} TL`, color: "text-blue-400" },
                { label: "Toplam Gelir", value: `${(summary.cashIncome + summary.cardIncome).toFixed(0)} TL`, color: "text-green-400" },
                { label: "Toplam Gider", value: `-${summary.totalExpense.toFixed(0)} TL`, color: "text-red-400" },
                { label: "Personel Odemeler", value: `-${summary.staffPayments.toFixed(0)} TL`, color: "text-orange-400" },
                { label: "Emanet Verilen", value: `-${summary.trustGiven.toFixed(0)} TL`, color: "text-purple-400" },
                { label: "Emanet Iade", value: `+${summary.trustReturned.toFixed(0)} TL`, color: "text-purple-300" },
                { label: "Kurye Tahsilat (kasaya)", value: `${summary.courierCashCollected.toFixed(0)} TL`, color: "text-white/60" },
                { label: "Kurye Nakit (elde)", value: `${(summary.courierCashOnHand || 0).toFixed(0)} TL`, color: "text-cyan-400" },
              ].map((row, i) => (
                <div key={i} className="flex justify-between items-center py-1.5 border-b border-white/5 last:border-0">
                  <span className="text-white/50 text-sm">{row.label}</span>
                  <span className={`font-bold text-sm ${row.color}`}>{row.value}</span>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t border-white/10">
              <div className="flex justify-between items-center gap-2">
                <span className="text-white font-bold text-sm sm:text-base">Net Bakiye</span>
                <span className="text-xl sm:text-2xl font-bold text-amber-400">{summary.netBalance.toFixed(0)} TL</span>
              </div>
              <div className="flex justify-between items-center mt-1 gap-2">
                <span className="text-white/40 text-xs sm:text-sm">Kasadaki Nakit</span>
                <span className="text-base sm:text-lg font-bold text-white">{summary.netCashBalance.toFixed(0)} TL</span>
              </div>
            </div>
          </div>

          {/* Courier Summary */}
          {summary.couriers && summary.couriers.length > 0 && (
            <div className="bg-surface-1 rounded-2xl border border-border p-4 space-y-3">
              <p className="text-white/50 text-xs font-bold uppercase">Kurye Ozeti</p>
              {summary.couriers.map((c) => (
                <div key={c.courierId} className="bg-surface-2 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-bold text-sm">{c.name}</span>
                    <span className="text-white/40 text-xs">{c.deliveryCount} teslimat</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-white/40">Nakit tahsilat</span>
                      <span className="text-green-400 font-bold">{c.cashCollected.toFixed(0)} TL</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/40">POS tahsilat</span>
                      <span className="text-blue-400 font-bold">{c.cardCollected.toFixed(0)} TL</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/40">Kasaya teslim</span>
                      <span className="text-amber-400 font-bold">{c.deposited.toFixed(0)} TL</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/40">Kasadan alinan</span>
                      <span className="text-cyan-400 font-bold">{c.withdrawn.toFixed(0)} TL</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-white/5">
                    <span className="text-white/50 text-xs">Elde kalan nakit</span>
                    <span className={`font-bold text-sm ${c.cashOnHand > 0 ? "text-red-400" : "text-green-400"}`}>
                      {c.cashOnHand.toFixed(0)} TL
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!summary.isClosed && (
            <div className="bg-surface-1 rounded-2xl border border-border p-4 space-y-3">
              <p className="text-white/50 text-xs font-bold uppercase">Gunu Kapat</p>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Kasadaki Gercek Nakit (sayim)</label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={closingCash}
                    onChange={(e) => setClosingCash(e.target.value)}
                    placeholder={summary.netCashBalance.toFixed(0)}
                    className="w-full bg-neutral-800 rounded-xl px-4 py-3 text-white text-lg font-bold border border-neutral-700/50 focus:outline-none focus:border-accent/50"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30">TL</span>
                </div>
                {closingCash && (
                  <p className={`text-xs mt-1 ${parseFloat(closingCash) === Math.round(summary.netCashBalance) ? "text-green-400" : "text-red-400"}`}>
                    {parseFloat(closingCash) === Math.round(summary.netCashBalance)
                      ? "Kasa tutarli"
                      : `Fark: ${(parseFloat(closingCash) - summary.netCashBalance).toFixed(0)} TL`}
                  </p>
                )}
              </div>
              <textarea
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                placeholder="Notlar (istege bagli)..."
                rows={2}
                className="w-full bg-neutral-800 rounded-xl px-4 py-3 text-white text-sm border border-neutral-700/50 focus:outline-none focus:border-accent/50 resize-none"
              />
              <button
                onClick={closeDay}
                disabled={closing}
                className="w-full py-4 rounded-2xl bg-accent text-black font-bold text-lg transition-all active:scale-[0.97] disabled:opacity-40"
              >
                {closing ? "Kapatiliyor..." : "Gunu Kapat"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Transaction Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => !formSubmitting && setModal(null)}>
          <div className="bg-neutral-900 rounded-3xl w-[92%] max-w-md p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className={`w-12 h-12 rounded-2xl mx-auto mb-2 flex items-center justify-center ${
                modal === "income" ? "bg-green-500/20" : modal === "expense" ? "bg-red-500/20" : modal === "trust" ? "bg-purple-500/20" : "bg-orange-500/20"
              }`}>
                {modal === "income" && <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" /></svg>}
                {modal === "expense" && <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" /></svg>}
                {modal === "trust" && <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
                {modal === "staff_payment" && <svg className="w-6 h-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
              </div>
              <h3 className="text-lg font-bold text-white">
                {modal === "income" ? "Nakit Gelir Ekle" : modal === "expense" ? "Gider Ekle" : modal === "trust" ? "Emanet Al" : "Personel Ode"}
              </h3>
            </div>

            {/* Amount */}
            <div className="relative">
              <input
                type="number"
                inputMode="numeric"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                className="w-full bg-neutral-800 rounded-2xl px-5 py-4 text-center text-2xl sm:text-3xl font-bold text-white border border-neutral-700/50 focus:outline-none focus:border-purple-500/50"
                placeholder="0"
                autoFocus
              />
              <span className="absolute right-5 top-1/2 -translate-y-1/2 text-white/30 font-bold text-lg">TL</span>
            </div>

            {/* Payment Method (not for trust) */}
            {modal !== "trust" && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setFormMethod("cash")}
                  className={`py-2.5 rounded-xl text-sm font-bold transition-all ${formMethod === "cash" ? "bg-green-500 text-black" : "bg-neutral-800 text-white/40"}`}
                >
                  Nakit
                </button>
                <button
                  onClick={() => setFormMethod("card")}
                  className={`py-2.5 rounded-xl text-sm font-bold transition-all ${formMethod === "card" ? "bg-blue-500 text-white" : "bg-neutral-800 text-white/40"}`}
                >
                  Kart / POS
                </button>
              </div>
            )}

            {/* Category (expense / staff_payment) */}
            {modal === "expense" && (
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-full bg-neutral-800 rounded-xl px-4 py-3 text-white text-sm border border-neutral-700/50 focus:outline-none"
              >
                {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}

            {modal === "staff_payment" && (
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-full bg-neutral-800 rounded-xl px-4 py-3 text-white text-sm border border-neutral-700/50 focus:outline-none"
              >
                {STAFF_PAYMENT_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}

            {/* Person (trust / staff_payment) */}
            {(modal === "trust" || modal === "staff_payment") && (
              <>
                <input
                  type="text"
                  value={formPerson}
                  onChange={(e) => setFormPerson(e.target.value)}
                  list="staff-names"
                  className="w-full bg-neutral-800 rounded-xl px-4 py-3 text-white text-sm border border-neutral-700/50 focus:outline-none focus:border-purple-500/50"
                  placeholder="Kisi adi"
                />
                <datalist id="staff-names">
                  {staffList.map((s) => <option key={s.id} value={s.name} />)}
                </datalist>
              </>
            )}

            {/* Description */}
            <input
              type="text"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="w-full bg-neutral-800 rounded-xl px-4 py-3 text-white text-sm border border-neutral-700/50 focus:outline-none focus:border-purple-500/50"
              placeholder={modal === "income" ? "Aciklama (istege bagli)" : modal === "expense" ? "Gider detayi" : modal === "trust" ? "Aciklama" : "Odeme aciklamasi"}
            />

            {/* Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setModal(null)} className="py-3.5 rounded-2xl bg-neutral-800 text-white/50 font-bold text-sm">
                Iptal
              </button>
              <button
                onClick={submitTransaction}
                disabled={formSubmitting || !formAmount || parseFloat(formAmount) <= 0 || ((modal === "trust" || modal === "staff_payment") && !formPerson.trim())}
                className={`py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-[0.97] disabled:opacity-40 ${
                  modal === "income" ? "bg-green-500 text-black" :
                  modal === "expense" ? "bg-red-500 text-white" :
                  modal === "trust" ? "bg-purple-500 text-white" :
                  "bg-orange-500 text-black"
                }`}
              >
                {formSubmitting ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
