import requests
from flask import Flask, render_template, request, redirect, url_for

app = Flask(__name__)
app.config['SECRET_KEY'] = 'change-this-in-production'

# Адрес taskservice внутри Docker-сети
TASKSERVICE_URL = "http://taskservice:5000/api"

# --- Маршруты ---

@app.route('/')
def index():
    try:
        resp = requests.get(f"{TASKSERVICE_URL}/tasks")
        resp.raise_for_status()
        tasks = resp.json()
    except requests.exceptions.RequestException:
        tasks = []
    return render_template('index.html', tasks=tasks)

@app.route('/create', methods=['GET', 'POST'])
def create():
    if request.method == 'POST':
        title = request.form.get('title')
        description = request.form.get('description', '')
        if title:
            data = {"title": title, "description": description}
            try:
                requests.post(f"{TASKSERVICE_URL}/tasks", json=data)
            except requests.exceptions.RequestException:
                pass
        return redirect(url_for('index'))
    return render_template('create.html')

@app.route('/edit/<int:task_id>', methods=['GET', 'POST'])
def edit(task_id):
    if request.method == 'POST':
        title = request.form.get('title')
        description = request.form.get('description', '')
        completed = 'completed' in request.form
        data = {"title": title, "description": description, "completed": completed}
        try:
            requests.put(f"{TASKSERVICE_URL}/tasks/{task_id}", json=data)
        except requests.exceptions.RequestException:
            pass
        return redirect(url_for('index'))
    else:
        try:
            resp = requests.get(f"{TASKSERVICE_URL}/tasks/{task_id}")
            if resp.status_code == 404:
                return "Task not found", 404
            resp.raise_for_status()
            task = resp.json()
        except requests.exceptions.RequestException:
            return "Error fetching task", 500
        return render_template('edit.html', task=task)

@app.route('/delete/<int:task_id>')
def delete(task_id):
    try:
        requests.delete(f"{TASKSERVICE_URL}/tasks/{task_id}")
    except requests.exceptions.RequestException:
        pass
    return redirect(url_for('index'))

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=False)