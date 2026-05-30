import React, { useRef, useEffect, useState, useCallback } from 'react';
import DayCard from './DayCard';
import { Task } from '../types';
import './CalendarStrip.css';

const INITIAL_DAYS_BEFORE = 30;
const INITIAL_DAYS_AFTER = 30;
const SCROLL_THRESHOLD = 200;
const LOAD_MORE_DAYS = 10;

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

function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

interface Props {
  tasks: Task[];
  onAddTask: (date: string) => void;
  onEditTask: (task: Task) => void;
  onMoveTask: (taskId: number, newDueDate: string) => void;
  onLoadRange: (from: string, to: string) => Promise<Task[]>;
}

const CalendarStrip: React.FC<Props> = ({ tasks, onAddTask, onEditTask, onMoveTask, onLoadRange }) => {
  const [dates, setDates] = useState<Date[]>([]);
  const [loadedDateKeys, setLoadedDateKeys] = useState<Set<string>>(new Set());
  const stripRef = useRef<HTMLDivElement>(null);
  const todayStr = formatDateKey(getTodayDate());
  const isLoadingLeft = useRef(false);
  const isLoadingRight = useRef(false);

  useEffect(() => {
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
    const keys = new Set(newDates.map(d => formatDateKey(d)));
    setLoadedDateKeys(keys);
    onLoadRange(formatDateKey(start), formatDateKey(end));
  }, [onLoadRange]);

  // Прокрутка к сегодняшнему дню при первой загрузке
  useEffect(() => {
    const timer = setTimeout(() => {
      const todayCard = stripRef.current?.querySelector(`[data-date="${todayStr}"]`);
      if (todayCard && stripRef.current) {
        const container = stripRef.current;
        const cardLeft = (todayCard as HTMLElement).offsetLeft;
        const centerOffset = cardLeft - (container.clientWidth / 2) + ((todayCard as HTMLElement).clientWidth / 2);
        container.scrollLeft = Math.max(0, centerOffset);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [dates, todayStr]);

  const loadMoreLeft = useCallback(async () => {
    if (isLoadingLeft.current || dates.length === 0) return;
    isLoadingLeft.current = true;
    const firstDate = dates[0];
    const newFirst = addDays(firstDate, -LOAD_MORE_DAYS);
    const newDates: Date[] = [];
    let cur = new Date(newFirst);
    while (cur < firstDate) {
      newDates.push(new Date(cur));
      cur = addDays(cur, 1);
    }
    const oldScrollLeft = stripRef.current?.scrollLeft || 0;
    const cardWidth = 240 + 16; // ширина карточки + gap
    const addedWidth = newDates.length * cardWidth;
    setDates(prev => [...newDates, ...prev]);
    const fromKey = formatDateKey(newFirst);
    const toKey = formatDateKey(addDays(firstDate, -1));
    await onLoadRange(fromKey, toKey);
    if (stripRef.current) {
      stripRef.current.scrollLeft = oldScrollLeft + addedWidth;
    }
    isLoadingLeft.current = false;
  }, [dates, onLoadRange]);

  const loadMoreRight = useCallback(async () => {
    if (isLoadingRight.current || dates.length === 0) return;
    isLoadingRight.current = true;
    const lastDate = dates[dates.length - 1];
    const newLast = addDays(lastDate, LOAD_MORE_DAYS);
    const newDates: Date[] = [];
    let cur = addDays(lastDate, 1);
    while (cur <= newLast) {
      newDates.push(new Date(cur));
      cur = addDays(cur, 1);
    }
    setDates(prev => [...prev, ...newDates]);
    const fromKey = formatDateKey(addDays(lastDate, 1));
    const toKey = formatDateKey(newLast);
    await onLoadRange(fromKey, toKey);
    isLoadingRight.current = false;
  }, [dates, onLoadRange]);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const handleScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = strip;
      if (!isLoadingLeft.current && scrollLeft < SCROLL_THRESHOLD) {
        loadMoreLeft();
      } else if (!isLoadingRight.current && scrollLeft + clientWidth > scrollWidth - SCROLL_THRESHOLD) {
        loadMoreRight();
      }
    };
    strip.addEventListener('scroll', handleScroll);
    return () => strip.removeEventListener('scroll', handleScroll);
  }, [loadMoreLeft, loadMoreRight]);

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
      if (isDragging) {
        isDragging = false;
        strip.style.cursor = 'grab';
      }
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

  const groupTasksByDate = (): Map<string, Task[]> => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      let key = '';
      if (task.due_date) {
        key = task.due_date.slice(0, 10);
      }
      if (loadedDateKeys.has(key) || key === '') {
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(task);
      }
    }
    return map;
  };

  const taskMap = groupTasksByDate();

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
            const dateStr = formatDateKey(date);
            const tasksForDay = taskMap.get(dateStr) || [];
            return (
              <DayCard
                key={dateStr}
                date={date}
                tasks={tasksForDay}
                isToday={dateStr === todayStr}
                onAddTask={() => onAddTask(dateStr)}
                onEditTask={onEditTask}
                onMoveTask={onMoveTask}
                dateStr={dateStr}
              />
            );
          })}
        </div>
      </div>
    </>
  );
};

export default CalendarStrip;