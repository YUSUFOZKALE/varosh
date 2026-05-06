"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@/hooks/useToast";
import { ToastContainer } from "@/components/ToastContainer";

interface Table {
  id: number;
  number: number;
  label: string | null;
  isActive: boolean;
}

interface OrderItem {
  id: number;
  orderId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  selectedOptions: string | null;
  removedIngredients: string | null;
  notes: string | null;
}

interface Order {
  id: number;
  tableNumber: number;
  total: number;
  subtotal: number;
  status: string;
  paymentMethod: string | null;
  createdAt: string;
  items: OrderItem[];
  customerName: string | null;
  customerPhone: string | null;
  deliveryAddress: string | null;
}

interface SessionData {
  session: { id: number; tableNumber: number; status: string; openedAt: string; total: number } | null;
  orders: Order[];
}

interface MenuCat { id: number; name: string; sortOrder: number }
interface MenuItem { id: number; name: string; price: number; deliveryPrice: number | null; categoryId: number; isAvailable: boolean; imageUrl: string | null }
interface MenuOption { id: number; menuItemId: number; groupName: string; optionName: string; priceModifier: number; isDefault: boolean }

interface CartItem {
  menuItemId: number;
  name: string;
  price: number;
  qty: number;
  notes: string;
  selectedOptions: number[];
  removedIngredients: string[];
}

export default function WaiterPage() {
  const toast = useToast();

  const [tables, setTables] = useState<Table[]>([]);
  const [openTables, setOpenTables] = useState<Set<number>>(new Set());
  const [tab, setTab] = useState<"masa" | "gelal" | "paket">("masa");

  // Masa state
  const [activeTable, setActiveTable] = useState<number | null>(null);
  const [tableSession, setTableSession] = useState<SessionData | null>(null);
  const [showTableOrders, setShowTableOrders] = useState(false);

  // Menu
  const [menuCats, setMenuCats] = useState<MenuCat[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuOptions, setMenuOptions] = useState<MenuOption[]>([]);
  const [menuLoaded, setMenuLoaded] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCat, setActiveCat] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemNotes, setItemNotes] = useState("");
  const [itemOptions, setItemOptions] = useState<number[]>([]);
  const [itemRemoved, setItemRemoved] = useState<string[]>([]);
  const [itemQty, setItemQty] = useState(1);
  const [sending, setSending] = useState(false);
  const [showCart, setShowCart] = useState(false);

  // Paket state
  const [pkgName, setPkgName] = useState("");
  const [pkgPhone, setPkgPhone] = useState("");
  const [pkgAddress, setPkgAddress] = useState("");
  const [pkgCustomerFound, setPkgCustomerFound] = useState(false);
  const [pkgSearching, setPkgSearching] = useState(false);
  const phoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Gel-al state
  const [gelalName, setGelalName] = useState("");
  const [gelalPhone, setGelalPhone] = useState("");
  const [gelalCustomerFound, setGelalCustomerFound] = useState(false);
  const [gelalSearching, setGelalSearching] = useState(false);
  const gelalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sectionRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const loadTables = useCallback(async () => {
    try {
      const [tRes, sRes] = await Promise.all([
        fetch("/api/tables"),
        fetch("/api/tables/sessions/open"),
      ]);
      if (tRes.ok) setTables(await tRes.json());
      if (sRes.ok) {
        const data = await sRes.json();
        const openNums = new Set<number>((data.sessions || []).map((s: { session: { tableNumber: number } }) => s.session.tableNumber));
        setOpenTables(openNums);
      }
    } catch {}
  }, []);

  const loadMenu = useCallback(async () => {
    if (menuLoaded) return;
    try {
      const [cRes, iRes, oRes] = await Promise.all([
        fetch("/api/menu/categories"),
        fetch("/api/menu/items"),
        fetch("/api/menu/options"),
      ]);
      const cats: MenuCat[] = await cRes.json();
      const items: MenuItem[] = await iRes.json();
      setMenuCats(cats);
      setMenuItems(items.filter((i) => i.isAvailable));
      if (oRes.ok) setMenuOptions(await oRes.json());
      if (cats.length > 0) setActiveCat(cats[0].id);
      setMenuLoaded(true);
    } catch {}
  }, [menuLoaded]);

  useEffect(() => {
    loadTables();
    loadMenu();
    const iv = setInterval(loadTables, 12000);
    return () => clearInterval(iv);
  }, [loadTables, loadMenu]);

  async function loadTableDetail(tableNumber: number) {
    try {
      const res = await fetch(`/api/tables/session?table=${tableNumber}`);
      if (res.ok) setTableSession(await res.json());
    } catch {}
  }

  function selectTable(tableNumber: number) {
    if (activeTable === tableNumber) {
      setActiveTable(null);
      setTableSession(null);
      return;
    }
    setActiveTable(tableNumber);
    loadTableDetail(tableNumber);
  }

  function handlePhoneChange(value: string) {
    setPkgPhone(value);
    setPkgCustomerFound(false);
    if (phoneTimerRef.current) clearTimeout(phoneTimerRef.current);
    const digits = value.replace(/\D/g, "");
    if (digits.length >= 10) {
      phoneTimerRef.current = setTimeout(() => lookupCustomer(digits), 400);
    }
  }

  async function lookupCustomer(phone: string) {
    setPkgSearching(true);
    try {
      const res = await fetch(`/api/customers?search=${encodeURIComponent(phone)}`);
      if (res.ok) {
        const customers = await res.json();
        const match = customers.find((c: any) => c.phone && c.phone.replace(/\D/g, "").endsWith(phone.slice(-10)));
        if (match) {
          if (match.name && !pkgName) setPkgName(match.name);
          if (match.address && !pkgAddress) setPkgAddress(match.address);
          setPkgCustomerFound(true);
        }
      }
    } catch {}
    setPkgSearching(false);
  }

  function handleGelalPhoneChange(value: string) {
    setGelalPhone(value);
    setGelalCustomerFound(false);
    if (gelalTimerRef.current) clearTimeout(gelalTimerRef.current);
    const digits = value.replace(/\D/g, "");
    if (digits.length >= 10) {
      gelalTimerRef.current = setTimeout(() => lookupGelalCustomer(digits), 400);
    }
  }

  async function lookupGelalCustomer(phone: string) {
    setGelalSearching(true);
    try {
      const res = await fetch(`/api/customers?search=${encodeURIComponent(phone)}`);
      if (res.ok) {
        const customers = await res.json();
        const match = customers.find((c: any) => c.phone && c.phone.replace(/\D/g, "").endsWith(phone.slice(-10)));
        if (match) {
          if (match.name && !gelalName) setGelalName(match.name);
          setGelalCustomerFound(true);
        }
      }
    } catch {}
    setGelalSearching(false);
  }

  function openItemDetail(item: MenuItem) {
    if (editingItem?.id === item.id) { setEditingItem(null); return; }
    setEditingItem(item);
    setItemNotes("");
    setItemOptions([]);
    setItemRemoved([]);
    setItemQty(1);
  }

  function addToCart(item?: MenuItem) {
    const target = item || editingItem;
    if (!target) return;

    const optCost = itemOptions.reduce((s, optId) => {
      const opt = menuOptions.find((o) => o.id === optId);
      return s + (opt?.priceModifier || 0);
    }, 0);

    const useDelivery = tab === "paket";

    setCart((prev) => {
      const key = `${target.id}-${itemNotes}-${JSON.stringify(itemOptions.sort())}-${JSON.stringify(itemRemoved.sort())}`;
      const existing = prev.find((c) =>
        `${c.menuItemId}-${c.notes}-${JSON.stringify(c.selectedOptions.sort())}-${JSON.stringify(c.removedIngredients.sort())}` === key
      );
      if (existing) {
        return prev.map((c) => c === existing ? { ...c, qty: c.qty + itemQty } : c);
      }
      const basePrice = useDelivery ? (target.deliveryPrice || target.price) : target.price;
      return [...prev, {
        menuItemId: target.id,
        name: target.name,
        price: basePrice + optCost,
        qty: itemQty,
        notes: itemNotes,
        selectedOptions: [...itemOptions],
        removedIngredients: [...itemRemoved],
      }];
    });
    setEditingItem(null);
    setItemNotes("");
    setItemOptions([]);
    setItemRemoved([]);
    setItemQty(1);
  }

  function quickAdd(item: MenuItem) {
    const useDelivery = tab === "paket";
    const basePrice = useDelivery ? (item.deliveryPrice || item.price) : item.price;
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.id && !c.notes && c.selectedOptions.length === 0 && c.removedIngredients.length === 0);
      if (existing) return prev.map((c) => c === existing ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { menuItemId: item.id, name: item.name, price: basePrice, qty: 1, notes: "", selectedOptions: [], removedIngredients: [] }];
    });
  }

  function removeFromCart(idx: number) {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateCartQty(idx: number, delta: number) {
    setCart((prev) => prev.map((c, i) => {
      if (i !== idx) return c;
      const newQty = c.qty + delta;
      return newQty > 0 ? { ...c, qty: newQty } : c;
    }).filter((c) => c.qty > 0));
  }

  async function submitOrder() {
    if (cart.length === 0) return;

    if (tab === "masa" && !activeTable) {
      toast.error("Masa secin");
      return;
    }

    setSending(true);
    try {
      const body: any = {
        items: cart.map((c) => ({
          menuItemId: c.menuItemId,
          quantity: c.qty,
          notes: c.notes || undefined,
          selectedOptions: c.selectedOptions.length > 0 ? c.selectedOptions : undefined,
          removedIngredients: c.removedIngredients.length > 0 ? c.removedIngredients : undefined,
        })),
      };

      if (tab === "masa") {
        body.source = "manual";
        body.tableNumber = activeTable;
      } else if (tab === "gelal") {
        body.source = "walk_in";
        if (gelalName) body.customerName = gelalName;
        if (gelalPhone) body.customerPhone = gelalPhone;
      } else if (tab === "paket") {
        body.source = "manual";
        if (pkgName) body.customerName = pkgName;
        if (pkgPhone) body.customerPhone = pkgPhone;
        if (pkgAddress) body.deliveryAddress = pkgAddress;
      }

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        toast.error("Siparis gonderilemedi");
        setSending(false);
        return;
      }

      toast.success("Siparis gonderildi");
      setCart([]);
      setShowCart(false);

      if (tab === "masa" && activeTable) {
        loadTableDetail(activeTable);
        loadTables();
      } else if (tab === "gelal") {
        setGelalName("");
        setGelalPhone("");
        setGelalCustomerFound(false);
      } else if (tab === "paket") {
        setPkgName("");
        setPkgPhone("");
        setPkgAddress("");
        setPkgCustomerFound(false);
      }
    } catch {
      toast.error("Baglanti hatasi");
    }
    setSending(false);
  }

  async function cancelOrder(orderId: number) {
    if (!confirm("Bu siparisi iptal etmek istediginize emin misiniz?")) return;
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (!res.ok) {
        toast.error("Siparis iptal edilemedi");
        return;
      }
      toast.success("Siparis iptal edildi");
      if (activeTable) loadTableDetail(activeTable);
      loadTables();
    } catch {
      toast.error("Baglanti hatasi");
    }
  }

  async function removeOrderItem(orderId: number, itemId: number) {
    try {
      const res = await fetch(`/api/orders/${orderId}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeItemId: itemId }),
      });
      if (!res.ok) {
        toast.error("Urun silinemedi");
        return;
      }
      if (activeTable) loadTableDetail(activeTable);
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
      if (!res.ok) {
        toast.error("Miktar guncellenemedi");
        return;
      }
      if (activeTable) loadTableDetail(activeTable);
    } catch {
      toast.error("Baglanti hatasi");
    }
  }

  function scrollToCategory(catId: number) {
    const el = sectionRefs.current[catId];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveCat(catId);
  }

  function getItemPrice(item: MenuItem) {
    return tab === "paket" ? (item.deliveryPrice || item.price) : item.price;
  }

  function switchTab(newTab: "masa" | "gelal" | "paket") {
    setTab(newTab);
    setCart([]);
    setEditingItem(null);
    setShowCart(false);
    if (newTab !== "masa") {
      setActiveTable(null);
      setTableSession(null);
      setShowTableOrders(false);
    }
  }

  const cartTotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const cartCount = cart.reduce((s, c) => s + c.qty, 0);
  const itemOptionsForItem = editingItem ? menuOptions.filter((o) => o.menuItemId === editingItem.id) : [];
  const optionGroups = Array.from(new Set(itemOptionsForItem.map((o) => o.groupName)));

  const submitLabel = tab === "masa" ? "Siparisi Gonder" : tab === "gelal" ? "Gel Al Gonder" : "Paket Gonder";

  const activeOrders = tableSession?.orders?.filter((o) => o.status !== "cancelled") || [];
  const tableTotal = activeOrders.reduce((s, o) => s + o.total, 0);

  return (
    <div className="flex flex-col h-[100dvh]">
      {/* ─── TOP: Tab bar ─── */}
      <div className="shrink-0 px-3 pt-3 pb-2">
        <div className="flex gap-1 bg-surface-1 rounded-xl p-1">
          {(["masa", "gelal", "paket"] as const).map((t) => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${tab === t ? "bg-accent text-black" : "text-white/40"}`}
            >
              {t === "masa" ? "Masa" : t === "gelal" ? "Gel Al" : "Paket"}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Customer / Table selection area ─── */}
      <div className="shrink-0 px-3 pb-2">
        {tab === "masa" && (
          <div>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {tables.filter((t) => t.isActive).map((t) => {
                const isOpen = openTables.has(t.number);
                const isSelected = activeTable === t.number;
                return (
                  <button
                    key={t.id}
                    onClick={() => selectTable(t.number)}
                    className={`shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center font-bold text-base transition-all active:scale-[0.95] border-2 ${
                      isSelected
                        ? "bg-accent/20 border-accent text-accent"
                        : isOpen
                          ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                          : "bg-surface-1 border-border text-white/30"
                    }`}
                  >
                    {t.number}
                    {isOpen && !isSelected && <span className="text-[8px] font-normal text-amber-400/60">Acik</span>}
                    {isSelected && <span className="text-[8px] font-normal text-accent/70">Secili</span>}
                  </button>
                );
              })}
            </div>
            {activeTable && activeOrders.length > 0 && (
              <button
                onClick={() => setShowTableOrders(!showTableOrders)}
                className="mt-1.5 w-full flex items-center justify-between px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs"
              >
                <span className="text-amber-400 font-medium">Masa {activeTable} - {activeOrders.length} siparis ({tableTotal.toFixed(0)} TL)</span>
                <span className="text-white/30">{showTableOrders ? "Gizle" : "Gor"}</span>
              </button>
            )}
            {showTableOrders && activeOrders.length > 0 && (
              <div className="mt-1.5 max-h-48 overflow-y-auto space-y-2">
                {activeOrders.map((order) => (
                  <div key={order.id} className={`rounded-xl p-2.5 ${order.paymentMethod ? "bg-green-900/10 border border-green-800/30" : "bg-surface-1 border border-border"}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-white/40 text-[10px] font-bold">#{order.id}</span>
                        <span className="text-white/20 text-[10px]">{new Date(order.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</span>
                        {order.paymentMethod && <span className="text-green-400 text-[9px] bg-green-600/20 px-1 py-0.5 rounded">Odendi</span>}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-white/50 text-[10px] font-semibold">{order.total.toFixed(0)} TL</span>
                        {!order.paymentMethod && (
                          <button onClick={() => cancelOrder(order.id)} className="text-red-400/50 text-[9px] bg-red-900/20 px-1 py-0.5 rounded">Sil</button>
                        )}
                      </div>
                    </div>
                    {order.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between py-0.5">
                        <span className="text-white/60 text-[11px] truncate flex-1"><span className="font-bold">{item.quantity}x</span> {item.name}</span>
                        <div className="flex items-center gap-1 shrink-0 ml-1">
                          <span className="text-white/30 text-[10px]">{item.totalPrice.toFixed(0)}</span>
                          {!order.paymentMethod && (
                            <>
                              <button onClick={() => updateItemQty(order.id, item.id, item.quantity - 1)} className="w-5 h-5 bg-surface-2 rounded text-white/30 text-[10px] flex items-center justify-center">-</button>
                              <button onClick={() => updateItemQty(order.id, item.id, item.quantity + 1)} className="w-5 h-5 bg-surface-2 rounded text-white/30 text-[10px] flex items-center justify-center">+</button>
                              <button onClick={() => removeOrderItem(order.id, item.id)} className="w-5 h-5 bg-red-900/30 rounded text-red-400/50 text-[10px] flex items-center justify-center">&times;</button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
            {tables.length === 0 && <div className="text-center py-4 text-white/20 text-sm">Masa bulunamadi</div>}
          </div>
        )}

        {tab === "gelal" && (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="tel"
                value={gelalPhone}
                onChange={(e) => handleGelalPhoneChange(e.target.value)}
                className="w-full bg-surface-1 rounded-xl px-3 py-2.5 text-sm text-white border border-border focus:outline-none focus:border-accent/50"
                placeholder="Telefon"
              />
              {gelalSearching && (
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-accent/40 border-t-accent rounded-full animate-spin" />
                </div>
              )}
              {gelalCustomerFound && (
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
              )}
            </div>
            <input
              type="text"
              value={gelalName}
              onChange={(e) => setGelalName(e.target.value)}
              className="flex-1 bg-surface-1 rounded-xl px-3 py-2.5 text-sm text-white border border-border focus:outline-none focus:border-accent/50"
              placeholder="Ad Soyad"
            />
          </div>
        )}

        {tab === "paket" && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="tel"
                  value={pkgPhone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="Telefon"
                  className={`w-full bg-surface-1 border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none transition-colors ${pkgCustomerFound ? "border-green-500/50" : "border-border focus:border-accent/50"}`}
                />
                {pkgSearching && (
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-white/10 border-t-amber-400 rounded-full animate-spin" />
                  </div>
                )}
                {pkgCustomerFound && !pkgSearching && (
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-green-400 text-sm">&#10003;</div>
                )}
              </div>
              <input
                type="text"
                value={pkgName}
                onChange={(e) => setPkgName(e.target.value)}
                placeholder="Ad Soyad"
                className="flex-1 bg-surface-1 border border-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent/50"
              />
            </div>
            <textarea
              value={pkgAddress}
              onChange={(e) => setPkgAddress(e.target.value)}
              placeholder="Teslimat adresi"
              rows={1}
              className="w-full bg-surface-1 border border-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/50 resize-none"
            />
          </div>
        )}
      </div>

      {/* ─── Category tabs ─── */}
      <div className="flex gap-1 px-3 py-1.5 overflow-x-auto no-scrollbar shrink-0 border-t border-b border-border">
        {menuCats.map((cat) => (
          <button
            key={cat.id}
            onClick={() => scrollToCategory(cat.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${activeCat === cat.id ? "bg-accent text-black" : "bg-surface-2 text-white/40"}`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* ─── MIDDLE: Menu items (scrollable) ─── */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4" ref={scrollContainerRef}>
        {menuCats.map((cat) => {
          const catItems = menuItems.filter((i) => i.categoryId === cat.id);
          if (catItems.length === 0) return null;
          return (
            <div key={cat.id} ref={(el) => { sectionRefs.current[cat.id] = el; }}>
              <h3 className="text-xs font-bold text-white/30 uppercase tracking-wider mb-2 sticky top-0 bg-surface py-1 z-10">{cat.name}</h3>
              <div className="grid grid-cols-2 gap-2">
                {catItems.map((item) => {
                  const hasOptions = menuOptions.some((o) => o.menuItemId === item.id);
                  const inCart = cart.find((c) => c.menuItemId === item.id);
                  const isExpanded = editingItem?.id === item.id;
                  const optCostCalc = isExpanded ? itemOptions.reduce((s, id) => { const o = menuOptions.find((x) => x.id === id); return s + (o?.priceModifier || 0); }, 0) : 0;
                  const unitPrice = isExpanded ? getItemPrice(item) + optCostCalc : 0;
                  const totalPrice = unitPrice * itemQty;

                  return (
                    <div key={item.id} className="relative">
                      <button
                        onClick={() => hasOptions ? openItemDetail(item) : quickAdd(item)}
                        className={`w-full text-left rounded-xl transition-all active:scale-[0.97] border overflow-hidden ${inCart ? "bg-amber-500/10 border-amber-500/30" : "bg-surface-1 border-border"}`}
                      >
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="w-full h-20 object-cover" />
                        ) : (
                          <div className="w-full h-10 bg-surface-2 flex items-center justify-center">
                            <svg className="w-4 h-4 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          </div>
                        )}
                        <div className="p-2">
                          <p className="text-sm font-medium text-white truncate">{item.name}</p>
                          <div className="flex items-center justify-between mt-0.5">
                            <span className="text-amber-400 text-sm font-bold">{getItemPrice(item).toFixed(0)} TL</span>
                            {inCart && <span className="text-amber-400 text-xs font-bold bg-amber-500/20 px-1.5 py-0.5 rounded">{inCart.qty}</span>}
                          </div>
                          {hasOptions && <span className="text-white/20 text-[10px]">secenekli</span>}
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="fixed inset-x-0 bottom-0 z-40 bg-neutral-900 border-t-2 border-amber-500/60 rounded-t-2xl overflow-hidden shadow-2xl shadow-black/40 sm:absolute sm:inset-x-0 sm:top-0 sm:bottom-auto sm:rounded-xl sm:border-2">
                          <div className="px-3 py-2 border-b border-neutral-800/60">
                            <div className="flex items-center justify-between">
                              <h3 className="font-bold text-white text-base leading-tight">{item.name}</h3>
                              <button onClick={() => setEditingItem(null)} className="w-7 h-7 bg-neutral-800 rounded-lg flex items-center justify-center text-white/40 shrink-0">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            </div>
                            <span className="text-amber-400 font-extrabold text-lg">{getItemPrice(item).toFixed(0)} TL</span>
                          </div>
                          <div className="px-3 py-2 space-y-2 max-h-[50vh] overflow-y-auto">
                            {optionGroups.map((group) => (
                              <div key={group}>
                                <p className="text-[11px] font-bold text-white/40 mb-1 uppercase">{group}</p>
                                <div className="flex flex-wrap gap-1">
                                  {itemOptionsForItem.filter((o) => o.groupName === group).map((opt) => (
                                    <button key={opt.id} onClick={() => setItemOptions((prev) => prev.includes(opt.id) ? prev.filter((id) => id !== opt.id) : [...prev, opt.id])} className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${itemOptions.includes(opt.id) ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "bg-neutral-800 text-white/70 border border-neutral-700/50"}`}>
                                      {opt.optionName} {opt.priceModifier > 0 && <span className="text-white/30">+{opt.priceModifier.toFixed(0)}</span>}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                            <textarea value={itemNotes} onChange={(e) => setItemNotes(e.target.value)} placeholder="Not..." rows={2} className="w-full bg-neutral-800/60 text-white rounded-lg px-2.5 py-1.5 text-[11px] border border-neutral-700/50 focus:outline-none focus:border-amber-500/40 placeholder:text-white/20 resize-none overflow-y-auto" />
                            <div className="flex items-center gap-2 pt-1">
                              <div className="flex items-center bg-neutral-800 rounded-full shrink-0">
                                <button onClick={() => setItemQty(Math.max(1, itemQty - 1))} className="w-8 h-8 rounded-full flex items-center justify-center text-white/80 text-sm font-bold">−</button>
                                <span className="text-white font-bold text-sm min-w-[20px] text-center">{itemQty}</span>
                                <button onClick={() => setItemQty(itemQty + 1)} className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-black text-sm font-bold">+</button>
                              </div>
                              <button onClick={() => addToCart()} className="flex-1 py-2 rounded-xl bg-amber-500 text-black font-bold text-xs active:scale-[0.97]">
                                Ekle {itemQty}x {totalPrice.toFixed(0)} TL
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
        {/* spacer for fixed bottom bar */}
        <div className="h-20" />
      </div>
      {editingItem && <div className="fixed inset-0 z-30" onClick={() => setEditingItem(null)} />}

      {/* ─── Cart detail overlay ─── */}
      {showCart && cart.length > 0 && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowCart(false)} />
          <div className="fixed bottom-[72px] left-0 right-0 z-50 bg-neutral-900 border-t border-amber-500/30 rounded-t-2xl max-h-[50vh] overflow-y-auto px-4 py-3 space-y-1.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white font-bold text-sm">Sepet</span>
              <button onClick={() => setShowCart(false)} className="text-white/30 text-sm">Kapat</button>
            </div>
            {cart.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button onClick={() => updateCartQty(i, -1)} className="w-5 h-5 bg-surface-2 rounded text-white/40 flex items-center justify-center">-</button>
                    <span className="text-white/50 font-bold w-5 text-center">{c.qty}</span>
                    <button onClick={() => updateCartQty(i, 1)} className="w-5 h-5 bg-surface-2 rounded text-white/40 flex items-center justify-center">+</button>
                  </div>
                  <span className="text-white/70 truncate">{c.name}</span>
                  {c.notes && <span className="text-blue-400/40 italic truncate text-[10px]">({c.notes})</span>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-1">
                  <span className="text-white/40">{(c.price * c.qty).toFixed(0)}</span>
                  <button onClick={() => removeFromCart(i)} className="text-red-400/40 hover:text-red-400">&times;</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ─── BOTTOM: Fixed submit bar ─── */}
      <div className="shrink-0 border-t border-border bg-neutral-900/95 px-3 py-3 z-30">
        {cart.length > 0 ? (
          <div className="flex gap-2">
            <button
              onClick={() => setShowCart(!showCart)}
              className="shrink-0 w-12 h-12 rounded-xl bg-surface-1 border border-border flex flex-col items-center justify-center"
            >
              <span className="text-amber-400 font-bold text-sm">{cartCount}</span>
              <span className="text-white/20 text-[8px]">urun</span>
            </button>
            <button
              onClick={submitOrder}
              disabled={sending || (tab === "masa" && !activeTable)}
              className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-base transition-all active:scale-[0.97] disabled:opacity-40"
            >
              {sending ? "Gonderiliyor..." : `${submitLabel} (${cartTotal.toFixed(0)} TL)`}
            </button>
          </div>
        ) : (
          <div className="text-center text-white/20 text-sm py-2">
            {tab === "masa" && !activeTable ? "Masa secip urun ekleyin" : "Menuден urun ekleyin"}
          </div>
        )}
      </div>

      <ToastContainer toasts={toast.toasts} />
    </div>
  );
}
