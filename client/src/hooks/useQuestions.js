import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request, requestFull } from '../lib/api.js';

export function useQuestions(params = {}, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['questions', params],
    queryFn: () => requestFull({ url: '/questions', params }),
    enabled,
    keepPreviousData: true,
  });
}

export function useQuestion(id, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['question', id],
    queryFn: () => request({ url: `/questions/${id}` }),
    select: (data) => data.question,
    enabled: Boolean(id) && enabled,
  });
}

export function useAdminQuestions(params = {}, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['admin', 'questions', params],
    queryFn: () => requestFull({ url: '/admin/questions', params }),
    enabled,
    keepPreviousData: true,
  });
}

export function useAdminQuestion(id, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['admin', 'question', id],
    queryFn: () => request({ url: `/admin/questions/${id}` }),
    select: (data) => data.question,
    enabled: Boolean(id) && enabled,
  });
}

export function useQuestionStats({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['admin', 'question-stats'],
    queryFn: () => request({ url: '/admin/questions/stats' }),
    enabled,
  });
}

function useInvalidateQuestions() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['admin', 'questions'] });
    qc.invalidateQueries({ queryKey: ['admin', 'question-stats'] });
    qc.invalidateQueries({ queryKey: ['questions'] });
    qc.invalidateQueries({ queryKey: ['categories'] });
  };
}

export function useCreateQuestion() {
  const invalidate = useInvalidateQuestions();
  return useMutation({
    mutationFn: (payload) => request({ method: 'post', url: '/admin/questions', data: payload }),
    onSuccess: invalidate,
  });
}

export function useUpdateQuestion() {
  const invalidate = useInvalidateQuestions();
  return useMutation({
    mutationFn: ({ id, ...payload }) => request({ method: 'patch', url: `/admin/questions/${id}`, data: payload }),
    onSuccess: invalidate,
  });
}

export function useDeleteQuestion() {
  const invalidate = useInvalidateQuestions();
  return useMutation({
    mutationFn: (id) => request({ method: 'delete', url: `/admin/questions/${id}` }),
    onSuccess: invalidate,
  });
}

export function useBulkQuestions() {
  const invalidate = useInvalidateQuestions();
  return useMutation({
    mutationFn: (payload) => request({ method: 'post', url: '/admin/questions/bulk', data: payload }),
    onSuccess: invalidate,
  });
}
