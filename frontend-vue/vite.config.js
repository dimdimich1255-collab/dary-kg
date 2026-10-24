import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// Куда пересылать /api в режиме разработки: по умолчанию бэкенд на 8000.
// Другой бэкенд: API_TARGET=http://localhost:8002 npm run dev
const target = process.env.API_TARGET || "http://localhost:8000";

export default defineConfig({
  plugins: [vue()],
  server: { port: 5175, proxy: { "/api": target } },
  preview: { port: 5176, proxy: { "/api": target } },
});
