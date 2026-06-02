import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchTasksRange, createTask, updateTask, deleteTask, syncDownload, syncUpload } from './api';
import { Task, CreateTaskDTO, UpdateTaskDTO } from './types';
import CalendarStrip, { CalendarStripRef } from './components/CalendarStrip';
import TaskModal from './components/TaskModal';
import TaskList from './components/TaskList';
import { ChevronLeft, ChevronRight, Home } from 'lucide-react';

const App: React.FC = () => {
  const calendarRef = useRef<CalendarStripRef>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const syncCounter = useRef(0);
  const [modalState, setModalState] = useState<{ isOpen: boolean; task?: Task | null; defaultDate?: string }>({
    isOpen: false,
  });

  // Функция для выполнения синхронизации с облаком (с индикатором)
  const performSync = useCallback(async (syncFn: () => Promise<void>) => {
    syncCounter.current++;
    if (syncCounter.current === 1) setSyncing(true);
    try {
      await syncFn();
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      syncCounter.current--;
      if (syncCounter.current === 0) setSyncing(false);
    }
  }, []);

  const loadTasksForRange = useCallback(async (from: string, to: string) => {
    try {
      const newTasks = await fetchTasksRange(from, to);
      setTasks(prev => {
        const existingIds = new Set(prev.map(t => t.task_id));
        const uniqueNew = newTasks.filter(t => !existingIds.has(t.task_id));
        return [...prev, ...uniqueNew];
      });
      return newTasks;
    } catch (err) {
      console.error('Failed to load range', err);
      return [];
    }
  }, []);

  const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const scrollToToday = () => {
    const today = new Date();
    const todayStr = formatLocalDate(today);
    calendarRef.current?.scrollToDate(todayStr);
  };

  // Загрузка при старте + синхронизация (скачивание)
  useEffect(() => {
    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() - 30);
    const to = new Date(today);
    to.setDate(today.getDate() + 30);
    const fromStr = formatLocalDate(from);
    const toStr = formatLocalDate(to);

    loadTasksForRange(fromStr, toStr)
      .then(() => performSync(syncDownload))
      .then(() => loadTasksForRange(fromStr, toStr))
      .finally(() => setLoading(false));
  }, [loadTasksForRange, performSync]);

  const handleAddTask = (date: string) => {
    setModalState({ isOpen: true, task: null, defaultDate: date });
  };

  const handleEditTask = (task: Task) => {
    setModalState({ isOpen: true, task });
  };

  const handleTaskClickFromList = (task: Task) => {
    if (task.due_date) {
      calendarRef.current?.scrollToDate(task.due_date, task.task_id);
    }
    // handleEditTask(task); // не открываем меню редактирования при клике на таску в списке
  };

  const handleSaveTask = async (taskData: Omit<Task, 'task_id'>) => {
    if (modalState.task) {
      const updateDto: UpdateTaskDTO = {
        task_id: modalState.task.task_id,
        title: taskData.title ?? undefined,
        description: taskData.description ?? undefined,
        link_to_taskmanager: taskData.link_to_taskmanager ?? undefined,
        due_date: taskData.due_date ?? undefined,
        task_status: taskData.task_status ?? undefined,
      };
      await updateTask(modalState.task.task_id, updateDto);
      setTasks(prev => prev.map(t => t.task_id === modalState.task!.task_id ? { ...t, ...taskData } : t));
      setModalState({ isOpen: false });
      await performSync(syncUpload);
    } else {
      const createDto: CreateTaskDTO = {
        title: taskData.title,
        description: taskData.description ?? null,
        link_to_taskmanager: taskData.link_to_taskmanager ?? null,
        due_date: taskData.due_date ?? undefined,
        task_status: taskData.task_status ?? null,
      };
      await createTask(createDto);
      const today = new Date();
      const from = new Date(today);
      from.setDate(today.getDate() - 30);
      const to = new Date(today);
      to.setDate(today.getDate() + 30);
      await loadTasksForRange(formatLocalDate(from), formatLocalDate(to));
      setModalState({ isOpen: false });
      await performSync(syncUpload);
    }
    setModalState({ isOpen: false });
  };

  const handleDeleteTask = async (taskId: number) => {
    if (window.confirm('Удалить задачу?')) {
      await deleteTask(taskId);
      setTasks(prev => prev.filter(t => t.task_id !== taskId));
      // Если открыта модалка именно с этой задачей — закрываем её
      if (modalState.task?.task_id === taskId) {
        setModalState({ isOpen: false });
      }
      await performSync(syncUpload);
    }
  };

  const handleMoveTask = async (taskId: number, newDueDate: string) => {
    const taskToUpdate = tasks.find(t => t.task_id === taskId);
    if (!taskToUpdate) return;
    const updateDto: UpdateTaskDTO = {
      task_id: taskId,
      title: taskToUpdate.title,
      description: taskToUpdate.description,
      link_to_taskmanager: taskToUpdate.link_to_taskmanager,
      due_date: newDueDate,
      task_status: taskToUpdate.task_status,
    };
    await updateTask(taskId, updateDto);
    setTasks(prev => prev.map(t => t.task_id === taskId ? { ...t, due_date: newDueDate } : t));
    await performSync(syncUpload);
  };

  const handleToggleStatus = async (taskId: number, newStatus: number) => {
    const taskToUpdate = tasks.find(t => t.task_id === taskId);
    if (!taskToUpdate) return;
    const updateDto: UpdateTaskDTO = {
      task_id: taskId,
      title: taskToUpdate.title,
      description: taskToUpdate.description,
      link_to_taskmanager: taskToUpdate.link_to_taskmanager,
      due_date: taskToUpdate.due_date,
      task_status: newStatus,
    };
    await updateTask(taskId, updateDto);
    setTasks(prev => prev.map(t => t.task_id === taskId ? { ...t, task_status: newStatus } : t));
    await performSync(syncUpload);
  };

  const closeModal = () => setModalState({ isOpen: false });

  if (loading) return <div className="calendar-main">Загрузка...</div>;

  return (
    <>
    <div className="calendar-main">
      <div className="calendar-header">
        <div className="title-section">
          <h1>Календарь задач</h1>
          {/* <span className="semi-hidden-text">таск-менеджер на React</span> */}
        </div>
        <div className="nav-buttons">
          <button className="nav-btn" onClick={() => calendarRef.current?.scrollLeft()}>
            <ChevronLeft size={20} />
          </button>
          <button className="nav-btn" onClick={() => calendarRef.current?.scrollRight()}>
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
      <CalendarStrip
        ref={calendarRef}
        tasks={tasks}
        onAddTask={handleAddTask}
        onEditTask={handleEditTask}
        onMoveTask={handleMoveTask}
        onLoadRange={loadTasksForRange}
        onToggleStatus={handleToggleStatus}
      />
      <TaskList
        tasks={tasks}
        onTaskClick={handleTaskClickFromList}
        onToggleStatus={handleToggleStatus}
        onEditTask={handleEditTask}
        onDeleteTask={(task) => handleDeleteTask(task.task_id)}
      />
      <footer>
        Клик по дню – новая задача, по названию – редактировать.
      </footer>
      <TaskModal
        isOpen={modalState.isOpen}
        task={modalState.task || undefined}
        defaultDate={modalState.defaultDate}
        onSave={handleSaveTask}
        onDelete={() => {
          if (modalState.task) handleDeleteTask(modalState.task.task_id);
        }}
        onClose={closeModal}
      />
    </div>
    <button
      className="today-btn-fixed"
      onClick={scrollToToday}
      title="Перейти к сегодняшнему дню"
    >
      <Home size={20} />
    </button>
    {syncing && <div className="sync-toast">🔄 Синхронизация с облаком...</div>}
    </>
  );
};

export default App;