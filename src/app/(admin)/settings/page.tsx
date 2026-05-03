"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
import QRCode from "qrcode";

const LocationPicker = dynamic(() => import("@/components/location-picker"), { ssr: false });

const STATUS_OPTIONS = [
  { value: "available", label: "Acik", color: "bg-green-500" },
  { value: "busy", label: "Yogun", color: "bg-orange-500" },
  { value: "break", label: "Mola", color: "bg-yellow-500" },
  { value: "closed", label: "Kapali", color: "bg-red-500" },
];

const SETTING_GROUPS = [
  {
    title: "Isletme Bilgileri",
    fields: [
      { key: "business_name", label: "Isletme Adi", type: "text" },
      { key: "business_phone", label: "Telefon", type: "text" },
      { key: "business_address", label: "Adres", type: "text" },
    ],
  },
  {
    title: "Calisma Saatleri",
    fields: [
      { key: "work_hours_start", label: "Acilis Saati", type: "time" },
      { key: "work_hours_end", label: "Kapanis Saati", type: "time" },
      { key: "work_days", label: "Calisma Gunleri", type: "text", placeholder: "Pzt-Cmt" },
    ],
  },
  {
    title: "Teslimat Ayarlari",
    fields: [
      { key: "default_delivery_fee", label: "Teslimat Ucreti (TL)", type: "number" },
      { key: "min_order_amount", label: "Min Siparis Tutari (TL)", type: "number" },
      { key: "delivery_radius_km", label: "Teslimat Yaricapi (km)", type: "number" },
      { key: "estimated_delivery_minutes", label: "Tahmini Teslimat (dk)", type: "number" },
    ],
  },
  {
    title: "__MAP__",
    fields: [],
  },
  {
    title: "Siparis Ayarlari",
    fields: [
      { key: "tax_rate", label: "KDV Orani (%)", type: "number" },
      { key: "loyalty_points_per_tl", label: "TL Basina Puan", type: "number" },
      { key: "loyalty_min_redeem", label: "Min Harcama Puani", type: "number" },
    ],
  },
];

interface TableRow {
  id: number;
  number: number;
  label: string | null;
  token: string;
  capacity: number;
  isActive: boolean;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [businessStatus, setBusinessStatus] = useState<string>("closed");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [wpQr, setWpQr] = useState<string | null>(null);
  const [botStatus, setBotStatus] = useState<{ connected: boolean; hasQR: boolean; uptime: number; phone?: string } | null>(null);
  const [botQr, setBotQr] = useState<string | null>(null);

  const [tableInput, setTableInput] = useState<string>("");
  const [tablesData, setTablesData] = useState<TableRow[]>([]);
  const [tableQrs, setTableQrs] = useState<Record<number, string>>({});
  const [tablesLoading, setTablesLoading] = useState(false);
  const [tablesSaving, setTablesSaving] = useState(false);

  const loadTables = useCallback(async () => {
    setTablesLoading(true);
    try {
      const res = await fetch("/api/tables");
      const data: TableRow[] = await res.json();
      const active = data.filter((t) => t.isActive);
      setTablesData(active);
      setTableInput(active.length.toString());
      const qrs: Record<number, string> = {};
      for (const t of active) {
        const url = `${window.location.origin}/table/${t.number}`;
        qrs[t.number] = await QRCode.toDataURL(url, {
          width: 300,
          margin: 1,
          color: { dark: "#F59E0B", light: "#1a1a1a" },
        });
      }
      setTableQrs(qrs);
    } catch { /* ignore */ }
    setTablesLoading(false);
  }, []);

  async function saveTables() {
    const num = parseInt(tableInput);
    if (!num || num < 1 || num > 200) return;
    setTablesSaving(true);
    try {
      await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: num }),
      });
      await loadTables();
    } catch { /* ignore */ }
    setTablesSaving(false);
  }

  function printTableQr(tableNumber: number, qrDataUrl: string) {
    const w = window.open("", "_blank", "width=400,height=500");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Masa ${tableNumber} QR</title><style>body{margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#1a1a1a;color:#fff;font-family:system-ui}img{width:280px;height:280px;border-radius:16px}h1{font-size:48px;margin:20px 0 4px;color:#F59E0B}p{font-size:14px;opacity:.5;margin:0}@media print{body{background:#fff;color:#000}h1{color:#000}}</style></head><body><img src="${qrDataUrl}" /><h1>Masa ${tableNumber}</h1><p>Varosh Streetfood</p><script>setTimeout(()=>window.print(),300)<\/script></body></html>`);
    w.document.close();
  }

  function printAllQrs() {
    const w = window.open("", "_blank", "width=800,height=1000");
    if (!w) return;
    let cards = "";
    for (const t of tablesData) {
      const qr = tableQrs[t.number];
      if (!qr) continue;
      cards += `<div class="card"><img src="${qr}" /><h2>Masa ${t.number}</h2><p>QR okutarak siparis ver</p></div>`;
    }
    w.document.write(`<!DOCTYPE html><html><head><title>Tum Masa QR Kodlari</title><style>body{margin:0;padding:20px;background:#1a1a1a;color:#fff;font-family:system-ui}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:20px}.card{background:#262626;border-radius:16px;padding:16px;text-align:center}img{width:180px;height:180px;border-radius:12px}h2{font-size:24px;margin:10px 0 2px;color:#F59E0B}p{font-size:11px;opacity:.4;margin:0}@media print{body{background:#fff;color:#000}.card{background:#f5f5f5;break-inside:avoid}h2{color:#000}}</style></head><body><div class="grid">${cards}</div><script>setTimeout(()=>window.print(),500)<\/script></body></html>`);
    w.document.close();
  }

  const load = useCallback(async () => {
    const [settingsRes, statusRes] = await Promise.all([
      fetch("/api/settings"),
      fetch("/api/settings/business-status"),
    ]);
    setSettings(await settingsRes.json());
    const statusData = await statusRes.json();
    setBusinessStatus(statusData.status);
  }, []);

  useEffect(() => { load(); loadTables(); }, [load, loadTables]);

  // WhatsApp Bot durum kontrolu
  useEffect(() => {
    let active = true;
    const BOT_URL = `${window.location.protocol}//${window.location.hostname}:3003`;
    async function checkBot() {
      try {
        const res = await fetch(`${BOT_URL}/status`, { signal: AbortSignal.timeout(2000) });
        if (!active) return;
        const data = await res.json();
        setBotStatus(data);
        if (!data.connected && data.hasQR) {
          const qrRes = await fetch(`${BOT_URL}/qr`);
          const qrData = await qrRes.json();
          if (active && qrData.qr) setBotQr(qrData.qr);
        } else {
          setBotQr(null);
        }
      } catch {
        if (active) { setBotStatus(null); setBotQr(null); }
      }
    }
    checkBot();
    const interval = setInterval(checkBot, 3000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  const [orderQr, setOrderQr] = useState<string | null>(null);

  useEffect(() => {
    const phone = settings.business_phone?.replace(/\D/g, "").replace(/^0/, "90");
    if (phone && phone.length >= 10) {
      QRCode.toDataURL(`https://wa.me/${phone}`, {
        width: 200,
        margin: 1,
        color: { dark: "#25D366", light: "#1a1a1a" },
      }).then(setWpQr);
    } else {
      setWpQr(null);
    }

    if (typeof window !== "undefined") {
      QRCode.toDataURL(`${window.location.origin}/siparis`, {
        width: 200,
        margin: 1,
        color: { dark: "#F59E0B", light: "#1a1a1a" },
      }).then(setOrderQr);
    }
  }, [settings.business_phone]);

  async function saveSettings() {
    setSaving(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function changeStatus(status: string) {
    await fetch("/api/settings/business-status", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusinessStatus(status);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Ayarlar</h2>
        <Button onClick={saveSettings} disabled={saving}>
          {saving ? "Kaydediliyor..." : saved ? "Kaydedildi!" : "Kaydet"}
        </Button>
      </div>

      {/* Business Status */}
      <div className="card mb-6">
        <h3 className="text-lg font-semibold mb-4">Isletme Durumu</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => changeStatus(opt.value)}
              className={`p-4 rounded-xl border-2 transition-all text-center font-semibold ${
                businessStatus === opt.value
                  ? `${opt.color} border-white/20 text-white`
                  : "bg-surface-2 border-transparent text-white/40 hover:border-white/10"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Backup */}
      <div className="card mb-6">
        <h3 className="text-lg font-semibold mb-4">Yedekleme</h3>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={async () => {
              const res = await fetch("/api/backup", { method: "POST" });
              const data = await res.json();
              if (data.ok) alert(`Yedek alindi! (${data.count} yedek mevcut)`);
            }}
          >
            Sunucu Yedegi Al
          </Button>
          <Button
            variant="secondary"
            onClick={() => { window.open("/api/backup", "_blank"); }}
          >
            Veritabanini Indir
          </Button>
        </div>
        <p className="text-xs text-white/30 mt-2">Sunucu yedegi ./backups klasorune kaydedilir (max 10 adet)</p>
      </div>

      {/* Masa Yonetimi */}
      <div className="card mb-6">
        <h3 className="text-lg font-semibold mb-4">Masa Yonetimi</h3>
        <div className="flex items-end gap-3 mb-4">
          <div className="flex-1">
            <label className="text-xs text-white/40 mb-1 block">Masa Sayisi</label>
            <input
              type="number"
              min={1}
              max={200}
              value={tableInput}
              onChange={(e) => setTableInput(e.target.value)}
              className="input-field"
              placeholder="Ornegin: 10"
            />
          </div>
          <Button onClick={saveTables} disabled={tablesSaving}>
            {tablesSaving ? "Olusturuluyor..." : "Masalari Olustur"}
          </Button>
          {tablesData.length > 0 && (
            <Button variant="secondary" onClick={printAllQrs}>
              Tumunu Yazdir
            </Button>
          )}
        </div>
        {tablesLoading ? (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mx-auto" />
            <p className="text-white/30 text-sm mt-2">Masalar yukleniyor...</p>
          </div>
        ) : tablesData.length === 0 ? (
          <div className="bg-surface-2 rounded-xl p-6 text-center">
            <div className="text-3xl mb-2 opacity-40">🪑</div>
            <p className="text-white/40 text-sm">Henuz masa olusturulmadi. Yukardaki alana masa sayisini girip &quot;Masalari Olustur&quot; butonuna basin.</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-white/30 mb-3">{tablesData.length} aktif masa &middot; QR kodlar mekan fiyatlariyla menuyu acar &middot; Tiklayarak tek tek yazdirabilirsiniz</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {tablesData.map((t) => (
                <button
                  key={t.id}
                  onClick={() => tableQrs[t.number] && printTableQr(t.number, tableQrs[t.number])}
                  className="bg-surface-2 rounded-xl p-3 text-center hover:bg-surface-2/80 transition-all hover:ring-1 hover:ring-amber-500/30 group"
                >
                  {tableQrs[t.number] ? (
                    <img src={tableQrs[t.number]} alt={`Masa ${t.number}`} className="w-full aspect-square rounded-lg mb-2" />
                  ) : (
                    <div className="w-full aspect-square rounded-lg bg-neutral-800 mb-2 flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                    </div>
                  )}
                  <p className="text-amber-400 font-bold text-sm">Masa {t.number}</p>
                  <p className="text-white/20 text-[10px] mt-0.5 group-hover:text-white/40">Tiklayip yazdir</p>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* QR Codes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Order QR */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Siparis QR Kodu</h3>
          {orderQr ? (
            <div className="text-center space-y-3">
              <img src={orderQr} alt="Siparis QR" className="rounded-xl w-[200px] h-[200px] mx-auto" />
              <p className="text-xs text-amber-400 font-mono">{typeof window !== "undefined" ? window.location.origin : ""}/siparis</p>
              <p className="text-xs text-white/40">Musteri QR&apos;i okutunca kayit olur, menuden siparis verir, WhatsApp ile iletisime gecer.</p>
              <div className="flex gap-2 justify-center">
                <Button size="sm" variant="secondary" onClick={() => {
                  const link = document.createElement("a");
                  link.download = "varosh-siparis-qr.png";
                  link.href = orderQr!;
                  link.click();
                }}>QR Indir</Button>
                <Button size="sm" variant="secondary" onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/siparis`);
                }}>Link Kopyala</Button>
              </div>
            </div>
          ) : (
            <p className="text-white/30 text-sm">Yuklenirken...</p>
          )}
        </div>

        {/* WhatsApp QR */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">WhatsApp Iletisim QR</h3>
          {wpQr ? (
            <div className="text-center space-y-3">
              <img src={wpQr} alt="WhatsApp QR" className="rounded-xl w-[200px] h-[200px] mx-auto" />
              <p className="text-xs text-green-400 font-mono">wa.me/{settings.business_phone?.replace(/\D/g, "").replace(/^0/, "90")}</p>
              <p className="text-xs text-white/40">Dogrudan WhatsApp sohbeti acar.</p>
              <div className="flex gap-2 justify-center">
                <Button size="sm" variant="secondary" onClick={() => {
                  const link = document.createElement("a");
                  link.download = "varosh-whatsapp-qr.png";
                  link.href = wpQr!;
                  link.click();
                }}>QR Indir</Button>
                <Button size="sm" variant="secondary" onClick={() => {
                  const phone = settings.business_phone?.replace(/\D/g, "").replace(/^0/, "90");
                  navigator.clipboard.writeText(`https://wa.me/${phone}`);
                }}>Link Kopyala</Button>
              </div>
            </div>
          ) : (
            <p className="text-white/30 text-sm">Isletme telefonu girildiginde QR olusturulur.</p>
          )}
        </div>
      </div>

      {/* WhatsApp Siparis Telefonu */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">WhatsApp Siparis Telefonu</h3>
            <p className="text-xs text-white/30 mt-0.5">Musteriler bu numaraya yazinca bot otomatik yonlendirir</p>
          </div>
          {botStatus ? (
            botStatus.connected ? (
              <span className="flex items-center gap-2 bg-green-500/10 text-green-400 text-xs font-bold px-3 py-1.5 rounded-full border border-green-500/30 shrink-0">
                <span className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse" />
                Aktif
              </span>
            ) : (
              <span className="flex items-center gap-2 bg-amber-500/10 text-amber-400 text-xs font-bold px-3 py-1.5 rounded-full border border-amber-500/30 shrink-0">
                <span className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-pulse" />
                QR Bekliyor
              </span>
            )
          ) : (
            <span className="flex items-center gap-2 bg-red-500/10 text-red-400 text-xs font-bold px-3 py-1.5 rounded-full border border-red-500/30 shrink-0">
              <span className="w-2.5 h-2.5 bg-red-500 rounded-full" />
              Kapali
            </span>
          )}
        </div>

        {/* Bot calismıyor */}
        {!botStatus && (
          <div className="bg-surface-2 rounded-xl p-5 text-center">
            <div className="text-3xl mb-3 opacity-40">📱</div>
            <p className="text-white/50 text-sm mb-3">WhatsApp bot aktif degil.</p>
            <p className="text-white/40 text-xs mb-3">Terminalde calistirin:</p>
            <code className="bg-black/50 text-amber-400 px-4 py-2 rounded-lg text-sm font-mono inline-block">npm run bot</code>
          </div>
        )}

        {/* QR okutma ekrani */}
        {botStatus && !botStatus.connected && botQr && (
          <div className="text-center space-y-4">
            <div className="bg-surface-2 rounded-xl p-2 inline-block mx-auto">
              <img src={botQr} alt="WhatsApp QR" className="rounded-lg w-[260px] h-[260px]" />
            </div>
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
              <p className="text-amber-400/80 text-sm font-semibold mb-1">QR&apos;i Okutun</p>
              <p className="text-white/40 text-xs">Siparis hatti olarak kullanacaginiz telefondan: <strong className="text-white/60">WhatsApp &gt; Bagli Cihazlar &gt; Cihaz Bagla</strong></p>
            </div>
          </div>
        )}

        {/* Baslatılıyor */}
        {botStatus && !botStatus.connected && !botQr && (
          <div className="text-center py-6">
            <div className="w-10 h-10 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-white/40 text-sm">QR kodu olusturuluyor...</p>
          </div>
        )}

        {/* Bagli ve aktif */}
        {botStatus?.connected && (
          <div className="space-y-4">
            {/* Bagli numara */}
            <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-5 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                <span className="text-green-400 text-xs font-semibold">Siparis Hatti Aktif</span>
              </div>
              {botStatus.phone ? (
                <p className="text-white text-2xl font-bold tracking-wide">{botStatus.phone}</p>
              ) : (
                <p className="text-white/40 text-sm">Numara aliniyor...</p>
              )}
            </div>

            {/* Bot ozellikleri */}
            <div className="bg-surface-2 rounded-xl p-4">
              <p className="text-white/60 text-xs font-semibold mb-2">Bot Otomatik Olarak:</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-white/40">
                <div className="flex items-center gap-1.5"><span className="text-green-400">&#10003;</span> Siparis linki gonderir</div>
                <div className="flex items-center gap-1.5"><span className="text-green-400">&#10003;</span> Siparis takip eder</div>
                <div className="flex items-center gap-1.5"><span className="text-green-400">&#10003;</span> Kayitli musteriyi tanir</div>
                <div className="flex items-center gap-1.5"><span className="text-green-400">&#10003;</span> Iletisim bilgisi verir</div>
              </div>
            </div>

            {/* Kontroller */}
            <div className="flex items-center justify-between">
              <div className="text-xs text-white/25">
                Calisma: {botStatus.uptime ? `${Math.floor(botStatus.uptime / 60)} dk` : "..."}
              </div>
              <div className="flex items-center gap-2">
                <a href={`${window.location.protocol}//${window.location.hostname}:3003`} target="_blank" className="text-xs text-amber-400 hover:underline">Bot Paneli</a>
                <span className="text-white/10">|</span>
                <button
                  onClick={async () => {
                    if (!confirm("Mevcut WhatsApp baglantisi kesilecek.\nYeni numara tanimlamak icin tekrar QR okutmaniz gerekecek.\n\nDevam edilsin mi?")) return;
                    const BOT_URL = `${window.location.protocol}//${window.location.hostname}:3003`;
                    try {
                      await fetch(`${BOT_URL}/disconnect`, { method: "POST" });
                      setBotStatus(null);
                      setBotQr(null);
                    } catch { /* ignore */ }
                  }}
                  className="text-xs text-red-400 hover:text-red-300 font-semibold"
                >
                  Numarayi Degistir
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Settings Groups */}
      <div className="space-y-6">
        {SETTING_GROUPS.map((group) => {
          if (group.title === "__MAP__") {
            const lat = parseFloat(settings.shop_latitude) || 37.3730;
            const lng = parseFloat(settings.shop_longitude) || 36.0761;
            return (
              <div key="map" className="card">
                <h3 className="text-lg font-semibold mb-4">Isyeri Konumu</h3>
                <LocationPicker
                  latitude={lat}
                  longitude={lng}
                  onLocationChange={(newLat, newLng) => {
                    setSettings((prev) => ({
                      ...prev,
                      shop_latitude: newLat.toFixed(6),
                      shop_longitude: newLng.toFixed(6),
                    }));
                  }}
                />
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <label className="text-xs text-white/40 mb-1 block">Enlem</label>
                    <input
                      type="text"
                      value={settings.shop_latitude || ""}
                      onChange={(e) => setSettings({ ...settings, shop_latitude: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/40 mb-1 block">Boylam</label>
                    <input
                      type="text"
                      value={settings.shop_longitude || ""}
                      onChange={(e) => setSettings({ ...settings, shop_longitude: e.target.value })}
                      className="input-field"
                    />
                  </div>
                </div>
              </div>
            );
          }
          return (
            <div key={group.title} className="card">
              <h3 className="text-lg font-semibold mb-4">{group.title}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {group.fields.map((field) => (
                  <div key={field.key}>
                    <label className="text-xs text-white/40 mb-1 block">{field.label}</label>
                    <input
                      type={field.type}
                      value={settings[field.key] || ""}
                      onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })}
                      className="input-field"
                      placeholder={(field as any).placeholder || ""}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
