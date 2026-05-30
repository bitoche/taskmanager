from flask import Flask, request, jsonify
from .models import get_db, init_db

app = Flask(__name__)
init_db()

def get_next_id():
    with get_db() as conn:
        result = conn.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM tasks").fetchone()
        return result[0]

def task_to_dict(row):
    """Преобразует строку из БД в словарь JSON."""
    # row: (id, title, description, completed, created_at)
    return {
        "id": row[0],
        "title": row[1],
        "description": row[2],
        "completed": bool(row[3]),
        "created_at": row[4]
    }

# === API Endpoints ===

@app.route('/api/tasks', methods=['GET'])
def list_tasks():
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM tasks ORDER BY id").fetchall()
    return jsonify([task_to_dict(r) for r in rows])

@app.route('/api/tasks', methods=['POST'])
def create_task():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON"}), 400
    title = data.get('title')
    if not title:
        return jsonify({"error": "Title required"}), 400
    desc = data.get('description', '')
    next_id = get_next_id()
    with get_db() as conn:
        conn.execute("INSERT INTO tasks (id, title, description) VALUES (?, ?, ?)",
                     (next_id, title, desc))
    return jsonify({"id": next_id}), 201

@app.route('/api/tasks/<int:task_id>', methods=['GET'])
def get_task(task_id):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    if not row:
        return jsonify({"error": "Task not found"}), 404
    return jsonify(task_to_dict(row))

@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON"}), 400
    title = data.get('title')
    desc = data.get('description')
    completed = data.get('completed', False)
    with get_db() as conn:
        # Обновляем только переданные поля
        conn.execute("""
            UPDATE tasks 
            SET title = COALESCE(?, title), 
                description = COALESCE(?, description),
                completed = ?
            WHERE id = ?
        """, (title, desc, completed, task_id))
    return jsonify({"status": "updated"})

@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    with get_db() as conn:
        conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    return jsonify({"status": "deleted"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)