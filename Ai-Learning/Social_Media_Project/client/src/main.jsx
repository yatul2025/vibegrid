import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary';
import { registerServiceWorker } from './services/pwaManager';
import './styles/index.css';

// Initialize PWA Service Worker
registerServiceWorker();

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
} else {
  console.error('Root element #root not found in document.');
}

