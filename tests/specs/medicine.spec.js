// @ts-check
const { test, expect } = require("@playwright/test");

// Находим id лекарства по названию через API, чтобы не зависеть от порядка в базе
async function medicineId(request, name) {
  const list = await (await request.get(`/api/medicines?q=${encodeURIComponent(name)}`)).json();
  return list.find((m) => m.name === name).id;
}

test.describe("Страница лекарства", () => {
  test("показывает описание и противопоказания", async ({ page, request }) => {
    const id = await medicineId(request, "Ибупрофен");
    await page.goto(`/#/medicine/${id}`);
    await expect(page.getByRole("heading", { name: "Для чего нужно" })).toBeVisible();
    await expect(page.getByText("Обезболивает и снимает воспаление")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Противопоказания" })).toBeVisible();
  });

  test("самая низкая цена подсвечена и стоит первой", async ({ page, request }) => {
    const id = await medicineId(request, "Парацетамол");
    const med = await (await request.get(`/api/medicines/${id}`)).json();
    const cheapest = Math.min(...med.offers.filter((o) => o.in_stock).map((o) => o.price_som));

    await page.goto(`/#/medicine/${id}`);
    const firstRow = page.locator(".offers tbody tr").first();
    await expect(firstRow).toHaveClass(/best/);
    await expect(firstRow).toContainText(`${cheapest} сом`);
    await expect(firstRow).toContainText("дешевле всего");
  });

  test("выбор города оставляет только аптеки этого города", async ({ page, request }) => {
    const id = await medicineId(request, "Парацетамол");
    await page.goto(`/#/medicine/${id}`);
    await page.getByLabel("Город").selectOption("Бишкек");

    await expect(page.getByRole("heading", { name: "Где купить в г. Бишкек" })).toBeVisible();
    const rows = page.locator(".offers tbody tr");
    await expect(rows.first()).toBeVisible();
    for (const row of await rows.all()) {
      await expect(row).toContainText("Бишкек,");
    }
  });

  test("«Найти ближайшие» сортирует аптеки по расстоянию", async ({ page, context, request }) => {
    // Притворяемся, что пользователь стоит на площади Ала-Тоо в Бишкеке
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 42.8766, longitude: 74.6036 });

    const id = await medicineId(request, "Парацетамол");
    await page.goto(`/#/medicine/${id}`);
    await page.getByRole("button", { name: /Найти ближайшие/ }).click();

    await expect(page.locator(".offers th", { hasText: "Расстояние" })).toBeVisible();
    const distances = (await page.locator(".offers tbody tr:not(.out) td:nth-last-child(2)").allInnerTexts())
      .map((t) => parseFloat(t));
    expect(distances.length).toBeGreaterThan(1);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
    expect(distances[0]).toBeLessThan(5); // ближайшая — в Бишкеке, а не в Оше
  });

  test("несуществующее лекарство — сообщение об ошибке", async ({ page }) => {
    await page.goto("/#/medicine/99999");
    await expect(page.getByText("Лекарство не найдено")).toBeVisible();
  });
});

test.describe("Отзывы", () => {
  test("отзыв сохраняется и виден после перезагрузки", async ({ page, request }, testInfo) => {
    const id = await medicineId(request, "Цетиризин");
    const author = `Тестер ${testInfo.project.name}`;
    const text = `Помог от аллергии на цветение, проверка ${Date.now()}`;

    await page.goto(`/#/medicine/${id}`);
    await page.getByPlaceholder("Ваше имя").fill(author);
    await page.getByRole("button", { name: "4 из 5" }).click();
    await page.getByPlaceholder(/Помогло ли лекарство/).fill(text);
    await page.getByRole("button", { name: "Отправить отзыв" }).click();

    const review = page.getByTestId("review").filter({ hasText: text });
    await expect(review).toBeVisible();
    await expect(review).toContainText(author);
    await expect(review).toContainText("★★★★☆");
    await expect(page.getByPlaceholder("Ваше имя")).toHaveValue(""); // форма очистилась

    // Другой пользователь (новая страница) тоже видит отзыв
    await page.reload();
    await expect(page.getByTestId("review").filter({ hasText: text })).toBeVisible();
  });

  test("без звёзд отзыв не отправляется", async ({ page, request }) => {
    const id = await medicineId(request, "Смекта");
    await page.goto(`/#/medicine/${id}`);
    await page.getByPlaceholder("Ваше имя").fill("Айбек");
    await page.getByPlaceholder(/Помогло ли лекарство/).fill("Забыл поставить оценку");
    await page.getByRole("button", { name: "Отправить отзыв" }).click();

    await expect(page.getByText("Поставьте оценку от 1 до 5 звёзд")).toBeVisible();
    await expect(page.getByTestId("review").filter({ hasText: "Забыл поставить оценку" })).toHaveCount(0);
  });

  test("HTML в отзыве показывается как текст (защита от XSS)", async ({ page, request }) => {
    const id = await medicineId(request, "Регидрон");
    const evil = `<img src=x onerror="window.hacked=true">взлом ${Date.now()}`;

    await page.goto(`/#/medicine/${id}`);
    await page.getByPlaceholder("Ваше имя").fill("Хакер");
    await page.getByRole("button", { name: "1 из 5" }).click();
    await page.getByPlaceholder(/Помогло ли лекарство/).fill(evil);
    await page.getByRole("button", { name: "Отправить отзыв" }).click();

    await expect(page.getByTestId("review").filter({ hasText: evil })).toBeVisible();
    await expect(page.locator("#reviews img")).toHaveCount(0);
    expect(await page.evaluate(() => window.hacked)).toBeUndefined();
  });
});
