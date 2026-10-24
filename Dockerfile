# Боевой образ для Render: один сервис отдаёт и сайт, и API.
# (Для локальной разработки есть docker-compose.yml: там nginx, backend и Postgres отдельно.)
FROM python:3.11-slim

WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
# Бэкенд ищет сайт в папке /frontend (см. FRONTEND_DIR в backend/app/main.py)
COPY frontend /frontend

# Render сам задаёт PORT; по умолчанию 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
