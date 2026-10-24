// Адрес API. Пусто = тот же сервер (/api/...). Для другого бэкенда, например:
// const API = "http://localhost:8001";
const API = "";

const app = document.getElementById("app");
const citySelect = document.getElementById("city");

const state = {
  q: "",
  category: "",
  city: localStorage.getItem("city") || "",
  location: null, // {lat, lng} после нажатия «Найти ближайшие»
};

// ---------- Помощники ----------

async function api(path, options) {
  const res = await fetch(API + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(typeof data.detail === "string" ? data.detail : "Ошибка сервера");
  }
  if (res.status === 204) return null; // успех без тела (например, жалоба)
  return res.json();
}

// Защита от XSS: текст из отзывов нельзя вставлять в HTML как есть
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function stars(n) {
  const r = Math.round(n || 0);
  return "★".repeat(r) + "☆".repeat(5 - r);
}

const CATEGORY_COLORS = {
  "Жаропонижающие и обезболивающие": ["#e85d5d", "#fde3e3"],
  "Желудок и кишечник": ["#2f9e6e", "#dcf3e8"],
  "Аллергия": ["#8a63d2", "#ece4fa"],
  "Антибиотики": ["#2f6fd6", "#e0eafb"],
  "Сердце и давление": ["#d6336c", "#fbe1ea"],
  "Витамины": ["#e8890c", "#fdefd9"],
  "Антисептики": ["#1c9bb0", "#dbf2f6"],
};

// Пока нет настоящих фото — рисуем упаковку лекарства в SVG
function medicineImage(m) {
  if (m.image_url) return `<img src="${esc(m.image_url)}" alt="${esc(m.name)}">`;
  const [main, soft] = CATEGORY_COLORS[m.category] || ["#0f8a6c", "#e2f4ee"];
  const title = m.name.replace(/\s*\(.*\)/, "");
  const size = title.length > 14 ? 17 : 22;
  return `
  <svg viewBox="0 0 400 300" role="img" aria-label="${esc(m.name)}">
    <rect width="400" height="300" fill="${soft}"/>
    <g transform="rotate(-8 200 150)">
      <rect x="80" y="70" width="240" height="150" rx="14" fill="#fff" stroke="${main}" stroke-width="3"/>
      <rect x="80" y="70" width="240" height="38" rx="14" fill="${main}"/>
      <rect x="80" y="94" width="240" height="14" fill="${main}"/>
      <text x="200" y="96" text-anchor="middle" fill="#fff" font-size="15" font-family="system-ui" font-weight="600">${esc(m.category.split(" ")[0])}</text>
      <text x="200" y="150" text-anchor="middle" fill="#1d2a2a" font-size="${size}" font-family="system-ui" font-weight="700">${esc(title)}</text>
      <text x="200" y="178" text-anchor="middle" fill="#5f6f6e" font-size="13" font-family="system-ui">${esc(m.form)}</text>
      <circle cx="292" cy="196" r="10" fill="${main}" opacity=".25"/>
      <circle cx="270" cy="200" r="7" fill="${main}" opacity=".4"/>
    </g>
  </svg>`;
}

function priceText(m) {
  return m.min_price != null
    ? `<span class="price"><small>от</small> ${m.min_price} сом</span>`
    : `<span class="muted">нет в наличии</span>`;
}

// ---------- Страница: каталог ----------

let categoriesCache = null;

async function renderList() {
  if (!categoriesCache) categoriesCache = await api("/api/categories");

  app.innerHTML = `
    <form class="search" id="search">
      <input id="q" type="search" placeholder="Название лекарства или симптом: «температура», «аллергия»…" value="${esc(state.q)}" autocomplete="off">
      <button>Найти</button>
    </form>
    <div class="chips" id="chips">
      ${["", ...categoriesCache].map((c) => `
        <button type="button" class="chip ${c === state.category ? "active" : ""}" data-cat="${esc(c)}">${c ? esc(c) : "Все"}</button>
      `).join("")}
    </div>
    <div class="grid" id="grid"><p class="muted">Загрузка…</p></div>
  `;

  const q = document.getElementById("q");
  let timer;
  q.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => { state.q = q.value; loadGrid(); }, 250);
  });
  document.getElementById("search").addEventListener("submit", (e) => {
    e.preventDefault(); state.q = q.value; loadGrid();
  });
  document.getElementById("chips").addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    state.category = btn.dataset.cat;
    document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c === btn));
    loadGrid();
  });

  loadGrid();
}

// Номер последнего запроса списка: опоздавший ответ на старый запрос не должен перезаписать новый
let gridRequest = 0;

async function loadGrid() {
  const grid = document.getElementById("grid");
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.category) params.set("category", state.category);
  const request = ++gridRequest;
  try {
    const meds = await api(`/api/medicines?${params}`);
    if (request !== gridRequest) return;
    if (!meds.length) {
      grid.innerHTML = `<p class="muted">Ничего не найдено. Попробуйте другое слово.</p>`;
      return;
    }
    grid.innerHTML = meds.map((m) => `
      <a class="card" href="#/medicine/${m.id}" data-testid="medicine-card">
        <div class="img">${medicineImage(m)}</div>
        <div class="body">
          <h3>${esc(m.name)}</h3>
          <div class="form">${esc(m.form)}</div>
          ${m.prescription ? `<span><span class="badge">по рецепту</span></span>` : ""}
          <div class="bottom">
            ${priceText(m)}
            <span class="muted">${m.reviews_count ? `<span class="stars">★</span> ${m.rating} (${m.reviews_count})` : ""}</span>
          </div>
        </div>
      </a>
    `).join("");
  } catch (err) {
    if (request !== gridRequest) return;
    grid.innerHTML = `<p class="error">Не удалось загрузить: ${esc(err.message)}</p>`;
  }
}

// ---------- Страница: лекарство ----------

async function renderMedicine(id) {
  app.innerHTML = `<p class="muted">Загрузка…</p>`;
  const myRoute = routeNumber; // если за время запроса пользователь ушёл дальше, ответ выбрасываем
  let m;
  try {
    m = await api(`/api/medicines/${id}?${offerParams()}`);
    if (myRoute !== routeNumber) return;
  } catch (err) {
    if (myRoute !== routeNumber) return;
    app.innerHTML = `<p class="error">${esc(err.message)}</p><a href="#/">← К списку</a>`;
    return;
  }

  app.innerHTML = `
    <p><a href="#/">← Все лекарства</a></p>
    <div class="detail">
      <div class="img">${medicineImage(m)}</div>
      <div>
        <h1>${esc(m.name)}</h1>
        <div class="muted">${esc(m.generic_name)} · ${esc(m.form)}</div>
        <p>
          ${m.prescription ? `<span class="badge">отпускается по рецепту врача</span>` : ""}
          ${m.reviews_count ? `<span class="stars">${stars(m.rating)}</span> ${m.rating} · ${m.reviews_count} отзыв(ов)` : `<span class="muted">Отзывов пока нет</span>`}
        </p>
        <div class="box" style="margin-top:0">
          <h2>Для чего нужно</h2>
          <p style="margin:0">${esc(m.purpose)}</p>
        </div>
        <div class="box">
          <h2>Противопоказания</h2>
          <p style="margin:0">${esc(m.contraindications)}</p>
        </div>
      </div>
    </div>

    <section class="box">
      <div class="box-head">
        <h2 style="margin:0">Где купить ${state.city ? `в г. ${esc(state.city)}` : ""}</h2>
        <button class="ghost" id="near">📍 ${state.location ? "Обновить местоположение" : "Найти ближайшие"}</button>
      </div>
      <div id="offers">${offersTable(m.offers)}</div>
    </section>

    <section class="box">
      <h2>Отзывы</h2>
      <div id="reviews"><p class="muted">Загрузка…</p></div>
      <form class="review-form" id="review-form">
        <h3 style="margin:8px 0 0">Оставить отзыв</h3>
        <input name="author" placeholder="Ваше имя" maxlength="60" required>
        <div class="rate" id="rate">
          ${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-n="${n}" aria-label="${n} из 5">★</button>`).join("")}
        </div>
        <textarea name="text" placeholder="Помогло ли лекарство? Были ли побочные эффекты?" maxlength="2000" required></textarea>
        <div class="hp" aria-hidden="true"><label>Сайт <input name="website" tabindex="-1" autocomplete="off"></label></div>
        <p class="muted" style="margin:0;font-size:13px">Отзыв появится на сайте после проверки. Не пишите ссылки и дозировки: это не совет врача.</p>
        <div class="success" id="form-ok" role="status"></div>
        <div class="error" id="form-error"></div>
        <button id="send-review">Отправить отзыв</button>
      </form>
    </section>
  `;

  document.getElementById("near").addEventListener("click", () => locate(m.id));
  loadReviews(m.id);
  setupReviewForm(m.id);
}

function offerParams() {
  const p = new URLSearchParams();
  if (state.city) p.set("city", state.city);
  if (state.location) { p.set("lat", state.location.lat); p.set("lng", state.location.lng); }
  return p;
}

function offersTable(offers) {
  if (!offers.length) return `<p class="muted">В выбранном городе этого лекарства нет. Выберите «Все города».</p>`;
  const min = Math.min(...offers.filter((o) => o.in_stock).map((o) => o.price_som));
  return `
    <table class="offers">
      <thead><tr>
        <th>Аптека</th><th class="hide-sm">Режим работы</th>
        ${offers[0].distance_km != null ? "<th>Расстояние</th>" : ""}
        <th>Цена</th>
      </tr></thead>
      <tbody>
        ${offers.map((o) => `
          <tr class="${o.in_stock && o.price_som === min ? "best" : ""} ${o.in_stock ? "" : "out"}">
            <td>
              <b>${esc(o.pharmacy.name)}</b><br>
              <span class="muted">${esc(o.pharmacy.city)}, ${esc(o.pharmacy.address)}</span><br>
              <a href="tel:${esc(o.pharmacy.phone.replace(/\s/g, ""))}">${esc(o.pharmacy.phone)}</a> ·
              <a href="https://2gis.kg/search/${encodeURIComponent(o.pharmacy.city + " " + o.pharmacy.address)}" target="_blank" rel="noopener">на карте</a>
            </td>
            <td class="hide-sm">${esc(o.pharmacy.hours)}</td>
            ${o.distance_km != null ? `<td>${o.distance_km} км</td>` : ""}
            <td>${o.in_stock ? `<span class="price">${o.price_som} сом</span>${o.price_som === min ? "<br><small>дешевле всего</small>" : ""}` : "нет в наличии"}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;
}

function locate(id) {
  const btn = document.getElementById("near");
  if (!navigator.geolocation) { alert("Браузер не умеет определять местоположение"); return; }
  btn.disabled = true;
  btn.textContent = "Определяем…";
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      state.location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const m = await api(`/api/medicines/${id}?${offerParams()}`);
      document.getElementById("offers").innerHTML = offersTable(m.offers);
      btn.disabled = false;
      btn.textContent = "📍 Обновить местоположение";
    },
    () => {
      btn.disabled = false;
      btn.textContent = "📍 Найти ближайшие";
      alert("Не удалось определить местоположение. Разрешите доступ к геолокации в браузере.");
    },
  );
}

async function loadReviews(id) {
  const box = document.getElementById("reviews");
  const reviews = await api(`/api/medicines/${id}/reviews`);
  box.innerHTML = reviews.length
    ? reviews.map((r) => `
        <div class="review" data-testid="review">
          <span class="who">${esc(r.author)}</span>
          <span class="stars">${stars(r.rating)}</span>
          <span class="muted"> · ${new Date(r.created_at).toLocaleDateString("ru-RU")}</span>
          <p>${esc(r.text)}</p>
          <button type="button" class="link" data-report="${r.id}">Пожаловаться</button>
        </div>`).join("")
    : `<p class="muted">Будьте первым, кто оставит отзыв.</p>`;
}

function setupReviewForm(id) {
  const form = document.getElementById("review-form");
  const rate = document.getElementById("rate");
  const error = document.getElementById("form-error");
  const ok = document.getElementById("form-ok");
  let rating = 0;

  // Жалоба на отзыв (кнопки создаются заново при каждой загрузке отзывов, поэтому делегирование)
  document.getElementById("reviews").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-report]");
    if (!btn) return;
    btn.disabled = true;
    try {
      await api(`/api/reviews/${btn.dataset.report}/report`, { method: "POST" });
      btn.textContent = "Жалоба отправлена";
    } catch {
      btn.disabled = false;
    }
  });

  rate.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    rating = Number(b.dataset.n);
    rate.querySelectorAll("button").forEach((x) => x.classList.toggle("on", Number(x.dataset.n) <= rating));
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    error.textContent = "";
    ok.textContent = "";
    if (!rating) { error.textContent = "Поставьте оценку от 1 до 5 звёзд"; return; }
    const data = Object.fromEntries(new FormData(form));
    const btn = document.getElementById("send-review");
    btn.disabled = true;
    try {
      await api(`/api/medicines/${id}/reviews`, {
        method: "POST",
        body: JSON.stringify({ author: data.author, text: data.text, rating, website: data.website }),
      });
      form.reset();
      rating = 0;
      rate.querySelectorAll("button").forEach((x) => x.classList.remove("on"));
      // Новый отзыв виден только после проверки, поэтому список не обновляем
      ok.textContent = "Спасибо! Отзыв появится на сайте после проверки.";
    } catch (err) {
      // Если сервер объяснил причину (ссылки, лимит, повтор) — показываем её
      error.textContent = err.message === "Ошибка сервера"
        ? "Не получилось отправить: проверьте имя (от 2 букв) и текст (от 5 букв)."
        : err.message;
    } finally {
      btn.disabled = false;
    }
  });
}

// ---------- Маршрутизация по #адресу ----------

let routeNumber = 0; // растёт при каждой смене страницы или города

function route() {
  routeNumber++;
  const match = location.hash.match(/^#\/medicine\/(\d+)/);
  if (match) renderMedicine(match[1]);
  else renderList();
  window.scrollTo(0, 0);
}

async function init() {
  const cities = await api("/api/cities").catch(() => []);
  citySelect.innerHTML += cities.map((c) => `<option ${c === state.city ? "selected" : ""}>${esc(c)}</option>`).join("");
  citySelect.addEventListener("change", () => {
    state.city = citySelect.value;
    localStorage.setItem("city", state.city);
    route();
  });
  window.addEventListener("hashchange", route);
  route();
}

init();
