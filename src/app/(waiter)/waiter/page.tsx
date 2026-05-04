"use client";

import { useState, useEffect, useCallback, useRef } from "react";

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

type View = "tables" | "table-detail" | "menu" | "package-form" | "package-menu" | "gelal-menu";

export default function WaiterPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [openTables, setOpenTables] = useState<Set<number>>(new Set());
  const [view, setView] = useState<View>("tables");
  const [activeTable, setActiveTable] = useState<number | null>(null);
  const [tableSession, setTableSession] = useState<SessionData | null>(null);

  const [menuCats, setMenuCats] = useState<MenuCat[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuOptions, setMenuOptions] = useState<MenuOption[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCat, setActiveCat] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemNotes, setItemNotes] = useState("");
  const [itemOptions, setItemOptions] = useState<number[]>([]);
  const [itemRemoved, setItemRemoved] = useState<string[]>([]);

  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState<"masa" | "gelal" | "paket">("masa");
  const [deliveryPricing, setDeliveryPricing] = useState(false);

  // Package order state
  const [pkgName, setPkgName] = useState("");
  const [pkgPhone, setPkgPhone] = useState("");
  const [pkgAddress, setPkgAddress] = useState("");
  const [pkgCustomerFound, setPkgCustomerFound] = useState(false);
  const [pkgSearching, setPkgSearching] = useState(false);
  const phoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadTables = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    loadTables();
    const iv = setInterval(loadTables, 12000);
    return () => clearInterval(iv);
  }, [loadTables]);

  async function loadTableDetail(tableNumber: number) {
    const res = await fetch(`/api/tables/session?table=${tableNumber}`);
    if (res.ok) setTableSession(await res.json());
  }

  function openTable(tableNumber: number) {
    setActiveTable(tableNumber);
    setView("table-detail");
    loadTableDetail(tableNumber);
  }

  async function loadMenu() {
    if (menuCats.length > 0) return;
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
  }

  function startOrder() {
    setCart([]);
    setEditingItem(null);
    setDeliveryPricing(false);
    loadMenu();
    setView("menu");
  }

  function startPackageOrder() {
    setPkgName("");
    setPkgPhone("");
    setPkgAddress("");
    setPkgCustomerFound(false);
    setView("package-form");
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

  function proceedToPackageMenu() {
    setCart([]);
    setEditingItem(null);
    setDeliveryPricing(true);
    loadMenu();
    setView("package-menu");
  }

  function startGelalOrder() {
    setCart([]);
    setEditingItem(null);
    setDeliveryPricing(false);
    loadMenu();
    setView("gelal-menu");
  }

  async function submitGelalOrder() {
    if (cart.length === 0) return;
    setSending(true);
    await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "walk_in",
        items: cart.map((c) => ({
          menuItemId: c.menuItemId,
          quantity: c.qty,
          notes: c.notes || undefined,
          selectedOptions: c.selectedOptions.length > 0 ? c.selectedOptions : undefined,
          removedIngredients: c.removedIngredients.length > 0 ? c.removedIngredients : undefined,
        })),
      }),
    });
    setSending(false);
    setCart([]);
    setView("tables");
    setTab("masa");
  }

  function openItemDetail(item: MenuItem) {
    setEditingItem(item);
    setItemNotes("");
    setItemOptions([]);
    setItemRemoved([]);
  }

  function addToCart(item?: MenuItem) {
    const target = item || editingItem;
    if (!target) return;

    const optCost = itemOptions.reduce((s, optId) => {
      const opt = menuOptions.find((o) => o.id === optId);
      return s + (opt?.priceModifier || 0);
    }, 0);

    setCart((prev) => {
      const key = `${target.id}-${itemNotes}-${JSON.stringify(itemOptions.sort())}-${JSON.stringify(itemRemoved.sort())}`;
      const existing = prev.find((c) =>
        `${c.menuItemId}-${c.notes}-${JSON.stringify(c.selectedOptions.sort())}-${JSON.stringify(c.removedIngredients.sort())}` === key
      );
      if (existing) {
        return prev.map((c) => c === existing ? { ...c, qty: c.qty + 1 } : c);
      }
      const basePrice = deliveryPricing ? (target.deliveryPrice || target.price) : target.price;
      return [...prev, {
        menuItemId: target.id,
        name: target.name,
        price: basePrice + optCost,
        qty: 1,
        notes: itemNotes,
        selectedOptions: [...itemOptions],
        removedIngredients: [...itemRemoved],
      }];
    });
    setEditingItem(null);
    setItemNotes("");
    setItemOptions([]);
    setItemRemoved([]);
  }

  function quickAdd(item: MenuItem) {
    const basePrice = deliveryPricing ? (item.deliveryPrice || item.price) : item.price;
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
    if (!activeTable || cart.length === 0) return;
    setSending(true);
    await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "manual",
        tableNumber: activeTable,
        items: cart.map((c) => ({
          menuItemId: c.menuItemId,
          quantity: c.qty,
          notes: c.notes || undefined,
          selectedOptions: c.selectedOptions.length > 0 ? c.selectedOptions : undefined,
          removedIngredients: c.removedIngredients.length > 0 ? c.removedIngredients : undefined,
        })),
      }),
    });
    setSending(false);
    setCart([]);
    setView("table-detail");
    loadTableDetail(activeTable);
    loadTables();
  }

  async function submitPackageOrder() {
    if (cart.length === 0) return;
    setSending(true);
    await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "manual",
        customerName: pkgName || undefined,
        customerPhone: pkgPhone || undefined,
        deliveryAddress: pkgAddress || undefined,
        items: cart.map((c) => ({
          menuItemId: c.menuItemId,
          quantity: c.qty,
          notes: c.notes || undefined,
          selectedOptions: c.selectedOptions.length > 0 ? c.selectedOptions : undefined,
          removedIngredients: c.removedIngredients.length > 0 ? c.removedIngredients : undefined,
        })),
      }),
    });
    setSending(false);
    setCart([]);
    setPkgName("");
    setPkgPhone("");
    setPkgAddress("");
    setPkgCustomerFound(false);
    setView("tables");
    setTab("masa");
  }

  async function cancelOrder(orderId: number) {
    if (!confirm("Bu siparisi iptal etmek istediginize emin misiniz?")) return;
    await fetch(`/api/orders/${orderId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    if (activeTable) loadTableDetail(activeTable);
    loadTables();
  }

  async function removeOrderItem(orderId: number, itemId: number) {
    await fetch(`/api/orders/${orderId}/items`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ removeItemId: itemId }),
    });
    if (activeTable) loadTableDetail(activeTable);
  }

  async function updateItemQty(orderId: number, itemId: number, qty: number) {
    await fetch(`/api/orders/${orderId}/items`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updateItem: { itemId, quantity: qty } }),
    });
    if (activeTable) loadTableDetail(activeTable);
  }

  const cartTotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const cartCount = cart.reduce((s, c) => s + c.qty, 0);
  const itemOptionsForItem = editingItem ? menuOptions.filter((o) => o.menuItemId === editingItem.id) : [];
  const optionGroups = Array.from(new Set(itemOptionsForItem.map((o) => o.groupName)));

  const sectionRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  function scrollToCategory(catId: number) {
    const el = sectionRefs.current[catId];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveCat(catId);
  }

  function getItemPrice(item: MenuItem, delivery: boolean) {
    return delivery ? (item.deliveryPrice || item.price) : item.price;
  }

  function renderMenuView(backLabel: string, onBack: () => void, onSubmit: () => void, submitLabel: string, useDeliveryPrice = false) {
    return (
      <div className="flex flex-col h-[calc(100vh-52px)]">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
          <button onClick={() => { onBack(); setEditingItem(null); }} className="text-white/40 text-sm">&larr; {backLabel}</button>
          <h2 className="font-bold text-sm">Siparis Olustur</h2>
          <span className="text-amber-400 text-sm font-bold">{cartCount} urun</span>
        </div>

        {/* Category jump tabs */}
        <div className="flex gap-1 px-4 py-2 overflow-x-auto no-scrollbar shrink-0 border-b border-border">
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

        {/* Item detail overlay */}
        {editingItem && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end">
            <div className="bg-neutral-900 rounded-t-3xl w-full max-w-lg mx-auto p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">{editingItem.name}</h3>
                <span className="text-amber-400 font-bold">{getItemPrice(editingItem, useDeliveryPrice).toFixed(0)} TL</span>
              </div>
              {optionGroups.map((group) => (
                <div key={group}>
                  <p className="text-xs text-white/40 mb-1.5">{group}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {itemOptionsForItem.filter((o) => o.groupName === group).map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setItemOptions((prev) => prev.includes(opt.id) ? prev.filter((id) => id !== opt.id) : [...prev, opt.id])}
                        className={`px-3 py-1.5 rounded-lg text-xs transition-all ${itemOptions.includes(opt.id) ? "bg-amber-500/20 text-amber-400 border border-amber-500/40" : "bg-surface-2 text-white/50 border border-transparent"}`}
                      >
                        {opt.optionName} {opt.priceModifier > 0 && `+${opt.priceModifier.toFixed(0)}`}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div>
                <p className="text-xs text-white/40 mb-1.5">Not</p>
                <input
                  type="text"
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  placeholder="Ozel istek..."
                  className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setEditingItem(null)} className="py-2 rounded-lg bg-surface-2 text-white/30 font-medium text-xs">Iptal</button>
                <button onClick={() => addToCart()} className="py-2 rounded-lg bg-accent text-black font-bold text-xs">Ekle</button>
              </div>
            </div>
          </div>
        )}

        {/* All categories & items - scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5" ref={scrollContainerRef}>
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
                    return (
                      <button
                        key={item.id}
                        onClick={() => hasOptions ? openItemDetail(item) : quickAdd(item)}
                        className={`text-left rounded-xl transition-all active:scale-[0.97] border overflow-hidden ${inCart ? "bg-amber-500/10 border-amber-500/30" : "bg-surface-1 border-border"}`}
                      >
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="w-full h-20 object-cover" />
                        ) : (
                          <div className="w-full h-12 bg-surface-2 flex items-center justify-center">
                            <svg className="w-5 h-5 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          </div>
                        )}
                        <div className="p-2">
                          <p className="text-sm font-medium text-white truncate">{item.name}</p>
                          <div className="flex items-center justify-between mt-0.5">
                            <span className="text-amber-400 text-sm font-bold">{getItemPrice(item, useDeliveryPrice).toFixed(0)} TL</span>
                            {inCart && <span className="text-amber-400 text-xs font-bold bg-amber-500/20 px-1.5 py-0.5 rounded">{inCart.qty}</span>}
                          </div>
                          {hasOptions && <span className="text-white/20 text-[10px]">secenekli</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Cart summary + submit */}
        {cart.length > 0 && (
          <div className="shrink-0 border-t border-border bg-neutral-900/95">
            <div className="px-4 py-2 max-h-32 overflow-y-auto space-y-1">
              {cart.map((c, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => updateCartQty(i, -1)} className="w-5 h-5 bg-surface-2 rounded text-white/40 flex items-center justify-center">-</button>
                      <span className="text-white/50 font-bold w-5 text-center">{c.qty}</span>
                      <button onClick={() => updateCartQty(i, 1)} className="w-5 h-5 bg-surface-2 rounded text-white/40 flex items-center justify-center">+</button>
                    </div>
                    <span className="text-white/70 truncate">{c.name}</span>
                    {c.notes && <span className="text-blue-400/40 italic truncate">({c.notes})</span>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-white/40">{(c.price * c.qty).toFixed(0)}</span>
                    <button onClick={() => removeFromCart(i)} className="text-red-400/40 hover:text-red-400">&times;</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-border">
              <button
                onClick={onSubmit}
                disabled={sending}
                className="w-full py-4 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-bold text-lg transition-all active:scale-[0.97] disabled:opacity-40"
              >
                {sending ? "Gonderiliyor..." : `${submitLabel} (${cartTotal.toFixed(0)} TL)`}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ═══════════ TABLES VIEW ═══════════
  if (view === "tables") {
    return (
      <div className="p-4">
        {/* Tab bar */}
        <div className="flex gap-1 mb-4 bg-surface-1 rounded-xl p-1">
          <button
            onClick={() => setTab("masa")}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${tab === "masa" ? "bg-accent text-black" : "text-white/40"}`}
          >
            Masalar
          </button>
          <button
            onClick={() => setTab("gelal")}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${tab === "gelal" ? "bg-accent text-black" : "text-white/40"}`}
          >
            Gel Al
          </button>
          <button
            onClick={() => setTab("paket")}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${tab === "paket" ? "bg-accent text-black" : "text-white/40"}`}
          >
            Paket
          </button>
        </div>

        {tab === "masa" && (
          <>
            <div className="grid grid-cols-4 gap-2">
              {tables.filter((t) => t.isActive).map((t) => {
                const isOpen = openTables.has(t.number);
                return (
                  <button
                    key={t.id}
                    onClick={() => openTable(t.number)}
                    className={`aspect-square rounded-2xl flex flex-col items-center justify-center font-bold text-lg transition-all active:scale-[0.95] border-2 ${
                      isOpen
                        ? "bg-amber-500/20 border-amber-500/50 text-amber-400"
                        : "bg-surface-1 border-border text-white/30"
                    }`}
                  >
                    {t.number}
                    {isOpen && <span className="text-[9px] font-normal text-amber-400/70 mt-0.5">Acik</span>}
                  </button>
                );
              })}
            </div>
            {tables.length === 0 && (
              <div className="text-center py-16 text-white/20">Masa bulunamadi</div>
            )}
          </>
        )}

        {tab === "gelal" && (
          <div className="space-y-4">
            <div className="bg-surface-1 rounded-2xl border border-border p-4 text-center">
              <p className="text-white/40 text-sm">Musteri gelip alacak</p>
              <p className="text-white/20 text-xs mt-1">Menuyu acip urunleri secin</p>
            </div>
            <button
              onClick={startGelalOrder}
              className="w-full py-4 rounded-2xl bg-accent text-black font-bold text-lg transition-all active:scale-[0.97]"
            >
              Gel Al Siparisi Olustur
            </button>
          </div>
        )}

        {tab === "paket" && (
          <div className="space-y-4">
            <div className="bg-surface-1 rounded-2xl border border-border p-4 space-y-3">
              <p className="text-white/40 text-xs font-medium">Musteri Bilgileri</p>
              <div>
                <label className="text-xs text-white/30 mb-1 block">Telefon</label>
                <div className="relative">
                  <input
                    type="tel"
                    value={pkgPhone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="05XX XXX XX XX"
                    className={`w-full bg-surface-2 border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none transition-colors ${pkgCustomerFound ? "border-green-500/50 focus:border-green-500/70" : "border-border focus:border-amber-500/40"}`}
                  />
                  {pkgSearching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-white/10 border-t-amber-400 rounded-full animate-spin" />
                    </div>
                  )}
                  {pkgCustomerFound && !pkgSearching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-400 text-sm">&#10003;</div>
                  )}
                </div>
                {pkgCustomerFound && (
                  <p className="text-green-400/70 text-[11px] mt-1">Kayitli musteri bulundu</p>
                )}
              </div>
              <div>
                <label className="text-xs text-white/30 mb-1 block">Ad Soyad</label>
                <input
                  type="text"
                  value={pkgName}
                  onChange={(e) => setPkgName(e.target.value)}
                  placeholder="Musteri adi"
                  className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/40"
                />
              </div>
              <div>
                <label className="text-xs text-white/30 mb-1 block">Teslimat Adresi</label>
                <textarea
                  value={pkgAddress}
                  onChange={(e) => setPkgAddress(e.target.value)}
                  placeholder="Adres (bos birakilirsa gel-al)"
                  rows={2}
                  className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/40 resize-none"
                />
              </div>
            </div>
            <button
              onClick={proceedToPackageMenu}
              className="w-full py-4 rounded-2xl bg-accent text-black font-bold text-lg transition-all active:scale-[0.97]"
            >
              Menu&apos;den Urun Sec
            </button>
          </div>
        )}
      </div>
    );
  }

  // ═══════════ TABLE DETAIL VIEW ═══════════
  if (view === "table-detail" && activeTable) {
    const orders = tableSession?.orders || [];
    const activeOrders = orders.filter((o) => o.status !== "cancelled");
    const tableTotal = activeOrders.reduce((s, o) => s + o.total, 0);

    return (
      <div className="flex flex-col h-[calc(100vh-52px)]">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
          <button onClick={() => { setView("tables"); setActiveTable(null); }} className="text-white/40 text-sm">&larr; Masalar</button>
          <h2 className="font-bold">Masa {activeTable}</h2>
          <span className="text-amber-400 font-bold">{tableTotal.toFixed(0)} TL</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeOrders.length === 0 && (
            <div className="text-center py-12 text-white/20">
              <p className="text-lg mb-2">Siparis yok</p>
              <p className="text-sm">Asagidaki butonla siparis ekleyin</p>
            </div>
          )}

          {activeOrders.map((order) => (
            <div key={order.id} className={`rounded-xl p-3 ${order.paymentMethod ? "bg-green-900/10 border border-green-800/30" : "bg-surface-1 border border-border"}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-white/40 text-xs font-bold">#{order.id}</span>
                  <span className="text-white/20 text-xs">{new Date(order.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</span>
                  {order.paymentMethod && <span className="text-green-400 text-[10px] bg-green-600/20 px-1.5 py-0.5 rounded">Odendi</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white/50 text-xs font-semibold">{order.total.toFixed(0)} TL</span>
                  {!order.paymentMethod && (
                    <button
                      onClick={() => cancelOrder(order.id)}
                      className="text-red-400/50 hover:text-red-400 text-[10px] bg-red-900/20 px-1.5 py-0.5 rounded transition-colors"
                    >
                      Sil
                    </button>
                  )}
                </div>
              </div>

              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-1 group">
                  <div className="flex-1 min-w-0">
                    <span className="text-white/50 text-xs font-bold">{item.quantity}x</span>
                    <span className="text-white text-sm ml-1">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-white/40 text-xs">{item.totalPrice.toFixed(0)}</span>
                    {!order.paymentMethod && (
                      <>
                        <button onClick={() => updateItemQty(order.id, item.id, item.quantity - 1)} className="w-6 h-6 bg-surface-2 rounded text-white/40 text-xs flex items-center justify-center active:bg-surface-3">-</button>
                        <button onClick={() => updateItemQty(order.id, item.id, item.quantity + 1)} className="w-6 h-6 bg-surface-2 rounded text-white/40 text-xs flex items-center justify-center active:bg-surface-3">+</button>
                        <button onClick={() => removeOrderItem(order.id, item.id)} className="w-6 h-6 bg-red-900/30 rounded text-red-400/60 text-xs flex items-center justify-center active:bg-red-900/50">&times;</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="shrink-0 p-4 border-t border-border">
          <button
            onClick={startOrder}
            className="w-full py-4 rounded-2xl bg-accent text-black font-bold text-lg transition-all active:scale-[0.97]"
          >
            + Siparis Ekle
          </button>
        </div>
      </div>
    );
  }

  // ═══════════ TABLE MENU VIEW ═══════════
  if (view === "menu" && activeTable) {
    return renderMenuView(
      `Masa ${activeTable}`,
      () => setView("table-detail"),
      submitOrder,
      "Siparisi Gonder"
    );
  }

  // ═══════════ PACKAGE FORM VIEW ═══════════
  // (handled in tables view with tab === "paket")

  // ═══════════ GEL AL MENU VIEW ═══════════
  if (view === "gelal-menu") {
    return renderMenuView(
      "Gel Al",
      () => { setView("tables"); setTab("gelal"); },
      submitGelalOrder,
      "Gel Al Siparisi Gonder"
    );
  }

  // ═══════════ PACKAGE MENU VIEW ═══════════
  if (view === "package-menu") {
    return renderMenuView(
      "Paket Bilgileri",
      () => { setView("tables"); setTab("paket"); },
      submitPackageOrder,
      "Paket Siparisi Gonder",
      true
    );
  }

  return null;
}
