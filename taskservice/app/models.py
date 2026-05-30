import duckdb
from pathlib import Path
from .config import config 
# Файл БД будет в корне taskservice (рядом с Dockerfile)
DB_PATH = config.DB_PATH

def get_db():
    """Возвращает соединение с DuckDB."""
    return duckdb.connect(str(DB_PATH))

def init_db():
    """Создаёт таблицу tasks, если её нет."""
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY,
                title VARCHAR NOT NULL,
                description TEXT,
                completed BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)