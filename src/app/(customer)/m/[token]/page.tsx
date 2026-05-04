"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import ItemCustomizeModal, { type MenuItemOption, type CustomizedItem } from "@/components/item-customize-modal";
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
}
interface LinkInfo { name: string; phone: string; address: string; expiresAt: string }

const CATEGORY_ICONS: Record<string, string> = {
  "Doner": "🥙",
  "Tost & Sandvic": "🥪",
  "Atistirmalik": "🍟",
  "Icecekler": "🥤",
};

export default function CustomerOrderPage() {
  const { token } = useParams<{ token: string }>();
  const ps = usePublicSettings();
  const [linkInfo, setLinkInfo] = useState<LinkInfo | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [options, setOptions] = useState<MenuItemOption[]>([]);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState("");
  const [orderResult, setOrderResult] = useState<{ orderId: number; total: number; trackingToken: string } | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState(20);
  const [minOrder, setMinOrder] = useState(0);
  const [customizeItem, setCustomizeItem] = useState<MenuItem | null>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const sectionRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const load = useCallback(async () => {
    const res = await fetch(`/api/menu-links/${token}`);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Gecersiz link");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setLinkInfo(data.link);
    setCategories(data.categories);
    setItems(data.items);
    setOptions(data.options || []);
    setDeliveryFee(data.deliveryFee || 20);
    setMinOrder(data.minOrderAmount || 0);
    if (data.categories.length > 0) setActiveCategory(data.categories[0].id);
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

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
    const itemOpts = options.filter((o) => o.menuItemId === item.id);
    if (itemOpts.length > 0) {
      setCustomizeItem(item);
    } else {
      addSimpleItem(item);
    }
  }

  function addSimpleItem(item: MenuItem) {
    const key = `${item.id}_simple`;
    setCart((prev) => {
      const existing = prev.find((c) => c.key === key);
      if (existing) {
        return prev.map((c) => c.key === key ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { key, menuItemId: item.id, name: item.name, price: item.price, quantity: 1, imageUrl: item.imageUrl, removedIngredients: [], selectedExtras: [] }];
    });
  }

  function handleCustomizedAdd(ci: CustomizedItem) {
    const key = `${ci.menuItemId}_${ci.removedIngredients.sort().join(",")}_${ci.selectedExtras.sort().join(",")}`;
    setCart((prev) => {
      const existing = prev.find((c) => c.key === key);
      if (existing) {
        return prev.map((c) => c.key === key ? { ...c, quantity: c.quantity + ci.quantity } : c);
      }
      return [...prev, {
        key,
        menuItemId: ci.menuItemId,
        name: ci.name,
        price: ci.finalPrice,
        quantity: ci.quantity,
        imageUrl: ci.imageUrl,
        removedIngredients: ci.removedIngredients,
        selectedExtras: ci.selectedExtras,
      }];
    });
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
  const belowMinimum = minOrder > 0 && cartTotal < minOrder;

  async function submitOrder() {
    if (cart.length === 0) return;
    setSubmitting(true);
    const res = await fetch(`/api/menu-links/${token}/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: cart.map((c) => ({
          menuItemId: c.menuItemId,
          quantity: c.quantity,
          selectedOptions: c.selectedExtras.length > 0 ? c.selectedExtras : undefined,
          removedIngredients: c.removedIngredients.length > 0 ? c.removedIngredients : undefined,
        })),
        notes: notes.trim() || undefined,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Siparis olusturulamadi");
      setSubmitting(false);
      return;
    }
    const data = await res.json();
    setOrderResult(data);
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

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
          </div>
          <p className="text-red-400 text-lg font-semibold mb-2">{error}</p>
          <p className="text-white/30 text-sm">Bu link artik gecerli degil veya suresi dolmus olabilir.</p>
        </div>
      </div>
    );
  }

  if (orderResult) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
        <div className="text-center max-w-sm w-full space-y-5">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Siparisiniiz Alindi!</h1>
          <div className="bg-neutral-900 rounded-2xl p-5 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-white/50 text-sm">Siparis No</span>
              <span className="font-bold text-white text-lg">#{orderResult.orderId}</span>
            </div>
            <div className="h-px bg-neutral-800" />
            <div className="flex justify-between items-center">
              <span className="text-white/50 text-sm">Toplam Tutar</span>
              <span className="font-bold text-amber-400 text-lg">{orderResult.total.toFixed(0)} TL</span>
            </div>
            <div className="h-px bg-neutral-800" />
            <div className="flex justify-between items-center">
              <span className="text-white/50 text-sm">Tahmini Teslimat</span>
              <span className="text-white/80 text-sm">30-45 dakika</span>
            </div>
          </div>
          <a
            href={`/track/${orderResult.trackingToken}`}
            className="block w-full py-4 rounded-2xl bg-amber-500 text-black font-bold text-base active:scale-[0.98] transition-transform"
          >
            Siparisi Canli Takip Et
          </a>
          <p className="text-white/20 text-xs pt-2">{ps.businessName}{ps.businessPhone ? ` · ${ps.businessPhone}` : ""}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 pb-28">
      {/* Hero Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-600 via-amber-500 to-orange-500" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(0,0,0,0),rgba(0,0,0,0.3))]" />
        <div className="relative px-5 pt-10 pb-7">
          <div className="flex items-center justify-between mb-4">
            <div>
              {ps.logoUrl ? <img src={ps.logoUrl} alt={ps.businessName} className="h-12 drop-shadow-lg object-contain" /> : <span className="text-2xl font-bold text-amber-400">{ps.businessName}</span>}
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl px-4 py-2 text-right">
              {ps.businessAddress && <p className="text-white text-xs font-medium">{ps.businessAddress}</p>}
              <p className="text-amber-100/70 text-[10px] mt-0.5">25-40 dk teslimat</p>
            </div>
          </div>
          {linkInfo && (
            <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-4 mt-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-lg shrink-0">
                  {(linkInfo.name || "?")[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-white font-semibold text-sm truncate">Merhaba, {linkInfo.name || "Misafir"}</p>
                  {linkInfo.address && (
                    <p className="text-amber-100/60 text-xs truncate flex items-center gap-1">
                      <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/></svg>
                      {linkInfo.address}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticky Category Tabs */}
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
      <div className="px-4 pt-4">
        {categories.map((cat) => {
          const catItems = items.filter((i) => i.categoryId === cat.id);
          if (catItems.length === 0) return null;
          const icon = CATEGORY_ICONS[cat.name] || "🍽️";
          return (
            <div key={cat.id} ref={(el) => { sectionRefs.current[cat.id] = el; }} className="mb-6">
              <div className="flex items-center gap-2 mb-3 pt-2">
                <span className="text-xl">{icon}</span>
                <h2 className="text-lg font-bold text-white">{cat.name}</h2>
                <span className="text-xs text-white/30 ml-1">({catItems.length})</span>
              </div>
              <div className="space-y-3">
                {catItems.map((item) => {
                  const qty = getItemQty(item.id);
                  const hasOpts = options.some((o) => o.menuItemId === item.id);
                  return (
                    <div
                      key={item.id}
                      className={`bg-neutral-900 rounded-2xl overflow-hidden border transition-all ${
                        qty > 0 ? "border-amber-500/40 shadow-lg shadow-amber-500/5" : "border-neutral-800/60"
                      }`}
                    >
                      <div className="flex">
                        <div className="flex-1 p-4 flex flex-col justify-between min-h-[120px]">
                          <div>
                            <h3 className="font-bold text-white text-[15px] leading-tight mb-1">{item.name}</h3>
                            {item.description && (
                              <p className="text-white/40 text-xs leading-relaxed line-clamp-2">{item.description}</p>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-3">
                            <span className="text-amber-400 font-extrabold text-lg">{item.price.toFixed(0)} <span className="text-sm font-bold">TL</span></span>
                            {qty > 0 && !hasOpts ? (
                              <div className="flex items-center gap-0 bg-neutral-800 rounded-full">
                                <button onClick={() => updateQty(`${item.id}_simple`, -1)} className="w-9 h-9 rounded-full flex items-center justify-center text-white/80 active:bg-neutral-700">
                                  {qty === 1 ? (
                                    <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  ) : (
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" /></svg>
                                  )}
                                </button>
                                <span className="text-white font-bold text-sm min-w-[28px] text-center">{qty}</span>
                                <button onClick={() => handleItemClick(item)} className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center text-black active:bg-amber-400">
                                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleItemClick(item)}
                                className="bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-bold text-sm px-5 py-2 rounded-full transition-all shadow-lg shadow-amber-500/20"
                              >
                                Ekle
                              </button>
                            )}
                          </div>
                        </div>
                        {item.imageUrl && (
                          <div className="w-[130px] shrink-0 relative overflow-hidden">
                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover min-h-[120px]" />
                            <div className="absolute inset-0 bg-gradient-to-r from-neutral-900 via-transparent to-transparent w-8" />
                            {qty > 0 && (
                              <div className="absolute top-2 right-2 w-7 h-7 bg-amber-500 rounded-full flex items-center justify-center text-black text-xs font-extrabold shadow-lg shadow-amber-500/30 ring-2 ring-amber-400/30">
                                {qty}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

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
                  <h2 className="text-lg font-bold text-white">Sepetiniz</h2>
                  <p className="text-white/30 text-xs">{cartCount} urun</p>
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
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-0 bg-neutral-700/50 rounded-full">
                          <button onClick={() => updateQty(c.key, -1)} className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 active:bg-neutral-600">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" /></svg>
                          </button>
                          <span className="text-white font-bold text-sm min-w-[24px] text-center">{c.quantity}</span>
                          <button onClick={() => {
                            const item = items.find((i) => i.id === c.menuItemId);
                            if (item) handleItemClick(item);
                          }} className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-black active:bg-amber-400">
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
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Ara Toplam</span>
                  <span className="text-white/80">{cartTotal.toFixed(0)} TL</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Teslimat Ucreti</span>
                  <span className="text-white/80">{deliveryFee} TL</span>
                </div>
                <div className="h-px bg-neutral-800" />
                <div className="flex justify-between font-bold text-lg">
                  <span className="text-white">Toplam</span>
                  <span className="text-amber-400">{(cartTotal + deliveryFee).toFixed(0)} TL</span>
                </div>
              </div>
              <div className="px-4 pb-2">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Siparis notu ekleyin (istege bagli)..."
                  className="w-full bg-neutral-800/70 text-white rounded-xl p-3 text-sm border border-neutral-700/50 resize-none h-14 placeholder:text-white/25 focus:outline-none focus:border-amber-500/30"
                />
              </div>
              <div className="p-4 pt-2 pb-6">
                <button
                  onClick={submitOrder}
                  disabled={submitting || belowMinimum}
                  className="w-full py-4 rounded-2xl font-bold text-lg transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed bg-green-500 text-white shadow-xl shadow-green-500/20"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Gonderiliyor...
                    </span>
                  ) : belowMinimum ? (
                    `Minimum ${minOrder} TL (${cartTotal.toFixed(0)} TL)`
                  ) : (
                    `Siparisi Onayla • ${(cartTotal + deliveryFee).toFixed(0)} TL`
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customize Modal */}
      <ItemCustomizeModal
        item={customizeItem}
        options={options}
        onClose={() => setCustomizeItem(null)}
        onAdd={handleCustomizedAdd}
      />

      <style jsx>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
