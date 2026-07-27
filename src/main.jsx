import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

// Registrasi Service Worker untuk PWA
registerSW({ immediate: true })

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
