import { useNavigate } from 'react-router-dom';
import { useTaskList } from '../hooks/useTasks';
import { useAuth } from '../hooks/useAuth';
import TaskCard from '../components/TaskCard';

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading } = useTaskList({ limit: 100 });
  const navigate = useNavigate();

  const tasks = data?.data ?? [];
  const counts = {
    todo:        tasks.filter((t) => t.status === 'todo').length,
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    review:      tasks.filter((t) => t.status === 'review').length,
    done:        tasks.filter((t) => t.status === 'done').length,
  };
  const recent = [...tasks].slice(0, 5);

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <span style={{ color: 'var(--muted)' }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </span>
      </div>

      {user && (
        <p style={{ color: 'var(--muted)', marginBottom: 24 }}>
          Welcome back, <strong>{user.email}</strong>
        </p>
      )}

      <div className="stats-grid">
        <div className="card stat-card">
          <div className="stat-value">{tasks.length}</div>
          <div className="stat-label">Total Tasks</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value" style={{ color: 'var(--muted)' }}>{counts.todo}</div>
          <div className="stat-label">To Do</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value" style={{ color: '#1d4ed8' }}>{counts.in_progress}</div>
          <div className="stat-label">In Progress</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value" style={{ color: '#a16207' }}>{counts.review}</div>
          <div className="stat-label">In Review</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value" style={{ color: 'var(--success)' }}>{counts.done}</div>
          <div className="stat-label">Done</div>
        </div>
      </div>

      <div className="card">
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Recent Tasks</h2>
        {isLoading ? (
          <p className="loading">Loading…</p>
        ) : recent.length === 0 ? (
          <p className="empty-state">No tasks yet. <a href="/tasks">Create one →</a></p>
        ) : (
          <div className="task-list">
            {recent.map((task) => (
              <TaskCard key={task.id} task={task} onClick={() => navigate(`/tasks/${task.id}`)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
