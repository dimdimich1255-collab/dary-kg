// @ts-check
const { test, expect } = require("@playwright/test");
const { asVisitor, uniqueIp, medicineId, submitReview, approveReview } = require("./helpers");

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
  // Лимиты считаются по IP, поэтому каждый тест «приходит» с собственного адреса
  test.beforeEach(async ({ page }) => {
    await page.setExtraHTTPHeaders(asVisitor(uniqueIp()));
  });

  test("отзыв появляется после проверки модератором", async ({ page, request }, testInfo) => {
    const id = await medicineId(request, "Цетиризин");
    const author = `Тестер ${testInfo.project.name}`;
    const text = `Помог от аллергии на цветение, проверка ${Date.now()}`;

    await page.goto(`/#/medicine/${id}`);
    await page.getByPlaceholder("Ваше имя").fill(author);
    await page.getByRole("button", { name: "4 из 5" }).click();
    await page.getByPlaceholder(/Помогло ли лекарство/).fill(text);
    await page.getByRole("button", { name: "Отправить отзыв" }).click();

    // Автор видит благодарность, форма очистилась, но отзыв пока не опубликован
    await expect(page.getByText("Отзыв появится на сайте после проверки.", { exact: false }).first()).toBeVisible();
    await expect(page.getByRole("status")).toContainText("Спасибо");
    await expect(page.getByPlaceholder("Ваше имя")).toHaveValue("");
    await expect(page.getByTestId("review").filter({ hasText: text })).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId("review").filter({ hasText: text })).toHaveCount(0);

    // Модератор одобрил: отзыв виден всем
    await approveReview(request, text);
    await page.reload();
    const review = page.getByTestId("review").filter({ hasText: text });
    await expect(review).toBeVisible();
    await expect(review).toContainText(author);
    await expect(review).toContainText("★★★★☆");
  });

  test("ссылка в отзыве не принимается, причина показана", async ({ page, request }) => {
    const id = await medicineId(request, "Смекта");
    await page.goto(`/#/medicine/${id}`);
    await page.getByPlaceholder("Ваше имя").fill("Спамер");
    await page.getByRole("button", { name: "5 из 5" }).click();
    await page.getByPlaceholder(/Помогло ли лекарство/).fill("Лучшие цены на www.pharma-shop.kg");
    await page.getByRole("button", { name: "Отправить отзыв" }).click();

    await expect(page.getByText("Ссылки в отзывах запрещены")).toBeVisible();
    await expect(page.getByRole("status")).toBeEmpty();
  });

  test("на одобренный отзыв можно пожаловаться", async ({ page, request }) => {
    const id = await medicineId(request, "Лоратадин");
    const text = `Отзыв для жалобы ${Date.now()}`;
    await submitReview(request, id, { author: "Автор", rating: 3, text });
    await approveReview(request, text);

    await page.goto(`/#/medicine/${id}`);
    const review = page.getByTestId("review").filter({ hasText: text });
    await review.getByRole("button", { name: "Пожаловаться" }).click();
    await expect(review.getByRole("button", { name: "Жалоба отправлена" })).toBeDisabled();
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
    await expect(page.getByRole("status")).toContainText("Спасибо");

    // Даже одобренный модератором, вредный код показывается просто текстом
    await approveReview(request, evil);
    await page.reload();
    await expect(page.getByTestId("review").filter({ hasText: evil })).toBeVisible();
    await expect(page.locator("#reviews img")).toHaveCount(0);
    expect(await page.evaluate(() => window.hacked)).toBeUndefined();
  });
});
