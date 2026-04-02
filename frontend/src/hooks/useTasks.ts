import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi } from '../services/api';
import type { Task } from '../features/tasks/tasksSlice';

interface ApiResponse<T> { data: { data: T; meta?: { page: number; limit: number; total: number; pages: number } } }
type Filters = { status?: string; priority?: string; assigneeId?: string; page?: number; limit?: number };

export function useTaskList(filters: Filters = {}) {
  return useQuery({
    queryKey: ['tasks', filters],
    queryFn: async () => {
      const res = await tasksApi.list(filters as Record<string, unknown>);
      return res.data as { data: Task[]; meta: { page: number; limit: number; total: number; pages: number } };
    },
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: ['tasks', id],
    queryFn: async () => {
      const res = await tasksApi.get(id) as ApiResponse<Task>;
      return res.data.data;
    },
    enabled: !!id,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => tasksApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => tasksApi.update(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['tasks', id] });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tasksApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useAcceptSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tasksApi.acceptSuggestion(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['tasks', id] });
    },
  });
}
