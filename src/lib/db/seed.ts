import { getDb, schema } from "./index";

export function seedDatabase() {
  const db = getDb();

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
    { categoryId: 1, name: "Tiftik Kova", price: 150, deliveryPrice: 180, prepTimeMinutes: 10 },
    { categoryId: 1, name: "Tiftik Tavuk Doner", price: 100, deliveryPrice: 130, prepTimeMinutes: 8 },
    { categoryId: 1, name: "Kumru", price: 150, deliveryPrice: 180, prepTimeMinutes: 7 },
    { categoryId: 1, name: "Muhtes Tobyo", price: 200, deliveryPrice: 230, prepTimeMinutes: 10 },
    { categoryId: 3, name: "Potso", price: 80, deliveryPrice: 100, prepTimeMinutes: 8 },
    { categoryId: 3, name: "Potso Sosisli", price: 100, deliveryPrice: 120, prepTimeMinutes: 8 },
    { categoryId: 3, name: "Potso Kasarli", price: 100, deliveryPrice: 120, prepTimeMinutes: 8 },
    { categoryId: 3, name: "Potso Sosisli Kasarli", price: 120, deliveryPrice: 140, prepTimeMinutes: 8 },
    { categoryId: 3, name: "Parmak Patates", price: 100, deliveryPrice: 120, prepTimeMinutes: 6 },
    { categoryId: 2, name: "Sucuklu Tost", price: 100, deliveryPrice: 120, prepTimeMinutes: 6 },
    { categoryId: 2, name: "Kasarli Tost", price: 100, deliveryPrice: 120, prepTimeMinutes: 6 },
    { categoryId: 2, name: "Karisik Tost", price: 120, deliveryPrice: 140, prepTimeMinutes: 6 },
    { categoryId: 2, name: "Jenger Tost", price: 130, deliveryPrice: 150, prepTimeMinutes: 7 },
    { categoryId: 2, name: "Ayvalik Tost", price: 150, deliveryPrice: 180, prepTimeMinutes: 7 },
    { categoryId: 3, name: "Tavuk Nugget", price: 80, deliveryPrice: 80, prepTimeMinutes: 7 },
    { categoryId: 3, name: "Sogan Halkasi", price: 60, deliveryPrice: 80, prepTimeMinutes: 6 },
    { categoryId: 3, name: "Sigara Boregi", price: 100, deliveryPrice: 100, prepTimeMinutes: 5 },
    { categoryId: 4, name: "Icim Ayran 285ml", price: 30, deliveryPrice: 40, prepTimeMinutes: 0 },
    { categoryId: 4, name: "330cl Kutu Pepsi", price: 60, deliveryPrice: 70, prepTimeMinutes: 0 },
    { categoryId: 4, name: "Su", price: 20, deliveryPrice: 20, prepTimeMinutes: 0 },
    { categoryId: 4, name: "1 Lt Kola", price: 90, deliveryPrice: 100, prepTimeMinutes: 0 },
    { categoryId: 4, name: "Ice Tea", price: 60, deliveryPrice: 70, prepTimeMinutes: 0 },
    { categoryId: 4, name: "Soda", price: 30, deliveryPrice: 40, prepTimeMinutes: 0 },
  ];

  for (const item of items) {
    db.insert(schema.menuItems)
      .values({ ...item, isAvailable: true, sortOrder: 0 })
      .onConflictDoNothing()
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

  console.log("Seed verileri yuklendi.");
}
