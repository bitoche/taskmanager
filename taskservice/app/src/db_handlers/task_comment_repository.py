import pandas as pd
from ...models import get_db
from ...classes import TaskComment, _df_to_list_of_obj, CreateTaskCommentDTO, UpdateTaskCommentDTO

def get_all_tasks_comments() -> pd.DataFrame:
    print('get all tc')
    with get_db() as conn:
        df = conn.sql(f'SELECT * FROM "task_comment" ORDER BY task_id, created_at asc;').df()
        print(df)
    return _df_to_list_of_obj(df, TaskComment)

def get_task_comment_by_id(comment_id):
    print(f'get tc by id {comment_id}')
    assert comment_id is not None
    with get_db() as conn:
        df = conn.sql(f'SELECT * FROM "task_comment" where comment_id = {comment_id};').df()
    if len(df) > 0:
        assert len(df) < 2, f'internal storage error: there is {len(df)} task_comments by one comment_id ({comment_id})'
        return _df_to_list_of_obj(df, TaskComment)[0]
    else:
        return None

def get_task_comments_by_task_id(task_id):
    print(f'get tc\'s by task id {task_id}')
    assert task_id is not None
    with get_db() as conn:
        df = conn.sql(f'SELECT * FROM "task_comment" where task_id = {task_id};').df()
    return _df_to_list_of_obj(df, TaskComment)

def insert_task_comment(task_comment_dto: CreateTaskCommentDTO):
    new_task_c = TaskComment(**task_comment_dto.__dict__)
    new_task_d = {
        k:v 
        for k,v 
        in vars(new_task_c).items() 
        if not k.startswith('_') 
        and not callable(k) 
        and v is not None
    }
    with get_db() as conn:
        res = conn.sql(f"""
            INSERT INTO "task_comment" ({', '.join([f'"{k}"' for k in new_task_d])}) VALUES
            ({', '.join([f"'{v}'" for v in new_task_d.values()])});""")
    return res

def update_task_comment(upd_task_comment_dto: UpdateTaskCommentDTO):
    task_d = {
        k:v 
        for k,v 
        in vars(upd_task_comment_dto).items() 
        if not k.startswith('_') 
        and not callable(k) 
        and v is not None
        and k != 'task_id'
    }
    assert len(task_d)>0, f'update must contain at least one attr: {upd_task_comment_dto}'
    with get_db() as conn:
        sets = [f'"{k}" = \'{v}\'' for k,v in task_d.items()]
        res = conn.sql(f"""
            UPDATE "task_comment"
            SET {', '.join(sets)}
            WHERE comment_id = {upd_task_comment_dto.comment_id};""")
    return res

def delete_task_comment(comment_id): # can be safe delete with move to trash, and restore if needed
    assert comment_id is not None
    with get_db() as conn:
        conn.execute(f'DELETE FROM "task_comment" where comment_id = {comment_id};')
    return True