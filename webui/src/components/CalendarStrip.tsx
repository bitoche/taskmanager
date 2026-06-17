import {
  useRef,
  useEffect,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';

import DayCard from './DayCard';
import { Task, TaskTag } from '../types';
import { getDaysInfo, getLocalWeekends } from '../holidays';
import './CalendarStrip.css';

const INITIAL_DAYS_BEFORE = 7;
const INITIAL_DAYS_AFTER = 23;
const LOAD_MORE_DAYS = 30;

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
  taskTagsMap?: Map<number, TaskTag[]>;
  onRemoveTag?: (taskId: number, tagId: number) => void;
  onHolidaysLoadingChange?: (loading: boolean) => void; // callback для тоста
}

export interface CalendarStripRef {
  scrollToDate: (dateStr: string, taskId?: number) => void;
  scrollLeft: () => void;
  scrollRight: () => void;
}

const CalendarStrip = forwardRef<CalendarStripRef, Props>(({
  tasks,
  onAddTask,
  onEditTask,
  onMoveTask,
  onLoadRange,
  onToggleStatus,
  taskTagsMap,
  onRemoveTag,
  onHolidaysLoadingChange,
  // onAssignTag, allTags, onCreateTag – удалены, т.к. не используются
}, ref) => {
  const [dates, setDates] = useState<Date[]>([]);
  const [loadedDateKeys, setLoadedDateKeys] = useState<Set<string>>(new Set());
  const [highlightedTaskId, setHighlightedTaskId] = useState<number | null>(null);
  const [loadingLeft, setLoadingLeft] = useState(false);
  const [loadingRight, setLoadingRight] = useState(false);
  const [daysOffMap, setDaysOffMap] = useState<Map<string, boolean>>(new Map());
  
  const stripRef = useRef<HTMLDivElement>(null);
  const datesRef = useRef<Date[]>([]);

  const initialized = useRef(false);

  const todayStr = formatLocalDate(getTodayDate());

  useEffect(() => {
    datesRef.current = dates;
  }, [dates]);

  // =========================
  // INITIAL LOAD (30 дней)
  // =========================
  useEffect(() => {
    if (initialized.current) return;

    const today = getTodayDate();
    const start = addDays(today, -INITIAL_DAYS_BEFORE);
    const end = addDays(today, INITIAL_DAYS_AFTER);

    const newDates: Date[] = [];
    let cur = new Date(start);
    while (cur <= end) {
      newDates.push(new Date(cur));
      cur = addDays(cur, 1);
    }

    setDates(newDates);
    setLoadedDateKeys(new Set(newDates.map((d) => formatLocalDate(d))));
    onLoadRange(formatLocalDate(start), formatLocalDate(end));

    // Сначала загружаем локальные выходные (суббота, воскресенье)
    const localWeekends = getLocalWeekends(start, end);
    setDaysOffMap(localWeekends);
    
    // Показываем индикатор загрузки праздников
    onHolidaysLoadingChange?.(true);
    
    // Загружаем информацию о выходных/праздниках через API
    getDaysInfo(start, end).then(map => {
      // Объединяем: API данные + локальные выходные (если API не вернул данные)
      setDaysOffMap(prev => {
        const merged = new Map(prev);
        map.forEach((isDayOff, dateStr) => {
          merged.set(dateStr, isDayOff);
        });
        return merged;
      });
      onHolidaysLoadingChange?.(false);
    }).catch(err => {
      console.error('Failed to load holidays:', err);
      onHolidaysLoadingChange?.(false);
    });

    initialized.current = true;
  }, [onLoadRange, onHolidaysLoadingChange]);

  // Прокрутка к сегодняшнему дню (после загрузки данных)
  useEffect(() => {
    if (dates.length === 0 || !stripRef.current) return;

    const strip = stripRef.current;
    const todayCard = strip.querySelector(`[data-date="${todayStr}"]`) as HTMLElement | null;
    if (!todayCard) return;

    // Даём время на рендер и применяем прокрутку
    setTimeout(() => {
      strip.scrollTo({
        left: Math.max(0, todayCard.offsetLeft - 46),
        behavior: 'smooth',
      });
    }, 100);
  }, [dates, todayStr]);

  // =========================
  // LOAD LEFT
  // =========================
  const handleLoadLeft = useCallback(async () => {
    if (loadingLeft || dates.length === 0) return;
    setLoadingLeft(true);
    
    const firstDate = dates[0];
    const newFirst = addDays(firstDate, -LOAD_MORE_DAYS);
    const newDates: Date[] = [];
    let cur = new Date(newFirst);
    while (cur < firstDate) {
      newDates.push(new Date(cur));
      cur = addDays(cur, 1);
    }

    const oldScrollLeft = stripRef.current?.scrollLeft || 0;
    const cardWidth = 256;
    const addedWidth = newDates.length * cardWidth;

    setDates((prev) => [...newDates, ...prev]);
    
    setLoadedDateKeys((prev) => {
      const next = new Set(prev);
      newDates.forEach((d) => next.add(formatLocalDate(d)));
      return next;
    });

    const fromKey = formatLocalDate(newFirst);
    const toKey = formatLocalDate(addDays(firstDate, -1));
    await onLoadRange(fromKey, toKey);

    // Загружаем информацию о выходных/праздниках для нового диапазона
    onHolidaysLoadingChange?.(true);
    getDaysInfo(newFirst, firstDate).then(map => {
      setDaysOffMap(prev => new Map([...prev, ...map]));
      onHolidaysLoadingChange?.(false);
    }).catch(err => {
      console.error('Failed to load holidays:', err);
      onHolidaysLoadingChange?.(false);
    });

    if (stripRef.current) {
      stripRef.current.scrollLeft = oldScrollLeft + addedWidth;
    }
    
    setLoadingLeft(false);
  }, [dates, onLoadRange, loadingLeft]);

  // =========================
  // LOAD RIGHT
  // =========================
  const handleLoadRight = useCallback(async () => {
    if (loadingRight || dates.length === 0) return;
    setLoadingRight(true);
    
    const lastDate = dates[dates.length - 1];
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
    
    // Загружаем информацию о выходных/праздниках для нового диапазона
    onHolidaysLoadingChange?.(true);
    getDaysInfo(lastDate, newLast).then(map => {
      setDaysOffMap(prev => new Map([...prev, ...map]));
      onHolidaysLoadingChange?.(false);
    }).catch(err => {
      console.error('Failed to load holidays:', err);
      onHolidaysLoadingChange?.(false);
    });
    
    setLoadingRight(false);
  }, [dates, onLoadRange, loadingRight]);

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
        left: Math.max(0, targetCard.offsetLeft - 46),
        behavior: 'smooth',
      });
    }
  }, []);

  // =========================
  // TASK GROUPING
  // =========================
  const groupTasksByDate = (): Map<string, any[]> => {
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
      
      const targetKey = (isActive && isOverdue) ? todayKey : originalKey;
      
      if (loadedDateKeys.has(targetKey) || targetKey === '') {
        if (!map.has(targetKey)) map.set(targetKey, []);
        map.get(targetKey)!.push({ ...task, isGhost: false });
      }
      
      if (isActive && isOverdue && originalKey && originalKey !== targetKey && loadedDateKeys.has(originalKey)) {
        if (!map.has(originalKey)) map.set(originalKey, []);
        map.get(originalKey)!.push({
          ...task,
          isGhost: true,
          ghostTargetDate: targetKey,
        });
      }
    }
    return map;
  };

  const taskMap = groupTasksByDate();

  // =========================
  // EXPOSE METHODS
  // =========================
  useImperativeHandle(ref, () => ({
    scrollToDate: (dateStr: string, taskId?: number) => {
      if (!stripRef.current) return;
      const targetCard = stripRef.current.querySelector(`[data-date="${dateStr}"]`) as HTMLElement | null;
      if (targetCard) {
        stripRef.current.scrollTo({
          left: Math.max(0, targetCard.offsetLeft - 46),
          behavior: 'smooth',
        });
        if (taskId !== undefined) {
          setTimeout(() => {
            setHighlightedTaskId(taskId);
            setTimeout(() => setHighlightedTaskId(null), 2000);
          }, 300);
        }
      }
    },
    scrollLeft: () => {
      if (stripRef.current) stripRef.current.scrollLeft -= 280;
    },
    scrollRight: () => {
      if (stripRef.current) stripRef.current.scrollLeft += 280;
    },
  }));

  return (
    <>
      <div className="strip-wrapper">
        <div className="calendar-strip" ref={stripRef}>
          <div 
            className={`load-more-card ${loadingLeft ? 'loading' : ''}`}
            onClick={!loadingLeft ? handleLoadLeft : undefined}
          >
            {loadingLeft ? (
              <div className="spinner">⏳</div>
            ) : (
              <>
                <div className="load-more-icon">◀</div>
                <div className="load-more-text">Загрузить ранее</div>
              </>
            )}
          </div>
          {dates.map((date) => {
            const dateStr = formatLocalDate(date);
            const tasksForDay = [...(taskMap.get(dateStr) || [])];
            const isDayOff = daysOffMap.get(dateStr) || false;
            const holiday = isDayOff ? { date: dateStr, isDayOff: true } : null;
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
                taskTagsMap={taskTagsMap}
                onRemoveTagFromTask={onRemoveTag}
                holiday={holiday}
              />
            );
          })}
          <div 
            className={`load-more-card ${loadingRight ? 'loading' : ''}`}
            onClick={!loadingRight ? handleLoadRight : undefined}
          >
            {loadingRight ? (
              <div className="spinner">⏳</div>
            ) : (
              <>
                <div className="load-more-text">Загрузить позже</div>
                <div className="load-more-icon">▶</div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
});

export default CalendarStrip;