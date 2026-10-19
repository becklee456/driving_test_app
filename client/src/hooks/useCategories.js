import { useQuery } from '@tanstack/react-query';
import { request } from '../lib/api.js';

export function useCategories({ includeInactive = false, enabled = true } = {}) {
  return useQuery({
    queryKey: ['categories', { includeInactive }],
    queryFn: () => request({ url: '/categories', params: includeInactive ? { includeInactive: true } : {} }),
    select: (data) => data.categories || [],
    enabled,
  });
}

export function useCategory(slugOrId, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['category', slugOrId],
    queryFn: () => request({ url: `/categories/${slugOrId}` }),
    select: (data) => data.category,
    enabled: Boolean(slugOrId) && enabled,
  });
}
