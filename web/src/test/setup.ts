import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// jsdom'da olmayan tarayıcı API'leri
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

class IO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// @ts-expect-error test ortamı için basit IntersectionObserver
window.IntersectionObserver = IO;
