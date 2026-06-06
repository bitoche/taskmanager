import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchTasksRange, createTask, updateTask, deleteTask,
  syncDownload, syncUpload,
  fetchAllTags, fetchTaskTagsXTask,
  assignTagToTask, unassignTagFromTask, createTag,
  deleteTagGlobally,
} from './api';
import { Task, CreateTaskDTO, UpdateTaskDTO, TaskTag } from './types'; // TaskComment удалён
import CalendarStrip, { CalendarStripRef } from './components/CalendarStrip';
import TaskModal from './components/TaskModal';
import TaskList from './components/TaskList';
import { ChevronLeft, ChevronRight, Home } from 'lucide-react';
import TagManager from './components/TagManager';


const App: React.FC = () => {
  const calendarRef = useRef<CalendarStripRef>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const syncCounter = useRef(0);
  const [modalState, setModalState] = useState<{ isOpen: boolean; task?: Task | null; defaultDate?: string }>({
    isOpen: false,
  });

  // === Состояния для тегов ===
  const [allTags, setAllTags] = useState<TaskTag[]>([]);
  const [taskTagsMap, setTaskTagsMap] = useState<Map<number, TaskTag[]>>(new Map());

  // Загрузка тегов и связей
  const loadTagsData = useCallback(async () => {
    try {
      const tags = await fetchAllTags();
      const assignments = await fetchTaskTagsXTask();
      const map = new Map<number, TaskTag[]>();
      for (const a of assignments) {
        const tag = tags.find(t => t.task_tag_id === a.task_tag_id);
        if (tag) {
          if (!map.has(a.task_id)) map.set(a.task_id, []);
          map.get(a.task_id)!.push(tag);
        }
      }
      setAllTags(tags);
      setTaskTagsMap(map);
    } catch (err) {
      console.error('Failed to load tags data', err);
    }
  }, []);

  // Обновление тегов для одной задачи (после изменения)
  const refreshTagsForTask = useCallback(async (taskId: number) => {
    try {
      const assignments = await fetchTaskTagsXTask();
      const tags = await fetchAllTags();
      const taskTags = assignments
        .filter(a => a.task_id === taskId)
        .map(a => tags.find(t => t.task_tag_id === a.task_tag_id))
        .filter((t): t is TaskTag => t !== undefined);
      setTaskTagsMap(prev => new Map(prev).set(taskId, taskTags));
    } catch (err) {
      console.error('Failed to refresh tags for task', err);
    }
  }, []);

  // Назначение тега задаче
  const handleAssignTag = useCallback(async (taskId: number, tagId: number) => {
    await assignTagToTask(tagId, taskId);
    await refreshTagsForTask(taskId);
  }, [refreshTagsForTask]);

  // Удаление тега с задачи
  const handleRemoveTagFromTask = useCallback(async (taskId: number, tagId: number) => {
    await unassignTagFromTask(tagId, taskId);
    await refreshTagsForTask(taskId);
  }, [refreshTagsForTask]);

  // Создание нового тега
  const handleCreateTag = useCallback(async (tagText: string, tagColor: string) => {
    await createTag(tagText, tagColor);
    await loadTagsData(); // перезагружаем все теги
  }, [loadTagsData]);

  // === Синхронизация ===
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

  // Инициализация
  useEffect(() => {
    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() - 30);
    const to = new Date(today);
    to.setDate(today.getDate() + 30);
    const fromStr = formatLocalDate(from);
    const toStr = formatLocalDate(to);

    Promise.all([
      loadTasksForRange(fromStr, toStr),
      loadTagsData(),
    ])
      .then(() => performSync(syncDownload))
      .then(() => loadTasksForRange(fromStr, toStr))
      .finally(() => setLoading(false));
  }, [loadTasksForRange, loadTagsData, performSync]);

  // Обработчики задач
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
  };

  const handleDeleteTask = async (taskId: number) => {
    if (window.confirm('Удалить задачу?')) {
      await deleteTask(taskId);
      setTasks(prev => prev.filter(t => t.task_id !== taskId));
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

  const [filterTagId, setFilterTagId] = useState<number | null>(null);
  const filteredTasks = filterTagId 
    ? tasks.filter(task => (taskTagsMap.get(task.task_id) || []).some(tag => tag.task_tag_id === filterTagId))
    : tasks;

  if (loading) return <div className="calendar-main">Загрузка...</div>;
  
  return (
    <>
      <div className="calendar-main">
        <div className="calendar-header">
          <div className="title-section">
            <h1>Календарь задач</h1>
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
          tasks={filteredTasks}
          onAddTask={handleAddTask}
          onEditTask={handleEditTask}
          onMoveTask={handleMoveTask}
          onLoadRange={loadTasksForRange}
          onToggleStatus={handleToggleStatus}
          taskTagsMap={taskTagsMap}
          onRemoveTag={handleRemoveTagFromTask}
        />
        <TagManager
          allTags={allTags}
          onCreateTag={handleCreateTag}
          onFilterByTag={setFilterTagId}
          activeFilterTagId={filterTagId}
          onDeleteTagGlobally={deleteTagGlobally} // при наличии эндпоинта
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
          onDelete={() => { if (modalState.task) handleDeleteTask(modalState.task.task_id); }}
          onClose={closeModal}
          allTags={allTags}
          taskTags={modalState.task ? taskTagsMap.get(modalState.task.task_id) || [] : []}
          onAssignTag={(tagId) => modalState.task && handleAssignTag(modalState.task.task_id, tagId)}
          onRemoveTag={(tagId) => modalState.task && handleRemoveTagFromTask(modalState.task.task_id, tagId)}
          onCreateTag={handleCreateTag}
        />
      </div>
      <button className="today-btn-fixed" onClick={scrollToToday} title="Перейти к сегодняшнему дню">
        <Home size={20} />
      </button>
      {syncing && <div className="sync-toast">🔄 Синхронизация с облаком...</div>}
    </>
  );
};

export default App;