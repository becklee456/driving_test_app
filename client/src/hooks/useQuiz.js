import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request, requestFull } from '../lib/api.js';

export function useActiveQuiz({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['quiz', 'active'],
    queryFn: () => request({ url: '/quizzes/active' }),
    enabled,
  });
}

export function useQuizList(params = {}) {
  return useQuery({
    queryKey: ['quizzes', params],
    queryFn: () => requestFull({ url: '/quizzes', params }),
    keepPreviousData: true,
  });
}

export function useQuiz(id, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['quiz', id],
    queryFn: () => request({ url: `/quizzes/${id}` }),
    enabled: Boolean(id) && enabled,
  });
}

export function useQuizResult(id, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['quiz', id, 'result'],
    queryFn: () => request({ url: `/quizzes/${id}/result` }),
    enabled: Boolean(id) && enabled,
  });
}

export function useStartQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => request({ method: 'post', url: '/quizzes', data: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quiz', 'active'] });
      qc.invalidateQueries({ queryKey: ['progress'] });
    },
  });
}

export function useSaveAnswer() {
  return useMutation({
    mutationFn: ({ quizId, ...payload }) => request({ method: 'post', url: `/quizzes/${quizId}/answers`, data: payload }),
  });
}

export function useSubmitQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ quizId, ...payload }) => request({ method: 'post', url: `/quizzes/${quizId}/submit`, data: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['progress'] });
      qc.invalidateQueries({ queryKey: ['quizzes'] });
      qc.invalidateQueries({ queryKey: ['quiz', 'active'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useDeleteQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => request({ method: 'delete', url: `/quizzes/${id}` }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quizzes'] }),
  });
}
