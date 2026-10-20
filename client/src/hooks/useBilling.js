import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request, requestFull } from '../lib/api.js';

/** Re-renders the component every `intervalMs` so countdowns stay live. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}


/* ------------------------------------------------------------------ *
 * Learner
 * ------------------------------------------------------------------ */
export function usePlans({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['plans'],
    queryFn: () => request({ url: '/payments/plans' }),
    select: (d) => d?.plans || [],
    enabled,
  });
}

export function useMyPaymentStatus({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['billing', 'status'],
    queryFn: () => request({ url: '/payments/my/status' }),
    enabled,
  });
}

export function useMyPayments({ page = 1, status } = {}, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['billing', 'payments', { page, status }],
    queryFn: () =>
      requestFull({
        url: '/payments/my',
        params: { page, ...(status && status !== 'all' ? { status } : {}) },
      }),
    keepPreviousData: true,
    enabled,
  });
}

export function useMySubscriptions({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['billing', 'subscriptions'],
    queryFn: () => request({ url: '/payments/my/subscriptions' }),
    select: (d) => d?.subscriptions || [],
    enabled,
  });
}

export function useSubmitPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData) =>
      request({
        method: 'post',
        url: '/payments',
        data: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing'] });
    },
  });
}

/* ------------------------------------------------------------------ *
 * Admin
 * ------------------------------------------------------------------ */
export function useAdminPayments(params = {}) {
  return useQuery({
    queryKey: ['admin', 'payments', params],
    queryFn: () => requestFull({ url: '/admin/payments', params }),
    keepPreviousData: true,
  });
}

export function useAdminPayment(txnId, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['admin', 'payment', txnId],
    queryFn: () => request({ url: `/admin/payments/${txnId}` }),
    select: (d) => d?.payment,
    enabled: Boolean(txnId) && enabled,
  });
}

export function useApprovePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }) => request({ method: 'post', url: `/admin/payments/${id}/approve`, data: { note } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'payments'] });
      qc.invalidateQueries({ queryKey: ['admin', 'payment'] });
    },
  });
}

export function useDenyPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }) => request({ method: 'post', url: `/admin/payments/${id}/deny`, data: { reason } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'payments'] });
      qc.invalidateQueries({ queryKey: ['admin', 'payment'] });
    },
  });
}

export function useAdminPlans() {
  return useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: () => request({ url: '/admin/plans' }),
    select: (d) => d?.plans || [],
  });
}

export function usePlanMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'plans'] });
    qc.invalidateQueries({ queryKey: ['plans'] });
  };
  return {
    create: useMutation({
      mutationFn: (payload) => request({ method: 'post', url: '/admin/plans', data: payload }),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, ...payload }) => request({ method: 'patch', url: `/admin/plans/${id}`, data: payload }),
      onSuccess: invalidate,
    }),
    deactivate: useMutation({
      mutationFn: (id) => request({ method: 'delete', url: `/admin/plans/${id}` }),
      onSuccess: invalidate,
    }),
  };
}

export function useUpdatePaymentSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => request({ method: 'patch', url: '/admin/payment-settings', data: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
      qc.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}
