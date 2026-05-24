"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/useToast";
import { ToastContainer } from "@/components/ToastContainer";

interface MenuItem {
  id: number;
  name: string;
  price: number;
  imageUrl: string | null;
  categoryId: number;
}

interface Category {
  id: number;
  name: string;
}

export default function MediaPage() {
  const toast = useToast();
  const [logoUrl, setLogoUrl] = useState("/images/branding/logo.png");
  const [headerLogoUrl, setHeaderLogoUrl] = useState("/images/branding/header-logo.png");
  const [pwaIconUrl, setPwaIconUrl] = useState("/icon-512.png");
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);

  const logoRef = useRef<HTMLInputElement>(null);
  const headerRef = useRef<HTMLInputElement>(null);
  const pwaRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    try {
      const [settingsRes, itemsRes, catsRes] = await Promise.all([
        fetch("/api/settings/public"),
        fetch("/api/menu/items"),
        fetch("/api/menu/categories"),
      ]);
      if (settingsRes.ok) {
        const s = await settingsRes.json();
        if (s.logoUrl) setLogoUrl(s.logoUrl);
        if (s.headerLogoUrl) setHeaderLogoUrl(s.headerLogoUrl);
      }
      if (itemsRes.ok) setItems(await itemsRes.json());
      if (catsRes.ok) setCategories(await catsRes.json());
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  async function uploadBranding(file: File, type: "logo" | "header-logo") {
    if (file.size > 5 * 1024 * 1024) { toast.error("Dosya 5MB dan buyuk"); return; }
    setUploading(type);
    try {
      const fd = new FormData();
      fd.append("image", file);
      fd.append("type", type);
      const res = await fetch("/api/branding/upload", { method: "POST", body: fd });
      if (!res.ok) { toast.error("Yukleme basarisiz"); return; }
      const data = await res.json();
      const t = `?t=${Date.now()}`;
      if (type === "logo") setLogoUrl(data.imageUrl + t);
      else setHeaderLogoUrl(data.imageUrl + t);
      toast.success("Logo guncellendi");
    } catch {
      toast.error("Baglanti hatasi");
    } finally {
      setUploading(null);
    }
  }

  async function uploadPwaIcon(file: File) {
    if (file.size > 5 * 1024 * 1024) { toast.error("Dosya 5MB dan buyuk"); return; }
    setUploading("pwa");
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/media/pwa-icon", { method: "POST", body: fd });
      if (!res.ok) { toast.error("Yukleme basarisiz"); return; }
      setPwaIconUrl(`/icon-512.png?t=${Date.now()}`);
      toast.success("Uygulama ikonu guncellendi");
    } catch {
      toast.error("Baglanti hatasi");
    } finally {
      setUploading(null);
    }
  }

  async function uploadItemImage(itemId: number, file: File) {
    if (file.size > 5 * 1024 * 1024) { toast.error("Dosya 5MB dan buyuk"); return; }
    setUploading(`item-${itemId}`);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch(`/api/menu/items/${itemId}/image`, { method: "POST", body: fd });
      if (!res.ok) { toast.error("Yukleme basarisiz"); return; }
      const data = await res.json();
      setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, imageUrl: data.imageUrl + `?t=${Date.now()}` } : i));
      toast.success("Gorsel guncellendi");
    } catch {
      toast.error("Baglanti hatasi");
    } finally {
      setUploading(null);
    }
  }

  async function deleteItemImage(itemId: number) {
    setUploading(`item-${itemId}`);
    try {
      const res = await fetch(`/api/menu/items/${itemId}/image`, { method: "DELETE" });
      if (!res.ok) { toast.error("Silme basarisiz"); return; }
      setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, imageUrl: null } : i));
      toast.success("Gorsel silindi");
    } catch {
      toast.error("Baglanti hatasi");
    } finally {
      setUploading(null);
    }
  }

  const grouped = categories.map((cat) => ({
    ...cat,
    items: items.filter((i) => i.categoryId === cat.id),
  })).filter((g) => g.items.length > 0);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Medya Yonetimi</h2>
        <p className="text-xs text-white/30 mt-0.5">Logo, ikon ve urun gorsellerini yonetin</p>
      </div>

      {/* MARKA & LOGO */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">Marka & Logo</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Logo */}
          <div className="card p-4">
            <p className="text-xs text-white/40 mb-3">Isletme Logosu <span className="text-white/20">(512x512)</span></p>
            <div
              className="aspect-square bg-surface-2 rounded-xl overflow-hidden flex items-center justify-center cursor-pointer border-2 border-dashed border-border hover:border-accent/50 transition-colors relative group"
              onClick={() => logoRef.current?.click()}
            >
              <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain p-4" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white/80 text-sm font-medium">Degistir</span>
              </div>
              {uploading === "logo" && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><span className="text-white/60 text-sm animate-pulse">Yukleniyor...</span></div>}
            </div>
            <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadBranding(f, "logo"); e.target.value = ""; }} />
          </div>

          {/* Header Logo */}
          <div className="card p-4">
            <p className="text-xs text-white/40 mb-3">Yatay Logo <span className="text-white/20">(800x200)</span></p>
            <div
              className="aspect-[4/1] bg-surface-2 rounded-xl overflow-hidden flex items-center justify-center cursor-pointer border-2 border-dashed border-border hover:border-accent/50 transition-colors relative group"
              onClick={() => headerRef.current?.click()}
            >
              <img src={headerLogoUrl} alt="Header" className="max-w-full max-h-full object-contain p-3" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white/80 text-sm font-medium">Degistir</span>
              </div>
              {uploading === "header-logo" && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><span className="text-white/60 text-sm animate-pulse">Yukleniyor...</span></div>}
            </div>
            <input ref={headerRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadBranding(f, "header-logo"); e.target.value = ""; }} />
            <p className="text-[10px] text-white/20 mt-2">Sidebar ve giris ekraninda kullanilir</p>
          </div>

          {/* PWA Icon */}
          <div className="card p-4">
            <p className="text-xs text-white/40 mb-3">Uygulama Ikonu <span className="text-white/20">(512x512)</span></p>
            <div
              className="aspect-square bg-surface-2 rounded-xl overflow-hidden flex items-center justify-center cursor-pointer border-2 border-dashed border-border hover:border-accent/50 transition-colors relative group"
              onClick={() => pwaRef.current?.click()}
            >
              <img src={pwaIconUrl} alt="PWA" className="max-w-full max-h-full object-contain p-4" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white/80 text-sm font-medium">Degistir</span>
              </div>
              {uploading === "pwa" && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><span className="text-white/60 text-sm animate-pulse">Yukleniyor...</span></div>}
            </div>
            <input ref={pwaRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPwaIcon(f); e.target.value = ""; }} />
            <p className="text-[10px] text-white/20 mt-2">Telefon ana ekranindaki ikon (192px ve 512px otomatik olusturulur)</p>
          </div>
        </div>
      </div>

      {/* URUN GORSELLERI */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Urun Gorselleri</h3>
        {grouped.map((cat) => (
          <div key={cat.id} className="mb-6">
            <p className="text-xs text-white/30 font-semibold mb-3 uppercase tracking-wider">{cat.name}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {cat.items.map((item) => (
                <div key={item.id} className="card p-0 overflow-hidden group relative">
                  <div
                    className="aspect-square bg-surface-2 flex items-center justify-center cursor-pointer relative"
                    onClick={() => itemRefs.current[item.id]?.click()}
                  >
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center text-white/15">
                        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        <span className="text-[10px] mt-1">Gorsel Yok</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <span className="text-white/90 text-xs font-medium bg-black/40 px-2 py-1 rounded-lg">Degistir</span>
                      {item.imageUrl && (
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteItemImage(item.id); }}
                          className="text-red-400 text-xs font-medium bg-black/40 px-2 py-1 rounded-lg hover:bg-red-600/40"
                        >Sil</button>
                      )}
                    </div>
                    {uploading === `item-${item.id}` && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <span className="text-white/60 text-xs animate-pulse">Yukleniyor...</span>
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium truncate">{item.name}</p>
                    <p className="text-[10px] text-white/30">{item.price.toFixed(0)} TL</p>
                  </div>
                  <input
                    ref={(el) => { itemRefs.current[item.id] = el; }}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadItemImage(item.id, f); e.target.value = ""; }}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-white/20 text-sm text-center py-8">Menu urunu yok</p>}
      </div>

      <ToastContainer toasts={toast.toasts} />
    </div>
  );
}
