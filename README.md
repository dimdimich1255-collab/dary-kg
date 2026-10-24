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
| GET | `/api/medicines/{id}/reviews` | одобренные отзывы |
| POST | `/api/medicines/{id}/reviews` | новый отзыв `{author, rating 1–5, text}`: ждёт проверки модератора |
| POST | `/api/reviews/{id}/report` | пожаловаться на отзыв |
| GET | `/api/pharmacies?city=` | аптеки |
| GET | `/api/categories` | категории |
| GET | `/api/cities` | города |

Для модератора (нужен пароль, см. ниже): `GET /api/admin/reviews?status=`,
`POST /api/admin/reviews/{id}/approve`, `POST .../reject`, `DELETE /api/admin/reviews/{id}`.

## Таблицы

- `medicines`: лекарство (название, МНН, категория, форма, для чего, противопоказания, рецепт, фото)
- `pharmacies`: аптека (город, адрес, телефон, часы работы, координаты)
- `offers`: цена лекарства в конкретной аптеке и наличие
- `reviews`: отзывы (статус `pending` / `approved` / `rejected`, число жалоб, хеш IP автора)
- `review_reports`: жалобы на отзывы (по одной с каждого устройства)

При запуске сервер сам добавляет новые колонки в старую таблицу `reviews`, старые отзывы остаются
и считаются одобренными.

## Модерация отзывов и защита от спама

- Новый отзыв **не виден**, пока модератор его не одобрит. Рейтинг считается только по одобренным.
- Страница модератора: `/admin.html` (http://localhost:8080/admin.html). Вход по паролю из `ADMIN_PASSWORD`.
  Если пароль не задан, админка отключена. После 5 неверных паролей вход блокируется на 10 минут.
- Под каждым отзывом кнопка «Пожаловаться». Три жалобы с разных устройств возвращают отзыв на проверку.
- Защита от спама: не больше 3 отзывов за 10 минут и 10 за сутки с одного устройства (по IP),
  ссылки в тексте запрещены, повторный текст не принимается, скрытое поле-ловушка для ботов.
- IP-адреса хранятся только в виде хеша, по нему нельзя узнать человека.

Настройки сервера (переменные окружения):

| Переменная | Что делает |
|---|---|
| `ADMIN_PASSWORD` | пароль модератора. **В интернете задай свой длинный пароль** |
| `IP_SALT` | любая длинная случайная строка для хеширования IP |
| `TRUST_PROXY=1` | сайт стоит за nginx или Render: настоящий IP берётся из `X-Forwarded-For` |
| `REVIEW_LIMIT_10MIN`, `REVIEW_LIMIT_DAY` | лимиты отзывов (по умолчанию 3 и 10) |
| `REPORTS_TO_HIDE` | сколько жалоб скрывают отзыв (по умолчанию 3) |

В Docker локальный пароль админки `local-admin`. Свой: `$env:ADMIN_PASSWORD="..."; docker compose up -d`.

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
- `specs/medicine.spec.js`: страница лекарства, цены, город, ближайшие аптеки, отзывы, жалобы, защита от XSS
- `specs/api.spec.js`: API, модерация, лимиты, ссылки, ловушка для ботов, жалобы, доступ к админке
- `specs/admin.spec.js`: страница модератора

Тесты гоняются на ПК (`desktop`) и на телефоне (`mobile`, Pixel 7).

Проверка Docker-версии (Postgres). Лимиты отзывов на время тестов поднимаем, потому что nginx
показывает серверу одного посетителя, а API-тесты ходят напрямую на порт 8000, где можно подставлять IP:

```powershell
$env:REVIEW_LIMIT_10MIN="1000"; $env:REVIEW_LIMIT_DAY="1000"; docker compose up -d
cd tests
$env:ADMIN_PASSWORD="local-admin"
$env:BASE_URL="http://localhost:8080"; npx playwright test specs/catalog.spec.js specs/medicine.spec.js specs/admin.spec.js
$env:BASE_URL="http://localhost:8000"; npx playwright test specs/api.spec.js
```

После этого верни обычные лимиты: открой новый терминал и выполни `docker compose up -d`.

## Что дальше

1. Админка для лекарств, аптек и цен
2. Настоящие данные: аптеки и цены, описания проверены фармацевтом
3. Публикация на Render
