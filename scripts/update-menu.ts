import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "varosh.db");
const db = new Database(dbPath);

db.exec(`
  -- Update existing items to match original menu design
  UPDATE menu_items SET price = 100, delivery_price = 110, description = 'Taze sebzeler ve ozel sos ile sade lezzet!', image_url = '/menu/tiftik-tavuk.png', sort_order = 1 WHERE name = 'Tiftik Tavuk Doner';
  UPDATE menu_items SET price = 150, delivery_price = 160, description = 'Bol tiftik tavuk doner, patates kizartmasi, ozel sos ile efsane lezzet!', image_url = '/menu/tiftik-kova.png', sort_order = 2 WHERE name = 'Tiftik Kova Doner';
  UPDATE menu_items SET price = 80, delivery_price = 90, description = 'Izmir usulu kumru, sucuk, salam, sosis ve tursu ile', image_url = '/menu/kumru.png', sort_order = 1 WHERE name = 'Kumru Sandvic';
  UPDATE menu_items SET price = 100, delivery_price = 110, description = 'Bol sucuk ve eritilmis kasar peyniri ile klasik lezzet!', image_url = '/menu/sucuklu-tost.png', sort_order = 2 WHERE name = 'Sucuklu Tost';
  UPDATE menu_items SET price = 80, delivery_price = 90, description = 'Citir patates, ozel sos ile', image_url = '/menu/patso.png', sort_order = 1 WHERE name = 'Patso';
  UPDATE menu_items SET price = 50, delivery_price = 60, description = 'Citir citir parmak patates, ozel ve lezzetli sos ile', image_url = '/menu/parmak-patates.png', sort_order = 4 WHERE name = 'Parmak Patates';
  UPDATE menu_items SET price = 60, delivery_price = 70, description = '6 adet, citir sogan halkasi', image_url = '/menu/sogan-halkasi.png', sort_order = 7 WHERE name = 'Sogan Halkasi';
  UPDATE menu_items SET price = 80, delivery_price = 90, description = '6 adet tavuk nugget', image_url = '/menu/tavuk-nugget.png', sort_order = 5 WHERE name = 'Tavuk Nugget';
  UPDATE menu_items SET price = 100, delivery_price = 110, description = '6 adet, citir sigara boregi', image_url = '/menu/sigara-boregi.png', sort_order = 6 WHERE name = 'Sigara Boregi';
  UPDATE menu_items SET price = 200, delivery_price = 220, description = 'Parmak patates, sosis, nugget, sogan halkasi, sigara boregi ile karisk tabak', image_url = '/menu/munchies.png', sort_order = 8 WHERE name = 'Munchies Tabagi';

  -- Update beverages
  UPDATE menu_items SET image_url = '/menu/ayran.png', sort_order = 1 WHERE name = 'Ayran';
  UPDATE menu_items SET image_url = '/menu/kutu-kola.png', sort_order = 2 WHERE name = 'Kola';
  UPDATE menu_items SET image_url = '/menu/su.png', sort_order = 3 WHERE name = 'Su';
  UPDATE menu_items SET image_url = '/menu/ice-tea.png', sort_order = 4 WHERE name = 'Ice Tea';
  UPDATE menu_items SET image_url = '/menu/soda.png', sort_order = 5 WHERE name = 'Soda';

  -- Delete Tombik Doner (not in original menu)
  DELETE FROM menu_items WHERE name = 'Tombik Doner';
`);

// Add missing tost variants
const tostCategory = db.prepare("SELECT id FROM menu_categories WHERE name = 'Tost & Sandvic'").get() as { id: number };
const snackCategory = db.prepare("SELECT id FROM menu_categories WHERE name = 'Atistirmalik'").get() as { id: number };

const newItems = [
  { categoryId: tostCategory.id, name: "Kasarli Tost", price: 100, deliveryPrice: 110, description: "Bol kasarli klasik tost", imageUrl: "/menu/sucuklu-tost.png", sortOrder: 3, prepTime: 6 },
  { categoryId: tostCategory.id, name: "Karisik Tost", price: 120, deliveryPrice: 130, description: "Sucuk, sosis, kasar ile karisik tost", imageUrl: "/menu/sucuklu-tost.png", sortOrder: 4, prepTime: 7 },
  { categoryId: tostCategory.id, name: "Yengen Tost", price: 130, deliveryPrice: 140, description: "Ozel malzemeli yengen tost", imageUrl: "/menu/sucuklu-tost.png", sortOrder: 5, prepTime: 7 },
  { categoryId: tostCategory.id, name: "Ayvalik Tost", price: 150, deliveryPrice: 160, description: "Ayvalik usulu zengin tost", imageUrl: "/menu/sucuklu-tost.png", sortOrder: 6, prepTime: 8 },
  { categoryId: snackCategory.id, name: "Patso Sosisli", price: 100, deliveryPrice: 110, description: "Patso sosisli", imageUrl: "/menu/patso.png", sortOrder: 2, prepTime: 8 },
  { categoryId: snackCategory.id, name: "Patso Kasarli", price: 100, deliveryPrice: 110, description: "Patso kasarli", imageUrl: "/menu/patso.png", sortOrder: 3, prepTime: 8 },
  { categoryId: snackCategory.id, name: "Patso Sosisli Kasarli", price: 120, deliveryPrice: 130, description: "Patso sosisli kasarli", imageUrl: "/menu/patso.png", sortOrder: 3, prepTime: 9 },
];

const insertStmt = db.prepare(
  "INSERT OR IGNORE INTO menu_items (category_id, name, price, delivery_price, description, image_url, sort_order, prep_time_minutes, is_available) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)"
);

for (const item of newItems) {
  const exists = db.prepare("SELECT id FROM menu_items WHERE name = ?").get(item.name);
  if (!exists) {
    insertStmt.run(item.categoryId, item.name, item.price, item.deliveryPrice, item.description, item.imageUrl, item.sortOrder, item.prepTime);
    console.log(`Eklendi: ${item.name}`);
  } else {
    console.log(`Zaten var: ${item.name}`);
  }
}

console.log("Menu guncellendi!");
db.close();
