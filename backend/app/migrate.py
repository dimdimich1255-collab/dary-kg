"""Мини-миграция: добавляет в уже существующую таблицу reviews новые колонки модерации.

Base.metadata.create_all() создаёт только недостающие таблицы и не трогает старые,
поэтому в базе, созданной до модерации, колонок status / reports / ip_hash не будет.
Старые отзывы при этом остаются и считаются одобренными."""

from sqlalchemy import inspect, text

NEW_REVIEW_COLUMNS = {
    "status": "VARCHAR(20) NOT NULL DEFAULT 'approved'",
    "reports": "INTEGER NOT NULL DEFAULT 0",
    "ip_hash": "VARCHAR(64)",
}


def add_missing_review_columns(engine):
    existing = {c["name"] for c in inspect(engine).get_columns("reviews")}
    with engine.begin() as conn:
        for name, ddl in NEW_REVIEW_COLUMNS.items():
            if name not in existing:
                conn.execute(text(f"ALTER TABLE reviews ADD COLUMN {name} {ddl}"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_reviews_status ON reviews (status)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_reviews_ip_hash ON reviews (ip_hash)"))
