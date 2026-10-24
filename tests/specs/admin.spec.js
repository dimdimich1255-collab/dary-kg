// @ts-check
// Страница модерации /admin.html
const { test, expect } = require("@playwright/test");
const { ADMIN_PASSWORD, asVisitor, uniqueIp, medicineId, submitReview } = require("./helpers");

test.describe("Страница модерации", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "админку проверяем на компьютере");
    await page.setExtraHTTPHeaders(asVisitor(uniqueIp()));
  });

  test("неверный пароль не пускает, верный пускает", async ({ page }) => {
    await page.goto("/admin.html");
    await expect(page.getByRole("heading", { name: "Вход для модератора" })).toBeVisible();

    await page.getByPlaceholder("Пароль").fill("неверный-пароль");
    await page.getByRole("button", { name: "Войти" }).click();
    await expect(page.getByText("Неверный пароль")).toBeVisible();
    await expect(page.getByText("Какие отзывы отклонять")).toBeHidden();

    await page.getByPlaceholder("Пароль").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Войти" }).click();
    await expect(page.getByText("Какие отзывы отклонять")).toBeVisible();
  });

  test("одобрить и отклонить отзыв из админки", async ({ page, request }) => {
    const id = await medicineId(request, "Омепразол");
    const stamp = Date.now();
    const good = `Хороший отзыв для проверки ${stamp}`;
    const bad = `Советую пить по 10 таблеток ${stamp}`;
    await submitReview(request, id, { author: "Айгуль", rating: 5, text: good });
    await submitReview(request, id, { author: "Дастан", rating: 1, text: bad });

    await page.goto("/admin.html");
    await page.getByPlaceholder("Пароль").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Войти" }).click();

    const goodCard = page.locator(".admin-card").filter({ hasText: good });
    const badCard = page.locator(".admin-card").filter({ hasText: bad });
    await expect(goodCard).toContainText("Омепразол");
    await expect(badCard).toBeVisible();

    await goodCard.getByRole("button", { name: "Одобрить" }).click();
    await expect(goodCard).toHaveCount(0); // ушёл из очереди «Ждут проверки»
    await badCard.getByRole("button", { name: "Отклонить" }).click();
    await expect(badCard).toHaveCount(0);

    // Посетитель видит только одобренный
    const visible = (await (await request.get(`/api/medicines/${id}/reviews`)).json()).map((r) => r.text);
    expect(visible).toContain(good);
    expect(visible).not.toContain(bad);

    // Отклонённый лежит на своей вкладке и его можно удалить
    await page.getByRole("button", { name: "Отклонённые" }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await badCard.getByRole("button", { name: "Удалить" }).click();
    await expect(badCard).toHaveCount(0);
  });

  test("чужой текст в админке показывается как текст, а не как код", async ({ page, request }) => {
    const id = await medicineId(request, "Омепразол");
    const evil = `<img src=x onerror="window.hacked=true">для админа ${Date.now()}`;
    await submitReview(request, id, { author: "Хакер", rating: 1, text: evil });

    await page.goto("/admin.html");
    await page.getByPlaceholder("Пароль").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Войти" }).click();
    await expect(page.locator(".admin-card").filter({ hasText: evil })).toBeVisible();
    await expect(page.locator(".admin-card img")).toHaveCount(0);
    expect(await page.evaluate(() => window.hacked)).toBeUndefined();
  });
});
