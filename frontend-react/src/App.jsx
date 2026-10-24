import { useEffect, useState } from "react";
import { api } from "./api.js";
import Catalog from "./pages/Catalog.jsx";
import MedicinePage from "./pages/MedicinePage.jsx";

// Маршрутизация по #адресу, как в vanilla-версии: #/ — каталог, #/medicine/5 — лекарство
function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => {
      setHash(window.location.hash);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  const match = hash.match(/^#\/medicine\/(\d+)/);
  return match ? { page: "medicine", id: match[1] } : { page: "catalog" };
}

function readCity() {
  try { return localStorage.getItem("city") || ""; } catch { return ""; }
}

export default function App() {
  const route = useHashRoute();
  const [cities, setCities] = useState([]);
  const [city, setCity] = useState(readCity);
  // Поиск и категория живут здесь, чтобы не сбрасываться при возврате к каталогу
  const [filters, setFilters] = useState({ q: "", category: "" });
  const [location, setLocation] = useState(null);

  useEffect(() => {
    api("/api/cities").then(setCities).catch(() => setCities([]));
  }, []);

  function changeCity(value) {
    setCity(value);
    try { localStorage.setItem("city", value); } catch { /* приватный режим */ }
  }

  return (
    <>
      <header className="top">
        <a href="#/" className="logo">💊 Dary<span>.kg</span></a>
        <select aria-label="Город" value={city} onChange={(e) => changeCity(e.target.value)}>
          <option value="">Все города</option>
          {cities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </header>

      <div className="notice">
        Данные об аптеках и ценах демонстрационные. Сайт не заменяет врача:
        перед приёмом лекарства посоветуйтесь со специалистом. Скорая помощь — <b>103</b>.
      </div>

      <main>
        {route.page === "medicine" ? (
          <MedicinePage
            key={route.id}
            id={route.id}
            city={city}
            location={location}
            onLocation={setLocation}
          />
        ) : (
          <Catalog filters={filters} onFilters={setFilters} />
        )}
      </main>

      <footer>Учебный проект · React + FastAPI / Express + SQLite/PostgreSQL</footer>
    </>
  );
}
