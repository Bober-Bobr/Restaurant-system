import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app/App';
import { routerBasename } from './utils/subdomain';
import { applyAppTitle } from './utils/applyAppTitle';
import './index.css';

const queryClient = new QueryClient();

// Before the first render, not in an effect: an effect runs after the first
// paint, so the tab would briefly show whatever index.html shipped with. The
// App re-applies this whenever the signed-in role changes.
applyAppTitle();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={routerBasename()}>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
