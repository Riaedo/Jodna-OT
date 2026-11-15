import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext';
import { MoneyVisibilityProvider } from './context/MoneyVisibilityContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <MoneyVisibilityProvider>
      <App />
    </MoneyVisibilityProvider>
  </AuthProvider>
);
