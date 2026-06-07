from flask import Flask, request, jsonify
from pydantic import ValidationError
from .models import init_db
from datetime import date, datetime
from .classes import CreateTaskDTO, UpdateTaskDTO, CreateTaskCommentDTO, CreateTaskTagDTO, CreateTaskTagXTaskDTO, UpdateTaskTagDTO, UpdateTaskCommentDTO
from .src.db_handlers import task_repository, task_tag_repository, task_comment_repository
from flask.json.provider import DefaultJSONProvider
import numpy as np
import pandas as pd
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
        # Для всего остального вызываем стандартный метод
        return super().default(obj)

app.json = CustomJSONProvider(app)

@app.route('/api/tasks', methods=['GET'])
def list_tasks():
    tasks = task_repository.get_all_tasks()
    return jsonify(tasks)

@app.route('/api/tasks/<int:task_id>', methods=['GET'])
def get_task_by_id(task_id):
    task = task_repository.get_task_by_id(task_id)
    return jsonify(task)

@app.route('/api/tasks/between', methods=['GET'])
def list_tasks_bw():
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')
    if not date_from or not date_to:
        return jsonify({"error": "Missing date_from or date_to"}), 400
    tasks = task_repository.get_all_tasks_between_dates(date_from, date_to)
    return jsonify(tasks)

@app.route('/api/tasks', methods=['POST'])
def create_task():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing JSON body"}), 400
    try:
        task_dto = CreateTaskDTO(**data)
    except ValidationError as e:
        return jsonify(e.errors()), 400
    if task_dto.due_date:
        try:
            task_dto.due_date = date.fromisoformat(task_dto.due_date).isoformat()
        except ValueError:
            return jsonify({"error": "Invalid due_date format, use YYYY-MM-DD"}), 400
    task_repository.insert_task(task_dto)
    return jsonify({"status": 'success'})

@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing JSON body"}), 400
    try:
        upd_task_dto = UpdateTaskDTO(**data, task_id=task_id)
    except ValidationError as e:
        return jsonify(e.errors()), 400
    if upd_task_dto.due_date:
        try:
            upd_task_dto.due_date = date.fromisoformat(upd_task_dto.due_date).isoformat()
        except ValueError:
            return jsonify({"error": "Invalid due_date format, use YYYY-MM-DD"}), 400
    # может работа фронта, но: обновление closed date относительно статуса, если он изменился
    if upd_task_dto.task_status is not None:
        if upd_task_dto.task_status == 1:
            upd_task_dto.closed_date = None
        elif upd_task_dto.task_status == 2:
            task_from_db = task_repository.get_task_by_id(task_id) # костыль из-за обработки на беке?: получение текущего closed_dttm из бд
            assert task_from_db is not None, f'task must be saved in database before updating'
            if task_from_db.closed_dttm is None:
                upd_task_dto.closed_date = datetime.now().date().isoformat()
    task_repository.update_task(upd_task_dto)
    return jsonify({"status": 'success'})
    

@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    if task_repository.delete_task(task_id):
        return jsonify({"status": "deleted"})
    else:
        return jsonify({'status': 'not deleted'})


@app.route('/api/remote_db/sync_download')
def download_updated_tasks_db():
    remote_api = remote_files_handler.get_remote_files_handler()
    res = remote_api.download_file()
    return jsonify({'status': res})

@app.route('/api/remote_db/sync_upload')
def upload_updated_tasks_db():
    remote_api = remote_files_handler.get_remote_files_handler()
    res = remote_api.upload_file()
    return jsonify({'status': res})

@app.route('/api/remote_db/check_updates')
def check_remote_db_for_updates():
    remote_api = remote_files_handler.get_remote_files_handler()
    hash_equals = remote_api.is_remote_equals_local_file()
    res = False
    if not hash_equals:
        compare_res = remote_api.compare_file_versions()
        if compare_res == 'remote_newer':
            res = True
        elif compare_res == 'error':
            res = None
    return jsonify({'updates': res})

@app.route('/api/tasks/comment', methods=['POST'])
def create_comment_to_task():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing JSON body"}), 400
    try:
        create_comm_dto = CreateTaskCommentDTO(**data)
    except ValidationError as e:
        return jsonify(e.errors()), 400
    task_comment_repository.insert_task_comment(create_comm_dto)
    return jsonify({'status': 'success'})

@app.route('/api/tasks/<int:task_id>/comments', methods=['GET'])
def get_task_comments(task_id):
    return jsonify(task_comment_repository.get_task_comments_by_task_id(task_id))

@app.route('/api/tasks/comment/delete/<int:comment_id>', methods=['DELETE'])
def delete_task_comment(comment_id):
    task_comment_repository.delete_task_comment(comment_id)
    return jsonify({'status': 'success'})

@app.route('/api/tasks/comment/<int:comment_id>', methods=['PUT'])
def update_task_comment(comment_id):
    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing JSON body"}), 400
    try:
        upd_task_comment_dto = UpdateTaskCommentDTO(**data, comment_id=comment_id)
    except ValidationError as e:
        return jsonify(e.errors()), 400
    task_comment_repository.update_task_comment(upd_task_comment_dto)
    return jsonify({"status": 'success'})

@app.route('/api/task_tags', methods=['POST'])
def create_new_task_tag():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing JSON body"}), 400
    try:
        create_tag_dto = CreateTaskTagDTO(**data)
    except ValidationError as e:
        return jsonify(e.errors()), 400
    task_tag_repository.create_new_task_tag(create_tag_dto)
    return jsonify({'status': 'success'})

@app.route('/api/task_tags/assign', methods=['POST'])
def assign_tag_to_task():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing JSON body"}), 400
    try:
        create_ttgxt_dto = CreateTaskTagXTaskDTO(**data)
    except ValidationError as e:
        return jsonify(e.errors()), 400
    task_tag_repository.create_new_task_tag_x_task(create_ttgxt_dto)
    return jsonify({'status': 'success'})

@app.route('/api/task_tags/unassign/<int:task_tag_id>/task/<int:task_id>', methods=['DELETE'])
def unassign_tag_from_task(task_tag_id, task_id):
    task_tag_repository.delete_task_tag_x_task(task_tag_id=task_tag_id, task_id=task_id)
    return jsonify({'status': 'success'})

@app.route('/api/task_tags', methods=['GET'])
def get_all_task_tags():
    tags = task_tag_repository.get_all_task_tags()
    return jsonify(tags)
@app.route('/api/task_tags/tasks', methods=['GET'])
def get_all_tags_with_tasks():
    ttgxt = task_tag_repository.get_all_task_tag_x_task_entries()
    return jsonify(ttgxt)

@app.route('/api/task_tags/<int:task_tag_id>', methods=['DELETE'])
def delete_task_tag_global(task_tag_id):
    task_tag_repository.delete_task_tag(task_tag_id)
    return jsonify({'status': 'success'})

@app.route('/api/task_tags/<int:task_tag_id>', methods=['PUT'])
def update_task_tag(task_tag_id):
    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing JSON body"}), 400
    try:
        upd_task_tag_dto = UpdateTaskTagDTO(**data, task_tag_id=task_tag_id)
    except ValidationError as e:
        return jsonify(e.errors()), 400
    task_tag_repository.update_task_tag(upd_task_tag_dto)
    return jsonify({"status": 'success'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)