// Демо-данные. Аптеки и цены ВЫДУМАННЫЕ — только для учёбы.
// Сами списки лежат в seed-data.json (взяты из backend/app/seed.py).

const data = require("./seed-data.json");

// Простой генератор случайных чисел с «зерном» — одинаковые цены при каждом запуске
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const searchText = (m) => [m.name, m.generic_name, m.category, m.purpose].join(" ").toLowerCase();

async function seedIfEmpty(db) {
  if (await db.get("SELECT id FROM medicines LIMIT 1")) return;

  const rnd = mulberry32(42);
  const now = new Date().toISOString();

  await db.transaction(async () => {
    const pharmacyIds = [];
    for (const p of data.pharmacies) {
      const row = await db.get(
        "INSERT INTO pharmacies (name, city, address, phone, hours, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id",
        [p.name, p.city, p.address, p.phone, p.hours, p.lat, p.lng],
      );
      pharmacyIds.push(row.id);
    }

    for (const [i, m] of data.medicines.entries()) {
      const { id } = await db.get(
        `INSERT INTO medicines (name, generic_name, category, form, purpose, contraindications, prescription, search)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        [m.name, m.generic_name, m.category, m.form, m.purpose, m.contraindications, m.prescription, searchText(m)],
      );
      // Лекарство есть примерно в 70% аптек, цена от -20% до +30% от базовой
      for (const pharmacyId of pharmacyIds) {
        if (rnd() < 0.7) {
          await db.run(
            "INSERT INTO offers (medicine_id, pharmacy_id, price_som, in_stock, updated_at) VALUES (?, ?, ?, ?, ?)",
            [id, pharmacyId, Math.round(m.base_price * (0.8 + rnd() * 0.5)), rnd() > 0.15, now],
          );
        }
      }
      if (i < 3) {
        for (const r of data.reviews) {
          await db.run(
            "INSERT INTO reviews (medicine_id, author, rating, text, created_at) VALUES (?, ?, ?, ?, ?)",
            [id, r.author, r.rating, r.text, now],
          );
        }
      }
    }
  });
}

module.exports = { seedIfEmpty };
