const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const QRCode = require("qrcode");
const qrcode = require("qrcode-terminal");
const Database = require("better-sqlite3");
const http = require("http");
const path = require("path");
const fs = require("fs");

// ── .env oku ──
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf-8").split("\n").forEach((line) => {
    const m = line.match(/^\s*([\w]+)\s*=\s*(.+)\s*$/);
    if (m && !m[1].startsWith("#")) process.env[m[1]] = m[2].trim();
  });
}

const SITE_URL = process.env.SITE_URL || "http://localhost:3002";
const BOT_PORT = parseInt(process.env.BOT_PORT || "3003");
const DB_PATH = path.join(__dirname, "..", "varosh.db");
const AUTH_DIR = path.join(__dirname, "..", ".wa-auth");

let currentQR = null;
let botConnected = false;
let botPhone = null;
let sock = null;
const cooldowns = new Map();
const conversations = new Map();

// ── DB ──
function normalizePhone(raw) {
  const d = raw.replace(/\D/g, "");
  if (d.startsWith("90") && d.length >= 12) return "0" + d.slice(2);
  if (d.startsWith("0")) return d;
  return "0" + d;
}

function findCustomer(phone) {
  try {
    const db = new Database(DB_PATH, { readonly: true });
    const norm = normalizePhone(phone);
    const all = db.prepare("SELECT * FROM users").all();
    db.close();
    return all.find((u) => normalizePhone(u.phone) === norm) || null;
  } catch { return null; }
}

function createCustomer(phone, name, address, lat, lng) {
  try {
    const db = new Database(DB_PATH);
    const norm = normalizePhone(phone);
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    db.prepare(
      "INSERT INTO users (phone, name, address, latitude, longitude, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(norm, name, address || null, lat || null, lng || null, now, now);
    const userId = db.prepare("SELECT last_insert_rowid() as id").get().id;
    if (address && lat) {
      db.prepare(
        "INSERT INTO user_addresses (user_id, label, address, latitude, longitude, is_default, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)"
      ).run(userId, "Ev", address, lat, lng, now);
    }
    db.close();
    console.log(`   👤 Yeni musteri: ${name} (${norm})`);
    return true;
  } catch (e) { console.error("   ❌ Kayit hatasi:", e.message); return false; }
}

// LID→telefon eşlemesi (kalıcı dosya)
const LID_MAP_PATH = path.join(__dirname, "..", ".wa-lid-map.json");
const lidPhoneMap = new Map();
try {
  if (fs.existsSync(LID_MAP_PATH)) {
    const data = JSON.parse(fs.readFileSync(LID_MAP_PATH, "utf-8"));
    Object.entries(data).forEach(([k, v]) => lidPhoneMap.set(k, v));
  }
} catch {}
function saveLidMap() {
  const obj = {};
  lidPhoneMap.forEach((v, k) => { obj[k] = v; });
  fs.writeFileSync(LID_MAP_PATH, JSON.stringify(obj, null, 2));
}

function getSettings() {
  try {
    const db = new Database(DB_PATH, { readonly: true });
    const rows = db.prepare("SELECT key, value FROM settings").all();
    db.close();
    const s = {};
    rows.forEach((r) => { s[r.key] = r.value; });
    return s;
  } catch { return {}; }
}

function findOrderByPhone(phone) {
  try {
    const db = new Database(DB_PATH, { readonly: true });
    const norm = normalizePhone(phone);
    const orders = db.prepare("SELECT * FROM orders WHERE customer_phone IS NOT NULL ORDER BY id DESC LIMIT 10").all();
    db.close();
    return orders.find((o) => o.customer_phone && o.customer_phone.replace(/\D/g, "") === norm) || null;
  } catch { return null; }
}

function findOrderById(id) {
  try {
    const db = new Database(DB_PATH, { readonly: true });
    const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
    db.close();
    return order || null;
  } catch { return null; }
}

const STATUS_TR = {
  new: "Yeni", confirmed: "Onaylandi", preparing: "Hazirlaniyor",
  ready: "Hazir", out_for_delivery: "Yolda", delivered: "Teslim Edildi",
  cancelled: "Iptal Edildi", picked_up: "Teslim Alindi",
};

// ── Sohbet ──
function getConvo(jid) {
  if (!conversations.has(jid)) {
    conversations.set(jid, { state: "idle", lastActivity: Date.now() });
  }
  const c = conversations.get(jid);
  if (Date.now() - c.lastActivity > 10 * 60 * 1000) c.state = "idle";
  c.lastActivity = Date.now();
  return c;
}

function resolvePhone(jid) {
  if (jid.endsWith("@s.whatsapp.net")) return jid.replace(/@.+/, "").replace(/:.*/, "");
  if (lidPhoneMap.has(jid)) return lidPhoneMap.get(jid);
  return null;
}

function formatPhone(phone) {
  const d = (phone || "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("90"))
    return `0${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10)}`;
  if (d.length === 11 && d.startsWith("0"))
    return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9)}`;
  return phone;
}

const EPHEMERAL = 86400; // 24 saat

function makeLink(phone, pushName) {
  const namePart = pushName ? `/${encodeURIComponent(pushName)}` : "";
  return `${SITE_URL}/siparis/${phone}${namePart}`;
}

function buildReply(jid, text) {
  const convo = getConvo(jid);
  const rawPhone = convo.phone || resolvePhone(jid);
  const pushName = convo.pushName || "";

  // ── LID: telefon bilinmiyor, sor ──
  if (convo.state === "awaiting_phone") {
    const digits = text.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 13) return ["Gecerli numara gir. Ornek: *0546 148 32 49*"];
    convo.phone = digits;
    lidPhoneMap.set(jid, digits);
    saveLidMap();
    convo.state = "idle";
    const customer = findCustomer(digits);
    const greet = customer ? `*${customer.name}*, siparis icin tikla 👇` : "Hosgeldin! 👋 Siparis icin tikla 👇";
    return [greet, makeLink(digits, customer ? "" : pushName)];
  }

  // ── Telefon biliniyor ──
  if (rawPhone) {
    convo.state = "idle";
    const customer = findCustomer(rawPhone);
    const greet = customer ? `*${customer.name}*, siparis icin tikla 👇` : "Hosgeldin! 👋 Siparis icin tikla 👇";
    return [greet, makeLink(rawPhone, customer ? "" : pushName)];
  }

  // ── LID, telefon bilinmiyor ──
  convo.state = "awaiting_phone";
  return pushName
    ? [`Hosgeldin *${pushName}*! 👋\n*Telefon numarani* yaz:`]
    : ["Hosgeldin! 👋\n*Telefon numarani* yaz:"];
}

// ── WhatsApp (Baileys) ──
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
    browser: ["Varosh Bot", "Chrome", "1.0.0"],
    generateHighQualityLinkPreview: false,
    syncFullHistory: false,
    logger: require("pino")({ level: "silent" }),
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      currentQR = qr;
      botConnected = false;
      botPhone = null;
      console.log("\n📱 QR kodu — telefondan okutun:\n");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      currentQR = null;
      botConnected = true;
      try {
        const jid = sock.user?.id;
        const num = jid?.replace(/:.*@/, "@").replace("@s.whatsapp.net", "") || null;
        botPhone = num && num.startsWith("90") ? "0" + num.slice(2) : num;
      } catch { /* */ }
      console.log(`\n✅ Bot aktif! Numara: ${botPhone || "?"}`);
      console.log(`📍 ${SITE_URL}/siparis`);
      console.log(`🌐 http://localhost:${BOT_PORT}\n`);
    }

    if (connection === "close") {
      botConnected = false;
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log(`⚠️ Baglanti kapandi (kod: ${code})`);

      if (code === DisconnectReason.loggedOut) {
        console.log("🔒 Oturum kapatildi. QR tekrar okutulmali.");
        if (fs.existsSync(AUTH_DIR)) {
          fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        }
        botPhone = null;
        currentQR = null;
        setTimeout(startBot, 3000);
      } else {
        console.log("🔄 Yeniden baglaniliyor...");
        setTimeout(startBot, 3000);
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      try {
        if (msg.key.fromMe) continue;
        const jid = msg.key.remoteJid;
        if (!jid || jid.endsWith("@g.us") || jid === "status@broadcast") continue;

        // Metin mesajı (+ buton/interactive yanıtları)
        const nativeReply = msg.message?.viewOnceMessageV2?.message?.interactiveResponseMessage
          ?.nativeFlowResponseMessage?.paramsJson;
        let nativeId = "";
        if (nativeReply) {
          try { nativeId = JSON.parse(nativeReply).id || ""; } catch {}
        }
        const text = nativeId
          || msg.message?.buttonsResponseMessage?.selectedButtonId
          || msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId
          || msg.message?.templateButtonReplyMessage?.selectedId
          || msg.message?.conversation
          || msg.message?.extendedTextMessage?.text
          || "";

        // Konum mesajı
        const loc = msg.message?.locationMessage;
        const locData = loc ? { lat: loc.degreesLatitude, lng: loc.degreesLongitude } : null;

        if (!text.trim() && !locData) continue;

        const who = jid.replace(/@.+/, "");
        const time = new Date().toLocaleTimeString("tr-TR");
        if (locData) {
          console.log(`[${time}] 📍 ${who}: konum (${locData.lat.toFixed(4)}, ${locData.lng.toFixed(4)})`);
        } else {
          console.log(`[${time}] 📩 ${who}: "${text.slice(0, 50)}"`);
        }

        // pushName'i kaydet (WhatsApp profil adı)
        if (msg.pushName) {
          const convo = getConvo(jid);
          if (!convo.pushName) convo.pushName = msg.pushName;
        }

        // Cooldown — sohbet aktifse (bot cevap bekliyorsa) cooldown atla
        const convo = getConvo(jid);
        const isActive = convo.state !== "idle";
        const now = Date.now();
        const last = cooldowns.get(jid);
        if (!isActive && last && now - last < 10000) {
          console.log(`   ⏳ Cooldown`);
          continue;
        }
        cooldowns.set(jid, now);

        // Sohbeti süreli yap (ilk mesajda bir kez)
        if (!convo.ephemeralSet) {
          try {
            await sock.sendMessage(jid, { disappearingMessagesInChat: EPHEMERAL });
            convo.ephemeralSet = true;
          } catch {}
        }

        const msgs = buildReply(jid, text);
        if (msgs) {
          for (const m of msgs) {
            await sock.sendMessage(jid, { text: m }, { ephemeralExpiration: EPHEMERAL });
          }
        }
        console.log(`   ✅ Gonderildi`);
      } catch (err) {
        console.error(`   ❌ HATA:`, err.message);
      }
    }
  });
}

// ── HTTP ──
const httpServer = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(200); res.end(); return; }

  if (req.url === "/status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ connected: botConnected, phone: botPhone, hasQR: !!currentQR, uptime: process.uptime() }));
    return;
  }

  if (req.url === "/qr") {
    if (!currentQR) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ qr: null, connected: botConnected }));
      return;
    }
    try {
      const dataUrl = await QRCode.toDataURL(currentQR, { width: 300, margin: 2 });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ qr: dataUrl, connected: false }));
    } catch { res.writeHead(500); res.end("QR hata"); }
    return;
  }

  if (req.url === "/disconnect" && req.method === "POST") {
    console.log("🔌 Baglanti kesiliyor...");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    try { await sock?.logout(); } catch {}
    try { sock?.end(); } catch {}
    if (fs.existsSync(AUTH_DIR)) {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      console.log("   🗑️ Oturum silindi");
    }
    botConnected = false; botPhone = null; currentQR = null;
    cooldowns.clear(); conversations.clear();
    console.log("   🔄 Yeniden baslatiliyor...");
    setTimeout(startBot, 2000);
    return;
  }

  // ── Sipariş durum bildirimi ──
  if (req.url === "/notify" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", async () => {
      try {
        const { phone, status, orderId } = JSON.parse(body);
        if (!phone || !status || !sock || !botConnected) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false }));
          return;
        }
        const STATUS_MSG = {
          preparing: `🍳 Siparisin *#${orderId}* hazirlaniyor!`,
          ready: `✅ Siparisin *#${orderId}* hazir!`,
          on_the_way: `🛵 Siparisin *#${orderId}* yola cikti!`,
          delivered: `📦 Siparisin *#${orderId}* teslim edildi. Afiyet olsun! 😋`,
          cancelled: `❌ Siparisin *#${orderId}* iptal edildi.`,
        };
        const msg = STATUS_MSG[status];
        if (!msg) { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ ok: false, reason: "unknown status" })); return; }

        const digits = phone.replace(/\D/g, "");
        const jid90 = (digits.startsWith("0") ? "90" + digits.slice(1) : digits) + "@s.whatsapp.net";
        // LID'den de dene
        let targetJid = jid90;
        lidPhoneMap.forEach((v, k) => { if (v === digits || normalizePhone(v) === normalizePhone(digits)) targetJid = k; });

        await sock.sendMessage(targetJid, { text: msg }, { ephemeralExpiration: EPHEMERAL });
        console.log(`📢 Bildirim: #${orderId} ${status} → ${phone}`);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        console.error("❌ Bildirim hatasi:", e.message);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  if (req.url === "/" || req.url === "/index.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Varosh Bot</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui;background:#0a0a0a;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center}.c{background:#171717;border:1px solid #333;border-radius:20px;padding:2rem;max-width:400px;width:100%;text-align:center}h1{font-size:1.4rem;margin-bottom:.3rem}.sub{color:#999;font-size:.85rem;margin-bottom:1.5rem}.s{display:inline-flex;align-items:center;gap:8px;padding:8px 16px;border-radius:99px;font-weight:600;font-size:.9rem;margin-bottom:.8rem}.ok{background:#16a34a22;color:#4ade80;border:1px solid #16a34a44}.w{background:#f59e0b22;color:#fbbf24;border:1px solid #f59e0b44}.d{width:10px;height:10px;border-radius:50%}.dg{background:#4ade80;box-shadow:0 0 8px #4ade8066}.dy{background:#fbbf24;animation:p 1.5s infinite}@keyframes p{50%{opacity:.3}}.btn{margin-top:1rem;background:#dc2626;color:#fff;border:none;padding:10px 24px;border-radius:12px;font-weight:600;cursor:pointer;font-size:.85rem}.i{color:#888;font-size:.75rem;margin-top:1rem}</style></head><body><div class="c"><h1>Varosh WhatsApp Bot</h1><p class="sub">Siparis hattini yonetin</p><div id="v">Yukleniyor...</div><p class="i">Bot • <span id="u">0</span>dk</p></div>
<script>async function ck(){try{const s=await(await fetch("/status")).json();document.getElementById("u").textContent=Math.floor(s.uptime/60);if(s.connected){document.getElementById("v").innerHTML='<div class="s ok"><div class="d dg"></div>Bagli</div>'+(s.phone?'<p style="color:#4ade80;font-size:1.2rem;font-weight:700;margin:.5rem 0">'+s.phone+'</p>':'')+'<p style="color:#aaa;margin:.5rem 0;font-size:.85rem">Mesajlar otomatik cevaplanıyor</p><button class="btn" onclick="dc()">Numarayi Degistir</button>';return}const q=await(await fetch("/qr")).json();if(q.qr){document.getElementById("v").innerHTML='<div class="s w"><div class="d dy"></div>QR Bekleniyor</div><img src="'+q.qr+'" width="260" height="260" style="border-radius:12px;margin:1rem auto;display:block"><p style="color:#aaa;font-size:.8rem">WhatsApp > Bagli Cihazlar > Cihaz Bagla</p>'}else{document.getElementById("v").innerHTML='<div class="s w"><div class="d dy"></div>Baslatiliyor...</div>'}}catch{document.getElementById("v").innerHTML='<p style="color:#ef4444">Bot calismıyor</p>'}}async function dc(){if(!confirm("Baglanti kesilecek. Yeni numara icin QR okutmaniz gerekecek."))return;document.getElementById("v").innerHTML='<p style="color:#fbbf24">Kesiliyor...</p>';await fetch("/disconnect",{method:"POST"});setTimeout(ck,3000)}ck();setInterval(ck,3000)</script></body></html>`);
    return;
  }

  res.writeHead(404); res.end("404");
});

httpServer.listen(BOT_PORT, () => {
  console.log(`🌐 Bot panel: http://localhost:${BOT_PORT}`);
  setTimeout(() => {
    const warmUrls = ["/siparis/warmup", "/api/table-menu", "/api/settings/public"];
    warmUrls.forEach((p) => {
      fetch(`${SITE_URL}${p}`).catch(() => {});
    });
    console.log("♨️  Siparis sayfasi isindirildi");
  }, 5000);
});

process.on("SIGINT", async () => {
  console.log("\n🛑 Kapatiliyor...");
  httpServer.close();
  sock?.end();
  process.exit(0);
});

console.log("🚀 Varosh WhatsApp Bot baslatiliyor...");

// Pino logger sessiz mod icin
try { require("pino"); } catch {
  console.log("📦 pino yuklenecek...");
}

// Eski auth temizle
if (fs.existsSync(path.join(__dirname, "..", ".wwebjs_auth"))) {
  fs.rmSync(path.join(__dirname, "..", ".wwebjs_auth"), { recursive: true, force: true });
}

startBot().catch((err) => {
  console.error("❌ Bot baslama hatasi:", err.message);
});
