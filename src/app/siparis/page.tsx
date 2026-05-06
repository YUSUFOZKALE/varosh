"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { type MenuItemOption } from "@/components/item-customize-modal";
import { usePublicSettings } from "@/hooks/use-public-settings";

const OrderMap = dynamic(() => import("@/components/order-map"), { ssr: false });

interface Category { id: number; name: string; sortOrder: number }
interface MenuItemRaw { id: number; name: string; description: string | null; price: number; deliveryPrice: number | null; categoryId: number; imageUrl: string | null }
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

interface CustomerData {
  id: number;
  name: string;
  phone: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface SavedAddress {
  id: number;
  label: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
}

interface ShopSettings {
  shopLatitude: number;
  shopLongitude: number;
  deliveryFee: number;
  minOrderAmount: number;
  estimatedDeliveryMinutes: number;
  businessPhone: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  "Doner": "\u{1F959}",
  "Tost & Sandvic": "\u{1F96A}",
  "Atistirmalik": "\u{1F35F}",
  "Icecekler": "\u{1F964}",
};

const CATEGORY_COLORS: Record<string, string> = {
  "Doner": "from-amber-900/60 to-amber-800/30",
  "Tost & Sandvic": "from-orange-900/60 to-orange-800/30",
  "Atistirmalik": "from-red-900/60 to-red-800/30",
  "Icecekler": "from-sky-900/60 to-sky-800/30",
};

type CardLayout = "wide" | "portrait" | "square" | "standard";

function getCategoryLayout(catName: string): CardLayout {
  if (catName === "Doner") return "wide";
  if (catName === "Icecekler") return "portrait";
  if (catName === "Atistirmalik") return "square";
  return "standard";
}

type Step = "phone" | "register" | "address" | "menu" | "done";

function SiparisContent() {
  const searchParams = useSearchParams();
  const ps = usePublicSettings();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const autoChecked = useRef(false);
  const [name, setName] = useState("");
  const [addressText, setAddressText] = useState("");
  const [pickedLat, setPickedLat] = useState<number | null>(null);
  const [pickedLng, setPickedLng] = useState<number | null>(null);
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<{ address: string; lat: number | null; lng: number | null } | null>(null);
  const [addingNewAddress, setAddingNewAddress] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [options, setOptions] = useState<MenuItemOption[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [shop, setShop] = useState<ShopSettings | null>(null);
  const [notes, setNotes] = useState("");
  const [showCart, setShowCart] = useState(false);
  const [customizeItem, setCustomizeItem] = useState<MenuItem | null>(null);
  const [custRemoved, setCustRemoved] = useState<Set<string>>(new Set());
  const [custExtras, setCustExtras] = useState<Set<number>>(new Set());
  const [custQty, setCustQty] = useState(1);
  const [custNotes, setCustNotes] = useState("");
  const [isScrolling, setIsScrolling] = useState(false);
  const sectionRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [trackToken, setTrackToken] = useState<string | null>(null);

  const loadMenu = useCallback(async () => {
    const [menuRes, settingsRes] = await Promise.all([
      fetch("/api/table-menu"),
      fetch("/api/settings/public"),
    ]);
    const menu = await menuRes.json();
    const s = await settingsRes.json();
    setCategories(menu.categories);
    setItems(menu.items.map((i: MenuItemRaw) => ({
      ...i,
      price: i.deliveryPrice ?? i.price,
    })));
    setOptions(menu.options);
    setShop({ ...s, businessPhone: s.businessPhone || "" });
    if (menu.categories.length > 0) setActiveCategory(menu.categories[0].id);
  }, []);

  useEffect(() => { loadMenu(); }, [loadMenu]);

  const pathname = usePathname();

  useEffect(() => {
    if (autoChecked.current) return;

    let p = searchParams.get("p");
    let adParam = searchParams.get("ad");

    if (!p) {
      const segments = pathname.replace(/^\/siparis\/?/, "").split("/").filter(Boolean);
      if (segments.length > 0 && /^\d{10,13}$/.test(segments[0])) {
        p = segments[0];
        if (segments[1]) adParam = decodeURIComponent(segments[1]);
      }
    }

    if (!p) return;
    autoChecked.current = true;

    let normalized = p.replace(/\D/g, "");
    if (normalized.startsWith("90") && normalized.length >= 12) {
      normalized = "0" + normalized.slice(2);
    }
    setPhone(normalized);

    if (adParam) setName(adParam);

    (async () => {
      setLoading(true);
      const res = await fetch("/api/siparis/customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalized }),
      });
      const data = await res.json();
      setLoading(false);
      if (data.exists) {
        setCustomer(data.customer);
        setName(data.customer.name || "");
        setSavedAddresses(data.addresses || []);
        if (searchParams.get("yeni") === "1") setAddingNewAddress(true);
        setStep("address");
      } else {
        setStep("register");
      }
    })();
  }, [searchParams, pathname]);

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
    if (step !== "menu") return;
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
  }, [categories, isScrolling, step]);

  // ── Customer flow ──
  async function checkPhone() {
    if (!phone.trim()) return;
    setLoading(true);
    const res = await fetch("/api/siparis/customer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phone.trim() }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.exists) {
      setCustomer(data.customer);
      setName(data.customer.name || "");
      setSavedAddresses(data.addresses || []);
      setStep("address");
    } else {
      setStep("register");
    }
  }

  async function saveCustomer() {
    if (!name.trim() || !addressText.trim() || !pickedLat || !pickedLng) return;
    setLoading(true);
    const res = await fetch("/api/siparis/customer", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: phone.trim(),
        name: name.trim(),
        address: addressText.trim(),
        latitude: pickedLat,
        longitude: pickedLng,
      }),
    });
    const data = await res.json();
    setLoading(false);
    setCustomer(data.customer);
    setSavedAddresses(data.addresses || []);
    setSelectedAddress({ address: addressText.trim(), lat: pickedLat, lng: pickedLng });
    setStep("menu");
  }

  function confirmAddress(addr: string, lat: number | null, lng: number | null) {
    setSelectedAddress({ address: addr, lat, lng });
    setStep("menu");
  }

  async function addNewAddress() {
    if (!addressText.trim() || !pickedLat || !pickedLng) return;
    setLoading(true);
    const res = await fetch("/api/siparis/customer", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: phone.trim(),
        name: name || customer?.name || "",
        address: addressText.trim(),
        latitude: pickedLat,
        longitude: pickedLng,
      }),
    });
    const data = await res.json();
    setLoading(false);
    setCustomer(data.customer);
    setSavedAddresses(data.addresses || []);
    setSelectedAddress({ address: addressText.trim(), lat: pickedLat, lng: pickedLng });
    setAddingNewAddress(false);
    setAddressText("");
    setPickedLat(null);
    setPickedLng(null);
    setStep("menu");
  }

  // ── Cart logic (table-style) ──
  function handleItemClick(item: MenuItem) {
    const itemOpts = options.filter((o) => o.menuItemId === item.id);
    if (itemOpts.length > 0) {
      if (customizeItem?.id === item.id) { setCustomizeItem(null); return; }
      setCustomizeItem(item);
      setCustRemoved(new Set());
      setCustExtras(new Set());
      setCustQty(1);
      setCustNotes("");
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
      return [...prev, { key, menuItemId: customizeItem.id, name: customizeItem.name, price: finalPrice, quantity: custQty, imageUrl: customizeItem.imageUrl, removedIngredients: removedArr, selectedExtras: extrasArr }];
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
  const deliveryFee = shop?.deliveryFee || 0;
  const grandTotal = cartTotal + deliveryFee;

  async function placeOrder() {
    if (cart.length === 0 || !selectedAddress) return;
    setSubmitting(true);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "whatsapp",
        customerName: customer?.name || name,
        customerPhone: phone.trim(),
        deliveryAddress: selectedAddress.address,
        deliveryLatitude: selectedAddress.lat,
        deliveryLongitude: selectedAddress.lng,
        items: cart.map((c) => ({
          menuItemId: c.menuItemId,
          quantity: c.quantity,
          selectedOptions: c.selectedExtras.length > 0 ? c.selectedExtras : undefined,
          removedIngredients: c.removedIngredients.length > 0 ? c.removedIngredients : undefined,
        })),
        notes: notes.trim() || undefined,
      }),
    });
    const order = await res.json();
    setSubmitting(false);
    setOrderId(order.id);
    setTrackToken(order.trackingToken);
    setCart([]);
    setShowCart(false);
    setStep("done");
  }

  // ── Phone step ──
  if (step === "phone") {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
        <div className="max-w-sm w-full space-y-6">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-6">
              {ps.logoUrl ? <img src={ps.logoUrl} alt={ps.businessName} className="h-10 drop-shadow-lg object-contain" /> : <span className="text-xl font-bold text-amber-400">{ps.businessName}</span>}
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Hosgeldiniz!</h1>
            <p className="text-white/50 text-sm">Siparis icin telefon numaranizi girin</p>
          </div>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="05xx xxx xx xx"
            className="w-full bg-neutral-900 rounded-2xl px-5 py-4 text-lg border border-neutral-800 text-center tracking-wider text-white placeholder:text-white/25 focus:outline-none focus:border-amber-500/50"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && checkPhone()}
          />
          <button onClick={checkPhone} disabled={!phone.trim() || loading} className="w-full py-4 rounded-2xl bg-amber-500 text-black font-bold text-lg disabled:opacity-40 active:scale-[0.97] transition-transform">
            {loading ? "Kontrol ediliyor..." : "Devam Et"}
          </button>
        </div>
      </div>
    );
  }

  // ── Register step ──
  if (step === "register") {
    return (
      <div className="min-h-screen bg-neutral-950 p-4">
        <div className="max-w-lg mx-auto space-y-5 pt-4">
          <div className="text-center py-3">
            <div className="flex items-center justify-center gap-2 mb-3">
              {ps.logoUrl ? <img src={ps.logoUrl} alt={ps.businessName} className="h-8 drop-shadow-lg object-contain" /> : <span className="text-lg font-bold text-amber-400">{ps.businessName}</span>}
            </div>
            <h2 className="text-xl font-bold text-white mb-1">Hosgeldiniz!</h2>
            <p className="text-white/40 text-sm">Bilgilerinizi kontrol edin</p>
          </div>
          <div>
            <label className="text-xs text-white/40 mb-1 block">Telefon</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05xx xxx xx xx" className="w-full bg-neutral-900 rounded-2xl px-5 py-4 border border-neutral-800 text-white placeholder:text-white/25 focus:outline-none focus:border-amber-500/50" />
          </div>
          <div>
            <label className="text-xs text-white/40 mb-1 block">Adiniz</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ad Soyad" className="w-full bg-neutral-900 rounded-2xl px-5 py-4 border border-neutral-800 text-white placeholder:text-white/25 focus:outline-none focus:border-amber-500/50" autoFocus={!name} />
          </div>
          <div>
            <label className="text-xs text-white/40 mb-2 block">Konum</label>
            <OrderMap onPick={(lat, lng) => { setPickedLat(lat); setPickedLng(lng); }} onAddress={(addr) => setAddressText(addr)} pickedLat={pickedLat} pickedLng={pickedLng} autoLocate />
            {pickedLat && <p className="text-xs text-green-400 mt-2 text-center">Konum secildi</p>}
          </div>
          <div>
            <label className="text-xs text-white/40 mb-1 block">Adres tarifi</label>
            <input type="text" value={addressText} onChange={(e) => setAddressText(e.target.value)} placeholder="Otomatik dolar veya kendiniz yazin..." className="w-full bg-neutral-900 rounded-2xl px-5 py-3 text-sm border border-neutral-800 text-white placeholder:text-white/25 focus:outline-none focus:border-amber-500/50" />
          </div>
          <button onClick={saveCustomer} disabled={!name.trim() || !phone.trim() || !addressText.trim() || !pickedLat || loading} className="w-full py-4 rounded-2xl bg-amber-500 text-black font-bold text-lg disabled:opacity-40 active:scale-[0.97] transition-transform">
            {loading ? "Kaydediliyor..." : "Menuye Gec"}
          </button>
        </div>
      </div>
    );
  }

  // ── Address step ──
  if (step === "address") {
    return (
      <div className="min-h-screen bg-neutral-950 p-4">
        <div className="max-w-lg mx-auto space-y-5 pt-4">
          <div className="text-center py-3">
            <h2 className="text-xl font-bold text-white mb-1">Hos geldin, {customer?.name}!</h2>
            <p className="text-white/40 text-sm">Nereye gonderelim?</p>
          </div>

          {customer?.address && (
            <button onClick={() => confirmAddress(customer.address!, customer.latitude, customer.longitude)} className="w-full bg-neutral-900 rounded-2xl p-5 text-left border-2 border-neutral-800 hover:border-amber-500 transition-colors">
              <div className="flex items-start gap-3">
                <span className="bg-amber-500 text-black rounded-lg w-10 h-10 flex items-center justify-center font-bold shrink-0">1</span>
                <div className="min-w-0">
                  <p className="font-semibold text-white mb-0.5">Ana Adres</p>
                  <p className="text-sm text-white/60">{customer.address}</p>
                  {customer.latitude && <p className="text-xs text-green-400/60 mt-1">Konum kayitli</p>}
                </div>
              </div>
            </button>
          )}

          {savedAddresses.filter((a) => a.address !== customer?.address).map((addr, i) => (
            <button key={addr.id} onClick={() => confirmAddress(addr.address, addr.latitude, addr.longitude)} className="w-full bg-neutral-900 rounded-2xl p-5 text-left border-2 border-neutral-800 hover:border-purple-500 transition-colors">
              <div className="flex items-start gap-3">
                <span className="bg-purple-600/30 text-purple-400 rounded-lg w-10 h-10 flex items-center justify-center font-bold shrink-0">{i + 2}</span>
                <div className="min-w-0">
                  <p className="font-semibold text-white mb-0.5">{addr.label}</p>
                  <p className="text-sm text-white/60">{addr.address}</p>
                  {addr.latitude && <p className="text-xs text-green-400/60 mt-1">Konum kayitli</p>}
                </div>
              </div>
            </button>
          ))}

          {!addingNewAddress ? (
            <div className="space-y-2">
              <button onClick={() => setAddingNewAddress(true)} className="w-full bg-neutral-800/50 rounded-2xl p-4 text-center text-white/50 border-2 border-dashed border-neutral-700 hover:border-amber-500/40 transition-colors">
                + Yeni adres ekle
              </button>
            </div>
          ) : (
            <div className="bg-neutral-900 rounded-2xl p-5 border-2 border-amber-500/30 space-y-4">
              <p className="font-semibold text-sm text-white">Yeni Adres</p>
              <OrderMap onPick={(lat, lng) => { setPickedLat(lat); setPickedLng(lng); }} onAddress={(addr) => setAddressText(addr)} pickedLat={pickedLat} pickedLng={pickedLng} />
              {pickedLat && <p className="text-xs text-green-400 text-center">Konum secildi</p>}
              <input type="text" value={addressText} onChange={(e) => setAddressText(e.target.value)} placeholder="Kisa adres tarifi..." className="w-full bg-neutral-800 rounded-xl px-4 py-3 text-sm border border-neutral-700 text-white placeholder:text-white/25 focus:outline-none focus:border-amber-500/50" />
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => { setAddingNewAddress(false); setAddressText(""); setPickedLat(null); setPickedLng(null); }} className="py-3 rounded-xl bg-neutral-800 text-white/50 text-sm font-semibold">Iptal</button>
                <button onClick={addNewAddress} disabled={!addressText.trim() || !pickedLat || loading} className="py-3 rounded-xl bg-amber-500 text-black text-sm font-bold disabled:opacity-40">{loading ? "..." : "Kaydet"}</button>
              </div>
            </div>
          )}

          <button onClick={() => { setStep("phone"); setCustomer(null); }} className="w-full py-2 text-white/30 text-sm">Farkli numara</button>
        </div>
      </div>
    );
  }

  // ── Done step ──
  if (step === "done") {
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
              <span className="font-bold text-white text-lg">#{orderId}</span>
            </div>
            <div className="h-px bg-neutral-800" />
            <div className="flex justify-between items-center">
              <span className="text-white/50 text-sm">Musteri</span>
              <span className="font-bold text-white">{customer?.name || name}</span>
            </div>
            <div className="h-px bg-neutral-800" />
            <div className="flex justify-between items-center">
              <span className="text-white/50 text-sm">Adres</span>
              <span className="text-white/70 text-sm text-right max-w-[65%]">{selectedAddress?.address}</span>
            </div>
            <div className="h-px bg-neutral-800" />
            <div className="flex justify-between items-center">
              <span className="text-white/50 text-sm">Toplam</span>
              <span className="font-bold text-amber-400 text-lg">{grandTotal.toFixed(0)} TL</span>
            </div>
            {shop?.estimatedDeliveryMinutes ? (
              <>
                <div className="h-px bg-neutral-800" />
                <div className="flex justify-between items-center">
                  <span className="text-white/50 text-sm">Tahmini</span>
                  <span className="text-white">~{shop.estimatedDeliveryMinutes} dk</span>
                </div>
              </>
            ) : null}
          </div>
          <div className="bg-neutral-900 rounded-2xl p-4">
            <p className="text-white/50 text-sm">Siparisiniiz hazirlaniyor. Kapida nakit veya kartla odeme yapabilirsiniz.</p>
          </div>

          {shop?.businessPhone && (
            <a
              href={`https://wa.me/${shop.businessPhone.replace(/\D/g, "").replace(/^0/, "90")}?text=${encodeURIComponent(`Merhaba, #${orderId} numarali siparisim hakkinda bilgi almak istiyorum.`)}`}
              target="_blank"
              className="w-full py-4 rounded-2xl bg-green-600 text-white font-bold text-base flex items-center justify-center gap-3 active:scale-[0.97] transition-transform"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp ile Iletisime Gec
            </a>
          )}

          {trackToken && (
            <a href={`/track/${trackToken}`} className="block w-full py-3 rounded-2xl bg-neutral-900 text-white/60 font-semibold text-sm text-center border border-neutral-800">
              Siparisi Takip Et
            </a>
          )}

          <button
            onClick={() => { setCart([]); setStep("menu"); setOrderId(null); setTrackToken(null); setNotes(""); }}
            className="w-full py-4 rounded-2xl bg-amber-500 text-black font-bold text-base active:scale-[0.98] transition-transform"
          >
            Yeni Siparis Ver
          </button>
          <p className="text-white/20 text-xs pt-2">{ps.businessName} &middot; Afiyet olsun!</p>
        </div>
      </div>
    );
  }

  // ── Menu step (table-style rich UI) ──
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
            <div className="bg-black/20 backdrop-blur-sm rounded-2xl px-4 py-2.5 text-center">
              <p className="text-amber-100/60 text-[10px] uppercase tracking-wider">Teslimat</p>
              <p className="text-white text-xs font-semibold leading-tight mt-0.5 max-w-[140px] truncate">{selectedAddress?.address}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button onClick={() => setStep("address")} className="text-amber-100/70 text-xs underline underline-offset-2">Adres degistir</button>
            {shop?.estimatedDeliveryMinutes && (
              <span className="text-amber-100/50 text-xs">• ~{shop.estimatedDeliveryMinutes} dk</span>
            )}
            {deliveryFee > 0 && (
              <span className="text-amber-100/50 text-xs">• Teslimat {deliveryFee} TL</span>
            )}
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="sticky top-0 z-20 bg-neutral-950/95 backdrop-blur-lg border-b border-neutral-800/80 shadow-lg shadow-black/20">
        <div className="flex overflow-x-auto px-4 py-3 gap-2 no-scrollbar">
          {categories.map((cat) => {
            const isActive = activeCategory === cat.id;
            const icon = CATEGORY_ICONS[cat.name] || "\u{1F37D}\u{FE0F}";
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
          const icon = CATEGORY_ICONS[cat.name] || "\u{1F37D}\u{FE0F}";
          const layout = getCategoryLayout(cat.name);
          return (
            <div key={cat.id} ref={(el) => { sectionRefs.current[cat.id] = el; }} className="mb-6">
              <div className="flex items-center gap-2 mb-3 pt-2">
                <span className="text-xl">{icon}</span>
                <h2 className="text-lg font-bold text-white">{cat.name}</h2>
                <span className="text-xs text-white/30 ml-1">({catItems.length})</span>
              </div>
              <div className={`${layout === "portrait" ? "grid grid-cols-2 gap-3" : layout === "square" ? "grid grid-cols-2 gap-3" : "space-y-3"}`}>
                {catItems.map((item) => {
                  const qty = getItemQty(item.id);
                  const hasOpts = options.some((o) => o.menuItemId === item.id);
                  const catColor = CATEGORY_COLORS[cat.name] || "from-neutral-800/60 to-neutral-700/30";
                  const isExpanded = customizeItem?.id === item.id;
                  const itemOpts = isExpanded ? options.filter((o) => o.menuItemId === item.id) : [];
                  const ingredients = itemOpts.filter((o) => o.groupName === "Icindekiler");
                  const extraOpts = itemOpts.filter((o) => o.groupName === "Ekstralar");
                  const extrasCost = isExpanded ? extraOpts.filter((o) => custExtras.has(o.id)).reduce((s, o) => s + o.priceModifier, 0) : 0;
                  const unitPrice = item.price + extrasCost;
                  const totalPrice = unitPrice * custQty;

                  const qtyControl = qty > 0 && !hasOpts ? (
                    <div className="flex items-center gap-0 bg-neutral-800 rounded-full">
                      <button onClick={(e) => { e.stopPropagation(); updateQty(`${item.id}_simple`, -1); }} className="w-9 h-9 rounded-full flex items-center justify-center text-white/80 active:bg-neutral-700">
                        {qty === 1 ? (
                          <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" /></svg>
                        )}
                      </button>
                      <span className="text-white font-bold text-sm min-w-[28px] text-center">{qty}</span>
                      <button onClick={(e) => { e.stopPropagation(); handleItemClick(item); }} className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center text-black active:bg-amber-400">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleItemClick(item); }}
                      className="bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-bold text-sm px-5 py-2 rounded-full transition-all shadow-lg shadow-amber-500/20"
                    >
                      Ekle
                    </button>
                  );

                  const placeholder = (aspect: string) => (
                    <div className={`w-full ${aspect} bg-gradient-to-br ${catColor} flex items-center justify-center`}>
                      <span className="text-4xl opacity-40">{CATEGORY_ICONS[cat.name] || "\u{1F37D}\u{FE0F}"}</span>
                    </div>
                  );

                  const badge = qty > 0 ? (
                    <div className="absolute top-2 right-2 w-7 h-7 bg-amber-500 rounded-full flex items-center justify-center text-black text-xs font-extrabold shadow-lg shadow-amber-500/30 ring-2 ring-amber-400/30 z-10">
                      {qty}
                    </div>
                  ) : null;

                  const popupOverlay = isExpanded ? (
                    <div className="absolute inset-x-0 top-0 z-40 bg-neutral-900 border-2 border-amber-500/60 rounded-2xl overflow-hidden shadow-2xl shadow-black/40">
                      <div className="px-4 py-3 border-b border-neutral-800/60">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-white text-lg leading-tight">{item.name}</h3>
                          <button onClick={() => setCustomizeItem(null)} className="w-8 h-8 bg-neutral-800 rounded-lg flex items-center justify-center text-white/40 shrink-0">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                        <span className="text-amber-400 font-extrabold text-xl">{item.price} TL</span>
                      </div>
                      <div className="px-4 py-3 space-y-3 max-h-[50vh] overflow-y-auto">
                        {ingredients.length > 0 && (
                          <div>
                            <p className="text-[11px] font-bold text-white/40 mb-1.5 uppercase">Icindekiler</p>
                            <div className="flex flex-wrap gap-1.5">
                              {ingredients.map((ing) => {
                                const isRemoved = custRemoved.has(ing.optionName);
                                return (
                                  <button key={ing.id} onClick={() => setCustRemoved((prev) => { const n = new Set(prev); if (n.has(ing.optionName)) n.delete(ing.optionName); else n.add(ing.optionName); return n; })} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${isRemoved ? "bg-red-500/15 text-red-400/60 line-through border border-red-500/20" : "bg-neutral-800/80 text-white/70 border border-neutral-700/50"}`}>
                                    {isRemoved && <span className="mr-0.5">✕</span>}{ing.optionName}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {extraOpts.length > 0 && (
                          <div>
                            <p className="text-[11px] font-bold text-white/40 mb-1.5 uppercase">Ekstralar</p>
                            <div className="flex flex-wrap gap-1.5">
                              {extraOpts.map((ext) => {
                                const isSel = custExtras.has(ext.id);
                                return (
                                  <button key={ext.id} onClick={() => setCustExtras((prev) => { const n = new Set(prev); if (n.has(ext.id)) n.delete(ext.id); else n.add(ext.id); return n; })} className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 ${isSel ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "bg-neutral-800/80 text-white/70 border border-neutral-700/50"}`}>
                                    {ext.optionName} <span className={isSel ? "text-amber-400" : "text-white/30"}>+{ext.priceModifier}</span>
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
                          <button onClick={addCustomizedToCart} className="flex-1 py-2.5 rounded-xl bg-amber-500 text-black font-bold text-sm active:scale-[0.97]">
                            Ekle {custQty}x {totalPrice.toFixed(0)} TL
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null;

                  if (layout === "wide") {
                    return (
                      <div key={item.id} className="relative">
                        <div className={`bg-neutral-900 rounded-2xl overflow-hidden border transition-all ${qty > 0 ? "border-amber-500/40 shadow-lg shadow-amber-500/5" : "border-neutral-800/60"}`}>
                          <div className="relative">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.name} className="w-full aspect-[16/9] object-cover" />
                            ) : placeholder("aspect-[16/9]")}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-neutral-900 via-neutral-900/80 to-transparent pt-12 pb-4 px-4">
                              <h3 className="font-bold text-white text-lg leading-tight">{item.name}</h3>
                              {item.description && <p className="text-white/50 text-xs mt-1">{item.description}</p>}
                            </div>
                            {badge}
                          </div>
                          <div className="px-4 pb-4 flex items-center justify-between">
                            <span className="text-amber-400 font-extrabold text-xl">{item.price.toFixed(0)} <span className="text-sm font-bold">TL</span></span>
                            {qtyControl}
                          </div>
                        </div>
                        {popupOverlay}
                      </div>
                    );
                  }

                  if (layout === "portrait") {
                    return (
                      <div key={item.id} className="relative">
                        <div className={`bg-neutral-900 rounded-2xl overflow-hidden border transition-all ${qty > 0 ? "border-amber-500/40 shadow-lg shadow-amber-500/5" : "border-neutral-800/60"}`}>
                          <div className="relative">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.name} className="w-full aspect-[2/3] object-cover" />
                            ) : placeholder("aspect-[2/3]")}
                            {badge}
                          </div>
                          <div className="p-3">
                            <h3 className="font-bold text-white text-sm leading-tight mb-2">{item.name}</h3>
                            <div className="flex items-center justify-between">
                              <span className="text-amber-400 font-extrabold text-base">{item.price.toFixed(0)} TL</span>
                              {qty > 0 && !hasOpts ? (
                                <div className="flex items-center gap-0 bg-neutral-800 rounded-full scale-90">
                                  <button onClick={(e) => { e.stopPropagation(); updateQty(`${item.id}_simple`, -1); }} className="w-8 h-8 rounded-full flex items-center justify-center text-white/80 active:bg-neutral-700">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" /></svg>
                                  </button>
                                  <span className="text-white font-bold text-xs min-w-[20px] text-center">{qty}</span>
                                  <button onClick={(e) => { e.stopPropagation(); handleItemClick(item); }} className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-black active:bg-amber-400">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                                  </button>
                                </div>
                              ) : (
                                <button onClick={(e) => { e.stopPropagation(); handleItemClick(item); }} className="bg-amber-500 active:scale-95 text-black font-bold text-xs px-3 py-1.5 rounded-full">
                                  Ekle
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        {popupOverlay}
                      </div>
                    );
                  }

                  if (layout === "square") {
                    return (
                      <div key={item.id} className="relative">
                        <div className={`bg-neutral-900 rounded-2xl overflow-hidden border transition-all ${qty > 0 ? "border-amber-500/40 shadow-lg shadow-amber-500/5" : "border-neutral-800/60"}`}>
                          <div className="relative">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.name} className="w-full aspect-square object-cover" />
                            ) : placeholder("aspect-square")}
                            {badge}
                          </div>
                          <div className="p-3">
                            <h3 className="font-bold text-white text-sm leading-tight mb-2">{item.name}</h3>
                            <div className="flex items-center justify-between">
                              <span className="text-amber-400 font-extrabold text-base">{item.price.toFixed(0)} TL</span>
                              {qty > 0 && !hasOpts ? (
                                <div className="flex items-center gap-0 bg-neutral-800 rounded-full scale-90">
                                  <button onClick={(e) => { e.stopPropagation(); updateQty(`${item.id}_simple`, -1); }} className="w-8 h-8 rounded-full flex items-center justify-center text-white/80 active:bg-neutral-700">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" /></svg>
                                  </button>
                                  <span className="text-white font-bold text-xs min-w-[20px] text-center">{qty}</span>
                                  <button onClick={(e) => { e.stopPropagation(); handleItemClick(item); }} className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-black active:bg-amber-400">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                                  </button>
                                </div>
                              ) : (
                                <button onClick={(e) => { e.stopPropagation(); handleItemClick(item); }} className="bg-amber-500 active:scale-95 text-black font-bold text-xs px-3 py-1.5 rounded-full">
                                  Ekle
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        {popupOverlay}
                      </div>
                    );
                  }

                  return (
                    <div key={item.id} className="relative">
                      <div className={`bg-neutral-900 rounded-2xl overflow-hidden border transition-all ${qty > 0 ? "border-amber-500/40 shadow-lg shadow-amber-500/5" : "border-neutral-800/60"}`}>
                        <div className="flex">
                          <div className="flex-1 p-4 flex flex-col justify-between min-h-[120px]">
                            <div>
                              <h3 className="font-bold text-white text-[15px] leading-tight mb-1">{item.name}</h3>
                              {item.description && <p className="text-white/40 text-xs leading-relaxed line-clamp-2">{item.description}</p>}
                            </div>
                            <div className="flex items-center justify-between mt-3">
                              <span className="text-amber-400 font-extrabold text-lg">{item.price.toFixed(0)} <span className="text-sm font-bold">TL</span></span>
                              {qtyControl}
                            </div>
                          </div>
                          <div className="w-[130px] shrink-0 relative overflow-hidden">
                            {item.imageUrl ? (
                              <>
                                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover min-h-[120px]" />
                                <div className="absolute inset-0 bg-gradient-to-r from-neutral-900 via-transparent to-transparent w-8" />
                              </>
                            ) : (
                              <div className={`w-full h-full bg-gradient-to-br ${catColor} flex items-center justify-center min-h-[120px]`}>
                                <span className="text-3xl opacity-40">{CATEGORY_ICONS[cat.name] || "\u{1F37D}\u{FE0F}"}</span>
                              </div>
                            )}
                            {badge}
                          </div>
                        </div>
                      </div>
                      {popupOverlay}
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
                  <h2 className="text-lg font-bold text-white">Sepetiniz</h2>
                  <p className="text-white/30 text-xs">{customer?.name || name} &middot; {cartCount} urun</p>
                </div>
              </div>
              <button onClick={() => setShowCart(false)} className="w-10 h-10 bg-neutral-800 rounded-full flex items-center justify-center text-white/40 hover:text-white">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Delivery address */}
              <div className="bg-neutral-800/30 rounded-xl p-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <span className="text-white/60 text-xs truncate">{selectedAddress?.address}</span>
              </div>

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
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Ara Toplam</span>
                  <span className="text-white">{cartTotal.toFixed(0)} TL</span>
                </div>
                {deliveryFee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-white/50">Teslimat</span>
                    <span className="text-white">{deliveryFee.toFixed(0)} TL</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg pt-1 border-t border-neutral-800/50">
                  <span className="text-white">Toplam</span>
                  <span className="text-amber-400">{grandTotal.toFixed(0)} TL</span>
                </div>
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
                  onClick={placeOrder}
                  disabled={submitting}
                  className="w-full py-4 rounded-2xl font-bold text-lg transition-all active:scale-[0.98] disabled:opacity-40 bg-green-500 text-white shadow-xl shadow-green-500/20"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Gonderiliyor...
                    </span>
                  ) : (
                    `Siparis Ver • ${grandTotal.toFixed(0)} TL`
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

export default function SiparisPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      </div>
    }>
      <SiparisContent />
    </Suspense>
  );
}
