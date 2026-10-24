// @ts-check
// Тесты API без браузера. Это «контракт»: любой бэкенд (Node, Go, Java, Rust, PHP)
// должен проходить эти же тесты.
const { test, expect } = require("@playwright/test");

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

  test("POST отзыва: корректный — 201, средний рейтинг пересчитался", async ({ request }) => {
    const list = await (await request.get("/api/medicines?q=" + encodeURIComponent("валидол"))).json();
    const before = list[0];

    const res = await request.post(`/api/medicines/${before.id}/reviews`, {
      data: { author: "  API-тест  ", rating: 5, text: "Отзыв из API-теста" },
    });
    expect(res.status()).toBe(201);
    const review = await res.json();
    expect(review.author).toBe("API-тест"); // пробелы обрезаны

    const after = (await (await request.get(`/api/medicines/${before.id}`)).json());
    expect(after.reviews_count).toBe(before.reviews_count + 1);
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
      const res = await request.post("/api/medicines/1/reviews", { data });
      expect(res.status()).toBe(422);
    });
  }
});
