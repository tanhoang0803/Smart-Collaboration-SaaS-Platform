import type { AiSuggestion } from '../features/tasks/tasksSlice';

interface Props {
  suggestion: AiSuggestion;
  onAccept: () => void;
  onReject: () => void;
  isLoading?: boolean;
}

export default function AiSuggestionPanel({ suggestion, onAccept, onReject, isLoading }: Props) {
  return (
    <div className="ai-panel">
      <h3>✨ AI Suggestion</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {suggestion.priority && (
          <div>
            <strong>Priority:</strong>{' '}
            <span className={`badge badge-${suggestion.priority}`}>{suggestion.priority}</span>
          </div>
        )}
        {suggestion.dueDate && (
          <div>
            <strong>Due date:</strong> {new Date(suggestion.dueDate).toLocaleDateString()}
          </div>
        )}
        {suggestion.reasoning && (
          <div style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>
            "{suggestion.reasoning}"
          </div>
        )}
      </div>
      <div className="ai-panel-actions">
        <button className="btn btn-success btn-sm" onClick={onAccept} disabled={isLoading}>
          ✓ Accept
        </button>
        <button className="btn btn-secondary btn-sm" onClick={onReject} disabled={isLoading}>
          ✕ Dismiss
        </button>
      </div>
    </div>
  );
}
