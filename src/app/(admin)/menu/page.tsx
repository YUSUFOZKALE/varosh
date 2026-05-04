"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

interface Category {
  id: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

interface MenuItem {
  id: number;
  categoryId: number;
  name: string;
  price: number;
  deliveryPrice: number | null;
  description: string | null;
  imageUrl: string | null;
  isAvailable: boolean;
  prepTimeMinutes: number;
  sortOrder: number;
}

interface OptionItem {
  id?: number;
  menuItemId?: number;
  groupName: string;
  optionName: string;
  priceModifier: number;
  isDefault: boolean;
}

export default function MenuPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [catModal, setCatModal] = useState(false);
  const [itemModal, setItemModal] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [testLink, setTestLink] = useState<string | null>(null);
  const [creatingLink, setCreatingLink] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string; itemId: number } | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [sortDragId, setSortDragId] = useState<number | null>(null);
  const [sortDragOverId, setSortDragOverId] = useState<number | null>(null);
  const [sortMode, setSortMode] = useState(false);
  const [catDragId, setCatDragId] = useState<number | null>(null);
  const [catDragOverId, setCatDragOverId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileInputItemId, setFileInputItemId] = useState<number | null>(null);

  // For item modal image upload
  const [modalImage, setModalImage] = useState<File | null>(null);
  const [modalImagePreview, setModalImagePreview] = useState<string | null>(null);
  const [modalDragOver, setModalDragOver] = useState(false);
  const modalFileRef = useRef<HTMLInputElement>(null);

  // For item modal options (Icindekiler + Ekstralar)
  const [itemOptions, setItemOptions] = useState<OptionItem[]>([]);
  const [newIngredient, setNewIngredient] = useState("");
  const [newExtraName, setNewExtraName] = useState("");
  const [newExtraPrice, setNewExtraPrice] = useState("");

  const load = useCallback(async () => {
    const [cRes, iRes] = await Promise.all([
      fetch("/api/menu/categories"),
      fetch("/api/menu/items"),
    ]);
    setCategories(await cRes.json());
    setItems(await iRes.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredItems = selectedCat
    ? items.filter((i) => i.categoryId === selectedCat).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    : items.sort((a, b) => {
        const catA = categories.findIndex((c) => c.id === a.categoryId);
        const catB = categories.findIndex((c) => c.id === b.categoryId);
        if (catA !== catB) return catA - catB;
        return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      });

  async function saveSortOrder(reordered: MenuItem[]) {
    const payload = reordered.map((item, i) => ({ id: item.id, sortOrder: i + 1 }));
    await fetch("/api/menu/items", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: payload }),
    });
    setItems((prev) => {
      const updated = [...prev];
      for (const p of payload) {
        const idx = updated.findIndex((u) => u.id === p.id);
        if (idx >= 0) updated[idx] = { ...updated[idx], sortOrder: p.sortOrder };
      }
      return updated;
    });
  }

  function handleSortDrop(targetId: number) {
    if (sortDragId == null || sortDragId === targetId) { setSortDragId(null); setSortDragOverId(null); return; }
    const list = [...filteredItems];
    const fromIdx = list.findIndex((i) => i.id === sortDragId);
    const toIdx = list.findIndex((i) => i.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);
    saveSortOrder(list);
    setSortDragId(null);
    setSortDragOverId(null);
  }

  // Touch drag support
  const touchDragRef = useRef<{ id: number; startY: number; el: HTMLElement | null }>({ id: 0, startY: 0, el: null });

  function handleTouchStart(e: React.TouchEvent, itemId: number) {
    if (!sortMode) return;
    touchDragRef.current = { id: itemId, startY: e.touches[0].clientY, el: e.currentTarget as HTMLElement };
    setSortDragId(itemId);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!sortMode || !sortDragId) return;
    const touch = e.touches[0];
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-sort-id]"));
    for (const el of els) {
      const rect = el.getBoundingClientRect();
      if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
        const overId = parseInt(el.dataset.sortId || "0");
        if (overId !== sortDragOverId) setSortDragOverId(overId);
        break;
      }
    }
  }

  function handleTouchEnd() {
    if (sortDragOverId != null && sortDragId != null) {
      handleSortDrop(sortDragOverId);
    }
    setSortDragId(null);
    setSortDragOverId(null);
  }

  async function saveCatOrder(reordered: Category[]) {
    for (let i = 0; i < reordered.length; i++) {
      await fetch(`/api/menu/categories/${reordered[i].id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: i + 1 }),
      });
    }
    setCategories(reordered.map((c, i) => ({ ...c, sortOrder: i + 1 })));
  }

  function handleCatDrop(targetId: number) {
    if (catDragId == null || catDragId === targetId) { setCatDragId(null); setCatDragOverId(null); return; }
    const list = [...categories];
    const fromIdx = list.findIndex((c) => c.id === catDragId);
    const toIdx = list.findIndex((c) => c.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);
    saveCatOrder(list);
    setCatDragId(null);
    setCatDragOverId(null);
  }

  async function saveCat(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = {
      name: fd.get("name") as string,
      sortOrder: parseInt(fd.get("sortOrder") as string) || 0,
      isActive: true,
    };
    if (editingCat) {
      await fetch(`/api/menu/categories/${editingCat.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      await fetch("/api/menu/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }
    setCatModal(false);
    setEditingCat(null);
    load();
  }

  async function deleteCat(id: number) {
    if (!confirm("Kategoriyi silmek istediginize emin misiniz?")) return;
    await fetch(`/api/menu/categories/${id}`, { method: "DELETE" });
    load();
  }

  async function saveItem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = {
      name: fd.get("name") as string,
      categoryId: parseInt(fd.get("categoryId") as string),
      price: parseFloat(fd.get("price") as string),
      deliveryPrice: parseFloat(fd.get("deliveryPrice") as string) || null,
      description: (fd.get("description") as string) || null,
      prepTimeMinutes: parseInt(fd.get("prepTimeMinutes") as string) || 10,
      isAvailable: true,
    };

    let savedItem: MenuItem;
    if (editingItem) {
      const res = await fetch(`/api/menu/items/${editingItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      savedItem = await res.json();
    } else {
      const res = await fetch("/api/menu/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      savedItem = await res.json();
    }

    if (modalImage && savedItem?.id) {
      const imgFd = new FormData();
      imgFd.append("image", modalImage);
      const imgRes = await fetch(`/api/menu/items/${savedItem.id}/image`, { method: "POST", body: imgFd });
      if (!imgRes.ok) {
        const err = await imgRes.json().catch(() => ({ error: "Bilinmeyen hata" }));
        alert(`Urun kaydedildi ama fotograf yuklenemedi: ${err.error}`);
      }
    }

    // Save options
    if (savedItem?.id) {
      const existingRes = await fetch(`/api/menu/items/${savedItem.id}/options`);
      const existingOptions: OptionItem[] = await existingRes.json();
      const keepIds = new Set(itemOptions.filter((o) => o.id).map((o) => o.id));

      for (const old of existingOptions) {
        if (!keepIds.has(old.id)) {
          await fetch(`/api/menu/options/${old.id}`, { method: "DELETE" });
        }
      }

      for (const opt of itemOptions) {
        if (!opt.id) {
          await fetch(`/api/menu/items/${savedItem.id}/options`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(opt),
          });
        }
      }
    }

    setItemModal(false);
    setEditingItem(null);
    setModalImage(null);
    setModalImagePreview(null);
    setItemOptions([]);
    load();
  }

  async function deleteItem(id: number) {
    if (!confirm("Urunu silmek istediginize emin misiniz?")) return;
    await fetch(`/api/menu/items/${id}`, { method: "DELETE" });
    load();
  }

  async function deleteImage(itemId: number) {
    if (!confirm("Fotografi silmek istediginize emin misiniz?")) return;
    await fetch(`/api/menu/items/${itemId}/image`, { method: "DELETE" });
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, imageUrl: null } : i));
    setPreviewImage(null);
  }

  async function createTestLink() {
    setCreatingLink(true);
    const res = await fetch("/api/menu-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "05001234567", name: "Test Musteri", address: "Kadirli Merkez, Osmaniye" }),
    });
    if (res.ok) {
      const data = await res.json();
      setTestLink(`${window.location.origin}/m/${data.token}`);
    }
    setCreatingLink(false);
  }

  async function toggleAvailability(item: MenuItem) {
    await fetch(`/api/menu/items/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAvailable: !item.isAvailable }),
    });
    load();
  }

  async function uploadImage(itemId: number, file: File) {
    if (!file.type.startsWith("image/")) {
      alert("Gecersiz dosya tipi. Sadece resim dosyalari yuklenebilir.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Dosya 5MB'dan buyuk olamaz.");
      return;
    }
    setUploadingId(itemId);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch(`/api/menu/items/${itemId}/image`, { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        setItems(prev => prev.map(i => i.id === itemId ? { ...i, imageUrl: data.imageUrl + "?t=" + Date.now() } : i));
      } else {
        const err = await res.json().catch(() => ({ error: "Bilinmeyen hata" }));
        alert(`Fotograf yuklenemedi: ${err.error || res.statusText}`);
      }
    } catch (e) {
      alert("Fotograf yuklenirken baglanti hatasi olustu.");
    }
    setUploadingId(null);
  }

  function handleDrop(e: React.DragEvent, itemId: number) {
    e.preventDefault();
    setDragOverId(null);
    const file = e.dataTransfer.files[0];
    if (file) uploadImage(itemId, file);
  }

  function handleFileSelect(itemId: number) {
    setFileInputItemId(itemId);
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && fileInputItemId) uploadImage(fileInputItemId, file);
    e.target.value = "";
  }

  function handleModalFileDrop(e: React.DragEvent) {
    e.preventDefault();
    setModalDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) {
      setModalImage(file);
      setModalImagePreview(URL.createObjectURL(file));
    }
  }

  function handleModalFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file?.type.startsWith("image/")) {
      setModalImage(file);
      setModalImagePreview(URL.createObjectURL(file));
    }
    e.target.value = "";
  }

  async function openItemModal(item: MenuItem | null) {
    setEditingItem(item);
    setModalImage(null);
    setModalImagePreview(item?.imageUrl || null);
    setNewIngredient("");
    setNewExtraName("");
    setNewExtraPrice("");
    if (item?.id) {
      const res = await fetch(`/api/menu/items/${item.id}/options`);
      setItemOptions(await res.json());
    } else {
      setItemOptions([]);
    }
    setItemModal(true);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Menu Yonetimi</h2>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => { setEditingCat(null); setCatModal(true); }}>
            + Kategori
          </Button>
          <Button onClick={() => openItemModal(null)}>+ Urun Ekle</Button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setSelectedCat(null)}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            !selectedCat ? "bg-accent text-black" : "bg-surface-2 text-white/60 hover:text-white"
          }`}
        >
          Tumu ({items.length})
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCat(cat.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              selectedCat === cat.id ? "bg-accent text-black" : "bg-surface-2 text-white/60 hover:text-white"
            }`}
          >
            {cat.name} ({items.filter((i) => i.categoryId === cat.id).length})
          </button>
        ))}
      </div>

      {/* Categories Management */}
      <div className="card mb-6">
        <h3 className="text-sm font-semibold text-white/60 mb-3">Kategoriler <span className="text-white/20 text-[10px]">(surukle ile sirala)</span></h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {categories.map((cat) => (
            <div
              key={cat.id}
              draggable
              onDragStart={() => setCatDragId(cat.id)}
              onDragOver={(e) => { e.preventDefault(); setCatDragOverId(cat.id); }}
              onDragLeave={() => setCatDragOverId(null)}
              onDrop={(e) => { e.preventDefault(); handleCatDrop(cat.id); }}
              onDragEnd={() => { setCatDragId(null); setCatDragOverId(null); }}
              className={`bg-surface-2 rounded-xl p-3 flex items-center justify-between cursor-grab active:cursor-grabbing transition-all ${
                catDragId === cat.id ? "opacity-40" : ""
              } ${catDragOverId === cat.id && catDragId !== cat.id ? "ring-2 ring-amber-500" : ""}`}
            >
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-white/15 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>
                <span className="text-sm">{cat.name}</span>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setEditingCat(cat); setCatModal(true); }} className="text-white/30 hover:text-white text-xs px-1">✏️</button>
                <button onClick={() => deleteCat(cat.id)} className="text-white/30 hover:text-red-400 text-xs px-1">🗑️</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sort mode toggle */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white/60">Urunler {selectedCat ? `(${filteredItems.length})` : ""}</h3>
        <button
          onClick={() => setSortMode(!sortMode)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            sortMode ? "bg-amber-500 text-black" : "bg-surface-2 text-white/50 hover:text-white"
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
          {sortMode ? "Siralamadan Cik" : "Siralama"}
        </button>
      </div>

      {/* Items Grid */}
      <div className={sortMode ? "space-y-2" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"}>
        {filteredItems.map((item, idx) => {
          const cat = categories.find((c) => c.id === item.categoryId);

          if (sortMode) {
            return (
              <div
                key={item.id}
                data-sort-id={item.id}
                draggable
                onDragStart={() => setSortDragId(item.id)}
                onDragOver={(e) => { e.preventDefault(); setSortDragOverId(item.id); }}
                onDragLeave={() => setSortDragOverId(null)}
                onDrop={(e) => { e.preventDefault(); handleSortDrop(item.id); }}
                onDragEnd={() => { setSortDragId(null); setSortDragOverId(null); }}
                onTouchStart={(e) => handleTouchStart(e, item.id)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className={`flex items-center gap-3 bg-surface-1 rounded-xl p-3 border transition-all cursor-grab active:cursor-grabbing select-none ${
                  sortDragId === item.id ? "opacity-40 border-amber-500/50" : ""
                } ${sortDragOverId === item.id && sortDragId !== item.id ? "border-amber-500 bg-amber-500/10" : "border-border"
                }`}
              >
                <div className="flex flex-col items-center gap-0.5 text-white/20 shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>
                </div>
                <span className="text-xs text-white/30 font-mono w-5 shrink-0">{idx + 1}</span>
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-surface-2 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                  <p className="text-xs text-white/40">{cat?.name} &middot; {item.price} TL</p>
                </div>
              </div>
            );
          }

          return (
            <div
              key={item.id}
              className={`card p-0 overflow-hidden transition-all ${
                dragOverId === item.id ? "ring-2 ring-amber-500" : ""
              } ${uploadingId === item.id ? "opacity-50 animate-pulse" : ""} ${
                !item.isAvailable ? "opacity-50" : ""
              }`}
              onDrop={(e) => handleDrop(e, item.id)}
              onDragOver={(e) => { e.preventDefault(); setDragOverId(item.id); }}
              onDragLeave={() => setDragOverId(null)}
            >
              {/* Image area */}
              <div
                className="relative aspect-[16/10] bg-surface-2 cursor-pointer group"
                onClick={() => {
                  if (item.imageUrl) setPreviewImage({ url: item.imageUrl, name: item.name, itemId: item.id });
                  else handleFileSelect(item.id);
                }}
              >
                {item.imageUrl ? (
                  <>
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 text-white text-sm font-medium bg-black/50 px-3 py-1 rounded-lg transition-opacity">Onizle / Degistir</span>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 group-hover:bg-surface-3 transition-colors">
                    <svg className="w-8 h-8 text-white/15 group-hover:text-white/30 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs text-white/20 group-hover:text-white/40">Tikla veya surukle</span>
                  </div>
                )}
                {dragOverId === item.id && (
                  <div className="absolute inset-0 bg-amber-500/30 flex items-center justify-center border-2 border-dashed border-amber-400">
                    <span className="text-amber-200 font-medium text-sm">Birak</span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h4 className="font-semibold text-sm">{item.name}</h4>
                    <p className="text-xs text-white/40">{cat?.name}</p>
                  </div>
                  <button
                    onClick={() => toggleAvailability(item)}
                    className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-medium ${
                      item.isAvailable ? "bg-green-600/20 text-green-400" : "bg-red-600/20 text-red-400"
                    }`}
                  >
                    {item.isAvailable ? "Aktif" : "Pasif"}
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-amber-400 font-bold text-sm">{item.price} TL <span className="text-white/20 font-normal text-[10px]">mekan</span></span>
                    {item.deliveryPrice && (
                      <span className="text-orange-400/70 font-semibold text-xs">{item.deliveryPrice} TL <span className="text-white/20 font-normal text-[10px]">paket</span></span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openItemModal(item)} className="text-white/30 hover:text-white text-sm px-1">✏️</button>
                    <button onClick={() => deleteItem(item.id)} className="text-white/30 hover:text-red-400 text-sm px-1">🗑️</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {filteredItems.length === 0 && (
          <div className="col-span-full text-center text-white/30 py-12">Urun bulunamadi</div>
        )}
      </div>

      {/* Test Links */}
      <div className="card mt-6">
        <h3 className="text-sm font-semibold text-white/60 mb-3">Test Linkleri</h3>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={createTestLink} disabled={creatingLink}>
            {creatingLink ? "Olusturuluyor..." : "WhatsApp Siparis Linki Olustur"}
          </Button>
          <a href="/table/1" target="_blank" className="btn-secondary inline-block">Masa 1 Menu</a>
          <a href="/table/2" target="_blank" className="btn-secondary inline-block">Masa 2 Menu</a>
          <a href="/pos" target="_blank" className="btn-secondary inline-block">POS Sayfasi</a>
          {testLink && (
            <div className="flex items-center gap-2 bg-surface-2 rounded-xl px-4 py-2">
              <a href={testLink} target="_blank" className="text-amber-400 text-sm font-medium hover:underline break-all">{testLink}</a>
              <button onClick={() => { navigator.clipboard.writeText(testLink); }} className="text-white/40 hover:text-white text-xs shrink-0" title="Kopyala">📋</button>
            </div>
          )}
        </div>
      </div>

      {/* Category Modal */}
      <Modal open={catModal} onClose={() => { setCatModal(false); setEditingCat(null); }} title={editingCat ? "Kategori Duzenle" : "Yeni Kategori"}>
        <form onSubmit={saveCat} className="space-y-4">
          <div>
            <label className="text-xs text-white/40 mb-1 block">Kategori Adi</label>
            <input name="name" defaultValue={editingCat?.name || ""} className="input-field" required />
          </div>
          <div>
            <label className="text-xs text-white/40 mb-1 block">Siralama</label>
            <input name="sortOrder" type="number" defaultValue={editingCat?.sortOrder || 0} className="input-field" />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" type="button" onClick={() => { setCatModal(false); setEditingCat(null); }}>Iptal</Button>
            <Button type="submit">Kaydet</Button>
          </div>
        </form>
      </Modal>

      {/* Item Modal with Image Upload */}
      <Modal open={itemModal} onClose={() => { setItemModal(false); setEditingItem(null); setModalImage(null); setModalImagePreview(null); setItemOptions([]); }} title={editingItem ? "Urun Duzenle" : "Yeni Urun"}>
        <form onSubmit={saveItem} className="space-y-4">
          {/* Drag-drop image area */}
          <div>
            <label className="text-xs text-white/40 mb-1 block">Fotograf</label>
            <div
              className={`border-2 border-dashed rounded-xl overflow-hidden cursor-pointer transition-all ${
                modalDragOver ? "border-amber-500 bg-amber-500/10" : "border-border hover:border-white/20"
              }`}
              onDrop={handleModalFileDrop}
              onDragOver={(e) => { e.preventDefault(); setModalDragOver(true); }}
              onDragLeave={() => setModalDragOver(false)}
              onClick={() => modalFileRef.current?.click()}
            >
              {modalImagePreview ? (
                <div className="relative">
                  <img src={modalImagePreview} alt="Preview" className="w-full aspect-[16/10] object-cover" />
                  <div className="absolute inset-0 bg-black/0 hover:bg-black/30 flex items-center justify-center transition-all">
                    <span className="opacity-0 hover:opacity-100 text-white text-sm font-medium bg-black/50 px-3 py-1 rounded-lg">Degistir</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setModalImage(null); setModalImagePreview(null); }}
                    className="absolute top-2 right-2 w-7 h-7 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center text-white text-xs"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="py-8 flex flex-col items-center gap-2">
                  <svg className="w-8 h-8 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-sm text-white/30">Surukle birak veya tikla</p>
                  <p className="text-[10px] text-white/15">JPG, PNG, WEBP (max 5MB)</p>
                </div>
              )}
            </div>
            <input ref={modalFileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleModalFileSelect} />
          </div>

          <div>
            <label className="text-xs text-white/40 mb-1 block">Urun Adi</label>
            <input name="name" defaultValue={editingItem?.name || ""} className="input-field" required />
          </div>
          <div>
            <label className="text-xs text-white/40 mb-1 block">Kategori</label>
            <select name="categoryId" defaultValue={editingItem?.categoryId || ""} className="input-field" required>
              <option value="">Secin...</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/40 mb-1 block">Fiyat (TL)</label>
              <input name="price" type="number" step="0.01" defaultValue={editingItem?.price || ""} className="input-field" required />
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1 block">Paket Fiyat (TL)</label>
              <input name="deliveryPrice" type="number" step="0.01" defaultValue={editingItem?.deliveryPrice || ""} className="input-field" />
            </div>
          </div>
          <div>
            <label className="text-xs text-white/40 mb-1 block">Aciklama</label>
            <input name="description" defaultValue={editingItem?.description || ""} className="input-field" />
          </div>
          <div>
            <label className="text-xs text-white/40 mb-1 block">Hazirlama Suresi (dk)</label>
            <input name="prepTimeMinutes" type="number" defaultValue={editingItem?.prepTimeMinutes || 10} className="input-field" />
          </div>

          {/* Icindekiler */}
          <div className="border border-border rounded-xl p-3">
            <label className="text-xs text-white/40 mb-2 block">Icindekiler <span className="text-white/20">(musteri cikarabilir)</span></label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {itemOptions.filter((o) => o.groupName === "Icindekiler").map((opt, i) => (
                <span key={opt.id ?? `new-ing-${i}`} className="flex items-center gap-1 bg-surface-2 text-white/70 text-xs px-2.5 py-1.5 rounded-lg">
                  {opt.optionName}
                  <button type="button" onClick={() => setItemOptions((prev) => prev.filter((p) => p !== opt))} className="text-white/30 hover:text-red-400 ml-0.5">&times;</button>
                </span>
              ))}
              {itemOptions.filter((o) => o.groupName === "Icindekiler").length === 0 && (
                <span className="text-xs text-white/20">Henuz eklenmedi</span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                value={newIngredient}
                onChange={(e) => setNewIngredient(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (!newIngredient.trim()) return;
                    setItemOptions((prev) => [...prev, { groupName: "Icindekiler", optionName: newIngredient.trim(), priceModifier: 0, isDefault: true }]);
                    setNewIngredient("");
                  }
                }}
                placeholder="Orn: Marul, Domates..."
                className="input-field text-xs flex-1"
              />
              <Button type="button" variant="secondary" className="text-xs shrink-0" onClick={() => {
                if (!newIngredient.trim()) return;
                setItemOptions((prev) => [...prev, { groupName: "Icindekiler", optionName: newIngredient.trim(), priceModifier: 0, isDefault: true }]);
                setNewIngredient("");
              }}>Ekle</Button>
            </div>
          </div>

          {/* Ekstralar */}
          <div className="border border-border rounded-xl p-3">
            <label className="text-xs text-white/40 mb-2 block">Ekstralar <span className="text-white/20">(ek ucretli secenekler)</span></label>
            <div className="space-y-1.5 mb-2">
              {itemOptions.filter((o) => o.groupName === "Ekstralar").map((opt, i) => (
                <div key={opt.id ?? `new-ext-${i}`} className="flex items-center justify-between bg-surface-2 text-xs px-2.5 py-1.5 rounded-lg">
                  <span className="text-white/70">{opt.optionName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400 font-medium">+{opt.priceModifier} TL</span>
                    <button type="button" onClick={() => setItemOptions((prev) => prev.filter((p) => p !== opt))} className="text-white/30 hover:text-red-400">&times;</button>
                  </div>
                </div>
              ))}
              {itemOptions.filter((o) => o.groupName === "Ekstralar").length === 0 && (
                <span className="text-xs text-white/20">Henuz eklenmedi</span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                value={newExtraName}
                onChange={(e) => setNewExtraName(e.target.value)}
                placeholder="Orn: Peynir, Sos..."
                className="input-field text-xs flex-1"
              />
              <input
                value={newExtraPrice}
                onChange={(e) => setNewExtraPrice(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (!newExtraName.trim() || !newExtraPrice) return;
                    setItemOptions((prev) => [...prev, { groupName: "Ekstralar", optionName: newExtraName.trim(), priceModifier: parseFloat(newExtraPrice) || 0, isDefault: false }]);
                    setNewExtraName("");
                    setNewExtraPrice("");
                  }
                }}
                placeholder="TL"
                type="number"
                step="0.5"
                className="input-field text-xs w-20"
              />
              <Button type="button" variant="secondary" className="text-xs shrink-0" onClick={() => {
                if (!newExtraName.trim() || !newExtraPrice) return;
                setItemOptions((prev) => [...prev, { groupName: "Ekstralar", optionName: newExtraName.trim(), priceModifier: parseFloat(newExtraPrice) || 0, isDefault: false }]);
                setNewExtraName("");
                setNewExtraPrice("");
              }}>Ekle</Button>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="secondary" type="button" onClick={() => { setItemModal(false); setEditingItem(null); setModalImage(null); setModalImagePreview(null); setItemOptions([]); }}>Iptal</Button>
            <Button type="submit">Kaydet</Button>
          </div>
        </form>
      </Modal>

      {/* Image Preview Lightbox */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-lg w-full mx-4 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="bg-neutral-900 rounded-2xl overflow-hidden shadow-2xl border border-neutral-700/50">
              <div className="relative">
                <img src={previewImage.url} alt={previewImage.name} className="w-full aspect-[4/3] object-contain bg-neutral-950" />
                <button onClick={() => setPreviewImage(null)} className="absolute top-3 right-3 w-9 h-9 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white/70 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="p-4 flex items-center justify-between">
                <p className="text-white font-medium text-sm">{previewImage.name}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setPreviewImage(null); handleFileSelect(previewImage.itemId); }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg text-xs font-medium transition-colors"
                  >
                    Degistir
                  </button>
                  <button
                    onClick={() => deleteImage(previewImage.itemId)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs font-medium transition-colors"
                  >
                    Sil
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />

      <style jsx>{`
        @keyframes scale-in {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-scale-in { animation: scale-in 0.2s ease-out; }
      `}</style>
    </div>
  );
}
