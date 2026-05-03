"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";

interface Extra { id: number; name: string; price: number }
interface OrderItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes: string | null;
  extras: Extra[];
  removed: string[];
}
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

  const sourceLabel = order.source === "whatsapp" ? "WHATSAPP"
    : order.source === "qr" ? "QR MASA"
    : order.source === "phone" ? "TELEFON"
    : order.source === "walk_in" ? "GEL-AL"
    : "MANUEL";

  const typeLabel = order.deliveryAddress ? "PAKET SERVIS"
    : order.tableNumber ? `MASA ${order.tableNumber}`
    : "GEL-AL";

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
        <div className="text-center mb-2">
          <h1 className="text-lg font-bold tracking-wider">VAROSH</h1>
          <p className="text-[10px] text-gray-500">STREET FOOD - KADIRLI</p>
        </div>

        <div className="border-t-2 border-black my-2" />

        {/* Order info - buyuk ve belirgin */}
        <div className="text-center mb-1">
          <p className="text-2xl font-black tracking-wider">#{order.id}</p>
          <div className="flex justify-center gap-2 mt-1">
            <span className="border border-black px-2 py-0.5 text-[11px] font-bold">{typeLabel}</span>
            <span className="border border-black px-2 py-0.5 text-[11px] font-bold">{sourceLabel}</span>
          </div>
        </div>

        <div className="text-[10px] text-gray-500 text-center mb-1">
          {date.toLocaleDateString("tr-TR")} {date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
        </div>

        {(order.customerName || order.customerPhone || order.deliveryAddress) && (
          <div className="bg-gray-100 p-1.5 text-[10px] mb-1">
            {order.customerName && <p><b>Musteri:</b> {order.customerName}</p>}
            {order.customerPhone && <p><b>Tel:</b> {order.customerPhone}</p>}
            {order.deliveryAddress && <p><b>Adres:</b> {order.deliveryAddress}</p>}
          </div>
        )}

        <div className="border-t-2 border-black my-2" />

        {/* ========== URUNLER - ASCI ICIN BELIRGIN ========== */}
        {order.items.map((item, i) => (
          <div key={i} className="mb-3 last:mb-1">
            {/* Urun satiri: adet x isim */}
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <span className="text-base font-black">{item.quantity}x {item.name}</span>
              </div>
              <span className="text-sm font-bold ml-2 shrink-0">{item.totalPrice.toFixed(0)} TL</span>
            </div>

            {/* EKSTRA secimler - yesil cerceveli, cok belirgin */}
            {item.extras.length > 0 && (
              <div className="border-2 border-black mt-1 p-1.5">
                <p className="text-[10px] font-black mb-0.5">EKSTRA:</p>
                {item.extras.map((ext, j) => (
                  <p key={j} className="text-sm font-bold pl-1">
                    + {ext.name} {ext.price > 0 && <span className="text-[10px]">(+{ext.price.toFixed(0)} TL)</span>}
                  </p>
                ))}
              </div>
            )}

            {/* CIKARILAN malzemeler - siyah dolgulu, dikkat cekici */}
            {item.removed.length > 0 && (
              <div className="bg-black text-white mt-1 p-1.5">
                <p className="text-[10px] font-black mb-0.5">CIKARILACAK:</p>
                {item.removed.map((r, j) => (
                  <p key={j} className="text-sm font-bold pl-1">
                    ✕ {r}
                  </p>
                ))}
              </div>
            )}

            {/* Urun ozel notu */}
            {item.notes && (
              <div className="border border-dashed border-gray-400 mt-1 p-1">
                <p className="text-[10px] font-bold">NOT: {item.notes}</p>
              </div>
            )}

            {i < order.items.length - 1 && (
              <div className="border-b border-dashed border-gray-300 mt-2" />
            )}
          </div>
        ))}

        <div className="border-t-2 border-black my-2" />

        {/* Genel siparis notu - cok belirgin */}
        {order.notes && (
          <>
            <div className="border-2 border-dashed border-black p-2 mb-2">
              <p className="text-[10px] font-black mb-0.5">SIPARIS NOTU:</p>
              <p className="text-sm font-bold">{order.notes}</p>
            </div>
          </>
        )}

        {/* Totals */}
        <div className="space-y-0.5">
          <div className="flex justify-between text-[11px]">
            <span>Ara Toplam</span>
            <span>{order.subtotal.toFixed(0)} TL</span>
          </div>
          {order.deliveryFee > 0 && (
            <div className="flex justify-between text-[11px]">
              <span>Teslimat</span>
              <span>{order.deliveryFee.toFixed(0)} TL</span>
            </div>
          )}
          <div className="border-t border-black" />
          <div className="flex justify-between font-black text-base pt-0.5">
            <span>TOPLAM</span>
            <span>{order.total.toFixed(0)} TL</span>
          </div>
        </div>

        <div className="border-t-2 border-black my-2" />

        {/* QR Code */}
        {trackUrl && (
          <div className="text-center mb-2">
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
