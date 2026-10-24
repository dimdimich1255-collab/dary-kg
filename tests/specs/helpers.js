// Общие помощники для тестов.
// Пароль админки: при запуске через Playwright он задан в playwright.config.js,
// для Docker-версии: ADMIN_PASSWORD=local-admin npx playwright test (см. README).
// (в пароле по умолчанию есть русские буквы: так проверяем, что они проходят в заголовке)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "пароль-модератора-тест";
// Пароль передаётся в base64 (UTF-8), чтобы в нём можно было писать по-русски
const bearer = (password) => ({ Authorization: `Bearer ${Buffer.from(password, "utf8").toString("base64")}` });
const ADMIN = bearer(ADMIN_PASSWORD);

/** Случайный «IP посетителя». Сервер считает лимиты по IP, поэтому каждому тесту нужен свой. */
function uniqueIp() {
  const n = () => Math.floor(Math.random() * 250) + 1;
  return `10.${n()}.${n()}.${n()}`;
}

const asVisitor = (ip) => ({ "X-Forwarded-For": ip });

/** id лекарства по названию — не зависим от порядка в базе. */
async function medicineId(request, name) {
  const list = await (await request.get(`/api/medicines?q=${encodeURIComponent(name)}`)).json();
  return list.find((m) => m.name === name).id;
}

/** Отправить отзыв от имени посетителя с заданным IP. Возвращает ответ сервера. */
function submitReview(request, id, data, ip = uniqueIp()) {
  return request.post(`/api/medicines/${id}/reviews`, { data, headers: asVisitor(ip) });
}

/** Найти отзыв в админке по тексту (в любом статусе). */
async function findReview(request, text) {
  const res = await request.get("/api/admin/reviews?status=all", { headers: ADMIN });
  if (!res.ok()) throw new Error(`Админка ответила ${res.status()}: проверьте ADMIN_PASSWORD`);
  return (await res.json()).find((r) => r.text === text);
}

/** Одобрить отзыв как модератор. */
async function approveReview(request, text) {
  const review = await findReview(request, text);
  if (!review) throw new Error(`Отзыв не найден в админке: ${text}`);
  const res = await request.post(`/api/admin/reviews/${review.id}/approve`, { headers: ADMIN });
  if (!res.ok()) throw new Error(`Не удалось одобрить отзыв: ${res.status()}`);
  return review.id;
}

module.exports = { ADMIN, ADMIN_PASSWORD, bearer, asVisitor, uniqueIp, medicineId, submitReview, findReview, approveReview };
