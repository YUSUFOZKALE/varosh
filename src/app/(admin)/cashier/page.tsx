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
  paidAmount: number;
}

interface TableSessionData {
  session: { id: number; tableNumber: number; status: string; openedAt: string; total: number };
  unpaidCount: number;
  orders: SessionOrder[];
}

interface TableInfo {
  id: number;
  number: number;
  label: string | null;
  isActive: boolean;
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
interface MenuOptionRaw { id: number; menuItemId: number; groupName: string; optionName: string; priceModifier: number; isDefault: boolean }

type Tab = "orders" | "expenses" | "register" | "zreport";

const SOURCE_LABELS: Record<string, string> = {
  manual: "Mekan", whatsapp: "WhatsApp", phone: "Telefon", walk_in: "Gel-Al", qr: "QR",
};

const EXPENSE_CATEGORIES = [
  "Gida Hammaddesi", "Icecek Hammaddesi", "Ambalaj / Paket",
  "Personel Maas", "Personel SGK", "Kira",
  "Elektrik", "Su", "Dogalgaz", "Internet / Telefon",
  "Temizlik", "Bakim / Onarim", "Ulasim / Akaryakit",
  "Pazarlama / Reklam", "Komisyon / Platform",
  "Vergi", "SGK / Sigorta", "Muhasebeci / Danismanlik",
  "Ekipman / Demirbas", "Kirtasiye / Ofis", "Diger",
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

  // All tables for grid view
  const [allTables, setAllTables] = useState<TableInfo[]>([]);

  // Add item to table
  const [addItemTable, setAddItemTable] = useState<number | null>(null);
  const [menuCats, setMenuCats] = useState<MenuCat[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemRaw[]>([]);
  const [addCart, setAddCart] = useState<{ menuItemId: number; name: string; price: number; qty: number; notes: string; selectedOptions: number[]; removedIngredients: string[] }[]>([]);
  const [menuOptionsAll, setMenuOptionsAll] = useState<MenuOptionRaw[]>([]);
  const [addEditItem, setAddEditItem] = useState<MenuItemRaw | null>(null);
  const [addItemNotes, setAddItemNotes] = useState("");
  const [addItemOpts, setAddItemOpts] = useState<number[]>([]);
  const [addItemQty, setAddItemQty] = useState(1);

  // Split payment mode
  const [splitPayMode, setSplitPayMode] = useState(false);

  // Split bill mode (hesabi bolme - urun secimli)
  const [splitBillMode, setSplitBillMode] = useState(false);
  const [splitSelectedItems, setSplitSelectedItems] = useState<Set<number>>(new Set());
  const [splitCustomAmount, setSplitCustomAmount] = useState("");


  // Transfer & table actions
  const [transferModalOpen, setTransferModalOpen] = useState(false);

  // Existing tabs state
  const [register, setRegister] = useState<{ movements: CashRegisterEntry[]; balance: number }>({ movements: [], balance: 0 });
  const [zReport, setZReport] = useState<ZReport | null>(null);
  const [addCashModal, setAddCashModal] = useState(false);
  const [zDate, setZDate] = useState(new Date().toISOString().split("T")[0]);
  const [expenses, setExpenses] = useState<{ entries: FinanceEntry[]; totals: { income: number; expense: number; net: number } }>({ entries: [], totals: { income: 0, expense: 0, net: 0 } });
  const [expenseModal, setExpenseModal] = useState(false);
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);

  const loadTables = useCallback(async () => {
    try {
      const res = await fetch("/api/tables");
      if (res.ok) setAllTables(await res.json());
    } catch {}
  }, []);

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
    loadTables();
    loadSessions();
    loadPackages();
    loadCourierPending();
    loadRegister();
    loadZReport();
  }

  useEffect(() => {
    loadAll();
    loadExpenses();
    const iv = setInterval(() => { loadTables(); loadSessions(); loadPackages(); loadCourierPending(); }, 10000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => { loadZReport(); }, [zDate]);
  useEffect(() => { loadExpenses(); }, [expenseDate]);

  // ── Table detail ──
  function openTableDetail(ts: TableSessionData) {
    setSelectedTable(ts);
    setPayingSingleOrder(null);
    setSplitPayMode(false);
    setSplitBillMode(false);
    setSplitSelectedItems(new Set());
    const totalPaid = ts.orders.reduce((s, o) => s + (o.paidAmount || 0), 0);
    const remaining = Math.max(0, ts.session.total - totalPaid);
    setChargedAmount(remaining.toFixed(0));
    setPayMethod("cash");
    setReceivedCash("");
  }

  async function refreshTableDetail(tableNumber: number) {
    try {
      const sessRes = await fetch("/api/tables/sessions/open");
      const sessData = await sessRes.json();
      const allSessions: TableSessionData[] = sessData.sessions || [];
      setTableSessions(allSessions);
      const found = allSessions.find((s) => s.session.tableNumber === tableNumber);
      if (found) {
        setSelectedTable(found);
        const totalPaid = found.orders.reduce((s: number, o: SessionOrder) => s + (o.paidAmount || 0), 0);
        setChargedAmount((found.session.total - totalPaid).toFixed(0));
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
    const unpaidOrders = selectedTable.orders.filter((o) => !o.paymentMethod && o.status !== "cancelled");
    if (unpaidOrders.length === 0) return;

    const charged = parseFloat(chargedAmount) || 0;
    if (charged <= 0) return;
    const received = parseFloat(receivedCash) || charged;

    try {
      let remaining = charged;
      for (let i = 0; i < unpaidOrders.length; i++) {
        if (remaining <= 0) break;
        const o = unpaidOrders[i];
        const orderRemaining = o.total - (o.paidAmount || 0);
        if (orderRemaining <= 0) continue;
        const isLast = i === unpaidOrders.length - 1;
        const amt = isLast ? remaining : Math.min(orderRemaining, remaining);
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
    const remaining = order.total - (order.paidAmount || 0);
    setSingleChargedAmount(remaining.toFixed(0));
    setSinglePayMethod("cash");
    setSingleReceivedCash("");
  }

  async function paySingleOrder() {
    if (!payingSingleOrder || !selectedTable) return;
    const orderRemaining = payingSingleOrder.total - (payingSingleOrder.paidAmount || 0);
    const charged = parseFloat(singleChargedAmount) || orderRemaining;
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
    const remaining = order.total - (order.paidAmount || 0);
    if (remaining <= 0) return;
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          amount: remaining,
          method: "cash",
          receivedAmount: remaining,
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

  // ── Split bill (hesabi bol) ──
  function startSplitBill() {
    setSplitBillMode(true);
    setSplitPayMode(false);
    setPayingSingleOrder(null);
    setSplitSelectedItems(new Set());
    setSplitCustomAmount("");
  }

  function toggleSplitItem(itemId: number) {
    setSplitSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  }

  function selectAllOrderItems(order: SessionOrder) {
    setSplitSelectedItems((prev) => {
      const next = new Set(prev);
      const orderItemIds = order.items.map((it) => it.id);
      const allSelected = orderItemIds.every((id) => prev.has(id));
      for (const id of orderItemIds) {
        if (allSelected) next.delete(id); else next.add(id);
      }
      return next;
    });
  }

  async function paySelectedItems(method: "cash" | "card") {
    if (!selectedTable || splitSelectedItems.size === 0) return;

    const amountByOrder: Record<number, number> = {};
    for (const order of selectedTable.orders) {
      if (order.paymentMethod || order.status === "cancelled") continue;
      for (const item of order.items) {
        if (splitSelectedItems.has(item.id)) {
          amountByOrder[order.id] = (amountByOrder[order.id] || 0) + item.totalPrice;
        }
      }
    }

    try {
      for (const [oid, amt] of Object.entries(amountByOrder)) {
        const orderId = parseInt(oid);
        const res = await fetch("/api/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, amount: amt, method, splitPayment: true }),
        });
        if (!res.ok) { toast.error("Islem basarisiz"); return; }
      }
      const total = Object.values(amountByOrder).reduce((s, a) => s + a, 0);
      setSplitSelectedItems(new Set());
      toast.success(`${total.toFixed(0)} TL tahsil edildi`);
      await refreshTableDetail(selectedTable.session.tableNumber);
      loadRegister();
      loadZReport();
    } catch {
      toast.error("Baglanti hatasi");
    }
  }

  async function paySplitCustom(method: "cash" | "card") {
    if (!selectedTable) return;
    const amount = parseFloat(splitCustomAmount);
    if (!amount || amount <= 0) { toast.error("Gecerli bir tutar girin"); return; }

    const unpaidOrders = selectedTable.orders.filter((o) => !o.paymentMethod && o.status !== "cancelled");
    if (unpaidOrders.length === 0) return;

    try {
      let remaining = amount;

      for (const order of unpaidOrders) {
        if (remaining <= 0) break;
        const alreadyPaid = order.paidAmount || 0;
        const orderRemaining = order.total - alreadyPaid;
        if (orderRemaining <= 0) continue;

        const payAmount = Math.min(remaining, orderRemaining);
        const res = await fetch("/api/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: order.id, amount: payAmount, method, splitPayment: true }),
        });
        if (!res.ok) { toast.error("Islem basarisiz"); return; }
        remaining -= payAmount;
      }

      setSplitCustomAmount("");
      toast.success(`${amount.toFixed(0)} TL tahsil edildi`);
      await refreshTableDetail(selectedTable.session.tableNumber);
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
    setAddEditItem(null);
    if (menuCats.length === 0) {
      try {
        const [cRes, iRes, oRes] = await Promise.all([fetch("/api/menu/categories"), fetch("/api/menu/items"), fetch("/api/menu/options")]);
        if (!cRes.ok || !iRes.ok) { toast.error("Islem basarisiz"); return; }
        setMenuCats(await cRes.json());
        setMenuItems(await iRes.json());
        if (oRes.ok) setMenuOptionsAll(await oRes.json());
      } catch {
        toast.error("Baglanti hatasi");
      }
    }
  }

  function handleAddItemTap(item: MenuItemRaw) {
    if (addEditItem?.id === item.id) { setAddEditItem(null); return; }
    setAddEditItem(item);
    setAddItemNotes("");
    setAddItemOpts([]);
    setAddItemQty(1);
  }

  function confirmAddItem() {
    if (!addEditItem) return;
    const optCost = addItemOpts.reduce((s, optId) => {
      const opt = menuOptionsAll.find((o) => o.id === optId);
      return s + (opt?.priceModifier || 0);
    }, 0);
    const key = `${addEditItem.id}-${addItemNotes}-${JSON.stringify([...addItemOpts].sort())}`;
    setAddCart((prev) => {
      const existing = prev.find((c) =>
        `${c.menuItemId}-${c.notes}-${JSON.stringify([...c.selectedOptions].sort())}` === key
      );
      if (existing) return prev.map((c) => c === existing ? { ...c, qty: c.qty + addItemQty } : c);
      return [...prev, {
        menuItemId: addEditItem.id,
        name: addEditItem.name,
        price: addEditItem.price + optCost,
        qty: addItemQty,
        notes: addItemNotes,
        selectedOptions: [...addItemOpts],
        removedIngredients: [],
      }];
    });
    setAddEditItem(null);
    setAddItemNotes("");
    setAddItemOpts([]);
    setAddItemQty(1);
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
          items: addCart.map((c) => ({
            menuItemId: c.menuItemId,
            quantity: c.qty,
            notes: c.notes || undefined,
            selectedOptions: c.selectedOptions.length > 0 ? c.selectedOptions : undefined,
            removedIngredients: c.removedIngredients.length > 0 ? c.removedIngredients : undefined,
          })),
        }),
      });
      if (!res.ok) { toast.error("Islem basarisiz"); return; }
      const tbl = addItemTable;
      setAddItemTable(null);
      setAddCart([]);
      setAddEditItem(null);
      if (selectedTable && selectedTable.session.tableNumber === tbl) {
        await refreshTableDetail(tbl);
      } else {
        await loadSessions();
      }
    } catch {
      toast.error("Baglanti hatasi");
    }
  }

  // ── Table actions ──
  async function cancelOrder(orderId: number) {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled", cancelReason: "Kasadan iptal" }),
      });
      if (!res.ok) { toast.error("Iptal basarisiz"); return; }
      toast.success("Siparis iptal edildi");
      if (selectedTable) refreshTableDetail(selectedTable.session.tableNumber);
      loadAll();
    } catch {
      toast.error("Baglanti hatasi");
    }
  }

  async function transferTable(toTable: number) {
    if (!selectedTable) return;
    try {
      const res = await fetch("/api/tables/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromTable: selectedTable.session.tableNumber, toTable }),
      });
      if (!res.ok) { toast.error("Tasima basarisiz"); return; }
      toast.success(`Masa ${toTable}'ye tasindi`);
      setTransferModalOpen(false);
      setSelectedTable(null);
      loadAll();
    } catch {
      toast.error("Baglanti hatasi");
    }
  }

  async function closeSession() {
    if (!selectedTable || selectedTable.session.id === -1) return;
    try {
      const unpaidOrders = selectedTable.orders.filter((o) => !o.paymentMethod && o.status !== "cancelled");
      for (const o of unpaidOrders) {
        const orderRemaining = o.total - (o.paidAmount || 0);
        if (orderRemaining > 0) {
          await fetch("/api/payments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId: o.id, amount: orderRemaining, method: "cash" }),
          });
        }
      }
      const res = await fetch("/api/tables/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableNumber: selectedTable.session.tableNumber, action: "close" }),
      });
      if (!res.ok) { toast.error("Islem basarisiz"); return; }
      toast.success("Masa kapatildi");
      setSelectedTable(null);
      loadAll();
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
  const tableTotalPaid = selectedTable ? selectedTable.orders.reduce((s, o) => s + (o.paidAmount || 0), 0) : 0;
  const tableUnpaidTotal = selectedTable ? Math.max(0, selectedTable.session.total - tableTotalPaid) : 0;
  const tablePaidTotal = tableTotalPaid;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold">Kasa</h2>
        <div className="flex gap-1 bg-surface-2 rounded-xl p-1 overflow-x-auto">
          {([["orders", "Siparisler"], ["expenses", "Giderler"], ["register", "Kasa"], ["zreport", "Z Raporu"]] as [Tab, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${tab === t ? "bg-accent text-black" : "text-white/40 hover:text-white"}`}>
              {label}
              {t === "orders" && totalBadge > 0 && <span className="ml-1.5 bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5">{totalBadge}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════ SIPARISLER TAB - GRID VIEW ══════════ */}
      {tab === "orders" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">
          {/* MASALAR */}
          <div className="lg:col-span-1">
            <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
              Masalar
              {tableSessions.length > 0 && <span className="bg-amber-500/20 text-amber-400 text-xs px-2 py-0.5 rounded-full">{tableSessions.length} acik</span>}
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {allTables.filter((t) => t.isActive).map((table) => {
                const session = tableSessions.find((ts) => ts.session.tableNumber === table.number);
                const sessionTotalPaid = session ? session.orders.reduce((s, o) => s + (o.paidAmount || 0), 0) : 0;
                const unpaidTotal = session ? Math.max(0, session.session.total - sessionTotalPaid) : 0;
                const hasSession = !!session;
                const hasUnpaid = unpaidTotal > 0;
                const elapsed = session ? Math.floor((Date.now() - new Date(session.session.openedAt).getTime()) / 60000) : 0;

                return (
                  <div
                    key={table.id}
                    onClick={() => {
                      if (session) {
                        openTableDetail(session);
                      } else {
                        setSelectedTable({
                          session: { id: -1, tableNumber: table.number, status: "open", openedAt: new Date().toISOString(), total: 0 },
                          unpaidCount: 0,
                          orders: [],
                        });
                        setChargedAmount("0");
                        setPayMethod("cash");
                        setReceivedCash("");
                      }
                    }}
                    className={`relative aspect-square rounded-2xl border-2 flex flex-col items-center justify-center cursor-pointer transition-all active:scale-[0.96] ${
                      hasUnpaid
                        ? "bg-amber-500/10 border-amber-500/50 hover:border-amber-400 shadow-lg shadow-amber-500/10"
                        : hasSession
                        ? "bg-green-500/10 border-green-500/40 hover:border-green-400"
                        : "bg-surface-1 border-border hover:border-white/30 hover:bg-surface-2"
                    }`}
                  >
                    <span className={`text-xl sm:text-2xl font-extrabold ${
                      hasUnpaid ? "text-amber-400" : hasSession ? "text-green-400" : "text-white/20"
                    }`}>
                      {table.number}
                    </span>

                    {hasUnpaid && (
                      <span className="text-amber-300 font-bold text-[10px] sm:text-xs mt-0.5">
                        {unpaidTotal.toFixed(0)} TL
                      </span>
                    )}

                    {hasUnpaid && sessionTotalPaid > 0 && (
                      <span className="text-green-400/70 font-medium text-[8px] sm:text-[9px]">
                        {sessionTotalPaid.toFixed(0)} odendi
                      </span>
                    )}

                    {hasSession && !hasUnpaid && (
                      <span className="text-green-400/70 font-medium text-[9px] sm:text-[10px] mt-0.5">
                        Odendi
                      </span>
                    )}

                    {!hasSession && (
                      <span className="text-white/10 text-[9px] mt-0.5">Bos</span>
                    )}

                    {hasSession && (
                      <span className="absolute top-0.5 right-1 text-[8px] text-white/30">
                        {elapsed}dk
                      </span>
                    )}

                    {session && session.unpaidCount > 1 && (
                      <span className="absolute top-0.5 left-1 bg-red-500 text-white text-[7px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">
                        {session.unpaidCount}
                      </span>
                    )}
                  </div>
                );
              })}
              {allTables.filter((t) => t.isActive).length === 0 && (
                <div className="col-span-full text-center py-8 text-white/20 text-sm">
                  Masa yok — Ayarlardan ekleyin
                </div>
              )}
            </div>
          </div>

          {/* PAKETLER & GEL-AL */}
          <div className="lg:col-span-1">
            <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
              Paket & Gel-Al
              {packageOrders.length > 0 && <span className="bg-purple-500/20 text-purple-400 text-xs px-2 py-0.5 rounded-full">{packageOrders.length}</span>}
            </h3>
            <div className="space-y-3 max-h-[calc(100vh-200px)] lg:overflow-y-auto lg:pr-1">
              {packageOrders.map((order) => (
                <div key={order.id} className="card">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-bold text-sm">#{order.id}</span>
                      <span className="ml-2 text-xs text-white/40">{SOURCE_LABELS[order.source] || order.source}</span>
                    </div>
                    <span className="text-lg font-bold text-accent">{order.total.toFixed(0)} TL</span>
                  </div>
                  <div className="text-sm text-white/40 mb-2">
                    {order.customerName && <p className="text-xs">{order.customerName}</p>}
                    {order.deliveryAddress && <p className="text-[10px] truncate">{order.deliveryAddress}</p>}
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
                    <button onClick={() => quickApprovePackage(order)} className="flex-1 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-xs sm:text-sm transition-all active:scale-[0.97]">
                      Onayla {order.total.toFixed(0)} TL
                    </button>
                    <button onClick={() => openPayPackage(order)} className="px-3 py-2 rounded-xl bg-surface-2 hover:bg-neutral-700 text-white/60 font-medium text-xs sm:text-sm transition-all">
                      Duzenle
                    </button>
                  </div>
                </div>
              ))}
              {packageOrders.length === 0 && <div className="text-center py-8 text-white/20 text-sm">Odenmemis paket yok</div>}
            </div>
          </div>

          {/* KURYE HESABI */}
          <div className="lg:col-span-1">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-base font-semibold flex items-center gap-2">
                Kurye
                {courierGroups.length > 0 && <span className="bg-orange-500/20 text-orange-400 text-xs px-2 py-0.5 rounded-full">{courierGroups.reduce((s, g) => s + g.orders.length, 0)}</span>}
              </h3>
              <button onClick={() => setCourierAdvanceModal(true)} className="px-2 py-1 bg-orange-600/20 text-orange-400 rounded-lg text-[10px] font-medium hover:bg-orange-600/30">
                Nakit Ver
              </button>
            </div>
            <div className="space-y-3 max-h-[calc(100vh-200px)] lg:overflow-y-auto lg:pr-1">
              {courierGroups.map((group) => {
                const allSelected = group.orders.every((o) => selectedCourierOrders.has(o.id));
                const selectedTotal = group.orders.filter((o) => selectedCourierOrders.has(o.id)).reduce((s, o) => s + o.paidAmount, 0);
                return (
                  <div key={group.courierId} className="card">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="bg-orange-500/20 text-orange-400 font-bold text-xs w-7 h-7 rounded-lg flex items-center justify-center">K</div>
                        <div>
                          <p className="font-semibold text-white text-sm">{group.courierName}</p>
                          <p className="text-white/30 text-[10px]">{group.orders.length} teslimat</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-orange-400 font-extrabold text-base">{group.total.toFixed(0)} TL</p>
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
                            {o.customerName && <span className="text-white/40 text-[10px] ml-1">{o.customerName}</span>}
                            <span className={`ml-1 text-[10px] px-1 py-0.5 rounded ${o.payMethod === "cash" ? "bg-green-600/20 text-green-400" : "bg-blue-600/20 text-blue-400"}`}>
                              {o.payMethod === "cash" ? "Nakit" : "Kart"}
                            </span>
                          </div>
                          <span className="text-white/60 text-xs font-semibold">{o.paidAmount.toFixed(0)} TL</span>
                        </label>
                      ))}
                    </div>

                    {selectedTotal > 0 && (
                      <div className="grid grid-cols-2 gap-1.5 mt-3">
                        <button onClick={() => collectCourierCash("cash")} className="py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-[10px] sm:text-xs transition-all active:scale-[0.97]">
                          Nakit {selectedTotal.toFixed(0)} TL
                        </button>
                        <button onClick={() => collectCourierCash("card")} className="py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] sm:text-xs transition-all active:scale-[0.97]">
                          Kart {selectedTotal.toFixed(0)} TL
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => { setSelectedTable(null); setTransferModalOpen(false); setSplitPayMode(false); setSplitBillMode(false); }}>
          <div className="bg-neutral-900 sm:rounded-2xl rounded-t-2xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col sm:mx-4" onClick={(e) => e.stopPropagation()}>
            {/* ── HEADER ── */}
            <div className="p-4 sm:p-5 border-b border-neutral-800/60 shrink-0">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <h3 className="text-xl sm:text-2xl font-extrabold text-white">Masa {selectedTable.session.tableNumber}</h3>
                  {selectedTable.orders.length > 0 ? (
                    <p className="text-white/30 text-xs">{selectedTable.orders.length} siparis &middot; {new Date(selectedTable.session.openedAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}&apos;den beri</p>
                  ) : (
                    <p className="text-white/20 text-xs">Bos masa</p>
                  )}
                </div>
                <button onClick={() => { setSelectedTable(null); setTransferModalOpen(false); setSplitPayMode(false); setSplitBillMode(false); }} className="w-9 h-9 bg-neutral-800 rounded-full flex items-center justify-center text-white/40 hover:text-white shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* ── ACTION BAR ── */}
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => openAddItem(selectedTable.session.tableNumber)} className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition-all active:scale-[0.96] flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                  Siparis Ekle
                </button>
                {selectedTable.orders.length > 0 && (
                  <>
                    {selectedTable.orders.filter((o) => !o.paymentMethod && o.status !== "cancelled").length >= 1 && (
                      <button onClick={startSplitBill} className={`px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${splitBillMode ? "bg-amber-600/30 border border-amber-500/50 text-amber-300" : "bg-amber-600/15 hover:bg-amber-600/25 text-amber-400"}`}>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        Hesabi Bol
                      </button>
                    )}
                    {selectedTable.orders.filter((o) => !o.paymentMethod && o.status !== "cancelled").length > 1 && (
                      <button onClick={() => { setSplitPayMode(!splitPayMode); setPayingSingleOrder(null); setSplitBillMode(false); }} className={`px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${splitPayMode ? "bg-purple-600/30 border border-purple-500/50 text-purple-300" : "bg-purple-600/15 hover:bg-purple-600/25 text-purple-400"}`}>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        Ayri Tahsil
                      </button>
                    )}
                    <button onClick={() => setTransferModalOpen(true)} className="px-3 py-2 bg-blue-600/15 hover:bg-blue-600/25 text-blue-400 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                      Masa Tasi
                    </button>
                    <button onClick={() => { const ids = selectedTable.orders.map((o) => o.id); if (ids[0]) window.open(`/receipt/${ids[0]}`, "_blank"); }} className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-white/50 hover:text-white/70 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                      Yazdir
                    </button>
                    {selectedTable.session.id !== -1 && tableUnpaidTotal === 0 && (
                      <button onClick={closeSession} className="px-3 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-400/60 hover:text-red-400 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Masayi Kapat
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* ── CONTENT ── */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {selectedTable.orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-20 h-20 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-5">
                    <svg className="w-10 h-10 text-white/[0.08]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  </div>
                  <p className="text-white/25 text-base font-semibold mb-1">Henuz siparis yok</p>
                  <p className="text-white/10 text-sm mb-8">Siparis ekleyerek masayi acin</p>
                  <button onClick={() => openAddItem(selectedTable.session.tableNumber)} className="px-10 py-3.5 bg-green-600 hover:bg-green-700 text-white font-bold text-sm rounded-2xl transition-all active:scale-[0.96] flex items-center gap-2 shadow-lg shadow-green-600/20">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                    Siparis Ekle
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedTable.orders.map((order) => (
                    <div key={order.id} className={`rounded-xl p-4 ${order.paymentMethod ? "bg-green-900/10 border border-green-800/30" : order.status === "cancelled" ? "bg-red-900/10 border border-red-800/20 opacity-50" : "bg-neutral-800/30"}`}>
                      <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-amber-400/70 text-xs font-bold">#{order.id}</span>
                          <span className="text-white/20 text-xs">{new Date(order.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</span>
                          {order.paymentMethod && <span className="bg-green-600/20 text-green-400 text-[10px] px-1.5 py-0.5 rounded font-medium">Odendi</span>}
                          {!order.paymentMethod && order.status !== "cancelled" && (order.paidAmount || 0) > 0 && (
                            <span className="bg-amber-600/20 text-amber-400 text-[10px] px-1.5 py-0.5 rounded font-medium">{(order.paidAmount || 0).toFixed(0)} TL odendi</span>
                          )}
                          {order.status === "cancelled" && <span className="bg-red-600/20 text-red-400 text-[10px] px-1.5 py-0.5 rounded font-medium">Iptal</span>}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-white/50 text-xs font-semibold">{order.total.toFixed(0)} TL</span>
                          {!order.paymentMethod && order.status !== "cancelled" && !splitBillMode && (
                            <>
                              <button onClick={() => quickApproveSingleOrder(order)} className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold rounded-lg transition-all">Onayla</button>
                              <button onClick={() => openSingleOrderPay(order)} className="px-2.5 py-1 bg-neutral-700 hover:bg-neutral-600 text-white/60 text-[10px] font-medium rounded-lg transition-all">Duzenle</button>
                              <button onClick={() => cancelOrder(order.id)} className="px-2.5 py-1 bg-red-900/40 hover:bg-red-900/60 text-red-400/60 hover:text-red-400 text-[10px] font-medium rounded-lg transition-all">Iptal</button>
                            </>
                          )}
                          {!order.paymentMethod && order.status !== "cancelled" && splitBillMode && (
                            <button onClick={() => selectAllOrderItems(order)} className="px-2 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 text-[10px] font-medium rounded-lg transition-all">
                              {order.items.every((it) => splitSelectedItems.has(it.id)) ? "Secimi Kaldir" : "Tumunu Sec"}
                            </button>
                          )}
                        </div>
                      </div>
                      {order.status !== "cancelled" && order.items.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => { if (splitBillMode && !order.paymentMethod) toggleSplitItem(item.id); }}
                          className={`flex items-center justify-between py-1.5 group rounded-lg transition-all ${splitBillMode && !order.paymentMethod ? "cursor-pointer px-1.5 -mx-1.5" : ""} ${splitBillMode && splitSelectedItems.has(item.id) ? "bg-amber-500/15 ring-1 ring-amber-500/30" : ""}`}
                        >
                          {splitBillMode && !order.paymentMethod && (
                            <input type="checkbox" checked={splitSelectedItems.has(item.id)} readOnly className="accent-amber-500 mr-2 shrink-0 pointer-events-none" />
                          )}
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
                            <span className={`text-xs ${splitBillMode && splitSelectedItems.has(item.id) ? "text-amber-400 font-bold" : "text-white/40"}`}>{item.totalPrice.toFixed(0)} TL</span>
                            {!order.paymentMethod && !splitBillMode && (
                              <div className="flex items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                <button onClick={() => updateItemQty(order.id, item.id, item.quantity - 1)} className="w-5 h-5 bg-neutral-700 rounded text-white/40 hover:text-white text-xs flex items-center justify-center">-</button>
                                <button onClick={() => updateItemQty(order.id, item.id, item.quantity + 1)} className="w-5 h-5 bg-neutral-700 rounded text-white/40 hover:text-white text-xs flex items-center justify-center">+</button>
                                <button onClick={() => removeItem(order.id, item.id)} className="w-5 h-5 bg-red-900/50 rounded text-red-400/60 hover:text-red-400 text-xs flex items-center justify-center">&times;</button>
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

                      {/* Split pay mode: quick nakit/kart buttons for each unpaid order */}
                      {splitPayMode && !order.paymentMethod && order.status !== "cancelled" && payingSingleOrder?.id !== order.id && (
                        <div className="mt-2 pt-2 border-t border-purple-500/20 flex gap-1.5">
                          <button onClick={() => quickApproveSingleOrder(order)} className="flex-1 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-bold transition-all active:scale-[0.97]">
                            Nakit {order.total.toFixed(0)} TL
                          </button>
                          <button onClick={async () => {
                            if (!selectedTable) return;
                            try {
                              const res = await fetch("/api/payments", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ orderId: order.id, amount: order.total, method: "card", receivedAmount: order.total }),
                              });
                              if (!res.ok) { toast.error("Islem basarisiz"); return; }
                              toast.success("Kart ile tahsil edildi");
                              refreshTableDetail(selectedTable.session.tableNumber);
                              loadRegister();
                              loadZReport();
                            } catch { toast.error("Baglanti hatasi"); }
                          }} className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all active:scale-[0.97]">
                            Kart {order.total.toFixed(0)} TL
                          </button>
                          <button onClick={() => openSingleOrderPay(order)} className="px-2 py-2 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-white/50 text-[10px] font-medium transition-all">
                            Duzenle
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── FOOTER ── */}
            {selectedTable.orders.length > 0 && (
              <div className="shrink-0 border-t border-neutral-800/60 p-4 sm:p-5 space-y-3">
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

                {tableUnpaidTotal > 0 && !splitPayMode && !splitBillMode && (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="text-white text-sm font-semibold shrink-0">Tahsil:</span>
                      <input type="number" value={chargedAmount} onChange={(e) => setChargedAmount(e.target.value)} className="input-field text-lg font-bold text-amber-400 text-center flex-1" />
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
                    <Button className="w-full" onClick={payTable}>Tumunu Tahsil Et</Button>
                  </>
                )}
                {tableUnpaidTotal > 0 && splitPayMode && !splitBillMode && (
                  <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 text-center">
                    <p className="text-purple-300 text-xs font-medium mb-1">Ayri Tahsil Modu</p>
                    <p className="text-white/40 text-[10px]">Her siparisi yukaridaki Nakit/Kart butonlariyla ayri ayri tahsil edin</p>
                    <button onClick={() => setSplitPayMode(false)} className="mt-2 px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white/40 rounded-lg text-[10px] font-medium transition-all">
                      Toplu Tahsile Don
                    </button>
                  </div>
                )}
                {tableUnpaidTotal > 0 && splitBillMode && (() => {
                  const selectedTotal = selectedTable.orders
                    .filter((o) => !o.paymentMethod && o.status !== "cancelled")
                    .flatMap((o) => o.items)
                    .filter((item) => splitSelectedItems.has(item.id))
                    .reduce((s, item) => s + item.totalPrice, 0);
                  const splitPaidTotal = tablePaidTotal;
                  return (
                    <div className="space-y-3">
                      {splitPaidTotal > 0 && (
                        <div className="bg-green-900/15 border border-green-800/30 rounded-xl p-2.5 flex items-center justify-between">
                          <span className="text-green-400/70 text-xs">Bu turda tahsil edilen</span>
                          <span className="text-green-400 text-sm font-bold">{splitPaidTotal.toFixed(0)} TL</span>
                        </div>
                      )}

                      {selectedTotal > 0 && (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-amber-300 text-xs font-semibold">Secili urunler</span>
                            <span className="text-amber-400 text-sm font-bold">{selectedTotal.toFixed(0)} TL</span>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <button onClick={() => paySelectedItems("cash")} className="py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-bold transition-all active:scale-[0.97]">
                              Nakit {selectedTotal.toFixed(0)} TL
                            </button>
                            <button onClick={() => paySelectedItems("card")} className="py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all active:scale-[0.97]">
                              Kart {selectedTotal.toFixed(0)} TL
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="bg-neutral-800/40 rounded-xl p-3">
                        <p className="text-white/40 text-[10px] mb-2 text-center">veya serbest tutar girin</p>
                        <div className="flex items-center gap-2 mb-2">
                          <input type="number" placeholder="Tutar..." value={splitCustomAmount} onChange={(e) => setSplitCustomAmount(e.target.value)} className="input-field text-sm font-bold text-amber-400 text-center flex-1 py-2" />
                          <span className="text-white/30 text-xs">TL</span>
                        </div>
                        {splitCustomAmount && parseFloat(splitCustomAmount) > 0 && (
                          <div className="grid grid-cols-2 gap-1.5">
                            <button onClick={() => paySplitCustom("cash")} className="py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-bold transition-all active:scale-[0.97]">
                              Nakit {parseFloat(splitCustomAmount).toFixed(0)} TL
                            </button>
                            <button onClick={() => paySplitCustom("card")} className="py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all active:scale-[0.97]">
                              Kart {parseFloat(splitCustomAmount).toFixed(0)} TL
                            </button>
                          </div>
                        )}
                      </div>

                      <button onClick={() => setSplitBillMode(false)} className="w-full py-2 rounded-xl bg-neutral-800 text-white/30 text-xs font-medium hover:bg-neutral-700 transition-all">
                        Vazgec
                      </button>
                    </div>
                  );
                })()}
                {(tableUnpaidTotal === 0 || tablePaidTotal > 0) && (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { const ids = selectedTable.orders.map((o) => o.id); if (ids[0]) window.open(`/receipt/${ids[0]}`, "_blank"); }} className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white/50 font-medium text-sm">Yazdir</button>
                    <button type="button" onClick={closeSession} className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white/30 font-medium text-sm">Masayi Kapat{tableUnpaidTotal > 0 ? ` (${tableUnpaidTotal.toFixed(0)} TL kalan)` : ""}</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════ TRANSFER MODAL ══════════ */}
      {transferModalOpen && selectedTable && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setTransferModalOpen(false)}>
          <div className="bg-neutral-900 rounded-2xl w-full max-w-md mx-4 p-5 border border-neutral-700/50 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Masa {selectedTable.session.tableNumber} &rarr; Nereye?</h3>
              <button onClick={() => setTransferModalOpen(false)} className="w-7 h-7 bg-neutral-800 rounded-full flex items-center justify-center text-white/40 hover:text-white">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2 max-h-[40vh] overflow-y-auto">
              {allTables.filter((t) => t.isActive && t.number !== selectedTable.session.tableNumber).map((t) => {
                const occupied = tableSessions.some((ts) => ts.session.tableNumber === t.number);
                return (
                  <button
                    key={t.id}
                    onClick={() => transferTable(t.number)}
                    className={`aspect-square rounded-xl border-2 flex flex-col items-center justify-center transition-all cursor-pointer active:scale-[0.95] ${
                      occupied
                        ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-300 hover:border-indigo-400 hover:bg-indigo-500/20"
                        : "bg-surface-1 border-border hover:border-blue-400 hover:bg-blue-500/10 text-white/60 hover:text-blue-400"
                    }`}
                  >
                    <span className="text-lg font-bold">{t.number}</span>
                    {occupied ? <span className="text-[8px]">Dolu - Birlestir</span> : <span className="text-[8px] text-white/20">Bos</span>}
                  </button>
                );
              })}
            </div>
            <button onClick={() => setTransferModalOpen(false)} className="w-full mt-4 py-2.5 rounded-xl bg-neutral-800 text-white/40 font-medium text-sm hover:bg-neutral-700">Vazgec</button>
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
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              <button type="button" onClick={() => window.open(`/receipt/${payingOrder.id}`, "_blank")} className="py-2.5 rounded-xl bg-neutral-800 text-white/50 font-medium text-xs">Yazdir</button>
              <button type="button" onClick={() => setPayingOrder(null)} className="py-2.5 rounded-xl bg-neutral-800 text-white/30 font-medium text-xs">Iptal</button>
              <Button onClick={payPackage}>Tahsil Et</Button>
            </div>
          </div>
        </>
      )}

      {/* ══════════ ADD ITEM TO TABLE MODAL ══════════ */}
      {addItemTable !== null && (
        <div className="fixed inset-0 z-[55] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => { setAddItemTable(null); setAddCart([]); setAddEditItem(null); }}>
          <div className="bg-neutral-900 sm:rounded-2xl rounded-t-2xl w-full max-w-2xl max-h-[92vh] sm:max-h-[85vh] flex flex-col sm:mx-4" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="shrink-0 p-4 border-b border-neutral-800/60 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Masa {addItemTable} &mdash; Urun Ekle</h3>
              <button onClick={() => { setAddItemTable(null); setAddCart([]); setAddEditItem(null); }} className="w-8 h-8 bg-neutral-800 rounded-full flex items-center justify-center text-white/40 hover:text-white">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Category tabs */}
            <div className="shrink-0 flex gap-1 px-4 py-2 overflow-x-auto no-scrollbar border-b border-neutral-800/40">
              {menuCats.map((cat) => (
                <button key={cat.id} onClick={() => { const el = document.getElementById(`add-cat-${cat.id}`); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }} className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors bg-surface-2 text-white/40 hover:text-white/60">
                  {cat.name}
                </button>
              ))}
            </div>

            {addEditItem && <div className="fixed inset-0 z-[65] bg-black/50 lg:hidden" onClick={() => setAddEditItem(null)} />}

            {/* Menu grid */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {menuCats.map((cat) => {
                const catItems = menuItems.filter((i) => i.categoryId === cat.id);
                if (catItems.length === 0) return null;
                return (
                  <div key={cat.id} id={`add-cat-${cat.id}`}>
                    <p className="text-xs text-white/30 font-bold uppercase tracking-wider mb-2">{cat.name}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {catItems.map((item) => {
                        const inCart = addCart.find((c) => c.menuItemId === item.id);
                        const hasOptions = menuOptionsAll.some((o) => o.menuItemId === item.id);
                        const isDetailOpen = addEditItem?.id === item.id;
                        const itemOptsForItem = menuOptionsAll.filter((o) => o.menuItemId === item.id);
                        const detailOptGroups = Array.from(new Set(itemOptsForItem.map((o) => o.groupName)));
                        const detailOptCost = isDetailOpen ? addItemOpts.reduce((s, optId) => { const o = menuOptionsAll.find((x) => x.id === optId); return s + (o?.priceModifier || 0); }, 0) : 0;
                        const detailUnitPrice = isDetailOpen ? item.price + detailOptCost : 0;
                        const detailTotalPrice = detailUnitPrice * addItemQty;
                        return (
                          <div key={item.id} className="relative">
                            <button onClick={() => handleAddItemTap(item)} className={`w-full text-left rounded-xl transition-all active:scale-[0.97] border overflow-hidden ${inCart ? "bg-amber-500/10 border-amber-500/30 ring-1 ring-amber-500/20" : "bg-surface-2 border-border hover:border-white/20"}`}>
                              {item.imageUrl ? (
                                <img src={item.imageUrl} alt={item.name} className="w-full h-20 sm:h-24 object-cover" />
                              ) : (
                                <div className="w-full h-14 sm:h-16 bg-neutral-800/50 flex items-center justify-center">
                                  <svg className="w-5 h-5 text-white/[0.06]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                </div>
                              )}
                              <div className="p-2">
                                <p className="text-white/80 text-xs font-medium truncate">{item.name}</p>
                                <div className="flex items-center justify-between mt-0.5">
                                  <span className="text-amber-400 text-xs font-bold">{item.price.toFixed(0)} TL</span>
                                  {inCart && <span className="text-amber-400 text-[10px] font-bold bg-amber-500/20 px-1.5 py-0.5 rounded">{inCart.qty}</span>}
                                </div>
                                {hasOptions && <span className="text-white/20 text-[10px]">secenekli</span>}
                              </div>
                            </button>
                            {isDetailOpen && (
                              <div className="fixed inset-x-0 bottom-0 z-[70] bg-neutral-900 border-t-2 border-amber-500/60 rounded-t-2xl overflow-hidden shadow-2xl shadow-black/40 lg:absolute lg:inset-x-0 lg:top-0 lg:bottom-auto lg:rounded-xl lg:border-2">
                                <div className="px-3 py-2 border-b border-neutral-800/60">
                                  <div className="flex items-center justify-between">
                                    <h3 className="font-bold text-white text-base leading-tight">{item.name}</h3>
                                    <button onClick={() => setAddEditItem(null)} className="w-7 h-7 bg-neutral-800 rounded-lg flex items-center justify-center text-white/40 shrink-0">
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                  </div>
                                  <span className="text-amber-400 font-extrabold text-lg">{item.price.toFixed(0)} TL</span>
                                </div>
                                <div className="px-3 py-2 space-y-2 max-h-[50vh] overflow-y-auto">
                                  {detailOptGroups.map((group) => (
                                    <div key={group}>
                                      <p className="text-[11px] font-bold text-white/40 mb-1 uppercase">{group}</p>
                                      <div className="flex flex-wrap gap-1">
                                        {itemOptsForItem.filter((o) => o.groupName === group).map((opt) => (
                                          <button key={opt.id} onClick={() => setAddItemOpts((prev) => prev.includes(opt.id) ? prev.filter((id) => id !== opt.id) : [...prev, opt.id])} className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${addItemOpts.includes(opt.id) ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "bg-neutral-800 text-white/70 border border-neutral-700/50"}`}>
                                            {opt.optionName} {opt.priceModifier > 0 && <span className="text-white/30">+{opt.priceModifier.toFixed(0)}</span>}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                  <textarea value={addItemNotes} onChange={(e) => setAddItemNotes(e.target.value)} placeholder="Not ekle..." rows={2} className="w-full bg-neutral-800/60 text-white rounded-lg px-2.5 py-1.5 text-[11px] border border-neutral-700/50 focus:outline-none focus:border-amber-500/40 placeholder:text-white/20 resize-none overflow-y-auto" />
                                  <div className="flex items-center gap-2 pt-1">
                                    <div className="flex items-center bg-neutral-800 rounded-full shrink-0">
                                      <button onClick={() => setAddItemQty(Math.max(1, addItemQty - 1))} className="w-8 h-8 rounded-full flex items-center justify-center text-white/80 text-sm font-bold">−</button>
                                      <span className="text-white font-bold text-sm min-w-[20px] text-center">{addItemQty}</span>
                                      <button onClick={() => setAddItemQty(addItemQty + 1)} className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-black text-sm font-bold">+</button>
                                    </div>
                                    <button onClick={() => confirmAddItem()} className="flex-1 py-2 rounded-xl bg-amber-500 text-black font-bold text-xs active:scale-[0.97]">
                                      Ekle {addItemQty}x {detailTotalPrice.toFixed(0)} TL
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Cart summary + submit - always visible at bottom */}
            <div className="shrink-0 border-t border-neutral-800/60 p-4 bg-neutral-900">
              {addCart.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                    {addCart.map((c, i) => (
                      <div key={i} className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-1">
                        <span className="text-white/60 text-[10px]">{c.qty}x</span>
                        <span className="text-white/80 text-[10px] font-medium">{c.name}</span>
                        {c.selectedOptions.length > 0 && <span className="text-amber-300/50 text-[9px]">+{c.selectedOptions.length}</span>}
                        {c.notes && <span className="text-amber-300/50 text-[9px]">📝</span>}
                        <span className="text-amber-400/60 text-[10px]">{(c.price * c.qty).toFixed(0)}</span>
                        <button onClick={(e) => { e.stopPropagation(); setAddCart((prev) => prev.filter((_, idx) => idx !== i)); }} className="text-white/20 hover:text-red-400 text-xs ml-0.5">&times;</button>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm">
                      <span className="text-white/40">{addCart.reduce((s, c) => s + c.qty, 0)} urun</span>
                      <span className="text-amber-400 font-bold ml-2">{addCart.reduce((s, c) => s + c.price * c.qty, 0).toFixed(0)} TL</span>
                    </div>
                    <Button className="flex-1" onClick={submitAddItems}>Masaya Ekle</Button>
                  </div>
                </div>
              ) : (
                <p className="text-center text-white/15 text-sm py-1">Eklemek icin urune dokunun</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════ EXPENSES TAB ══════════ */}
      {tab === "expenses" && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} className="bg-surface-2 rounded-lg px-3 py-1.5 text-sm text-white border border-border" />
              <div className="flex gap-3 text-sm flex-wrap">
                <span className="text-red-400">Gider: {expenses.totals.expense.toFixed(0)} TL</span>
                <span className="text-green-400">Gelir: {expenses.totals.income.toFixed(0)} TL</span>
                <span className={expenses.totals.net >= 0 ? "text-green-400" : "text-red-400"}>Net: {expenses.totals.net.toFixed(0)} TL</span>
              </div>
            </div>
            <Button onClick={() => setExpenseModal(true)}>+ Gider Ekle</Button>
          </div>
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm min-w-[500px]">
              <thead><tr className="border-b border-border text-white/40 text-xs"><th className="px-3 md:px-4 py-3 text-left">Tarih</th><th className="px-3 md:px-4 py-3 text-left">Kategori</th><th className="px-3 md:px-4 py-3 text-left">Aciklama</th><th className="px-3 md:px-4 py-3 text-right">Tutar</th></tr></thead>
              <tbody className="divide-y divide-border">
                {expenses.entries.map((e) => (
                  <tr key={e.id} className="hover:bg-surface-2">
                    <td className="px-3 md:px-4 py-3 text-white/40 text-xs">{e.date}</td>
                    <td className="px-3 md:px-4 py-3 font-medium">{e.category}</td>
                    <td className="px-3 md:px-4 py-3 text-white/50">{e.description || "-"}</td>
                    <td className={`px-3 md:px-4 py-3 text-right font-semibold ${e.type === "expense" ? "text-red-400" : "text-green-400"}`}>{e.type === "expense" ? "-" : "+"}{e.amount.toFixed(0)} TL</td>
                  </tr>
                ))}
                {expenses.entries.length === 0 && <tr><td colSpan={4} className="px-3 md:px-4 py-8 text-center text-white/30">Bu tarihte gider yok</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════ CASH REGISTER TAB ══════════ */}
      {tab === "register" && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="bg-surface-2 rounded-xl px-4 sm:px-6 py-3">
              <span className="text-white/40 text-sm">Kasa Bakiyesi</span>
              <p className="text-2xl sm:text-3xl font-bold text-accent">{register.balance.toFixed(0)} TL</p>
            </div>
            <Button onClick={() => setAddCashModal(true)}>+ Hareket Ekle</Button>
          </div>
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm min-w-[500px]">
              <thead><tr className="border-b border-border text-white/40 text-xs"><th className="px-3 md:px-4 py-3 text-left">Saat</th><th className="px-3 md:px-4 py-3 text-left">Tur</th><th className="px-3 md:px-4 py-3 text-left">Aciklama</th><th className="px-3 md:px-4 py-3 text-right">Tutar</th></tr></thead>
              <tbody className="divide-y divide-border">
                {register.movements.map((m) => (
                  <tr key={m.id} className="hover:bg-surface-2">
                    <td className="px-3 md:px-4 py-3 text-white/40">{m.createdAt.split(" ")[1]?.slice(0, 5)}</td>
                    <td className={`px-3 md:px-4 py-3 font-medium ${TYPE_COLORS[m.type] || ""}`}>{TYPE_LABELS[m.type] || m.type}</td>
                    <td className="px-3 md:px-4 py-3 text-white/50">{m.description || "-"}</td>
                    <td className={`px-3 md:px-4 py-3 text-right font-semibold ${["refund", "withdrawal"].includes(m.type) ? "text-red-400" : "text-green-400"}`}>{["refund", "withdrawal"].includes(m.type) ? "-" : "+"}{m.amount.toFixed(0)} TL</td>
                  </tr>
                ))}
                {register.movements.length === 0 && <tr><td colSpan={4} className="px-3 md:px-4 py-8 text-center text-white/30">Bugun hareket yok</td></tr>}
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
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
            <div className="card text-center"><p className="text-xl sm:text-3xl font-bold">{zReport.orders.totalOrders}</p><p className="text-[10px] sm:text-xs text-white/40">Toplam Siparis</p></div>
            <div className="card text-center"><p className="text-xl sm:text-3xl font-bold text-white/50">{zReport.orders.totalRevenue.toFixed(0)}</p><p className="text-[10px] sm:text-xs text-white/40">Hesap Toplam (TL)</p></div>
            <div className="card text-center"><p className="text-xl sm:text-3xl font-bold text-green-400">{zReport.orders.totalCollected.toFixed(0)}</p><p className="text-[10px] sm:text-xs text-white/40">Tahsil Edilen (TL)</p></div>
            <div className="card text-center"><p className="text-xl sm:text-3xl font-bold text-orange-400">{zReport.orders.totalDiscount.toFixed(0)}</p><p className="text-[10px] sm:text-xs text-white/40">Indirim (TL)</p></div>
            <div className="card text-center col-span-2 md:col-span-1"><p className="text-xl sm:text-3xl font-bold text-red-400">{zReport.orders.cancelledOrders || 0}</p><p className="text-[10px] sm:text-xs text-white/40">Iptal</p></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {zReport.paymentBreakdown.length > 0 && (
            <div className="card"><h3 className="text-base sm:text-lg font-semibold mb-3">Odeme Yontemleri</h3><div className="space-y-2">{zReport.paymentBreakdown.map((p) => (<div key={p.method} className="flex justify-between items-center py-2 border-b border-border last:border-0"><span className="text-sm">{p.method === "cash" ? "Nakit" : p.method === "card" ? "Kart" : "Online"}</span><div className="text-right"><span className="font-semibold text-sm">{p.total.toFixed(0)} TL</span><span className="text-white/40 text-xs ml-2">({p.count} islem)</span></div></div>))}</div></div>
          )}
          {zReport.sourceBreakdown.length > 0 && (
            <div className="card"><h3 className="text-base sm:text-lg font-semibold mb-3">Kaynak Dagilimi</h3><div className="space-y-2">{zReport.sourceBreakdown.map((s) => (<div key={s.source} className="flex justify-between items-center py-2 border-b border-border last:border-0"><span className="text-sm">{SOURCE_LABELS[s.source] || s.source}</span><div className="text-right"><span className="font-semibold text-sm">{s.total.toFixed(0)} TL</span><span className="text-white/40 text-xs ml-2">({s.count} siparis)</span></div></div>))}</div></div>
          )}
          </div>
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
