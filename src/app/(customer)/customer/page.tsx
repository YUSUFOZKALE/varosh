"use client";

import { useState, useEffect, useCallback } from "react";
import { usePublicSettings } from "@/hooks/use-public-settings";

interface Category {
  id: number;
  name: string;
  sortOrder: number;
}

interface MenuItem {
  id: number;
  name: string;
  description: string | null;
  price: number;
  categoryId: number;
  isAvailable: boolean;
  imageUrl: string | null;
}

export default function CustomerMenuPage() {
  const ps = usePublicSettings();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);

  const load = useCallback(async () => {
    const [catRes, itemRes] = await Promise.all([
      fetch("/api/menu/categories"),
      fetch("/api/menu/items"),
    ]);
    const cats: Category[] = await catRes.json();
    const allItems: MenuItem[] = await itemRes.json();
    setCategories(cats);
    setItems(allItems.filter((i) => i.isAvailable));
    if (cats.length > 0 && !activeCategory) setActiveCategory(cats[0].id);
  }, [activeCategory]);

  useEffect(() => { load(); }, [load]);

  const filtered = activeCategory
    ? items.filter((i) => i.categoryId === activeCategory)
    : items;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-amber-500 text-white text-center py-6 px-4">
        <h1 className="text-2xl font-bold">{ps.businessName}</h1>
        <p className="text-amber-100 text-sm mt-1">Menu</p>
      </div>

      {/* Category Tabs */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
        <div className="flex overflow-x-auto px-4 py-3 gap-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                activeCategory === cat.id
                  ? "bg-amber-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Items */}
      <div className="p-4 space-y-3">
        {filtered.map((item) => (
          <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {item.imageUrl && (
              <img src={item.imageUrl} alt={item.name} className="w-full h-44 object-cover" />
            )}
            <div className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{item.name}</h3>
                  {item.description && (
                    <p className="text-gray-500 text-sm mt-1">{item.description}</p>
                  )}
                </div>
                <span className="text-lg font-bold text-amber-600 ml-4 shrink-0">
                  {item.price.toFixed(2)} TL
                </span>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-gray-400 py-8">Bu kategoride urun yok</p>
        )}
      </div>

      {/* Footer */}
      <div className="text-center py-6 text-gray-300 text-xs">
        {ps.businessName} &copy; {new Date().getFullYear()}
      </div>
    </div>
  );
}
