import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import './styles.css';
import { router } from './app/router';
import { queryClient } from './app/queryClient';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

const el = document.getElementById('root');
if (el) ReactDOM.createRoot(el).render(<React.StrictMode><App /></React.StrictMode>);
