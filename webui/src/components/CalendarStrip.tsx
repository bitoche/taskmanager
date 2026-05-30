import React, { useRef, useEffect } from 'react';
import DayCard from './DayCard';
import { Task } from '../types';
import './CalendarStrip.css';

interface Props {
  tasks: Task[];
  onAddTask: (date: string) => void;
  onEditTask: (task: Task) => void;
}

const DAYS_BEFORE = 14;
const DAYS_AFTER = 14;

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

function buildDateRange(): Date[] {
  const today = getTodayDate();
  const start = addDays(today, -DAYS_BEFORE);
  const end = addDays(today, DAYS_AFTER);
  const range: Date[] = [];
  let cur = new Date(start);
  while (cur <= end) {
    range.push(new Date(cur));
    cur = addDays(cur, 1);
  }
  return range;
}

function groupTasksByDate(tasks: Task[]): Map<string, Task[]> {
  const map = new Map<string, Task[]>();
  for (const task of tasks) {
    const key = task.due_date || '';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(task);
  }
  return map;
}

const CalendarStrip: React.FC<Props> = ({ tasks, onAddTask, onEditTask }) => {
  const stripRef = useRef<HTMLDivElement>(null);
  const dates = buildDateRange();
  const todayStr = formatDateKey(getTodayDate());
  const taskMap = groupTasksByDate(tasks);

  // прокрутка к сегодняшнему дню
  useEffect(() => {
    const todayCard = stripRef.current?.querySelector(`[data-date="${todayStr}"]`);
    if (todayCard && stripRef.current) {
      const offset = (todayCard as HTMLElement).offsetLeft - 30;
      stripRef.current.scrollLeft = Math.max(0, offset);
    }
  }, [tasks, todayStr]);

  // Обработчики прокрутки: shift+wheel, drag, кнопки
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.shiftKey) {
        e.preventDefault();
        strip.scrollLeft += e.deltaY || e.deltaX;
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

  const scrollLeft = () => {
    stripRef.current?.scrollBy({ left: -280, behavior: 'smooth' });
  };
  const scrollRight = () => {
    stripRef.current?.scrollBy({ left: 280, behavior: 'smooth' });
  };

  return (
    <>
      <div className="calendar-header" style={{ justifyContent: 'space-between' }}>
        <div />
        <div className="nav-buttons">
          <button className="nav-btn" onClick={scrollLeft}>⬅️</button>
          <button className="nav-btn" onClick={scrollRight}>➡️</button>
        </div>
      </div>
      <div className="strip-wrapper">
        <div className="calendar-strip" ref={stripRef}>
          {dates.map((date) => {
            const dateStr = formatDateKey(date);
            const tasksForDay = taskMap.get(dateStr) || [];
            // сортировка: просроченные сверху
            const sortedTasks = [...tasksForDay].sort((a, b) => {
              const overA = a.overdue_days || 0;
              const overB = b.overdue_days || 0;
              return overB - overA;
            });
            return (
              <DayCard
                key={dateStr}
                date={date}
                tasks={sortedTasks}
                isToday={dateStr === todayStr}
                onAddTask={() => onAddTask(dateStr)}
                onEditTask={onEditTask}
              />
            );
          })}
        </div>
      </div>
    </>
  );
};

export default CalendarStrip;