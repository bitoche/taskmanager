import pandas as pd
from ...models import get_db
from ...classes import (
    Task,
    TaskTag, 
    TaskTagXTask, 
    _df_to_list_of_obj, 
    CreateTaskTagDTO, 
    CreateTaskTagXTaskDTO, 
    UpdateTaskTagDTO
)

def get_all_task_tags() -> pd.DataFrame:
    print('get all ttags')
    with get_db() as conn:
        df = conn.sql(f'SELECT * FROM "task_tag" ORDER BY color, task_tag_id;').df()
        print(df)
    return _df_to_list_of_obj(df, TaskTag)
def get_all_task_tag_x_task_entries() -> pd.DataFrame:
    print('get all ttag_x_task')
    with get_db() as conn:
        df = conn.sql(f'SELECT * FROM "task_tag_x_task" ORDER BY task_id, task_tag_id;').df()
        print(df)
    return _df_to_list_of_obj(df, TaskTagXTask)

def get_task_tag_by_id(task_tag_id):
    print(f'get tag by id {task_tag_id}')
    assert task_tag_id is not None
    with get_db() as conn:
        df = conn.sql(f'SELECT * FROM "task_tag" where task_tag_id = {task_tag_id};').df()
    if len(df) > 0:
        assert len(df) < 2, f'internal storage error: there is {len(df)} task_tag by one task_tag_id ({task_tag_id})'
        return _df_to_list_of_obj(df, TaskTag)[0]
    else:
        return None

def get_task_tags_by_task_id(task_id):
    print(f'get tags by task_id {task_id}')
    assert task_id is not None
    with get_db() as conn:
        df = conn.sql(f"""
            SELECT t2.* 
            FROM "task_tag_x_task" t1
            LEFT JOIN "task_tag" t2
                using (task_tag_id) 
            where t1.task_id = {task_id};
        """).df()
    return _df_to_list_of_obj(df, TaskTag)

def get_tasks_by_task_tag_id(task_tag_id):
    print(f'get tags by task_tag_id {task_tag_id}')
    assert task_tag_id is not None
    with get_db() as conn:
        df = conn.sql(f"""
            SELECT t2.* 
            FROM "task_tag_x_task" t1
            LEFT JOIN "task" t2
                using (task_id) 
            where t1.task_tag_id = {task_tag_id};
        """).df()
    return _df_to_list_of_obj(df, Task)

def create_new_task_tag(task_tag_dto: CreateTaskTagDTO):
    new_task_tag = TaskTag(**task_tag_dto.__dict__)
    new_task_tag_d = {
        k:v 
        for k,v 
        in vars(new_task_tag).items() 
        if not k.startswith('_') 
        and not callable(k) 
        and v is not None
    }
    with get_db() as conn:
        res = conn.sql(f"""
            INSERT INTO "task_tag" ({', '.join([f'"{k}"' for k in new_task_tag_d])}) VALUES
            ({', '.join([f"'{v}'" for v in new_task_tag_d.values()])});""")
    return res

def create_new_task_tag_x_task(task_tag_x_task_dto: CreateTaskTagXTaskDTO):
    new_task_tag_x_task = TaskTag(**task_tag_x_task_dto.__dict__)
    new_task_tag_x_task_d = {
            k:v 
            for k,v 
            in vars(new_task_tag_x_task).items() 
            if not k.startswith('_') 
            and not callable(k) 
            and v is not None
        }
    with get_db() as conn:
        res = conn.sql(f"""
            INSERT INTO "task_tag" ({', '.join([f'"{k}"' for k in new_task_tag_x_task_d])}) VALUES
            ({', '.join([f"'{v}'" for v in new_task_tag_x_task_d.values()])});""")
    return res

def update_task_tag(upd_task_tag_dto: UpdateTaskTagDTO):
    task_d = {
        k:v 
        for k,v 
        in vars(upd_task_tag_dto).items() 
        if not k.startswith('_') 
        and not callable(k) 
        and v is not None
        and k != 'task_tag_id'
    }
    assert len(task_d)>0, f'update must contain at least one attr: {upd_task_tag_dto}'
    with get_db() as conn:
        sets = [f'"{k}" = \'{v}\'' for k,v in task_d.items()]
        res = conn.sql(f"""
            UPDATE "task_tag"
            SET {', '.join(sets)}
            WHERE task_tag_id = {upd_task_tag_dto.task_tag_id};""")
    return res

def delete_task_tag(task_tag_id): # can be safe delete with move to trash, and restore if needed
    assert task_tag_id is not None
    with get_db() as conn:
        conn.execute(f'DELETE FROM "task_tag" where task_tag_id = {task_tag_id};')
        conn.execute(f'DELETE FROM "task_tag_x_task" where task_tag_id = {task_tag_id};')
    return True

def delete_task_tag_x_task(task_tag_id, task_id):
    assert task_tag_id is not None and task_id is not None
    with get_db() as conn:
        conn.execute(f'DELETE FROM "task_tag_x_task" where task_tag_id = {task_tag_id} AND task_id = {task_id};')
    return True