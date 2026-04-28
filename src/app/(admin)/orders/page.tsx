"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

interface Order {
  id: number;
  customerName: string | null;
  customerPhone: string | null;
  status: string;
  source: string;
  total: number;
  subtotal: number;
  deliveryFee: number;
  deliveryAddress: string | null;
  tableNumber: number | null;
  notes: string | null;
  createdAt: string;
}

interface OrderItem {
  id: number;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes: string | null;
}

interface OrderDetail extends Order {
  items: OrderItem[];
}

const STATUS_LABELS: Record<string, string> = {
  pending_approval: "Onay Bekliyor",
  new: "Yeni",
  preparing: "Hazirlaniyor",
  ready: "Hazir",
  on_the_way: "Yolda",
  delivered: "Teslim Edildi",
  cancelled: "Iptal",
};

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-600/20 text-blue-400",
  pending_approval: "bg-yellow-600/20 text-yellow-400",
  preparing: "bg-orange-600/20 text-orange-400",
  ready: "bg-green-600/20 text-green-400",
  on_the_way: "bg-purple-600/20 text-purple-400",
  delivered: "bg-white/10 text-white/40",
  cancelled: "bg-red-600/20 text-red-400",
};

const NEXT_STATUS: Record<string, { status: string; label: string }> = {
  new: { status: "preparing", label: "Hazirlaniyor" },
  preparing: { status: "ready", label: "Hazir" },
  ready: { status: "delivered", label: "Teslim Et" },
  on_the_way: { status: "delivered", label: "Teslim Edildi" },
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailModal, setDetailModal] = useState(false);

  const load = useCallback(async () => {
    const url = filter ? `/api/orders?status=${filter}` : "/api/orders";
    const res = await fetch(url);
    setOrders(await res.json());
  }, [filter]);

  useEffect(() => { load(); const interval = setInterval(load, 10000); return () => clearInterval(interval); }, [load]);

  async function openDetail(id: number) {
    const res = await fetch(`/api/orders/${id}`);
    setDetail(await res.json());
    setDetailModal(true);
  }

  async function updateStatus(orderId: number, status: string) {
    await fetch(`/api/orders/${orderId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
    if (detail?.id === orderId) {
      const res = await fetch(`/api/orders/${orderId}`);
      setDetail(await res.json());
    }
  }

  async function cancelOrder(orderId: number) {
    if (!confirm("Siparisi iptal etmek istediginize emin misiniz?")) return;
    await updateStatus(orderId, "cancelled");
  }

  const filters = [
    { value: "", label: "Tumu" },
    { value: "new", label: "Yeni" },
    { value: "preparing", label: "Hazirlaniyor" },
    { value: "ready", label: "Hazir" },
    { value: "on_the_way", label: "Yolda" },
    { value: "delivered", label: "Teslim" },
    { value: "cancelled", label: "Iptal" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Siparisler</h2>
        <span className="text-white/30 text-sm">Otomatik yenilenir (10s)</span>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filter === f.value ? "bg-accent text-black" : "bg-surface-2 text-white/60 hover:text-white"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Orders table */}
      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-white/40 text-xs">
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">Musteri</th>
              <th className="px-4 py-3 text-left">Kaynak</th>
              <th className="px-4 py-3 text-left">Durum</th>
              <th className="px-4 py-3 text-right">Tutar</th>
              <th className="px-4 py-3 text-right">Tarih</th>
              <th className="px-4 py-3 text-right">Islem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {orders.map((order) => {
              const next = NEXT_STATUS[order.status];
              return (
                <tr key={order.id} className="hover:bg-surface-2 transition-colors">
                  <td className="px-4 py-3">
                    <button onClick={() => openDetail(order.id)} className="font-mono text-accent hover:underline">
                      #{order.id}
                    </button>
                  </td>
                  <td className="px-4 py-3">{order.customerName || "Isimsiz"}</td>
                  <td className="px-4 py-3 text-white/50 text-xs">{order.source}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[order.status] || ""}`}>
                      {STATUS_LABELS[order.status] || order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{order.total.toFixed(0)} TL</td>
                  <td className="px-4 py-3 text-right text-white/40 text-xs">
                    {new Date(order.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-1.5 justify-end items-center">
                      {next && (
                        <button
                          onClick={() => updateStatus(order.id, next.status)}
                          className="px-5 py-2.5 rounded-xl bg-accent text-black font-bold text-sm transition-all hover:brightness-110 active:scale-[0.97] min-w-[120px]"
                        >
                          {next.label}
                        </button>
                      )}
                      {order.status !== "delivered" && order.status !== "cancelled" && (
                        <button
                          onClick={() => cancelOrder(order.id)}
                          className="p-2 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-all"
                          title="Iptal Et"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-white/30">Siparis yok</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      <Modal open={detailModal} onClose={() => setDetailModal(false)} title={`Siparis #${detail?.id}`} width="max-w-xl">
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-white/40 text-xs">Musteri</span>
                <p>{detail.customerName || "Isimsiz"}</p>
              </div>
              <div>
                <span className="text-white/40 text-xs">Durum</span>
                <p>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[detail.status] || ""}`}>
                    {STATUS_LABELS[detail.status]}
                  </span>
                </p>
              </div>
              <div>
                <span className="text-white/40 text-xs">Kaynak</span>
                <p>{detail.source}</p>
              </div>
              <div>
                <span className="text-white/40 text-xs">Tarih</span>
                <p>{new Date(detail.createdAt).toLocaleString("tr-TR")}</p>
              </div>
              {detail.tableNumber && (
                <div>
                  <span className="text-white/40 text-xs">Masa</span>
                  <p>#{detail.tableNumber}</p>
                </div>
              )}
              {detail.deliveryAddress && (
                <div className="col-span-2">
                  <span className="text-white/40 text-xs">Adres</span>
                  <p>{detail.deliveryAddress}</p>
                </div>
              )}
              {detail.notes && (
                <div className="col-span-2">
                  <span className="text-white/40 text-xs">Not</span>
                  <p>{detail.notes}</p>
                </div>
              )}
            </div>

            <div>
              <h4 className="text-xs text-white/40 mb-2">Urunler</h4>
              <div className="space-y-1">
                {detail.items.map((item) => (
                  <div key={item.id} className="flex justify-between bg-surface-2 rounded-lg px-3 py-2 text-sm">
                    <span>{item.quantity}x {item.name}</span>
                    <span className="font-semibold">{item.totalPrice.toFixed(0)} TL</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-border pt-3 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-white/40">Ara Toplam</span><span>{detail.subtotal.toFixed(0)} TL</span></div>
              {detail.deliveryFee > 0 && <div className="flex justify-between"><span className="text-white/40">Teslimat</span><span>{detail.deliveryFee} TL</span></div>}
              <div className="flex justify-between font-bold text-base"><span>Toplam</span><span className="text-accent">{detail.total.toFixed(0)} TL</span></div>
            </div>

            <div className="flex gap-2 items-center justify-end pt-2">
              {detail.status !== "delivered" && detail.status !== "cancelled" && (
                <button
                  onClick={() => cancelOrder(detail.id)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-all text-xs"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                  Iptal
                </button>
              )}
              {NEXT_STATUS[detail.status] && (
                <button
                  onClick={() => updateStatus(detail.id, NEXT_STATUS[detail.status].status)}
                  className="px-8 py-3 rounded-xl bg-accent text-black font-bold text-base transition-all hover:brightness-110 active:scale-[0.97]"
                >
                  {NEXT_STATUS[detail.status].label}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
