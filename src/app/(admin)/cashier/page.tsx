"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/hooks/useToast";
import { ToastContainer } from "@/components/ToastContainer";

interface Order {
  id: number;
  customerName: string | null;
  tableNumber: number | null;
  source: string;
  total: number;
  subtotal: number;
  paymentMethod: string | null;
  status: string;
  deliveryAddress: string | null;
  createdAt: string;
  items?: OrderItemDetail[];
}

interface CourierPendingOrder {
  id: number;
  customerName: string | null;
  total: number;
  paidAmount: number;
  payMethod: string;
  deliveredAt: string | null;
}

interface CourierGroup {
  courierId: number;
  courierName: string;
  orders: CourierPendingOrder[];
  total: number;
}

interface OrderItemDetail {
  id: number;
  orderId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  extras: { id: number; name: string; price: number }[];
  removed: string[];
  notes: string | null;
}

interface SessionOrder extends Order {
  items: OrderItemDetail[];
}

interface TableSessionData {
  session: { id: number; tableNumber: number; status: string; openedAt: string; total: number };
  unpaidCount: number;
  orders: SessionOrder[];
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
  orders: { totalOrders: number; totalRevenue: number; totalCollected: number; totalDiscount: number; cancelledOrders: number };
  paymentBreakdown: { method: string; total: number; count: number }[];
  cashMovements: { type: string; total: number }[];
  sourceBreakdown: { source: string; count: number; total: number }[];
}

interface MenuCat { id: number; name: string }
interface MenuItemRaw { id: number; name: string; price: number; categoryId: number; imageUrl: string | null }

type Tab = "orders" | "expenses" | "register" | "zreport";

const SOURCE_LABELS: Record<string, string> = {
  manual: "Mekan", whatsapp: "WhatsApp", phone: "Telefon", walk_in: "Gel-Al", qr: "QR",
};

const EXPENSE_CATEGORIES = [
  "Malzeme / Hammadde", "Personel", "Kira", "Elektrik / Su / Dogalgaz",
  "Ambalaj / Paket", "Temizlik", "Bakim / Onarim", "Ulasim / Akaryakit", "Vergi / Sigorta", "Diger",
];

const TYPE_LABELS: Record<string, string> = {
  sale: "Satis", refund: "Iade", deposit: "Para Girisi", withdrawal: "Para Cikisi", opening: "Kasa Acilis", closing: "Kasa Kapanis",
};
const TYPE_COLORS: Record<string, string> = {
  sale: "text-green-400", refund: "text-red-400", deposit: "text-blue-400", withdrawal: "text-orange-400", opening: "text-purple-400", closing: "text-white/40",
};

export default function CashierPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("orders");

  const [tableSessions, setTableSessions] = useState<TableSessionData[]>([]);
  const [packageOrders, setPackageOrders] = useState<Order[]>([]);
  const [selectedTable, setSelectedTable] = useState<TableSessionData | null>(null);
  const [payingOrder, setPayingOrder] = useState<Order | null>(null);

  // Payment state for whole-table or single package
  const [chargedAmount, setChargedAmount] = useState("");
  const [payMethod, setPayMethod] = useState<"cash" | "card">("cash");
  const [receivedCash, setReceivedCash] = useState("");

  // Individual order payment within table
  const [payingSingleOrder, setPayingSingleOrder] = useState<SessionOrder | null>(null);
  const [singleChargedAmount, setSingleChargedAmount] = useState("");
  const [singlePayMethod, setSinglePayMethod] = useState<"cash" | "card">("cash");
  const [singleReceivedCash, setSingleReceivedCash] = useState("");

  // Courier cash tracking
  const [courierGroups, setCourierGroups] = useState<CourierGroup[]>([]);
  const [selectedCourierOrders, setSelectedCourierOrders] = useState<Set<number>>(new Set());
  const [courierAdvanceModal, setCourierAdvanceModal] = useState(false);

  // Add item to table
  const [addItemTable, setAddItemTable] = useState<number | null>(null);
  const [menuCats, setMenuCats] = useState<MenuCat[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemRaw[]>([]);
  const [addCart, setAddCart] = useState<{ menuItemId: number; name: string; price: number; qty: number }[]>([]);

  // Existing tabs state
  const [register, setRegister] = useState<{ movements: CashRegisterEntry[]; balance: number }>({ movements: [], balance: 0 });
  const [zReport, setZReport] = useState<ZReport | null>(null);
  const [addCashModal, setAddCashModal] = useState(false);
  const [zDate, setZDate] = useState(new Date().toISOString().split("T")[0]);
  const [expenses, setExpenses] = useState<{ entries: FinanceEntry[]; totals: { income: number; expense: number; net: number } }>({ entries: [], totals: { income: 0, expense: 0, net: 0 } });
  const [expenseModal, setExpenseModal] = useState(false);
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/tables/sessions/open");
      const data = await res.json();
      setTableSessions(data.sessions || []);
    } catch {}
  }, []);

  const loadPackages = useCallback(async () => {
    try {
      const res = await fetch("/api/orders?limit=100&items=true");
      const orders: Order[] = await res.json();
      setPackageOrders(orders.filter((o) => !o.paymentMethod && o.status !== "cancelled" && !o.tableNumber));
    } catch {}
  }, []);

  const loadCourierPending = useCallback(async () => {
    try {
      const res = await fetch("/api/payments/courier-pending");
      if (res.ok) setCourierGroups(await res.json());
    } catch {}
  }, []);

  const loadRegister = useCallback(async () => {
    try {
      const res = await fetch("/api/payments/cash-register");
      setRegister(await res.json());
    } catch {}
  }, []);

  const loadZReport = useCallback(async () => {
    try {
      const res = await fetch(`/api/payments/z-report?date=${zDate}`);
      setZReport(await res.json());
    } catch {}
  }, [zDate]);

  const loadExpenses = useCallback(async () => {
    try {
      const res = await fetch(`/api/expenses?date=${expenseDate}`);
      setExpenses(await res.json());
    } catch {}
  }, [expenseDate]);

  function loadAll() {
    loadSessions();
    loadPackages();
    loadCourierPending();
    loadRegister();
    loadZReport();
  }

  useEffect(() => {
    loadAll();
    loadExpenses();
    const iv = setInterval(() => { loadSessions(); loadPackages(); loadCourierPending(); }, 10000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => { loadZReport(); }, [zDate]);
  useEffect(() => { loadExpenses(); }, [expenseDate]);

  // ── Table detail ──
  function openTableDetail(ts: TableSessionData) {
    setSelectedTable(ts);
    setPayingSingleOrder(null);
    const unpaidTotal = ts.orders.filter((o) => !o.paymentMethod).reduce((s, o) => s + o.total, 0);
    setChargedAmount(unpaidTotal.toFixed(0));
    setPayMethod("cash");
    setReceivedCash("");
  }

  async function refreshTableDetail(tableNumber: number) {
    try {
      await loadSessions();
      const sessRes = await fetch("/api/tables/sessions/open");
      const sessData = await sessRes.json();
      const found = (sessData.sessions || []).find((s: TableSessionData) => s.session.tableNumber === tableNumber);
      if (found) {
        setSelectedTable(found);
        const unpaidTotal = found.orders.filter((o: SessionOrder) => !o.paymentMethod).reduce((s: number, o: SessionOrder) => s + o.total, 0);
        setChargedAmount(unpaidTotal.toFixed(0));
      } else {
        setSelectedTable(null);
      }
    } catch {}
  }

  async function removeItem(orderId: number, itemId: number) {
    try {
      const res = await fetch(`/api/orders/${orderId}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeItemId: itemId }),
      });
      if (!res.ok) toast.error("Islem basarisiz");
      if (selectedTable) refreshTableDetail(selectedTable.session.tableNumber);
    } catch {
      toast.error("Baglanti hatasi");
    }
  }

  async function updateItemQty(orderId: number, itemId: number, qty: number) {
    try {
      const res = await fetch(`/api/orders/${orderId}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updateItem: { itemId, quantity: qty } }),
      });
      if (!res.ok) toast.error("Islem basarisiz");
      if (selectedTable) refreshTableDetail(selectedTable.session.tableNumber);
    } catch {
      toast.error("Baglanti hatasi");
    }
  }

  // Pay ALL unpaid orders on this table
  async function payTable() {
    if (!selectedTable) return;
    const unpaidOrders = selectedTable.orders.filter((o) => !o.paymentMethod);
    if (unpaidOrders.length === 0) return;

    const charged = parseFloat(chargedAmount) || 0;
    const received = parseFloat(receivedCash) || charged;

    try {
      let remaining = charged;
      for (let i = 0; i < unpaidOrders.length; i++) {
        const o = unpaidOrders[i];
        const isLast = i === unpaidOrders.length - 1;
        const amt = isLast ? remaining : Math.min(o.total, remaining);
        const res = await fetch("/api/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: o.id,
            amount: amt,
            method: payMethod,
            receivedAmount: isLast ? received : amt,
          }),
        });
        if (!res.ok) { toast.error("Islem basarisiz"); return; }
        remaining -= amt;
      }
      toast.success("Odeme alindi");
      setSelectedTable(null);
      loadAll();
    } catch {
      toast.error("Baglanti hatasi");
    }
  }

  // Pay a SINGLE order within table
  function openSingleOrderPay(order: SessionOrder) {
    setPayingSingleOrder(order);
    setSingleChargedAmount(order.total.toFixed(0));
    setSinglePayMethod("cash");
    setSingleReceivedCash("");
  }

  async function paySingleOrder() {
    if (!payingSingleOrder || !selectedTable) return;
    const charged = parseFloat(singleChargedAmount) || payingSingleOrder.total;
    const received = parseFloat(singleReceivedCash) || charged;

    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: payingSingleOrder.id,
          amount: charged,
          method: singlePayMethod,
          receivedAmount: received,
        }),
      });
      if (!res.ok) { toast.error("Islem basarisiz"); return; }
      toast.success("Odeme alindi");
      setPayingSingleOrder(null);
      refreshTableDetail(selectedTable.session.tableNumber);
      loadRegister();
      loadZReport();
    } catch {
      toast.error("Baglanti hatasi");
    }
  }

  async function quickApproveSingleOrder(order: SessionOrder) {
    if (!selectedTable) return;
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          amount: order.total,
          method: "cash",
          receivedAmount: order.total,
        }),
      });
      if (!res.ok) { toast.error("Islem basarisiz"); return; }
      toast.success("Odeme alindi");
      refreshTableDetail(selectedTable.session.tableNumber);
      loadRegister();
      loadZReport();
    } catch {
      toast.error("Baglanti hatasi");
    }
  }

  // ── Package payment ──
  function openPayPackage(order: Order) {
    setPayingOrder(order);
    setChargedAmount(order.total.toFixed(0));
    setPayMethod("cash");
    setReceivedCash("");
  }

  async function payPackage() {
    if (!payingOrder) return;
    const charged = parseFloat(chargedAmount) || payingOrder.total;
    const received = parseFloat(receivedCash) || charged;

    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: payingOrder.id,
          amount: charged,
          method: payMethod,
          receivedAmount: received,
        }),
      });
      if (!res.ok) { toast.error("Islem basarisiz"); return; }
      toast.success("Odeme alindi");
      setPayingOrder(null);
      loadAll();
    } catch {
      toast.error("Baglanti hatasi");
    }
  }

  async function quickApprovePackage(order: Order) {
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          amount: order.total,
          method: "cash",
          receivedAmount: order.total,
        }),
      });
      if (!res.ok) { toast.error("Islem basarisiz"); return; }
      toast.success("Odeme alindi");
      loadAll();
    } catch {
      toast.error("Baglanti hatasi");
    }
  }

  // ── Add item to table ──
  async function openAddItem(tableNumber: number) {
    setAddItemTable(tableNumber);
    setAddCart([]);
    if (menuCats.length === 0) {
      try {
        const [cRes, iRes] = await Promise.all([fetch("/api/menu/categories"), fetch("/api/menu/items")]);
        if (!cRes.ok || !iRes.ok) { toast.error("Islem basarisiz"); return; }
        setMenuCats(await cRes.json());
        setMenuItems(await iRes.json());
      } catch {
        toast.error("Baglanti hatasi");
      }
    }
  }

  function addToTempCart(item: MenuItemRaw) {
    setAddCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.id);
      if (existing) return prev.map((c) => c.menuItemId === item.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { menuItemId: item.id, name: item.name, price: item.price, qty: 1 }];
    });
  }

  async function submitAddItems() {
    if (!addItemTable || addCart.length === 0) return;
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "manual",
          tableNumber: addItemTable,
          items: addCart.map((c) => ({ menuItemId: c.menuItemId, quantity: c.qty })),
        }),
      });
      if (!res.ok) { toast.error("Islem basarisiz"); return; }
      const tbl = addItemTable;
      setAddItemTable(null);
      setAddCart([]);
      if (selectedTable && selectedTable.session.tableNumber === tbl) {
        refreshTableDetail(tbl);
      }
      loadSessions();
    } catch {
      toast.error("Baglanti hatasi");
    }
  }

  // ── Courier cash collection ──
  function toggleCourierOrder(orderId: number) {
    setSelectedCourierOrders((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  function selectAllCourierOrders(group: CourierGroup) {
    setSelectedCourierOrders((prev) => {
      const next = new Set(prev);
      const allSelected = group.orders.every((o) => prev.has(o.id));
      for (const o of group.orders) {
        if (allSelected) next.delete(o.id); else next.add(o.id);
      }
      return next;
    });
  }

  async function collectCourierCash(method: "cash" | "card") {
    if (selectedCourierOrders.size === 0) return;
    try {
      const res = await fetch("/api/payments/courier-collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: Array.from(selectedCourierOrders), method }),
      });
      if (!res.ok) { toast.error("Islem basarisiz"); return; }
      toast.success("Odeme alindi");
      setSelectedCourierOrders(new Set());
      loadAll();
    } catch {
      toast.error("Baglanti hatasi");
    }
  }

  async function submitCourierAdvance(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/payments/cash-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "withdrawal",
          amount: parseFloat(fd.get("amount") as string),
          description: `Kuryeye nakit - ${fd.get("courierName") || ""}`.trim(),
        }),
      });
      if (!res.ok) { toast.error("Islem basarisiz"); return; }
      setCourierAdvanceModal(false);
      loadRegister();
      loadZReport();
    } catch {
      toast.error("Baglanti hatasi");
    }
  }

  // ── Existing tab handlers ──
  async function addCashMovement(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/payments/cash-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: fd.get("type"), amount: parseFloat(fd.get("amount") as string), description: fd.get("description") || null }),
      });
      if (!res.ok) { toast.error("Islem basarisiz"); return; }
      setAddCashModal(false);
      loadRegister();
      loadZReport();
    } catch {
      toast.error("Baglanti hatasi");
    }
  }

  async function addExpense(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "expense", category: fd.get("category"), amount: parseFloat(fd.get("amount") as string), description: fd.get("description") || null, date: expenseDate }),
      });
      if (!res.ok) { toast.error("Islem basarisiz"); return; }
      setExpenseModal(false);
      loadExpenses();
      loadZReport();
    } catch {
      toast.error("Baglanti hatasi");
    }
  }

  const totalBadge = tableSessions.length + packageOrders.length;

  // Hesap vs tahsil summary for table
  const tableUnpaidTotal = selectedTable ? selectedTable.orders.filter((o) => !o.paymentMethod).reduce((s, o) => s + o.total, 0) : 0;
  const tablePaidTotal = selectedTable ? selectedTable.orders.filter((o) => o.paymentMethod).reduce((s, o) => s + o.total, 0) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Kasa</h2>
        <div className="flex gap-1 bg-surface-2 rounded-xl p-1">
          {([["orders", "Siparisler"], ["expenses", "Giderler"], ["register", "Kasa"], ["zreport", "Z Raporu"]] as [Tab, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t ? "bg-accent text-black" : "text-white/40 hover:text-white"}`}>
              {label}
              {t === "orders" && totalBadge > 0 && <span className="ml-1.5 bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5">{totalBadge}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════ SIPARISLER TAB - SPLIT VIEW ══════════ */}
      {tab === "orders" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT: MASALAR */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              Masalar
              {tableSessions.length > 0 && <span className="bg-amber-500/20 text-amber-400 text-xs px-2 py-0.5 rounded-full">{tableSessions.length}</span>}
            </h3>
            <div className="space-y-3">
              {tableSessions.map((ts) => {
                const elapsed = Math.floor((Date.now() - new Date(ts.session.openedAt).getTime()) / 60000);
                const allItems = ts.orders.flatMap((o) => o.items);
                return (
                  <div key={ts.session.id} className="card cursor-pointer hover:border-amber-500/30 transition-all" onClick={() => openTableDetail(ts)}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="bg-amber-500/20 text-amber-400 font-extrabold text-lg w-10 h-10 rounded-xl flex items-center justify-center">{ts.session.tableNumber}</div>
                        <div>
                          <p className="font-semibold text-white text-sm">Masa {ts.session.tableNumber}</p>
                          <p className="text-white/30 text-xs">{elapsed} dk &middot; {ts.orders.length} siparis</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-amber-400 font-extrabold text-xl">{ts.session.total.toFixed(0)} TL</p>
                        {ts.unpaidCount > 0 && <p className="text-red-400/70 text-[10px]">{ts.unpaidCount} odenmemis</p>}
                      </div>
                    </div>
                    <div className="space-y-0.5 mt-2">
                      {allItems.slice(0, 4).map((item, i) => (
                        <div key={i} className="flex justify-between text-xs text-white/50">
                          <span>{item.quantity}x {item.name}</span>
                          <span>{item.totalPrice.toFixed(0)} TL</span>
                        </div>
                      ))}
                      {allItems.length > 4 && <p className="text-white/20 text-[10px]">+{allItems.length - 4} urun daha</p>}
                    </div>
                  </div>
                );
              })}
              {tableSessions.length === 0 && <div className="text-center py-8 text-white/20 text-sm">Acik masa yok</div>}
            </div>
          </div>

          {/* RIGHT: PAKETLER + KURYE */}
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                Paketler & Gel-Al
                {packageOrders.length > 0 && <span className="bg-purple-500/20 text-purple-400 text-xs px-2 py-0.5 rounded-full">{packageOrders.length}</span>}
              </h3>
              <div className="space-y-3">
                {packageOrders.map((order) => (
                  <div key={order.id} className="card">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-bold">#{order.id}</span>
                        <span className="ml-2 text-xs text-white/40">{SOURCE_LABELS[order.source] || order.source}</span>
                      </div>
                      <span className="text-xl font-bold text-accent">{order.total.toFixed(0)} TL</span>
                    </div>
                    <div className="text-sm text-white/40 mb-2">
                      {order.customerName && <p>{order.customerName}</p>}
                      {order.deliveryAddress && <p className="text-xs truncate">{order.deliveryAddress}</p>}
                    </div>
                    {order.items && order.items.length > 0 && (
                      <div className="space-y-0.5 mb-3 bg-neutral-800/30 rounded-lg p-2">
                        {order.items.map((item, i) => (
                          <div key={i} className="flex justify-between text-xs">
                            <div className="flex-1 min-w-0">
                              <span className="text-white/50 font-bold">{item.quantity}x</span>
                              <span className="text-white/70 ml-1">{item.name}</span>
                              {item.extras.length > 0 && <span className="text-amber-400/50 ml-1">+{item.extras.map((e) => e.name).join(", ")}</span>}
                              {item.removed.length > 0 && <span className="text-red-400/50 ml-1">-{item.removed.join(", ")}</span>}
                            </div>
                            <span className="text-white/40 shrink-0 ml-2">{item.totalPrice.toFixed(0)} TL</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => quickApprovePackage(order)} className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-sm transition-all active:scale-[0.97]">
                        Onayla {order.total.toFixed(0)} TL
                      </button>
                      <button onClick={() => openPayPackage(order)} className="px-4 py-2.5 rounded-xl bg-surface-2 hover:bg-neutral-700 text-white/60 font-medium text-sm transition-all">
                        Duzenle
                      </button>
                    </div>
                  </div>
                ))}
                {packageOrders.length === 0 && <div className="text-center py-8 text-white/20 text-sm">Odenmemis paket yok</div>}
              </div>
            </div>

            {/* KURYE HESABI */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  Kurye Hesabi
                  {courierGroups.length > 0 && <span className="bg-orange-500/20 text-orange-400 text-xs px-2 py-0.5 rounded-full">{courierGroups.reduce((s, g) => s + g.orders.length, 0)}</span>}
                </h3>
                <button onClick={() => setCourierAdvanceModal(true)} className="px-3 py-1.5 bg-orange-600/20 text-orange-400 rounded-lg text-xs font-medium hover:bg-orange-600/30">
                  Kuryeye Nakit Ver
                </button>
              </div>

              {courierGroups.map((group) => {
                const allSelected = group.orders.every((o) => selectedCourierOrders.has(o.id));
                const selectedTotal = group.orders.filter((o) => selectedCourierOrders.has(o.id)).reduce((s, o) => s + o.paidAmount, 0);
                return (
                  <div key={group.courierId} className="card mb-3">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="bg-orange-500/20 text-orange-400 font-bold text-sm w-8 h-8 rounded-lg flex items-center justify-center">K</div>
                        <div>
                          <p className="font-semibold text-white text-sm">{group.courierName}</p>
                          <p className="text-white/30 text-xs">{group.orders.length} teslimat</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-orange-400 font-extrabold text-lg">{group.total.toFixed(0)} TL</p>
                        <button onClick={() => selectAllCourierOrders(group)} className="text-white/30 text-[10px] hover:text-white/60">
                          {allSelected ? "Secimi kaldir" : "Tumunu sec"}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {group.orders.map((o) => (
                        <label key={o.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${selectedCourierOrders.has(o.id) ? "bg-orange-600/10 border border-orange-500/30" : "bg-neutral-800/30 border border-transparent"}`}>
                          <input type="checkbox" checked={selectedCourierOrders.has(o.id)} onChange={() => toggleCourierOrder(o.id)} className="accent-orange-500" />
                          <div className="flex-1 min-w-0">
                            <span className="text-white/50 text-xs font-bold">#{o.id}</span>
                            {o.customerName && <span className="text-white/40 text-xs ml-1">{o.customerName}</span>}
                            <span className={`ml-1 text-[10px] px-1 py-0.5 rounded ${o.payMethod === "cash" ? "bg-green-600/20 text-green-400" : "bg-blue-600/20 text-blue-400"}`}>
                              {o.payMethod === "cash" ? "Nakit" : "Kart"}
                            </span>
                          </div>
                          <span className="text-white/60 text-sm font-semibold">{o.paidAmount.toFixed(0)} TL</span>
                        </label>
                      ))}
                    </div>

                    {selectedTotal > 0 && (
                      <div className="grid grid-cols-2 gap-2 mt-3">
                        <button onClick={() => collectCourierCash("cash")} className="py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-sm transition-all active:scale-[0.97]">
                          Nakit Tahsil {selectedTotal.toFixed(0)} TL
                        </button>
                        <button onClick={() => collectCourierCash("card")} className="py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-all active:scale-[0.97]">
                          Kart Tahsil {selectedTotal.toFixed(0)} TL
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {courierGroups.length === 0 && <div className="text-center py-6 text-white/20 text-sm">Kuryede bekleyen nakit yok</div>}
            </div>
          </div>
        </div>
      )}

      {/* ══════════ TABLE DETAIL MODAL ══════════ */}
      {selectedTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setSelectedTable(null)}>
          <div className="bg-neutral-900 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-neutral-800/60 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-bold text-white">Masa {selectedTable.session.tableNumber} Hesabi</h3>
                <p className="text-white/30 text-xs">{selectedTable.orders.length} siparis &middot; {new Date(selectedTable.session.openedAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} dan beri</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openAddItem(selectedTable.session.tableNumber)} className="px-3 py-1.5 bg-green-600/20 text-green-400 rounded-lg text-xs font-medium hover:bg-green-600/30">+ Urun Ekle</button>
                <button onClick={() => setSelectedTable(null)} className="w-8 h-8 bg-neutral-800 rounded-full flex items-center justify-center text-white/40 hover:text-white">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {selectedTable.orders.map((order) => (
                <div key={order.id} className={`rounded-xl p-4 ${order.paymentMethod ? "bg-green-900/10 border border-green-800/30" : "bg-neutral-800/30"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-amber-400/70 text-xs font-bold">#{order.id}</span>
                      <span className="text-white/20 text-xs">{new Date(order.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</span>
                      {order.paymentMethod && <span className="bg-green-600/20 text-green-400 text-[10px] px-1.5 py-0.5 rounded">Odendi</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white/50 text-xs font-semibold">{order.total.toFixed(0)} TL</span>
                      {!order.paymentMethod && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => quickApproveSingleOrder(order)} className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold rounded-lg transition-all" title="Hizli onayla">
                            Onayla
                          </button>
                          <button onClick={() => openSingleOrderPay(order)} className="px-2 py-1 bg-neutral-700 hover:bg-neutral-600 text-white/60 text-[10px] font-medium rounded-lg transition-all" title="Tutari duzenle">
                            Duzenle
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-1.5 group">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white/50 text-xs font-bold">{item.quantity}x</span>
                          <span className="text-white text-sm">{item.name}</span>
                        </div>
                        {item.removed.length > 0 && <p className="text-red-400/50 text-[10px] ml-6">- {item.removed.join(", ")}</p>}
                        {item.extras.length > 0 && <p className="text-amber-400/50 text-[10px] ml-6">+ {item.extras.map((e) => e.name).join(", ")}</p>}
                        {item.notes && <p className="text-blue-400/40 text-[10px] ml-6 italic">{item.notes}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-white/40 text-xs">{item.totalPrice.toFixed(0)} TL</span>
                        {!order.paymentMethod && (
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => updateItemQty(order.id, item.id, item.quantity - 1)} className="w-5 h-5 bg-neutral-700 rounded text-white/40 hover:text-white text-xs flex items-center justify-center">-</button>
                            <button onClick={() => updateItemQty(order.id, item.id, item.quantity + 1)} className="w-5 h-5 bg-neutral-700 rounded text-white/40 hover:text-white text-xs flex items-center justify-center">+</button>
                            <button onClick={() => removeItem(order.id, item.id)} className="w-5 h-5 bg-red-900/50 rounded text-red-400/60 hover:text-red-400 text-xs flex items-center justify-center">×</button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Single order payment inline */}
                  {payingSingleOrder?.id === order.id && (
                    <div className="mt-3 pt-3 border-t border-neutral-700/50 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-white/40">Hesap</span>
                        <span className="text-white/60 font-semibold">{order.total.toFixed(0)} TL</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-white text-xs font-semibold shrink-0">Tahsil:</span>
                        <input type="number" value={singleChargedAmount} onChange={(e) => setSingleChargedAmount(e.target.value)} className="input-field text-sm font-bold text-amber-400 text-center flex-1 py-1.5" />
                        <span className="text-white/40 text-xs">TL</span>
                      </div>
                      {singleChargedAmount && parseFloat(singleChargedAmount) < order.total && (
                        <p className="text-orange-400/70 text-[10px] text-center">Indirim: {(order.total - parseFloat(singleChargedAmount)).toFixed(0)} TL</p>
                      )}
                      <div className="grid grid-cols-2 gap-1.5">
                        <label className={`flex items-center justify-center gap-1 p-1.5 rounded-lg cursor-pointer border text-xs transition-all ${singlePayMethod === "cash" ? "bg-green-600/20 border-green-500/50" : "bg-surface-2 border-transparent"}`}>
                          <input type="radio" checked={singlePayMethod === "cash"} onChange={() => setSinglePayMethod("cash")} className="hidden" />
                          <span className="font-medium">Nakit</span>
                        </label>
                        <label className={`flex items-center justify-center gap-1 p-1.5 rounded-lg cursor-pointer border text-xs transition-all ${singlePayMethod === "card" ? "bg-blue-600/20 border-blue-500/50" : "bg-surface-2 border-transparent"}`}>
                          <input type="radio" checked={singlePayMethod === "card"} onChange={() => setSinglePayMethod("card")} className="hidden" />
                          <span className="font-medium">Kart</span>
                        </label>
                      </div>
                      {singlePayMethod === "cash" && (
                        <input type="number" placeholder="Alinan nakit..." value={singleReceivedCash} onChange={(e) => setSingleReceivedCash(e.target.value)} className="input-field text-xs py-1.5" />
                      )}
                      <div className="flex gap-1.5">
                        <button onClick={() => setPayingSingleOrder(null)} className="flex-1 py-2 rounded-lg bg-neutral-800 text-white/30 text-xs font-medium">Iptal</button>
                        <button onClick={paySingleOrder} className="flex-1 py-2 rounded-lg bg-amber-500 text-black text-xs font-bold">Tahsil Et</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Table summary + pay all */}
            <div className="shrink-0 border-t border-neutral-800/60 p-5 space-y-3">
              {/* Hesap vs Tahsil summary */}
              <div className="bg-neutral-800/40 rounded-xl p-3 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">Toplam Hesap</span>
                  <span className="text-white/60 font-semibold">{selectedTable.session.total.toFixed(0)} TL</span>
                </div>
                {tablePaidTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-green-400/60">Tahsil Edilen</span>
                    <span className="text-green-400 font-semibold">{tablePaidTotal.toFixed(0)} TL</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-white">Kalan</span>
                  <span className="text-amber-400">{tableUnpaidTotal.toFixed(0)} TL</span>
                </div>
              </div>

              {tableUnpaidTotal > 0 && (
                <>
                  <div className="flex items-center gap-3">
                    <span className="text-white text-sm font-semibold shrink-0">Tahsil:</span>
                    <input
                      type="number"
                      value={chargedAmount}
                      onChange={(e) => setChargedAmount(e.target.value)}
                      className="input-field text-lg font-bold text-amber-400 text-center flex-1"
                    />
                    <span className="text-white/40">TL</span>
                  </div>
                  {chargedAmount && parseFloat(chargedAmount) < tableUnpaidTotal && (
                    <p className="text-orange-400/70 text-xs text-center">Indirim: {(tableUnpaidTotal - parseFloat(chargedAmount)).toFixed(0)} TL</p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <label className={`flex items-center justify-center gap-2 p-2.5 rounded-xl cursor-pointer border transition-all ${payMethod === "cash" ? "bg-green-600/20 border-green-500/50" : "bg-surface-2 border-transparent"}`}>
                      <input type="radio" checked={payMethod === "cash"} onChange={() => setPayMethod("cash")} className="hidden" />
                      <span className="font-medium text-sm">Nakit</span>
                    </label>
                    <label className={`flex items-center justify-center gap-2 p-2.5 rounded-xl cursor-pointer border transition-all ${payMethod === "card" ? "bg-blue-600/20 border-blue-500/50" : "bg-surface-2 border-transparent"}`}>
                      <input type="radio" checked={payMethod === "card"} onChange={() => setPayMethod("card")} className="hidden" />
                      <span className="font-medium text-sm">Kart</span>
                    </label>
                  </div>
                  {payMethod === "cash" && (
                    <input type="number" placeholder="Alinan nakit..." value={receivedCash} onChange={(e) => setReceivedCash(e.target.value)} className="input-field text-sm" />
                  )}
                  {payMethod === "cash" && receivedCash && parseFloat(receivedCash) > parseFloat(chargedAmount || "0") && (
                    <p className="text-green-400/70 text-xs text-center">Para ustu: {(parseFloat(receivedCash) - parseFloat(chargedAmount || "0")).toFixed(0)} TL</p>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <button type="button" onClick={() => { const ids = selectedTable.orders.map((o) => o.id); if (ids[0]) window.open(`/receipt/${ids[0]}`, "_blank"); }} className="py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white/50 font-medium text-sm">Yazdir</button>
                    <button type="button" onClick={() => setSelectedTable(null)} className="py-2.5 rounded-xl bg-neutral-800 text-white/30 font-medium text-sm">Kapat</button>
                    <Button onClick={payTable}>Tumunu Tahsil Et</Button>
                  </div>
                </>
              )}
              {tableUnpaidTotal === 0 && (
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => { const ids = selectedTable.orders.map((o) => o.id); if (ids[0]) window.open(`/receipt/${ids[0]}`, "_blank"); }} className="py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white/50 font-medium text-sm">Yazdir</button>
                  <button type="button" onClick={() => setSelectedTable(null)} className="py-2.5 rounded-xl bg-neutral-800 text-white/30 font-medium text-sm">Kapat</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════ PACKAGE PAYMENT MODAL ══════════ */}
      {payingOrder && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setPayingOrder(null)} />
          <div className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92%] max-w-[380px] bg-neutral-900 rounded-2xl p-4 space-y-3 border border-neutral-700/50 shadow-2xl shadow-black/60" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-sm">#{payingOrder.id}</span>
                <span className="ml-2 text-xs text-white/40">{SOURCE_LABELS[payingOrder.source] || payingOrder.source}</span>
              </div>
              <button onClick={() => setPayingOrder(null)} className="w-7 h-7 bg-neutral-800 rounded-lg flex items-center justify-center text-white/40">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {payingOrder.customerName && <p className="text-white/50 text-xs">{payingOrder.customerName}</p>}
            <div className="flex items-center gap-2">
              <span className="text-white/40 text-xs shrink-0">Tahsil:</span>
              <input type="number" value={chargedAmount} onChange={(e) => setChargedAmount(e.target.value)} className="input-field text-lg font-bold text-amber-400 text-center flex-1 py-2" />
              <span className="text-white/30 text-sm">/ {payingOrder.total.toFixed(0)} TL</span>
            </div>
            {chargedAmount && parseFloat(chargedAmount) < payingOrder.total && (
              <p className="text-orange-400/70 text-[11px] text-center">Indirim: {(payingOrder.total - parseFloat(chargedAmount)).toFixed(0)} TL</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setPayMethod("cash")} className={`py-2 rounded-xl text-sm font-bold transition-all ${payMethod === "cash" ? "bg-green-600/20 border border-green-500/50 text-green-300" : "bg-surface-2 text-white/40 border border-transparent"}`}>Nakit</button>
              <button onClick={() => setPayMethod("card")} className={`py-2 rounded-xl text-sm font-bold transition-all ${payMethod === "card" ? "bg-blue-600/20 border border-blue-500/50 text-blue-300" : "bg-surface-2 text-white/40 border border-transparent"}`}>Kart</button>
            </div>
            {payMethod === "cash" && (
              <input type="number" placeholder="Alinan nakit..." value={receivedCash} onChange={(e) => setReceivedCash(e.target.value)} className="input-field text-sm py-2" />
            )}
            {payMethod === "cash" && receivedCash && parseFloat(receivedCash) > parseFloat(chargedAmount || "0") && (
              <p className="text-green-400/70 text-[11px] text-center">Para ustu: {(parseFloat(receivedCash) - parseFloat(chargedAmount || "0")).toFixed(0)} TL</p>
            )}
            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={() => window.open(`/receipt/${payingOrder.id}`, "_blank")} className="py-2.5 rounded-xl bg-neutral-800 text-white/50 font-medium text-xs">Yazdir</button>
              <button type="button" onClick={() => setPayingOrder(null)} className="py-2.5 rounded-xl bg-neutral-800 text-white/30 font-medium text-xs">Iptal</button>
              <Button onClick={payPackage}>Tahsil Et</Button>
            </div>
          </div>
        </>
      )}

      {/* ══════════ ADD ITEM TO TABLE MODAL ══════════ */}
      <Modal open={addItemTable !== null} onClose={() => { setAddItemTable(null); setAddCart([]); }} title={`Masa ${addItemTable} - Urun Ekle`}>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {menuCats.map((cat) => {
            const catItems = menuItems.filter((i) => i.categoryId === cat.id);
            if (catItems.length === 0) return null;
            return (
              <div key={cat.id}>
                <p className="text-xs text-white/30 font-semibold mb-1">{cat.name}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {catItems.map((item) => {
                    const inCart = addCart.find((c) => c.menuItemId === item.id);
                    return (
                      <button key={item.id} onClick={() => addToTempCart(item)} className={`text-left p-2 rounded-lg text-sm transition-all ${inCart ? "bg-amber-500/20 border border-amber-500/40" : "bg-surface-2 border border-transparent hover:border-white/10"}`}>
                        <div className="flex justify-between items-center">
                          <span className="text-white/80 text-xs">{item.name}</span>
                          <span className="text-amber-400 text-xs font-bold">{item.price.toFixed(0)}</span>
                        </div>
                        {inCart && <span className="text-amber-400 text-[10px] font-bold">{inCart.qty} adet</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {addCart.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-white/50">{addCart.reduce((s, c) => s + c.qty, 0)} urun</span>
              <span className="text-amber-400 font-bold">{addCart.reduce((s, c) => s + c.price * c.qty, 0).toFixed(0)} TL</span>
            </div>
            <Button className="w-full" onClick={submitAddItems}>Masaya Ekle</Button>
          </div>
        )}
      </Modal>

      {/* ══════════ EXPENSES TAB ══════════ */}
      {tab === "expenses" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} className="bg-surface-2 rounded-lg px-3 py-1.5 text-sm text-white border border-border" />
              <div className="flex gap-4 text-sm">
                <span className="text-red-400">Gider: {expenses.totals.expense.toFixed(0)} TL</span>
                <span className="text-green-400">Gelir: {expenses.totals.income.toFixed(0)} TL</span>
                <span className={expenses.totals.net >= 0 ? "text-green-400" : "text-red-400"}>Net: {expenses.totals.net.toFixed(0)} TL</span>
              </div>
            </div>
            <Button onClick={() => setExpenseModal(true)}>+ Gider Ekle</Button>
          </div>
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-white/40 text-xs"><th className="px-4 py-3 text-left">Tarih</th><th className="px-4 py-3 text-left">Kategori</th><th className="px-4 py-3 text-left">Aciklama</th><th className="px-4 py-3 text-right">Tutar</th></tr></thead>
              <tbody className="divide-y divide-border">
                {expenses.entries.map((e) => (
                  <tr key={e.id} className="hover:bg-surface-2">
                    <td className="px-4 py-3 text-white/40 text-xs">{e.date}</td>
                    <td className="px-4 py-3 font-medium">{e.category}</td>
                    <td className="px-4 py-3 text-white/50">{e.description || "-"}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${e.type === "expense" ? "text-red-400" : "text-green-400"}`}>{e.type === "expense" ? "-" : "+"}{e.amount.toFixed(0)} TL</td>
                  </tr>
                ))}
                {expenses.entries.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-white/30">Bu tarihte gider yok</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════ CASH REGISTER TAB ══════════ */}
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
              <thead><tr className="border-b border-border text-white/40 text-xs"><th className="px-4 py-3 text-left">Saat</th><th className="px-4 py-3 text-left">Tur</th><th className="px-4 py-3 text-left">Aciklama</th><th className="px-4 py-3 text-right">Tutar</th></tr></thead>
              <tbody className="divide-y divide-border">
                {register.movements.map((m) => (
                  <tr key={m.id} className="hover:bg-surface-2">
                    <td className="px-4 py-3 text-white/40">{m.createdAt.split(" ")[1]?.slice(0, 5)}</td>
                    <td className={`px-4 py-3 font-medium ${TYPE_COLORS[m.type] || ""}`}>{TYPE_LABELS[m.type] || m.type}</td>
                    <td className="px-4 py-3 text-white/50">{m.description || "-"}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${["refund", "withdrawal"].includes(m.type) ? "text-red-400" : "text-green-400"}`}>{["refund", "withdrawal"].includes(m.type) ? "-" : "+"}{m.amount.toFixed(0)} TL</td>
                  </tr>
                ))}
                {register.movements.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-white/30">Bugun hareket yok</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════ Z REPORT TAB ══════════ */}
      {tab === "zreport" && zReport && (
        <div className="space-y-6">
          <div className="flex items-center justify-center gap-3 mb-2">
            <button onClick={() => { const d = new Date(zDate); d.setDate(d.getDate() - 1); setZDate(d.toISOString().split("T")[0]); }} className="px-3 py-1 bg-surface-2 rounded-lg text-white/40 hover:text-white">&larr;</button>
            <input type="date" value={zDate} onChange={(e) => setZDate(e.target.value)} className="bg-surface-2 rounded-lg px-3 py-1 text-sm text-white border border-border" />
            <button onClick={() => { const d = new Date(zDate); d.setDate(d.getDate() + 1); setZDate(d.toISOString().split("T")[0]); }} className="px-3 py-1 bg-surface-2 rounded-lg text-white/40 hover:text-white">&rarr;</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="card text-center"><p className="text-3xl font-bold">{zReport.orders.totalOrders}</p><p className="text-xs text-white/40">Toplam Siparis</p></div>
            <div className="card text-center"><p className="text-3xl font-bold text-white/50">{zReport.orders.totalRevenue.toFixed(0)}</p><p className="text-xs text-white/40">Hesap Toplam (TL)</p></div>
            <div className="card text-center"><p className="text-3xl font-bold text-green-400">{zReport.orders.totalCollected.toFixed(0)}</p><p className="text-xs text-white/40">Tahsil Edilen (TL)</p></div>
            <div className="card text-center"><p className="text-3xl font-bold text-orange-400">{zReport.orders.totalDiscount.toFixed(0)}</p><p className="text-xs text-white/40">Indirim (TL)</p></div>
            <div className="card text-center"><p className="text-3xl font-bold text-red-400">{zReport.orders.cancelledOrders || 0}</p><p className="text-xs text-white/40">Iptal</p></div>
          </div>
          {zReport.paymentBreakdown.length > 0 && (
            <div className="card"><h3 className="text-lg font-semibold mb-3">Odeme Yontemleri</h3><div className="space-y-2">{zReport.paymentBreakdown.map((p) => (<div key={p.method} className="flex justify-between items-center py-2 border-b border-border last:border-0"><span>{p.method === "cash" ? "Nakit" : p.method === "card" ? "Kart" : "Online"}</span><div className="text-right"><span className="font-semibold">{p.total.toFixed(0)} TL</span><span className="text-white/40 text-xs ml-2">({p.count} islem)</span></div></div>))}</div></div>
          )}
          {zReport.sourceBreakdown.length > 0 && (
            <div className="card"><h3 className="text-lg font-semibold mb-3">Kaynak Dagilimi</h3><div className="space-y-2">{zReport.sourceBreakdown.map((s) => (<div key={s.source} className="flex justify-between items-center py-2 border-b border-border last:border-0"><span>{SOURCE_LABELS[s.source] || s.source}</span><div className="text-right"><span className="font-semibold">{s.total.toFixed(0)} TL</span><span className="text-white/40 text-xs ml-2">({s.count} siparis)</span></div></div>))}</div></div>
          )}
        </div>
      )}

      {/* ══════════ MODALS ══════════ */}
      <Modal open={addCashModal} onClose={() => setAddCashModal(false)} title="Kasa Hareketi Ekle">
        <form onSubmit={addCashMovement} className="space-y-4">
          <div><label className="text-xs text-white/40 mb-1 block">Tur</label><select name="type" className="input-field" required><option value="opening">Kasa Acilis</option><option value="deposit">Para Girisi</option><option value="withdrawal">Para Cikisi</option><option value="refund">Iade</option></select></div>
          <div><label className="text-xs text-white/40 mb-1 block">Tutar (TL)</label><input name="amount" type="number" step="1" className="input-field" required /></div>
          <div><label className="text-xs text-white/40 mb-1 block">Aciklama</label><input name="description" className="input-field" /></div>
          <div className="flex gap-2 justify-end"><Button variant="secondary" type="button" onClick={() => setAddCashModal(false)}>Iptal</Button><Button type="submit">Ekle</Button></div>
        </form>
      </Modal>

      <Modal open={courierAdvanceModal} onClose={() => setCourierAdvanceModal(false)} title="Kuryeye Nakit Ver">
        <form onSubmit={submitCourierAdvance} className="space-y-4">
          <div><label className="text-xs text-white/40 mb-1 block">Kurye Adi</label><input name="courierName" className="input-field" placeholder="Orn: Ahmet" required /></div>
          <div><label className="text-xs text-white/40 mb-1 block">Tutar (TL)</label><input name="amount" type="number" step="1" className="input-field" required /></div>
          <p className="text-white/30 text-xs">Kasadan kuryeye verilen nakit (para ustu, yakit vb.)</p>
          <div className="flex gap-2 justify-end"><Button variant="secondary" type="button" onClick={() => setCourierAdvanceModal(false)}>Iptal</Button><Button type="submit">Onayla</Button></div>
        </form>
      </Modal>

      <Modal open={expenseModal} onClose={() => setExpenseModal(false)} title="Gider Ekle">
        <form onSubmit={addExpense} className="space-y-4">
          <div><label className="text-xs text-white/40 mb-1 block">Kategori</label><select name="category" className="input-field" required>{EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          <div><label className="text-xs text-white/40 mb-1 block">Tutar (TL)</label><input name="amount" type="number" step="1" className="input-field" required /></div>
          <div><label className="text-xs text-white/40 mb-1 block">Aciklama</label><input name="description" className="input-field" placeholder="Orn: Haftalik et alimi" /></div>
          <div className="flex gap-2 justify-end"><Button variant="secondary" type="button" onClick={() => setExpenseModal(false)}>Iptal</Button><Button type="submit">Kaydet</Button></div>
        </form>
      </Modal>

      <ToastContainer toasts={toast.toasts} />
    </div>
  );
}
