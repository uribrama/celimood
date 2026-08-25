import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import { App } from './app/App';

// Instalada como PWA, el SO suele dejar la app viva en background —
// reabrirla desde el ícono no siempre dispara una navegación de red real,
// así que el browser nunca chequea si hay un service worker nuevo (a
// diferencia de entrar desde una pestaña, que sí navega). Forzamos el
// chequeo al volver a foreground para que no dependa de eso.
const updateSW = registerSW({ immediate: true });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') updateSW();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
