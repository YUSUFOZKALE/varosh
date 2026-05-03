"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ItemCustomizeModal, { type MenuItemOption, type CustomizedItem } from "@/components/item-customize-modal";

interface Category { id: number; name: string; }
interface MenuItem { id: number; categoryId: number; name: string; price: number; deliveryPrice: number | null; isAvailable: boolean; prepTimeMinutes: number; imageUrl: string | null; description: string | null; }
interface CartItem { key: string; menuItemId: number; name: string; price: number; quantity: number; imageUrl: string | null; removedIngredients: string[]; selectedExtras: number[]; notes: string; }

interface Customer { id: number; phone: string; name: string | null; address: string | null; orderCount: number; totalSpent: number }
type OrderType = "dine_in" | "takeaway" | "delivery";

const CATEGORY_ICONS: Record<string, string> = {
  "Doner": "🥙",
  "Tost & Sandvic": "🥪",
  "Atistirmalik": "🍟",
  "Icecekler": "🥤",
};

export default function PosPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>("dine_in");
  const [tableNumber, setTableNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [lastOrder, setLastOrder] = useState<{ id: number; total: number } | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [custSearch, setCustSearch] = useState("");
  const [showCustDropdown, setShowCustDropdown] = useState(false);
  const [deliveryFeeAmount, setDeliveryFeeAmount] = useState(20);
  const [options, setOptions] = useState<MenuItemOption[]>([]);
  const [customizeItem, setCustomizeItem] = useState<MenuItem | null>(null);
  const sectionRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [isScrolling, setIsScrolling] = useState(false);

  const load = useCallback(async () => {
    const [cRes, iRes, custRes, setRes, optRes] = await Promise.all([
      fetch("/api/menu/categories"),
      fetch("/api/menu/items"),
      fetch("/api/customers"),
      fetch("/api/settings"),
      fetch("/api/menu/options"),
    ]);
    const cats = await cRes.json();
    setCategories(cats);
    setItems(await iRes.json());
    setCustomers(await custRes.json());
    try {
      const settings: { key: string; value: string }[] = await setRes.json();
      const fee = settings.find((s) => s.key === "default_delivery_fee");
      if (fee) setDeliveryFeeAmount(parseFloat(fee.value));
    } catch {}
    try { setOptions(await optRes.json()); } catch {}
    if (cats.length > 0 && !selectedCat) setSelectedCat(cats[0].id);
  }, [selectedCat]);

  function selectCustomer(c: Customer) {
    setCustomerName(c.name || "");
    setCustomerPhone(c.phone);
    setDeliveryAddress(c.address || "");
    setCustSearch("");
    setShowCustDropdown(false);
  }

  function handleCustSearch(val: string) {
    setCustSearch(val);
    setShowCustDropdown(val.length >= 2);
  }

  const filteredCust = custSearch.length >= 2
    ? customers.filter((c) =>
        (c.name || "").toLowerCase().includes(custSearch.toLowerCase()) ||
        c.phone.includes(custSearch)
      ).slice(0, 5)
    : [];

  useEffect(() => { load(); }, [load]);

  function scrollToCategory(catId: number) {
    setSelectedCat(catId);
    setIsScrolling(true);
    const el = sectionRefs.current[catId];
    const container = scrollContainerRef.current;
    if (el && container) {
      const top = el.offsetTop - container.offsetTop;
      container.scrollTo({ top, behavior: "smooth" });
      setTimeout(() => setIsScrolling(false), 500);
    }
  }

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    function handleScroll() {
      if (isScrolling) return;
      for (const cat of [...categories].reverse()) {
        const el = sectionRefs.current[cat.id];
        if (el && container) {
          const top = el.offsetTop - container.offsetTop - container.scrollTop;
          if (top <= 10) { setSelectedCat(cat.id); break; }
        }
      }
    }
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [categories, isScrolling]);

  const availableItems = items.filter((i) => i.isAvailable);

  function handleItemClick(item: MenuItem) {
    setCustomizeItem(item);
  }

  function handleCustomizedAdd(ci: CustomizedItem) {
    const key = `${ci.menuItemId}_${ci.removedIngredients.sort().join(",")}_${ci.selectedExtras.sort().join(",")}_${ci.notes}`;
    setCart((prev) => {
      const existing = prev.find((c) => c.key === key);
      if (existing) {
        return prev.map((c) => c.key === key ? { ...c, quantity: c.quantity + ci.quantity } : c);
      }
      return [...prev, {
        key, menuItemId: ci.menuItemId, name: ci.name, price: ci.finalPrice, quantity: ci.quantity, imageUrl: ci.imageUrl,
        removedIngredients: ci.removedIngredients, selectedExtras: ci.selectedExtras, notes: ci.notes,
      }];
    });
  }

  function updateQty(key: string, delta: number) {
    setCart((prev) => prev
      .map((c) => c.key === key ? { ...c, quantity: c.quantity + delta } : c)
      .filter((c) => c.quantity > 0)
    );
  }

  function removeFromCart(key: string) {
    setCart((prev) => prev.filter((c) => c.key !== key));
  }

  const subtotal = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);
  const deliveryFee = orderType === "delivery" ? deliveryFeeAmount : 0;
  const total = subtotal + deliveryFee;

  async function submitOrder() {
    if (cart.length === 0) return;
    setSending(true);

    const body: Record<string, unknown> = {
      source: "manual",
      customerName: customerName || undefined,
      customerPhone: customerPhone || undefined,
      notes: notes || undefined,
      items: cart.map((c) => ({
        menuItemId: c.menuItemId,
        quantity: c.quantity,
        selectedOptions: c.selectedExtras.length > 0 ? c.selectedExtras : undefined,
        removedIngredients: c.removedIngredients.length > 0 ? c.removedIngredients : undefined,
        notes: c.notes || undefined,
      })),
    };

    if (orderType === "dine_in" && tableNumber) body.tableNumber = parseInt(tableNumber);
    if (orderType === "delivery" && deliveryAddress) body.deliveryAddress = deliveryAddress;

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const order = await res.json();
      setLastOrder({ id: order.id, total: order.total });
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setDeliveryAddress("");
      setTableNumber("");
      setNotes("");
      setTimeout(() => setLastOrder(null), 5000);
    }
    setSending(false);
  }

  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  return (
    <div className="flex h-screen bg-neutral-950">
      {/* Left: Menu */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-3">
            <a href="/" className="text-white/30 hover:text-white/60 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </a>
            <div>
              <img src="/logo-header.png" alt="VAROSH" className="h-7" />
              <p className="text-white/20 text-[10px] tracking-wider">POS SISTEMI</p>
            </div>
          </div>
          {cartCount > 0 && (
            <div className="bg-amber-500/20 text-amber-400 px-3 py-1.5 rounded-full text-xs font-bold">
              {cartCount} urun
            </div>
          )}
        </div>

        {/* Category Tabs */}
        <div className="flex gap-1.5 px-4 py-3 overflow-x-auto shrink-0 no-scrollbar">
          {categories.map((cat) => {
            const icon = CATEGORY_ICONS[cat.name] || "🍽️";
            const catItemCount = availableItems.filter((i) => i.categoryId === cat.id).length;
            return (
              <button
                key={cat.id}
                onClick={() => scrollToCategory(cat.id)}
                className={`flex items-center gap-1.5 px-5 py-3 rounded-xl text-sm font-semibold whitespace-nowrap transition-all active:scale-95 ${
                  selectedCat === cat.id
                    ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20"
                    : "bg-neutral-800/80 text-white/50 hover:text-white/70"
                }`}
              >
                <span>{icon}</span>
                {cat.name}
                <span className={`text-xs ${selectedCat === cat.id ? "text-black/40" : "text-white/20"}`}>({catItemCount})</span>
              </button>
            );
          })}
        </div>

        {/* All Categories & Products */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 pb-4">
          {categories.map((cat) => {
            const catItems = availableItems.filter((i) => i.categoryId === cat.id);
            if (catItems.length === 0) return null;
            const icon = CATEGORY_ICONS[cat.name] || "🍽️";
            return (
              <div key={cat.id} ref={(el) => { sectionRefs.current[cat.id] = el; }} className="mb-5">
                <div className="flex items-center gap-2 mb-2.5 pt-1">
                  <span className="text-lg">{icon}</span>
                  <h3 className="text-base font-bold text-white">{cat.name}</h3>
                  <span className="text-xs text-white/20">({catItems.length})</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                  {catItems.map((item) => {
                    const qty = cart.filter(c => c.menuItemId === item.id).reduce((s, c) => s + c.quantity, 0);
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleItemClick(item)}
                        className={`relative bg-neutral-900 border rounded-2xl overflow-hidden text-left transition-all active:scale-[0.97] ${
                          qty > 0
                            ? "border-amber-500/50 shadow-lg shadow-amber-500/10"
                            : "border-neutral-800/60 hover:border-neutral-700"
                        }`}
                      >
                        {item.imageUrl && (
                          <div className="relative">
                            <img src={item.imageUrl} alt={item.name} className="w-full h-28 object-cover" />
                            {qty > 0 && (
                              <div className="absolute top-2 right-2 bg-amber-500 text-black text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-lg">
                                {qty}
                              </div>
                            )}
                          </div>
                        )}
                        {!item.imageUrl && qty > 0 && (
                          <div className="absolute top-2 right-2 bg-amber-500 text-black text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-lg">
                            {qty}
                          </div>
                        )}
                        <div className="p-3">
                          <p className="font-semibold text-sm mb-1 line-clamp-2 text-white/90">{item.name}</p>
                          {item.description && (
                            <p className="text-white/30 text-[11px] mb-2 line-clamp-1">{item.description}</p>
                          )}
                          <div className="flex items-baseline gap-2">
                            <span className="text-amber-400 font-extrabold text-lg">{item.price}</span>
                            <span className="text-amber-400/60 text-xs font-semibold">TL</span>
                            {item.deliveryPrice && item.deliveryPrice !== item.price && (
                              <span className="text-white/20 text-[10px] ml-auto">Paket {item.deliveryPrice} TL</span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Cart Panel */}
      <div className="w-[340px] bg-neutral-900 border-l border-neutral-800/60 flex flex-col">
        {/* Order Type */}
        <div className="flex gap-1 p-3 border-b border-neutral-800/60">
          {([["dine_in", "Masa", "🍽️"], ["takeaway", "Gel Al", "🛍️"], ["delivery", "Paket", "🛵"]] as const).map(([type, label, icon]) => (
            <button
              key={type}
              onClick={() => setOrderType(type)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                orderType === type
                  ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20"
                  : "bg-neutral-800/60 text-white/40 hover:text-white/60"
              }`}
            >
              <span>{icon}</span>
              {label}
            </button>
          ))}
        </div>

        {/* Customer Info */}
        <div className="p-3 border-b border-neutral-800/60 space-y-2">
          {orderType === "dine_in" && (
            <input
              placeholder="Masa No"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              className="w-full bg-neutral-800/60 text-white text-center text-lg font-bold rounded-xl px-3 py-3 border border-neutral-700/50 focus:outline-none focus:border-amber-500/40 placeholder:text-white/20"
              type="number"
            />
          )}
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <input
              placeholder="Musteri ara..."
              value={custSearch}
              onChange={(e) => handleCustSearch(e.target.value)}
              onFocus={() => custSearch.length >= 2 && setShowCustDropdown(true)}
              className="w-full bg-neutral-800/60 text-white rounded-xl pl-9 pr-3 py-2.5 text-sm border border-neutral-700/50 focus:outline-none focus:border-amber-500/40 placeholder:text-white/20"
            />
            {showCustDropdown && filteredCust.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-neutral-800 border border-neutral-700 rounded-xl mt-1 z-20 max-h-40 overflow-y-auto shadow-xl">
                {filteredCust.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => selectCustomer(c)}
                    className="w-full text-left px-3 py-2.5 hover:bg-neutral-700 text-sm border-b border-neutral-700/50 last:border-0 transition-colors"
                  >
                    <span className="font-medium text-white">{c.name || "Isimsiz"}</span>
                    <span className="text-white/30 ml-2 text-xs">{c.phone}</span>
                    {c.orderCount > 0 && <span className="text-amber-400 text-xs ml-1">({c.orderCount})</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              placeholder="Musteri Adi"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full bg-neutral-800/60 text-white rounded-xl px-3 py-2.5 text-sm border border-neutral-700/50 focus:outline-none focus:border-amber-500/40 placeholder:text-white/20"
            />
            <input
              placeholder="Telefon"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="w-full bg-neutral-800/60 text-white rounded-xl px-3 py-2.5 text-sm border border-neutral-700/50 focus:outline-none focus:border-amber-500/40 placeholder:text-white/20"
            />
          </div>
          {orderType === "delivery" && (
            <input
              placeholder="Teslimat Adresi"
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              className="w-full bg-neutral-800/60 text-white rounded-xl px-3 py-2.5 text-sm border border-neutral-700/50 focus:outline-none focus:border-amber-500/40 placeholder:text-white/20"
            />
          )}
          <input
            placeholder="Siparis Notu"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-neutral-800/60 text-white rounded-xl px-3 py-2.5 text-xs border border-neutral-700/50 focus:outline-none focus:border-amber-500/40 placeholder:text-white/20"
          />
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-3">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 bg-neutral-800/50 rounded-full flex items-center justify-center mb-3">
                <svg className="w-8 h-8 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" /></svg>
              </div>
              <p className="text-white/15 text-sm">Urun ekleyin</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map((c) => (
                <div key={c.key} className="bg-neutral-800/40 rounded-xl p-3">
                  <div className="flex items-start gap-2.5">
                    {c.imageUrl && (
                      <img src={c.imageUrl} alt={c.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-white/90 truncate block">{c.name}</span>
                          {c.removedIngredients.length > 0 && (
                            <p className="text-red-400/50 text-[10px] mt-0.5">- {c.removedIngredients.join(", ")}</p>
                          )}
                          {c.selectedExtras.length > 0 && (
                            <p className="text-amber-400/50 text-[10px] mt-0.5">+ {c.selectedExtras.map((id) => options.find((o) => o.id === id)?.optionName).filter(Boolean).join(", ")}</p>
                          )}
                          {c.notes && (
                            <p className="text-blue-400/60 text-[10px] mt-0.5 italic">📝 {c.notes}</p>
                          )}
                        </div>
                        <button onClick={() => removeFromCart(c.key)} className="text-white/15 hover:text-red-400 transition-colors shrink-0">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => updateQty(c.key, -1)}
                            className="w-7 h-7 rounded-lg bg-neutral-700/80 text-white/80 font-bold flex items-center justify-center text-sm active:bg-neutral-600 transition-colors"
                          >
                            −
                          </button>
                          <span className="text-sm font-bold w-7 text-center text-white">{c.quantity}</span>
                          <button
                            onClick={() => updateQty(c.key, 1)}
                            className="w-7 h-7 rounded-lg bg-amber-500/90 text-black font-bold flex items-center justify-center text-sm active:bg-amber-400 transition-colors"
                          >
                            +
                          </button>
                        </div>
                        <span className="text-amber-400 font-bold text-sm">{(c.price * c.quantity).toFixed(0)} TL</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals + Submit */}
        <div className="p-3 border-t border-neutral-800/60 bg-neutral-900/80">
          {lastOrder && (
            <div className="bg-green-500/10 text-green-400 rounded-xl p-3 mb-2 text-center text-sm font-bold border border-green-500/20 flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
              Siparis #{lastOrder.id} — {lastOrder.total} TL
            </div>
          )}
          <div className="space-y-1 mb-3">
            <div className="flex justify-between text-sm">
              <span className="text-white/30">Ara Toplam</span>
              <span className="text-white/60">{subtotal.toFixed(0)} TL</span>
            </div>
            {deliveryFee > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-white/30">Teslimat</span>
                <span className="text-white/60">{deliveryFee} TL</span>
              </div>
            )}
            <div className="h-px bg-neutral-800/60" />
            <div className="flex justify-between text-lg font-bold">
              <span className="text-white">Toplam</span>
              <span className="text-amber-400">{total.toFixed(0)} TL</span>
            </div>
          </div>
          <button
            onClick={submitOrder}
            disabled={cart.length === 0 || sending}
            className="w-full py-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-lg transition-all disabled:opacity-20 disabled:cursor-not-allowed active:scale-[0.98] shadow-lg shadow-amber-500/20"
          >
            {sending ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                Gonderiliyor...
              </span>
            ) : (
              `Siparis Ver • ${total.toFixed(0)} TL`
            )}
          </button>
        </div>
      </div>

      {/* Customize Modal */}
      <ItemCustomizeModal
        item={customizeItem}
        options={options}
        onClose={() => setCustomizeItem(null)}
        onAdd={handleCustomizedAdd}
      />
    </div>
  );
}
