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
}

interface Props {
  item: MenuItem | null;
  options: MenuItemOption[];
  onClose: () => void;
  onAdd: (item: CustomizedItem) => void;
}

export default function ItemCustomizeModal({ item, options, onClose, onAdd }: Props) {
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [extras, setExtras] = useState<Set<number>>(new Set());
  const [qty, setQty] = useState(1);

  useEffect(() => {
    setRemoved(new Set());
    setExtras(new Set());
    setQty(1);
  }, [item?.id]);

  if (!item) return null;

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
    if (!item) return;
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
    });
    onClose();
  }

  const hasCustomization = ingredients.length > 0 || extraOptions.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <div className="flex-1 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-neutral-900 rounded-t-3xl max-h-[90vh] flex flex-col animate-slide-up">
        {/* Product Header */}
        <div className="shrink-0">
          {item.imageUrl && (
            <div className="relative">
              <img src={item.imageUrl} alt={item.name} className="w-full h-48 object-cover rounded-t-3xl" />
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-transparent to-transparent" />
              <button
                onClick={onClose}
                className="absolute top-3 right-3 w-9 h-9 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          )}
          <div className="px-5 pt-4 pb-3 flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white">{item.name}</h2>
              {item.description && (
                <p className="text-white/40 text-sm mt-1">{item.description}</p>
              )}
            </div>
            {!item.imageUrl && (
              <button
                onClick={onClose}
                className="w-9 h-9 bg-neutral-800 rounded-full flex items-center justify-center text-white/40 shrink-0 ml-3"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        </div>

        {/* Customization Options */}
        {hasCustomization && (
          <div className="flex-1 overflow-y-auto px-5">
            {/* Ingredients (removable) */}
            {ingredients.length > 0 && (
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">🥗</span>
                  <h3 className="text-sm font-bold text-white/70">Icindekiler</h3>
                  <span className="text-[10px] text-white/30 bg-neutral-800 px-2 py-0.5 rounded-full">cikarabilirsiniz</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {ingredients.map((ing) => {
                    const isRemoved = removed.has(ing.optionName);
                    return (
                      <button
                        key={ing.id}
                        onClick={() => toggleIngredient(ing.optionName)}
                        className={`flex items-center gap-2.5 px-3.5 py-3 rounded-xl border transition-all text-left ${
                          isRemoved
                            ? "bg-red-500/10 border-red-500/30 line-through"
                            : "bg-neutral-800/50 border-neutral-700/50"
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                          isRemoved
                            ? "border-red-500/50 bg-red-500/20"
                            : "border-green-500/50 bg-green-500/20"
                        }`}>
                          {isRemoved ? (
                            <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                          ) : (
                            <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          )}
                        </div>
                        <span className={`text-sm ${isRemoved ? "text-white/30" : "text-white/80"}`}>
                          {ing.optionName}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Extras (addable with price) */}
            {extraOptions.length > 0 && (
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">✨</span>
                  <h3 className="text-sm font-bold text-white/70">Ekstralar</h3>
                </div>
                <div className="space-y-2">
                  {extraOptions.map((ext) => {
                    const isSelected = extras.has(ext.id);
                    return (
                      <button
                        key={ext.id}
                        onClick={() => toggleExtra(ext.id)}
                        className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border transition-all text-left ${
                          isSelected
                            ? "bg-amber-500/10 border-amber-500/40"
                            : "bg-neutral-800/50 border-neutral-700/50"
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                          isSelected
                            ? "border-amber-500 bg-amber-500"
                            : "border-neutral-600 bg-transparent"
                        }`}>
                          {isSelected && (
                            <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          )}
                        </div>
                        <span className={`text-sm flex-1 ${isSelected ? "text-white" : "text-white/70"}`}>
                          {ext.optionName}
                        </span>
                        <span className={`text-sm font-bold ${isSelected ? "text-amber-400" : "text-white/30"}`}>
                          +{ext.priceModifier} TL
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quantity + Add Button */}
        <div className="shrink-0 border-t border-neutral-800/80 p-5 bg-neutral-900">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-0 bg-neutral-800 rounded-full">
              <button
                onClick={() => setQty(Math.max(1, qty - 1))}
                className="w-10 h-10 rounded-full flex items-center justify-center text-white/80 active:bg-neutral-700"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" /></svg>
              </button>
              <span className="text-white font-bold text-lg min-w-[32px] text-center">{qty}</span>
              <button
                onClick={() => setQty(qty + 1)}
                className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-black active:bg-amber-400"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
              </button>
            </div>
            <div className="text-right">
              {extrasCost > 0 && (
                <p className="text-white/30 text-xs line-through">{(item.price * qty).toFixed(0)} TL</p>
              )}
              <p className="text-amber-400 font-extrabold text-xl">{totalPrice.toFixed(0)} TL</p>
            </div>
          </div>
          <button
            onClick={handleAdd}
            className="w-full py-4 rounded-2xl bg-amber-500 text-black font-extrabold text-base active:scale-[0.98] transition-transform shadow-lg shadow-amber-500/20"
          >
            Sepete Ekle &middot; {totalPrice.toFixed(0)} TL
          </button>
        </div>
      </div>

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
