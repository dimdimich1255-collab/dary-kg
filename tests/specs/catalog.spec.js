// @ts-check
const { test, expect } = require("@playwright/test");

test.describe("Каталог", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("показывает все лекарства из базы", async ({ page, request }) => {
    const all = await (await request.get("/api/medicines")).json();
    await expect(page.getByTestId("medicine-card")).toHaveCount(all.length);
    await expect(page.getByRole("heading", { name: "Парацетамол" })).toBeVisible();
  });

  test("предупреждение о враче видно сразу", async ({ page }) => {
    await expect(page.getByText("Сайт не заменяет врача")).toBeVisible();
  });

  test("поиск по названию без учёта регистра", async ({ page }) => {
    // Парацетамол есть и в составе Цитрамона, поэтому ищем то, что встречается один раз
    await page.getByRole("searchbox").fill("ИБУПРОФ");
    await expect(page.getByTestId("medicine-card")).toHaveCount(1);
    await expect(page.getByTestId("medicine-card")).toContainText("Ибупрофен");
  });

  test("поиск по симптому", async ({ page }) => {
    await page.getByRole("searchbox").fill("температур");
    const cards = page.getByTestId("medicine-card");
    await expect(cards.filter({ hasText: "Парацетамол" })).toBeVisible();
    await expect(cards.filter({ hasText: "Ибупрофен" })).toBeVisible();
    await expect(cards.filter({ hasText: "Лоратадин" })).toHaveCount(0);
  });

  test("если ничего не найдено — понятное сообщение", async ({ page }) => {
    await page.getByRole("searchbox").fill("абракадабра");
    await expect(page.getByText("Ничего не найдено")).toBeVisible();
  });

  test("фильтр по категории", async ({ page }) => {
    await page.getByRole("button", { name: "Аллергия" }).click();
    const cards = page.getByTestId("medicine-card");
    await expect(cards).toHaveCount(2);
    await expect(cards.filter({ hasText: "Лоратадин" })).toBeVisible();
    await expect(cards.filter({ hasText: "Цетиризин" })).toBeVisible();

    await page.getByRole("button", { name: "Все", exact: true }).click();
    await expect(cards).not.toHaveCount(2);
  });

  test("рецептурные лекарства помечены", async ({ page }) => {
    const card = page.getByTestId("medicine-card").filter({ hasText: "Амоксициллин" });
    await expect(card.getByText("по рецепту")).toBeVisible();
  });

  test("клик по карточке открывает страницу лекарства", async ({ page }) => {
    await page.getByTestId("medicine-card").filter({ hasText: "Смекта" }).click();
    await expect(page).toHaveURL(/#\/medicine\/\d+$/);
    await expect(page.getByRole("heading", { level: 1, name: "Смекта" })).toBeVisible();

    await page.getByRole("link", { name: "← Все лекарства" }).click();
    await expect(page.getByTestId("medicine-card").first()).toBeVisible();
  });
});
