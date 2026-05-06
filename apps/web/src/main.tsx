import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app/App';
import { useAuthStore } from './store/auth.store';
import type { AdminRole } from './store/auth.store';
import './index.css';

// Process token handoff from URL params before first render so AdminLayout
// doesn't redirect to /login before the effect in App.tsx has a chance to run.
(function initAuthFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const at = params.get('_at');
  const rt = params.get('_rt');
  const u = params.get('_u');
  const r = params.get('_r') as AdminRole | null;
  const rid = params.get('_rid');
  const rn = params.get('_rn');
  const exp = Number(params.get('_exp') || '0');
  if (at && rt && u && r) {
    useAuthStore.getState().setAuth(at, rt, u, exp || 15 * 60 * 1000, r, rid || null, rn || null);
    window.history.replaceState({}, '', window.location.pathname);
  }
})();

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
