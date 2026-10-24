import { useCallback, useEffect, useState } from "react";
import { api, stars } from "../api.js";

export default function Reviews({ medicineId }) {
  const [reviews, setReviews] = useState(null);

  const load = useCallback(() => {
    return api(`/api/medicines/${medicineId}/reviews`).then(setReviews);
  }, [medicineId]);

  useEffect(() => { load(); }, [load]);

  return (
    <section className="box">
      <h2>Отзывы</h2>
      <div id="reviews">
        {reviews === null ? (
          <p className="muted">Загрузка…</p>
        ) : reviews.length === 0 ? (
          <p className="muted">Будьте первым, кто оставит отзыв.</p>
        ) : (
          // React сам экранирует текст — HTML из отзыва не выполнится (защита от XSS)
          reviews.map((r) => (
            <div className="review" data-testid="review" key={r.id}>
              <span className="who">{r.author}</span>{" "}
              <span className="stars">{stars(r.rating)}</span>
              <span className="muted"> · {new Date(r.created_at).toLocaleDateString("ru-RU")}</span>
              <p>{r.text}</p>
            </div>
          ))
        )}
      </div>
      <ReviewForm medicineId={medicineId} onSent={load} />
    </section>
  );
}

function ReviewForm({ medicineId, onSent }) {
  const [author, setAuthor] = useState("");
  const [text, setText] = useState("");
  const [rating, setRating] = useState(0);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!rating) { setError("Поставьте оценку от 1 до 5 звёзд"); return; }
    setSending(true);
    try {
      await api(`/api/medicines/${medicineId}/reviews`, {
        method: "POST",
        body: JSON.stringify({ author, text, rating }),
      });
      setAuthor("");
      setText("");
      setRating(0);
      await onSent();
    } catch {
      setError("Не получилось отправить: проверьте имя (от 2 букв) и текст (от 5 букв).");
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="review-form" onSubmit={submit}>
      <h3 style={{ margin: "8px 0 0" }}>Оставить отзыв</h3>
      <input
        placeholder="Ваше имя"
        maxLength={60}
        required
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
      />
      <div className="rate">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={n <= rating ? "on" : ""}
            aria-label={`${n} из 5`}
            onClick={() => setRating(n)}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        placeholder="Помогло ли лекарство? Были ли побочные эффекты?"
        maxLength={2000}
        required
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="error">{error}</div>
      <button disabled={sending}>Отправить отзыв</button>
    </form>
  );
}
