import { getDb, getSqliteDb, schema } from "./index";

export function seedDatabase() {
  const db = getDb();
  const sqlite = getSqliteDb();
  sqlite.pragma("foreign_keys = OFF");

  const defaultSettings = [
    { key: "business_name", value: "Varosh Streetfood" },
    { key: "business_address", value: "Kadirli, Osmaniye" },
    { key: "business_phone", value: "+905461483249" },
    { key: "working_hours_start", value: "10:00" },
    { key: "working_hours_end", value: "23:00" },
    { key: "default_delivery_fee", value: "20" },
    { key: "min_order_amount", value: "100" },
    { key: "estimated_delivery_minutes", value: "30" },
    { key: "order_auto_accept", value: "true" },
    { key: "customer_base_url", value: "" },
    { key: "shop_latitude", value: "37.372986" },
    { key: "shop_longitude", value: "36.076054" },
    { key: "loyalty_points_per_tl", value: "0.1" },
  ];

  for (const s of defaultSettings) {
    db.insert(schema.settings)
      .values(s)
      .onConflictDoNothing()
      .run();
  }

  const categories = [
    { name: "Döner", sortOrder: 1 },
    { name: "Tost & Sandviç", sortOrder: 2 },
    { name: "Atıştırmalık", sortOrder: 3 },
    { name: "İçecekler", sortOrder: 4 },
  ];

  db.delete(schema.menuItems).run();
  db.delete(schema.menuCategories).run();
  sqlite.exec("DELETE FROM sqlite_sequence WHERE name='menu_categories'");
  sqlite.exec("DELETE FROM sqlite_sequence WHERE name='menu_items'");

  const catIds: Record<string, number> = {};
  for (const c of categories) {
    const row = db.insert(schema.menuCategories)
      .values({ ...c, isActive: true })
      .returning()
      .get();
    catIds[c.name] = row.id;
  }

  const doner = catIds["Döner"];
  const tost = catIds["Tost & Sandviç"];
  const atistirmalik = catIds["Atıştırmalık"];
  const icecek = catIds["İçecekler"];

  const items = [
    { categoryId: doner, name: "Tiftik Tavuk Döner", price: 100, deliveryPrice: 130, prepTimeMinutes: 8, imageUrl: "/images/products/tiftik-tavuk.webp" },
    { categoryId: doner, name: "Tiftik Kova Döner", price: 150, deliveryPrice: 180, prepTimeMinutes: 10, imageUrl: "/images/products/tiftik-kova-doner-2.webp" },
    { categoryId: doner, name: "Dubble Tiftik Kova Döner", price: 250, deliveryPrice: 280, prepTimeMinutes: 12, imageUrl: "/images/products/dubble-tiftik-kova-d-ner-25.webp" },
    { categoryId: tost, name: "Sucuklu Tost", price: 100, deliveryPrice: 120, prepTimeMinutes: 6, imageUrl: "/images/products/sucuklu-tost.webp" },
    { categoryId: tost, name: "Kaşarlı Tost", price: 100, deliveryPrice: 120, prepTimeMinutes: 6, imageUrl: "/images/products/kasarli-tost.webp" },
    { categoryId: tost, name: "Karışık Tost", price: 120, deliveryPrice: 140, prepTimeMinutes: 6, imageUrl: "/images/products/karisik-tost.webp" },
    { categoryId: tost, name: "Yengen Tost", price: 130, deliveryPrice: 150, prepTimeMinutes: 7, imageUrl: "/images/products/yengen-tost.webp" },
    { categoryId: tost, name: "Ayvalık Tost", price: 150, deliveryPrice: 180, prepTimeMinutes: 7, imageUrl: "/images/products/ayvalik-tost.webp" },
    { categoryId: atistirmalik, name: "Munchies Tabağı", price: 200, deliveryPrice: 230, prepTimeMinutes: 10, imageUrl: "/images/products/munchies.webp" },
    { categoryId: atistirmalik, name: "Patso Sosisli", price: 100, deliveryPrice: 120, prepTimeMinutes: 8, imageUrl: "/images/products/patso.webp" },
    { categoryId: atistirmalik, name: "Patso Kaşarlı", price: 100, deliveryPrice: 120, prepTimeMinutes: 8, imageUrl: "/images/products/patso.webp" },
    { categoryId: atistirmalik, name: "Patso Sosisli Kaşarlı", price: 120, deliveryPrice: 140, prepTimeMinutes: 8, imageUrl: "/images/products/patso.webp" },
    { categoryId: atistirmalik, name: "Tavuk Nugget", price: 80, deliveryPrice: 100, prepTimeMinutes: 7, imageUrl: "/images/products/tavuk-nugget.webp" },
    { categoryId: atistirmalik, name: "Soğan Halkası", price: 60, deliveryPrice: 80, prepTimeMinutes: 6, imageUrl: "/images/products/sogan-halkasi.webp" },
    { categoryId: atistirmalik, name: "Sigara Böreği", price: 100, deliveryPrice: 120, prepTimeMinutes: 5, imageUrl: "/images/products/sigara-boregi.webp" },
    { categoryId: atistirmalik, name: "Parmak Patates", price: 100, deliveryPrice: 120, prepTimeMinutes: 6, imageUrl: "/images/products/parmak-patates.webp" },
    { categoryId: atistirmalik, name: "Kumru Sandviç", price: 150, deliveryPrice: 180, prepTimeMinutes: 7, imageUrl: "/images/products/kumru.webp" },
    { categoryId: icecek, name: "İçim Ayran 285ml", price: 30, deliveryPrice: 40, prepTimeMinutes: 0, imageUrl: "/images/products/kapali-plastik-bardak-ayran-icim-12.webp" },
    { categoryId: icecek, name: "Kutu Kola", price: 60, deliveryPrice: 70, prepTimeMinutes: 0, imageUrl: "/images/products/kutu-kola.webp" },
    { categoryId: icecek, name: "Su", price: 20, deliveryPrice: 20, prepTimeMinutes: 0, imageUrl: "/images/products/kisi-su-14.webp" },
    { categoryId: icecek, name: "1 Lt Kola", price: 90, deliveryPrice: 100, prepTimeMinutes: 0, imageUrl: "/images/products/1lt-kola.webp" },
    { categoryId: icecek, name: "Ice Tea", price: 60, deliveryPrice: 70, prepTimeMinutes: 0, imageUrl: "/images/products/ice-tea.webp" },
    { categoryId: icecek, name: "Soda", price: 30, deliveryPrice: 40, prepTimeMinutes: 0, imageUrl: "/images/products/soda.webp" },
  ];

  for (const item of items) {
    db.insert(schema.menuItems)
      .values({ ...item, isAvailable: true, sortOrder: 0 })
      .run();
  }

  db.insert(schema.staff)
    .values({
      phone: "+905461483249",
      name: "Patron",
      role: "owner",
      pin: "5791",
      isActive: true,
    })
    .onConflictDoNothing()
    .run();

  const stations = [
    { name: "Doner Istasyonu", type: "doner" as const, displayOrder: 1 },
    { name: "Tost & Izgara", type: "general" as const, displayOrder: 2 },
    { name: "Fritoz", type: "side" as const, displayOrder: 3 },
    { name: "Icecek", type: "beverage" as const, displayOrder: 4 },
  ];

  for (const s of stations) {
    db.insert(schema.kitchenStations)
      .values({ ...s, isActive: true })
      .onConflictDoNothing()
      .run();
  }

  db.insert(schema.businessStatus)
    .values({ status: "closed", changedBy: "system", reason: "Ilk kurulum" })
    .onConflictDoNothing()
    .run();

  sqlite.pragma("foreign_keys = ON");
  console.log("Seed verileri yuklendi.");
}
