import React, { useEffect, useState } from 'react';
import { fetchTasks, createTask, updateTask, deleteTask } from './api';
import { Task } from './types';
import CalendarStrip from './components/CalendarStrip';
import TaskModal from './components/TaskModal';

const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalState, setModalState] = useState<{ isOpen: boolean; task?: Task | null; defaultDate?: string }>({
    isOpen: false,
  });

  const loadTasks = async () => {
    try {
      const data = await fetchTasks();
      setTasks(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleAddTask = (date: string) => {
    setModalState({ isOpen: true, task: null, defaultDate: date });
  };

  const handleEditTask = (task: Task) => {
    setModalState({ isOpen: true, task });
  };

  const handleSaveTask = async (taskData: Omit<Task, 'id'>) => {
    if (modalState.task) {
      // Update existing
      await updateTask(modalState.task.id, taskData);
    } else {
      // Create new
      await createTask(taskData);
    }
    await loadTasks();
    setModalState({ isOpen: false });
  };

  const handleDeleteTask = async () => {
    if (modalState.task) {
      await deleteTask(modalState.task.id);
      await loadTasks();
      setModalState({ isOpen: false });
    }
  };

  const closeModal = () => setModalState({ isOpen: false });

  if (loading) return <div className="calendar-main">Загрузка...</div>;

  return (
    <div className="calendar-main">
      <div className="calendar-header">
        <div className="title-section">
          <h1>Календарь задач</h1>
          <span className="semi-hidden-text">таск-менеджер на React</span>
        </div>
      </div>
      <CalendarStrip tasks={tasks} onAddTask={handleAddTask} onEditTask={handleEditTask} />
      <footer>
        Клик по дню – новая задача, по названию – редактировать.
      </footer>
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