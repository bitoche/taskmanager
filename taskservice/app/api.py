from flask import Flask, request, jsonify
from pydantic import ValidationError
from .models import init_db
from datetime import date, datetime
from .classes import CreateTaskDTO, UpdateTaskDTO, CreateTaskCommentDTO, CreateTaskTagDTO, CreateTaskTagXTaskDTO, UpdateTaskTagDTO, UpdateTaskCommentDTO, DateTime, Date
from .src.db_handlers import task_repository, task_tag_repository, task_comment_repository
from flask.json.provider import DefaultJSONProvider
import numpy as np
import pandas as pd
from pandas import NaT
import math
from .src import remote_files_handler

app = Flask(__name__)
init_db()

# Создаём свой кастомный JSON-провайдер
class CustomJSONProvider(DefaultJSONProvider):
    def default(self, obj):
        if isinstance(obj, float) and math.isnan(obj):
            return None
        if isinstance(obj, np.floating) and np.isnan(obj):
            return None
        # Если это numpy int, конвертируем во встроенный int
        if isinstance(obj, (np.integer, np.int32, np.int64)):
            return int(obj)
        # Если это numpy float, конвертируем во встроенный float
        if isinstance(obj, (np.floating, np.float32, np.float64)):
            return float(obj)
        # Если это массив numpy, конвертируем в список
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        # Pandas Timestamp -> ISO строка
        if isinstance(obj, pd.Timestamp):
            return obj.isoformat()
        # Pandas NaT (пустая дата), NA, NaN -> None (будет null в JSON)
        if isinstance(obj, (type(pd.NaT), type(pd.NA))):
            return None
        # Pandas Timedelta (если понадобится)
        if isinstance(obj, pd.Timedelta):
            return obj.total_seconds()
        # Date dataclass -> строка YYYY-MM-DD
        if isinstance(obj, Date) and not isinstance(obj, DateTime):
            return f"{obj.year:04d}-{obj.month:02d}-{obj.day:02d}"
        # DateTime dataclass -> ISO строка
        if isinstance(obj, DateTime):
            return f"{obj.year:04d}-{obj.month:02d}-{obj.day:02d}T{obj.hour:02d}:{obj.minute:02d}:{obj.second:02d}"
        # Для всего остального вызываем стандартный метод
        return super().default(obj)

app.json = CustomJSONProvider(app)

@app.route('/api/tasks', methods=['GET'])
def list_tasks():
    print('[API] GET /api/tasks - list all tasks')
    tasks = task_repository.get_all_tasks()
    print(f'[API] /api/tasks - returned {len(tasks)} tasks')
    return jsonify(tasks)

@app.route('/api/tasks/<int:task_id>', methods=['GET'])
def get_task_by_id(task_id):
    print(f'[API] GET /api/tasks/{task_id}')
    task = task_repository.get_task_by_id(task_id)
    print(f'[API] /api/tasks/{task_id} - {task}')
    return jsonify(task)

@app.route('/api/tasks/between', methods=['GET'])
def list_tasks_bw():
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')
    print(f'[API] GET /api/tasks/between?date_from={date_from}&date_to={date_to}')
    if not date_from or not date_to:
        return jsonify({"error": "Missing date_from or date_to"}), 400
    tasks = task_repository.get_all_tasks_between_dates(date_from, date_to)
    print(f'[API] /api/tasks/between - returned {len(tasks)} tasks')
    return jsonify(tasks)

@app.route('/api/tasks', methods=['POST'])
def create_task():
    data = request.get_json()
    print(f'[API] POST /api/tasks - data: {data}')
    if not data:
        return jsonify({"error": "Missing JSON body"}), 400
    try:
        task_dto = CreateTaskDTO(**data)
    except ValidationError as e:
        print(f'[API] POST /api/tasks - validation error: {e.errors()}')
        return jsonify(e.errors()), 400
    if task_dto.due_date:
        try:
            task_dto.due_date = date.fromisoformat(task_dto.due_date).isoformat()
        except ValueError:
            return jsonify({"error": "Invalid due_date format, use YYYY-MM-DD"}), 400
    task_repository.insert_task(task_dto)
    print(f'[API] POST /api/tasks - task created successfully')
    return jsonify({"status": 'success'})

@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    data = request.get_json()
    print(f'[API] PUT /api/tasks/{task_id} - data: {data}')
    if not data:
        return jsonify({"error": "Missing JSON body"}), 400
    try:
        upd_task_dto = UpdateTaskDTO(**data, task_id=task_id)
    except ValidationError as e:
        print(f'[API] PUT /api/tasks/{task_id} - validation error: {e.errors()}')
        return jsonify(e.errors()), 400
    if upd_task_dto.due_date:
        try:
            upd_task_dto.due_date = date.fromisoformat(upd_task_dto.due_date).isoformat()
        except ValueError:
            return jsonify({"error": "Invalid due_date format, use YYYY-MM-DD"}), 400
    # может работа фронта, но: обновление closed date относительно статуса, если он изменился
    if upd_task_dto.task_status is not None:
        if upd_task_dto.task_status == 1:
            upd_task_dto.closed_dttm = None
            print(f'[API] PUT /api/tasks/{task_id} - status changed to 1 (active), closed_dttm set to None')
        elif upd_task_dto.task_status == 2:
            task_from_db = task_repository.get_task_by_id(task_id)
            assert task_from_db is not None, f'task must be saved in database before updating'
            # NaT (pandas Not a Time) считается не-None, поэтому проверяем явно
            is_closed_dttm_null = task_from_db.closed_dttm is None or task_from_db.closed_dttm is NaT
            if is_closed_dttm_null:
                upd_task_dto.closed_dttm = datetime.now()
                print(f'[API] PUT /api/tasks/{task_id} - status changed to 2 (completed), closed_dttm set to {datetime.now()}')
            else:
                print(f'[API] PUT /api/tasks/{task_id} - status changed to 2 (completed), closed_dttm already exists: {task_from_db.closed_dttm}')
    task_repository.update_task(upd_task_dto)
    print(f'[API] PUT /api/tasks/{task_id} - task updated successfully')
    return jsonify({"status": 'success'})
    

@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    print(f'[API] DELETE /api/tasks/{task_id}')
    if task_repository.delete_task(task_id):
        print(f'[API] DELETE /api/tasks/{task_id} - deleted')
        return jsonify({"status": "deleted"})
    else:
        print(f'[API] DELETE /api/tasks/{task_id} - not deleted')
        return jsonify({'status': 'not deleted'})


@app.route('/api/remote_db/sync_download')
def download_updated_tasks_db():
    print('[API] POST /api/remote_db/sync_download')
    remote_api = remote_files_handler.get_remote_files_handler()
    res = remote_api.download_file()
    print(f'[API] /api/remote_db/sync_download - result: {res}')
    return jsonify({'status': res})

@app.route('/api/remote_db/sync_upload')
def upload_updated_tasks_db():
    print('[API] POST /api/remote_db/sync_upload')
    remote_api = remote_files_handler.get_remote_files_handler()
    res = remote_api.upload_file()
    print(f'[API] /api/remote_db/sync_upload - result: {res}')
    return jsonify({'status': res})

@app.route('/api/remote_db/check_updates')
def check_remote_db_for_updates():
    print('[API] GET /api/remote_db/check_updates')
    remote_api = remote_files_handler.get_remote_files_handler()
    hash_equals = remote_api.is_remote_equals_local_file()
    res = False
    if not hash_equals:
        compare_res = remote_api.compare_file_versions()
        print(f'[API] /api/remote_db/check_updates - versions differ, compare result: {compare_res}')
        if compare_res == 'remote_newer':
            res = True
        elif compare_res == 'error':
            res = None
    else:
        print('[API] /api/remote_db/check_updates - versions equal, no updates')
    print(f'[API] /api/remote_db/check_updates - response: {res}')
    return jsonify({'updates': res})

@app.route('/api/tasks/comment', methods=['POST'])
def create_comment_to_task():
    data = request.get_json()
    print(f'[API] POST /api/tasks/comment - data: {data}')
    if not data:
        return jsonify({"error": "Missing JSON body"}), 400
    try:
        create_comm_dto = CreateTaskCommentDTO(**data)
    except ValidationError as e:
        print(f'[API] POST /api/tasks/comment - validation error: {e.errors()}')
        return jsonify(e.errors()), 400
    task_comment_repository.insert_task_comment(create_comm_dto)
    print(f'[API] POST /api/tasks/comment - comment created for task_id={data.get("task_id")}')
    return jsonify({'status': 'success'})

@app.route('/api/tasks/<int:task_id>/comments', methods=['GET'])
def get_task_comments(task_id):
    print(f'[API] GET /api/tasks/{task_id}/comments')
    comments = task_comment_repository.get_task_comments_by_task_id(task_id)
    print(f'[API] /api/tasks/{task_id}/comments - returned {len(comments)} comments')
    return jsonify(comments)

@app.route('/api/tasks/comment/delete/<int:comment_id>', methods=['DELETE'])
def delete_task_comment(comment_id):
    print(f'[API] DELETE /api/tasks/comment/delete/{comment_id}')
    task_comment_repository.delete_task_comment(comment_id)
    print(f'[API] /api/tasks/comment/delete/{comment_id} - deleted')
    return jsonify({'status': 'success'})

@app.route('/api/tasks/comment/<int:comment_id>', methods=['PUT'])
def update_task_comment(comment_id):
    data = request.get_json()
    print(f'[API] PUT /api/tasks/comment/{comment_id} - data: {data}')
    if not data:
        return jsonify({"error": "Missing JSON body"}), 400
    try:
        upd_task_comment_dto = UpdateTaskCommentDTO(**data, comment_id=comment_id)
    except ValidationError as e:
        print(f'[API] PUT /api/tasks/comment/{comment_id} - validation error: {e.errors()}')
        return jsonify(e.errors()), 400
    task_comment_repository.update_task_comment(upd_task_comment_dto)
    print(f'[API] /api/tasks/comment/{comment_id} - updated')
    return jsonify({"status": 'success'})

@app.route('/api/task_tags', methods=['POST'])
def create_new_task_tag():
    data = request.get_json()
    print(f'[API] POST /api/task_tags - data: {data}')
    if not data:
        return jsonify({"error": "Missing JSON body"}), 400
    try:
        create_tag_dto = CreateTaskTagDTO(**data)
    except ValidationError as e:
        print(f'[API] POST /api/task_tags - validation error: {e.errors()}')
        return jsonify(e.errors()), 400
    task_tag_repository.create_new_task_tag(create_tag_dto)
    print(f'[API] POST /api/task_tags - tag created: {data.get("tag_text")}')
    return jsonify({'status': 'success'})

@app.route('/api/task_tags/assign', methods=['POST'])
def assign_tag_to_task():
    data = request.get_json()
    print(f'[API] POST /api/task_tags/assign - data: {data}')
    if not data:
        return jsonify({"error": "Missing JSON body"}), 400
    try:
        create_ttgxt_dto = CreateTaskTagXTaskDTO(**data)
    except ValidationError as e:
        print(f'[API] POST /api/task_tags/assign - validation error: {e.errors()}')
        return jsonify(e.errors()), 400
    task_tag_repository.create_new_task_tag_x_task(create_ttgxt_dto)
    print(f'[API] POST /api/task_tags/assign - tag {data.get("task_tag_id")} assigned to task {data.get("task_id")}')
    return jsonify({'status': 'success'})

@app.route('/api/task_tags/unassign/<int:task_tag_id>/task/<int:task_id>', methods=['DELETE'])
def unassign_tag_from_task(task_tag_id, task_id):
    print(f'[API] DELETE /api/task_tags/unassign/{task_tag_id}/task/{task_id}')
    task_tag_repository.delete_task_tag_x_task(task_tag_id=task_tag_id, task_id=task_id)
    print(f'[API] DELETE /api/task_tags/unassign/{task_tag_id}/task/{task_id} - unassigned')
    return jsonify({'status': 'success'})

@app.route('/api/task_tags', methods=['GET'])
def get_all_task_tags():
    print('[API] GET /api/task_tags')
    tags = task_tag_repository.get_all_task_tags()
    print(f'[API] GET /api/task_tags - returned {len(tags)} tags')
    return jsonify(tags)

@app.route('/api/task_tags/tasks', methods=['GET'])
def get_all_tags_with_tasks():
    print('[API] GET /api/task_tags/tasks')
    ttgxt = task_tag_repository.get_all_task_tag_x_task_entries()
    print(f'[API] GET /api/task_tags/tasks - returned {len(ttgxt)} assignments')
    return jsonify(ttgxt)

@app.route('/api/task_tags/<int:task_tag_id>', methods=['DELETE'])
def delete_task_tag_global(task_tag_id):
    print(f'[API] DELETE /api/task_tags/{task_tag_id}')
    task_tag_repository.delete_task_tag(task_tag_id)
    print(f'[API] DELETE /api/task_tags/{task_tag_id} - deleted')
    return jsonify({'status': 'success'})

@app.route('/api/task_tags/<int:task_tag_id>', methods=['PUT'])
def update_task_tag(task_tag_id):
    data = request.get_json()
    print(f'[API] PUT /api/task_tags/{task_tag_id} - data: {data}')
    if not data:
        return jsonify({"error": "Missing JSON body"}), 400
    try:
        upd_task_tag_dto = UpdateTaskTagDTO(**data, task_tag_id=task_tag_id)
    except ValidationError as e:
        print(f'[API] PUT /api/task_tags/{task_tag_id} - validation error: {e.errors()}')
        return jsonify(e.errors()), 400
    task_tag_repository.update_task_tag(upd_task_tag_dto)
    print(f'[API] PUT /api/task_tags/{task_tag_id} - updated')
    return jsonify({"status": 'success'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)