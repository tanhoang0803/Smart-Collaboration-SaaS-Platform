import type { Task } from '../features/tasks/tasksSlice';

interface Props {
  task: Task;
  onClick: () => void;
}

export default function TaskCard({ task, onClick }: Props) {
  const dueSoon = task.dueDate
    ? new Date(task.dueDate).getTime() - Date.now() < 24 * 60 * 60 * 1000
    : false;

  return (
    <div className="task-card" onClick={onClick} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}>
      <div className="task-card-body">
        <div className="task-card-title">{task.title}</div>
        {task.description && (
          <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
            {task.description.slice(0, 120)}{task.description.length > 120 ? '…' : ''}
          </div>
        )}
        <div className="task-card-meta">
          <span className={`badge badge-${task.status}`}>{task.status.replace('_', ' ')}</span>
          <span className={`badge badge-${task.priority}`}>{task.priority}</span>
          {task.dueDate && (
            <span className="task-card-due" style={{ color: dueSoon ? 'var(--danger)' : undefined }}>
              📅 {new Date(task.dueDate).toLocaleDateString()}
            </span>
          )}
          {task.aiSuggestion && (
            <span className="task-card-ai-pill">✨ AI suggestion</span>
          )}
        </div>
      </div>
    </div>
  );
}
