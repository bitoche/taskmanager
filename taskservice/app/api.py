from flask import Flask, request, jsonify
from pydantic import ValidationError
from .models import init_db
from datetime import date, datetime
from .classes import CreateTaskDTO, UpdateTaskDTO
from . import db_handler
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
    tasks = db_handler.get_all_tasks()
    return jsonify(tasks)

@app.route('/api/tasks/<int:task_id>', methods=['GET'])
def get_task_by_id(task_id):
    task = db_handler.get_task_by_id(task_id)
    return jsonify(task)

@app.route('/api/tasks/between', methods=['GET'])
def list_tasks_bw():
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')
    if not date_from or not date_to:
        return jsonify({"error": "Missing date_from or date_to"}), 400
    tasks = db_handler.get_all_tasks_between_dates(date_from, date_to)
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
    db_handler.insert_task(task_dto)
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
            task_from_db = db_handler.get_task_by_id(task_id) # костыль из-за обработки на беке?: получение текущего closed_dttm из бд
            assert task_from_db is not None, f'task must be saved in database before updating'
            if task_from_db.closed_dttm is None:
                upd_task_dto.closed_date == datetime.now().date().isoformat()
    db_handler.update_task(upd_task_dto)
    return jsonify({"status": 'success'})
    

@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    if db_handler.delete_task(task_id):
        return jsonify({"status": "deleted"})
    else:
        return jsonify({'status': 'not deleted'})


@app.route('/api/remote_db/sync_download')
def download_updated_tasks_db():
    remotes = remote_files_handler.RemoteFilesHandler()
    res = remotes.download_file()
    return jsonify({'status': res})

@app.route('/api/remote_db/sync_upload')
def upload_updated_tasks_db():
    remotes = remote_files_handler.RemoteFilesHandler()
    res = remotes.upload_file()
    return jsonify({'status': res})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)