"use client";

import { useState, useEffect } from "react";

export interface MenuItemOption {
  id: number;
  menuItemId: number;
  groupName: string;
  optionName: string;
  priceModifier: number;
  isDefault: boolean;
}

interface MenuItem {
  id: number;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
}

export interface CustomizedItem {
  menuItemId: number;
  name: string;
  basePrice: number;
  finalPrice: number;
  quantity: number;
  imageUrl: string | null;
  removedIngredients: string[];
  selectedExtras: number[];
  extrasCost: number;
  notes: string;
}

interface Props {
  item: MenuItem | null;
  options: MenuItemOption[];
  onClose: () => void;
  onAdd: (item: CustomizedItem) => void;
}

function CustomizeContent({ item, options, onClose, onAdd }: Props & { item: MenuItem }) {
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [extras, setExtras] = useState<Set<number>>(new Set());
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setRemoved(new Set());
    setExtras(new Set());
    setQty(1);
    setNotes("");
  }, [item.id]);

  const itemOptions = options.filter((o) => o.menuItemId === item.id);
  const ingredients = itemOptions.filter((o) => o.groupName === "Icindekiler");
  const extraOptions = itemOptions.filter((o) => o.groupName === "Ekstralar");

  const extrasCost = extraOptions
    .filter((o) => extras.has(o.id))
    .reduce((sum, o) => sum + o.priceModifier, 0);
  const unitPrice = item.price + extrasCost;
  const totalPrice = unitPrice * qty;

  function toggleIngredient(name: string) {
    setRemoved((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }

  function toggleExtra(id: number) {
    setExtras((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleAdd() {
    onAdd({
      menuItemId: item.id,
      name: item.name,
      basePrice: item.price,
      finalPrice: unitPrice,
      quantity: qty,
      imageUrl: item.imageUrl,
      removedIngredients: Array.from(removed),
      selectedExtras: Array.from(extras),
      extrasCost,
      notes: notes.trim(),
    });
    onClose();
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        {item.imageUrl && (
          <img src={item.imageUrl} alt={item.name} className="w-16 h-16 rounded-xl object-cover shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-white text-base leading-tight">{item.name}</h3>
          {item.description && <p className="text-white/30 text-xs mt-0.5 line-clamp-2">{item.description}</p>}
          <p className="text-amber-400 font-extrabold text-lg mt-1">{item.price} TL</p>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 bg-neutral-800 rounded-lg flex items-center justify-center text-white/40 hover:text-white shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Ingredients */}
      {ingredients.length > 0 && (
        <div className="mb-3">
          <p className="text-[11px] font-bold text-white/40 mb-1.5 uppercase tracking-wide">Icindekiler</p>
          <div className="flex flex-wrap gap-1.5">
            {ingredients.map((ing) => {
              const isRemoved = removed.has(ing.optionName);
              return (
                <button
                  key={ing.id}
                  onClick={() => toggleIngredient(ing.optionName)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isRemoved
                      ? "bg-red-500/15 text-red-400/60 line-through border border-red-500/20"
                      : "bg-neutral-800/80 text-white/70 border border-neutral-700/50 hover:border-red-500/30"
                  }`}
                >
                  {isRemoved && <span className="mr-1">✕</span>}
                  {ing.optionName}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Extras */}
      {extraOptions.length > 0 && (
        <div className="mb-3">
          <p className="text-[11px] font-bold text-white/40 mb-1.5 uppercase tracking-wide">Ekstralar</p>
          <div className="flex flex-wrap gap-1.5">
            {extraOptions.map((ext) => {
              const isSelected = extras.has(ext.id);
              return (
                <button
                  key={ext.id}
                  onClick={() => toggleExtra(ext.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      : "bg-neutral-800/80 text-white/70 border border-neutral-700/50 hover:border-amber-500/30"
                  }`}
                >
                  {ext.optionName}
                  <span className={`${isSelected ? "text-amber-400" : "text-white/30"}`}>+{ext.priceModifier}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="mb-3">
        <p className="text-[11px] font-bold text-white/40 mb-1.5 uppercase tracking-wide">Not</p>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Az pismis, bol soslu..."
          className="w-full bg-neutral-800/60 text-white rounded-lg px-3 py-2 text-xs border border-neutral-700/50 focus:outline-none focus:border-amber-500/40 placeholder:text-white/20"
        />
      </div>

      {/* Qty + Add */}
      <div className="flex items-center justify-between pt-2 border-t border-neutral-800/60">
        <div className="flex items-center gap-0 bg-neutral-800 rounded-full">
          <button
            onClick={() => setQty(Math.max(1, qty - 1))}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/80 active:bg-neutral-700 text-sm"
          >
            −
          </button>
          <span className="text-white font-bold text-sm min-w-[24px] text-center">{qty}</span>
          <button
            onClick={() => setQty(qty + 1)}
            className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-black active:bg-amber-400 text-sm font-bold"
          >
            +
          </button>
        </div>
        <button
          onClick={handleAdd}
          className="px-5 py-2.5 rounded-xl bg-amber-500 text-black font-bold text-sm active:scale-[0.97] transition-transform shadow-lg shadow-amber-500/20"
        >
          Ekle &middot; {totalPrice.toFixed(0)} TL
        </button>
      </div>
    </>
  );
}

export default function ItemCustomizeModal({ item, options, onClose, onAdd }: Props) {
  if (!item) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex flex-col">
        <div className="flex-1 bg-black/60" onClick={onClose} />
        <div className="bg-neutral-900 border-t border-amber-500/30 rounded-t-2xl p-4 max-h-[70vh] overflow-y-auto max-w-sm mx-auto w-full animate-slide-up">
          <CustomizeContent item={item} options={options} onClose={onClose} onAdd={onAdd} />
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.25s ease-out;
        }
      `}</style>
    </>
  );
}

export function InlineCustomizePanel({ item, options, onClose, onAdd }: Props) {
  if (!item) return null;
  return (
    <div className="bg-neutral-900 border border-neutral-800/60 rounded-2xl p-4 animate-fade-in">
      <CustomizeContent item={item} options={options} onClose={onClose} onAdd={onAdd} />
      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
