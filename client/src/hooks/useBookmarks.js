import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request, requestFull } from '../lib/api.js';

export function useBookmarks(params = {}) {
  return useQuery({
    queryKey: ['bookmarks', params],
    queryFn: () => requestFull({ url: '/me/bookmarks', params }),
    keepPreviousData: true,
  });
}

export function useToggleBookmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (questionId) => request({ method: 'post', url: '/me/bookmarks/toggle', data: { questionId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookmarks'] }),
  });
}

export function useRemoveBookmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (questionId) => request({ method: 'delete', url: `/me/bookmarks/${questionId}` }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookmarks'] }),
  });
}
