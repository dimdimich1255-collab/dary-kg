# Dary.kg 💊

Каталог лекарств Кыргызстана: что это за лекарство, для чего оно нужно, в каких аптеках
есть и сколько стоит, где ближайшая аптека. Пользователи оставляют отзывы.

> Аптеки и цены в базе пока **демонстрационные** (выдуманные).

## Стек

| Часть | Технология |
|---|---|
| Бэкенд №1 | Python + FastAPI + SQLAlchemy (`backend/`) |
| Бэкенд №2 | Node.js + Express + node:sqlite / pg (`backend-node/`) |
| База | SQLite (по умолчанию) или PostgreSQL (в Docker) |
| Фронтенд №1 | vanilla JS, HTML, CSS (`frontend/`) |
| Фронтенд №2 | React 18 + Vite (`frontend-react/`) |
| Фронтенд №3 | Vue 3 + Vite (`frontend-vue/`) |
| Фронтенд №4 | Angular 20 (`frontend-angular/`) |
| Тесты | Playwright |
| Запуск | Docker Compose (postgres + 2 бэкенда + nginx) |

## Запуск без Docker (SQLite)

Python:

```bash
cd backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\uvicorn app.main:app --reload
```

Node.js (нужен Node 22.13 или новее, SQLite в нём встроен):

```bash
cd backend-node
npm install
npm run dev
```

Открыть http://localhost:8000. База создастся сама в файле `dary.db` и заполнится демо-данными.
Документация API (только у Python): http://localhost:8000/docs

React (бэкенд должен быть запущен на 8000):

```bash
cd frontend-react
npm install
npm run dev
```

Открыть http://localhost:5173. Vite сам пересылает `/api` в бэкенд. Если бэкенд на другом порту:
`API_TARGET=http://localhost:8002 npm run dev`.

Vue запускается так же из папки `frontend-vue` (`npm install`, `npm run dev`) и открывается на http://localhost:5175.

Angular: в папке `frontend-angular` выполнить `npm install`, потом `npm start`. Сайт откроется на http://localhost:5177.
Кеш сборки Angular отключён в `angular.json` (`cli.cache.enabled: false`): на этом компьютере его
библиотека lmdb падала с ошибкой 0xC0000005.

## Запуск в Docker (PostgreSQL)

Сначала открой Docker Desktop, потом:

```bash
docker compose up --build
```

- Сайт на vanilla JS: http://localhost:8080 (по умолчанию работает через Python)
- Сайт на React: http://localhost:8081
- Сайт на Vue: http://localhost:8082
- Сайт на Angular: http://localhost:8083
- Python API: http://localhost:8000/docs
- Node API: http://localhost:8002/api/medicines

Чтобы сайт работал через Node.js: `API_HOST=backend-node docker compose up --build`
(в PowerShell: `$env:API_HOST="backend-node"; docker compose up --build`).

Оба бэкенда подключены к одной базе Postgres. Отзыв, оставленный через Python, виден через Node.
Смена базы делается одной переменной `DATABASE_URL`, код не меняется.

## Python и Node: в чём разница

| | Python (`backend/`) | Node.js (`backend-node/`) |
|---|---|---|
| Фреймворк | FastAPI | Express |
| Работа с базой | SQLAlchemy (ORM: таблицы как классы) | чистый SQL через `node:sqlite` и `pg` |
| Проверка данных | Pydantic, автоматически по схеме | функция `validateReview` вручную |
| Документация API | `/docs` генерируется сама | нет |
| Асинхронность | обычные функции | `async/await` |

## API

Это контракт. Бэкенды на Node, Go, Java, Rust и PHP должны отдавать то же самое.

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
npx playwright test          # все тесты на Python (сам запустит бэкенд с чистой базой)
BACKEND=node npx playwright test   # те же тесты на Node.js (PowerShell: $env:BACKEND="node"; npx playwright test)
FRONTEND=react npx playwright test # те же тесты на React-фронтенде
FRONTEND=vue npx playwright test   # те же тесты на Vue-фронтенде
FRONTEND=angular npx playwright test   # те же тесты на Angular-фронтенде
BACKEND=node FRONTEND=vue npx playwright test   # любая связка
npx playwright test --ui     # окно, где видно, как тесты кликают по сайту
npx playwright show-report   # HTML-отчёт
```

- `specs/catalog.spec.js`: каталог, поиск, категории
- `specs/medicine.spec.js`: страница лекарства, цены, город, ближайшие аптеки, отзывы, защита от XSS
- `specs/api.spec.js`: контракт API. Любой новый бэкенд должен проходить эти тесты

Тесты гоняются на ПК (`desktop`) и на телефоне (`mobile`, Pixel 7).
Чтобы проверить Docker-версию: `BASE_URL=http://localhost:8080 npx playwright test`.

## Что дальше

1. Бэкенды на Go, Java, Rust, PHP с тем же API (проверка — те же тесты)
2. Базы MySQL, Firebird, BerkeleyDB
3. Реальные фото и цены, админка для аптек
4. Кыргызский язык интерфейса
