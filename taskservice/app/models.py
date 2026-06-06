import duckdb
from pathlib import Path
from .config import config 
from .classes import *
from .src import remote_files_handler
# Файл БД будет в корне taskservice (рядом с Dockerfile)
DB_PATH = config.DB_PATH

def get_db():
    return duckdb.connect(str(DB_PATH))

def init_db():
    # Получаем структуру таблиц (колонки и последовательности для автоинкремента)
    tasks_columns, tasks_sequences = get_sql_table(Task)
    status_columns, status_sequences = get_sql_table(TaskStatus)
    task_comment_columns, task_comment_sequences = get_sql_table(TaskComment)
    task_tag_columns, task_tag_sequences = get_sql_table(TaskTag)
    task_tag_x_task_columns, task_tag_x_task_sequences = get_sql_table(TaskTagXTask)

    # Вспомогательная функция для генерации CREATE SEQUENCE
    def make_create_sequence_sql(sequences):
        return ''.join(f"CREATE SEQUENCE IF NOT EXISTS {seq};\n" for seq in sequences)

    # Формируем части SQL-скрипта
    tasks_seq_sql = make_create_sequence_sql(tasks_sequences)
    status_seq_sql = make_create_sequence_sql(status_sequences)
    task_comment_seq_sql = make_create_sequence_sql(task_comment_sequences)
    task_tag_seq_sql = make_create_sequence_sql(task_tag_sequences)
    task_tag_x_task_seq_sql = make_create_sequence_sql(task_tag_x_task_sequences)

    tasks_columns_sql = ',\n\t'.join(tasks_columns)
    status_columns_sql = ',\n\t'.join(status_columns)
    task_comment_columns_sql = ',\n\t'.join(task_comment_columns)
    task_tag_columns_sql = ',\n\t'.join(task_tag_columns)
    task_tag_x_task_columns_sql = ',\n\t'.join(task_tag_x_task_columns)

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

{task_comment_seq_sql}
CREATE TABLE IF NOT EXISTS task_comment (
    {task_comment_columns_sql}
);
{task_tag_seq_sql}
CREATE TABLE IF NOT EXISTS task_tag (
    {task_tag_columns_sql}
);
{task_tag_x_task_seq_sql}
CREATE TABLE IF NOT EXISTS task_tag_x_task (
    {task_tag_x_task_columns_sql}
);
"""
    
    # remote = remote_files_handler.RemoteFilesHandler()
    with get_db() as conn:
        print(sql_script)   # опционально, для отладки
        conn.execute(sql_script)
    with get_db() as conn:
        current_structure_tasks = conn.sql(f'select * from tasks limit 0;').df().columns.to_list()
        in_code_structure_tasks = conn.sql(f'create temp table temp_tasks_curr ({tasks_columns_sql}); select * from temp_tasks_curr limit 0;').df().columns.to_list()
        migrate = set(current_structure_tasks).issubset(set(in_code_structure_tasks))
        if migrate:    
            new_cols = list(set(in_code_structure_tasks).difference(current_structure_tasks))
            print(f'new tasks cols: {new_cols}')
            for col in tasks_columns:
                col = col.replace(' NOT NULL', '')
                alt = f'ALTER TABLE tasks ADD COLUMN IF NOT EXISTS {col};'
                print(alt)
                conn.execute(alt)
            print(f"new struct: {conn.sql(f'select * from tasks limit 0;').df().columns.to_list()}")
            # print(f"status update on remote: {remote.upload_file()}")
        
    
    