"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { type MenuItemOption } from "@/components/item-customize-modal";
import { usePublicSettings } from "@/hooks/use-public-settings";

interface Category { id: number; name: string; sortOrder: number }
interface MenuItem { id: number; name: string; description: string | null; price: number; categoryId: number; imageUrl: string | null }
interface CartItem {
  key: string;
  menuItemId: number;
  name: string;
  price: number;
  quantity: number;
  imageUrl: string | null;
  removedIngredients: string[];
  selectedExtras: number[];
  notes: string;
}

interface SessionOrder {
  id: number;
  total: number;
  status: string;
  createdAt: string;
  items: { name: string; quantity: number; unitPrice: number; totalPrice: number }[];
}

interface TableSession {
  id: number;
  tableNumber: number;
  status: string;
  total: number;
  openedAt: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  "Doner": "🥙",
  "Tost & Sandvic": "🥪",
  "Atistirmalik": "🍟",
  "Icecekler": "🥤",
};

const CATEGORY_COLORS: Record<string, string> = {
  "Doner": "from-amber-900/60 to-amber-800/30",
  "Tost & Sandvic": "from-orange-900/60 to-orange-800/30",
  "Atistirmalik": "from-red-900/60 to-red-800/30",
  "Icecekler": "from-sky-900/60 to-sky-800/30",
};

export default function TableOrderPage() {
  const { tableNo } = useParams<{ tableNo: string }>();
  const ps = usePublicSettings();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [options, setOptions] = useState<MenuItemOption[]>([]);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState("");
  const [showCart, setShowCart] = useState(false);
  const [customizeItem, setCustomizeItem] = useState<MenuItem | null>(null);
  const [custRemoved, setCustRemoved] = useState<Set<string>>(new Set());
  const [custExtras, setCustExtras] = useState<Set<number>>(new Set());
  const [custQty, setCustQty] = useState(1);
  const [custNotes, setCustNotes] = useState("");
  const [isScrolling, setIsScrolling] = useState(false);
  const sectionRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const [session, setSession] = useState<TableSession | null>(null);
  const [sessionOrders, setSessionOrders] = useState<SessionOrder[]>([]);
  const [showTab, setShowTab] = useState(false);
  const [orderSent, setOrderSent] = useState(false);

  const loadMenu = useCallback(async () => {
    const res = await fetch("/api/table-menu");
    if (!res.ok) { setLoading(false); return; }
    const data = await res.json();
    setCategories(data.categories);
    setItems(data.items);
    setOptions(data.options);
    if (data.categories.length > 0) setActiveCategory(data.categories[0].id);
    setLoading(false);
  }, []);

  const loadSession = useCallback(async () => {
    const res = await fetch(`/api/tables/session?table=${tableNo}`);
    if (!res.ok) return;
    const data = await res.json();
    setSession(data.session);
    setSessionOrders(data.orders || []);
  }, [tableNo]);

  useEffect(() => { loadMenu(); loadSession(); }, [loadMenu, loadSession]);

  function scrollToCategory(catId: number) {
    setActiveCategory(catId);
    setIsScrolling(true);
    const el = sectionRefs.current[catId];
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 120;
      window.scrollTo({ top: y, behavior: "smooth" });
      setTimeout(() => setIsScrolling(false), 500);
    }
  }

  useEffect(() => {
    function handleScroll() {
      if (isScrolling) return;
      for (const cat of [...categories].reverse()) {
        const el = sectionRefs.current[cat.id];
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 140) { setActiveCategory(cat.id); break; }
        }
      }
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [categories, isScrolling]);

  function handleItemClick(item: MenuItem) {
    if (customizeItem?.id === item.id) { setCustomizeItem(null); return; }
    setCustomizeItem(item);
    setCustRemoved(new Set());
    setCustExtras(new Set());
    setCustQty(1);
    setCustNotes("");
  }

  function addCustomizedToCart() {
    if (!customizeItem) return;
    const itemOpts = options.filter((o) => o.menuItemId === customizeItem.id);
    const extrasCost = itemOpts.filter((o) => o.groupName === "Ekstralar" && custExtras.has(o.id)).reduce((s, o) => s + o.priceModifier, 0);
    const finalPrice = customizeItem.price + extrasCost;
    const removedArr = Array.from(custRemoved).sort();
    const extrasArr = Array.from(custExtras).sort();
    const key = `${customizeItem.id}_${removedArr.join(",")}_${extrasArr.join(",")}_${custNotes.trim()}`;
    setCart((prev) => {
      const existing = prev.find((c) => c.key === key);
      if (existing) return prev.map((c) => c.key === key ? { ...c, quantity: c.quantity + custQty } : c);
      return [...prev, {
        key,
        menuItemId: customizeItem.id,
        name: customizeItem.name,
        price: finalPrice,
        quantity: custQty,
        imageUrl: customizeItem.imageUrl,
        removedIngredients: removedArr,
        selectedExtras: extrasArr,
        notes: custNotes.trim(),
      }];
    });
    setCustomizeItem(null);
  }


  function updateQty(key: string, delta: number) {
    setCart((prev) => prev
      .map((c) => c.key === key ? { ...c, quantity: c.quantity + delta } : c)
      .filter((c) => c.quantity > 0)
    );
  }

  function getItemQty(menuItemId: number) {
    return cart.filter((c) => c.menuItemId === menuItemId).reduce((s, c) => s + c.quantity, 0);
  }

  const cartTotal = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);
  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0);
  const sessionTotal = session?.total || 0;
  const grandTotal = sessionTotal + cartTotal;

  async function submitOrder() {
    if (cart.length === 0) return;
    setSubmitting(true);

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "qr",
        tableNumber: parseInt(tableNo),
        items: cart.map((c) => ({
          menuItemId: c.menuItemId,
          quantity: c.quantity,
          selectedOptions: c.selectedExtras.length > 0 ? c.selectedExtras : undefined,
          removedIngredients: c.removedIngredients.length > 0 ? c.removedIngredients : undefined,
          notes: c.notes || undefined,
        })),
        notes: notes.trim() || undefined,
      }),
    });

    if (res.ok) {
      setCart([]);
      setShowCart(false);
      setNotes("");
      setOrderSent(true);
      setTimeout(() => setOrderSent(false), 4000);
      loadSession();
    }
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mx-auto" />
          <p className="text-white/40 mt-4 text-sm">Menu yukleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 pb-28">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-600 via-amber-500 to-orange-500" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(0,0,0,0),rgba(0,0,0,0.3))]" />
        <div className="relative px-5 pt-8 pb-5">
          <div className="flex items-center justify-between">
            <div>
              {ps.logoUrl ? <img src={ps.logoUrl} alt={ps.businessName} className="h-10 drop-shadow-lg object-contain" /> : <span className="text-xl font-bold text-amber-400">{ps.businessName}</span>}
            </div>
            <div className="flex items-center gap-2">
              {session && (
                <button
                  onClick={() => setShowTab(true)}
                  className="bg-black/20 backdrop-blur-sm rounded-2xl px-3 py-2 text-center border border-white/10"
                >
                  <p className="text-amber-100/60 text-[9px] uppercase tracking-wider">Hesap</p>
                  <p className="text-white text-sm font-bold leading-none mt-0.5">{sessionTotal.toFixed(0)} TL</p>
                </button>
              )}
              <div className="bg-black/20 backdrop-blur-sm rounded-2xl px-4 py-2.5 text-center">
                <p className="text-amber-100/60 text-[10px] uppercase tracking-wider">Masa</p>
                <p className="text-white text-2xl font-extrabold leading-none mt-0.5">{tableNo}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Order sent toast */}
      {orderSent && (
        <div className="fixed top-4 left-4 right-4 z-50 animate-slide-down">
          <div className="bg-green-600 text-white rounded-2xl px-5 py-4 flex items-center gap-3 shadow-2xl">
            <svg className="w-6 h-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
            <div>
              <p className="font-bold text-sm">Siparis mutfaga iletildi!</p>
              <p className="text-green-100/80 text-xs">Eklemek isterseniz menuye devam edin</p>
            </div>
          </div>
        </div>
      )}

      {/* Category Tabs */}
      <div className="sticky top-0 z-20 bg-neutral-950/95 backdrop-blur-lg border-b border-neutral-800/80 shadow-lg shadow-black/20">
        <div className="flex overflow-x-auto px-4 py-3 gap-2 no-scrollbar">
          {categories.map((cat) => {
            const isActive = activeCategory === cat.id;
            const icon = CATEGORY_ICONS[cat.name] || "🍽️";
            return (
              <button
                key={cat.id}
                onClick={() => scrollToCategory(cat.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-amber-500 text-black shadow-lg shadow-amber-500/25 scale-105"
                    : "bg-neutral-800/80 text-white/50 active:scale-95"
                }`}
              >
                <span className="text-base">{icon}</span>
                {cat.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Menu Sections */}
      <div className="px-3 pt-4">
        {categories.map((cat) => {
          const catItems = items.filter((i) => i.categoryId === cat.id);
          if (catItems.length === 0) return null;
          const icon = CATEGORY_ICONS[cat.name] || "🍽️";
          const catColor = CATEGORY_COLORS[cat.name] || "from-neutral-800/60 to-neutral-700/30";
          return (
            <div key={cat.id} ref={(el) => { sectionRefs.current[cat.id] = el; }} className="mb-5">
              <div className="flex items-center gap-2 mb-2.5 pt-1 px-1">
                <span className="text-lg">{icon}</span>
                <h2 className="text-base font-bold text-white">{cat.name}</h2>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {catItems.map((item) => {
                  const qty = getItemQty(item.id);
                  const isExpanded = customizeItem?.id === item.id;
                  const itemOpts = isExpanded ? options.filter((o) => o.menuItemId === item.id) : [];
                  const ingredients = itemOpts.filter((o) => o.groupName === "Icindekiler");
                  const extraOpts = itemOpts.filter((o) => o.groupName === "Ekstralar");
                  const extrasCost = isExpanded ? extraOpts.filter((o) => custExtras.has(o.id)).reduce((s, o) => s + o.priceModifier, 0) : 0;
                  const unitPrice = item.price + extrasCost;
                  const totalPrice = unitPrice * custQty;

                  return (
                    <div key={item.id} className="relative">
                      <button
                        onClick={() => handleItemClick(item)}
                        className={`relative w-full bg-neutral-900 rounded-xl overflow-hidden border text-left transition-all active:scale-[0.97] ${
                          qty > 0
                            ? "border-amber-500/50 ring-1 ring-amber-500/20"
                            : "border-neutral-800/60"
                        }`}
                      >
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="w-full aspect-square object-cover" />
                        ) : (
                          <div className={`w-full aspect-square bg-gradient-to-br ${catColor} flex items-center justify-center`}>
                            <span className="text-2xl opacity-30">{icon}</span>
                          </div>
                        )}
                        {qty > 0 && (
                          <div className="absolute top-1 right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center text-black text-[10px] font-extrabold shadow-md">
                            {qty}
                          </div>
                        )}
                        <div className="p-1.5 pb-2">
                          <p className="text-white text-[11px] font-semibold leading-tight line-clamp-2 min-h-[28px]">{item.name}</p>
                          <p className="text-amber-400 font-bold text-xs mt-1">{item.price.toFixed(0)} TL</p>
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="absolute inset-x-0 top-0 z-40 bg-neutral-900 border-2 border-amber-500/60 rounded-xl overflow-hidden shadow-2xl shadow-black/40">
                          <div className="px-3 py-2 border-b border-neutral-800/60">
                            <div className="flex items-center justify-between">
                              <h3 className="font-bold text-white text-base leading-tight">{item.name}</h3>
                              <button onClick={() => setCustomizeItem(null)} className="w-7 h-7 bg-neutral-800 rounded-lg flex items-center justify-center text-white/40 shrink-0">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            </div>
                            <span className="text-amber-400 font-extrabold text-lg">{item.price.toFixed(0)} TL</span>
                          </div>
                          <div className="px-3 py-2 space-y-2 max-h-[50vh] overflow-y-auto">
                            {ingredients.length > 0 && (
                              <div>
                                <p className="text-[11px] font-bold text-white/40 mb-1.5 uppercase">Cikar</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {ingredients.map((ing) => {
                                    const isRem = custRemoved.has(ing.optionName);
                                    return (
                                      <button key={ing.id} onClick={() => setCustRemoved((p) => { const n = new Set(p); if (n.has(ing.optionName)) n.delete(ing.optionName); else n.add(ing.optionName); return n; })} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${isRem ? "bg-red-500/15 text-red-400 line-through border border-red-500/20" : "bg-neutral-800 text-white/70 border border-neutral-700/50"}`}>
                                        {ing.optionName}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            {extraOpts.length > 0 && (
                              <div>
                                <p className="text-[11px] font-bold text-white/40 mb-1.5 uppercase">Ekstra</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {extraOpts.map((ext) => {
                                    const isSel = custExtras.has(ext.id);
                                    return (
                                      <button key={ext.id} onClick={() => setCustExtras((p) => { const n = new Set(p); if (n.has(ext.id)) n.delete(ext.id); else n.add(ext.id); return n; })} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${isSel ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "bg-neutral-800 text-white/70 border border-neutral-700/50"}`}>
                                        {ext.optionName} <span className="text-white/30">+{ext.priceModifier}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            <textarea value={custNotes} onChange={(e) => setCustNotes(e.target.value)} placeholder="Not..." rows={2} className="w-full bg-neutral-800/60 text-white rounded-lg px-3 py-2 text-[11px] border border-neutral-700/50 focus:outline-none focus:border-amber-500/40 placeholder:text-white/20 resize-none overflow-y-auto" />
                            <div className="flex items-center gap-2 pt-1">
                              <div className="flex items-center bg-neutral-800 rounded-full shrink-0">
                                <button onClick={() => setCustQty(Math.max(1, custQty - 1))} className="w-9 h-9 rounded-full flex items-center justify-center text-white/80 text-base font-bold">−</button>
                                <span className="text-white font-bold text-base min-w-[24px] text-center">{custQty}</span>
                                <button onClick={() => setCustQty(custQty + 1)} className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center text-black text-base font-bold">+</button>
                              </div>
                              <button onClick={addCustomizedToCart} className="flex-1 py-2 rounded-xl bg-amber-500 text-black font-bold text-xs active:scale-[0.97]">
                                Ekle {custQty}x {totalPrice.toFixed(0)} TL
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

      {customizeItem && <div className="fixed inset-0 z-30" onClick={() => setCustomizeItem(null)} />}

      {/* Floating Cart Bar */}
      {cartCount > 0 && !showCart && (
        <div className="fixed bottom-0 left-0 right-0 p-4 z-30">
          <button
            onClick={() => setShowCart(true)}
            className="w-full py-4 rounded-2xl bg-amber-500 text-black font-bold text-base flex items-center justify-between px-5 shadow-2xl shadow-amber-500/30 active:scale-[0.98] transition-transform"
          >
            <span className="bg-black/20 rounded-xl w-8 h-8 flex items-center justify-center text-sm font-extrabold">{cartCount}</span>
            <span className="text-base font-extrabold">Sepeti Gor</span>
            <span className="font-extrabold">{cartTotal.toFixed(0)} TL</span>
          </button>
        </div>
      )}

      {/* Cart Drawer */}
      {showCart && (
        <div className="fixed inset-0 z-40 flex flex-col">
          <div className="flex-1 bg-black/70 backdrop-blur-sm" onClick={() => setShowCart(false)} />
          <div className="bg-neutral-900 rounded-t-3xl max-h-[90vh] flex flex-col animate-slide-up">
            <div className="p-5 border-b border-neutral-800/80 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" /></svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Yeni Eklemeler</h2>
                  <p className="text-white/30 text-xs">Masa {tableNo} &middot; {cartCount} urun</p>
                </div>
              </div>
              <button onClick={() => setShowCart(false)} className="w-10 h-10 bg-neutral-800 rounded-full flex items-center justify-center text-white/40 hover:text-white">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.map((c) => (
                <div key={c.key} className="bg-neutral-800/50 rounded-2xl p-3">
                  <div className="flex items-center gap-3">
                    {c.imageUrl && <img src={c.imageUrl} alt={c.name} className="w-14 h-14 rounded-xl object-cover shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm truncate">{c.name}</p>
                      {c.removedIngredients.length > 0 && (
                        <p className="text-red-400/60 text-[11px] mt-0.5">- {c.removedIngredients.join(", ")}</p>
                      )}
                      {c.selectedExtras.length > 0 && (
                        <p className="text-amber-400/60 text-[11px] mt-0.5">
                          + {c.selectedExtras.map((id) => options.find((o) => o.id === id)?.optionName).filter(Boolean).join(", ")}
                        </p>
                      )}
                      {c.notes && <p className="text-blue-400/60 text-[11px] mt-0.5 italic">📝 {c.notes}</p>}
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-0 bg-neutral-700/50 rounded-full">
                          <button onClick={() => updateQty(c.key, -1)} className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 active:bg-neutral-600">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" /></svg>
                          </button>
                          <span className="text-white font-bold text-sm min-w-[24px] text-center">{c.quantity}</span>
                          <button onClick={() => updateQty(c.key, 1)} className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-black active:bg-amber-400">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                          </button>
                        </div>
                        <span className="text-amber-400 font-bold text-sm">{(c.price * c.quantity).toFixed(0)} TL</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="shrink-0 border-t border-neutral-800/80 bg-neutral-900">
              <div className="p-4 space-y-2">
                {sessionTotal > 0 && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/40">Mevcut hesap</span>
                      <span className="text-white/60">{sessionTotal.toFixed(0)} TL</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/40">Yeni eklemeler</span>
                      <span className="text-white/60">+{cartTotal.toFixed(0)} TL</span>
                    </div>
                    <div className="h-px bg-neutral-800" />
                    <div className="flex justify-between font-bold text-lg">
                      <span className="text-white">Toplam Hesap</span>
                      <span className="text-amber-400">{grandTotal.toFixed(0)} TL</span>
                    </div>
                  </>
                )}
                {sessionTotal === 0 && (
                  <div className="flex justify-between font-bold text-lg">
                    <span className="text-white">Toplam</span>
                    <span className="text-amber-400">{cartTotal.toFixed(0)} TL</span>
                  </div>
                )}
              </div>
              <div className="px-4 pb-2">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Siparis notu (istege bagli)..."
                  className="w-full bg-neutral-800/70 text-white rounded-xl p-3 text-sm border border-neutral-700/50 resize-none h-14 placeholder:text-white/25 focus:outline-none focus:border-amber-500/30"
                />
              </div>
              <div className="p-4 pt-2 pb-6">
                <button
                  onClick={submitOrder}
                  disabled={submitting}
                  className="w-full py-4 rounded-2xl font-bold text-lg transition-all active:scale-[0.98] disabled:opacity-40 bg-green-500 text-white shadow-xl shadow-green-500/20"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Gonderiliyor...
                    </span>
                  ) : (
                    `Mutfaga Gonder • ${cartTotal.toFixed(0)} TL`
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table Tab / Hesap Drawer */}
      {showTab && (
        <div className="fixed inset-0 z-40 flex flex-col">
          <div className="flex-1 bg-black/70 backdrop-blur-sm" onClick={() => setShowTab(false)} />
          <div className="bg-neutral-900 rounded-t-3xl max-h-[85vh] flex flex-col animate-slide-up">
            <div className="p-5 border-b border-neutral-800/80 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-lg font-bold text-white">Masa {tableNo} Hesabi</h2>
                <p className="text-white/30 text-xs">{sessionOrders.length} siparis &middot; {session?.openedAt ? new Date(session.openedAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : ""} dan beri</p>
              </div>
              <button onClick={() => setShowTab(false)} className="w-10 h-10 bg-neutral-800 rounded-full flex items-center justify-center text-white/40 hover:text-white">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {sessionOrders.length === 0 && (
                <p className="text-white/30 text-center py-8 text-sm">Henuz siparis yok</p>
              )}
              {sessionOrders.map((order, idx) => (
                <div key={order.id} className="bg-neutral-800/40 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="bg-amber-500/20 text-amber-400 text-xs font-bold px-2 py-0.5 rounded-lg">#{order.id}</span>
                      <span className="text-white/30 text-xs">
                        {new Date(order.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-lg ${
                      order.status === "delivered" ? "bg-green-600/20 text-green-400" :
                      order.status === "preparing" ? "bg-blue-600/20 text-blue-400" :
                      order.status === "ready" ? "bg-purple-600/20 text-purple-400" :
                      "bg-neutral-700/50 text-white/40"
                    }`}>
                      {order.status === "new" ? "Bekliyor" : order.status === "preparing" ? "Hazirlaniyor" : order.status === "ready" ? "Hazir" : order.status === "delivered" ? "Teslim" : order.status}
                    </span>
                  </div>
                  {order.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm py-1">
                      <span className="text-white/70">{item.quantity}x {item.name}</span>
                      <span className="text-white/50">{item.totalPrice.toFixed(0)} TL</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-semibold pt-2 mt-2 border-t border-neutral-700/30">
                    <span className="text-white/50">Siparis Toplam</span>
                    <span className="text-amber-400">{order.total.toFixed(0)} TL</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="shrink-0 border-t border-neutral-800/80 bg-neutral-900 p-5">
              <div className="flex justify-between font-bold text-xl mb-4">
                <span className="text-white">Masa Hesabi</span>
                <span className="text-amber-400">{sessionTotal.toFixed(0)} TL</span>
              </div>
              <button
                onClick={() => setShowTab(false)}
                className="w-full py-3 rounded-2xl bg-amber-500 text-black font-bold text-base active:scale-[0.98] transition-transform"
              >
                Siparis Eklemeye Devam Et
              </button>
            </div>
          </div>
        </div>
      )}


      <style jsx>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up { animation: slide-up 0.3s ease-out; }
        @keyframes slide-down {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-down { animation: slide-down 0.3s ease-out; }
      `}</style>
    </div>
  );
}
