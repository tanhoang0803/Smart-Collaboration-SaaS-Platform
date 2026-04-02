import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface AiSuggestion {
  dueDate?: string;
  priority?: string;
  assigneeId?: string;
  reasoning?: string;
}

export interface Task {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate: string | null;
  assigneeId: string | null;
  createdBy: string;
  aiSuggestion: AiSuggestion | null;
  createdAt: string;
  updatedAt: string;
}

interface Meta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface TasksState {
  items: Task[];
  selectedTask: Task | null;
  isLoading: boolean;
  error: string | null;
  meta: Meta | null;
}

const initialState: TasksState = {
  items: [],
  selectedTask: null,
  isLoading: false,
  error: null,
  meta: null,
};

const tasksSlice = createSlice({
  name: 'tasks',
  initialState,
  reducers: {
    setTasks(state, action: PayloadAction<{ tasks: Task[]; meta: Meta }>) {
      state.items = action.payload.tasks;
      state.meta = action.payload.meta;
    },
    addTask(state, action: PayloadAction<Task>) {
      state.items.unshift(action.payload);
    },
    updateTask(state, action: PayloadAction<Task>) {
      const idx = state.items.findIndex((t) => t.id === action.payload.id);
      if (idx !== -1) state.items[idx] = action.payload;
      if (state.selectedTask?.id === action.payload.id) state.selectedTask = action.payload;
    },
    removeTask(state, action: PayloadAction<string>) {
      state.items = state.items.filter((t) => t.id !== action.payload);
      if (state.selectedTask?.id === action.payload) state.selectedTask = null;
    },
    setSelectedTask(state, action: PayloadAction<Task | null>) {
      state.selectedTask = action.payload;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      state.isLoading = false;
    },
    setMeta(state, action: PayloadAction<Meta>) {
      state.meta = action.payload;
    },
  },
});

export const { setTasks, addTask, updateTask, removeTask, setSelectedTask, setLoading, setError, setMeta } = tasksSlice.actions;
export default tasksSlice.reducer;
