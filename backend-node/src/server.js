const app = require("./app");
const { db, createTables } = require("./db");
const { seedIfEmpty } = require("./seed");

const PORT = Number(process.env.PORT) || 8000;

async function main() {
  await createTables();
  await seedIfEmpty(db);
  app.listen(PORT, () => {
    console.log(`Dary.kg API (Node.js, ${db.dialect}) — http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("Не удалось запустить сервер:", err);
  process.exit(1);
});
