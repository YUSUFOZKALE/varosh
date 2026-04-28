# Varosh Streetfood — Restoran Yonetim Sistemi

Kadirli/Osmaniye icin tam kapsamli, ucretsiz, yerel sunucuda calisan POS ve restoran yonetim sistemi.

## Gereksinimler

- Windows 10/11
- Node.js 20+
- npm

## Kurulum

```bash
# Bagimliliklari kur
npm install

# Veritabanini olustur
npm run db:push

# Baslangic verilerini yukle
npm run db:seed

# Gelistirme modunda calistir
npm run dev
```

Tarayicida ac: http://localhost:3000
Varsayilan PIN: 1234 (Patron hesabi)

## Production Deployment

```bash
# Build al
npm run build

# PM2 ile baslat
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 startup
pm2 save
```

## Cloudflare Tunnel (Ucretsiz Dis Erisim)

```bash
# cloudflared kur (https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
# Sonra calistir:
cloudflared tunnel --url http://localhost:3000
```

Terminalde gelen `.trycloudflare.com` URL'sini kullan.

## Arayuzler

| Sayfa | Adres | Aciklama |
|-------|-------|----------|
| Admin Panel | / | Isletme yonetim paneli |
| POS | /pos | Hizli siparis ekrani |
| Mutfak | /kitchen | Mutfak goruntuleme ekrani |
| Kurye | /courier | Kurye mobil uygulamasi |

## Veritabani

SQLite kullanilir — tek dosya (`varosh.db`).
WAL modu aktif — es zamanli okuma/yazma destegi.
