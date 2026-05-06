"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { type MenuItemOption } from "@/components/item-customize-modal";
import { usePublicSettings } from "@/hooks/use-public-settings";
import { useToast } from "@/hooks/useToast";
import { ToastContainer } from "@/components/ToastContainer";

interface Category { id: number; name: string; }
interface MenuItem { id: number; categoryId: number; name: string; price: number; deliveryPrice: number | null; isAvailable: boolean; prepTimeMinutes: number; imageUrl: string | null; description: string | null; }
interface CartItem { key: string; menuItemId: number; name: string; price: number; quantity: number; imageUrl: string | null; removedIngredients: string[]; selectedExtras: number[]; notes: string; }
interface CompletedOrder { id: number; total: number; subtotal: number; deliveryFee: number; orderType: OrderType; items: CartItem[]; customerName: string; tableNumber: string; }

interface Customer { id: number; phone: string; name: string | null; address: string | null; orderCount: number; totalSpent: number }
type OrderType = "dine_in" | "takeaway" | "delivery";

const CATEGORY_ICONS: Record<string, string> = {
  "Döner": "🥙",
  "Tost & Sandviç": "🥪",
  "Atıştırmalık": "🍟",
  "İçecekler": "🥤",
};

export default function PosPage() {
  const ps = usePublicSettings();
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
  const [completedOrder, setCompletedOrder] = useState<CompletedOrder | null>(null);
  const [mobileTab, setMobileTab] = useState<"menu" | "cart" | "orders">("menu");

  interface OpenOrder { id: number; customerName: string | null; customerPhone: string | null; tableNumber: number | null; total: number; status: string; source: string; paymentMethod: string | null; paymentConfirmedAt: string | null; createdAt: string; deliveryAddress: string | null; }
  interface BillDetail { id: number; customerName: string | null; tableNumber: number | null; total: number; subtotal: number; deliveryFee: number; source: string; items: { name: string; quantity: number; unitPrice: number; totalPrice: number; extras: { id: number; name: string; price: number }[]; removed: string[]; notes: string | null }[]; }
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);
  const [allOrders, setAllOrders] = useState<OpenOrder[]>([]);
  const [showBills, setShowBills] = useState(false);
  const [billDetail, setBillDetail] = useState<BillDetail | null>(null);
  const [payingBill, setPayingBill] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [custSearch, setCustSearch] = useState("");
  const [showCustDropdown, setShowCustDropdown] = useState(false);
  const [deliveryFeeAmount, setDeliveryFeeAmount] = useState(0);
  const [options, setOptions] = useState<MenuItemOption[]>([]);
  const [customizeItem, setCustomizeItem] = useState<MenuItem | null>(null);
  const sectionRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [isScrolling, setIsScrolling] = useState(false);

  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const [cRes, iRes, custRes, setRes, optRes, ordRes] = await Promise.all([
        fetch("/api/menu/categories"),
        fetch("/api/menu/items"),
        fetch("/api/customers"),
        fetch("/api/settings"),
        fetch("/api/menu/options"),
        fetch("/api/orders?limit=100"),
      ]);
      const cats = await cRes.json();
      setCategories(cats);
      setItems(await iRes.json());
      setCustomers(await custRes.json());
      try {
        const settings: { key: string; value: string }[] = await setRes.json();
        const feeEnabled = settings.find((s) => s.key === "delivery_fee_enabled");
        if (feeEnabled?.value === "true") {
          const fee = settings.find((s) => s.key === "default_delivery_fee");
          if (fee) setDeliveryFeeAmount(parseFloat(fee.value));
        } else {
          setDeliveryFeeAmount(0);
        }
      } catch {}
      try { setOptions(await optRes.json()); } catch {}
      try {
        const ordersData: OpenOrder[] = await ordRes.json();
        setAllOrders(ordersData.filter((o) => o.status !== "cancelled"));
        setOpenOrders(ordersData.filter((o) => !o.paymentConfirmedAt && o.status !== "cancelled"));
      } catch {}
      if (cats.length > 0 && !selectedCat) setSelectedCat(cats[0].id);
    } catch {}
  }, [selectedCat]);

  function selectCustomer(c: Customer) {
    setCustomerName(c.name || "");
    setCustomerPhone(c.phone);
    setDeliveryAddress(c.address || "");
    setCustSearch("");
    setShowCustDropdown(false);
    if (c.address) setOrderType("delivery");
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

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]);

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

  function getEffectivePrice(item: MenuItem): number {
    if (orderType === "delivery") return item.deliveryPrice || item.price;
    return item.price;
  }

  useEffect(() => {
    if (cart.length === 0) return;
    setCart((prev) =>
      prev.map((c) => {
        const menuItem = items.find((i) => i.id === c.menuItemId);
        if (!menuItem) return c;
        const base = orderType === "delivery" ? (menuItem.deliveryPrice || menuItem.price) : menuItem.price;
        let extrasCost = 0;
        for (const optId of c.selectedExtras) {
          const opt = options.find((o) => o.id === optId);
          if (opt && opt.priceModifier > 0) extrasCost += opt.priceModifier;
        }
        return { ...c, price: base + extrasCost };
      })
    );
  }, [orderType]);

  const [custRemoved, setCustRemoved] = useState<Set<string>>(new Set());
  const [custExtras, setCustExtras] = useState<Set<number>>(new Set());
  const [custQty, setCustQty] = useState(1);
  const [custNotes, setCustNotes] = useState("");

  function handleItemClick(item: MenuItem) {
    if (customizeItem?.id === item.id) {
      setCustomizeItem(null);
      return;
    }
    const effectivePrice = getEffectivePrice(item);
    setCustomizeItem({ ...item, price: effectivePrice });
    setCustRemoved(new Set());
    setCustExtras(new Set());
    setCustQty(1);
    setCustNotes("");
  }

  function addCustomizedToCart() {
    if (!customizeItem) return;
    const itemOpts = options.filter((o) => o.menuItemId === customizeItem.id);
    const extrasCost = itemOpts
      .filter((o) => o.groupName === "Ekstralar" && custExtras.has(o.id))
      .reduce((sum, o) => sum + o.priceModifier, 0);
    const finalPrice = customizeItem.price + extrasCost;
    const removedArr = Array.from(custRemoved).sort();
    const extrasArr = Array.from(custExtras).sort();
    const key = `${customizeItem.id}_${removedArr.join(",")}_${extrasArr.join(",")}_${custNotes.trim()}`;
    setCart((prev) => {
      const existing = prev.find((c) => c.key === key);
      if (existing) {
        return prev.map((c) => c.key === key ? { ...c, quantity: c.quantity + custQty } : c);
      }
      return [...prev, {
        key, menuItemId: customizeItem.id, name: customizeItem.name, price: finalPrice, quantity: custQty, imageUrl: customizeItem.imageUrl,
        removedIngredients: removedArr, selectedExtras: extrasArr, notes: custNotes.trim(),
      }];
    });
    setCustomizeItem(null);
  }

  function switchToMenu() {
    if (window.innerWidth < 768) setMobileTab("menu");
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

    try {
      const source = (orderType === "delivery" || orderType === "takeaway") && customerPhone ? "phone" : "manual";

      const body: Record<string, unknown> = {
        source,
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

      if (!res.ok) {
        toast.error("Siparis gonderilemedi");
        setSending(false);
        return;
      }

      const order = await res.json();
      setCompletedOrder({
        id: order.id,
        total: order.total,
        subtotal,
        deliveryFee,
        orderType,
        items: [...cart],
        customerName,
        tableNumber,
      });
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setDeliveryAddress("");
      setTableNumber("");
      setNotes("");
      toast.success(`Siparis #${order.id} basariyla olusturuldu`);
      switchToMenu();
      setTimeout(() => setCompletedOrder(null), 3000);
    } catch {
      toast.error("Siparis gonderilirken bir hata olustu");
    }
    setSending(false);
  }

  function closeConfirmModal() {
    setCompletedOrder(null);
  }

  function printReceipt(orderId: number) {
    window.open(`/receipt/${orderId}`, "_blank");
  }

  async function openBillDetail(orderId: number) {
    const res = await fetch(`/api/orders/${orderId}`);
    if (res.ok) setBillDetail(await res.json());
  }

  async function collectPayment(orderId: number, method: "cash" | "card") {
    setPayingBill(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod: method }),
      });
      if (!res.ok) {
        toast.error("Odeme alinamadi");
        setPayingBill(false);
        return;
      }
      toast.success(`Siparis #${orderId} odendi`);
      setBillDetail(null);
      setShowBills(false);
      load();
    } catch {
      toast.error("Odeme islemi sirasinda bir hata olustu");
    }
    setPayingBill(false);
  }

  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  return (
    <div className="flex flex-col md:flex-row h-screen bg-neutral-950">
      <ToastContainer toasts={toast.toasts} />

      {/* Mobile Tab Bar */}
      <div className="md:hidden flex border-b border-neutral-800/60 shrink-0">
        <button onClick={() => setMobileTab("menu")} className={`flex-1 py-3 text-sm font-bold text-center transition-all ${mobileTab === "menu" ? "text-amber-400 border-b-2 border-amber-400" : "text-white/40"}`}>
          🍽️ Menü
        </button>
        <button onClick={() => setMobileTab("cart")} className={`flex-1 py-3 text-sm font-bold text-center transition-all relative ${mobileTab === "cart" ? "text-amber-400 border-b-2 border-amber-400" : "text-white/40"}`}>
          🛒 Sepet {cartCount > 0 && <span className="ml-1 bg-amber-500 text-black text-[10px] px-1.5 py-0.5 rounded-full">{cartCount}</span>}
        </button>
        <button onClick={() => setMobileTab("orders")} className={`flex-1 py-3 text-sm font-bold text-center transition-all relative ${mobileTab === "orders" ? "text-amber-400 border-b-2 border-amber-400" : "text-white/40"}`}>
          📋 Genel {allOrders.filter(o => o.status !== "delivered" && o.status !== "cancelled").length > 0 && <span className="ml-1 bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{allOrders.filter(o => o.status !== "delivered" && o.status !== "cancelled").length}</span>}
        </button>
      </div>

      {/* Left: Menu */}
      <div className={`flex-1 flex flex-col overflow-hidden ${mobileTab === "menu" ? "" : mobileTab === "orders" ? "hidden" : "hidden md:flex"}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-3">
            <a href="/" className="text-white/30 hover:text-white/60 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </a>
            <div>
              {ps.headerLogoUrl ? <img src={ps.headerLogoUrl} alt={ps.businessName} className="h-7 object-contain" /> : <span className="font-bold text-amber-400">{ps.businessName}</span>}
              <p className="text-white/20 text-[10px] tracking-wider">POS SISTEMI</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileTab(mobileTab === "orders" ? "menu" : "orders")}
              className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${mobileTab === "orders" ? "bg-blue-500 text-white" : "bg-blue-500/20 text-blue-400"}`}
            >
              📋 Genel
              {allOrders.filter(o => o.status !== "delivered" && o.status !== "cancelled").length > 0 && (
                <span className="bg-blue-400/30 text-white text-[10px] px-1.5 py-0.5 rounded-full">{allOrders.filter(o => o.status !== "delivered" && o.status !== "cancelled").length}</span>
              )}
            </button>
            {cartCount > 0 && (
              <button onClick={() => setMobileTab("cart")} className="md:pointer-events-none bg-amber-500/20 text-amber-400 px-3 py-1.5 rounded-full text-xs font-bold">
                {cartCount} ürün
              </button>
            )}
          </div>
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
                    const isExpanded = customizeItem?.id === item.id;
                    const itemOpts = isExpanded ? options.filter((o) => o.menuItemId === item.id) : [];
                    const ingredients = itemOpts.filter((o) => o.groupName === "Icindekiler");
                    const extraOpts = itemOpts.filter((o) => o.groupName === "Ekstralar");
                    const custExtrasCost = isExpanded ? extraOpts.filter((o) => custExtras.has(o.id)).reduce((s, o) => s + o.priceModifier, 0) : 0;
                    const custTotal = isExpanded ? (customizeItem!.price + custExtrasCost) * custQty : 0;

                    return (
                      <div key={item.id} className="relative">
                        <button
                          onClick={() => handleItemClick(item)}
                          className={`w-full relative bg-neutral-900 border rounded-2xl overflow-hidden text-left transition-all active:scale-[0.97] ${
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
                              <span className="text-amber-400 font-extrabold text-lg">{getEffectivePrice(item)}</span>
                              <span className="text-amber-400/60 text-xs font-semibold">TL</span>
                              {item.deliveryPrice && item.deliveryPrice !== item.price && (
                                <span className="text-white/20 text-[10px] ml-auto">
                                  {orderType === "dine_in" ? `Paket ${item.deliveryPrice}` : `Mekan ${item.price}`} TL
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="absolute inset-x-0 top-0 z-40 bg-neutral-900 border-2 border-amber-500/60 rounded-2xl overflow-hidden shadow-2xl shadow-black/40">
                            <div className="px-3 py-2 border-b border-neutral-800/60">
                              <div className="flex items-center justify-between">
                                <h3 className="font-bold text-white text-base leading-tight">{item.name}</h3>
                                <button onClick={() => setCustomizeItem(null)} className="w-7 h-7 bg-neutral-800 rounded-lg flex items-center justify-center text-white/40 hover:text-white shrink-0">
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              </div>
                              <span className="text-amber-400 font-extrabold text-lg">{getEffectivePrice(item)} TL</span>
                            </div>
                            <div className="px-3 py-2 space-y-2 max-h-[50vh] overflow-y-auto">
                              {ingredients.length > 0 && (
                                <div>
                                  <p className="text-[11px] font-bold text-white/40 mb-1 uppercase">Icindekiler</p>
                                  <div className="flex flex-wrap gap-1">
                                    {ingredients.map((ing) => {
                                      const isRem = custRemoved.has(ing.optionName);
                                      return (
                                        <button key={ing.id} onClick={() => setCustRemoved((prev) => { const n = new Set(prev); if (n.has(ing.optionName)) n.delete(ing.optionName); else n.add(ing.optionName); return n; })} className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${isRem ? "bg-red-500/15 text-red-400/60 line-through border border-red-500/20" : "bg-neutral-800 text-white/70 border border-neutral-700/50"}`}>
                                          {isRem && "✕ "}{ing.optionName}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                              {extraOpts.length > 0 && (
                                <div>
                                  <p className="text-[11px] font-bold text-white/40 mb-1 uppercase">Ekstralar</p>
                                  <div className="flex flex-wrap gap-1">
                                    {extraOpts.map((ext) => {
                                      const isSel = custExtras.has(ext.id);
                                      return (
                                        <button key={ext.id} onClick={() => setCustExtras((prev) => { const n = new Set(prev); if (n.has(ext.id)) n.delete(ext.id); else n.add(ext.id); return n; })} className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${isSel ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "bg-neutral-800 text-white/70 border border-neutral-700/50"}`}>
                                          {ext.optionName} <span className={isSel ? "text-amber-400" : "text-white/30"}>+{ext.priceModifier}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                              <textarea value={custNotes} onChange={(e) => setCustNotes(e.target.value)} placeholder="Not..." rows={2} className="w-full bg-neutral-800/60 text-white rounded-lg px-2.5 py-1.5 text-[11px] border border-neutral-700/50 focus:outline-none focus:border-amber-500/40 placeholder:text-white/20 resize-none overflow-y-auto" />
                              <div className="flex items-center gap-2 pt-1">
                                <div className="flex items-center bg-neutral-800 rounded-full shrink-0">
                                  <button onClick={() => setCustQty(Math.max(1, custQty - 1))} className="w-8 h-8 rounded-full flex items-center justify-center text-white/80 text-sm font-bold">−</button>
                                  <span className="text-white font-bold text-sm min-w-[20px] text-center">{custQty}</span>
                                  <button onClick={() => setCustQty(custQty + 1)} className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-black text-sm font-bold">+</button>
                                </div>
                                <button onClick={addCustomizedToCart} className="flex-1 py-2 rounded-xl bg-amber-500 text-black font-bold text-xs active:scale-[0.97]">
                                  Ekle {custQty}x {custTotal.toFixed(0)} TL
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
      </div>

      {/* Right: Cart Panel */}
      <div className={`w-full md:w-[340px] bg-neutral-900 md:border-l border-neutral-800/60 flex flex-col ${mobileTab === "cart" ? "" : mobileTab === "orders" ? "hidden" : "hidden md:flex"}`}>
        {/* Open Bills Button */}
        {openOrders.length > 0 && (
          <button
            onClick={() => setShowBills(true)}
            className="mx-3 mt-3 py-2.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-400 font-bold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            Acik Hesaplar ({openOrders.length})
          </button>
        )}

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
          {completedOrder && (
            <div className="bg-green-500/10 text-green-400 rounded-xl p-3 mb-2 text-center text-sm font-bold border border-green-500/20 flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
              Siparis #{completedOrder.id} — {completedOrder.total} TL
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


      {/* Orders Panel (Genel Sistem) */}
      <div className={`w-full md:w-[400px] bg-neutral-900 md:border-l border-neutral-800/60 flex flex-col ${mobileTab !== "orders" ? "hidden" : ""}`}>
        <div className="p-3 border-b border-neutral-800/60 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Genel Sistem</h2>
            <p className="text-white/30 text-[10px]">Tum siparisler • 10s yenileme</p>
          </div>
          <button onClick={() => load()} className="px-3 py-1.5 rounded-lg bg-neutral-800 text-white/40 text-xs font-medium active:scale-[0.97]">
            Yenile
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Status sections */}
          {(() => {
            const newO = allOrders.filter(o => o.status === "new");
            const prepO = allOrders.filter(o => o.status === "preparing");
            const readyO = allOrders.filter(o => o.status === "ready");
            const wayO = allOrders.filter(o => o.status === "on_the_way");
            const delivO = allOrders.filter(o => o.status === "delivered").slice(0, 10);
            const sections: { key: string; title: string; orders: OpenOrder[]; color: string; bgColor: string; borderColor: string }[] = [
              { key: "new", title: "Yeni", orders: newO, color: "text-blue-400", bgColor: "bg-blue-500/10", borderColor: "border-blue-500/30" },
              { key: "preparing", title: "Hazirlaniyor", orders: prepO, color: "text-orange-400", bgColor: "bg-orange-500/10", borderColor: "border-orange-500/30" },
              { key: "ready", title: "Hazir", orders: readyO, color: "text-green-400", bgColor: "bg-green-500/10", borderColor: "border-green-500/30" },
              { key: "on_the_way", title: "Yolda", orders: wayO, color: "text-purple-400", bgColor: "bg-purple-500/10", borderColor: "border-purple-500/30" },
              { key: "delivered", title: "Teslim Edildi", orders: delivO, color: "text-emerald-400", bgColor: "bg-emerald-500/10", borderColor: "border-emerald-500/30" },
            ];
            return sections.map(sec => (
              <div key={sec.key}>
                <div className={`${sec.bgColor} border ${sec.borderColor} rounded-xl px-3 py-2 mb-2 flex items-center justify-between`}>
                  <span className={`${sec.color} font-bold text-xs`}>{sec.title.toUpperCase()}</span>
                  <span className={`${sec.color} text-xs font-medium`}>{sec.orders.length}</span>
                </div>
                {sec.orders.length === 0 ? (
                  <p className="text-white/10 text-xs text-center py-2">—</p>
                ) : (
                  <div className="space-y-1.5">
                    {sec.orders.map(o => {
                      const mins = Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 60000);
                      const isPaid = !!o.paymentConfirmedAt;
                      return (
                        <div key={o.id} onClick={() => openBillDetail(o.id)} className="bg-neutral-800/40 rounded-xl p-2.5 cursor-pointer hover:bg-neutral-800/70 transition-all active:scale-[0.98]">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-white">#{o.id}</span>
                              {o.tableNumber && <span className="text-[10px] bg-amber-500/20 text-amber-400 font-bold px-1.5 py-0.5 rounded">M{o.tableNumber}</span>}
                              {o.deliveryAddress && <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">Paket</span>}
                              {!o.deliveryAddress && !o.tableNumber && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">Gel Al</span>}
                              {isPaid && (
                                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-1.5 py-0.5 rounded">
                                  {o.paymentMethod === "cash" ? "NAKIT" : "KART"}
                                </span>
                              )}
                            </div>
                            <span className="text-amber-400 font-bold text-sm">{o.total.toFixed(0)} TL</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-white/30 text-xs truncate">{o.customerName || "Isimsiz"}</span>
                            <span className={`text-xs ${mins > 15 ? "text-red-400 font-bold" : "text-white/20"}`}>{mins}dk</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ));
          })()}
          {allOrders.length === 0 && (
            <div className="text-center py-10 text-white/15 text-sm">Aktif siparis yok</div>
          )}
        </div>
      </div>

      {/* Order Success Toast */}
      {completedOrder && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div
            onClick={closeConfirmModal}
            className="bg-green-600 text-white rounded-2xl px-6 py-4 shadow-2xl shadow-green-600/30 flex items-center gap-3 cursor-pointer"
          >
            <svg className="w-6 h-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
            <div>
              <p className="font-bold">Siparis #{completedOrder.id} mutfaga gonderildi</p>
              <p className="text-green-100 text-sm">{completedOrder.total.toFixed(0)} TL — {
                completedOrder.orderType === "dine_in" ? (completedOrder.tableNumber ? `Masa ${completedOrder.tableNumber}` : "Mekan") :
                completedOrder.orderType === "delivery" ? "Paket" : "Gel Al"
              }</p>
            </div>
          </div>
        </div>
      )}

      {/* Open Bills Modal */}
      {showBills && !billDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setShowBills(false)}>
          <div className="bg-neutral-900 rounded-2xl w-full max-w-md mx-4 max-h-[85vh] flex flex-col border border-neutral-700/50 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-neutral-800/60 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Acik Hesaplar</h2>
              <button onClick={() => setShowBills(false)} className="text-white/30 hover:text-white">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {openOrders.length === 0 && (
                <p className="text-center text-white/20 py-10">Acik hesap yok</p>
              )}
              {(() => {
                const tableGroups: Record<number, OpenOrder[]> = {};
                const otherOrders: OpenOrder[] = [];
                for (const o of openOrders) {
                  if (o.tableNumber) {
                    if (!tableGroups[o.tableNumber]) tableGroups[o.tableNumber] = [];
                    tableGroups[o.tableNumber].push(o);
                  } else {
                    otherOrders.push(o);
                  }
                }
                return (
                  <>
                    {Object.entries(tableGroups).map(([tbl, orders]) => {
                      const groupTotal = orders.reduce((s, o) => s + o.total, 0);
                      return (
                        <div key={`t${tbl}`} className="bg-purple-500/5 border border-purple-500/20 rounded-xl overflow-hidden">
                          <div className="px-3.5 py-2.5 bg-purple-500/10 flex items-center justify-between">
                            <span className="font-bold text-purple-300 text-sm">🍽️ Masa {tbl} <span className="text-purple-400/50 font-normal">({orders.length} sipariş)</span></span>
                            <span className="text-amber-400 font-extrabold text-sm">{groupTotal.toFixed(0)} TL</span>
                          </div>
                          <div className="divide-y divide-neutral-800/40">
                            {orders.map((o) => {
                              const mins = Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 60000);
                              return (
                                <button key={o.id} onClick={() => openBillDetail(o.id)} className="w-full px-3.5 py-2.5 text-left hover:bg-neutral-800/40 transition-all active:scale-[0.98]">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-white text-sm">#{o.id}</span>
                                      <span className="text-white/40 text-xs">{o.customerName || "Isimsiz"}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-amber-400 font-bold text-sm">{o.total.toFixed(0)} TL</span>
                                      <span className="text-white/20 text-xs">{mins}dk</span>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    {otherOrders.map((o) => {
                      const mins = Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 60000);
                      return (
                        <button key={o.id} onClick={() => openBillDetail(o.id)} className="w-full bg-neutral-800/60 hover:bg-neutral-800 rounded-xl p-3.5 text-left transition-all active:scale-[0.98] border border-neutral-700/30">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-sm">#{o.id}</span>
                              {o.deliveryAddress ? (
                                <span className="text-xs bg-amber-600/20 text-amber-400 px-2 py-0.5 rounded">Paket</span>
                              ) : (
                                <span className="text-xs bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded">Gel Al</span>
                              )}
                            </div>
                            <span className="text-amber-400 font-extrabold">{o.total.toFixed(0)} TL</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-white/40 text-xs">{o.customerName || "Isimsiz"}{o.customerPhone ? ` • ${o.customerPhone}` : ""}</span>
                            <span className="text-white/20 text-xs">{mins}dk once</span>
                          </div>
                        </button>
                      );
                    })}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Bill Detail + Payment Modal */}
      {billDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 rounded-2xl w-full max-w-md mx-4 max-h-[90vh] flex flex-col border border-neutral-700/50 shadow-2xl">
            <div className="p-4 border-b border-neutral-800/60 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Hesap #{billDetail.id}</h2>
                <p className="text-white/40 text-xs mt-0.5">
                  {billDetail.tableNumber ? `Masa ${billDetail.tableNumber}` : billDetail.customerName || ""}
                </p>
              </div>
              <button onClick={() => setBillDetail(null)} className="text-white/30 hover:text-white">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-2">
                {billDetail.items.map((item, i) => (
                  <div key={i} className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white/50 text-sm font-bold">{item.quantity}x</span>
                        <span className="text-white text-sm font-medium truncate">{item.name}</span>
                      </div>
                      {item.removed.length > 0 && (
                        <p className="text-red-400/60 text-[11px] ml-7">- {item.removed.join(", ")}</p>
                      )}
                      {item.extras.length > 0 && (
                        <p className="text-amber-400/60 text-[11px] ml-7">+ {item.extras.map((e) => e.name).join(", ")}</p>
                      )}
                      {item.notes && (
                        <p className="text-blue-400/50 text-[11px] ml-7 italic">{item.notes}</p>
                      )}
                    </div>
                    <span className="text-white/70 text-sm font-semibold shrink-0">{item.totalPrice.toFixed(0)} TL</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-neutral-800/60 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">Ara Toplam</span>
                  <span className="text-white/60">{billDetail.subtotal.toFixed(0)} TL</span>
                </div>
                {billDetail.deliveryFee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-white/40">Teslimat</span>
                    <span className="text-white/60">{billDetail.deliveryFee.toFixed(0)} TL</span>
                  </div>
                )}
                <div className="flex justify-between text-2xl font-extrabold pt-2">
                  <span className="text-white">Toplam</span>
                  <span className="text-amber-400">{billDetail.total.toFixed(0)} TL</span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-neutral-800/60 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => collectPayment(billDetail.id, "cash")}
                  disabled={payingBill}
                  className="py-4 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold text-base transition-all active:scale-[0.97] disabled:opacity-40"
                >
                  Nakit
                </button>
                <button
                  onClick={() => collectPayment(billDetail.id, "card")}
                  disabled={payingBill}
                  className="py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-base transition-all active:scale-[0.97] disabled:opacity-40"
                >
                  Kart
                </button>
              </div>
              <button
                onClick={() => printReceipt(billDetail.id)}
                className="w-full py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white/60 font-medium text-sm transition-all active:scale-[0.97] flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                Fis Yazdir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
