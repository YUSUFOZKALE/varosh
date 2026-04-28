"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import dynamic from "next/dynamic";

const CustomerMap = dynamic(() => import("@/components/customer-map"), { ssr: false });

interface Customer {
  id: number;
  phone: string;
  name: string | null;
  address: string | null;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  totalSpent: number;
  orderCount: number;
  loyaltyPoints: number;
  loyaltyTier: string;
  segment: string;
  lastOrderAt: string | null;
  isBlacklisted: boolean | null;
}

const TIER_COLORS: Record<string, string> = {
  bronze: "bg-amber-800/20 text-amber-600",
  silver: "bg-gray-400/20 text-gray-300",
  gold: "bg-yellow-500/20 text-yellow-400",
  vip: "bg-purple-500/20 text-purple-400",
};

const SEGMENT_LABELS: Record<string, string> = {
  new: "Yeni",
  loyal: "Sadik",
  lost: "Kayip",
  vip: "VIP",
  complainer: "Sikayetci",
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name");
  const [modal, setModal] = useState(false);
  const [detail, setDetail] = useState<Customer | null>(null);
  const [showMap, setShowMap] = useState(true);
  const [editModal, setEditModal] = useState<Customer | null>(null);

  const [formLat, setFormLat] = useState<number | null>(null);
  const [formLng, setFormLng] = useState<number | null>(null);
  const [pickingFor, setPickingFor] = useState<"add" | "edit" | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    params.set("sort", sort);
    const res = await fetch(`/api/customers?${params}`);
    setCustomers(await res.json());
  }, [search, sort]);

  useEffect(() => { load(); }, [load]);

  async function addCustomer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name") as string,
        phone: fd.get("phone") as string,
        address: fd.get("address") as string || null,
        notes: fd.get("notes") as string || null,
        latitude: formLat,
        longitude: formLng,
      }),
    });
    setModal(false);
    setFormLat(null);
    setFormLng(null);
    setPickingFor(null);
    load();
  }

  async function updateCustomer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editModal) return;
    const fd = new FormData(e.currentTarget);
    await fetch(`/api/customers/${editModal.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name") as string,
        phone: fd.get("phone") as string,
        address: fd.get("address") as string || null,
        notes: fd.get("notes") as string || null,
        latitude: formLat,
        longitude: formLng,
      }),
    });
    setEditModal(null);
    setDetail(null);
    setFormLat(null);
    setFormLng(null);
    setPickingFor(null);
    load();
  }

  async function toggleBlacklist(c: Customer) {
    await fetch(`/api/customers/${c.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isBlacklisted: !c.isBlacklisted }),
    });
    load();
    setDetail(null);
  }

  function timeSince(dateStr: string | null) {
    if (!dateStr) return "-";
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    if (days === 0) return "Bugun";
    if (days === 1) return "Dun";
    return `${days} gun once`;
  }

  function openEdit(c: Customer) {
    setEditModal(c);
    setFormLat(c.latitude);
    setFormLng(c.longitude);
    setDetail(null);
  }

  function openAdd() {
    setModal(true);
    setFormLat(null);
    setFormLng(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Musteriler</h2>
          <p className="text-white/40 text-sm mt-1">{customers.length} musteri</p>
        </div>
        <div className="flex gap-2">
          <Button variant={showMap ? "primary" : "secondary"} onClick={() => setShowMap(!showMap)}>
            {showMap ? "Haritayi Gizle" : "Haritada Goster"}
          </Button>
          <Button onClick={openAdd}>+ Musteri Ekle</Button>
        </div>
      </div>

      {showMap && (
        <div className="mb-6">
          <CustomerMap
            customers={customers}
            onSelectCustomer={(c) => {
              const full = customers.find((x) => x.id === c.id);
              if (full) setDetail(full);
            }}
            pickMode={pickingFor !== null}
            onPickLocation={(lat, lng) => {
              setFormLat(lat);
              setFormLng(lng);
            }}
          />
          {pickingFor && (
            <div className="flex justify-center mt-2">
              <Button variant="secondary" onClick={() => setPickingFor(null)}>
                Konum Secimi Iptal
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Ara (ad veya telefon)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field flex-1"
        />
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="input-field w-40">
          <option value="name">Ada Gore</option>
          <option value="spent">Harcamaya Gore</option>
          <option value="orders">Siparis Sayisi</option>
          <option value="recent">Son Siparis</option>
        </select>
      </div>

      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-white/40 text-xs">
              <th className="px-4 py-3 text-left">Musteri</th>
              <th className="px-4 py-3 text-left">Telefon</th>
              <th className="px-4 py-3 text-left">Adres</th>
              <th className="px-4 py-3 text-center">Konum</th>
              <th className="px-4 py-3 text-center">Tier</th>
              <th className="px-4 py-3 text-right">Siparis</th>
              <th className="px-4 py-3 text-right">Harcama</th>
              <th className="px-4 py-3 text-right">Son Siparis</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {customers.map((c) => (
              <tr
                key={c.id}
                onClick={() => setDetail(c)}
                className={`hover:bg-surface-2 transition-colors cursor-pointer ${c.isBlacklisted ? "opacity-40" : ""}`}
              >
                <td className="px-4 py-3">
                  <span className="font-medium">{c.name || "Isimsiz"}</span>
                  {c.segment !== "new" && (
                    <span className="ml-2 text-xs text-white/30">{SEGMENT_LABELS[c.segment]}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-white/50">{c.phone}</td>
                <td className="px-4 py-3 text-white/40 text-xs max-w-[200px] truncate">{c.address || "-"}</td>
                <td className="px-4 py-3 text-center">
                  {c.latitude && c.longitude ? (
                    <span className="text-green-400 text-xs">&#10003;</span>
                  ) : (
                    <span className="text-white/20 text-xs">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded ${TIER_COLORS[c.loyaltyTier]}`}>
                    {c.loyaltyTier.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">{c.orderCount}</td>
                <td className="px-4 py-3 text-right font-semibold">{c.totalSpent.toLocaleString("tr-TR")} TL</td>
                <td className="px-4 py-3 text-right text-white/40">{timeSince(c.lastOrderAt)}</td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-white/30">Musteri bulunamadi</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Customer Detail Modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title="Musteri Detay">
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-white/40">Ad</p>
                <p className="font-medium">{detail.name || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-white/40">Telefon</p>
                <p className="font-medium">{detail.phone}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-white/40">Adres</p>
                <p className="font-medium">{detail.address || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-white/40">Konum</p>
                <p className="font-medium">
                  {detail.latitude && detail.longitude
                    ? `${detail.latitude.toFixed(5)}, ${detail.longitude.toFixed(5)}`
                    : "Belirlenmemis"}
                </p>
              </div>
              <div>
                <p className="text-xs text-white/40">Segment</p>
                <p className="font-medium">{SEGMENT_LABELS[detail.segment] || detail.segment}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-surface-2 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold">{detail.orderCount}</p>
                <p className="text-xs text-white/40">Siparis</p>
              </div>
              <div className="bg-surface-2 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold">{detail.totalSpent.toLocaleString("tr-TR")}</p>
                <p className="text-xs text-white/40">TL Harcama</p>
              </div>
              <div className="bg-surface-2 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-amber-400">{detail.loyaltyPoints}</p>
                <p className="text-xs text-white/40">Puan</p>
              </div>
            </div>

            {detail.notes && (
              <div>
                <p className="text-xs text-white/40 mb-1">Notlar</p>
                <p className="text-sm bg-surface-2 rounded-xl p-3">{detail.notes}</p>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="secondary" onClick={() => openEdit(detail)}>Duzenle</Button>
              <Button
                variant={detail.isBlacklisted ? "secondary" : "danger"}
                onClick={() => toggleBlacklist(detail)}
              >
                {detail.isBlacklisted ? "Kara Listeden Cikar" : "Kara Listeye Ekle"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add Customer Modal */}
      <Modal open={modal} onClose={() => { setModal(false); setPickingFor(null); setFormLat(null); setFormLng(null); }} title="Yeni Musteri">
        <form onSubmit={addCustomer} className="space-y-4">
          <div>
            <label className="text-xs text-white/40 mb-1 block">Telefon *</label>
            <input name="phone" className="input-field" required placeholder="05XX XXX XXXX" />
          </div>
          <div>
            <label className="text-xs text-white/40 mb-1 block">Ad Soyad</label>
            <input name="name" className="input-field" />
          </div>
          <div>
            <label className="text-xs text-white/40 mb-1 block">Adres</label>
            <textarea name="address" className="input-field" rows={2} />
          </div>
          <div>
            <label className="text-xs text-white/40 mb-1 block">Konum</label>
            {formLat && formLng ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-green-400">{formLat.toFixed(5)}, {formLng.toFixed(5)}</span>
                <button type="button" onClick={() => { setFormLat(null); setFormLng(null); }} className="text-xs text-red-400 hover:text-red-300">Sil</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setPickingFor("add"); setShowMap(true); }}
                className="text-sm text-amber-400 hover:text-amber-300 underline"
              >
                Haritadan Sec
              </button>
            )}
          </div>
          <div>
            <label className="text-xs text-white/40 mb-1 block">Notlar</label>
            <textarea name="notes" className="input-field" rows={2} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" type="button" onClick={() => { setModal(false); setPickingFor(null); }}>Iptal</Button>
            <Button type="submit">Kaydet</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Customer Modal */}
      <Modal open={!!editModal} onClose={() => { setEditModal(null); setPickingFor(null); setFormLat(null); setFormLng(null); }} title="Musteri Duzenle">
        {editModal && (
          <form onSubmit={updateCustomer} className="space-y-4">
            <div>
              <label className="text-xs text-white/40 mb-1 block">Telefon *</label>
              <input name="phone" className="input-field" required defaultValue={editModal.phone} />
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1 block">Ad Soyad</label>
              <input name="name" className="input-field" defaultValue={editModal.name || ""} />
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1 block">Adres</label>
              <textarea name="address" className="input-field" rows={2} defaultValue={editModal.address || ""} />
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1 block">Konum</label>
              {formLat && formLng ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-green-400">{formLat.toFixed(5)}, {formLng.toFixed(5)}</span>
                  <button type="button" onClick={() => { setFormLat(null); setFormLng(null); }} className="text-xs text-red-400 hover:text-red-300">Sil</button>
                  <button type="button" onClick={() => { setPickingFor("edit"); setShowMap(true); }} className="text-xs text-amber-400 hover:text-amber-300">Degistir</button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { setPickingFor("edit"); setShowMap(true); }}
                  className="text-sm text-amber-400 hover:text-amber-300 underline"
                >
                  Haritadan Sec
                </button>
              )}
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1 block">Notlar</label>
              <textarea name="notes" className="input-field" rows={2} defaultValue={editModal.notes || ""} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" type="button" onClick={() => { setEditModal(null); setPickingFor(null); }}>Iptal</Button>
              <Button type="submit">Guncelle</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
