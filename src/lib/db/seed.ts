import { getDb, schema } from "./index";

export function seedDatabase() {
  const db = getDb();

  const defaultSettings = [
    { key: "business_name", value: "Varosh Streetfood" },
    { key: "business_address", value: "Kadirli, Osmaniye" },
    { key: "business_phone", value: "+905551234567" },
    { key: "working_hours_start", value: "10:00" },
    { key: "working_hours_end", value: "23:00" },
    { key: "default_delivery_fee", value: "20" },
    { key: "min_order_amount", value: "100" },
    { key: "estimated_delivery_minutes", value: "30" },
    { key: "order_auto_accept", value: "true" },
    { key: "customer_base_url", value: "http://localhost:3000" },
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
    { name: "Doner", sortOrder: 1 },
    { name: "Tost & Sandvic", sortOrder: 2 },
    { name: "Atistirmalik", sortOrder: 3 },
    { name: "Icecekler", sortOrder: 4 },
  ];

  for (const c of categories) {
    db.insert(schema.menuCategories)
      .values({ ...c, isActive: true })
      .onConflictDoNothing()
      .run();
  }

  const items = [
    { categoryId: 1, name: "Tiftik Tavuk Doner", price: 120, deliveryPrice: 130, prepTimeMinutes: 8 },
    { categoryId: 1, name: "Tiftik Kova Doner", price: 140, deliveryPrice: 150, prepTimeMinutes: 10 },
    { categoryId: 1, name: "Tombik Doner", price: 110, deliveryPrice: 120, prepTimeMinutes: 8 },
    { categoryId: 2, name: "Kumru Sandvic", price: 90, deliveryPrice: 100, prepTimeMinutes: 7 },
    { categoryId: 2, name: "Sucuklu Tost", price: 80, deliveryPrice: 90, prepTimeMinutes: 6 },
    { categoryId: 3, name: "Patso", price: 70, deliveryPrice: 80, prepTimeMinutes: 8 },
    { categoryId: 3, name: "Parmak Patates", price: 50, deliveryPrice: 60, prepTimeMinutes: 6 },
    { categoryId: 3, name: "Sogan Halkasi", price: 55, deliveryPrice: 65, prepTimeMinutes: 6 },
    { categoryId: 3, name: "Tavuk Nugget", price: 65, deliveryPrice: 75, prepTimeMinutes: 7 },
    { categoryId: 3, name: "Sigara Boregi", price: 60, deliveryPrice: 70, prepTimeMinutes: 5 },
    { categoryId: 3, name: "Munchies Tabagi", price: 130, deliveryPrice: 140, prepTimeMinutes: 10 },
    { categoryId: 4, name: "Ayran", price: 15, deliveryPrice: 15, prepTimeMinutes: 0 },
    { categoryId: 4, name: "Kola", price: 25, deliveryPrice: 25, prepTimeMinutes: 0 },
    { categoryId: 4, name: "Su", price: 5, deliveryPrice: 5, prepTimeMinutes: 0 },
    { categoryId: 4, name: "Ice Tea", price: 20, deliveryPrice: 20, prepTimeMinutes: 0 },
    { categoryId: 4, name: "Soda", price: 10, deliveryPrice: 10, prepTimeMinutes: 0 },
  ];

  for (const item of items) {
    db.insert(schema.menuItems)
      .values({ ...item, isAvailable: true, sortOrder: 0 })
      .onConflictDoNothing()
      .run();
  }

  db.insert(schema.staff)
    .values({
      phone: "+905551234567",
      name: "Patron",
      role: "owner",
      pin: "1234",
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

  console.log("Seed verileri yuklendi.");
}
