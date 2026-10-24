from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def now_utc():
    return datetime.now(timezone.utc)


class Medicine(Base):
    """Лекарство: что это, для чего, картинка."""

    __tablename__ = "medicines"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), index=True)
    generic_name: Mapped[str] = mapped_column(String(120))  # действующее вещество (МНН)
    category: Mapped[str] = mapped_column(String(60), index=True)
    form: Mapped[str] = mapped_column(String(120))  # таблетки 500 мг, №20
    purpose: Mapped[str] = mapped_column(Text)  # для чего нужно
    contraindications: Mapped[str] = mapped_column(Text)
    prescription: Mapped[bool] = mapped_column(Boolean, default=False)
    image_url: Mapped[str | None] = mapped_column(String(300), nullable=True)
    # Текст для поиска в нижнем регистре: SQLite не умеет ilike по кириллице
    search: Mapped[str] = mapped_column(Text, default="")

    def refresh_search(self):
        self.search = " ".join([self.name, self.generic_name, self.category, self.purpose]).lower()

    offers: Mapped[list["Offer"]] = relationship(back_populates="medicine")
    reviews: Mapped[list["Review"]] = relationship(back_populates="medicine")


class Pharmacy(Base):
    """Аптека с адресом и координатами (для поиска ближайшей)."""

    __tablename__ = "pharmacies"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    city: Mapped[str] = mapped_column(String(60), index=True)
    address: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str] = mapped_column(String(40))
    hours: Mapped[str] = mapped_column(String(60))
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)

    offers: Mapped[list["Offer"]] = relationship(back_populates="pharmacy")


class Offer(Base):
    """Цена конкретного лекарства в конкретной аптеке."""

    __tablename__ = "offers"

    id: Mapped[int] = mapped_column(primary_key=True)
    medicine_id: Mapped[int] = mapped_column(ForeignKey("medicines.id"), index=True)
    pharmacy_id: Mapped[int] = mapped_column(ForeignKey("pharmacies.id"), index=True)
    price_som: Mapped[int] = mapped_column(Integer)
    in_stock: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    medicine: Mapped[Medicine] = relationship(back_populates="offers")
    pharmacy: Mapped[Pharmacy] = relationship(back_populates="offers")


# Статусы отзыва: новый отзыв ждёт проверки, на сайте виден только одобренный
PENDING, APPROVED, REJECTED = "pending", "approved", "rejected"


class Review(Base):
    """Отзыв пользователя о лекарстве."""

    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    medicine_id: Mapped[int] = mapped_column(ForeignKey("medicines.id"), index=True)
    author: Mapped[str] = mapped_column(String(60))
    rating: Mapped[int] = mapped_column(Integer)  # 1..5
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    # server_default нужен, чтобы отзывы, созданные до модерации, остались видимыми
    status: Mapped[str] = mapped_column(String(20), default=PENDING, server_default=APPROVED, index=True)
    reports: Mapped[int] = mapped_column(Integer, default=0, server_default="0")  # жалобы
    # Хеш IP автора: хватает для лимитов, но по нему нельзя узнать человека
    ip_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)

    medicine: Mapped[Medicine] = relationship(back_populates="reviews")


class ReviewReport(Base):
    """Жалоба на отзыв. Один человек (по хешу IP) может пожаловаться на отзыв только раз."""

    __tablename__ = "review_reports"
    __table_args__ = (UniqueConstraint("review_id", "ip_hash"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    review_id: Mapped[int] = mapped_column(ForeignKey("reviews.id", ondelete="CASCADE"), index=True)
    ip_hash: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
