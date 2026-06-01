FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -i https://mirrors.aliyun.com/pypi/simple/ --no-cache-dir -r requirements.txt
# Копируем весь пакет app
COPY app/ ./app/
COPY .env ./app/.env

# Создаём непривилегированного пользователя
RUN adduser --disabled-password --gecos '' appuser && chown -R appuser:appuser /app
USER appuser

# Переменные для Flask (опционально)
ENV FLASK_APP=app.api
ENV FLASK_RUN_HOST=0.0.0.0
ENV FLASK_RUN_PORT=5000

# Запуск напрямую через python (лучше для API, без отладки)
CMD ["python", "-m", "app.api"]