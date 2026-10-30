import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

// Registrasi Service Worker untuk PWA
registerSW({ immediate: true })

import { clearAllLocalData } from './utils/storageReset'

// Cek jika URL memiliki parameter ?reset=true, ?reset=1, atau ?clear=true untuk reset instan
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('reset') === 'true' || urlParams.get('reset') === '1' || urlParams.get('clear') === 'true') {
  clearAllLocalData({ reload: true, redirectUrl: '/login' });
}


// Disable context menu secara global untuk mencegah popup "Salin URL" pada Android Chrome
// Namun tetap izinkan pada input dan textarea agar pengguna bisa copy/paste
window.addEventListener('contextmenu', (e) => {
  const target = e.target;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
    return;
  }
  e.preventDefault();
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
