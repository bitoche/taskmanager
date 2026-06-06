import pandas as pd
from ...models import get_db
from ...classes import Task, _df_to_list_of_obj, CreateTaskDTO, UpdateTaskDTO

def get_all_tasks() -> pd.DataFrame:
    print('get all')
    with get_db() as conn:
        df = conn.sql(f'SELECT * FROM "tasks" ORDER BY due_date, task_id;').df()
        print(df)
    return _df_to_list_of_obj(df, Task)

def get_all_tasks_between_dates(date_from_iso: str, date_to_iso:str) -> pd.DataFrame:
    print(f'get bw {date_from_iso} {date_to_iso}')
    with get_db() as conn:
        df = conn.sql(f"""
            SELECT * FROM "tasks"
            WHERE due_date <= '{date_to_iso}'::date
            AND '{date_from_iso}'::date <= due_date
            ORDER BY due_date, task_id;
        """).df()
        df.fillna(None, inplace=True)
    return _df_to_list_of_obj(df, Task)

def get_task_by_id(task_id):
    print(f'get by id {task_id}')
    assert task_id is not None
    with get_db() as conn:
        df = conn.sql(f'SELECT * FROM "tasks" where task_id = {task_id};').df()
    if len(df) > 0:
        assert len(df) < 2, f'internal storage error: there is {len(df)} tasks by one task_id ({task_id})'
        return _df_to_list_of_obj(df, Task)[0]
    else:
        return None

def insert_task(task_dto: CreateTaskDTO):
    new_task = Task(**task_dto.__dict__)
    new_task.task_status = 1
    new_task_d = {
        k:v 
        for k,v 
        in vars(new_task).items() 
        if not k.startswith('_') 
        and not callable(k) 
        and v is not None
    }
    with get_db() as conn:
        res = conn.sql(f"""
            INSERT INTO "tasks" ({', '.join([f'"{k}"' for k in new_task_d])}) VALUES
            ({', '.join([f"'{v}'" for v in new_task_d.values()])});""")
    return res

def update_task(upd_task_dto: UpdateTaskDTO):
    task_d = {
        k:v 
        for k,v 
        in vars(upd_task_dto).items() 
        if not k.startswith('_') 
        and not callable(k) 
        and v is not None
        and k != 'task_id'
    }
    assert len(task_d)>0, f'update must contain at least one attr: {upd_task_dto}'
    with get_db() as conn:
        sets = [f'"{k}" = \'{v}\'' for k,v in task_d.items()]
        res = conn.sql(f"""
            UPDATE "tasks"
            SET {', '.join(sets)}
            WHERE task_id = {upd_task_dto.task_id};""")
    return res

def delete_task(task_id): # can be safe delete with move to trash, and restore if needed
    assert task_id is not None
    with get_db() as conn:
        conn.execute(f'DELETE FROM "tasks" where task_id = {task_id};')
    return True