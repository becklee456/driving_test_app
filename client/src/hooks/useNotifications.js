import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request, requestFull } from '../lib/api.js';

export function useNotifications(params = {}) {
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: () => requestFull({ url: '/me/notifications', params }),
    keepPreviousData: true,
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => request({ method: 'patch', url: `/me/notifications/${id}/read` }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => request({ method: 'post', url: '/me/notifications/read-all' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useReportQuestion() {
  return useMutation({
    mutationFn: (payload) => request({ method: 'post', url: '/me/reports', data: payload }),
  });
}

export function useMyReports() {
  return useQuery({
    queryKey: ['reports', 'mine'],
    queryFn: () => request({ url: '/me/reports' }),
    select: (data) => data.reports || [],
  });
}
