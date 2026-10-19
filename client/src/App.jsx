import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient.js';
import { ToastProvider } from './context/ToastContext.jsx';
import { SettingsProvider } from './context/SettingsContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import AppRoutes from './routes/index.jsx';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <SettingsProvider>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </SettingsProvider>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
