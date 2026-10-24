// @ts-check
const fs = require("fs");
const path = require("path");
const { defineConfig, devices } = require("@playwright/test");

// Можно тестировать любой уже запущенный сайт, например Docker:
//   BASE_URL=http://localhost:8080 npx playwright test
// Если BASE_URL не задан, Playwright сам запустит Python-бэкенд с чистой SQLite-базой.
const externalUrl = process.env.BASE_URL;
const PORT = 8001;

const testDb = path.join(__dirname, "test.db");
// Каждый прогон с чистой базой. Конфиг читают и воркеры (у них есть TEST_WORKER_INDEX),
// а удалять файл можно только в главном процессе — до запуска сервера.
if (!externalUrl && !process.env.TEST_WORKER_INDEX) fs.rmSync(testDb, { force: true });

const python = process.platform === "win32"
  ? path.join("..", "backend", ".venv", "Scripts", "python.exe")
  : path.join("..", "backend", ".venv", "bin", "python");

module.exports = defineConfig({
  testDir: "./specs",
  timeout: 15_000,
  fullyParallel: false, // тесты пишут отзывы в одну базу
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: externalUrl || `http://localhost:${PORT}`,
    locale: "ru-RU",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: externalUrl ? undefined : {
    // Бэкенд сам отдаёт и API, и vanilla-фронтенд с одного адреса
    command: `"${python}" -m uvicorn app.main:app --port ${PORT} --app-dir ../backend`,
    url: `http://localhost:${PORT}/api/health`,
    env: {
      DATABASE_URL: `sqlite:///${testDb.replace(/\\/g, "/")}`,
      // Модерация: пароль админки, а IP читаем из X-Forwarded-For, чтобы каждый тест
      // мог «прийти» с собственного адреса и не упираться в лимиты отзывов
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "пароль-модератора-тест",
      IP_SALT: "test-salt",
      TRUST_PROXY: "1",
    },
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
