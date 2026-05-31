import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  // useLayoutEffect,
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

const CalendarStrip: React.FC<Props> = ({
  tasks,
  onAddTask,
  onEditTask,
  onMoveTask,
  onLoadRange,
  onToggleStatus,
}) => {
  const [dates, setDates] = useState<Date[]>([]);
  const [loadedDateKeys, setLoadedDateKeys] = useState<Set<string>>(new Set());

  const stripRef = useRef<HTMLDivElement>(null);

  const datesRef = useRef<Date[]>([]);

  const isLoadingLeft = useRef(false);
  const isLoadingRight = useRef(false);

  const initialized = useRef(false);
  // const ignoreInitialScrollEvent = useRef(true);
  const lastLeftLoadTime = useRef(0);
  const initialAutoScrollLock = useRef(true);

  // // ВАЖНО:
  // // блокируем обработчик scroll во время автоскролла
  // const isProgrammaticScroll = useRef(false);

  // const didInitialAutoScroll = useRef(false);

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

    const start = addDays(today, -3);
    const end = addDays(
      today,
      INITIAL_DAYS_BEFORE + INITIAL_DAYS_AFTER
    );

    const newDates: Date[] = [];

    let cur = new Date(start);

    while (cur <= end) {
      newDates.push(new Date(cur));
      cur = addDays(cur, 1);
    }

    setDates(newDates);

    setLoadedDateKeys(
      new Set(newDates.map((d) => formatLocalDate(d)))
    );

    onLoadRange(
      formatLocalDate(start),
      formatLocalDate(end)
    );

    // // СТАВИМ СКРОЛЛ СРАЗУ В ЦЕНТР ДИАПАЗОНА
    // requestAnimationFrame(() => {
    //   if (!stripRef.current) return;

    //   const cardWidth = 256;

    //   stripRef.current.scrollLeft =
    //     INITIAL_DAYS_BEFORE * cardWidth;
    // });

    initialized.current = true;
  }, [onLoadRange]);

  useEffect(() => {
    if (
      dates.length === 0 ||
      !stripRef.current
    ) {
      return;
    }

    const strip = stripRef.current;

    const todayCard = strip.querySelector(
      `[data-date="${todayStr}"]`
    ) as HTMLElement | null;

    if (!todayCard) {
      return;
    }

    // даем layout полностью построиться
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {

        // плавный initial scroll
        strip.scrollTo({
          left: Math.max(
            0,
            todayCard.offsetLeft - 46
          ),
          behavior: 'smooth',
        });

        // блокируем lazy loading
        // пока идет initial animation
        setTimeout(() => {
          initialAutoScrollLock.current = false;
        }, 700);
      });
    });
  }, [dates, todayStr]);
  // // =========================
  // // INITIAL SCROLL TO TODAY
  // // =========================
  // useLayoutEffect(() => {
  //   if (
  //     didInitialAutoScroll.current ||
  //     dates.length === 0 ||
  //     !stripRef.current
  //   ) {
  //     return;
  //   }

  //   const strip = stripRef.current;

  //   const todayCard = strip.querySelector(
  //     `[data-date="${todayStr}"]`
  //   ) as HTMLElement | null;

  //   if (!todayCard) return;

  //   didInitialAutoScroll.current = true;

  //   isProgrammaticScroll.current = true;

  //   strip.scrollLeft = Math.max(
  //     0,
  //     todayCard.offsetLeft - 20
  //   );

  //   requestAnimationFrame(() => {
  //     isProgrammaticScroll.current = false;
  //   });
  // }, [dates, todayStr]);

  // =========================
  // LOAD LEFT
  // =========================
  const loadMoreLeft = useCallback(async () => {
    const currentDates = datesRef.current;

    if (
      isLoadingLeft.current ||
      currentDates.length === 0
    ) {
      return;
    }

    isLoadingLeft.current = true;

    const firstDate = currentDates[0];

    const newFirst = addDays(
      firstDate,
      -LOAD_MORE_DAYS
    );

    const newDates: Date[] = [];

    let cur = new Date(newFirst);

    while (cur < firstDate) {
      newDates.push(new Date(cur));
      cur = addDays(cur, 1);
    }

    // const cardWidth = 256;

    // const addedWidth =
    //   newDates.length * cardWidth;

    // const oldScrollLeft =
    //   stripRef.current?.scrollLeft || 0;

    setDates((prev) => [...newDates, ...prev]);

    setLoadedDateKeys((prev) => {
      const next = new Set(prev);

      newDates.forEach((d) => {
        next.add(formatLocalDate(d));
      });

      return next;
    });

    const fromKey = formatLocalDate(newFirst);

    const toKey = formatLocalDate(
      addDays(firstDate, -1)
    );

    await onLoadRange(fromKey, toKey);

    // if (stripRef.current) {
    //   // isProgrammaticScroll.current = true;

    //   stripRef.current.scrollLeft =
    //     oldScrollLeft + addedWidth;

    //   requestAnimationFrame(() => {
    //     // isProgrammaticScroll.current = false;
    //   });
    // }
    if (stripRef.current) {
      stripRef.current.scrollLeft =
        SCROLL_THRESHOLD + 20;
    }
    isLoadingLeft.current = false;
  }, [onLoadRange]);

  // =========================
  // LOAD RIGHT
  // =========================
  const loadMoreRight = useCallback(async () => {
    const currentDates = datesRef.current;

    if (
      isLoadingRight.current ||
      currentDates.length === 0
    ) {
      return;
    }

    isLoadingRight.current = true;

    const lastDate =
      currentDates[currentDates.length - 1];

    const newLast = addDays(
      lastDate,
      LOAD_MORE_DAYS
    );

    const newDates: Date[] = [];

    let cur = addDays(lastDate, 1);

    while (cur <= newLast) {
      newDates.push(new Date(cur));
      cur = addDays(cur, 1);
    }

    setDates((prev) => [...prev, ...newDates]);

    setLoadedDateKeys((prev) => {
      const next = new Set(prev);

      newDates.forEach((d) => {
        next.add(formatLocalDate(d));
      });

      return next;
    });

    const fromKey = formatLocalDate(
      addDays(lastDate, 1)
    );

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
      if (initialAutoScrollLock.current) {
        return;
      }
      

      // if (ignoreInitialScrollEvent.current) {
      //   ignoreInitialScrollEvent.current = false;
      //   return;
      // }
      const {
        scrollLeft,
        scrollWidth,
        clientWidth,
      } = strip;
      
      if (scrollWidth <= clientWidth) {
        return;
      }

      const now = Date.now();

      if (
        !isLoadingLeft.current &&
        scrollLeft <= SCROLL_THRESHOLD &&
        now - lastLeftLoadTime.current > 300
      ) {
        lastLeftLoadTime.current = now;
        loadMoreLeft();
        return;
      }

      // RIGHT
      if (
        !isLoadingRight.current &&
        scrollLeft + clientWidth >=
          scrollWidth - SCROLL_THRESHOLD
      ) {
        loadMoreRight();
      }
    };

    strip.addEventListener(
      'scroll',
      handleScroll
    );

    return () => {
      strip.removeEventListener(
        'scroll',
        handleScroll
      );
    };
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
      } else if (
        Math.abs(e.deltaX) >
        Math.abs(e.deltaY)
      ) {
        strip.scrollLeft += e.deltaX;
      }
    };

    strip.addEventListener(
      'wheel',
      handleWheel,
      {
        passive: false,
      }
    );

    let isDragging = false;
    let startX = 0;
    let startScrollLeft = 0;

    const handleMouseDown = (
      e: MouseEvent
    ) => {
      if (
        (e.target as HTMLElement).closest(
          '.task-item'
        )
      ) {
        return;
      }

      if (e.button !== 0) return;

      isDragging = true;

      startX = e.pageX;

      startScrollLeft = strip.scrollLeft;

      strip.style.cursor = 'grabbing';

      e.preventDefault();
    };

    const handleMouseMove = (
      e: MouseEvent
    ) => {
      if (!isDragging) return;

      strip.scrollLeft =
        startScrollLeft -
        (e.pageX - startX);
    };

    const handleMouseUp = () => {
      if (!isDragging) return;

      isDragging = false;

      strip.style.cursor = 'grab';
    };

    strip.addEventListener(
      'mousedown',
      handleMouseDown
    );

    window.addEventListener(
      'mousemove',
      handleMouseMove
    );

    window.addEventListener(
      'mouseup',
      handleMouseUp
    );

    strip.style.cursor = 'grab';

    return () => {
      strip.removeEventListener(
        'wheel',
        handleWheel
      );

      strip.removeEventListener(
        'mousedown',
        handleMouseDown
      );

      window.removeEventListener(
        'mousemove',
        handleMouseMove
      );

      window.removeEventListener(
        'mouseup',
        handleMouseUp
      );
    };
  }, []);

  // =========================
  // TASK GROUPING
  // =========================
  const groupTasksByDate = (): Map<
    string,
    Task[]
  > => {
    const map = new Map<string, Task[]>();

    for (const task of tasks) {
      let key = '';

      if (task.due_date) {
        key = task.due_date.slice(0, 10);
      }

      if (
        loadedDateKeys.has(key) ||
        key === ''
      ) {
        if (!map.has(key)) {
          map.set(key, []);
        }

        map.get(key)!.push(task);
      }
    }

    return map;
  };

  const taskMap = groupTasksByDate();

  return (
    <>
      <div
        className="calendar-header"
        style={{
          justifyContent: 'space-between',
        }}
      >
        <div />

        <div className="nav-buttons">
          <button
            className="nav-btn"
            onClick={() => {
              if (!stripRef.current) return;

              stripRef.current.scrollLeft -= 280;
            }}
          >
            ⬅️
          </button>

          <button
            className="nav-btn"
            onClick={() => {
              if (!stripRef.current) return;

              stripRef.current.scrollLeft += 280;
            }}
          >
            ➡️
          </button>
        </div>
      </div>

      <div className="strip-wrapper">
        <div
          className="calendar-strip"
          ref={stripRef}
        >
          {dates.map((date) => {
            const dateStr =
              formatLocalDate(date);

            // ВАЖНО:
            // создаем новый reference массива
            // чтобы DayCard всегда обновлялся
            const tasksForDay = [
              ...(taskMap.get(dateStr) || []),
            ];

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