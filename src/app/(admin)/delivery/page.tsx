"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import dynamic from "next/dynamic";
import { calculateRoute } from "@/lib/route-calc";
import { usePublicSettings } from "@/hooks/use-public-settings";
import QRCode from "qrcode";

const DeliveryMap = dynamic(() => import("@/components/delivery-map"), { ssr: false });

interface Delivery {
  id: number;
  customerName: string | null;
  customerPhone: string | null;
  deliveryAddress: string | null;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  total: number;
  status: string;
  createdAt: string;
  courierId: number | null;
  courierName: string | null;
  courierPhone: string | null;
}

interface Courier {
  id: number;
  name: string;
  phone: string;
  totalDeliveries: number;
  avgRating: number | null;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  new: { label: "Yeni", color: "bg-blue-600/20 text-blue-400" },
  preparing: { label: "Hazirlaniyor", color: "bg-orange-600/20 text-orange-400" },
  ready: { label: "Hazir", color: "bg-green-600/20 text-green-400" },
  on_the_way: { label: "Yolda", color: "bg-purple-600/20 text-purple-400" },
};

interface Customer {
  id: number;
  phone: string;
  name: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  orderCount: number;
  totalSpent: number;
}

type Tab = "list" | "map" | "whatsapp" | "couriers";

export default function DeliveryPage() {
  const ps = usePublicSettings();
  const [tab, setTab] = useState<Tab>("list");
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [assignModal, setAssignModal] = useState<Delivery | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [routeOrder, setRouteOrder] = useState<number[]>([]);
  const [batchModal, setBatchModal] = useState(false);
  const [batchCourier, setBatchCourier] = useState<number | null>(null);
  const [batchResult, setBatchResult] = useState<{ qr: string; url: string } | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [wpPhone, setWpPhone] = useState("");
  const [wpName, setWpName] = useState("");
  const [wpAddress, setWpAddress] = useState("");
  const [wpLink, setWpLink] = useState<string | null>(null);
  const [wpSending, setWpSending] = useState(false);
  const [wpSearch, setWpSearch] = useState("");
  const [radiusKm, setRadiusKm] = useState<number>(5);

  const [courierQrs, setCourierQrs] = useState<Record<number, string>>({});
  const [addCourierModal, setAddCourierModal] = useState(false);
  const [newCourierName, setNewCourierName] = useState("");
  const [newCourierPhone, setNewCourierPhone] = useState("");
  const [newCourierPin, setNewCourierPin] = useState("");
  const [deleteCourierId, setDeleteCourierId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const [deliveryRes, customerRes, settingsRes] = await Promise.all([
      fetch("/api/delivery"),
      fetch("/api/customers"),
      fetch("/api/settings/public"),
    ]);
    const data = await deliveryRes.json();
    setDeliveries(data.deliveries);
    setCouriers(data.couriers);
    const custData: Customer[] = await customerRes.json();
    setCustomers(custData);
    try {
      const s = await settingsRes.json();
      if (s.deliveryRadiusKm) setRadiusKm(s.deliveryRadiusKm);
    } catch {}
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    couriers.forEach((c) => {
      const phone = c.phone.replace(/\D/g, "").replace(/^0/, "90");
      if (phone.length >= 10) {
        QRCode.toDataURL(`https://wa.me/${phone}`, {
          width: 160,
          margin: 1,
          color: { dark: "#25D366", light: "#1a1a1a" },
        }).then((qr) => setCourierQrs((prev) => ({ ...prev, [c.id]: qr })));
      }
    });
  }, [couriers]);

  async function assignCourier(orderId: number, courierId: number) {
    await fetch("/api/delivery/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, courierId }),
    });
    setAssignModal(null);
    load();
  }

  async function markDelivered(orderId: number) {
    await fetch(`/api/orders/${orderId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "delivered" }),
    });
    load();
  }

  async function setLocation(orderId: number, lat: number, lng: number) {
    await fetch("/api/delivery/set-location", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, latitude: lat, longitude: lng }),
    });
    load();
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function buildRoute() {
    const route = calculateRoute(deliveries, selectedIds, [ps.shopLatitude, ps.shopLongitude]);
    setRouteOrder(route);
  }

  async function createBatch() {
    if (!batchCourier || selectedIds.length === 0) return;
    const orderedIds = routeOrder.length > 0 ? routeOrder : selectedIds;
    const res = await fetch("/api/delivery/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderIds: orderedIds,
        courierId: batchCourier,
        baseUrl: window.location.origin,
      }),
    });
    const data = await res.json();
    setBatchResult({ qr: data.qr, url: data.url });

    for (const orderId of selectedIds) {
      await fetch("/api/delivery/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, courierId: batchCourier }),
      });
    }

    const printWin = window.open(`/receipt/${orderedIds[0]}`, "batch_print", "width=400,height=700");
    for (let i = 1; i < orderedIds.length; i++) {
      await new Promise((r) => setTimeout(r, 2500));
      if (printWin && !printWin.closed) {
        printWin.location.href = `/receipt/${orderedIds[i]}`;
      } else {
        window.open(`/receipt/${orderedIds[i]}`, "batch_print", "width=400,height=700");
      }
    }

    load();
  }

  async function addCourier() {
    if (!newCourierName.trim() || !newCourierPhone.trim() || !newCourierPin.trim()) return;
    await fetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newCourierName.trim(),
        phone: newCourierPhone.trim(),
        pin: newCourierPin.trim(),
        role: "courier",
      }),
    });
    setNewCourierName("");
    setNewCourierPhone("");
    setNewCourierPin("");
    setAddCourierModal(false);
    load();
  }

  async function removeCourier(id: number) {
    await fetch(`/api/staff/${id}`, { method: "DELETE" });
    setDeleteCourierId(null);
    load();
  }

  function getElapsed(createdAt: string) {
    return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  }

  async function createMenuLink() {
    if (!wpPhone.trim()) return;
    setWpSending(true);
    const res = await fetch("/api/menu-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: wpPhone.trim(),
        name: wpName.trim() || undefined,
        address: wpAddress.trim() || undefined,
      }),
    });
    const data = await res.json();
    const url = `${window.location.origin}/m/${data.token}`;
    setWpLink(url);
    setWpSending(false);
    load();
  }

  function selectCustomer(c: Customer) {
    setWpPhone(c.phone);
    setWpName(c.name || "");
    setWpAddress(c.address || "");
    setWpSearch("");
  }

  const filteredCustomers = wpSearch.trim()
    ? customers.filter((c) =>
        (c.name || "").toLowerCase().includes(wpSearch.toLowerCase()) ||
        c.phone.includes(wpSearch)
      )
    : [];

  const unassigned = deliveries.filter((d) => !d.courierId);
  const assigned = deliveries.filter((d) => d.courierId);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Teslimat Yonetimi</h2>
          <p className="text-white/40 text-sm mt-1">
            {deliveries.length} aktif teslimat, {couriers.length} kurye
          </p>
        </div>
        <div className="flex gap-1 bg-surface-2 rounded-xl p-1">
          <button
            onClick={() => setTab("list")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === "list" ? "bg-accent text-black" : "text-white/50 hover:text-white"
            }`}
          >
            Liste
          </button>
          <button
            onClick={() => setTab("map")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === "map" ? "bg-accent text-black" : "text-white/50 hover:text-white"
            }`}
          >
            Harita
          </button>
          <button
            onClick={() => setTab("whatsapp")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === "whatsapp" ? "bg-green-500 text-white" : "text-white/50 hover:text-white"
            }`}
          >
            WhatsApp
          </button>
          <button
            onClick={() => setTab("couriers")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === "couriers" ? "bg-purple-500 text-white" : "text-white/50 hover:text-white"
            }`}
          >
            Kuryeler
          </button>
        </div>
      </div>

      {/* Courier Summary */}
      {couriers.length > 0 && (
        <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
          {couriers.map((c) => {
            const activeCount = assigned.filter((d) => d.courierId === c.id).length;
            return (
              <div key={c.id} className="bg-surface-2 rounded-xl p-3 min-w-[160px] shrink-0">
                <p className="font-semibold text-sm">{c.name}</p>
                <p className="text-xs text-white/40">{c.phone}</p>
                <div className="flex gap-3 mt-2 text-xs">
                  <span className={activeCount > 0 ? "text-orange-400" : "text-green-400"}>
                    {activeCount > 0 ? `${activeCount} aktif` : "Musait"}
                  </span>
                  <span className="text-white/30">{c.totalDeliveries} toplam</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "map" && (
        <div className="mb-6">
          <DeliveryMap
            deliveries={deliveries}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onSetLocation={setLocation}
            routeOrder={routeOrder}
            customers={customers}
            radiusKm={radiusKm}
          />

          {selectedIds.length > 0 && (
            <div className="bg-surface-2 rounded-xl p-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold">{selectedIds.length} siparis secildi</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => { setSelectedIds([]); setRouteOrder([]); }}>
                    Temizle
                  </Button>
                  <Button size="sm" variant="secondary" onClick={buildRoute}>
                    Rota Olustur
                  </Button>
                  <Button size="sm" onClick={() => { setBatchModal(true); setBatchResult(null); setBatchCourier(null); }}>
                    Toplu Gonder
                  </Button>
                </div>
              </div>
              {routeOrder.length > 0 && (
                <div className="flex flex-wrap gap-1 text-xs">
                  <span className="text-white/40">Rota:</span>
                  <span className="text-amber-400">Dukkan</span>
                  {routeOrder.map((id) => (
                    <span key={id}>
                      <span className="text-white/30"> → </span>
                      <span className="text-white/70">#{id}</span>
                    </span>
                  ))}
                  <span className="text-white/30"> → </span>
                  <span className="text-amber-400">Dukkan</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "whatsapp" && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">WhatsApp Siparis Linki Olustur</h3>

            {/* Customer Search */}
            <div className="relative mb-4">
              <input
                type="text"
                placeholder="Musteri ara (isim veya telefon)..."
                value={wpSearch}
                onChange={(e) => setWpSearch(e.target.value)}
                className="w-full bg-surface-2 rounded-xl px-4 py-3 text-sm border border-border"
              />
              {filteredCustomers.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-surface-2 border border-border rounded-xl mt-1 max-h-48 overflow-y-auto z-10">
                  {filteredCustomers.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => selectCustomer(c)}
                      className="w-full text-left px-4 py-3 hover:bg-surface-3 border-b border-border/50 last:border-0"
                    >
                      <span className="font-medium">{c.name || "Isimsiz"}</span>
                      <span className="text-white/40 ml-2 text-sm">{c.phone}</span>
                      {c.orderCount > 0 && (
                        <span className="text-xs text-accent ml-2">{c.orderCount} siparis</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs text-white/40 mb-1 block">Telefon *</label>
                <input
                  type="tel"
                  value={wpPhone}
                  onChange={(e) => setWpPhone(e.target.value)}
                  placeholder="05xx xxx xx xx"
                  className="w-full bg-surface-2 rounded-xl px-4 py-3 text-sm border border-border"
                />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Isim</label>
                <input
                  type="text"
                  value={wpName}
                  onChange={(e) => setWpName(e.target.value)}
                  placeholder="Musteri adi"
                  className="w-full bg-surface-2 rounded-xl px-4 py-3 text-sm border border-border"
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="text-xs text-white/40 mb-1 block">Teslimat Adresi</label>
              <input
                type="text"
                value={wpAddress}
                onChange={(e) => setWpAddress(e.target.value)}
                placeholder="Mahalle, sokak, bina no..."
                className="w-full bg-surface-2 rounded-xl px-4 py-3 text-sm border border-border"
              />
            </div>

            <Button
              className="w-full"
              onClick={createMenuLink}
              disabled={!wpPhone.trim() || wpSending}
            >
              {wpSending ? "Olusturuluyor..." : "Menu Linki Olustur"}
            </Button>

            {wpLink && (
              <div className="mt-4 p-4 bg-green-600/10 border border-green-500/30 rounded-xl">
                <p className="text-sm text-green-400 font-medium mb-2">Link olusturuldu!</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={wpLink}
                    className="flex-1 bg-surface-2 rounded-lg px-3 py-2 text-sm text-white/80 border border-border"
                  />
                  <Button
                    size="sm"
                    onClick={() => { navigator.clipboard.writeText(wpLink); }}
                  >
                    Kopyala
                  </Button>
                </div>
                <p className="text-xs text-white/30 mt-2">Bu linki WhatsApp uzerinden musteriye gonderin. Musteri menuyu gorur, siparis verir ve sistem otomatik kaydeder.</p>
                <div className="flex gap-2 mt-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const phone = wpPhone.replace(/\D/g, "").replace(/^0/, "90");
                      const text = encodeURIComponent(`Merhaba${wpName ? " " + wpName : ""}, siparisiniizi buradan verebilirsiniz:\n${wpLink}`);
                      window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
                    }}
                  >
                    WhatsApp ile Gonder
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => { setWpLink(null); setWpPhone(""); setWpName(""); setWpAddress(""); }}
                  >
                    Yeni Link
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Registered Customers */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-3">Kayitli Musteriler ({customers.length})</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {customers.map((c) => (
                <div key={c.id} className="flex items-center justify-between bg-surface-2 rounded-xl p-3">
                  <div>
                    <p className="font-medium text-sm">{c.name || "Isimsiz"}</p>
                    <p className="text-xs text-white/40">{c.phone}</p>
                    {c.address && <p className="text-xs text-white/30">{c.address}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-accent">{c.orderCount} siparis</p>
                    <p className="text-xs text-white/30">{c.totalSpent.toFixed(0)} TL</p>
                  </div>
                </div>
              ))}
              {customers.length === 0 && (
                <p className="text-center text-white/30 py-4">Henuz kayitli musteri yok</p>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "list" && (
        <>
          {/* Unassigned Deliveries */}
          {unassigned.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3 text-red-400">Kurye Atanmamis ({unassigned.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {unassigned.map((d) => (
                  <div key={d.id} className="card border border-red-500/20">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold">#{d.id}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${STATUS_MAP[d.status]?.color}`}>
                        {STATUS_MAP[d.status]?.label}
                      </span>
                    </div>
                    <p className="text-sm font-medium">{d.customerName || "Isimsiz"}</p>
                    <p className="text-xs text-white/40 mb-1">{d.customerPhone}</p>
                    <p className="text-xs text-white/50 mb-3">{d.deliveryAddress}</p>
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-accent">{d.total.toFixed(2)} TL</span>
                      <span className="text-xs text-white/30">{getElapsed(d.createdAt)}dk</span>
                    </div>
                    <Button className="w-full mt-3" onClick={() => setAssignModal(d)}>Kurye Ata</Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Assigned / On the Way */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Aktif Teslimatlar ({assigned.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {assigned.map((d) => (
                <div key={d.id} className="card">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold">#{d.id}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${STATUS_MAP[d.status]?.color}`}>
                      {STATUS_MAP[d.status]?.label}
                    </span>
                  </div>
                  <p className="text-sm">{d.customerName || "Isimsiz"} — {d.deliveryAddress}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs">
                    <span className="bg-purple-600/20 text-purple-400 px-2 py-0.5 rounded">{d.courierName}</span>
                    <span className="text-white/30">{getElapsed(d.createdAt)}dk</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <span className="font-semibold text-accent flex-1">{d.total.toFixed(2)} TL</span>
                    {d.status === "on_the_way" && (
                      <Button size="sm" onClick={() => markDelivered(d.id)}>Teslim Edildi</Button>
                    )}
                  </div>
                </div>
              ))}
              {assigned.length === 0 && unassigned.length === 0 && (
                <div className="col-span-full text-center py-8 text-white/30">Aktif teslimat yok</div>
              )}
            </div>
          </div>
        </>
      )}

      {tab === "couriers" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Kurye Yonetimi</h3>
            <Button onClick={() => setAddCourierModal(true)}>Kurye Ekle</Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {couriers.map((c) => {
              const phone = c.phone.replace(/\D/g, "").replace(/^0/, "90");
              const wpUrl = `https://wa.me/${phone}`;
              const activeCount = assigned.filter((d) => d.courierId === c.id).length;
              return (
                <div key={c.id} className="card">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-bold text-lg">{c.name}</p>
                      <a href={`tel:${c.phone}`} className="text-sm text-blue-400">{c.phone}</a>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-lg ${activeCount > 0 ? "bg-orange-600/20 text-orange-400" : "bg-green-600/20 text-green-400"}`}>
                      {activeCount > 0 ? `${activeCount} aktif` : "Musait"}
                    </span>
                  </div>

                  {courierQrs[c.id] && (
                    <div className="bg-surface-2 rounded-xl p-3 mb-3">
                      <p className="text-xs text-white/40 mb-2 text-center">WhatsApp QR</p>
                      <img src={courierQrs[c.id]} alt="QR" className="mx-auto rounded-lg w-[140px] h-[140px]" />
                      <p className="text-xs text-green-400 text-center mt-2 font-mono truncate">{wpUrl}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-white/40 mb-3">
                    <span>{c.totalDeliveries} toplam teslimat</span>
                    {c.avgRating && <span>{c.avgRating.toFixed(1)} puan</span>}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => window.open(wpUrl, "_blank")}
                    >
                      WhatsApp Ac
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        if (courierQrs[c.id]) {
                          const link = document.createElement("a");
                          link.download = `kurye-${c.name.toLowerCase().replace(/\s+/g, "-")}-qr.png`;
                          link.href = courierQrs[c.id];
                          link.click();
                        }
                      }}
                    >
                      QR Indir
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => navigator.clipboard.writeText(wpUrl)}
                    >
                      Link Kopyala
                    </Button>
                    <button
                      onClick={() => setDeleteCourierId(c.id)}
                      className="py-1.5 rounded-xl bg-red-600/20 text-red-400 text-xs font-semibold hover:bg-red-600/30 transition-colors"
                    >
                      Cikar
                    </button>
                  </div>
                </div>
              );
            })}
            {couriers.length === 0 && (
              <div className="col-span-full text-center py-8 text-white/30">Henuz kurye eklenmemis</div>
            )}
          </div>
        </div>
      )}

      {/* Add Courier Modal */}
      <Modal open={addCourierModal} onClose={() => setAddCourierModal(false)} title="Yeni Kurye Ekle">
        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/40 mb-1 block">Ad Soyad *</label>
            <input
              type="text"
              value={newCourierName}
              onChange={(e) => setNewCourierName(e.target.value)}
              placeholder="Kurye adi"
              className="w-full bg-surface-2 rounded-xl px-4 py-3 text-sm border border-border"
            />
          </div>
          <div>
            <label className="text-xs text-white/40 mb-1 block">WhatsApp / Telefon *</label>
            <input
              type="tel"
              value={newCourierPhone}
              onChange={(e) => setNewCourierPhone(e.target.value)}
              placeholder="05xx xxx xx xx"
              className="w-full bg-surface-2 rounded-xl px-4 py-3 text-sm border border-border"
            />
          </div>
          <div>
            <label className="text-xs text-white/40 mb-1 block">Giris PIN *</label>
            <input
              type="text"
              value={newCourierPin}
              onChange={(e) => setNewCourierPin(e.target.value)}
              placeholder="4 haneli PIN"
              maxLength={6}
              className="w-full bg-surface-2 rounded-xl px-4 py-3 text-sm border border-border"
            />
          </div>
          <Button className="w-full" onClick={addCourier} disabled={!newCourierName.trim() || !newCourierPhone.trim() || !newCourierPin.trim()}>
            Kurye Ekle
          </Button>
        </div>
      </Modal>

      {/* Delete Courier Confirm */}
      <Modal open={!!deleteCourierId} onClose={() => setDeleteCourierId(null)} title="Kuryeyi Cikar">
        <div className="space-y-4">
          <p className="text-white/60 text-sm">Bu kuryeyi sistemden cikarmak istediginize emin misiniz?</p>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={() => setDeleteCourierId(null)}>Iptal</Button>
            <button
              onClick={() => deleteCourierId && removeCourier(deleteCourierId)}
              className="py-2 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-colors"
            >
              Cikar
            </button>
          </div>
        </div>
      </Modal>

      {/* Assign Courier Modal */}
      <Modal open={!!assignModal} onClose={() => setAssignModal(null)} title={`Siparis #${assignModal?.id} Kurye Ata`}>
        <div className="space-y-3">
          {couriers.length === 0 && (
            <p className="text-white/40 text-center py-4">Aktif kurye bulunamadi</p>
          )}
          {couriers.map((c) => (
            <button
              key={c.id}
              onClick={() => assignModal && assignCourier(assignModal.id, c.id)}
              className="w-full bg-surface-2 hover:bg-surface-3 rounded-xl p-4 text-left transition-colors"
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-xs text-white/40">{c.phone}</p>
                </div>
                <div className="text-right text-xs text-white/40">
                  <p>{c.totalDeliveries} teslimat</p>
                  {c.avgRating && <p>{c.avgRating.toFixed(1)} puan</p>}
                </div>
              </div>
            </button>
          ))}
        </div>
      </Modal>

      {/* Batch Send Modal */}
      <Modal open={batchModal} onClose={() => setBatchModal(false)} title="Toplu Teslimat Gonder">
        {!batchResult ? (
          <div className="space-y-4">
            <p className="text-sm text-white/60">
              {selectedIds.length} siparis secildi. Kurye secin ve QR kodu olusturun.
            </p>
            <div className="space-y-2">
              {couriers.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setBatchCourier(c.id)}
                  className={`w-full rounded-xl p-3 text-left transition-colors ${
                    batchCourier === c.id
                      ? "bg-accent/20 border border-accent/50"
                      : "bg-surface-2 hover:bg-surface-3 border border-transparent"
                  }`}
                >
                  <p className="font-semibold text-sm">{c.name}</p>
                  <p className="text-xs text-white/40">{c.phone}</p>
                </button>
              ))}
            </div>
            <Button
              className="w-full"
              disabled={!batchCourier}
              onClick={createBatch}
            >
              QR Kod Olustur
            </Button>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <p className="text-sm text-green-400 font-medium">Toplu teslimat olusturuldu!</p>
            <img src={batchResult.qr} alt="QR Code" className="mx-auto rounded-xl" />
            <p className="text-xs text-white/40 break-all">{batchResult.url}</p>
            <p className="text-xs text-white/30">Kurye bu QR kodu okutarak tum siparisleri gorebilir</p>
            <Button variant="secondary" className="w-full" onClick={() => setBatchModal(false)}>
              Kapat
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
