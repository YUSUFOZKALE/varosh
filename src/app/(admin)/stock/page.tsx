"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

interface Ingredient {
  id: number;
  name: string;
  unit: string;
  unitCost: number;
  currentStock: number;
  minStockAlert: number | null;
  supplier: string | null;
}

export default function StockPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/stock/ingredients");
    setIngredients(await res.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = {
      name: fd.get("name") as string,
      unit: fd.get("unit") as string,
      unitCost: parseFloat(fd.get("unitCost") as string),
      currentStock: parseFloat(fd.get("currentStock") as string) || 0,
      minStockAlert: parseFloat(fd.get("minStockAlert") as string) || null,
      supplier: (fd.get("supplier") as string) || null,
    };

    if (editing) {
      await fetch(`/api/stock/ingredients/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      await fetch("/api/stock/ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }
    setModal(false);
    setEditing(null);
    load();
  }

  async function remove(id: number) {
    if (!confirm("Hammaddeyi silmek istediginize emin misiniz?")) return;
    await fetch(`/api/stock/ingredients/${id}`, { method: "DELETE" });
    load();
  }

  const lowStock = ingredients.filter((i) => i.minStockAlert && i.currentStock <= i.minStockAlert);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Stok Yonetimi</h2>
        <Button onClick={() => { setEditing(null); setModal(true); }}>+ Hammadde Ekle</Button>
      </div>

      {lowStock.length > 0 && (
        <div className="bg-red-600/10 border border-red-600/30 rounded-xl p-4 mb-6">
          <h3 className="text-red-400 text-sm font-semibold mb-2">Dusuk Stok Uyarisi</h3>
          <div className="flex flex-wrap gap-2">
            {lowStock.map((i) => (
              <span key={i.id} className="bg-red-600/20 text-red-400 px-3 py-1 rounded-lg text-xs">
                {i.name}: {i.currentStock} {i.unit} (min: {i.minStockAlert})
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-white/40 text-xs">
              <th className="px-4 py-3 text-left">Hammadde</th>
              <th className="px-4 py-3 text-left">Birim</th>
              <th className="px-4 py-3 text-right">Birim Maliyet</th>
              <th className="px-4 py-3 text-right">Mevcut Stok</th>
              <th className="px-4 py-3 text-right">Min Stok</th>
              <th className="px-4 py-3 text-left">Tedarikci</th>
              <th className="px-4 py-3 text-right">Islem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ingredients.map((i) => {
              const isLow = i.minStockAlert && i.currentStock <= i.minStockAlert;
              return (
                <tr key={i.id} className={`hover:bg-surface-2 transition-colors ${isLow ? "bg-red-600/5" : ""}`}>
                  <td className="px-4 py-3 font-medium">{i.name}</td>
                  <td className="px-4 py-3 text-white/50">{i.unit}</td>
                  <td className="px-4 py-3 text-right">{i.unitCost.toFixed(2)} TL</td>
                  <td className={`px-4 py-3 text-right font-semibold ${isLow ? "text-red-400" : ""}`}>
                    {i.currentStock}
                  </td>
                  <td className="px-4 py-3 text-right text-white/40">{i.minStockAlert ?? "-"}</td>
                  <td className="px-4 py-3 text-white/50">{i.supplier || "-"}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => { setEditing(i); setModal(true); }} className="text-white/30 hover:text-white mr-2">✏️</button>
                    <button onClick={() => remove(i.id)} className="text-white/30 hover:text-red-400">🗑️</button>
                  </td>
                </tr>
              );
            })}
            {ingredients.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-white/30">Henuz hammadde eklenmedi</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modal} onClose={() => { setModal(false); setEditing(null); }} title={editing ? "Hammadde Duzenle" : "Yeni Hammadde"}>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="text-xs text-white/40 mb-1 block">Hammadde Adi</label>
            <input name="name" defaultValue={editing?.name || ""} className="input-field" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/40 mb-1 block">Birim (kg, lt, adet)</label>
              <input name="unit" defaultValue={editing?.unit || ""} className="input-field" required />
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1 block">Birim Maliyet (TL)</label>
              <input name="unitCost" type="number" step="0.01" defaultValue={editing?.unitCost || ""} className="input-field" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/40 mb-1 block">Mevcut Stok</label>
              <input name="currentStock" type="number" step="0.01" defaultValue={editing?.currentStock || 0} className="input-field" />
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1 block">Minimum Stok Uyarisi</label>
              <input name="minStockAlert" type="number" step="0.01" defaultValue={editing?.minStockAlert || ""} className="input-field" />
            </div>
          </div>
          <div>
            <label className="text-xs text-white/40 mb-1 block">Tedarikci</label>
            <input name="supplier" defaultValue={editing?.supplier || ""} className="input-field" />
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
