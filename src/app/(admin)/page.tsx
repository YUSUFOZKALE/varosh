import { getDb, schema } from "@/lib/db";
import { sql, and, gte, desc } from "drizzle-orm";
import { StatCard } from "@/components/ui/card";

export const dynamic = "force-dynamic";

function getTodayStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} 00:00:00`;
}

export default function Dashboard() {
  const db = getDb();
  const todayStart = getTodayStart();

  const todayOrders = db.select({ count: sql<number>`count(*)` })
    .from(schema.orders)
    .where(gte(schema.orders.createdAt, todayStart))
    .get();

  const todayRevenue = db.select({ total: sql<number>`coalesce(sum(total), 0)` })
    .from(schema.orders)
    .where(and(
      gte(schema.orders.createdAt, todayStart),
      sql`${schema.orders.status} != 'cancelled'`
    ))
    .get();

  const activeOrders = db.select({ count: sql<number>`count(*)` })
    .from(schema.orders)
    .where(sql`${schema.orders.status} IN ('new', 'preparing', 'ready', 'on_the_way')`)
    .get();

  const totalCustomers = db.select({ count: sql<number>`count(*)` })
    .from(schema.users)
    .get();

  const recentOrders = db.select()
    .from(schema.orders)
    .orderBy(desc(schema.orders.createdAt))
    .limit(10)
    .all();

  const statusLabels: Record<string, string> = {
    new: "Yeni", preparing: "Hazirlaniyor", ready: "Hazir",
    on_the_way: "Yolda", delivered: "Teslim", cancelled: "Iptal",
    pending_approval: "Onay Bekliyor",
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Panel</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Bugunun Siparisleri" value={todayOrders?.count ?? 0} icon="📦" />
        <StatCard title="Bugunun Geliri" value={`${(todayRevenue?.total ?? 0).toFixed(0)} TL`} icon="💰" />
        <StatCard title="Aktif Siparisler" value={activeOrders?.count ?? 0} icon="🔥" />
        <StatCard title="Toplam Musteri" value={totalCustomers?.count ?? 0} icon="👥" />
      </div>

      {/* Hizli Erisim */}
      <div className="card mb-8">
        <h3 className="text-sm font-semibold text-white/60 mb-3">Hizli Erisim & Test</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          <a href="/orders" className="bg-surface-2 hover:bg-surface-3 rounded-xl p-3 text-sm text-white/70 hover:text-white transition-colors text-center">📦 Siparisler</a>
          <a href="/pos" className="bg-surface-2 hover:bg-surface-3 rounded-xl p-3 text-sm text-white/70 hover:text-white transition-colors text-center">+ Yeni Siparis</a>
          <a href="/kitchen" className="bg-surface-2 hover:bg-surface-3 rounded-xl p-3 text-sm text-white/70 hover:text-white transition-colors text-center">👨‍🍳 Mutfak</a>
          <a href="/menu" className="bg-surface-2 hover:bg-surface-3 rounded-xl p-3 text-sm text-white/70 hover:text-white transition-colors text-center">🍽️ Menu</a>
          <a href="/cashier" className="bg-surface-2 hover:bg-surface-3 rounded-xl p-3 text-sm text-white/70 hover:text-white transition-colors text-center">💰 Kasa</a>
          <a href="/stock" className="bg-surface-2 hover:bg-surface-3 rounded-xl p-3 text-sm text-white/70 hover:text-white transition-colors text-center">📦 Stok</a>
          <a href="/delivery" className="bg-surface-2 hover:bg-surface-3 rounded-xl p-3 text-sm text-white/70 hover:text-white transition-colors text-center">🛵 Teslimat</a>
          <a href="/customers" className="bg-surface-2 hover:bg-surface-3 rounded-xl p-3 text-sm text-white/70 hover:text-white transition-colors text-center">👥 Musteriler</a>
          <a href="/staff" className="bg-surface-2 hover:bg-surface-3 rounded-xl p-3 text-sm text-white/70 hover:text-white transition-colors text-center">👤 Personel</a>
          <a href="/checklist" className="bg-surface-2 hover:bg-surface-3 rounded-xl p-3 text-sm text-white/70 hover:text-white transition-colors text-center">✅ Kontrol</a>
          <a href="/reports" className="bg-surface-2 hover:bg-surface-3 rounded-xl p-3 text-sm text-white/70 hover:text-white transition-colors text-center">📈 Raporlar</a>
          <a href="/settings" className="bg-surface-2 hover:bg-surface-3 rounded-xl p-3 text-sm text-white/70 hover:text-white transition-colors text-center">⚙️ Ayarlar</a>
        </div>
        <h4 className="text-xs font-semibold text-white/40 mb-2">Musteri & Kurye Sayfalari</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <a href="/table/1" target="_blank" className="bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl p-3 text-sm text-amber-400 hover:text-amber-300 transition-colors text-center">🍽️ Masa 1</a>
          <a href="/table/2" target="_blank" className="bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl p-3 text-sm text-amber-400 hover:text-amber-300 transition-colors text-center">🍽️ Masa 2</a>
          <a href="/table/3" target="_blank" className="bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl p-3 text-sm text-amber-400 hover:text-amber-300 transition-colors text-center">🍽️ Masa 3</a>
          <a href="/customer" target="_blank" className="bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl p-3 text-sm text-amber-400 hover:text-amber-300 transition-colors text-center">📱 Musteri</a>
          <a href="/courier" target="_blank" className="bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl p-3 text-sm text-amber-400 hover:text-amber-300 transition-colors text-center">🛵 Kurye</a>
        </div>
      </div>

      <h3 className="text-base font-semibold text-white/80 mb-3">Son Siparisler</h3>
      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-white/40 text-xs">
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">Musteri</th>
              <th className="px-4 py-3 text-left">Durum</th>
              <th className="px-4 py-3 text-right">Tutar</th>
              <th className="px-4 py-3 text-right">Tarih</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {recentOrders.map((order) => (
              <tr key={order.id} className="hover:bg-surface-2 transition-colors">
                <td className="px-4 py-3 font-mono text-white/60">#{order.id}</td>
                <td className="px-4 py-3">{order.customerName || "Isimsiz"}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded text-xs bg-surface-3 text-white/70">
                    {statusLabels[order.status] || order.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-semibold">{order.total.toFixed(0)} TL</td>
                <td className="px-4 py-3 text-right text-white/40 text-xs">
                  {new Date(order.createdAt).toLocaleString("tr-TR")}
                </td>
              </tr>
            ))}
            {recentOrders.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-white/30">
                  Henuz siparis yok
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
