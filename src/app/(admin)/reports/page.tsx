"use client";

import { useState, useEffect, useCallback } from "react";

/* ═══════════════ TYPES ═══════════════ */

interface OverviewData {
  current: { revenue: number; orders: number; avgOrder: number; cancelled: number; discount: number; deliveryFees: number };
  previous: { revenue: number; orders: number; avgOrder: number; cancelled: number };
  growth: { revenue: number; orders: number; avgOrder: number };
  sources: { source: string; count: number; revenue: number }[];
  payments: { method: string; count: number; total: number }[];
  orderTypes: { dineIn: number; delivery: number; takeaway: number };
  topProduct: { name: string; quantity: number; revenue: number } | null;
  peakHour: number | null;
  recentDaily: { date: string; revenue: number; orders: number }[];
  period: number;
}

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
  avgPrice: number;
  revenuePercent: number;
  quantityPercent: number;
  growth: number;
}

interface HourlyData { hour: number; orders: number; revenue: number }
interface WeekdayData { day: number; orders: number; revenue: number; avgOrder: number }
interface HeatmapData { day: number; hour: number; orders: number }

interface AnalysisGroup {
  key: string;
  label: string;
  products: { name: string; quantity: number; revenue: number }[];
  totalQuantity: number;
  totalRevenue: number;
}

type AnalysisView = "hourly" | "daily" | "weekly" | "monthly" | "seasonal" | "yearly";

interface ProfitData {
  revenue: number;
  collected: number;
  expenses: { total: number; byCategory: { category: string; total: number; count: number }[] };
  profit: number;
  margin: number;
  growth: { revenue: number; expense: number; profit: number };
  daily: { date: string; revenue: number; expense: number; profit: number }[];
  period: number;
}

type Tab = "overview" | "revenue" | "products" | "time" | "profit";

const SOURCE_LABELS: Record<string, string> = {
  manual: "Mekan", whatsapp: "WhatsApp", phone: "Telefon", walk_in: "Gel-Al", qr: "QR", yemeksepeti: "Yemeksepeti", getir: "Getir",
};
const DAY_NAMES = ["Paz", "Pzt", "Sal", "Car", "Per", "Cum", "Cmt"];
const DAY_NAMES_FULL = ["Pazar", "Pazartesi", "Sali", "Carsamba", "Persembe", "Cuma", "Cumartesi"];

/* ═══════════════ HELPERS ═══════════════ */

function GrowthBadge({ value, suffix = "%" }: { value: number; suffix?: string }) {
  if (value === 0) return <span className="text-white/20 text-[10px]">--</span>;
  const up = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${up ? "text-green-400" : "text-red-400"}`}>
      <svg className={`w-3 h-3 ${up ? "" : "rotate-180"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" /></svg>
      {Math.abs(value).toFixed(1)}{suffix}
    </span>
  );
}

function KpiCard({ title, value, subtitle, growth, color = "text-white" }: { title: string; value: string; subtitle?: string; growth?: number; color?: string }) {
  return (
    <div className="card p-4">
      <p className="text-[11px] text-white/40 font-medium mb-1">{title}</p>
      <p className={`text-2xl sm:text-3xl font-extrabold ${color} leading-none`}>{value}</p>
      <div className="flex items-center justify-between mt-2">
        {subtitle && <span className="text-[10px] text-white/25">{subtitle}</span>}
        {growth !== undefined && <GrowthBadge value={growth} />}
      </div>
    </div>
  );
}

function ProgressBar({ value, max, color = "bg-accent" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="h-2.5 bg-surface-2 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

function MiniChart({ data, height = 48 }: { data: number[]; height?: number }) {
  if (data.length === 0) return null;
  const max = Math.max(...data, 1);
  const points = data.map((v, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * 100;
    const y = 100 - (v / max) * 100;
    return `${x},${y}`;
  }).join(" ");
  const areaPoints = `0,100 ${points} 100,100`;
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height }} className="w-full">
      <polygon points={areaPoints} fill="url(#chartGrad)" opacity="0.3" />
      <polyline points={points} fill="none" stroke="#f59e0b" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ═══════════════ MAIN ═══════════════ */

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [period, setPeriod] = useState("7");

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [daily, setDaily] = useState<DailyData[]>([]);
  const [totals, setTotals] = useState({ totalOrders: 0, totalRevenue: 0, avgDaily: 0 });
  const [products, setProducts] = useState<ProductData[]>([]);
  const [grandTotal, setGrandTotal] = useState({ revenue: 0, quantity: 0 });
  const [hourly, setHourly] = useState<HourlyData[]>([]);
  const [weekday, setWeekday] = useState<WeekdayData[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapData[]>([]);
  const [profitData, setProfitData] = useState<ProfitData | null>(null);
  const [analysisView, setAnalysisView] = useState<AnalysisView>("hourly");
  const [analysisGroups, setAnalysisGroups] = useState<AnalysisGroup[]>([]);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ovRes, revRes, prodRes, hourRes, profRes, analysisRes] = await Promise.all([
        fetch(`/api/reports/overview?period=${period}`),
        fetch(`/api/reports/revenue?period=${period}`),
        fetch(`/api/reports/products?period=${period}`),
        fetch(`/api/reports/hourly?period=${period}`),
        fetch(`/api/reports/profitability?period=${period}`),
        fetch(`/api/reports/products/analysis?view=${analysisView}&period=${period}`),
      ]);
      const ovData = await ovRes.json();
      setOverview(ovData);
      const revData = await revRes.json();
      setDaily(revData.daily);
      setTotals(revData.totals);
      const prodData = await prodRes.json();
      setProducts(prodData.products);
      setGrandTotal(prodData.grandTotal);
      const hourData = await hourRes.json();
      setHourly(hourData.hourly);
      setWeekday(hourData.weekday);
      setHeatmap(hourData.heatmap);
      setProfitData(await profRes.json());
      const aData = await analysisRes.json();
      setAnalysisGroups(aData.groups || []);
      setExpandedGroup(aData.groups?.[0]?.key || null);
    } catch {}
    setLoading(false);
  }, [period, analysisView]);

  useEffect(() => { load(); }, [load]);

  const maxRevenue = Math.max(...daily.map((d) => d.revenue), 1);
  const maxHourlyOrders = Math.max(...hourly.map((h) => h.orders), 1);
  const maxProductQty = Math.max(...products.map((p) => p.totalQuantity), 1);
  const maxWeekdayOrders = Math.max(...weekday.map((w) => w.orders), 1);
  const maxHeatmap = Math.max(...heatmap.map((h) => h.orders), 1);

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "overview", label: "Genel", icon: "Dashboard" },
    { key: "revenue", label: "Ciro", icon: "Revenue" },
    { key: "products", label: "Urunler", icon: "Products" },
    { key: "time", label: "Zaman", icon: "Time" },
    { key: "profit", label: "Karlilik", icon: "Profit" },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-2xl font-bold">Raporlar & Analiz</h2>
          <p className="text-xs text-white/30 mt-0.5">Isletme performansinizi analiz edin</p>
        </div>
        <select value={period} onChange={(e) => setPeriod(e.target.value)} className="input-field w-36 text-sm">
          <option value="7">Son 7 Gun</option>
          <option value="14">Son 14 Gun</option>
          <option value="30">Son 30 Gun</option>
          <option value="90">Son 90 Gun</option>
        </select>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-surface-2 rounded-xl p-1 mb-6 overflow-x-auto">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
              tab === key ? "bg-accent text-black" : "text-white/40 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <div className="text-center py-12 text-white/30">Yukleniyor...</div>}

      {/* ═══════════════ GENEL BAKIS ═══════════════ */}
      {!loading && tab === "overview" && overview && (
        <div className="space-y-6">
          {/* KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <KpiCard
              title="Toplam Ciro"
              value={`${overview.current.revenue.toFixed(0)} TL`}
              subtitle={`Onceki: ${overview.previous.revenue.toFixed(0)} TL`}
              growth={overview.growth.revenue}
              color="text-green-400"
            />
            <KpiCard
              title="Siparis Sayisi"
              value={String(overview.current.orders)}
              subtitle={`Onceki: ${overview.previous.orders}`}
              growth={overview.growth.orders}
              color="text-blue-400"
            />
            <KpiCard
              title="Ortalama Siparis"
              value={`${overview.current.avgOrder.toFixed(1)} TL`}
              subtitle={`Onceki: ${overview.previous.avgOrder.toFixed(1)} TL`}
              growth={overview.growth.avgOrder}
              color="text-accent"
            />
            <KpiCard
              title="Iptal Orani"
              value={`%${overview.current.orders > 0 ? ((overview.current.cancelled / (overview.current.orders + overview.current.cancelled)) * 100).toFixed(1) : "0"}`}
              subtitle={`${overview.current.cancelled} iptal`}
              color={overview.current.cancelled > 0 ? "text-red-400" : "text-green-400"}
            />
          </div>

          {/* Mini Trend + Quick Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Revenue Trend */}
            <div className="card lg:col-span-2 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Ciro Trendi</h3>
                <span className="text-[10px] text-white/30">Son {overview.recentDaily.length} gun</span>
              </div>
              <MiniChart data={overview.recentDaily.map((d) => d.revenue)} height={120} />
              <div className="flex justify-between mt-2 text-[10px] text-white/20">
                {overview.recentDaily.length > 0 && <span>{overview.recentDaily[0].date.slice(5)}</span>}
                {overview.recentDaily.length > 1 && <span>{overview.recentDaily[overview.recentDaily.length - 1].date.slice(5)}</span>}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="space-y-3">
              <div className="card p-4">
                <p className="text-[10px] text-white/40 mb-1">En Cok Satan</p>
                {overview.topProduct ? (
                  <>
                    <p className="text-lg font-bold text-white leading-tight">{overview.topProduct.name}</p>
                    <p className="text-[11px] text-white/30 mt-1">{overview.topProduct.quantity} adet &middot; {overview.topProduct.revenue.toFixed(0)} TL</p>
                  </>
                ) : <p className="text-white/20 text-sm">Veri yok</p>}
              </div>
              <div className="card p-4">
                <p className="text-[10px] text-white/40 mb-1">Yogun Saat</p>
                <p className="text-lg font-bold text-accent">{overview.peakHour !== null ? `${String(overview.peakHour).padStart(2, "0")}:00` : "--"}</p>
              </div>
              <div className="card p-4">
                <p className="text-[10px] text-white/40 mb-1">Gunluk Ortalama</p>
                <p className="text-lg font-bold text-white">{overview.recentDaily.length > 0 ? (overview.current.revenue / overview.recentDaily.length).toFixed(0) : 0} TL</p>
                <p className="text-[10px] text-white/20 mt-0.5">{overview.recentDaily.length > 0 ? Math.round(overview.current.orders / overview.recentDaily.length) : 0} siparis/gun</p>
              </div>
            </div>
          </div>

          {/* Source + Payment + Order Type Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Sources */}
            <div className="card p-4">
              <h3 className="text-sm font-semibold mb-3">Siparis Kaynaklari</h3>
              <div className="space-y-2.5">
                {overview.sources.map((s) => {
                  const pct = overview.current.revenue > 0 ? (s.revenue / overview.current.revenue) * 100 : 0;
                  return (
                    <div key={s.source}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-white/70">{SOURCE_LABELS[s.source] || s.source}</span>
                        <span className="text-white/40">{s.count} &middot; {s.revenue.toFixed(0)} TL &middot; %{pct.toFixed(0)}</span>
                      </div>
                      <ProgressBar value={s.revenue} max={overview.current.revenue} color="bg-amber-500" />
                    </div>
                  );
                })}
                {overview.sources.length === 0 && <p className="text-white/20 text-xs text-center py-2">Veri yok</p>}
              </div>
            </div>

            {/* Payment Methods */}
            <div className="card p-4">
              <h3 className="text-sm font-semibold mb-3">Odeme Yontemleri</h3>
              <div className="space-y-2.5">
                {overview.payments.map((p) => {
                  const total = overview.payments.reduce((s, x) => s + x.total, 0);
                  const pct = total > 0 ? (p.total / total) * 100 : 0;
                  const label = p.method === "cash" ? "Nakit" : p.method === "card" ? "Kart" : "Online";
                  const clr = p.method === "cash" ? "bg-green-500" : p.method === "card" ? "bg-blue-500" : "bg-purple-500";
                  return (
                    <div key={p.method}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-white/70">{label}</span>
                        <span className="text-white/40">{p.count} &middot; {p.total.toFixed(0)} TL &middot; %{pct.toFixed(0)}</span>
                      </div>
                      <ProgressBar value={p.total} max={total} color={clr} />
                    </div>
                  );
                })}
                {overview.payments.length === 0 && <p className="text-white/20 text-xs text-center py-2">Odeme yok</p>}
              </div>
            </div>

            {/* Order Types */}
            <div className="card p-4">
              <h3 className="text-sm font-semibold mb-3">Siparis Tipleri</h3>
              {(() => {
                const total = overview.orderTypes.dineIn + overview.orderTypes.delivery + overview.orderTypes.takeaway;
                if (total === 0) return <p className="text-white/20 text-xs text-center py-2">Veri yok</p>;
                const items = [
                  { label: "Mekan (Masa)", count: overview.orderTypes.dineIn, color: "bg-amber-500" },
                  { label: "Teslimat", count: overview.orderTypes.delivery, color: "bg-blue-500" },
                  { label: "Gel-Al / Paket", count: overview.orderTypes.takeaway, color: "bg-purple-500" },
                ];
                return (
                  <div className="space-y-2.5">
                    {items.map(({ label, count, color }) => (
                      <div key={label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-white/70">{label}</span>
                          <span className="text-white/40">{count} &middot; %{(count / total * 100).toFixed(0)}</span>
                        </div>
                        <ProgressBar value={count} max={total} color={color} />
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Additional Metrics Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="card p-3 text-center">
              <p className="text-2xl font-bold text-orange-400">{overview.current.discount.toFixed(0)}</p>
              <p className="text-[10px] text-white/40">Toplam Indirim (TL)</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-2xl font-bold text-cyan-400">{overview.current.deliveryFees.toFixed(0)}</p>
              <p className="text-[10px] text-white/40">Teslimat Ucreti (TL)</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-2xl font-bold text-white/60">{overview.payments.reduce((s, p) => s + p.count, 0)}</p>
              <p className="text-[10px] text-white/40">Tahsil Edilen</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-2xl font-bold text-white/40">{Math.max(0, overview.current.orders - overview.payments.reduce((s, p) => s + p.count, 0))}</p>
              <p className="text-[10px] text-white/40">Tahsil Edilmeyen</p>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ CIRO TAB ═══════════════ */}
      {!loading && tab === "revenue" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <KpiCard title="Toplam Siparis" value={String(totals.totalOrders)} color="text-white" />
            <KpiCard title="Toplam Ciro" value={`${totals.totalRevenue.toFixed(0)} TL`} color="text-green-400" />
            <KpiCard title="Gunluk Ortalama" value={`${totals.avgDaily.toFixed(0)} TL`} color="text-accent" />
            <KpiCard
              title="En Iyi Gun"
              value={daily.length > 0 ? `${Math.max(...daily.map(d => d.revenue)).toFixed(0)} TL` : "--"}
              subtitle={daily.length > 0 ? daily.reduce((best, d) => d.revenue > best.revenue ? d : best, daily[0]).date.slice(5) : ""}
              color="text-emerald-400"
            />
          </div>

          <div className="card">
            <div className="flex items-center justify-between p-4 pb-0">
              <h3 className="text-sm font-semibold">Gunluk Ciro Detayi</h3>
              <span className="text-[10px] text-white/30">{daily.length} gun</span>
            </div>
            <div className="p-4 space-y-1.5">
              {daily.map((d) => {
                const pct = (d.revenue / maxRevenue) * 100;
                return (
                  <div key={d.date} className="group">
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-white/40 w-12 shrink-0 font-mono">{d.date.slice(5)}</span>
                      <div className="flex-1 h-8 bg-surface-2 rounded-lg overflow-hidden relative">
                        <div className="h-full bg-gradient-to-r from-amber-500/70 to-amber-400/40 rounded-lg transition-all duration-300" style={{ width: `${pct}%` }} />
                        <div className="absolute inset-0 flex items-center justify-between px-3">
                          <span className="text-[11px] font-semibold text-white/90">{d.revenue.toFixed(0)} TL</span>
                          <span className="text-[10px] text-white/40">{d.orders} siparis &middot; ort {d.avgOrder.toFixed(0)} TL</span>
                        </div>
                      </div>
                      {d.cancelled > 0 && <span className="text-red-400/60 text-[9px] shrink-0">{d.cancelled} iptal</span>}
                    </div>
                  </div>
                );
              })}
              {daily.length === 0 && <p className="text-white/30 text-center py-8 text-sm">Veri yok</p>}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ URUNLER TAB ═══════════════ */}
      {!loading && tab === "products" && (
        <div className="space-y-6">
          {/* Top 3 Highlight */}
          {products.length >= 3 && (
            <div className="grid grid-cols-3 gap-3">
              {products.slice(0, 3).map((p, i) => {
                const colors = ["text-amber-400", "text-gray-400", "text-orange-600"];
                const bgColors = ["bg-amber-500/10 border-amber-500/30", "bg-gray-500/10 border-gray-500/30", "bg-orange-500/10 border-orange-500/30"];
                const medals = ["1.", "2.", "3."];
                return (
                  <div key={p.name} className={`card border ${bgColors[i]} p-4 text-center`}>
                    <span className={`text-2xl font-black ${colors[i]}`}>{medals[i]}</span>
                    <p className="text-sm font-bold mt-1 truncate">{p.name}</p>
                    <p className="text-[11px] text-white/40 mt-1">{p.totalQuantity} adet &middot; {p.totalRevenue.toFixed(0)} TL</p>
                    <div className="flex items-center justify-center gap-2 mt-2">
                      <span className="text-[10px] text-white/30">%{p.revenuePercent.toFixed(1)} ciro</span>
                      <GrowthBadge value={p.growth} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Full Product Table */}
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-border text-white/40 text-[11px]">
                  <th className="px-4 py-3 text-left w-8">#</th>
                  <th className="px-4 py-3 text-left">Urun</th>
                  <th className="px-4 py-3 text-right">Adet</th>
                  <th className="px-4 py-3 text-right">Ciro</th>
                  <th className="px-4 py-3 text-right">Ort. Fiyat</th>
                  <th className="px-4 py-3 text-right">Ciro %</th>
                  <th className="px-4 py-3 text-right">Degisim</th>
                  <th className="px-4 py-3 text-left w-32">Dagilim</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((p, i) => (
                  <tr key={p.name} className="hover:bg-surface-2 transition-colors">
                    <td className="px-4 py-3 text-white/30 font-bold">{i + 1}</td>
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-right text-white/60 font-semibold">{p.totalQuantity}</td>
                    <td className="px-4 py-3 text-right text-accent font-semibold">{p.totalRevenue.toFixed(0)} TL</td>
                    <td className="px-4 py-3 text-right text-white/40">{p.avgPrice.toFixed(0)} TL</td>
                    <td className="px-4 py-3 text-right text-white/50">%{p.revenuePercent.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right"><GrowthBadge value={p.growth} /></td>
                    <td className="px-4 py-3"><ProgressBar value={p.totalQuantity} max={maxProductQty} /></td>
                  </tr>
                ))}
                {products.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-white/30">Urun verisi yok</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          {grandTotal.quantity > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="card p-3 text-center">
                <p className="text-2xl font-bold text-white">{grandTotal.quantity}</p>
                <p className="text-[10px] text-white/40">Toplam Satis Adedi</p>
              </div>
              <div className="card p-3 text-center">
                <p className="text-2xl font-bold text-accent">{grandTotal.revenue.toFixed(0)} TL</p>
                <p className="text-[10px] text-white/40">Toplam Urun Cirosu</p>
              </div>
              <div className="card p-3 text-center col-span-2 md:col-span-1">
                <p className="text-2xl font-bold text-white/60">{products.length}</p>
                <p className="text-[10px] text-white/40">Farkli Urun</p>
              </div>
            </div>
          )}

          {/* TIME-BASED PRODUCT ANALYSIS */}
          <div className="card p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h3 className="text-sm font-semibold">Zaman Bazli Urun Analizi</h3>
              <div className="flex gap-1 bg-surface-2 rounded-lg p-0.5 overflow-x-auto">
                {([
                  ["hourly", "Saatlik"], ["daily", "Gunluk"], ["weekly", "Haftalik"],
                  ["monthly", "Aylik"], ["seasonal", "Mevsimsel"], ["yearly", "Yillik"],
                ] as [AnalysisView, string][]).map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setAnalysisView(v)}
                    className={`px-2 py-1 rounded text-[10px] sm:text-xs font-medium transition-colors whitespace-nowrap ${
                      analysisView === v ? "bg-accent text-black" : "text-white/40 hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {analysisGroups.length === 0 && <p className="text-white/20 text-xs text-center py-6">Veri yok</p>}

            <div className="space-y-1.5">
              {analysisGroups.map((group) => {
                const isOpen = expandedGroup === group.key;
                const maxQty = Math.max(...group.products.map(p => p.quantity), 1);
                return (
                  <div key={group.key} className="rounded-xl overflow-hidden border border-border">
                    <button
                      onClick={() => setExpandedGroup(isOpen ? null : group.key)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-surface-2 hover:bg-surface-2/80 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <svg className={`w-3.5 h-3.5 text-white/30 transition-transform ${isOpen ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        <span className="text-sm font-medium">{group.label}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-white/40">
                        <span>{group.totalQuantity} adet</span>
                        <span>{group.totalRevenue.toFixed(0)} TL</span>
                        <span className="bg-surface-1 px-1.5 py-0.5 rounded text-[10px]">{group.products.length} urun</span>
                      </div>
                    </button>
                    {isOpen && (
                      <div className="px-4 py-2 space-y-1.5 bg-surface-1/30">
                        {group.products.map((p, i) => (
                          <div key={p.name} className="flex items-center gap-2">
                            <span className={`text-[10px] w-5 text-right shrink-0 font-bold ${i < 3 ? "text-accent" : "text-white/20"}`}>{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-xs font-medium truncate">{p.name}</span>
                                <span className="text-[10px] text-white/40 shrink-0 ml-2">{p.quantity} adet &middot; {p.revenue.toFixed(0)} TL</span>
                              </div>
                              <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${i < 3 ? "bg-accent" : "bg-white/20"}`} style={{ width: `${(p.quantity / maxQty) * 100}%` }} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ ZAMAN TAB ═══════════════ */}
      {!loading && tab === "time" && (
        <div className="space-y-6">
          {/* Hourly Chart */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-4">Saatlik Yogunluk</h3>
            <div className="flex items-end gap-[3px] h-40">
              {Array.from({ length: 24 }, (_, h) => {
                const data = hourly.find((d) => d.hour === h);
                const height = data ? (data.orders / maxHourlyOrders) * 100 : 0;
                const isPeak = data && data.orders === maxHourlyOrders && data.orders > 0;
                return (
                  <div key={h} className="flex-1 flex flex-col items-center group relative">
                    <div
                      className={`w-full rounded-t transition-all duration-300 min-h-[2px] ${isPeak ? "bg-red-500" : "bg-accent/60 hover:bg-accent"}`}
                      style={{ height: `${Math.max(height, 2)}%` }}
                    />
                    {data && data.orders > 0 && (
                      <div className="hidden group-hover:block absolute -top-12 bg-surface-1 border border-border rounded-lg px-2.5 py-1.5 text-xs whitespace-nowrap z-10 shadow-lg">
                        <p className="font-semibold">{data.orders} siparis</p>
                        <p className="text-white/40">{data.revenue.toFixed(0)} TL</p>
                      </div>
                    )}
                    <span className="text-[8px] sm:text-[10px] text-white/20 mt-1">{h}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-white/20">
              <span>Gece</span><span>Sabah</span><span>Ogle</span><span>Aksam</span><span>Gece</span>
            </div>
          </div>

          {/* Day of Week Analysis */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-4">Haftalik Dagilim</h3>
            <div className="space-y-2">
              {DAY_NAMES_FULL.map((name, idx) => {
                const data = weekday.find((w) => w.day === idx);
                const orders = data?.orders || 0;
                const revenue = data?.revenue || 0;
                const avgOrd = data?.avgOrder || 0;
                const isPeak = orders === maxWeekdayOrders && orders > 0;
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <span className={`text-[11px] w-16 shrink-0 font-medium ${isPeak ? "text-accent" : "text-white/40"}`}>{name}</span>
                    <div className="flex-1 h-8 bg-surface-2 rounded-lg overflow-hidden relative">
                      <div
                        className={`h-full rounded-lg transition-all duration-300 ${isPeak ? "bg-gradient-to-r from-accent/80 to-accent/40" : "bg-blue-500/40"}`}
                        style={{ width: `${maxWeekdayOrders > 0 ? (orders / maxWeekdayOrders) * 100 : 0}%` }}
                      />
                      <div className="absolute inset-0 flex items-center justify-between px-3">
                        <span className="text-[11px] font-semibold text-white/80">{orders} siparis</span>
                        <span className="text-[10px] text-white/40">{revenue.toFixed(0)} TL &middot; ort {avgOrd.toFixed(0)} TL</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Heatmap */}
          {heatmap.length > 0 && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold mb-4">Yogunluk Haritasi <span className="text-white/30 text-xs font-normal">(Gun x Saat)</span></h3>
              <div className="overflow-x-auto">
                <div className="min-w-[600px]">
                  {/* Hour headers */}
                  <div className="flex gap-[2px] mb-1 ml-12">
                    {Array.from({ length: 24 }, (_, h) => (
                      <div key={h} className="flex-1 text-center text-[8px] text-white/20">{h}</div>
                    ))}
                  </div>
                  {/* Rows */}
                  {[1, 2, 3, 4, 5, 6, 0].map((dayIdx) => (
                    <div key={dayIdx} className="flex gap-[2px] mb-[2px] items-center">
                      <span className="text-[10px] text-white/40 w-12 shrink-0">{DAY_NAMES[dayIdx]}</span>
                      {Array.from({ length: 24 }, (_, h) => {
                        const cell = heatmap.find((c) => c.day === dayIdx && c.hour === h);
                        const orders = cell?.orders || 0;
                        const intensity = maxHeatmap > 0 ? orders / maxHeatmap : 0;
                        let bg = "bg-surface-2";
                        if (intensity > 0.8) bg = "bg-red-500";
                        else if (intensity > 0.6) bg = "bg-orange-500";
                        else if (intensity > 0.4) bg = "bg-amber-500";
                        else if (intensity > 0.2) bg = "bg-amber-500/50";
                        else if (intensity > 0) bg = "bg-amber-500/20";
                        return (
                          <div key={h} className={`flex-1 h-6 ${bg} rounded-sm group relative cursor-default transition-all`}>
                            {orders > 0 && (
                              <div className="hidden group-hover:block absolute -top-8 left-1/2 -translate-x-1/2 bg-surface-1 border border-border rounded px-2 py-1 text-[10px] whitespace-nowrap z-10 shadow-lg">
                                {DAY_NAMES[dayIdx]} {String(h).padStart(2, "0")}:00 &middot; {orders} siparis
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  {/* Legend */}
                  <div className="flex items-center gap-2 mt-3 ml-12">
                    <span className="text-[9px] text-white/30">Az</span>
                    <div className="w-4 h-3 bg-surface-2 rounded-sm" />
                    <div className="w-4 h-3 bg-amber-500/20 rounded-sm" />
                    <div className="w-4 h-3 bg-amber-500/50 rounded-sm" />
                    <div className="w-4 h-3 bg-amber-500 rounded-sm" />
                    <div className="w-4 h-3 bg-orange-500 rounded-sm" />
                    <div className="w-4 h-3 bg-red-500 rounded-sm" />
                    <span className="text-[9px] text-white/30">Cok</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ KARLILIK TAB ═══════════════ */}
      {!loading && tab === "profit" && profitData && (
        <div className="space-y-6">
          {/* Profit KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <KpiCard
              title="Toplam Gelir"
              value={`${profitData.revenue.toFixed(0)} TL`}
              growth={profitData.growth.revenue}
              color="text-green-400"
            />
            <KpiCard
              title="Toplam Gider"
              value={`${profitData.expenses.total.toFixed(0)} TL`}
              growth={profitData.growth.expense}
              color="text-red-400"
            />
            <KpiCard
              title="Net Kar"
              value={`${profitData.profit.toFixed(0)} TL`}
              growth={profitData.growth.profit}
              color={profitData.profit >= 0 ? "text-emerald-400" : "text-red-400"}
            />
            <KpiCard
              title="Kar Marji"
              value={`%${profitData.margin.toFixed(1)}`}
              subtitle={profitData.margin >= 20 ? "Saglam" : profitData.margin >= 10 ? "Dikkat" : "Kritik"}
              color={profitData.margin >= 20 ? "text-emerald-400" : profitData.margin >= 10 ? "text-amber-400" : "text-red-400"}
            />
          </div>

          {/* Revenue vs Expense Visual */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-4">Gelir vs Gider Orani</h3>
            <div className="flex items-center gap-4 mb-3">
              <div className="flex-1">
                <div className="h-6 bg-surface-2 rounded-full overflow-hidden flex">
                  {profitData.revenue > 0 && (
                    <>
                      <div
                        className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500"
                        style={{ width: `${Math.max((profitData.profit / profitData.revenue) * 100, 0)}%` }}
                      />
                      <div
                        className="h-full bg-gradient-to-r from-red-500 to-red-600 transition-all duration-500"
                        style={{ width: `${Math.min((profitData.expenses.total / profitData.revenue) * 100, 100)}%` }}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-green-500 rounded-full" /> Kar: {profitData.profit.toFixed(0)} TL (%{profitData.margin.toFixed(0)})</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-red-500 rounded-full" /> Gider: {profitData.expenses.total.toFixed(0)} TL (%{profitData.revenue > 0 ? ((profitData.expenses.total / profitData.revenue) * 100).toFixed(0) : 0})</span>
            </div>
          </div>

          {/* Expense Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card p-4">
              <h3 className="text-sm font-semibold mb-4">Gider Kalemleri</h3>
              <div className="space-y-2.5">
                {profitData.expenses.byCategory.map((cat) => {
                  const pct = profitData.expenses.total > 0 ? (cat.total / profitData.expenses.total) * 100 : 0;
                  const revPct = profitData.revenue > 0 ? (cat.total / profitData.revenue) * 100 : 0;
                  return (
                    <div key={cat.category}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-white/70">{cat.category}</span>
                        <span className="text-white/40">{cat.total.toFixed(0)} TL &middot; %{pct.toFixed(0)} gider &middot; %{revPct.toFixed(1)} ciro</span>
                      </div>
                      <ProgressBar value={cat.total} max={profitData.expenses.byCategory[0]?.total || 1} color="bg-red-500/70" />
                    </div>
                  );
                })}
                {profitData.expenses.byCategory.length === 0 && <p className="text-white/20 text-xs text-center py-4">Gider kaydedilmemis</p>}
              </div>
            </div>

            {/* Daily Profit Trend */}
            <div className="card p-4">
              <h3 className="text-sm font-semibold mb-4">Gunluk Kar/Zarar</h3>
              <div className="space-y-1">
                {profitData.daily.slice(-14).map((d) => {
                  const maxAbs = Math.max(...profitData.daily.map(x => Math.max(x.revenue, x.expense)), 1);
                  return (
                    <div key={d.date} className="flex items-center gap-2">
                      <span className="text-[10px] text-white/30 w-10 shrink-0 font-mono">{d.date.slice(5)}</span>
                      <div className="flex-1 flex gap-[2px]">
                        <div className="h-4 bg-green-500/60 rounded-l" style={{ width: `${(d.revenue / maxAbs) * 50}%` }} />
                        <div className="h-4 bg-red-500/60 rounded-r" style={{ width: `${(d.expense / maxAbs) * 50}%` }} />
                      </div>
                      <span className={`text-[10px] font-semibold w-14 text-right shrink-0 ${d.profit >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {d.profit >= 0 ? "+" : ""}{d.profit.toFixed(0)}
                      </span>
                    </div>
                  );
                })}
                {profitData.daily.length === 0 && <p className="text-white/20 text-xs text-center py-4">Veri yok</p>}
              </div>
              <div className="flex gap-3 mt-3 text-[10px] text-white/30">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-green-500/60 rounded" /> Gelir</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-red-500/60 rounded" /> Gider</span>
              </div>
            </div>
          </div>

          {/* Profitability Tips */}
          {profitData.expenses.byCategory.length > 0 && (
            <div className="card p-4 border border-amber-500/20 bg-amber-500/5">
              <h3 className="text-sm font-semibold mb-2 text-amber-400">Analiz Notlari</h3>
              <ul className="space-y-1.5 text-xs text-white/50">
                {profitData.margin < 10 && <li>Kar marji %10 altinda - giderleri gozden gecirin veya fiyatlari guncelleyin</li>}
                {profitData.margin >= 10 && profitData.margin < 20 && <li>Kar marji ortalama seviyede (%{profitData.margin.toFixed(1)}) - gida maliyetlerini optimize edin</li>}
                {profitData.margin >= 20 && <li>Kar marji saglam seviyede (%{profitData.margin.toFixed(1)})</li>}
                {profitData.expenses.byCategory.length > 0 && (
                  <li>En buyuk gider kalemi: {profitData.expenses.byCategory[0].category} ({profitData.expenses.byCategory[0].total.toFixed(0)} TL, cironun %{profitData.revenue > 0 ? ((profitData.expenses.byCategory[0].total / profitData.revenue) * 100).toFixed(1) : 0}&apos;i)</li>
                )}
                {profitData.revenue > 0 && profitData.expenses.total > 0 && (
                  <li>Her 100 TL cironun {(profitData.expenses.total / profitData.revenue * 100).toFixed(0)} TL&apos;si giderlere gidiyor</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
