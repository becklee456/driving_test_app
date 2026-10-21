import { useQuery } from '@tanstack/react-query';
import { request } from '../lib/api.js';

export function useTestimonials() {
  return useQuery({
    queryKey: ['testimonials'],
    queryFn: () => request({ url: '/testimonials' }),
    select: (d) => d.testimonials || [],
  });
}

export default useTestimonials;
