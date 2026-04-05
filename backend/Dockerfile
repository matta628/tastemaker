FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY dbt/ ./dbt/
COPY .env .env

# .env.secret is mounted at runtime via docker-compose, not baked in
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
