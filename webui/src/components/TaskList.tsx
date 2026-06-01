import React, { useMemo, useState } from 'react';
import { Task } from '../types';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  ColumnResizeMode,
  ColumnDef,
  SortingState,
  flexRender,
} from '@tanstack/react-table';
import { CheckCircle2, AlertCircle, Search } from 'lucide-react';
import './TaskList.css';

interface Props {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onToggleStatus: (taskId: number, newStatus: number) => void;
}

const TaskList: React.FC<Props> = ({ tasks, onTaskClick, onToggleStatus }) => {
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'due_date', desc: false }]);
  const [columnResizeMode] = useState<ColumnResizeMode>('onChange');

  // Вычисление просрочки и статуса для каждой задачи
  const data = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return tasks.map(task => {
      const isCompleted = task.task_status === 2;
      let overdue = 0;
      if (task.due_date && !isCompleted) {
        const parts = task.due_date.split('-');
        const due = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        const diffDays = Math.ceil((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
        overdue = diffDays > 0 ? diffDays : 0;
      }
      return { ...task, isCompleted, overdue };
    });
  }, [tasks]);

  // Определение колонок
  const columns = useMemo<ColumnDef<Task & { isCompleted: boolean; overdue: number }>[]>(
    () => [
      {
        accessorKey: 'title',
        header: 'Название',
        size: 300,
        minSize: 150,
        cell: info => (
          <div className="task-title-cell" title={info.getValue() as string}>
            {info.getValue() as string}
          </div>
        ),
      },
      {
        accessorKey: 'due_date',
        header: 'Дата',
        size: 150,
        minSize: 100,
        cell: info => {
          const dueDate = info.getValue() as string | null;
          const overdue = info.row.original.overdue;
          return (
            <div className="task-date-cell">
              {dueDate || '—'}
              {overdue > 0 && (
                <span className="overdue-badge-list">
                  <AlertCircle size={12} /> просрочка {overdue} дн.
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'task_status',
        header: 'Статус',
        size: 120,
        cell: info => {
          const isCompleted = info.row.original.isCompleted;
          return (
            <div className="task-status-cell">
              {isCompleted ? '✅ Выполнена' : '🟢 Активна'}
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: '',
        size: 40,
        enableSorting: false,
        cell: info => {
          const task = info.row.original;
          const isCompleted = task.isCompleted;
          return (
            <div className="task-action-cell">
              <button
                className="status-toggle-btn-list"
                onClick={(e) => {
                  e.stopPropagation();
                  const newStatus = isCompleted ? 1 : 2;
                  onToggleStatus(task.task_id, newStatus);
                }}
                title={isCompleted ? 'Отметить как невыполненную' : 'Отметить как выполненную'}
              >
                <CheckCircle2
                  size={18}
                  className={isCompleted ? 'status-icon completed' : 'status-icon incomplete'}
                />
              </button>
            </div>
          );
        },
      },
    ],
    [onToggleStatus]
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    columnResizeMode,
    enableMultiSort: true,   // мультисортировка (Shift+клик)
    enableSorting: true,
  });

  return (
    <div className="task-list-container">
      <div className="task-list-header">
        <h3 title="Shift + Left click - мультисортировка">📋 Список задач</h3>
        <div className="task-list-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Поиск по всем полям..."
            value={globalFilter ?? ''}
            onChange={e => setGlobalFilter(e.target.value)}
          />
        </div>
      </div>

      <div className="task-list-table-wrapper">
        <table
          className="task-list-table"
          style={{
            width: table.getTotalSize(),
          }}
        >
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    colSpan={header.colSpan}
                    style={{
                      width: header.getSize(),
                      position: 'relative',
                    }}
                    onClick={header.column.getToggleSortingHandler()}
                    className={header.column.getCanSort() ? 'sortable' : ''}
                  >
                    <div className="th-content">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{
                        asc: ' ↑',
                        desc: ' ↓',
                      }[header.column.getIsSorted() as string] ?? ' ↕'}
                    </div>
                    {/* Ресайзер */}
                    <div
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      className={`resizer ${header.column.getIsResizing() ? 'isResizing' : ''}`}
                    />
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="no-tasks">
                  Задачи не найдены
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map(row => (
                <tr
                  key={row.id}
                  className={`task-row ${row.original.isCompleted ? 'completed-row' : ''}`}
                  onClick={() => onTaskClick(row.original)}
                >
                  {row.getVisibleCells().map(cell => (
                    <td
                      key={cell.id}
                      style={{
                        width: cell.column.getSize(),
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TaskList;