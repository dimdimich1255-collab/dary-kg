import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# По умолчанию SQLite (один файл). Для Postgres задай переменную окружения:
# DATABASE_URL=postgresql+psycopg://user:password@host:5432/dbname
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./dary.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
