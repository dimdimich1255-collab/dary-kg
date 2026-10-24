// @ts-check
const fs = require("fs");
const path = require("path");
const { defineConfig, devices } = require("@playwright/test");

// Можно тестировать любой уже запущенный стек, например Docker:
//   BASE_URL=http://localhost:8080 npx playwright test
//
// Если BASE_URL не задан, Playwright сам запустит нужную связку с чистой SQLite-базой:
//   BACKEND  = python (по умолчанию) | node
//   FRONTEND = vanilla (по умолчанию) | react | vue | angular
// Например: BACKEND=node FRONTEND=angular npx playwright test
const externalUrl = process.env.BASE_URL;
const backend = process.env.BACKEND || "python";
const frontend = process.env.FRONTEND || "vanilla";
const API_PORT = 8001;

// Фронтенды со своим сервером: папка, порт и команда, которая собирает и запускает их
// (порты — из vite.config.js и angular.json). Vanilla сюда не входит — его отдаёт сам бэкенд
const vitePreview = "npm run build && npm run preview -- --strictPort";
const frontends = {
  react: { dir: "frontend-react", port: 5174, command: vitePreview },
  vue: { dir: "frontend-vue", port: 5176, command: vitePreview },
  angular: {
    dir: "frontend-angular",
    port: 5177,
    command: "node node_modules/@angular/cli/bin/ng.js serve --configuration production",
  },
};

const testDb = path.join(__dirname, "test.db");
// Каждый прогон с чистой базой. Конфиг читают и воркеры (у них есть TEST_WORKER_INDEX),
// а удалять файл можно только в главном процессе — до запуска сервера.
if (!externalUrl && !process.env.TEST_WORKER_INDEX) fs.rmSync(testDb, { force: true });

const python = process.platform === "win32"
  ? path.join("..", "backend", ".venv", "Scripts", "python.exe")
  : path.join("..", "backend", ".venv", "bin", "python");

const backends = {
  python: `"${python}" -m uvicorn app.main:app --port ${API_PORT} --app-dir ../backend`,
  node: `node ../backend-node/src/server.js`,
};
if (!backends[backend]) throw new Error(`Неизвестный BACKEND=${backend}. Есть: ${Object.keys(backends).join(", ")}`);
const ui = frontends[frontend];
if (frontend !== "vanilla" && !ui) {
  throw new Error(`Неизвестный FRONTEND=${frontend}. Есть: vanilla, ${Object.keys(frontends).join(", ")}`);
}

const servers = [{
  // Бэкенд. Vanilla-фронтенд он отдаёт сам с того же адреса
  command: backends[backend],
  url: `http://localhost:${API_PORT}/api/health`,
  env: { DATABASE_URL: `sqlite:///${testDb.replace(/\\/g, "/")}`, PORT: String(API_PORT) },
  reuseExistingServer: false,
  timeout: 30_000,
}];

if (ui) {
  // Собираем и запускаем фронтенд; /api его сервер пересылает в бэкенд
  servers.push({
    command: ui.command,
    cwd: path.join(__dirname, "..", ui.dir),
    url: `http://localhost:${ui.port}`,
    env: { API_TARGET: `http://localhost:${API_PORT}` },
    reuseExistingServer: false,
    timeout: 60_000,
  });
}

module.exports = defineConfig({
  testDir: "./specs",
  timeout: 15_000,
  fullyParallel: false, // тесты пишут отзывы в одну базу
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: externalUrl || `http://localhost:${ui ? ui.port : API_PORT}`,
    locale: "ru-RU",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: externalUrl ? undefined : servers,
});
