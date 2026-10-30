import React, { useState, useEffect } from 'react';
import { isOfflineExceeded3Days, updateConnectivityState, initOfflineGuardListener } from '../utils/offlineGuard';

export const OfflineAlertBanner = () => {
  const [showWarning, setShowWarning] = useState(false);
  const [checking, setChecking] = useState(false);

  const checkStatus = () => {
    updateConnectivityState();
    setShowWarning(isOfflineExceeded3Days());
  };

  useEffect(() => {
    initOfflineGuardListener();
    checkStatus();

    const handleConnectivity = () => {
      checkStatus();
    };

    window.addEventListener('connectivityChanged', handleConnectivity);
    // Cek setiap 30 detik untuk memperbarui status
    const interval = setInterval(checkStatus, 30000);

    return () => {
      window.removeEventListener('connectivityChanged', handleConnectivity);
      clearInterval(interval);
    };
  }, []);

  const handleManualCheck = async () => {
    setChecking(true);
    try {
      updateConnectivityState();
      // Tes koneksi ringan ke endpoint jika browser online
      if (navigator.onLine) {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
        await fetch(`${apiUrl}/chat/config`, { method: 'GET', cache: 'no-store' });
        localStorage.removeItem('kasir_offline_since');
      }
    } catch {
      // Tetap offline
    } finally {
      checkStatus();
      setChecking(false);
    }
  };

  if (!showWarning) {
    return null;
  }

  return (
    <div
      className="alert alert-warning border-0 shadow-sm mx-3 mt-2 mb-3 py-2 px-3 d-flex align-items-center justify-content-between"
      style={{
        borderRadius: '12px',
        backgroundColor: '#fff3cd',
        color: '#664d03',
        borderLeft: '4px solid #ffc107',
      }}
      role="alert"
    >
      <div className="d-flex align-items-center gap-2">
        <span style={{ fontSize: '1.25rem' }}>⚠️</span>
        <span className="fw-semibold" style={{ fontSize: '0.875rem' }}>
          Sudah 3 hari offline! Sambung internet yuk, biar data &amp; foto kasir langsung sinkron aman.
        </span>
      </div>
      <button
        type="button"
        className="btn btn-sm btn-outline-warning text-dark fw-bold px-2 py-1 ms-2"
        style={{ fontSize: '0.75rem', borderRadius: '8px' }}
        onClick={handleManualCheck}
        disabled={checking}
      >
        {checking ? 'Memeriksa...' : 'Cek Koneksi'}
      </button>
    </div>
  );
};

export default OfflineAlertBanner;

