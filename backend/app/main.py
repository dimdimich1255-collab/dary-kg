import math
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from pathlib import Path
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from .db import Base, engine, get_db, SessionLocal
from .migrate import add_missing_review_columns
from .moderation import LIMIT_10MIN, LIMIT_DAY, REPORTS_TO_HIDE, has_link, ip_hash, require_admin
from .models import APPROVED, PENDING, REJECTED, Medicine, Offer, Pharmacy, Review, ReviewReport, now_utc
from .seed import seed_if_empty


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    add_missing_review_columns(engine)
    with SessionLocal() as db:
        seed_if_empty(db)
    yield


app = FastAPI(title="Dary.kg API", lifespan=lifespan)

# Разрешаем запросы с любых фронтендов (vanilla, React, Vue, Angular на других портах)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ---------- Схемы ответов ----------

class MedicineShort(BaseModel):
    id: int
    name: str
    generic_name: str
    category: str
    form: str
    prescription: bool
    image_url: str | None
    min_price: int | None
    rating: float | None
    reviews_count: int


class PharmacyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    city: str
    address: str
    phone: str
    hours: str
    lat: float
    lng: float


class OfferOut(BaseModel):
    price_som: int
    in_stock: bool
    updated_at: datetime
    pharmacy: PharmacyOut
    distance_km: float | None


class MedicineFull(MedicineShort):
    purpose: str
    contraindications: str
    offers: list[OfferOut]


class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    author: str
    rating: int
    text: str
    created_at: datetime


class SubmittedReview(ReviewOut):
    status: str  # после отправки всегда «pending»: отзыв ждёт проверки


class AdminReview(BaseModel):
    id: int
    medicine_id: int
    medicine_name: str
    author: str
    rating: int
    text: str
    created_at: datetime
    status: str
    reports: int


class ReviewIn(BaseModel):
    author: str = Field(min_length=2, max_length=60)
    rating: int = Field(ge=1, le=5)
    text: str = Field(min_length=5, max_length=2000)
    # Скрытое поле-ловушка: человек его не видит и не заполняет, а бот заполняет всё подряд
    website: str = Field(default="", max_length=200)

    @field_validator("author", "text")
    @classmethod
    def strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("пустое поле")
        return v


# ---------- Вспомогательное ----------

def distance_km(lat1, lng1, lat2, lng2) -> float:
    """Расстояние между двумя точками на Земле (формула гаверсинуса)."""
    r = 6371
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return round(2 * r * math.asin(math.sqrt(a)), 2)


def stats_for(db: Session, medicine_ids: list[int]):
    """Минимальная цена, средний рейтинг и число отзывов для списка лекарств."""
    prices = dict(db.execute(
        select(Offer.medicine_id, func.min(Offer.price_som))
        .where(Offer.medicine_id.in_(medicine_ids), Offer.in_stock)
        .group_by(Offer.medicine_id)
    ).all())
    ratings = {
        mid: (avg, cnt)
        for mid, avg, cnt in db.execute(
            select(Review.medicine_id, func.avg(Review.rating), func.count(Review.id))
            .where(Review.medicine_id.in_(medicine_ids), Review.status == APPROVED)
            .group_by(Review.medicine_id)
        ).all()
    }
    return prices, ratings


def short(m: Medicine, prices, ratings) -> dict:
    avg, cnt = ratings.get(m.id, (None, 0))
    return {
        "id": m.id, "name": m.name, "generic_name": m.generic_name, "category": m.category,
        "form": m.form, "prescription": m.prescription, "image_url": m.image_url,
        "min_price": prices.get(m.id),
        "rating": round(float(avg), 1) if avg is not None else None,
        "reviews_count": cnt,
    }


# ---------- API ----------

@app.get("/api/categories", response_model=list[str])
def categories(db: Session = Depends(get_db)):
    return db.scalars(select(Medicine.category).distinct().order_by(Medicine.category)).all()


@app.get("/api/cities", response_model=list[str])
def cities(db: Session = Depends(get_db)):
    return db.scalars(select(Pharmacy.city).distinct().order_by(Pharmacy.city)).all()


@app.get("/api/medicines", response_model=list[MedicineShort])
def list_medicines(
    q: str | None = None,
    category: str | None = None,
    db: Session = Depends(get_db),
):
    stmt = select(Medicine).order_by(Medicine.name)
    if q:
        stmt = stmt.where(Medicine.search.contains(q.strip().lower(), autoescape=True))
    if category:
        stmt = stmt.where(Medicine.category == category)
    meds = db.scalars(stmt).all()
    prices, ratings = stats_for(db, [m.id for m in meds])
    return [short(m, prices, ratings) for m in meds]


@app.get("/api/medicines/{medicine_id}", response_model=MedicineFull)
def get_medicine(
    medicine_id: int,
    lat: float | None = Query(None, ge=-90, le=90),
    lng: float | None = Query(None, ge=-180, le=180),
    city: str | None = None,
    db: Session = Depends(get_db),
):
    m = db.get(Medicine, medicine_id)
    if not m:
        raise HTTPException(404, "Лекарство не найдено")

    offers = []
    for o in m.offers:
        if city and o.pharmacy.city != city:
            continue
        d = distance_km(lat, lng, o.pharmacy.lat, o.pharmacy.lng) if lat is not None and lng is not None else None
        offers.append({
            "price_som": o.price_som, "in_stock": o.in_stock, "updated_at": o.updated_at,
            "pharmacy": o.pharmacy, "distance_km": d,
        })
    # Если знаем, где пользователь — сначала ближайшие, иначе сначала дешёвые
    if lat is not None and lng is not None:
        offers.sort(key=lambda o: (not o["in_stock"], o["distance_km"]))
    else:
        offers.sort(key=lambda o: (not o["in_stock"], o["price_som"]))

    prices, ratings = stats_for(db, [m.id])
    return {**short(m, prices, ratings), "purpose": m.purpose,
            "contraindications": m.contraindications, "offers": offers}


@app.get("/api/medicines/{medicine_id}/reviews", response_model=list[ReviewOut])
def list_reviews(medicine_id: int, db: Session = Depends(get_db)):
    if not db.get(Medicine, medicine_id):
        raise HTTPException(404, "Лекарство не найдено")
    return db.scalars(
        select(Review)
        .where(Review.medicine_id == medicine_id, Review.status == APPROVED)
        .order_by(Review.created_at.desc(), Review.id.desc())
    ).all()


@app.post("/api/medicines/{medicine_id}/reviews", response_model=SubmittedReview, status_code=201)
def add_review(medicine_id: int, body: ReviewIn, request: Request, db: Session = Depends(get_db)):
    if not db.get(Medicine, medicine_id):
        raise HTTPException(404, "Лекарство не найдено")

    # Ловушка для ботов: притворяемся, что всё получилось, но ничего не сохраняем
    if body.website:
        return SubmittedReview(id=0, author=body.author, rating=body.rating, text=body.text,
                               created_at=now_utc(), status=PENDING)

    if has_link(body.author, body.text):
        raise HTTPException(422, "Ссылки в отзывах запрещены. Уберите адрес сайта из текста.")

    who = ip_hash(request)
    now = now_utc()

    def count_since(delta: timedelta) -> int:
        return db.scalar(select(func.count(Review.id)).where(
            Review.ip_hash == who, Review.created_at >= now - delta)) or 0

    if count_since(timedelta(minutes=10)) >= LIMIT_10MIN or count_since(timedelta(days=1)) >= LIMIT_DAY:
        raise HTTPException(429, "Слишком много отзывов с вашего устройства. Попробуйте позже.")

    if db.scalar(select(Review.id).where(
            Review.ip_hash == who, Review.medicine_id == medicine_id, Review.text == body.text).limit(1)):
        raise HTTPException(409, "Вы уже отправляли такой отзыв.")

    review = Review(medicine_id=medicine_id, author=body.author, rating=body.rating, text=body.text,
                    status=PENDING, ip_hash=who)
    db.add(review)
    db.commit()
    db.refresh(review)
    return SubmittedReview(id=review.id, author=review.author, rating=review.rating, text=review.text,
                           created_at=review.created_at, status=review.status)


@app.post("/api/reviews/{review_id}/report", status_code=204)
def report_review(review_id: int, request: Request, db: Session = Depends(get_db)):
    """Пожаловаться на отзыв. После нескольких жалоб отзыв скрывается до проверки."""
    review = db.get(Review, review_id)
    if not review or review.status != APPROVED:
        raise HTTPException(404, "Отзыв не найден")

    who = ip_hash(request)
    if db.scalar(select(ReviewReport.id).where(
            ReviewReport.review_id == review_id, ReviewReport.ip_hash == who).limit(1)) is None:
        db.add(ReviewReport(review_id=review_id, ip_hash=who))
        review.reports += 1
        if review.reports >= REPORTS_TO_HIDE:
            review.status = PENDING
        db.commit()
    return Response(status_code=204)  # повторную жалобу с того же устройства молча игнорируем


# ---------- Админка (нужен пароль ADMIN_PASSWORD) ----------

def admin_view(review: Review, medicine_name: str) -> dict:
    return {
        "id": review.id, "medicine_id": review.medicine_id, "medicine_name": medicine_name,
        "author": review.author, "rating": review.rating, "text": review.text,
        "created_at": review.created_at, "status": review.status, "reports": review.reports,
    }


def get_review_or_404(db: Session, review_id: int) -> Review:
    review = db.get(Review, review_id)
    if not review:
        raise HTTPException(404, "Отзыв не найден")
    return review


@app.get("/api/admin/reviews", response_model=list[AdminReview], dependencies=[Depends(require_admin)])
def admin_list_reviews(
    status: Literal["pending", "approved", "rejected", "reported", "all"] = "pending",
    db: Session = Depends(get_db),
):
    stmt = select(Review, Medicine.name).join(Medicine, Medicine.id == Review.medicine_id)
    if status == "reported":
        stmt = stmt.where(Review.reports > 0)
    elif status != "all":
        stmt = stmt.where(Review.status == status)
    rows = db.execute(stmt.order_by(Review.created_at.desc(), Review.id.desc())).all()
    return [admin_view(r, name) for r, name in rows]


@app.post("/api/admin/reviews/{review_id}/approve", response_model=AdminReview,
          dependencies=[Depends(require_admin)])
def admin_approve(review_id: int, db: Session = Depends(get_db)):
    review = get_review_or_404(db, review_id)
    review.status = APPROVED
    review.reports = 0  # проверено вручную: старые жалобы больше не считаются
    db.execute(delete(ReviewReport).where(ReviewReport.review_id == review_id))
    db.commit()
    return admin_view(review, review.medicine.name)


@app.post("/api/admin/reviews/{review_id}/reject", response_model=AdminReview,
          dependencies=[Depends(require_admin)])
def admin_reject(review_id: int, db: Session = Depends(get_db)):
    review = get_review_or_404(db, review_id)
    review.status = REJECTED
    db.commit()
    return admin_view(review, review.medicine.name)


@app.delete("/api/admin/reviews/{review_id}", status_code=204, dependencies=[Depends(require_admin)])
def admin_delete(review_id: int, db: Session = Depends(get_db)):
    review = get_review_or_404(db, review_id)
    db.execute(delete(ReviewReport).where(ReviewReport.review_id == review_id))
    db.delete(review)
    db.commit()
    return Response(status_code=204)


@app.get("/api/pharmacies", response_model=list[PharmacyOut])
def list_pharmacies(city: str | None = None, db: Session = Depends(get_db)):
    stmt = select(Pharmacy).order_by(Pharmacy.city, Pharmacy.name)
    if city:
        stmt = stmt.where(Pharmacy.city == city)
    return db.scalars(stmt).all()


@app.get("/api/health")
def health():
    return {"status": "ok", "db": engine.dialect.name}


# Для запуска без Docker: бэкенд сам отдаёт фронтенд из папки ../frontend
FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"
if FRONTEND_DIR.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
