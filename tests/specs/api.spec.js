// @ts-check
// Тесты API без браузера.
const { test, expect } = require("@playwright/test");
const {
  ADMIN, asVisitor, bearer, uniqueIp, medicineId, submitReview, findReview, approveReview,
} = require("./helpers");

const publicReviews = async (request, id) => (await request.get(`/api/medicines/${id}/reviews`)).json();

test.describe("API", () => {
  // Браузер не нужен, поэтому гоняем только в одном проекте
  test.beforeEach(({ }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API проверяем один раз");
  });

  test("GET /api/medicines — список с нужными полями", async ({ request }) => {
    const res = await request.get("/api/medicines");
    expect(res.ok()).toBeTruthy();
    const list = await res.json();
    expect(list.length).toBeGreaterThan(0);
    expect(list[0]).toEqual(expect.objectContaining({
      id: expect.any(Number),
      name: expect.any(String),
      category: expect.any(String),
      prescription: expect.any(Boolean),
      reviews_count: expect.any(Number),
    }));
  });

  test("GET /api/medicines?category= фильтрует", async ({ request }) => {
    const list = await (await request.get("/api/medicines?category=" + encodeURIComponent("Антибиотики"))).json();
    expect(list.length).toBeGreaterThan(0);
    for (const m of list) {
      expect(m.category).toBe("Антибиотики");
      expect(m.prescription).toBe(true);
    }
  });

  test("GET /api/medicines/{id}?lat&lng — аптеки отсортированы по расстоянию", async ({ request }) => {
    // Берём лекарство, которое точно есть в наличии в Оше (демо-данные случайные)
    let med;
    for (const m of await (await request.get("/api/medicines")).json()) {
      med = await (await request.get(`/api/medicines/${m.id}?lat=40.52&lng=72.80`)).json(); // Ош
      if (med.offers.some((o) => o.in_stock && o.pharmacy.city === "Ош")) break;
    }
    const inStock = med.offers.filter((o) => o.in_stock);
    const d = inStock.map((o) => o.distance_km);
    expect(d).toEqual([...d].sort((a, b) => a - b));
    expect(inStock[0].pharmacy.city).toBe("Ош");
  });

  test("GET /api/medicines/{id}?city= — только этот город", async ({ request }) => {
    const [first] = await (await request.get("/api/medicines")).json();
    const med = await (await request.get(`/api/medicines/${first.id}?city=` + encodeURIComponent("Бишкек"))).json();
    for (const o of med.offers) expect(o.pharmacy.city).toBe("Бишкек");
  });

  test("404 для несуществующего лекарства", async ({ request }) => {
    expect((await request.get("/api/medicines/99999")).status()).toBe(404);
    expect((await request.get("/api/medicines/99999/reviews")).status()).toBe(404);
  });
});

test.describe("Модерация отзывов", () => {
  test.beforeEach(({ }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API проверяем один раз");
  });

  test("новый отзыв ждёт проверки и не виден, пока модератор не одобрит", async ({ request }) => {
    const id = await medicineId(request, "Валидол");
    const before = await (await request.get(`/api/medicines/${id}`)).json();
    const text = `Отзыв из API-теста ${Date.now()}`;

    const res = await submitReview(request, id, { author: "  API-тест  ", rating: 5, text });
    expect(res.status()).toBe(201);
    const review = await res.json();
    expect(review.author).toBe("API-тест"); // пробелы обрезаны
    expect(review.status).toBe("pending");

    // Пока не одобрен: не в списке отзывов и не в рейтинге
    expect((await publicReviews(request, id)).map((r) => r.text)).not.toContain(text);
    expect((await (await request.get(`/api/medicines/${id}`)).json()).reviews_count).toBe(before.reviews_count);
    expect((await findReview(request, text)).status).toBe("pending");

    // После одобрения: виден и учтён в рейтинге
    await approveReview(request, text);
    expect((await publicReviews(request, id)).map((r) => r.text)).toContain(text);
    expect((await (await request.get(`/api/medicines/${id}`)).json()).reviews_count).toBe(before.reviews_count + 1);
  });

  test("отклонённый отзыв остаётся невидимым", async ({ request }) => {
    const id = await medicineId(request, "Валидол");
    const text = `Отзыв для отклонения ${Date.now()}`;
    await submitReview(request, id, { author: "Тестер", rating: 1, text });
    const review = await findReview(request, text);

    const res = await request.post(`/api/admin/reviews/${review.id}/reject`, { headers: ADMIN });
    expect((await res.json()).status).toBe("rejected");
    expect((await publicReviews(request, id)).map((r) => r.text)).not.toContain(text);
  });

  test("модератор может удалить отзыв", async ({ request }) => {
    const id = await medicineId(request, "Валидол");
    const text = `Отзыв для удаления ${Date.now()}`;
    await submitReview(request, id, { author: "Тестер", rating: 3, text });
    const review = await findReview(request, text);

    expect((await request.delete(`/api/admin/reviews/${review.id}`, { headers: ADMIN })).status()).toBe(204);
    expect(await findReview(request, text)).toBeUndefined();
    expect((await request.post(`/api/admin/reviews/${review.id}/approve`, { headers: ADMIN })).status()).toBe(404);
  });

  for (const [name, data] of [
    ["рейтинг 0", { author: "Тест", rating: 0, text: "Нормальный текст" }],
    ["рейтинг 6", { author: "Тест", rating: 6, text: "Нормальный текст" }],
    ["имя из 1 буквы", { author: "Т", rating: 3, text: "Нормальный текст" }],
    ["имя из пробелов", { author: "     ", rating: 3, text: "Нормальный текст" }],
    ["короткий текст", { author: "Тест", rating: 3, text: "ок" }],
    ["нет текста", { author: "Тест", rating: 3 }],
  ]) {
    test(`POST отзыва отклоняется: ${name}`, async ({ request }) => {
      const res = await submitReview(request, 1, data);
      expect(res.status()).toBe(422);
    });
  }

  for (const text of [
    "Лучшая цена тут www.pharma-shop.kg",
    "Заходите https://spam.example/buy",
    "Пишите в t.me/lekarstva_kg",
    "Дешевле на aptekaonline.ru всего за день",
  ]) {
    test(`ссылки в отзыве запрещены: ${text.slice(0, 28)}…`, async ({ request }) => {
      const res = await submitReview(request, 1, { author: "Спамер", rating: 5, text });
      expect(res.status()).toBe(422);
      expect((await res.json()).detail).toContain("Ссылки");
    });
  }

  test("ловушка для ботов: заполненное скрытое поле — отзыв не сохраняется", async ({ request }) => {
    const id = await medicineId(request, "Валидол");
    const text = `Отзыв от бота ${Date.now()}`;
    const res = await submitReview(request, id, { author: "Бот", rating: 5, text, website: "http://bot.example" });
    expect(res.status()).toBe(201); // бот не должен понять, что его раскусили
    expect(await findReview(request, text)).toBeUndefined();
  });

  test("тот же отзыв с того же устройства повторно не принимается", async ({ request }) => {
    const id = await medicineId(request, "Валидол");
    const ip = uniqueIp();
    const data = { author: "Тестер", rating: 4, text: `Повторяющийся отзыв ${Date.now()}` };
    expect((await submitReview(request, id, data, ip)).status()).toBe(201);
    expect((await submitReview(request, id, data, ip)).status()).toBe(409);
    // с другого устройства такой же текст допустим
    expect((await submitReview(request, id, data, uniqueIp())).status()).toBe(201);
  });

  test("лимит: не больше 3 отзывов за 10 минут с одного устройства", async ({ request }) => {
    // Лимиты Docker-версии задаются при её запуске, поэтому там этот тест не гоняем
    test.skip(!!process.env.BASE_URL, "лимиты внешнего сервера могут быть другими");
    const id = await medicineId(request, "Валидол");
    const ip = uniqueIp();
    const send = (n) => submitReview(request, id, { author: "Тестер", rating: 4, text: `Отзыв номер ${n} ${Date.now()}` }, ip);

    for (const n of [1, 2, 3]) expect((await send(n)).status()).toBe(201);
    const res = await send(4);
    expect(res.status()).toBe(429);
    expect((await res.json()).detail).toContain("Слишком много");
    // другому посетителю лимит не мешает
    expect((await submitReview(request, id, { author: "Другой", rating: 5, text: `Отзыв другого ${Date.now()}` })).status()).toBe(201);
  });

  test("жалобы: после 3 жалоб с разных устройств отзыв скрывается до проверки", async ({ request }) => {
    const id = await medicineId(request, "Валидол");
    const text = `Отзыв с жалобами ${Date.now()}`;
    await submitReview(request, id, { author: "Тестер", rating: 2, text });
    const reviewId = await approveReview(request, text);
    const report = (ip) => request.post(`/api/reviews/${reviewId}/report`, { headers: asVisitor(ip) });

    const first = uniqueIp();
    expect((await report(first)).status()).toBe(204);
    expect((await report(first)).status()).toBe(204); // повтор с того же устройства не считается
    expect((await report(uniqueIp())).status()).toBe(204);
    expect((await publicReviews(request, id)).map((r) => r.text)).toContain(text); // жалоб пока 2

    expect((await report(uniqueIp())).status()).toBe(204); // третья
    expect((await publicReviews(request, id)).map((r) => r.text)).not.toContain(text);
    const hidden = await findReview(request, text);
    expect(hidden.status).toBe("pending");
    expect(hidden.reports).toBe(3);

    // Модератор проверил и вернул: жалобы обнуляются
    await approveReview(request, text);
    expect((await publicReviews(request, id)).map((r) => r.text)).toContain(text);
    expect((await findReview(request, text)).reports).toBe(0);
  });

  test("жалоба на несуществующий или неодобренный отзыв — 404", async ({ request }) => {
    expect((await request.post("/api/reviews/99999/report", { headers: asVisitor(uniqueIp()) })).status()).toBe(404);
    const id = await medicineId(request, "Валидол");
    const text = `Ещё не одобрен ${Date.now()}`;
    await submitReview(request, id, { author: "Тестер", rating: 3, text });
    const review = await findReview(request, text);
    expect((await request.post(`/api/reviews/${review.id}/report`, { headers: asVisitor(uniqueIp()) })).status()).toBe(404);
  });
});

test.describe("Доступ к админке", () => {
  test.beforeEach(({ }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API проверяем один раз");
  });

  test("без пароля и с неверным паролем — 401", async ({ request }) => {
    const headers = asVisitor(uniqueIp());
    expect((await request.get("/api/admin/reviews", { headers })).status()).toBe(401);
    const wrong = { ...headers, ...bearer("неверный-пароль") };
    expect((await request.get("/api/admin/reviews", { headers: wrong })).status()).toBe(401);
    // мусор вместо base64 тоже не пускает и не ломает сервер
    const garbage = { ...headers, Authorization: "Bearer !!!не-base64!!!".replace(/[^\x20-\x7e]/g, "x") };
    expect((await request.get("/api/admin/reviews", { headers: garbage })).status()).toBe(401);
    expect((await request.post("/api/admin/reviews/1/approve", { headers })).status()).toBe(401);
    expect((await request.delete("/api/admin/reviews/1", { headers })).status()).toBe(401);
  });

  test("с верным паролем список отзывов открывается", async ({ request }) => {
    const res = await request.get("/api/admin/reviews?status=all", { headers: ADMIN });
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual(expect.any(Array));
  });

  test("после 5 неверных паролей вход блокируется на 10 минут", async ({ request }) => {
    const ip = uniqueIp();
    const wrong = { ...asVisitor(ip), ...bearer("неверный") };
    for (let i = 0; i < 5; i++) expect((await request.get("/api/admin/reviews", { headers: wrong })).status()).toBe(401);
    expect((await request.get("/api/admin/reviews", { headers: wrong })).status()).toBe(429);
    // даже верный пароль с этого устройства сейчас не принимается
    expect((await request.get("/api/admin/reviews", { headers: { ...asVisitor(ip), ...ADMIN } })).status()).toBe(429);
  });
});
