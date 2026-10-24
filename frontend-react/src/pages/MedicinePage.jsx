import { useEffect, useState } from "react";
import { api, stars } from "../api.js";
import MedicineImage from "../components/MedicineImage.jsx";
import OffersTable from "../components/OffersTable.jsx";
import Reviews from "../components/Reviews.jsx";

export default function MedicinePage({ id, city, location, onLocation }) {
  // Запоминаем, для какого города загружены данные: пока новый ответ не пришёл,
  // заголовок и таблица должны показывать один и тот же (старый) город
  const [loaded, setLoaded] = useState({ medicine: null, city: "" });
  const [error, setError] = useState("");
  const [locating, setLocating] = useState(false);

  // Перезагружаем, когда меняется город или местоположение
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (city) params.set("city", city);
    if (location) { params.set("lat", location.lat); params.set("lng", location.lng); }
    api(`/api/medicines/${id}?${params}`)
      .then((data) => { if (!cancelled) setLoaded({ medicine: data, city }); })
      .catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [id, city, location]);

  function locate() {
    if (!navigator.geolocation) { alert("Браузер не умеет определять местоположение"); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setLocating(false);
        alert("Не удалось определить местоположение. Разрешите доступ к геолокации в браузере.");
      },
    );
  }

  if (error) {
    return <><p className="error">{error}</p><a href="#/">← К списку</a></>;
  }
  if (!loaded.medicine) return <p className="muted">Загрузка…</p>;

  const m = loaded.medicine;
  return (
    <>
      <p><a href="#/">← Все лекарства</a></p>
      <div className="detail">
        <div className="img"><MedicineImage medicine={m} /></div>
        <div>
          <h1>{m.name}</h1>
          <div className="muted">{m.generic_name} · {m.form}</div>
          <p>
            {m.prescription && <span className="badge">отпускается по рецепту врача</span>}{" "}
            {m.reviews_count > 0
              ? <><span className="stars">{stars(m.rating)}</span> {m.rating} · {m.reviews_count} отзыв(ов)</>
              : <span className="muted">Отзывов пока нет</span>}
          </p>
          <div className="box" style={{ marginTop: 0 }}>
            <h2>Для чего нужно</h2>
            <p style={{ margin: 0 }}>{m.purpose}</p>
          </div>
          <div className="box">
            <h2>Противопоказания</h2>
            <p style={{ margin: 0 }}>{m.contraindications}</p>
          </div>
        </div>
      </div>

      <section className="box">
        <div className="box-head">
          <h2 style={{ margin: 0 }}>Где купить {loaded.city && `в г. ${loaded.city}`}</h2>
          <button className="ghost" onClick={locate} disabled={locating}>
            {locating ? "Определяем…" : `📍 ${location ? "Обновить местоположение" : "Найти ближайшие"}`}
          </button>
        </div>
        <OffersTable offers={m.offers} />
      </section>

      <Reviews medicineId={m.id} />
    </>
  );
}
