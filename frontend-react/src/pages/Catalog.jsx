import { useEffect, useState } from "react";
import { api } from "../api.js";
import MedicineImage from "../components/MedicineImage.jsx";

export default function Catalog({ filters, onFilters }) {
  const [categories, setCategories] = useState([]);
  const [input, setInput] = useState(filters.q); // то, что сейчас в поле поиска
  const [medicines, setMedicines] = useState(null); // null = ещё грузим
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/categories").then(setCategories).catch(() => {});
  }, []);

  // Ждём 250 мс после последней буквы, чтобы не слать запрос на каждое нажатие
  useEffect(() => {
    const timer = setTimeout(() => onFilters((f) => (f.q === input ? f : { ...f, q: input })), 250);
    return () => clearTimeout(timer);
  }, [input, onFilters]);

  useEffect(() => {
    let cancelled = false; // старый ответ не должен перезаписать новый
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.category) params.set("category", filters.category);
    api(`/api/medicines?${params}`)
      .then((data) => { if (!cancelled) { setMedicines(data); setError(""); } })
      .catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [filters.q, filters.category]);

  function submit(e) {
    e.preventDefault();
    onFilters((f) => ({ ...f, q: input }));
  }

  return (
    <>
      <form className="search" onSubmit={submit}>
        <input
          type="search"
          placeholder="Название лекарства или симптом: «температура», «аллергия»…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoComplete="off"
        />
        <button>Найти</button>
      </form>

      <div className="chips">
        {["", ...categories].map((c) => (
          <button
            key={c || "all"}
            type="button"
            className={`chip ${c === filters.category ? "active" : ""}`}
            onClick={() => onFilters((f) => ({ ...f, category: c }))}
          >
            {c || "Все"}
          </button>
        ))}
      </div>

      <div className="grid">
        {error ? (
          <p className="error">Не удалось загрузить: {error}</p>
        ) : medicines === null ? (
          <p className="muted">Загрузка…</p>
        ) : medicines.length === 0 ? (
          <p className="muted">Ничего не найдено. Попробуйте другое слово.</p>
        ) : (
          medicines.map((m) => <MedicineCard key={m.id} medicine={m} />)
        )}
      </div>
    </>
  );
}

function MedicineCard({ medicine: m }) {
  return (
    <a className="card" href={`#/medicine/${m.id}`} data-testid="medicine-card">
      <div className="img"><MedicineImage medicine={m} /></div>
      <div className="body">
        <h3>{m.name}</h3>
        <div className="form">{m.form}</div>
        {m.prescription && <span><span className="badge">по рецепту</span></span>}
        <div className="bottom">
          {m.min_price != null
            ? <span className="price"><small>от</small> {m.min_price} сом</span>
            : <span className="muted">нет в наличии</span>}
          <span className="muted">
            {m.reviews_count > 0 && <><span className="stars">★</span> {m.rating} ({m.reviews_count})</>}
          </span>
        </div>
      </div>
    </a>
  );
}
