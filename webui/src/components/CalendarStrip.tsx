import /* React, */ {
  useRef,
  useEffect,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';

import DayCard from './DayCard';
import { Task } from '../types';
import './CalendarStrip.css';

const INITIAL_DAYS_BEFORE = 7;
const INITIAL_DAYS_AFTER = 7;
const SCROLL_THRESHOLD = 200;
const LOAD_MORE_DAYS = 7;

function getTodayDate(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const res = new Date(date);
  res.setDate(res.getDate() + days);
  return res;
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface Props {
  tasks: Task[];
  onAddTask: (date: string) => void;
  onEditTask: (task: Task) => void;
  onMoveTask: (taskId: number, newDueDate: string) => void;
  onLoadRange: (from: string, to: string) => Promise<Task[]>;
  onToggleStatus: (taskId: number, newStatus: number) => void;
}
export interface CalendarStripRef {
  scrollToDate: (dateStr: string, taskId?: number) => void;
}

const CalendarStrip = forwardRef<CalendarStripRef, Props>(({
  tasks,
  onAddTask,
  onEditTask,
  onMoveTask,
  onLoadRange,
  onToggleStatus,
}, ref) => {
  const [dates, setDates] = useState<Date[]>([]);
  const [loadedDateKeys, setLoadedDateKeys] = useState<Set<string>>(new Set());
  const [highlightedTaskId, setHighlightedTaskId] = useState<number | null>(null);
  
  const stripRef = useRef<HTMLDivElement>(null);
  const datesRef = useRef<Date[]>([]);

  const isLoadingLeft = useRef(false);
  const isLoadingRight = useRef(false);
  const initialized = useRef(false);
  const lastLeftLoadTime = useRef(0);
  const initialAutoScrollLock = useRef(true);

  const todayStr = formatLocalDate(getTodayDate());


  useEffect(() => {
    datesRef.current = dates;
  }, [dates]);

  // =========================
  // INITIAL LOAD
  // =========================
  useEffect(() => {
    if (initialized.current) return;

    const today = getTodayDate();
    const start = addDays(today, -INITIAL_DAYS_BEFORE);
    const end = addDays(today, INITIAL_DAYS_BEFORE + INITIAL_DAYS_AFTER);

    const newDates: Date[] = [];
    let cur = new Date(start);
    while (cur <= end) {
      newDates.push(new Date(cur));
      cur = addDays(cur, 1);
    }

    setDates(newDates);
    setLoadedDateKeys(new Set(newDates.map((d) => formatLocalDate(d))));
    onLoadRange(formatLocalDate(start), formatLocalDate(end));

    initialized.current = true;
  }, [onLoadRange]);

  // Плавная прокрутка к сегодняшнему дню
  useEffect(() => {
    if (dates.length === 0 || !stripRef.current) return;

    const strip = stripRef.current;
    const todayCard = strip.querySelector(`[data-date="${todayStr}"]`) as HTMLElement | null;
    if (!todayCard) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        strip.scrollTo({
          left: Math.max(0, todayCard.offsetLeft - 46),
          behavior: 'smooth',
        });
        setTimeout(() => {
          initialAutoScrollLock.current = false;
        }, 700);
      });
    });
  }, [dates, todayStr]);

  // =========================
  // LOAD LEFT
  // =========================
  const loadMoreLeft = useCallback(async () => {
    const currentDates = datesRef.current;
    if (isLoadingLeft.current || currentDates.length === 0) return;
    isLoadingLeft.current = true;

    const firstDate = currentDates[0];
    const newFirst = addDays(firstDate, -LOAD_MORE_DAYS);
    const newDates: Date[] = [];
    let cur = new Date(newFirst);
    while (cur < firstDate) {
      newDates.push(new Date(cur));
      cur = addDays(cur, 1);
    }

    setDates((prev) => [...newDates, ...prev]);
    setLoadedDateKeys((prev) => {
      const next = new Set(prev);
      newDates.forEach((d) => next.add(formatLocalDate(d)));
      return next;
    });

    const fromKey = formatLocalDate(newFirst);
    const toKey = formatLocalDate(addDays(firstDate, -1));
    await onLoadRange(fromKey, toKey);

    if (stripRef.current) {
      stripRef.current.scrollLeft = SCROLL_THRESHOLD + 20;
    }
    isLoadingLeft.current = false;
  }, [onLoadRange]);

  // =========================
  // LOAD RIGHT
  // =========================
  const loadMoreRight = useCallback(async () => {
    const currentDates = datesRef.current;
    if (isLoadingRight.current || currentDates.length === 0) return;
    isLoadingRight.current = true;

    const lastDate = currentDates[currentDates.length - 1];
    const newLast = addDays(lastDate, LOAD_MORE_DAYS);
    const newDates: Date[] = [];
    let cur = addDays(lastDate, 1);
    while (cur <= newLast) {
      newDates.push(new Date(cur));
      cur = addDays(cur, 1);
    }

    setDates((prev) => [...prev, ...newDates]);
    setLoadedDateKeys((prev) => {
      const next = new Set(prev);
      newDates.forEach((d) => next.add(formatLocalDate(d)));
      return next;
    });

    const fromKey = formatLocalDate(addDays(lastDate, 1));
    const toKey = formatLocalDate(newLast);
    await onLoadRange(fromKey, toKey);

    isLoadingRight.current = false;
  }, [onLoadRange]);

  // =========================
  // SCROLL HANDLER
  // =========================
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;

    const handleScroll = () => {
      if (initialAutoScrollLock.current) return;
      const { scrollLeft, scrollWidth, clientWidth } = strip;
      if (scrollWidth <= clientWidth) return;
      const now = Date.now();

      if (!isLoadingLeft.current && scrollLeft <= SCROLL_THRESHOLD && now - lastLeftLoadTime.current > 300) {
        lastLeftLoadTime.current = now;
        loadMoreLeft();
        return;
      }
      if (!isLoadingRight.current && scrollLeft + clientWidth >= scrollWidth - SCROLL_THRESHOLD) {
        loadMoreRight();
      }
    };

    strip.addEventListener('scroll', handleScroll);
    return () => strip.removeEventListener('scroll', handleScroll);
  }, [loadMoreLeft, loadMoreRight]);

  // =========================
  // DRAG SCROLL + WHEEL
  // =========================
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.shiftKey) {
        e.preventDefault();
        strip.scrollLeft += e.deltaY * 2.5;
      } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        strip.scrollLeft += e.deltaX;
      }
    };
    strip.addEventListener('wheel', handleWheel, { passive: false });

    let isDragging = false;
    let startX = 0;
    let startScrollLeft = 0;
    const handleMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.task-item')) return;
      if (e.button !== 0) return;
      isDragging = true;
      startX = e.pageX;
      startScrollLeft = strip.scrollLeft;
      strip.style.cursor = 'grabbing';
      e.preventDefault();
    };
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      strip.scrollLeft = startScrollLeft - (e.pageX - startX);
    };
    const handleMouseUp = () => {
      if (!isDragging) return;
      isDragging = false;
      strip.style.cursor = 'grab';
    };

    strip.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    strip.style.cursor = 'grab';

    return () => {
      strip.removeEventListener('wheel', handleWheel);
      strip.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const navigateToDate = useCallback((dateStr: string) => {
    if (!stripRef.current) return;
    const targetCard = stripRef.current.querySelector(`[data-date="${dateStr}"]`) as HTMLElement | null;
    if (targetCard) {
      stripRef.current.scrollTo({
        left: Math.max(0, targetCard.offsetLeft - 24),
        behavior: 'smooth',
      });
    }
  }, []);

  // =========================
  // TASK GROUPING
  // =========================
  // Группировка задач с созданием призраков
  const groupTasksByDate = (): Map<string, any[]> => { // используем any[] для упрощения, можно определить расширенный тип
    const map = new Map<string, any[]>();
    const today = getTodayDate();
    const todayKey = formatLocalDate(today);
    
    for (const task of tasks) {
      let originalKey = '';
      if (task.due_date) {
        originalKey = task.due_date.slice(0, 10);
      }
      const isActive = task.task_status === 1;
      let isOverdue = false;
      if (originalKey && isActive) {
        const parts = originalKey.split('-');
        const dueDateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        isOverdue = dueDateObj < today;
      }
      
      // Основная дата отображения (сегодня, если просрочена и активна, иначе due_date)
      const targetKey = (isActive && isOverdue) ? todayKey : originalKey;
      
      // Добавляем основную задачу (не призрак)
      if (loadedDateKeys.has(targetKey) || targetKey === '') {
        if (!map.has(targetKey)) map.set(targetKey, []);
        map.get(targetKey)!.push({ ...task, isGhost: false });
      }
      
      // Если задача активна, просрочена и имеет оригинальную дату, отличную от todayKey – создаём призрака в originalKey
      if (isActive && isOverdue && originalKey && originalKey !== targetKey && loadedDateKeys.has(originalKey)) {
        if (!map.has(originalKey)) map.set(originalKey, []);
        map.get(originalKey)!.push({
          ...task,
          isGhost: true,
          ghostTargetDate: targetKey, // куда прокрутить при клике (сегодняшний день)
        });
      }
    }
    return map;
  };

  const taskMap = groupTasksByDate();

  // =========================
  // EXPOSE METHOD TO PARENT
  // =========================
  useImperativeHandle(ref, () => ({
    scrollToDate: (dateStr: string, taskId?: number) => {
      if (!stripRef.current) return;
      const targetCard = stripRef.current.querySelector(`[data-date="${dateStr}"]`) as HTMLElement | null;
      if (targetCard) {
        stripRef.current.scrollTo({
          left: Math.max(0, targetCard.offsetLeft - 24),
          behavior: 'smooth',
        });
        if (taskId !== undefined) {
          // Даём время на прокрутку
          setTimeout(() => {
            setHighlightedTaskId(taskId);
            setTimeout(() => setHighlightedTaskId(null), 2000);
          }, 300);
        }
      }
    },
  }));

  return (
    <>
      <div className="calendar-header" style={{ justifyContent: 'space-between' }}>
        <div />
        <div className="nav-buttons">
          <button className="nav-btn" onClick={() => stripRef.current && (stripRef.current.scrollLeft -= 280)}>⬅️</button>
          <button className="nav-btn" onClick={() => stripRef.current && (stripRef.current.scrollLeft += 280)}>➡️</button>
        </div>
      </div>
      <div className="strip-wrapper">
        <div className="calendar-strip" ref={stripRef}>
          {dates.map((date) => {
            const dateStr = formatLocalDate(date);
            const tasksForDay = [...(taskMap.get(dateStr) || [])];
            return (
              <DayCard
                key={dateStr}
                date={date}
                tasks={tasksForDay}
                isToday={dateStr === todayStr}
                onAddTask={() => onAddTask(dateStr)}
                onEditTask={onEditTask}
                onMoveTask={onMoveTask}
                onToggleStatus={onToggleStatus}
                onGhostClick={navigateToDate}
                dateStr={dateStr}
                highlightedTaskId={highlightedTaskId}
              />
            );
          })}
        </div>
      </div>
    </>
  );
});

export default CalendarStrip;