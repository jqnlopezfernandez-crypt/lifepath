import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { AppStoreProvider } from './data/store';
import './styles/global.css';

// Pide a Safari que no borre el almacenamiento local (datos e imágenes).
if (navigator.storage && 'persist' in navigator.storage) {
  navigator.storage.persist().catch(() => undefined);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppStoreProvider>
      <App />
    </AppStoreProvider>
  </React.StrictMode>
);
