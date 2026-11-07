import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { AppStoreProvider } from './data/store';
import './styles/global.css';
import { registerSW } from 'virtual:pwa-register';

// Actualizaciones automáticas: al volver a la app se busca una versión nueva y,
// si la hay, se instala y la página se recarga sola. Los datos no se tocan.
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    const check = () => reg.update().catch(() => undefined);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
    setInterval(check, 30 * 60 * 1000);
  }
});

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
