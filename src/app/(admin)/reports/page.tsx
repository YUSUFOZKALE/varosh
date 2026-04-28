"use client";

import { useState, useEffect, useCallback } from "react";

interface DailyData {
  date: string;
  orders: number;
  revenue: number;
  cancelled: number;
  avgOrder: number;
}

interface ProductData {
  name: string;
  totalQuantity: number;
  totalRevenue: number;
  orderCount: number;
}

interface HourlyData {
  hour: number;
  orders: number;
  revenue: number;
}

type Tab = "revenue" | "products" | "hourly";

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("revenue");
  const [period, setPeriod] = useState("7");
  const [daily, setDaily] = useState<DailyData[]>([]);
  const [totals, setTotals] = useState({ totalOrders: 0, totalRevenue: 0, avgDaily: 0 });
  const [products, setProducts] = useState<ProductData[]>([]);
  const [hourly, setHourly] = useState<HourlyData[]>([]);

  const load = useCallback(async () => {
    const [revRes, prodRes, hourRes] = await Promise.all([
      fetch(`/api/reports/revenue?period=${period}`),
      fetch(`/api/reports/products?period=${period}`),
      fetch(`/api/reports/hourly?period=${period}`),
    ]);
    const revData = await revRes.json();
    setDaily(revData.daily);
    setTotals(revData.totals);
    setProducts(await prodRes.json());
    setHourly(await hourRes.json());
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const maxRevenue = Math.max(...daily.map((d) => d.revenue), 1);
  const maxHourlyOrders = Math.max(...hourly.map((h) => h.orders), 1);
  const maxProductQty = Math.max(...products.map((p) => p.totalQuantity), 1);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Raporlar</h2>
        <div className="flex gap-2">
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className="input-field w-32">
            <option value="7">Son 7 Gun</option>
            <option value="14">Son 14 Gun</option>
            <option value="30">Son 30 Gun</option>
            <option value="90">Son 90 Gun</option>
          </select>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {(["revenue", "products", "hourly"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === t ? "bg-accent text-black" : "bg-surface-2 text-white/40 hover:text-white"
            }`}
          >
            {t === "revenue" ? "Ciro" : t === "products" ? "Urunler" : "Saatlik"}
          </button>
        ))}
      </div>

      {/* Revenue Tab */}
      {tab === "revenue" && (
        <div>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="card text-center">
              <p className="text-3xl font-bold">{totals.totalOrders}</p>
              <p className="text-xs text-white/40 mt-1">Toplam Siparis</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-green-400">{totals.totalRevenue.toFixed(0)}</p>
              <p className="text-xs text-white/40 mt-1">Toplam Ciro (TL)</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-accent">{totals.avgDaily.toFixed(0)}</p>
              <p className="text-xs text-white/40 mt-1">Gunluk Ort. (TL)</p>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Gunluk Ciro</h3>
            <div className="space-y-2">
              {daily.map((d) => (
                <div key={d.date} className="flex items-center gap-3">
                  <span className="text-xs text-white/40 w-20 shrink-0">{d.date.slice(5)}</span>
                  <div className="flex-1 h-7 bg-surface-2 rounded-lg overflow-hidden relative">
                    <div
                      className="h-full bg-accent/60 rounded-lg transition-all"
                      style={{ width: `${(d.revenue / maxRevenue) * 100}%` }}
                    />
                    <span className="absolute inset-0 flex items-center px-2 text-xs font-medium">
                      {d.revenue.toFixed(0)} TL — {d.orders} siparis
                    </span>
                  </div>
                </div>
              ))}
              {daily.length === 0 && <p className="text-white/30 text-center py-4">Veri yok</p>}
            </div>
          </div>
        </div>
      )}

      {/* Products Tab */}
      {tab === "products" && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">En Cok Satan Urunler</h3>
          <div className="space-y-3">
            {products.map((p, i) => (
              <div key={p.name} className="flex items-center gap-3">
                <span className="text-white/30 text-sm w-6 text-right">{i + 1}</span>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-sm">{p.name}</span>
                    <span className="text-xs text-white/40">{p.totalQuantity} adet — {p.totalRevenue.toFixed(0)} TL</span>
                  </div>
                  <div className="h-3 bg-surface-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all"
                      style={{ width: `${(p.totalQuantity / maxProductQty) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
            {products.length === 0 && <p className="text-white/30 text-center py-4">Urun verisi yok</p>}
          </div>
        </div>
      )}

      {/* Hourly Tab */}
      {tab === "hourly" && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Saatlik Yogunluk</h3>
          <div className="flex items-end gap-1 h-48">
            {Array.from({ length: 24 }, (_, h) => {
              const data = hourly.find((d) => d.hour === h);
              const height = data ? (data.orders / maxHourlyOrders) * 100 : 0;
              return (
                <div key={h} className="flex-1 flex flex-col items-center group relative">
                  <div
                    className="w-full bg-accent/60 rounded-t transition-all min-h-[2px] hover:bg-accent"
                    style={{ height: `${Math.max(height, 2)}%` }}
                  />
                  {data && data.orders > 0 && (
                    <div className="hidden group-hover:block absolute -top-10 bg-surface-1 border border-border rounded-lg px-2 py-1 text-xs whitespace-nowrap z-10">
                      {data.orders} siparis — {data.revenue.toFixed(0)} TL
                    </div>
                  )}
                  <span className="text-[10px] text-white/20 mt-1">{h}</span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-xs text-white/20">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>23:00</span>
          </div>
        </div>
      )}
    </div>
  );
}
