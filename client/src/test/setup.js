import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

// jsdom lacks matchMedia; several components read it for theme handling.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  });
}

if (!window.scrollTo) window.scrollTo = vi.fn();

globalThis.URL.createObjectURL = globalThis.URL.createObjectURL || vi.fn(() => 'blob:mock');
globalThis.URL.revokeObjectURL = globalThis.URL.revokeObjectURL || vi.fn();
