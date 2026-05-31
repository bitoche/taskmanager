import duckdb
from pathlib import Path
from .config import config 
from .classes import *
# Файл БД будет в корне taskservice (рядом с Dockerfile)
DB_PATH = config.DB_PATH

def get_db():
    return duckdb.connect(str(DB_PATH))

def init_db():
    # Получаем структуру таблиц (колонки и последовательности для автоинкремента)
    tasks_columns, tasks_sequences = get_sql_table(Task)
    status_columns, status_sequences = get_sql_table(TaskStatus)

    # Вспомогательная функция для генерации CREATE SEQUENCE
    def make_create_sequence_sql(sequences):
        return ''.join(f"CREATE SEQUENCE IF NOT EXISTS {seq};\n" for seq in sequences)

    # Формируем части SQL-скрипта
    tasks_seq_sql = make_create_sequence_sql(tasks_sequences)
    status_seq_sql = make_create_sequence_sql(status_sequences)

    tasks_columns_sql = ',\n\t'.join(tasks_columns)
    status_columns_sql = ',\n\t'.join(status_columns)

    # Полный SQL-скрипт (f-string делает код нагляднее)
    sql_script = f"""
{tasks_seq_sql}
CREATE TABLE IF NOT EXISTS tasks (
    {tasks_columns_sql}
);

{status_seq_sql}
CREATE TABLE IF NOT EXISTS task_status (
    {status_columns_sql}
);

INSERT INTO task_status (status_name) VALUES 
    ('active'),
    ('completed')
ON CONFLICT DO NOTHING;
"""

    with get_db() as conn:
        print(sql_script)   # опционально, для отладки
        conn.execute(sql_script)