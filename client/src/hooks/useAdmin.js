import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request, requestFull } from '../lib/api.js';

/* Analytics */
export function useAdminOverview() {
  return useQuery({ queryKey: ['admin', 'overview'], queryFn: () => request({ url: '/admin/overview' }) });
}

export function useAdminGrowth({ days = 30 } = {}) {
  return useQuery({
    queryKey: ['admin', 'growth', days],
    queryFn: () => request({ url: '/admin/analytics/growth', params: { days } }),
    select: (d) => d.series || [],
  });
}

export function useAdminActivityTrend({ days = 30 } = {}) {
  return useQuery({
    queryKey: ['admin', 'activity-trend', days],
    queryFn: () => request({ url: '/admin/analytics/activity', params: { days } }),
    select: (d) => d.series || [],
  });
}

export function useAdminCategoryPerformance() {
  return useQuery({
    queryKey: ['admin', 'category-performance'],
    queryFn: () => request({ url: '/admin/analytics/categories' }),
    select: (d) => d.categories || [],
  });
}

export function useAdminQuestionInsights({ limit = 15 } = {}) {
  return useQuery({
    queryKey: ['admin', 'question-insights', limit],
    queryFn: () => request({ url: '/admin/analytics/questions', params: { limit } }),
  });
}

export function useReviewQueue(params = {}) {
  return useQuery({
    queryKey: ['admin', 'review-queue', params],
    queryFn: () => requestFull({ url: '/admin/questions/review-queue', params }),
    keepPreviousData: true,
  });
}

export function useAdminLeaderboard({ limit = 20 } = {}) {
  return useQuery({
    queryKey: ['admin', 'leaderboard', limit],
    queryFn: () => request({ url: '/admin/analytics/leaderboard', params: { limit } }),
    select: (d) => d.leaderboard || [],
  });
}

export function useAdminRecentActivity({ limit = 30 } = {}) {
  return useQuery({
    queryKey: ['admin', 'recent-activity', limit],
    queryFn: () => request({ url: '/admin/analytics/recent-activity', params: { limit } }),
    select: (d) => d.activity || [],
  });
}

/* Categories */
export function useAdminCategories() {
  return useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: () => request({ url: '/admin/categories' }),
    select: (d) => d.categories || [],
  });
}

export function useCategoryMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'categories'] });
    qc.invalidateQueries({ queryKey: ['categories'] });
  };
  return {
    create: useMutation({
      mutationFn: (payload) => request({ method: 'post', url: '/admin/categories', data: payload }),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, ...payload }) => request({ method: 'patch', url: `/admin/categories/${id}`, data: payload }),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id) => request({ method: 'delete', url: `/admin/categories/${id}` }),
      onSuccess: invalidate,
    }),
    reorder: useMutation({
      mutationFn: (order) => request({ method: 'post', url: '/admin/categories/reorder', data: { order } }),
      onSuccess: invalidate,
    }),
  };
}

/* Reports */
export function useAdminReports(params = {}) {
  return useQuery({
    queryKey: ['admin', 'reports', params],
    queryFn: () => requestFull({ url: '/admin/reports', params }),
    keepPreviousData: true,
  });
}

export function useUpdateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }) => request({ method: 'patch', url: `/admin/reports/${id}`, data: payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'reports'] }),
  });
}

/* Users */
export function useAdminUsers(params = {}) {
  return useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: () => requestFull({ url: '/admin/users', params }),
    keepPreviousData: true,
  });
}

export function useUserMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'users'] });
  return {
    update: useMutation({
      mutationFn: ({ id, ...payload }) => request({ method: 'patch', url: `/admin/users/${id}`, data: payload }),
      onSuccess: invalidate,
    }),
    changeRole: useMutation({
      mutationFn: ({ id, ...payload }) => request({ method: 'patch', url: `/admin/users/${id}/role`, data: payload }),
      onSuccess: invalidate,
    }),
    suspend: useMutation({
      mutationFn: (id) => request({ method: 'post', url: `/admin/users/${id}/suspend` }),
      onSuccess: invalidate,
    }),
    activate: useMutation({
      mutationFn: (id) => request({ method: 'post', url: `/admin/users/${id}/activate` }),
      onSuccess: invalidate,
    }),
    resetProgress: useMutation({
      mutationFn: (id) => request({ method: 'post', url: `/admin/users/${id}/reset-progress` }),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id) => request({ method: 'delete', url: `/admin/users/${id}` }),
      onSuccess: invalidate,
    }),
  };
}

/* Settings */
export function useAdminSettings() {
  return useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => request({ url: '/admin/settings' }),
    select: (d) => d.settings,
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => request({ method: 'patch', url: '/admin/settings', data: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
      qc.invalidateQueries({ queryKey: ['config'] });
    },
  });
}

/* Permissions catalog */
export function usePermissionsCatalog() {
  return useQuery({
    queryKey: ['permissions'],
    queryFn: () => request({ url: '/permissions' }),
    staleTime: Infinity,
  });
}

/* Audit */
export function useAuditLog(params = {}) {
  return useQuery({
    queryKey: ['admin', 'audit', params],
    queryFn: () => requestFull({ url: '/admin/audit', params }),
    keepPreviousData: true,
  });
}

/* Testimonials */
export function useAdminTestimonials() {
  return useQuery({
    queryKey: ['admin', 'testimonials'],
    queryFn: () => request({ url: '/admin/testimonials' }),
    select: (d) => d.testimonials || [],
  });
}

export function useTestimonialMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'testimonials'] });
    qc.invalidateQueries({ queryKey: ['testimonials'] });
  };
  return {
    create: useMutation({
      mutationFn: (payload) => request({ method: 'post', url: '/admin/testimonials', data: payload }),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, ...payload }) => request({ method: 'patch', url: `/admin/testimonials/${id}`, data: payload }),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id) => request({ method: 'delete', url: `/admin/testimonials/${id}` }),
      onSuccess: invalidate,
    }),
    reorder: useMutation({
      mutationFn: (order) => request({ method: 'post', url: '/admin/testimonials/reorder', data: { order } }),
      onSuccess: invalidate,
    }),
  };
}
  return useMutation({
    mutationFn: (payload) => request({ method: 'post', url: '/admin/imports/preview', data: payload }),
  });
}

export function useImportCommit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => request({ method: 'post', url: '/admin/imports/commit', data: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'questions'] });
      qc.invalidateQueries({ queryKey: ['admin', 'question-stats'] });
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}
