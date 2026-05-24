const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'varosh.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

const insertOption = db.prepare(`
  INSERT INTO menu_item_options (menu_item_id, group_name, option_name, price_modifier, is_default)
  VALUES (?, ?, ?, ?, ?)
`);

const deleteOptionsByItem = db.prepare(`
  DELETE FROM menu_item_options WHERE menu_item_id = ?
`);

const deleteIcindekilerByItem = db.prepare(`
  DELETE FROM menu_item_options WHERE menu_item_id = ? AND group_name = 'Icindekiler'
`);

function addIcindekiler(menuItemId, ingredients) {
  for (const name of ingredients) {
    insertOption.run(menuItemId, 'Icindekiler', name, 0, 1);
  }
}

function addEkstralar(menuItemId, extras) {
  for (const [name, price] of extras) {
    insertOption.run(menuItemId, 'Ekstralar', name, price, 0);
  }
}

const fix = db.transaction(() => {
  // Önce tüm mevcut seçenekleri temizle (yerel DB zaten boş ama güvenlik için)
  db.prepare('DELETE FROM menu_item_options').run();
  console.log('Mevcut seçenekler temizlendi.');

  // ============================================
  // 1. TİFTİK TAVUK DÖNER (ID: 1)
  // Menü: "taze sebzeler ve özel sos ile sarılı lezzet"
  // ============================================
  addIcindekiler(1, ['Marul', 'Domates', 'Soğan', 'Turşu', 'Özel Sos']);
  addEkstralar(1, [['Ekstra Sos', 5], ['Ekstra Et', 30]]);
  console.log('✓ Tiftik Tavuk Döner');

  // ============================================
  // 2. TİFTİK KOVA DÖNER (ID: 2)
  // Menü: "patates kızartması, özel sos ile efsane lezzet"
  // ============================================
  addIcindekiler(2, ['Patates Kızartması', 'Özel Sos', 'Marul', 'Domates']);
  addEkstralar(2, [['Ekstra Sos', 5], ['Ekstra Et', 30]]);
  console.log('✓ Tiftik Kova Döner');

  // ============================================
  // 3. DUBBLE TİFTİK KOVA DÖNER (ID: 3)
  // Kova ile aynı içindekiler
  // ============================================
  addIcindekiler(3, ['Patates Kızartması', 'Özel Sos', 'Marul', 'Domates']);
  addEkstralar(3, [['Ekstra Sos', 5], ['Ekstra Et', 30]]);
  console.log('✓ Dubble Tiftik Kova Döner (Kova ile aynı)');

  // ============================================
  // 4. SUCUKLU TOST (ID: 4)
  // Menü: "bol sucuk ve eritilmiş kaşar peyniri"
  // ============================================
  addIcindekiler(4, ['Sucuk', 'Kaşar']);
  addEkstralar(4, [['Ekstra Kaşar', 10]]);
  console.log('✓ Sucuklu Tost');

  // ============================================
  // 5. KAŞARLI TOST (ID: 5)
  // Sadece kaşar
  // ============================================
  addIcindekiler(5, ['Kaşar']);
  addEkstralar(5, [['Ekstra Kaşar', 10], ['Ekstra Sucuk', 15]]);
  console.log('✓ Kaşarlı Tost');

  // ============================================
  // 6. KARIŞIK TOST (ID: 6)
  // Karışık = sucuk + sosis + kaşar
  // ============================================
  addIcindekiler(6, ['Sucuk', 'Sosis', 'Kaşar']);
  addEkstralar(6, [['Ekstra Kaşar', 10]]);
  console.log('✓ Karışık Tost');

  // ============================================
  // 7. YENGEN TOST (ID: 7)
  // Menüde detay yok - makul tahmin
  // ============================================
  addIcindekiler(7, ['Sucuk', 'Sosis', 'Kaşar', 'Turşu']);
  addEkstralar(7, [['Ketçap', 5], ['Mayonez', 5]]);
  console.log('✓ Yengen Tost (tahmin)');

  // ============================================
  // 8. AYVALIK TOST (ID: 8)
  // Klasik Ayvalık tarifi
  // ============================================
  addIcindekiler(8, ['Sucuk', 'Sosis', 'Salam', 'Kaşar', 'Turşu', 'Domates', 'Marul', 'Ketçap', 'Mayonez']);
  addEkstralar(8, [['Ekstra Kaşar', 10]]);
  console.log('✓ Ayvalık Tost');

  // ============================================
  // 9. MUNCHIES TABAĞI (ID: 9)
  // Menü: "parmak patates, sosis, nugget, soğan halkası, sigara böreği"
  // ============================================
  addIcindekiler(9, ['Parmak Patates', 'Sosis', 'Nugget', 'Soğan Halkası', 'Sigara Böreği']);
  addEkstralar(9, [['Ekstra Sos', 5]]);
  console.log('✓ Munchies Tabağı');

  // ============================================
  // 10. PATSO SOSİSLİ (ID: 10)
  // ============================================
  addIcindekiler(10, ['Patates', 'Sosis']);
  addEkstralar(10, [['Ekstra Sos', 5]]);
  console.log('✓ Patso Sosisli');

  // ============================================
  // 11. PATSO KAŞARLI (ID: 11)
  // ============================================
  addIcindekiler(11, ['Patates', 'Kaşar']);
  addEkstralar(11, [['Ekstra Sos', 5]]);
  console.log('✓ Patso Kaşarlı');

  // ============================================
  // 12. PATSO SOSİSLİ KAŞARLI (ID: 12)
  // ============================================
  addIcindekiler(12, ['Patates', 'Sosis', 'Kaşar']);
  addEkstralar(12, [['Ekstra Sos', 5]]);
  console.log('✓ Patso Sosisli Kaşarlı');

  // ============================================
  // 13-16: Tavuk Nugget, Soğan Halkası, Sigara Böreği, Parmak Patates
  // Tek ürün - içindekiler gereksiz
  // ============================================

  // ============================================
  // 17. KUMRU SANDVİÇ (ID: 17)
  // Menü: "salam, sosis ve turşu ile muhteşem ahenk"
  // ============================================
  addIcindekiler(17, ['Salam', 'Sosis', 'Turşu']);
  addEkstralar(17, [['Ekstra Kaşar', 20]]);
  console.log('✓ Kumru Sandviç');

  // ============================================
  // 18-23: İÇECEKLER - İçindekiler YOK
  // İçeceklerde içindekiler/ekstralar olmayacak
  // ============================================
  console.log('✓ İçecekler - içindekiler yok (doğru)');

  const total = db.prepare('SELECT COUNT(*) as cnt FROM menu_item_options').get();
  console.log('\nToplam eklenen seçenek: ' + total.cnt);
});

fix();
db.close();
console.log('\nDüzeltme tamamlandı!');
