// Dary.kg API на Express. Контракт тот же, что у Python (backend/app/main.py),
// поэтому фронтенд и тесты работают с обоими бэкендами без изменений.

const fs = require("fs");
const path = require("path");
const express = require("express");
const { db } = require("./db");

const app = express();
app.use(express.json());

// Разрешаем запросы с любых фронтендов (vanilla, React, Vue, Angular на других портах)
app.use((req, res, next) => {
  res.set({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Express 4 не ловит ошибки async-функций сам — оборачиваем
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// ---------- Вспомогательное ----------

/** Расстояние между двумя точками на Земле (формула гаверсинуса), км. */
function distanceKm(lat1, lng1, lat2, lng2) {
  const rad = (d) => (d * Math.PI) / 180;
  const dp = rad(lat2 - lat1);
  const dl = rad(lng2 - lng1);
  const a = Math.sin(dp / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dl / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(a)) * 100) / 100;
}

/** Целый id из адреса, иначе null. */
function parseId(value) {
  return /^\d+$/.test(value) ? Number(value) : null;
}

/** Число из query-строки в заданных пределах; undefined если не передано, null если неверное. */
function parseCoord(value, limit) {
  if (value === undefined || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

const toDate = (v) => (v instanceof Date ? v.toISOString() : String(v));

/** Минимальная цена, средний рейтинг и число отзывов для списка лекарств. */
async function statsFor(ids) {
  if (!ids.length) return { prices: new Map(), ratings: new Map() };
  const marks = ids.map(() => "?").join(", ");
  const priceRows = await db.all(
    `SELECT medicine_id, MIN(price_som) AS min_price FROM offers
     WHERE medicine_id IN (${marks}) AND in_stock = ? GROUP BY medicine_id`,
    [...ids, true],
  );
  const ratingRows = await db.all(
    `SELECT medicine_id, AVG(rating) AS avg, COUNT(id) AS cnt FROM reviews
     WHERE medicine_id IN (${marks}) GROUP BY medicine_id`,
    ids,
  );
  return {
    prices: new Map(priceRows.map((r) => [r.medicine_id, r.min_price])),
    // Postgres отдаёт AVG и COUNT строками — приводим к числам
    ratings: new Map(ratingRows.map((r) => [r.medicine_id, { avg: Number(r.avg), cnt: Number(r.cnt) }])),
  };
}

function short(m, { prices, ratings }) {
  const r = ratings.get(m.id);
  return {
    id: m.id,
    name: m.name,
    generic_name: m.generic_name,
    category: m.category,
    form: m.form,
    prescription: Boolean(m.prescription),
    image_url: m.image_url ?? null,
    min_price: prices.get(m.id) ?? null,
    rating: r ? Math.round(r.avg * 10) / 10 : null,
    reviews_count: r ? r.cnt : 0,
  };
}

const reviewOut = (r) => ({
  id: r.id, author: r.author, rating: r.rating, text: r.text, created_at: toDate(r.created_at),
});

const notFound = (res) => res.status(404).json({ detail: "Лекарство не найдено" });

async function medicineExists(id) {
  return id !== null && Boolean(await db.get("SELECT id FROM medicines WHERE id = ?", [id]));
}

// ---------- API ----------

app.get("/api/categories", wrap(async (req, res) => {
  const rows = await db.all("SELECT DISTINCT category FROM medicines ORDER BY category");
  res.json(rows.map((r) => r.category));
}));

app.get("/api/cities", wrap(async (req, res) => {
  const rows = await db.all("SELECT DISTINCT city FROM pharmacies ORDER BY city");
  res.json(rows.map((r) => r.city));
}));

app.get("/api/medicines", wrap(async (req, res) => {
  const where = [];
  const params = [];
  const q = String(req.query.q ?? "").trim().toLowerCase();
  if (q) {
    // instr вместо LIKE: тогда символы % и _ в запросе ищутся как обычные буквы
    where.push(db.dialect === "sqlite" ? "instr(search, ?) > 0" : "strpos(search, ?) > 0");
    params.push(q);
  }
  if (req.query.category) {
    where.push("category = ?");
    params.push(String(req.query.category));
  }
  const meds = await db.all(
    `SELECT * FROM medicines ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY name`,
    params,
  );
  const stats = await statsFor(meds.map((m) => m.id));
  res.json(meds.map((m) => short(m, stats)));
}));

app.get("/api/medicines/:id", wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const lat = parseCoord(req.query.lat, 90);
  const lng = parseCoord(req.query.lng, 180);
  if (lat === null || lng === null) {
    return res.status(422).json({ detail: "lat должен быть от -90 до 90, lng — от -180 до 180" });
  }

  const m = id === null ? null : await db.get("SELECT * FROM medicines WHERE id = ?", [id]);
  if (!m) return notFound(res);

  const params = [id];
  let cityFilter = "";
  if (req.query.city) {
    cityFilter = "AND p.city = ?";
    params.push(String(req.query.city));
  }
  const rows = await db.all(
    `SELECT o.price_som, o.in_stock, o.updated_at,
            p.id AS p_id, p.name AS p_name, p.city, p.address, p.phone, p.hours, p.lat, p.lng
     FROM offers o JOIN pharmacies p ON p.id = o.pharmacy_id
     WHERE o.medicine_id = ? ${cityFilter}`,
    params,
  );

  const located = lat !== undefined && lng !== undefined;
  const offers = rows.map((r) => ({
    price_som: r.price_som,
    in_stock: Boolean(r.in_stock),
    updated_at: toDate(r.updated_at),
    pharmacy: {
      id: r.p_id, name: r.p_name, city: r.city, address: r.address,
      phone: r.phone, hours: r.hours, lat: r.lat, lng: r.lng,
    },
    distance_km: located ? distanceKm(lat, lng, r.lat, r.lng) : null,
  }));
  // Если знаем, где пользователь — сначала ближайшие, иначе сначала дешёвые. Нет в наличии — в конец
  const key = located ? "distance_km" : "price_som";
  offers.sort((a, b) => (b.in_stock - a.in_stock) || (a[key] - b[key]));

  const stats = await statsFor([id]);
  res.json({ ...short(m, stats), purpose: m.purpose, contraindications: m.contraindications, offers });
}));

app.get("/api/medicines/:id/reviews", wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (!(await medicineExists(id))) return notFound(res);
  const rows = await db.all(
    "SELECT * FROM reviews WHERE medicine_id = ? ORDER BY created_at DESC, id DESC",
    [id],
  );
  res.json(rows.map(reviewOut));
}));

/** Проверка отзыва. Те же правила, что у Pydantic-схемы ReviewIn в Python. */
function validateReview(body) {
  const errors = [];
  const author = typeof body?.author === "string" ? body.author.trim() : "";
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const rating = body?.rating;
  if (author.length < 2 || author.length > 60) errors.push("author: от 2 до 60 символов");
  if (text.length < 5 || text.length > 2000) errors.push("text: от 5 до 2000 символов");
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) errors.push("rating: целое число от 1 до 5");
  return { errors, value: { author, text, rating } };
}

app.post("/api/medicines/:id/reviews", wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (!(await medicineExists(id))) return notFound(res);

  const { errors, value } = validateReview(req.body);
  if (errors.length) return res.status(422).json({ detail: errors });

  const row = await db.get(
    "INSERT INTO reviews (medicine_id, author, rating, text, created_at) VALUES (?, ?, ?, ?, ?) RETURNING *",
    [id, value.author, value.rating, value.text, new Date().toISOString()],
  );
  res.status(201).json(reviewOut(row));
}));

app.get("/api/pharmacies", wrap(async (req, res) => {
  const params = [];
  let where = "";
  if (req.query.city) {
    where = "WHERE city = ?";
    params.push(String(req.query.city));
  }
  res.json(await db.all(`SELECT * FROM pharmacies ${where} ORDER BY city, name`, params));
}));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", db: db.dialect, backend: "node" });
});

app.use("/api", (req, res) => res.status(404).json({ detail: "Not Found" }));

// Сломанный JSON в теле запроса → 422, как у FastAPI; остальное → 500
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") return res.status(422).json({ detail: "Неверный JSON" });
  console.error(err);
  res.status(500).json({ detail: "Ошибка сервера" });
});

// Для запуска без Docker: бэкенд сам отдаёт фронтенд из папки ../frontend
const FRONTEND_DIR = path.resolve(__dirname, "..", "..", "frontend");
if (fs.existsSync(FRONTEND_DIR)) app.use(express.static(FRONTEND_DIR));

module.exports = app;
