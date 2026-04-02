import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTask, useUpdateTask, useDeleteTask, useAcceptSuggestion } from '../hooks/useTasks';
import { useQueryClient } from '@tanstack/react-query';
import { onTaskEvent } from '../services/socket';
import TaskForm from '../components/TaskForm';
import AiSuggestionPanel from '../components/AiSuggestionPanel';
import type { Task } from '../features/tasks/tasksSlice';

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: task, isLoading, error } = useTask(id!);
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const acceptSuggestion = useAcceptSuggestion();

  const [editing, setEditing] = useState(false);

  // Real-time updates via Socket.io
  useEffect(() => {
    const off = onTaskEvent('task.updated', (payload) => {
      const updated = (payload as { task: Task }).task;
      if (updated?.id === id) {
        qc.invalidateQueries({ queryKey: ['tasks', id] });
      }
    });
    return off;
  }, [id, qc]);

  async function handleUpdate(data: unknown) {
    await updateTask.mutateAsync({ id: id!, data });
    setEditing(false);
  }

  async function handleDelete() {
    if (!confirm('Delete this task?')) return;
    await deleteTask.mutateAsync(id!);
    navigate('/tasks');
  }

  async function handleAccept() {
    await acceptSuggestion.mutateAsync(id!);
  }

  if (isLoading) return <p className="loading">Loading…</p>;
  if (error || !task) return <p className="error-msg">Task not found.</p>;

  return (
    <div>
      <div className="page-header">
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/tasks')}>
          ← Back
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setEditing(!editing)}>
            {editing ? 'Cancel' : 'Edit'}
          </button>
          <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={deleteTask.isPending}>
            Delete
          </button>
        </div>
      </div>

      {editing ? (
        <div className="card">
          <TaskForm
            initial={{ title: task.title, description: task.description ?? '', status: task.status, priority: task.priority, dueDate: task.dueDate ?? '' }}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(false)}
            isLoading={updateTask.isPending}
          />
        </div>
      ) : (
        <div className="card">
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>{task.title}</h1>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            <span className={`badge badge-${task.status}`}>{task.status.replace('_', ' ')}</span>
            <span className={`badge badge-${task.priority}`}>{task.priority}</span>
          </div>
          {task.description && (
            <p style={{ color: 'var(--text)', lineHeight: 1.7, marginBottom: 16 }}>{task.description}</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, color: 'var(--muted)', fontSize: 13 }}>
            {task.dueDate && <div>📅 Due: {new Date(task.dueDate).toLocaleString()}</div>}
            <div>🕐 Created: {new Date(task.createdAt).toLocaleString()}</div>
            <div>🔄 Updated: {new Date(task.updatedAt).toLocaleString()}</div>
          </div>
        </div>
      )}

      {task.aiSuggestion && !editing && (
        <AiSuggestionPanel
          suggestion={task.aiSuggestion}
          onAccept={handleAccept}
          onReject={() => updateTask.mutate({ id: id!, data: { aiSuggestion: null } })}
          isLoading={acceptSuggestion.isPending}
        />
      )}
    </div>
  );
}
