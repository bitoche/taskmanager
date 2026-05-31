import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchTasksRange, createTask, updateTask, deleteTask } from './api';
import { Task, CreateTaskDTO, UpdateTaskDTO } from './types';
import CalendarStrip, { CalendarStripRef } from './components/CalendarStrip';
import TaskModal from './components/TaskModal';
import TaskList from './components/TaskList';

const App: React.FC = () => {
  const calendarRef = useRef<CalendarStripRef>(null);
  const handleTaskClickFromList = (task: Task) => {
    if (task.due_date) {
      calendarRef.current?.scrollToDate(task.due_date);
    }
    handleEditTask(task);
  };
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalState, setModalState] = useState<{ isOpen: boolean; task?: Task | null; defaultDate?: string }>({
    isOpen: false,
  });

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

  useEffect(() => {
    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() - 30);
    const to = new Date(today);
    to.setDate(today.getDate() + 30);
    loadTasksForRange(formatLocalDate(from), formatLocalDate(to))
      .finally(() => setLoading(false));
  }, [loadTasksForRange]);

  const handleAddTask = (date: string) => {
    setModalState({ isOpen: true, task: null, defaultDate: date });
  };

  const handleEditTask = (task: Task) => {
    setModalState({ isOpen: true, task });
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
    }
    setModalState({ isOpen: false });
  };

  const handleDeleteTask = async () => {
    if (modalState.task) {
      await deleteTask(modalState.task.task_id);
      setTasks(prev => prev.filter(t => t.task_id !== modalState.task!.task_id));
      setModalState({ isOpen: false });
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
  };

  const closeModal = () => setModalState({ isOpen: false });

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
  };

  if (loading) return <div className="calendar-main">Загрузка...</div>;

  return (
    <div className="calendar-main">
      <div className="calendar-header">
        <div className="title-section">
          <h1>Календарь задач</h1>
          <span className="semi-hidden-text">таск-менеджер на React</span>
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
      <footer>
        Клик по дню – новая задача, по названию – редактировать.
      </footer>
      <TaskList
        tasks={tasks}
        onTaskClick={handleTaskClickFromList}
        onToggleStatus={handleToggleStatus}
      />
      <TaskModal
        isOpen={modalState.isOpen}
        task={modalState.task || undefined}
        defaultDate={modalState.defaultDate}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
        onClose={closeModal}
      />
    </div>
  );
};

export default App;