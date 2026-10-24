import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Куда пересылать /api в режиме разработки: по умолчанию бэкенд на 8000.
// Другой бэкенд: API_TARGET=http://localhost:8002 npm run dev
const target = process.env.API_TARGET || "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": target } },
  preview: { port: 5174, proxy: { "/api": target } },
});
