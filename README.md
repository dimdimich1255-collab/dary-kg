# Dary.kg 💊

Каталог лекарств Кыргызстана: что это за лекарство, для чего оно нужно, в каких аптеках
есть и сколько стоит, где ближайшая аптека. Пользователи оставляют отзывы.

> Аптеки и цены в базе пока **демонстрационные** (выдуманные).

## Стек

| Часть | Технология |
|---|---|
| Бэкенд | Python + FastAPI + SQLAlchemy (`backend/`) |
| База | SQLite (по умолчанию) или PostgreSQL (в Docker) |
| Фронтенд | vanilla JS, HTML, CSS (`frontend/`) |
| Тесты | Playwright (`tests/`) |
| Запуск | Docker Compose (postgres + backend + nginx) |

> Версии с бэкендом на Node.js и фронтендами на React, Vue и Angular лежат в ветке
> `extra-stacks`: `git switch extra-stacks`. Они проходят те же тесты.

## Запуск без Docker (SQLite)

```bash
cd backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\uvicorn app.main:app --reload
```

Открыть http://localhost:8000. База создастся сама в файле `dary.db` и заполнится демо-данными.
Документация API: http://localhost:8000/docs

## Запуск в Docker (PostgreSQL)

Сначала открой Docker Desktop, потом:

```bash
docker compose up --build
```

- Сайт: http://localhost:8080
- API: http://localhost:8000/docs

Смена базы делается одной переменной `DATABASE_URL`, код не меняется.

## API

| Метод | Путь | Что делает |
|---|---|---|
| GET | `/api/medicines?q=&category=` | список и поиск (по названию и симптому) |
| GET | `/api/medicines/{id}?city=&lat=&lng=` | лекарство и аптеки с ценами (с координатами: сначала ближайшие) |
| GET | `/api/medicines/{id}/reviews` | отзывы |
| POST | `/api/medicines/{id}/reviews` | новый отзыв `{author, rating 1–5, text}` |
| GET | `/api/pharmacies?city=` | аптеки |
| GET | `/api/categories` | категории |
| GET | `/api/cities` | города |

## Таблицы

- `medicines`: лекарство (название, МНН, категория, форма, для чего, противопоказания, рецепт, фото)
- `pharmacies`: аптека (город, адрес, телефон, часы работы, координаты)
- `offers`: цена лекарства в конкретной аптеке и наличие
- `reviews`: отзывы

## Тесты (Playwright)

```bash
cd tests
npm install
npx playwright install chromium
npx playwright test          # все тесты (сам запустит бэкенд с чистой базой)
npx playwright test --ui     # окно, где видно, как тесты кликают по сайту
npx playwright show-report   # HTML-отчёт
```

- `specs/catalog.spec.js`: каталог, поиск, категории
- `specs/medicine.spec.js`: страница лекарства, цены, город, ближайшие аптеки, отзывы, защита от XSS
- `specs/api.spec.js`: проверка API

Тесты гоняются на ПК (`desktop`) и на телефоне (`mobile`, Pixel 7).
Чтобы проверить Docker-версию: `BASE_URL=http://localhost:8080 npx playwright test`.

## Что дальше

1. Проверить работу с PostgreSQL в Docker
2. Модерация отзывов и защита от спама
3. Админка для лекарств, аптек и цен
4. Настоящие данные: аптеки и цены, описания проверены фармацевтом
5. Публикация на Render
