import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTaskList, useCreateTask } from '../hooks/useTasks';
import TaskCard from '../components/TaskCard';
import TaskForm from '../components/TaskForm';
import type { Task } from '../features/tasks/tasksSlice';

type StatusFilter = Task['status'] | '';
type PriorityFilter = Task['priority'] | '';

export default function TasksPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<StatusFilter>('');
  const [priority, setPriority] = useState<PriorityFilter>('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading, error } = useTaskList({
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    page,
    limit: 20,
  });

  const createTask = useCreateTask();
  const tasks = data?.data ?? [];
  const meta = data?.meta;

  async function handleCreate(formData: unknown) {
    await createTask.mutateAsync(formData);
    setShowForm(false);
  }

  return (
    <div>
      <div className="page-header">
        <h1>Tasks</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Cancel' : '+ New Task'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>New Task</h2>
          <TaskForm
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
            isLoading={createTask.isPending}
          />
        </div>
      )}

      <div className="filter-bar">
        <select className="form-control" style={{ width: 'auto' }}
          value={status} onChange={(e) => { setStatus(e.target.value as StatusFilter); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="review">Review</option>
          <option value="done">Done</option>
        </select>
        <select className="form-control" style={{ width: 'auto' }}
          value={priority} onChange={(e) => { setPriority(e.target.value as PriorityFilter); setPage(1); }}>
          <option value="">All priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
        {meta && (
          <span style={{ color: 'var(--muted)', fontSize: 13, marginLeft: 'auto' }}>
            {meta.total} tasks
          </span>
        )}
      </div>

      {isLoading && <p className="loading">Loading tasks…</p>}
      {error && <p className="error-msg">Failed to load tasks.</p>}
      {!isLoading && tasks.length === 0 && (
        <div className="empty-state">No tasks found. Create one above.</div>
      )}

      <div className="task-list">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onClick={() => navigate(`/tasks/${task.id}`)} />
        ))}
      </div>

      {meta && meta.pages > 1 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20 }}>
          <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            ← Prev
          </button>
          <span style={{ padding: '5px 12px', fontSize: 13, color: 'var(--muted)' }}>
            Page {page} / {meta.pages}
          </span>
          <button className="btn btn-secondary btn-sm" disabled={page >= meta.pages} onClick={() => setPage(p => p + 1)}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
