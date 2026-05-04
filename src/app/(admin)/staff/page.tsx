"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

interface Staff {
  id: number;
  name: string;
  phone: string;
  role: string;
  pin: string | null;
  isActive: boolean;
  salary: number | null;
  totalDeliveries: number;
  avgRating: number | null;
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Patron",
  cashier: "Kasiyer",
  cook: "Asci",
  courier: "Kurye",
  waiter: "Garson",
};

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-purple-600/20 text-purple-400",
  cashier: "bg-blue-600/20 text-blue-400",
  cook: "bg-orange-600/20 text-orange-400",
  courier: "bg-green-600/20 text-green-400",
  waiter: "bg-amber-600/20 text-amber-400",
};

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/staff");
    setStaff(await res.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = {
      name: fd.get("name") as string,
      phone: fd.get("phone") as string,
      role: fd.get("role") as string,
      pin: (fd.get("pin") as string) || null,
      salary: parseFloat(fd.get("salary") as string) || null,
    };

    if (editing) {
      await fetch(`/api/staff/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }
    setModal(false);
    setEditing(null);
    load();
  }

  async function toggleActive(s: Staff) {
    await fetch(`/api/staff/${s.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !s.isActive }),
    });
    load();
  }

  const active = staff.filter((s) => s.isActive);
  const inactive = staff.filter((s) => !s.isActive);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Personel Yonetimi</h2>
          <p className="text-white/40 text-sm mt-1">
            {active.length} aktif, {inactive.length} pasif personel
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setModal(true); }}>+ Personel Ekle</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {staff.map((s) => (
          <div key={s.id} className={`card ${!s.isActive ? "opacity-50" : ""}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-lg">{s.name}</h3>
                <p className="text-white/40 text-sm">{s.phone}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-lg ${ROLE_COLORS[s.role] || "bg-white/10 text-white/60"}`}>
                {ROLE_LABELS[s.role] || s.role}
              </span>
            </div>

            <div className="space-y-2 text-sm">
              {s.salary && (
                <div className="flex justify-between">
                  <span className="text-white/40">Maas</span>
                  <span>{s.salary.toLocaleString("tr-TR")} TL</span>
                </div>
              )}
              {s.role === "courier" && (
                <>
                  <div className="flex justify-between">
                    <span className="text-white/40">Teslimat</span>
                    <span>{s.totalDeliveries}</span>
                  </div>
                  {s.avgRating && (
                    <div className="flex justify-between">
                      <span className="text-white/40">Puan</span>
                      <span>{s.avgRating.toFixed(1)} / 5</span>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex gap-2 mt-4 pt-3 border-t border-border">
              <button
                onClick={() => { setEditing(s); setModal(true); }}
                className="text-xs text-white/30 hover:text-white transition-colors"
              >
                Duzenle
              </button>
              <button
                onClick={() => toggleActive(s)}
                className={`text-xs transition-colors ${s.isActive ? "text-red-400/50 hover:text-red-400" : "text-green-400/50 hover:text-green-400"}`}
              >
                {s.isActive ? "Pasife Al" : "Aktif Et"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {staff.length === 0 && (
        <div className="text-center py-12 text-white/30">Henuz personel eklenmedi</div>
      )}

      <Modal open={modal} onClose={() => { setModal(false); setEditing(null); }} title={editing ? "Personel Duzenle" : "Yeni Personel"}>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="text-xs text-white/40 mb-1 block">Ad Soyad</label>
            <input name="name" defaultValue={editing?.name || ""} className="input-field" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/40 mb-1 block">Telefon</label>
              <input name="phone" defaultValue={editing?.phone || ""} className="input-field" required />
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1 block">Rol</label>
              <select name="role" defaultValue={editing?.role || "cook"} className="input-field">
                <option value="owner">Patron</option>
                <option value="cashier">Kasiyer</option>
                <option value="cook">Asci</option>
                <option value="courier">Kurye</option>
                <option value="waiter">Garson</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/40 mb-1 block">PIN (Giris)</label>
              <input name="pin" type="password" maxLength={4} defaultValue={editing?.pin || ""} className="input-field" placeholder="4 haneli" />
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1 block">Maas (TL)</label>
              <input name="salary" type="number" step="100" defaultValue={editing?.salary || ""} className="input-field" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" type="button" onClick={() => { setModal(false); setEditing(null); }}>Iptal</Button>
            <Button type="submit">Kaydet</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
