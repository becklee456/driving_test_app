import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '../lib/api.js';

export function useProgress({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['progress'],
    queryFn: () => request({ url: '/me/progress' }),
    enabled,
  });
}

export function useCategoryProgress({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['progress', 'categories'],
    queryFn: () => request({ url: '/me/progress/categories' }),
    select: (data) => data.categories || [],
    enabled,
  });
}

export function useActivity({ days = 90 } = {}) {
  return useQuery({
    queryKey: ['progress', 'activity', days],
    queryFn: () => request({ url: '/me/progress/activity', params: { days } }),
    select: (data) => data.activity || [],
  });
}

export function useMistakes({ limit = 50 } = {}) {
  return useQuery({
    queryKey: ['progress', 'mistakes', limit],
    queryFn: () => request({ url: '/me/progress/mistakes', params: { limit } }),
    select: (data) => data.mistakes || [],
  });
}

export function useResetProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => request({ method: 'delete', url: '/me/progress' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['progress'] });
      qc.invalidateQueries({ queryKey: ['bookmarks'] });
      qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
}
