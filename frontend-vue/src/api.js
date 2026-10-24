// Адрес API. Пусто = тот же сервер (/api/...): Vite или nginx перешлют запрос в бэкенд.
const API = import.meta.env.VITE_API_URL || "";

export async function api(path, options) {
  const res = await fetch(API + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(typeof data.detail === "string" ? data.detail : "Ошибка сервера");
  }
  return res.json();
}

export function stars(n) {
  const r = Math.round(n || 0);
  return "★".repeat(r) + "☆".repeat(5 - r);
}
