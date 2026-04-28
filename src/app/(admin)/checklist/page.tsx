"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

interface Shift {
  id: number;
  staffId: number;
  staffName: string | null;
  startTime: string;
  endTime: string | null;
  startCash: number;
  endCash: number | null;
}

interface ChecklistEntry {
  id: number;
  type: string;
  date: string;
  items: string;
}

interface StaffItem {
  id: number;
  name: string;
  isActive: boolean;
}

type Tab = "checklist" | "shifts";

export default function ChecklistPage() {
  const [tab, setTab] = useState<Tab>("checklist");
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [checklists, setChecklists] = useState<ChecklistEntry[]>([]);
  const [templates, setTemplates] = useState<{ opening: string[]; closing: string[] }>({ opening: [], closing: [] });
  const [staffList, setStaffList] = useState<StaffItem[]>([]);

  // Modals
  const [shiftModal, setShiftModal] = useState(false);
  const [checkModal, setCheckModal] = useState<"opening" | "closing" | null>(null);
  const [checkedItems, setCheckedItems] = useState<boolean[]>([]);
  const [editMode, setEditMode] = useState<"opening" | "closing" | null>(null);
  const [editItems, setEditItems] = useState<string[]>([]);
  const [newItem, setNewItem] = useState("");

  // Closing warning
  const [closingWarning, setClosingWarning] = useState(false);
  const [closingShiftId, setClosingShiftId] = useState<number | null>(null);
  const [endCashInput, setEndCashInput] = useState("");

  const load = useCallback(async () => {
    const [shiftsRes, checkRes, staffRes] = await Promise.all([
      fetch("/api/shifts"),
      fetch("/api/checklists"),
      fetch("/api/staff"),
    ]);
    setShifts(await shiftsRes.json());
    const checkData = await checkRes.json();
    setChecklists(checkData.lists);
    setTemplates(checkData.defaults);
    const staffData: StaffItem[] = await staffRes.json();
    setStaffList(staffData.filter((s) => s.isActive));
  }, []);

  useEffect(() => { load(); }, [load]);

  // --- Template editing ---
  function openEditMode(type: "opening" | "closing") {
    setEditItems([...(type === "opening" ? templates.opening : templates.closing)]);
    setEditMode(type);
    setNewItem("");
  }

  function addItem() {
    if (!newItem.trim()) return;
    setEditItems([...editItems, newItem.trim()]);
    setNewItem("");
  }

  function removeItem(index: number) {
    setEditItems(editItems.filter((_, i) => i !== index));
  }

  function duplicateItem(index: number) {
    const copy = [...editItems];
    copy.splice(index + 1, 0, editItems[index]);
    setEditItems(copy);
  }

  function moveItem(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= editItems.length) return;
    const copy = [...editItems];
    [copy[index], copy[target]] = [copy[target], copy[index]];
    setEditItems(copy);
  }

  async function saveTemplate() {
    if (!editMode) return;
    await fetch("/api/checklists", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [editMode]: editItems }),
    });
    setEditMode(null);
    load();
  }

  // --- Checklist fill ---
  function openChecklist(type: "opening" | "closing") {
    const items = type === "opening" ? templates.opening : templates.closing;
    setCheckedItems(new Array(items.length).fill(false));
    setCheckModal(type);
  }

  async function submitChecklist() {
    if (!checkModal) return;
    const items = checkModal === "opening" ? templates.opening : templates.closing;
    const result = items.map((item, i) => ({ item, checked: checkedItems[i] }));
    await fetch("/api/checklists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: checkModal, items: result }),
    });
    setCheckModal(null);
    load();
  }

  // --- Shifts ---
  async function startShift(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await fetch("/api/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        staffId: parseInt(fd.get("staffId") as string),
        startCash: parseFloat(fd.get("startCash") as string) || 0,
      }),
    });
    setShiftModal(false);
    load();
  }

  function triggerEndShift(shiftId: number) {
    setClosingShiftId(shiftId);
    setEndCashInput("");
    setCheckedItems(new Array(templates.closing.length).fill(false));
    setClosingWarning(true);
  }

  async function confirmEndShift() {
    if (!closingShiftId) return;

    const closingResult = templates.closing.map((item, i) => ({ item, checked: checkedItems[i] }));
    const unchecked = closingResult.filter((r) => !r.checked);

    if (unchecked.length > 0) {
      const ok = confirm(`${unchecked.length} madde tamamlanmadi:\n\n${unchecked.map((r) => "- " + r.item).join("\n")}\n\nYine de kapatmak istiyor musunuz?`);
      if (!ok) return;
    }

    await fetch("/api/checklists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "closing", items: closingResult }),
    });

    await fetch(`/api/shifts/${closingShiftId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endCash: parseFloat(endCashInput) || 0 }),
    });

    setClosingWarning(false);
    setClosingShiftId(null);
    load();
  }

  const openShifts = shifts.filter((s) => !s.endTime);
  const closedShifts = shifts.filter((s) => s.endTime);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Kontrol & Vardiya</h2>
        <div className="flex gap-2">
          {(["checklist", "shifts"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                tab === t ? "bg-accent text-black" : "bg-surface-2 text-white/40"
              }`}
            >
              {t === "checklist" ? "Kontrol Listesi" : "Vardiyalar"}
            </button>
          ))}
        </div>
      </div>

      {/* ===== CHECKLIST TAB ===== */}
      {tab === "checklist" && (
        <div>
          {/* Acilis / Kapanis cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {(["opening", "closing"] as const).map((type) => {
              const items = type === "opening" ? templates.opening : templates.closing;
              const color = type === "opening" ? "green" : "red";
              return (
                <div key={type} className="card">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className={`text-lg font-semibold text-${color}-400`}>
                      {type === "opening" ? "Acilis" : "Kapanis"} Listesi
                    </h3>
                    <button
                      onClick={() => openEditMode(type)}
                      className="text-xs text-white/30 hover:text-white transition-colors"
                    >
                      Duzenle
                    </button>
                  </div>
                  <div className="space-y-1">
                    {items.map((item, i) => (
                      <div key={i} className="text-sm text-white/50 flex items-center gap-2">
                        <span className="w-5 h-5 rounded border border-white/10 flex items-center justify-center text-xs text-white/20">{i + 1}</span>
                        {item}
                      </div>
                    ))}
                    {items.length === 0 && <p className="text-white/20 text-sm">Madde eklenmemis</p>}
                  </div>
                  <button
                    onClick={() => openChecklist(type)}
                    className={`mt-4 px-8 py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.97] flex items-center justify-center gap-2 mx-auto ${
                      type === "opening"
                        ? "bg-green-500 hover:bg-green-600 text-white"
                        : "bg-red-500 hover:bg-red-600 text-white"
                    }`}
                  >
                    <span className="text-lg leading-none">✓</span>
                    {type === "opening" ? "Acilis Listesini Doldur" : "Kapanis Listesini Doldur"}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Today's records */}
          {checklists.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold mb-3">Bugunun Kayitlari</h3>
              <div className="space-y-3">
                {checklists.map((c) => {
                  const items = JSON.parse(c.items) as { item: string; checked: boolean }[];
                  const done = items.filter((i) => i.checked).length;
                  return (
                    <div key={c.id} className="bg-surface-2 rounded-xl p-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className={`text-sm font-medium ${c.type === "opening" ? "text-green-400" : "text-red-400"}`}>
                          {c.type === "opening" ? "Acilis" : "Kapanis"}
                        </span>
                        <span className="text-xs text-white/40">{done}/{items.length}</span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${c.type === "opening" ? "bg-green-500" : "bg-red-500"}`}
                          style={{ width: `${(done / items.length) * 100}%` }}
                        />
                      </div>
                      <div className="mt-2 space-y-1">
                        {items.map((it, i) => (
                          <div key={i} className={`text-xs flex items-center gap-2 ${it.checked ? "text-white/40" : "text-red-400"}`}>
                            <span>{it.checked ? "✓" : "✗"}</span>
                            <span className={it.checked ? "line-through" : ""}>{it.item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== SHIFTS TAB ===== */}
      {tab === "shifts" && (
        <div>
          <div className="flex justify-end mb-4">
            <Button onClick={() => setShiftModal(true)}>+ Vardiya Baslat</Button>
          </div>

          {openShifts.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3 text-green-400">Aktif Vardiyalar</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {openShifts.map((s) => (
                  <div key={s.id} className="card border border-green-500/20">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-semibold">{s.staffName || "Personel #" + s.staffId}</h4>
                        <p className="text-xs text-white/40">Baslangic: {s.startTime.split(" ")[1]?.slice(0, 5)}</p>
                      </div>
                      <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded">AKTIF</span>
                    </div>
                    <p className="text-sm text-white/40 mb-3">Acilis kasa: {s.startCash.toFixed(2)} TL</p>
                    <Button variant="danger" className="w-full" onClick={() => triggerEndShift(s.id)}>
                      Vardiya Bitir
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-white/40 text-xs">
                  <th className="px-4 py-3 text-left">Personel</th>
                  <th className="px-4 py-3 text-left">Baslangic</th>
                  <th className="px-4 py-3 text-left">Bitis</th>
                  <th className="px-4 py-3 text-right">Acilis Kasa</th>
                  <th className="px-4 py-3 text-right">Kapanis Kasa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {closedShifts.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-2">
                    <td className="px-4 py-3 font-medium">{s.staffName || "-"}</td>
                    <td className="px-4 py-3 text-white/50">{s.startTime}</td>
                    <td className="px-4 py-3 text-white/50">{s.endTime}</td>
                    <td className="px-4 py-3 text-right">{s.startCash.toFixed(2)} TL</td>
                    <td className="px-4 py-3 text-right">{s.endCash?.toFixed(2) || "-"} TL</td>
                  </tr>
                ))}
                {closedShifts.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-white/30">Tamamlanmis vardiya yok</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== FILL CHECKLIST MODAL ===== */}
      <Modal
        open={!!checkModal}
        onClose={() => setCheckModal(null)}
        title={checkModal === "opening" ? "Acilis Kontrol Listesi" : "Kapanis Kontrol Listesi"}
      >
        <div className="space-y-2">
          {(checkModal === "opening" ? templates.opening : templates.closing).map((item, i) => (
            <label key={i} className="flex items-center gap-3 p-3 bg-surface-2 rounded-xl cursor-pointer hover:bg-white/[0.06] transition-colors">
              <input
                type="checkbox"
                checked={checkedItems[i] || false}
                onChange={() => {
                  const next = [...checkedItems];
                  next[i] = !next[i];
                  setCheckedItems(next);
                }}
                className="w-5 h-5 rounded accent-accent"
              />
              <span className={checkedItems[i] ? "text-white" : "text-white/50"}>{item}</span>
            </label>
          ))}
          <div className="flex gap-2 justify-end pt-3">
            <Button variant="secondary" onClick={() => setCheckModal(null)}>Iptal</Button>
            <Button onClick={submitChecklist}>Kaydet</Button>
          </div>
        </div>
      </Modal>

      {/* ===== EDIT TEMPLATE MODAL ===== */}
      <Modal
        open={!!editMode}
        onClose={() => setEditMode(null)}
        title={`${editMode === "opening" ? "Acilis" : "Kapanis"} Listesi Duzenle`}
      >
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {editItems.map((item, i) => (
            <div key={i} className="flex items-center gap-2 bg-surface-2 rounded-xl p-2">
              <span className="text-xs text-white/20 w-5 text-center">{i + 1}</span>
              <input
                value={item}
                onChange={(e) => {
                  const copy = [...editItems];
                  copy[i] = e.target.value;
                  setEditItems(copy);
                }}
                className="input-field flex-1 !py-2 !text-sm"
              />
              <button onClick={() => moveItem(i, -1)} className="text-white/20 hover:text-white text-sm px-1" title="Yukari">↑</button>
              <button onClick={() => moveItem(i, 1)} className="text-white/20 hover:text-white text-sm px-1" title="Asagi">↓</button>
              <button onClick={() => duplicateItem(i)} className="text-white/20 hover:text-blue-400 text-sm px-1" title="Cogalt">⧉</button>
              <button onClick={() => removeItem(i)} className="text-white/20 hover:text-red-400 text-sm px-1" title="Sil">✕</button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem())}
            placeholder="Yeni madde ekle..."
            className="input-field flex-1 !py-2 !text-sm"
          />
          <Button size="sm" onClick={addItem}>Ekle</Button>
        </div>
        <div className="flex gap-2 justify-end pt-4">
          <Button variant="secondary" onClick={() => setEditMode(null)}>Iptal</Button>
          <Button onClick={saveTemplate}>Sablonu Kaydet</Button>
        </div>
      </Modal>

      {/* ===== CLOSING WARNING MODAL ===== */}
      <Modal
        open={closingWarning}
        onClose={() => { setClosingWarning(false); setClosingShiftId(null); }}
        title="Vardiya Kapatma"
      >
        <div className="bg-red-600/10 border border-red-600/30 rounded-xl p-4 mb-4">
          <h4 className="text-red-400 font-semibold mb-1">Kapanis Kontrol Listesi</h4>
          <p className="text-red-400/60 text-xs">Vardiyanizi kapatmadan once kontrol listesini doldurun</p>
        </div>

        <div className="space-y-2 mb-4 max-h-[35vh] overflow-y-auto">
          {templates.closing.map((item, i) => (
            <label key={i} className="flex items-center gap-3 p-3 bg-surface-2 rounded-xl cursor-pointer hover:bg-white/[0.06] transition-colors">
              <input
                type="checkbox"
                checked={checkedItems[i] || false}
                onChange={() => {
                  const next = [...checkedItems];
                  next[i] = !next[i];
                  setCheckedItems(next);
                }}
                className="w-5 h-5 rounded accent-accent"
              />
              <span className={checkedItems[i] ? "text-white" : "text-white/50"}>{item}</span>
            </label>
          ))}
        </div>

        <div className="mb-4">
          <label className="text-xs text-white/40 mb-1 block">Kapanis Kasa Tutari (TL)</label>
          <input
            type="number"
            step="0.01"
            value={endCashInput}
            onChange={(e) => setEndCashInput(e.target.value)}
            className="input-field"
            placeholder="0.00"
          />
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => { setClosingWarning(false); setClosingShiftId(null); }}>Iptal</Button>
          <Button variant="danger" onClick={confirmEndShift}>Vardiyayi Kapat</Button>
        </div>
      </Modal>

      {/* ===== START SHIFT MODAL ===== */}
      <Modal open={shiftModal} onClose={() => setShiftModal(false)} title="Vardiya Baslat">
        <form onSubmit={startShift} className="space-y-4">
          <div>
            <label className="text-xs text-white/40 mb-1 block">Personel</label>
            <select name="staffId" className="input-field" required>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-white/40 mb-1 block">Acilis Kasa Tutari (TL)</label>
            <input name="startCash" type="number" step="0.01" className="input-field" defaultValue="0" />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" type="button" onClick={() => setShiftModal(false)}>Iptal</Button>
            <Button type="submit">Vardiyi Baslat</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
