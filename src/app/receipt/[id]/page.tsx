"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";

interface OrderItem { name: string; quantity: number; unitPrice: number; totalPrice: number; notes: string | null }
interface Order {
  id: number;
  customerName: string | null;
  customerPhone: string | null;
  tableNumber: number | null;
  deliveryAddress: string | null;
  status: string;
  source: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  notes: string | null;
  trackingToken: string | null;
  createdAt: string;
  items: OrderItem[];
}

export default function ReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const printed = useRef(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/orders/${id}`);
    if (!res.ok) { setError("Siparis bulunamadi"); return; }
    setOrder(await res.json());
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (order && !printed.current) {
      printed.current = true;
      setTimeout(() => window.print(), 500);
    }
  }, [order]);

  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
  if (!order) return <div className="p-8 text-center text-gray-400">Yukleniyor...</div>;

  const date = new Date(order.createdAt);
  const trackUrl = order.trackingToken ? `${typeof window !== "undefined" ? window.location.origin : ""}/track/${order.trackingToken}` : null;

  return (
    <>
      <style jsx global>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .receipt { width: 80mm; margin: 0 auto; padding: 0; }
        }
        @media screen {
          body { background: #0a0a0a !important; }
        }
      `}</style>

      <div className="no-print flex justify-center gap-3 p-4 bg-neutral-900">
        <button onClick={() => window.print()} className="px-6 py-2 bg-amber-500 text-black font-bold rounded-xl">
          Yazdir
        </button>
        <button onClick={() => window.close()} className="px-6 py-2 bg-neutral-700 text-white rounded-xl">
          Kapat
        </button>
      </div>

      <div className="receipt max-w-[80mm] mx-auto bg-white text-black p-4 font-mono text-xs leading-relaxed">
        {/* Header */}
        <div className="text-center mb-3">
          <h1 className="text-lg font-bold tracking-wider">VAROSH</h1>
          <p className="text-[10px] text-gray-500">STREET FOOD - KADIRLI</p>
          <p className="text-[10px] text-gray-400 mt-1">
            {date.toLocaleDateString("tr-TR")} {date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>

        <div className="border-t border-dashed border-gray-300 my-2" />

        {/* Order info */}
        <div className="mb-2">
          <div className="flex justify-between">
            <span className="font-bold text-sm">SIPARIS #{order.id}</span>
            <span className="text-gray-500">{order.source === "whatsapp" ? "PAKET" : order.tableNumber ? `MASA ${order.tableNumber}` : "GEL-AL"}</span>
          </div>
          {order.customerName && <p className="mt-1">Musteri: {order.customerName}</p>}
          {order.customerPhone && <p>Tel: {order.customerPhone}</p>}
          {order.deliveryAddress && <p>Adres: {order.deliveryAddress}</p>}
        </div>

        <div className="border-t border-dashed border-gray-300 my-2" />

        {/* Items */}
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-1">Urun</th>
              <th className="text-center w-8">Ad</th>
              <th className="text-right w-16">Tutar</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-1">
                  {item.name}
                  {item.notes && <p className="text-[9px] text-gray-500">* {item.notes}</p>}
                </td>
                <td className="text-center">{item.quantity}</td>
                <td className="text-right">{item.totalPrice.toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t border-dashed border-gray-300 my-2" />

        {/* Totals */}
        <div className="space-y-1">
          <div className="flex justify-between">
            <span>Ara Toplam</span>
            <span>{order.subtotal.toFixed(0)} TL</span>
          </div>
          {order.deliveryFee > 0 && (
            <div className="flex justify-between">
              <span>Teslimat</span>
              <span>{order.deliveryFee.toFixed(0)} TL</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-sm border-t border-gray-300 pt-1">
            <span>TOPLAM</span>
            <span>{order.total.toFixed(0)} TL</span>
          </div>
        </div>

        {order.notes && (
          <>
            <div className="border-t border-dashed border-gray-300 my-2" />
            <p className="text-[10px]">Not: {order.notes}</p>
          </>
        )}

        <div className="border-t border-dashed border-gray-300 my-2" />

        {/* QR Code */}
        {trackUrl && (
          <div className="text-center">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(trackUrl)}`}
              alt="QR"
              className="mx-auto mb-1"
              width={120}
              height={120}
            />
            <p className="text-[9px] text-gray-400">Siparis takibi icin QR kodu okutun</p>
          </div>
        )}

        <div className="border-t border-dashed border-gray-300 my-2" />

        <div className="text-center text-[10px] text-gray-400">
          <p>Afiyet olsun!</p>
          <p>VAROSH STREET FOOD</p>
          <p>Cemaliye Mah. Adliye Cad. Kadirli/Osmaniye</p>
          <p>Tel: 0542 190 06 62</p>
        </div>
      </div>
    </>
  );
}
