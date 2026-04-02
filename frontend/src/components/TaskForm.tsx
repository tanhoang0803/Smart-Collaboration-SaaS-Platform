import { useState } from 'react';
import type { Task } from '../features/tasks/tasksSlice';

interface TaskFormData {
  title: string;
  description: string;
  status: Task['status'];
  priority: Task['priority'];
  dueDate: string;
  assigneeId: string;
}

interface Props {
  initial?: Partial<TaskFormData>;
  onSubmit: (data: Partial<TaskFormData>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const STATUS_OPTIONS: Task['status'][] = ['todo', 'in_progress', 'review', 'done'];
const PRIORITY_OPTIONS: Task['priority'][] = ['low', 'medium', 'high', 'urgent'];

export default function TaskForm({ initial, onSubmit, onCancel, isLoading }: Props) {
  const [form, setForm] = useState<TaskFormData>({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    status: initial?.status ?? 'todo',
    priority: initial?.priority ?? 'medium',
    dueDate: initial?.dueDate ?? '',
    assigneeId: initial?.assigneeId ?? '',
  });
  const [error, setError] = useState('');

  function set(field: keyof TaskFormData, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required'); return; }
    const payload: Partial<TaskFormData> = { ...form };
    if (!payload.dueDate) delete payload.dueDate;
    if (!payload.assigneeId) delete payload.assigneeId;
    if (!payload.description) delete payload.description;
    onSubmit(payload);
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label>Title *</label>
        <input className="form-control" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Task title" />
        {error && <span className="form-error">{error}</span>}
      </div>
      <div className="form-group">
        <label>Description</label>
        <textarea className="form-control" value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Optional description" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="form-group">
          <label>Status</label>
          <select className="form-control" value={form.status} onChange={(e) => set('status', e.target.value)}>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Priority</label>
          <select className="form-control" value={form.priority} onChange={(e) => set('priority', e.target.value)}>
            {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label>Due date</label>
        <input type="datetime-local" className="form-control" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={isLoading}>
          {isLoading ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
