import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchTasksRange, createTask, updateTask, deleteTask,
  syncDownload, syncUpload,
  fetchAllTags, fetchTaskTagsXTask,
  assignTagToTask, unassignTagFromTask, createTag,
  deleteTagGlobally, updateTag,
} from './api';
import { Task, CreateTaskDTO, UpdateTaskDTO, TaskTag } from './types';
import CalendarStrip, { CalendarStripRef } from './components/CalendarStrip';
import TaskModal from './components/TaskModal';
import TaskList from './components/TaskList';
import { ChevronLeft, ChevronRight, Home, Upload, Download } from 'lucide-react';
import TagManager from './components/TagManager';

const App: React.FC = () => {
  const calendarRef = useRef<CalendarStripRef>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const syncCounter = useRef(0);
  const [modalState, setModalState] = useState<{ isOpen: boolean; task?: Task | null; defaultDate?: string }>({
    isOpen: false,
  });

  // === Состояния для тегов ===
  const [allTags, setAllTags] = useState<TaskTag[]>([]);
  const [taskTagsMap, setTaskTagsMap] = useState<Map<number, TaskTag[]>>(new Map());
  const [filterTagId, setFilterTagId] = useState<number | null>(null);

  // === Вспомогательная функция синхронизации с индикатором ===
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

  // === Загрузка задач и тегов (чистая, без автоматической синхронизации) ===
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

  // === Инициализация: загружаем данные только один раз при старте (без синхронизации) ===
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
    ]).finally(() => setLoading(false));
  }, [loadTasksForRange, loadTagsData]);

  // === Предупреждение при попытке закрыть/перезагрузить страницу, если есть несохранённые изменения ===
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // === Обработчики для кнопок синхронизации ===
  const handleSaveToCloud = async () => {
    await performSync(syncUpload);
    setHasUnsavedChanges(false); // после успешного сохранения сбрасываем флаг
  };

  const handleLoadFromCloud = async () => {
    await performSync(syncDownload);
    // После загрузки обновляем все данные
    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() - 30);
    const to = new Date(today);
    to.setDate(today.getDate() + 30);
    const fromStr = formatLocalDate(from);
    const toStr = formatLocalDate(to);
    await Promise.all([
      loadTasksForRange(fromStr, toStr),
      loadTagsData(),
    ]);
    setHasUnsavedChanges(false); // синхронизировано
  };

  // === Остальные обработчики (устанавливают флаг hasUnsavedChanges) ===
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
      setHasUnsavedChanges(true);
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
      setHasUnsavedChanges(true);
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (window.confirm('Удалить задачу?')) {
      await deleteTask(taskId);
      setTasks(prev => prev.filter(t => t.task_id !== taskId));
      if (modalState.task?.task_id === taskId) {
        setModalState({ isOpen: false });
      }
      setHasUnsavedChanges(true);
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
    setHasUnsavedChanges(true);
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
    setHasUnsavedChanges(true);
  };

  const closeModal = () => setModalState({ isOpen: false });

  // Назначение / удаление тегов (также помечаем как изменения)
  const handleAssignTag = useCallback(async (taskId: number, tagId: number) => {
    await assignTagToTask(tagId, taskId);
    await refreshTagsForTask(taskId);
    setHasUnsavedChanges(true);
  }, []);

  const handleRemoveTagFromTask = useCallback(async (taskId: number, tagId: number) => {
    await unassignTagFromTask(tagId, taskId);
    await refreshTagsForTask(taskId);
    setHasUnsavedChanges(true);
  }, []);

  const handleCreateTag = useCallback(async (tagText: string, tagColor: string) => {
    await createTag(tagText, tagColor);
    await loadTagsData();
    setHasUnsavedChanges(true);
  }, [loadTagsData]);

  const handleUpdateTag = useCallback(async (tagId: number, text: string, color: string) => {
    await updateTag(tagId, text, color);
    await loadTagsData(); // перезагружаем теги и связи
    setHasUnsavedChanges(true);
  }, [loadTagsData]);

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

  if (loading) return <div className="calendar-main">Загрузка...</div>;

  const filteredTasks = filterTagId
    ? tasks.filter(task => (taskTagsMap.get(task.task_id) || []).some(tag => tag.task_tag_id === filterTagId))
    : tasks;

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
          onDeleteTagGlobally={deleteTagGlobally}
          onUpdateTag={handleUpdateTag}
        />
        <TaskList
          tasks={filteredTasks}
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
      <div className="fixed-buttons">
        <button className="sync-btn" onClick={handleSaveToCloud} title="Сохранить в облако">
          <Upload size={20} />
        </button>
        <button className="sync-btn" onClick={handleLoadFromCloud} title="Загрузить из облака">
          <Download size={20} />
        </button>
        <button className="today-btn-fixed" onClick={scrollToToday} title="Перейти к сегодняшнему дню">
          <Home size={20} />
        </button>
      </div>
      {syncing && <div className="sync-toast">🔄 Синхронизация с облаком...</div>}
      {hasUnsavedChanges && !syncing && (
        <div className="unsaved-toast">
          ⚠️ Есть несохранённые изменения
          <button onClick={handleSaveToCloud} className="unsaved-save-btn">
            Сохранить
          </button>
        </div>
      )}
    </>
  );
};

export default App;