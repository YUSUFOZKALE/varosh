"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import "leaflet/dist/leaflet.css";
import { useToast } from "@/hooks/useToast";
import { ToastContainer } from "@/components/ToastContainer";

interface CourierDelivery {
  id: number;
  customerName: string | null;
  customerPhone: string | null;
  deliveryAddress: string | null;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  total: number;
  status: string;
  createdAt: string;
  paymentMethod: string | null;
}

const SHOP_DEFAULT: [number, number] = [37.372986, 36.076054];

interface OrderItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  extras: { id: number; name: string; price: number }[];
  removed: string[];
  notes: string | null;
}

interface OrderDetail {
  id: number;
  total: number;
  subtotal: number;
  deliveryFee: number;
  customerName: string | null;
  items: OrderItem[];
}

interface CustomerAddress {
  id?: number;
  label: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
}

interface CustomerEditData {
  orderId: number;
  name: string;
  phone: string;
  addresses: [CustomerAddress, CustomerAddress];
  selectedAddressIndex: number;
}

export default function CourierPage() {
  const router = useRouter();
  const toast = useToast();
  const [deliveries, setDeliveries] = useState<CourierDelivery[]>([]);
  const [shopLocation, setShopLocation] = useState<[number, number]>(SHOP_DEFAULT);
  const [paymentModal, setPaymentModal] = useState<CourierDelivery | null>(null);
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);
  const [paying, setPaying] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<number>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [pendingPackages, setPendingPackages] = useState<CourierDelivery[]>([]);
  const [pickSelected, setPickSelected] = useState<Set<number>>(new Set());
  const [picking, setPicking] = useState(false);
  const [myStaffId, setMyStaffId] = useState<number | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const scannerRef = useRef<any>(null);
  const autoStarted = useRef(false);

  const [custEdit, setCustEdit] = useState<CustomerEditData | null>(null);
  const [custSaving, setCustSaving] = useState(false);
  const [custMapIdx, setCustMapIdx] = useState<0 | 1 | null>(null);
  const [custPhoneSearching, setCustPhoneSearching] = useState(false);
  const custPhoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const mapMarkerRef = useRef<any>(null);

  const [cashOnHand, setCashOnHand] = useState<number>(0);
  const [cashFromDeliveries, setCashFromDeliveries] = useState<number>(0);
  const [cardFromDeliveries, setCardFromDeliveries] = useState<number>(0);
  const [todayDeposits, setTodayDeposits] = useState<number>(0);
  const [todayWithdrawals, setTodayWithdrawals] = useState<number>(0);
  const [todayDeliveryCount, setTodayDeliveryCount] = useState<number>(0);
  const [cashModal, setCashModal] = useState<"deposit" | "withdrawal" | null>(null);
  const [cashAmount, setCashAmount] = useState("");
  const [cashProcessing, setCashProcessing] = useState(false);
  const [cashResult, setCashResult] = useState<{ type: string; amount: number; newBalance: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const [res, settingsRes, readyRes, meRes] = await Promise.all([
        fetch("/api/orders?status=on_the_way"),
        fetch("/api/settings/public"),
        fetch("/api/orders?status=ready"),
        fetch("/api/auth/me"),
      ]);
      if (res.ok) {
        const orders: CourierDelivery[] = await res.json();
        setDeliveries(orders.filter((o) => o.deliveryAddress));
      }
      if (readyRes.ok) {
        const readyOrders: CourierDelivery[] = await readyRes.json();
        setPendingPackages(readyOrders.filter((o) => o.deliveryAddress));
      }
      try {
        const me = await meRes.json();
        if (me.staffId) setMyStaffId(me.staffId);
      } catch {}
      try {
        const s = await settingsRes.json();
        if (s.shopLatitude && s.shopLongitude) {
          setShopLocation([s.shopLatitude, s.shopLongitude]);
        }
      } catch {}
      setLoaded(true);
    } catch {}
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (loaded && !autoStarted.current && deliveries.length === 0) {
      autoStarted.current = true;
      startScanner();
    }
  }, [loaded]);

  const loadCash = useCallback(async () => {
    try {
      const res = await fetch("/api/courier/cash");
      if (res.ok) {
        const data = await res.json();
        setCashOnHand(data.cashOnHand);
        setCashFromDeliveries(data.cashFromDeliveries);
        setCardFromDeliveries(data.cardFromDeliveries || 0);
        setTodayDeposits(data.todayDeposits);
        setTodayWithdrawals(data.todayWithdrawals);
        setTodayDeliveryCount(data.todayDeliveryCount || 0);
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadCash();
    const iv = setInterval(loadCash, 15000);
    return () => clearInterval(iv);
  }, [loadCash]);

  async function handleCashTransaction() {
    const amount = parseFloat(cashAmount);
    if (!cashModal || !amount || amount <= 0) return;
    setCashProcessing(true);
    try {
      const res = await fetch("/api/courier/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: cashModal, amount }),
      });
      if (!res.ok) {
        toast.error("Kasa islemi basarisiz oldu");
        setCashProcessing(false);
        return;
      }
      const data = await res.json();
      setCashOnHand(data.cashOnHand);
      setCashFromDeliveries(data.cashFromDeliveries);
      setCardFromDeliveries(data.cardFromDeliveries || 0);
      setTodayDeposits(data.todayDeposits);
      setTodayWithdrawals(data.todayWithdrawals);
      setCashResult({ type: cashModal, amount, newBalance: data.cashOnHand });
      setCashModal(null);
      setCashAmount("");
      toast.success(cashModal === "deposit" ? "Kasa teslimi basarili" : "Kasadan alma basarili");
      load();
    } catch {
      toast.error("Baglanti hatasi");
    }
    setCashProcessing(false);
  }

  async function startScanner() {
    setScanning(true);
    setScanError("");

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          const match = decodedText.match(/\/courier\/batch\/([a-z0-9]+)/i);
          if (match) {
            stopScanner();
            router.push(`/courier/batch/${match[1]}`);
          } else {
            setScanError("Gecersiz QR kod");
          }
        },
        () => {}
      );
    } catch (err: any) {
      setScanError("Kamera acilamadi: " + (err?.message || "Izin verin"));
    }
  }

  function stopScanner() {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
    setScanning(false);
    setScanError("");
  }

  async function openPayment(d: CourierDelivery) {
    setPaymentModal(d);
    const res = await fetch(`/api/orders/${d.id}`);
    if (res.ok) setOrderDetail(await res.json());
  }

  async function markDelivered(orderId: number, paymentMethod: "cash" | "card") {
    setPaying(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "delivered", paymentMethod }),
      });
      if (!res.ok) {
        toast.error("Teslimat durumu guncellenemedi");
        setPaying(false);
        return;
      }
      toast.success("Siparis teslim edildi");
      setPaymentModal(null);
      setOrderDetail(null);
      load();
      loadCash();
    } catch {
      toast.error("Baglanti hatasi");
    }
    setPaying(false);
  }

  function toggleBulk(id: number) {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function bulkDeliver(paymentMethod: "cash" | "card") {
    if (bulkSelected.size === 0) return;
    setPaying(true);
    try {
      const res = await fetch("/api/orders/bulk-deliver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: Array.from(bulkSelected), paymentMethod }),
      });
      if (!res.ok) {
        toast.error("Toplu teslimat basarisiz oldu");
        setPaying(false);
        return;
      }
      toast.success(`${bulkSelected.size} siparis teslim edildi`);
      setBulkSelected(new Set());
      setBulkMode(false);
      load();
      loadCash();
    } catch {
      toast.error("Baglanti hatasi");
    }
    setPaying(false);
  }

  function togglePick(id: number) {
    setPickSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function assignAndRoute() {
    if (pickSelected.size === 0 || !myStaffId) return;
    setPicking(true);
    try {
      const ids = Array.from(pickSelected);
      for (const orderId of ids) {
        const assignRes = await fetch("/api/delivery/assign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, courierId: myStaffId }),
        });
        if (!assignRes.ok) {
          toast.error(`Siparis #${orderId} atanamadi`);
          setPicking(false);
          load();
          return;
        }
      }
      const batchRes = await fetch("/api/delivery/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: ids, courierId: myStaffId, baseUrl: window.location.origin }),
      });
      if (batchRes.ok) {
        const { token } = await batchRes.json();
        toast.success("Rota olusturuldu");
        setPickSelected(new Set());
        setPicking(false);
        router.push(`/courier/batch/${token}`);
      } else {
        toast.error("Rota olusturulamadi");
        setPicking(false);
        load();
      }
    } catch {
      toast.error("Baglanti hatasi");
      setPicking(false);
      load();
    }
  }

  function getElapsed(createdAt: string) {
    return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  }

  function openFullRoute() {
    const located = deliveries.filter((d) => d.deliveryLatitude && d.deliveryLongitude);
    if (located.length === 0) return;

    const shop = `${shopLocation[0]},${shopLocation[1]}`;
    const waypoints = located.map((d) => `${d.deliveryLatitude},${d.deliveryLongitude}`).join("|");
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    if (isIOS) {
      const daddr = located.map((d) => `${d.deliveryLatitude},${d.deliveryLongitude}`);
      daddr.push(shop);
      window.location.href = `maps://?saddr=${shop}&daddr=${daddr.join("+to:")}`;
    } else {
      window.location.href = `https://www.google.com/maps/dir/?api=1&origin=${shop}&destination=${shop}&waypoints=${encodeURIComponent(waypoints)}&travelmode=driving`;
    }
  }

  function openSingleNav(d: CourierDelivery) {
    if (!d.deliveryLatitude || !d.deliveryLongitude) return;
    const shop = `${shopLocation[0]},${shopLocation[1]}`;
    const dest = `${d.deliveryLatitude},${d.deliveryLongitude}`;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    if (isIOS) {
      window.location.href = `maps://?saddr=${shop}&daddr=${dest}`;
    } else {
      window.location.href = `https://www.google.com/maps/dir/?api=1&origin=${shop}&destination=${dest}&travelmode=driving`;
    }
  }

  async function openCustomerEdit(d: CourierDelivery) {
    const res = await fetch(`/api/courier/customer?orderId=${d.id}`);
    if (!res.ok) return;
    const data = await res.json();

    const addr1: CustomerAddress = { label: "Adres 1", address: "", latitude: null, longitude: null };
    const addr2: CustomerAddress = { label: "Adres 2", address: "", latitude: null, longitude: null };

    if (data.addresses?.length > 0) {
      const a = data.addresses[0];
      addr1.id = a.id;
      addr1.label = a.label || "Adres 1";
      addr1.address = a.address || "";
      addr1.latitude = a.latitude;
      addr1.longitude = a.longitude;
    } else if (data.order?.deliveryAddress) {
      addr1.address = data.order.deliveryAddress;
      addr1.latitude = data.order.deliveryLatitude;
      addr1.longitude = data.order.deliveryLongitude;
    }

    if (data.addresses?.length > 1) {
      const a = data.addresses[1];
      addr2.id = a.id;
      addr2.label = a.label || "Adres 2";
      addr2.address = a.address || "";
      addr2.latitude = a.latitude;
      addr2.longitude = a.longitude;
    }

    let selectedIdx = 0;
    if (d.deliveryAddress && data.addresses?.length > 1) {
      const matchIdx = data.addresses.findIndex((a: any) => a.address === d.deliveryAddress);
      if (matchIdx >= 0) selectedIdx = matchIdx;
    }

    setCustEdit({
      orderId: d.id,
      name: data.customer?.name || d.customerName || "",
      phone: data.customer?.phone || d.customerPhone || "",
      addresses: [addr1, addr2],
      selectedAddressIndex: selectedIdx,
    });
  }

  function openNewCustomer() {
    setCustEdit({
      orderId: 0,
      name: "",
      phone: "",
      addresses: [
        { label: "Adres 1", address: "", latitude: null, longitude: null },
        { label: "Adres 2", address: "", latitude: null, longitude: null },
      ],
      selectedAddressIndex: 0,
    });
  }

  function handleCustPhoneChange(value: string) {
    if (!custEdit) return;
    setCustEdit({ ...custEdit, phone: value });
    if (custPhoneTimerRef.current) clearTimeout(custPhoneTimerRef.current);
    const digits = value.replace(/\D/g, "");
    if (digits.length >= 10) {
      custPhoneTimerRef.current = setTimeout(() => lookupCustPhone(digits), 400);
    }
  }

  async function lookupCustPhone(phone: string) {
    setCustPhoneSearching(true);
    try {
      const res = await fetch(`/api/courier/customer?phone=${encodeURIComponent(phone)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.customer) {
          const addr1: CustomerAddress = { label: "Adres 1", address: "", latitude: null, longitude: null };
          const addr2: CustomerAddress = { label: "Adres 2", address: "", latitude: null, longitude: null };
          if (data.addresses?.length > 0) {
            const a = data.addresses[0];
            addr1.id = a.id; addr1.label = a.label || "Adres 1"; addr1.address = a.address || ""; addr1.latitude = a.latitude; addr1.longitude = a.longitude;
          }
          if (data.addresses?.length > 1) {
            const a = data.addresses[1];
            addr2.id = a.id; addr2.label = a.label || "Adres 2"; addr2.address = a.address || ""; addr2.latitude = a.latitude; addr2.longitude = a.longitude;
          }
          setCustEdit((prev) => prev ? {
            ...prev,
            name: data.customer.name || prev.name,
            addresses: [addr1, addr2],
          } : prev);
        }
      }
    } catch {}
    setCustPhoneSearching(false);
  }

  function getMyLocation(addrIdx: 0 | 1) {
    if (!navigator.geolocation || !custEdit) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        let addrText = "";
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`, { headers: { "Accept-Language": "tr" } });
          const data = await res.json();
          addrText = data.display_name || "";
        } catch {}
        setCustEdit((prev) => {
          if (!prev) return prev;
          const addrs = [...prev.addresses] as [CustomerAddress, CustomerAddress];
          addrs[addrIdx] = { ...addrs[addrIdx], latitude, longitude, address: addrText || addrs[addrIdx].address };
          return { ...prev, addresses: addrs };
        });
      },
      () => alert("Konum alinamadi. Konum iznini kontrol edin."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function openMapForAddress(idx: 0 | 1) {
    setCustMapIdx(idx);
  }

  useEffect(() => {
    if (custMapIdx === null || !mapContainerRef.current) return;
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      mapMarkerRef.current = null;
    }

    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !mapContainerRef.current) return;
      const addr = custEdit?.addresses[custMapIdx];
      const center: [number, number] = addr?.latitude && addr?.longitude
        ? [addr.latitude, addr.longitude]
        : shopLocation;

      const map = L.map(mapContainerRef.current!, { minZoom: 13, maxZoom: 18 }).setView(center, 16);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OSM" }).addTo(map);
      map.getContainer().style.cursor = "crosshair";

      const pinIcon = L.divIcon({
        html: `<div style="background:#a855f7;width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg></div>`,
        className: "",
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      if (addr?.latitude && addr?.longitude) {
        mapMarkerRef.current = L.marker([addr.latitude, addr.longitude], { icon: pinIcon }).addTo(map);
      }

      map.on("click", (e: any) => {
        const { lat, lng } = e.latlng;
        if (mapMarkerRef.current) {
          mapMarkerRef.current.setLatLng([lat, lng]);
        } else {
          mapMarkerRef.current = L.marker([lat, lng], { icon: pinIcon }).addTo(map);
        }
        setCustEdit((prev) => {
          if (!prev || custMapIdx === null) return prev;
          const addrs = [...prev.addresses] as [CustomerAddress, CustomerAddress];
          addrs[custMapIdx] = { ...addrs[custMapIdx], latitude: lat, longitude: lng };
          return { ...prev, addresses: addrs };
        });
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, { headers: { "Accept-Language": "tr" } })
          .then((r) => r.json())
          .then((data) => {
            if (data.display_name) {
              setCustEdit((prev) => {
                if (!prev || custMapIdx === null) return prev;
                const addrs = [...prev.addresses] as [CustomerAddress, CustomerAddress];
                addrs[custMapIdx] = { ...addrs[custMapIdx], address: data.display_name };
                return { ...prev, addresses: addrs };
              });
            }
          })
          .catch(() => {});
      });

      mapInstanceRef.current = map;
      setTimeout(() => map.invalidateSize(), 100);
    });

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        mapMarkerRef.current = null;
      }
    };
  }, [custMapIdx]);

  async function saveCustomerEdit() {
    if (!custEdit) return;
    setCustSaving(true);
    try {
      const res = await fetch("/api/courier/customer", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: custEdit.orderId || undefined,
          name: custEdit.name,
          phone: custEdit.phone,
          addresses: custEdit.addresses.filter((a) => a.address.trim()),
          selectedAddressIndex: custEdit.selectedAddressIndex,
        }),
      });
      if (!res.ok) {
        toast.error("Musteri bilgileri kaydedilemedi");
        setCustSaving(false);
        return;
      }
      toast.success("Musteri bilgileri kaydedildi");
      setCustEdit(null);
      setCustMapIdx(null);
      load();
    } catch {
      toast.error("Baglanti hatasi");
    }
    setCustSaving(false);
  }

  const locatedCount = deliveries.filter((d) => d.deliveryLatitude && d.deliveryLongitude).length;

  return (
    <div className="p-4 space-y-4">
      {/* QR Scanner - inline at top */}
      <div className="rounded-2xl overflow-hidden border border-border bg-black">
        {scanning ? (
          <>
            <div id="qr-reader" className="w-full" />
            {scanError && (
              <div className="bg-red-600/90 text-white text-center py-2 text-xs font-medium">{scanError}</div>
            )}
            <button onClick={stopScanner} className="w-full py-2.5 bg-neutral-800 text-white/40 text-xs font-medium">Kamerayi Kapat</button>
          </>
        ) : (
          <button
            onClick={startScanner}
            className="w-full py-5 flex flex-col items-center gap-1.5 bg-purple-600/10 active:bg-purple-600/20 transition-all"
          >
            <svg className="w-7 h-7 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            <span className="text-purple-400 font-bold text-sm">QR Kod Okut</span>
            <span className="text-white/20 text-xs">Kamerayi ac</span>
          </button>
        )}
      </div>

      {/* Cash on Hand */}
      <div className="bg-surface-1 rounded-2xl border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-green-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-white/40 text-xs">Uzerimdeki Nakit</p>
              <p className="text-2xl font-bold text-green-400">{cashOnHand.toFixed(0)} TL</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mb-3 text-[11px]">
          {todayDeliveryCount > 0 && (
            <span className="bg-white/5 text-white/40 px-2 py-0.5 rounded-lg">{todayDeliveryCount} teslimat</span>
          )}
          {cashFromDeliveries > 0 && (
            <span className="bg-green-500/10 text-green-400/80 px-2 py-0.5 rounded-lg">Nakit: {cashFromDeliveries.toFixed(0)} TL</span>
          )}
          {cardFromDeliveries > 0 && (
            <span className="bg-blue-500/10 text-blue-400/80 px-2 py-0.5 rounded-lg">POS: {cardFromDeliveries.toFixed(0)} TL</span>
          )}
          {todayWithdrawals > 0 && (
            <span className="bg-cyan-500/10 text-cyan-400/80 px-2 py-0.5 rounded-lg">Alinan: {todayWithdrawals.toFixed(0)} TL</span>
          )}
          {todayDeposits > 0 && (
            <span className="bg-amber-500/10 text-amber-400/80 px-2 py-0.5 rounded-lg">Birakilan: {todayDeposits.toFixed(0)} TL</span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => { setCashModal("deposit"); setCashAmount(cashOnHand > 0 ? cashOnHand.toFixed(0) : ""); setCashResult(null); }}
            className="py-3 rounded-xl bg-amber-600/20 border border-amber-500/30 text-amber-300 font-bold text-sm transition-all active:scale-[0.97] flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
            Kasa Teslimi
          </button>
          <button
            onClick={() => { setCashModal("withdrawal"); setCashAmount(""); setCashResult(null); }}
            className="py-3 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-300 font-bold text-sm transition-all active:scale-[0.97] flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
            Kasadan Al
          </button>
        </div>
      </div>

      {/* Pending packages - selectable list */}
      {pendingPackages.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div>
                <p className="text-orange-400 font-bold text-sm">{pendingPackages.length} paket hazir</p>
                <p className="text-white/30 text-[11px]">Sec ve rotani olustur</p>
              </div>
            </div>
            {pickSelected.size > 0 && (
              <span className="bg-orange-500 text-black font-bold text-xs px-2.5 py-1 rounded-full">{pickSelected.size} secili</span>
            )}
          </div>

          {pendingPackages.map((p) => {
            const selected = pickSelected.has(p.id);
            return (
              <div
                key={p.id}
                onClick={() => togglePick(p.id)}
                className={`rounded-xl p-3 border transition-all active:scale-[0.98] cursor-pointer ${
                  selected ? "bg-orange-500/15 border-orange-500/50" : "bg-surface-1 border-border"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                    selected ? "bg-orange-500 border-orange-500" : "border-white/20"
                  }`}>
                    {selected && (
                      <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm">#{p.id} {p.customerName || "Isimsiz"}</span>
                      <span className="text-orange-400 font-bold text-sm">{p.total.toFixed(0)} TL</span>
                    </div>
                    <p className="text-white/40 text-xs truncate mt-0.5">{p.deliveryAddress}</p>
                  </div>
                </div>
              </div>
            );
          })}

          {pickSelected.size > 0 && (
            <button
              onClick={assignAndRoute}
              disabled={picking}
              className="w-full py-4 rounded-2xl bg-orange-500 hover:bg-orange-400 text-black font-bold text-lg transition-all active:scale-[0.97] disabled:opacity-40"
            >
              {picking ? "Ataniyor..." : `Rota Olustur (${pickSelected.size} paket)`}
            </button>
          )}
        </div>
      )}

      {/* Header + Bulk toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Teslimatlarim</h1>
          <p className="text-white/40 text-xs">{deliveries.length} aktif teslimat</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openNewCustomer}
            className="px-3 py-2 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-300 text-xs font-bold transition-all active:scale-[0.97] flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
            Yeni Musteri
          </button>
          {deliveries.length > 0 && (
            <button
              onClick={() => { setBulkMode(!bulkMode); setBulkSelected(new Set()); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-[0.97] ${bulkMode ? "bg-amber-500 text-black" : "bg-surface-2 text-white/50"}`}
            >
              {bulkMode ? "Toplu Aktif" : "Toplu Teslim"}
            </button>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {bulkMode && bulkSelected.size > 0 && (
        <div className="sticky top-0 z-40 bg-neutral-900/95 backdrop-blur-sm rounded-2xl p-4 border border-amber-500/30 space-y-3">
          <p className="text-center text-white font-semibold">{bulkSelected.size} siparis secildi &middot; {deliveries.filter((d) => bulkSelected.has(d.id)).reduce((s, d) => s + d.total, 0).toFixed(0)} TL</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => bulkDeliver("cash")}
              disabled={paying}
              className="py-4 rounded-2xl bg-green-600 hover:bg-green-500 text-white font-bold text-lg transition-all active:scale-[0.97] disabled:opacity-40"
            >
              Toplu Nakit
            </button>
            <button
              onClick={() => bulkDeliver("card")}
              disabled={paying}
              className="py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg transition-all active:scale-[0.97] disabled:opacity-40"
            >
              Toplu Kart
            </button>
          </div>
        </div>
      )}

      {locatedCount > 1 && (
        <button
          onClick={openFullRoute}
          className="w-full py-4 rounded-2xl bg-accent text-black font-bold text-center text-lg transition-all active:scale-[0.97] shadow-lg shadow-accent/30"
        >
          Tum Guzergahi Ac ({locatedCount} durak + donus)
        </button>
      )}

      {deliveries.map((d) => (
        <div key={d.id} className={`bg-surface-1 rounded-2xl p-4 border transition-all ${bulkMode && bulkSelected.has(d.id) ? "border-amber-500/50" : "border-border"}`} onClick={bulkMode ? () => toggleBulk(d.id) : undefined}>
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-2">
              {bulkMode && (
                <input type="checkbox" checked={bulkSelected.has(d.id)} onChange={() => toggleBulk(d.id)} className="accent-amber-500 w-5 h-5" onClick={(e) => e.stopPropagation()} />
              )}
              <span className="font-bold text-lg">#{d.id}</span>
              <span className="text-xs bg-purple-600/20 text-purple-400 px-2 py-0.5 rounded">YOLDA</span>
            </div>
            <span className="text-white/40 text-sm">{getElapsed(d.createdAt)}dk</span>
          </div>

          <div className="space-y-2 mb-4">
            <div>
              <p className="text-xs text-white/40">Musteri</p>
              <p className="font-medium">{d.customerName || "Isimsiz"}</p>
            </div>
            {d.customerPhone && (
              <div>
                <p className="text-xs text-white/40">Telefon</p>
                <a href={`tel:${d.customerPhone}`} className="text-blue-400 font-medium">{d.customerPhone}</a>
              </div>
            )}
            <div>
              <p className="text-xs text-white/40">Adres</p>
              <p className="font-medium">{d.deliveryAddress}</p>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-surface-2 rounded-xl mb-4">
            <span className="text-white/40 text-sm">Tutar</span>
            <span className="text-xl font-bold text-accent">{d.total.toFixed(0)} TL</span>
          </div>

          {!bulkMode && (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                {d.deliveryLatitude && d.deliveryLongitude && (
                  <button
                    onClick={() => openSingleNav(d)}
                    className="py-3 rounded-xl bg-amber-600 text-white font-bold text-sm text-center transition-all active:scale-[0.97]"
                  >
                    YOL TARiFi
                  </button>
                )}
                {d.customerPhone && (
                  <a
                    href={`tel:${d.customerPhone}`}
                    className="py-3 rounded-xl bg-blue-600 text-white font-bold text-sm text-center"
                  >
                    ARA
                  </a>
                )}
                <button
                  onClick={() => openPayment(d)}
                  className={`py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold text-sm transition-all active:scale-[0.97] ${
                    !d.deliveryLatitude && !d.customerPhone ? "col-span-3" :
                    !d.deliveryLatitude || !d.customerPhone ? "col-span-2" : ""
                  }`}
                >
                  TESLiM
                </button>
              </div>
              <button
                onClick={() => openCustomerEdit(d)}
                className="w-full py-2.5 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-300 font-semibold text-sm transition-all active:scale-[0.97] flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                Musteriyi Duzenle
              </button>
            </div>
          )}
        </div>
      ))}

      {deliveries.length === 0 && (
        <div className="text-center py-20">
          <p className="text-white/20 text-lg">Aktif teslimat yok</p>
          <p className="text-white/10 text-sm mt-1">8s yenileme</p>
        </div>
      )}

      {/* Customer Edit Modal */}
      {custEdit && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={() => !custSaving && (setCustEdit(null), setCustMapIdx(null))}>
          <div className="bg-neutral-900 rounded-t-3xl w-full max-w-md max-h-[95vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-neutral-800/60 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-bold text-white">{custEdit.orderId ? "Musteri Duzenle" : "Yeni Musteri Ekle"}</h3>
                {custEdit.orderId ? <p className="text-white/40 text-xs">Siparis #{custEdit.orderId}</p> : <p className="text-white/40 text-xs">Yeni musteri kaydi olustur</p>}
              </div>
              <button onClick={() => { setCustEdit(null); setCustMapIdx(null); }} className="w-9 h-9 bg-neutral-800 rounded-full flex items-center justify-center text-white/40">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Name */}
              <div>
                <label className="text-xs text-white/40 mb-1 block">Ad Soyad</label>
                <input
                  type="text"
                  value={custEdit.name}
                  onChange={(e) => setCustEdit({ ...custEdit, name: e.target.value })}
                  className="w-full bg-neutral-800 rounded-xl px-4 py-3 text-white border border-neutral-700/50 focus:outline-none focus:border-purple-500/50"
                  placeholder="Musteri adi"
                />
              </div>

              {/* Phone */}
              <div className="relative">
                <label className="text-xs text-white/40 mb-1 block">Telefon</label>
                <input
                  type="tel"
                  value={custEdit.phone}
                  onChange={(e) => !custEdit.orderId ? handleCustPhoneChange(e.target.value) : setCustEdit({ ...custEdit, phone: e.target.value })}
                  className="w-full bg-neutral-800 rounded-xl px-4 py-3 text-white border border-neutral-700/50 focus:outline-none focus:border-purple-500/50"
                  placeholder="05xx xxx xx xx"
                />
                {custPhoneSearching && (
                  <div className="absolute right-3 top-8">
                    <div className="w-4 h-4 border-2 border-purple-400/40 border-t-purple-400 rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {/* Address 1 */}
              <div className="bg-neutral-800/50 rounded-2xl p-3 space-y-2 border border-neutral-700/30">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white/60 uppercase">Adres 1</label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="selectedAddr"
                      checked={custEdit.selectedAddressIndex === 0}
                      onChange={() => setCustEdit({ ...custEdit, selectedAddressIndex: 0 })}
                      className="accent-purple-500"
                    />
                    <span className="text-xs text-white/50">Teslim adresi</span>
                  </label>
                </div>
                <input
                  type="text"
                  value={custEdit.addresses[0].address}
                  onChange={(e) => {
                    const addrs = [...custEdit.addresses] as [CustomerAddress, CustomerAddress];
                    addrs[0] = { ...addrs[0], address: e.target.value };
                    setCustEdit({ ...custEdit, addresses: addrs });
                  }}
                  className="w-full bg-neutral-900 rounded-lg px-3 py-2.5 text-sm text-white border border-neutral-700/50 focus:outline-none focus:border-purple-500/50"
                  placeholder="Adres girin..."
                />
                {custEdit.addresses[0].latitude && (
                  <p className="text-xs text-green-400/70 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/></svg>
                    Konum: {custEdit.addresses[0].latitude.toFixed(5)}, {custEdit.addresses[0].longitude?.toFixed(5)}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => getMyLocation(0)}
                    className="py-2.5 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-300 text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-[0.97]"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Konumumu Al
                  </button>
                  <button
                    onClick={() => openMapForAddress(0)}
                    className="py-2.5 rounded-lg bg-green-600/20 border border-green-500/30 text-green-300 text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-[0.97]"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                    Haritadan Sec
                  </button>
                </div>
              </div>

              {/* Address 2 */}
              <div className="bg-neutral-800/50 rounded-2xl p-3 space-y-2 border border-neutral-700/30">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white/60 uppercase">Adres 2</label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="selectedAddr"
                      checked={custEdit.selectedAddressIndex === 1}
                      onChange={() => setCustEdit({ ...custEdit, selectedAddressIndex: 1 })}
                      className="accent-purple-500"
                    />
                    <span className="text-xs text-white/50">Teslim adresi</span>
                  </label>
                </div>
                <input
                  type="text"
                  value={custEdit.addresses[1].address}
                  onChange={(e) => {
                    const addrs = [...custEdit.addresses] as [CustomerAddress, CustomerAddress];
                    addrs[1] = { ...addrs[1], address: e.target.value };
                    setCustEdit({ ...custEdit, addresses: addrs });
                  }}
                  className="w-full bg-neutral-900 rounded-lg px-3 py-2.5 text-sm text-white border border-neutral-700/50 focus:outline-none focus:border-purple-500/50"
                  placeholder="2. adres (istege bagli)..."
                />
                {custEdit.addresses[1].latitude && (
                  <p className="text-xs text-green-400/70 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/></svg>
                    Konum: {custEdit.addresses[1].latitude.toFixed(5)}, {custEdit.addresses[1].longitude?.toFixed(5)}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => getMyLocation(1)}
                    className="py-2.5 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-300 text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-[0.97]"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Konumumu Al
                  </button>
                  <button
                    onClick={() => openMapForAddress(1)}
                    className="py-2.5 rounded-lg bg-green-600/20 border border-green-500/30 text-green-300 text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-[0.97]"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                    Haritadan Sec
                  </button>
                </div>
              </div>

              {/* Inline Map */}
              {custMapIdx !== null && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-white/60">Haritaya tiklayarak konum secin</p>
                    <button onClick={() => setCustMapIdx(null)} className="text-xs text-red-400 font-medium">Kapat</button>
                  </div>
                  <div ref={mapContainerRef} className="w-full h-[250px] rounded-xl overflow-hidden border border-neutral-700/50" />
                </div>
              )}
            </div>

            {/* Save Button */}
            <div className="p-4 border-t border-neutral-800/60 shrink-0">
              <button
                onClick={saveCustomerEdit}
                disabled={custSaving || !custEdit.phone.trim()}
                className="w-full py-4 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-lg transition-all active:scale-[0.97] disabled:opacity-40"
              >
                {custSaving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cash Transaction Modal */}
      {cashModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => !cashProcessing && setCashModal(null)}>
          <div className="bg-neutral-900 rounded-3xl w-[90%] max-w-sm p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className={`w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center ${cashModal === "deposit" ? "bg-amber-500/20" : "bg-blue-500/20"}`}>
                {cashModal === "deposit" ? (
                  <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                ) : (
                  <svg className="w-7 h-7 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                )}
              </div>
              <h3 className="text-lg font-bold text-white">{cashModal === "deposit" ? "Kasa Teslimi" : "Kasadan Al"}</h3>
              <p className="text-white/40 text-xs mt-1">
                {cashModal === "deposit" ? "Kasaya teslim edecaginiz tutari girin" : "Kasadan alacaginiz tutari girin"}
              </p>
            </div>

            <div className="relative">
              <input
                type="number"
                inputMode="numeric"
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
                className="w-full bg-neutral-800 rounded-2xl px-5 py-4 text-center text-3xl font-bold text-white border border-neutral-700/50 focus:outline-none focus:border-purple-500/50"
                placeholder="0"
                autoFocus
              />
              <span className="absolute right-5 top-1/2 -translate-y-1/2 text-white/30 font-bold text-lg">TL</span>
            </div>

            {cashModal === "deposit" && cashOnHand > 0 && (
              <button
                onClick={() => setCashAmount(cashOnHand.toFixed(0))}
                className="w-full py-2 rounded-xl bg-neutral-800 text-white/50 text-sm font-medium"
              >
                Tumunu teslim et ({cashOnHand.toFixed(0)} TL)
              </button>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setCashModal(null)}
                className="py-3.5 rounded-2xl bg-neutral-800 text-white/50 font-bold text-sm"
              >
                Iptal
              </button>
              <button
                onClick={handleCashTransaction}
                disabled={cashProcessing || !cashAmount || parseFloat(cashAmount) <= 0}
                className={`py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-[0.97] disabled:opacity-40 ${
                  cashModal === "deposit"
                    ? "bg-amber-500 text-black"
                    : "bg-blue-500 text-white"
                }`}
              >
                {cashProcessing ? "Isleniyor..." : "Onayla"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cash Result Modal */}
      {cashResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setCashResult(null)}>
          <div className="bg-neutral-900 rounded-3xl w-[90%] max-w-sm p-6 space-y-4 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-16 h-16 rounded-full bg-green-500/20 mx-auto flex items-center justify-center">
              <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Islem Basarili</h3>
              <p className="text-white/50 text-sm mt-1">
                {cashResult.type === "deposit"
                  ? `Kasaya ${cashResult.amount.toFixed(0)} TL teslim edildi`
                  : `Kasadan ${cashResult.amount.toFixed(0)} TL alindi`}
              </p>
            </div>
            <div className="bg-neutral-800 rounded-2xl p-4">
              <p className="text-white/40 text-xs mb-1">Uzerimdeki Nakit</p>
              <p className="text-3xl font-bold text-green-400">{cashResult.newBalance.toFixed(0)} TL</p>
            </div>
            <button
              onClick={() => setCashResult(null)}
              className="w-full py-3.5 rounded-2xl bg-green-500 text-black font-bold text-sm transition-all active:scale-[0.97]"
            >
              Tamam
            </button>
          </div>
        </div>
      )}

      <ToastContainer toasts={toast.toasts} />

      {/* Payment Modal with Order Details */}
      {paymentModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={() => !paying && (setPaymentModal(null), setOrderDetail(null))}>
          <div className="bg-neutral-900 rounded-t-3xl w-full max-w-md max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="p-5 text-center border-b border-neutral-800/60 shrink-0">
              <h3 className="text-lg font-bold text-white">Siparis #{paymentModal.id}</h3>
              <p className="text-white/40 text-sm mt-1">{paymentModal.customerName || "Isimsiz"}{paymentModal.customerPhone ? ` • ${paymentModal.customerPhone}` : ""}</p>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto p-5">
              {orderDetail ? (
                <>
                  <div className="space-y-2.5">
                    {orderDetail.items.map((item, i) => (
                      <div key={i} className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-white/50 text-sm font-bold">{item.quantity}x</span>
                            <span className="text-white text-sm font-medium">{item.name}</span>
                          </div>
                          {item.removed.length > 0 && (
                            <p className="text-red-400/60 text-[11px] ml-7">- {item.removed.join(", ")}</p>
                          )}
                          {item.extras.length > 0 && (
                            <p className="text-amber-400/60 text-[11px] ml-7">+ {item.extras.map((e) => e.name).join(", ")}</p>
                          )}
                          {item.notes && (
                            <p className="text-blue-400/50 text-[11px] ml-7 italic">{item.notes}</p>
                          )}
                        </div>
                        <span className="text-white/70 text-sm font-semibold shrink-0">{item.totalPrice.toFixed(0)} TL</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-3 border-t border-neutral-800/60 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-white/40">Ara Toplam</span>
                      <span className="text-white/60">{orderDetail.subtotal.toFixed(0)} TL</span>
                    </div>
                    {orderDetail.deliveryFee > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-white/40">Teslimat</span>
                        <span className="text-white/60">{orderDetail.deliveryFee.toFixed(0)} TL</span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
                </div>
              )}

              {/* Total */}
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-neutral-800/60">
                <span className="text-white text-lg font-bold">Toplam</span>
                <span className="text-amber-400 text-2xl font-extrabold">{paymentModal.total.toFixed(0)} TL</span>
              </div>
            </div>

            {/* Actions */}
            <div className="p-5 border-t border-neutral-800/60 space-y-3 shrink-0">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => markDelivered(paymentModal.id, "cash")}
                  disabled={paying}
                  className="py-4 rounded-2xl bg-green-600 hover:bg-green-500 text-white font-bold text-lg transition-all active:scale-[0.97] disabled:opacity-40"
                >
                  Nakit
                </button>
                <button
                  onClick={() => markDelivered(paymentModal.id, "card")}
                  disabled={paying}
                  className="py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg transition-all active:scale-[0.97] disabled:opacity-40"
                >
                  Kart
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => window.open(`/receipt/${paymentModal.id}`, "_blank")}
                  className="py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white/60 font-medium text-sm transition-all active:scale-[0.97] flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                  Fis Yazdir
                </button>
                <button
                  onClick={() => { setPaymentModal(null); setOrderDetail(null); }}
                  disabled={paying}
                  className="py-3 rounded-xl bg-neutral-800 text-white/40 font-medium text-sm"
                >
                  Iptal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
