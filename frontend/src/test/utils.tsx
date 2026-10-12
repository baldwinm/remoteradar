import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { vi } from 'vitest';

/** Responds to fetch calls by matching the request path against `routes`. */
export function mockApi(routes: Record<string, unknown>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL(String(input), 'http://localhost');
    const key = Object.keys(routes).find((path) => url.pathname + url.search === path || url.pathname === path);
    if (!key) return new Response(JSON.stringify({ error: 'not_found', message: 'Not found.' }), { status: 404 });
    return new Response(JSON.stringify(routes[key]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
}

export function renderWithProviders(ui: ReactElement, { path = '/', route = '/' } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={path} element={ui} />
          <Route path="*" element={<div data-testid="other-route" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
