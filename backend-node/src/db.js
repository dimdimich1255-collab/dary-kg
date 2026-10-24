// Слой базы данных: одинаковые функции all / get / run для SQLite и PostgreSQL.
// В SQL везде пишем «?», а для Postgres сами превращаем их в $1, $2, ...
//
// DATABASE_URL такой же, как у Python-бэкенда:
//   sqlite:///./dary.db                                  (по умолчанию)
//   postgresql+psycopg://dary:dary@postgres:5432/dary

const DATABASE_URL = process.env.DATABASE_URL || "sqlite:///./dary.db";
const isPostgres = DATABASE_URL.startsWith("postgres");

// В SQLite нет типа boolean — храним 0/1, а наружу отдаём true/false
const toDb = (v) => (typeof v === "boolean" ? (isPostgres ? v : Number(v)) : v);

function createSqlite() {
  const { DatabaseSync } = require("node:sqlite"); // встроен в Node.js 22+, ставить ничего не надо
  const file = DATABASE_URL.replace(/^sqlite:(\/\/\/)?/, "");
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON");

  return {
    dialect: "sqlite",
    async all(sql, params = []) { return db.prepare(sql).all(...params.map(toDb)); },
    async get(sql, params = []) { return db.prepare(sql).get(...params.map(toDb)); },
    async run(sql, params = []) { db.prepare(sql).run(...params.map(toDb)); },
    async exec(sql) { db.exec(sql); },
    async transaction(fn) {
      db.exec("BEGIN");
      try { await fn(); db.exec("COMMIT"); } catch (e) { db.exec("ROLLBACK"); throw e; }
    },
  };
}

function createPostgres() {
  const { Pool } = require("pg");
  // psycopg — это драйвер Python, Node его не понимает: убираем «+psycopg»
  const pool = new Pool({ connectionString: DATABASE_URL.replace(/^postgresql\+\w+:/, "postgresql:") });
  const numbered = (sql) => { let i = 0; return sql.replace(/\?/g, () => `$${++i}`); };
  let client = null; // внутри транзакции все запросы идут через одно соединение
  const q = (sql, params = []) => (client || pool).query(numbered(sql), params.map(toDb));

  return {
    dialect: "postgresql",
    async all(sql, params) { return (await q(sql, params)).rows; },
    async get(sql, params) { return (await q(sql, params)).rows[0]; },
    async run(sql, params) { await q(sql, params); },
    async exec(sql) { await pool.query(sql); },
    async transaction(fn) {
      client = await pool.connect();
      try {
        await client.query("BEGIN"); await fn(); await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK"); throw e;
      } finally {
        client.release(); client = null;
      }
    },
  };
}

const db = isPostgres ? createPostgres() : createSqlite();

// Таблицы те же, что создаёт Python-бэкенд (SQLAlchemy), — оба бэкенда могут работать с одной базой
const id = isPostgres ? "SERIAL PRIMARY KEY" : "INTEGER PRIMARY KEY AUTOINCREMENT";
const ts = isPostgres ? "TIMESTAMPTZ" : "DATETIME";

async function createTables() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS medicines (
      id ${id},
      name VARCHAR(120) NOT NULL,
      generic_name VARCHAR(120) NOT NULL,
      category VARCHAR(60) NOT NULL,
      form VARCHAR(120) NOT NULL,
      purpose TEXT NOT NULL,
      contraindications TEXT NOT NULL,
      prescription BOOLEAN NOT NULL,
      image_url VARCHAR(300),
      search TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pharmacies (
      id ${id},
      name VARCHAR(120) NOT NULL,
      city VARCHAR(60) NOT NULL,
      address VARCHAR(200) NOT NULL,
      phone VARCHAR(40) NOT NULL,
      hours VARCHAR(60) NOT NULL,
      lat FLOAT NOT NULL,
      lng FLOAT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS offers (
      id ${id},
      medicine_id INTEGER NOT NULL REFERENCES medicines(id),
      pharmacy_id INTEGER NOT NULL REFERENCES pharmacies(id),
      price_som INTEGER NOT NULL,
      in_stock BOOLEAN NOT NULL,
      updated_at ${ts} NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reviews (
      id ${id},
      medicine_id INTEGER NOT NULL REFERENCES medicines(id),
      author VARCHAR(60) NOT NULL,
      rating INTEGER NOT NULL,
      text TEXT NOT NULL,
      created_at ${ts} NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_offers_medicine_id ON offers (medicine_id);
    CREATE INDEX IF NOT EXISTS ix_reviews_medicine_id ON reviews (medicine_id);
  `);
}

module.exports = { db, createTables };
