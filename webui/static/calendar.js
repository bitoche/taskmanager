// Глобальные переменные
let allTasks = [];
let currentDates = [];        // массив объектов Date для отображаемых дней
const strip = document.getElementById('calendarStrip');
const DAYS_BEFORE = 14;  // сколько дней до текущей даты
const DAYS_AFTER = 14;   // сколько дней после текущей даты
let isDragging = false;
let startX, startScrollLeft;

// DOM элементы модалки
const modal = document.getElementById('taskModal');
const modalTitle = document.getElementById('modalTitle');
const taskTitleInput = document.getElementById('taskTitle');
const taskDescInput = document.getElementById('taskDesc');
const taskDueDateInput = document.getElementById('taskDueDate');
const taskIdHidden = document.getElementById('taskId');
const saveBtn = document.getElementById('modalSaveBtn');
const deleteBtn = document.getElementById('modalDeleteBtn');
const cancelBtn = document.getElementById('modalCancelBtn');
let currentEditId = null;

// ========== Вспомогательные функции ==========
function formatDateKey(date) {
    return date.toISOString().slice(0, 10);
}
function getTodayDate() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}
function addDays(date, days) {
    const res = new Date(date);
    res.setDate(res.getDate() + days);
    return res;
}
function formatDisplayDate(date) {
    const day = date.getDate();
    const month = date.toLocaleString('ru-RU', { month: 'short' }).replace('.', '');
    return `${day} ${month}`;
}
function formatWeekday(date) {
    let wd = date.toLocaleString('ru-RU', { weekday: 'short' });
    return wd.charAt(0).toUpperCase() + wd.slice(1);
}
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ========== API вызовы ==========
// async function moveOverdueTasks() {
//     try {
//         await fetch('/api/tasks/move_overdue', { method: 'POST' });
//     } catch(e) { console.error('move_overdue error', e); }
// }

async function loadTasks() {
    try {
        const resp = await fetch('/api/tasks');
        allTasks = await resp.json();
    } catch(e) {
        console.error(e);
        allTasks = [];
    }
    renderCalendar();
}

async function saveTask() {
    const title = taskTitleInput.value.trim();
    if (!title) { alert('Введите название'); return; }
    const description = taskDescInput.value;
    const due_date = taskDueDateInput.value || null;
    const id = currentEditId;

    const payload = { title, description, due_date };
    try {
        if (!id) {
            await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } else {
            await fetch(`/api/tasks/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...payload, completed: false })
            });
        }
        closeModal();
        // await moveOverdueTasks();
        await loadTasks();
    } catch(e) { alert('Ошибка сохранения'); }
}

async function deleteTask() {
    if (!currentEditId) return;
    if (confirm('Удалить задачу?')) {
        try {
            await fetch(`/api/tasks/${currentEditId}`, { method: 'DELETE' });
            closeModal();
            // await moveOverdueTasks();
            await loadTasks();
        } catch(e) { alert('Ошибка удаления'); }
    }
}

// ========== Рендеринг календаря ==========
function buildDateRange() {
    const today = getTodayDate(); // возвращает объект Date с началом дня (00:00:00)
    const start = addDays(today, -DAYS_BEFORE);
    const end = addDays(today, DAYS_AFTER);
    const range = [];
    let cur = new Date(start);
    while (cur <= end) {
        range.push(new Date(cur));
        cur = addDays(cur, 1);
    }
    return range;
}

function groupTasksByDate() {
    const map = new Map();
    for (let task of allTasks) {
        const key = task.due_date || '';
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(task);
    }
    return map;
}

function renderCalendar() {
    const dates = buildDateRange();
    currentDates = dates;
    const todayStr = formatDateKey(getTodayDate());
    const taskMap = groupTasksByDate();

    const fragment = document.createDocumentFragment();
    for (let d of dates) {
        const dateStr = formatDateKey(d);
        const isToday = (dateStr === todayStr);
        const tasksForDay = taskMap.get(dateStr) || [];
        // сортировка: просроченные сверху, потом остальные
        tasksForDay.sort((a,b) => (b.overdue_days || 0) - (a.overdue_days || 0));

        const card = document.createElement('div');
        card.className = 'day-card';
        if (isToday) card.classList.add('today-card');
        card.setAttribute('data-date', dateStr);

        // Шапка
        const headerDiv = document.createElement('div');
        headerDiv.className = 'day-header';
        headerDiv.innerHTML = `
            <div class="date">${formatDisplayDate(d)}</div>
            <div class="weekday">${formatWeekday(d)}</div>
            <div class="month-hint">${d.toLocaleString('ru-RU', { month: 'long' })}</div>
        `;
        card.appendChild(headerDiv);

        // Список задач
        const tasksDiv = document.createElement('div');
        tasksDiv.className = 'tasks-list';
        if (tasksForDay.length === 0) {
            tasksDiv.innerHTML = '<div style="text-align:center; color:#aaa;">—</div>';
        } else {
            for (let task of tasksForDay) {
                const taskDiv = document.createElement('div');
                taskDiv.className = 'task-item';
                taskDiv.setAttribute('data-task-id', task.id);
                let badge = '';
                if (task.overdue_days && task.overdue_days > 0 && !task.completed) {
                    badge = `<span class="overdue-badge">просрочка ${task.overdue_days} дн.</span>`;
                } else if (task.completed) {
                    badge = `<span class="completed-badge">✓ выполнено</span>`;
                }
                taskDiv.innerHTML = `
                    <div class="task-title">
                        <span>${escapeHtml(task.title)} ${badge}</span>
                    </div>
                    <div style="font-size:0.75rem; color:#555;">${escapeHtml(task.description?.substring(0,60)) || ''}</div>
                `;
                taskDiv.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openEditModal(task);
                });
                tasksDiv.appendChild(taskDiv);
            }
        }
        card.appendChild(tasksDiv);

        // Весь день кликабелен для добавления (кроме клика по самой задаче)
        card.addEventListener('click', (e) => {
            // если клик был на taskDiv, уже обработано, не вызываем добавление
            if (e.target.closest('.task-item')) return;
            openCreateModal(dateStr);
        });

        fragment.appendChild(card);
    }
    strip.innerHTML = '';
    strip.appendChild(fragment);

    // Прокрутка к сегодня
    const todayCard = strip.querySelector('.day-card[data-date="'+todayStr+'"]');
    if (todayCard) {
        const offset = todayCard.offsetLeft - 30;
        strip.scrollLeft = Math.max(0, offset);
    }
}

// ========== Модальное окно ==========
function openCreateModal(defaultDate) {
    modalTitle.innerText = 'Новая задача';
    taskTitleInput.value = '';
    taskDescInput.value = '';
    taskDueDateInput.value = defaultDate || '';
    taskIdHidden.value = '';
    currentEditId = null;
    deleteBtn.style.display = 'none';
    modal.style.display = 'flex';
}

function openEditModal(task) {
    modalTitle.innerText = 'Редактировать задачу';
    taskTitleInput.value = task.title;
    taskDescInput.value = task.description || '';
    taskDueDateInput.value = task.due_date || '';
    taskIdHidden.value = task.id;
    currentEditId = task.id;
    deleteBtn.style.display = 'block';
    modal.style.display = 'flex';
}

function closeModal() {
    modal.style.display = 'none';
}

// ========== Прокрутка (Shift+колесо, drag, кнопки) ==========
function initWheelScroll() {
    strip.addEventListener('wheel', function(e) {
        if (e.shiftKey) {
            e.preventDefault();
            let delta = e.deltaY || e.deltaX;
            strip.scrollLeft += delta * 0.8;
        }
    }, { passive: false });
}

function initDragScroll() {
    strip.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isDragging = true;
        startX = e.pageX;
        startScrollLeft = strip.scrollLeft;
        strip.style.cursor = 'grabbing';
        e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        strip.scrollLeft = startScrollLeft - (e.pageX - startX);
    });
    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            strip.style.cursor = 'grab';
        }
    });
    strip.style.cursor = 'grab';
}

document.getElementById('scrollLeftBtn').addEventListener('click', () => {
    strip.scrollBy({ left: -280, behavior: 'smooth' });
});
document.getElementById('scrollRightBtn').addEventListener('click', () => {
    strip.scrollBy({ left: 280, behavior: 'smooth' });
});

// ========== Инициализация ==========
(async function init() {
    // await moveOverdueTasks();   // переносим просроченные задачи на сегодня
    await loadTasks();          // загружаем все задачи (уже с обновлёнными due_date)
    initWheelScroll();
    initDragScroll();
    saveBtn.addEventListener('click', saveTask);
    deleteBtn.addEventListener('click', deleteTask);
    cancelBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
})();