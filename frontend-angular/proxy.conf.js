// Куда dev-сервер Angular пересылает /api: по умолчанию бэкенд на 8000.
// Другой бэкенд: API_TARGET=http://localhost:8002 npm start
module.exports = {
  "/api": {
    target: process.env.API_TARGET || "http://localhost:8000",
    changeOrigin: true,
  },
};
