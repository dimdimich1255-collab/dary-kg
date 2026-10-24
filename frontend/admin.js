// Страница модерации. Пароль хранится только в sessionStorage (до закрытия вкладки)
// и отправляется в заголовке Authorization при каждом запросе.

const TABS = [
  ["pending", "Ждут проверки"],
  ["reported", "С жалобами"],
  ["approved", "Одобренные"],
  ["rejected", "Отклонённые"],
];

const login = document.getElementById("login");
const panel = document.getElementById("panel");
const list = document.getElementById("list");
const tabs = document.getElementById("tabs");
const logoutBtn = document.getElementById("logout");
const loginError = document.getElementById("login-error");

let password = sessionStorage.getItem("admin-password") || "";
let current = "pending";

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// Пароль уходит в base64 (UTF-8): русские буквы нельзя класть в HTTP-заголовок как есть
const encodePassword = (p) => btoa(String.fromCharCode(...new TextEncoder().encode(p)));

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { Authorization: `Bearer ${encodePassword(password)}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(typeof data.detail === "string" ? data.detail : "Ошибка сервера");
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

function showLogin(message = "") {
  panel.hidden = true;
  logoutBtn.hidden = true;
  login.hidden = false;
  loginError.textContent = message;
}

async function load() {
  tabs.innerHTML = TABS.map(([key, title]) =>
    `<button class="chip ${key === current ? "active" : ""}" data-tab="${key}">${title}</button>`).join("");
  try {
    const reviews = await api(`/api/admin/reviews?status=${current}`);
    login.hidden = true;
    panel.hidden = false;
    logoutBtn.hidden = false;
    sessionStorage.setItem("admin-password", password);
    list.innerHTML = reviews.length ? reviews.map(card).join("") : `<p class="muted">Здесь пока пусто.</p>`;
  } catch (err) {
    sessionStorage.removeItem("admin-password");
    password = "";
    showLogin(err.status === 404 ? "Админка отключена: на сервере не задан ADMIN_PASSWORD." : err.message);
  }
}

function card(r) {
  const date = new Date(r.created_at).toLocaleString("ru-RU");
  return `
    <div class="admin-card" data-review="${r.id}">
      <div><b>${esc(r.author)}</b> · <span class="stars">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</span>
        о лекарстве «${esc(r.medicine_name)}»</div>
      <div class="meta">${date} · статус: ${esc(r.status)}${r.reports ? ` · жалоб: ${r.reports}` : ""}</div>
      <p>${esc(r.text)}</p>
      <div class="admin-actions">
        ${r.status !== "approved" ? `<button data-act="approve">Одобрить</button>` : ""}
        ${r.status !== "rejected" ? `<button class="reject" data-act="reject">Отклонить</button>` : ""}
        <button class="danger" data-act="delete">Удалить</button>
      </div>
    </div>`;
}

login.addEventListener("submit", (e) => {
  e.preventDefault();
  password = document.getElementById("password").value;
  load();
});

logoutBtn.addEventListener("click", () => {
  sessionStorage.removeItem("admin-password");
  password = "";
  showLogin();
});

tabs.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-tab]");
  if (!btn) return;
  current = btn.dataset.tab;
  load();
});

list.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const id = btn.closest("[data-review]").dataset.review;
  const act = btn.dataset.act;
  if (act === "delete" && !confirm("Удалить отзыв навсегда?")) return;
  btn.disabled = true;
  try {
    await api(`/api/admin/reviews/${id}${act === "delete" ? "" : `/${act}`}`, {
      method: act === "delete" ? "DELETE" : "POST",
    });
    load();
  } catch (err) {
    btn.disabled = false;
    alert(err.message);
  }
});

if (password) load();
else showLogin();
