import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { clearAllLocalData } from '../utils/storageReset';

export default function Reset() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isResetting, setIsResetting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const handleReset = async () => {
    setIsResetting(true);
    setStatusMessage('Menghapus IndexedDB, LocalStorage, dan Cache PWA...');
    try {
      await clearAllLocalData({ reload: false });
      setStatusMessage('Pembersihan selesai! Mengalihkan ke halaman login...');
      setTimeout(() => {
        window.location.href = '/login';
      }, 800);
    } catch (err) {
      console.error(err);
      setStatusMessage('Gagal membersihkan data secara otomatis.');
      setIsResetting(false);
    }
  };

  useEffect(() => {
    // Jika URL diakses dengan parameter ?auto=true atau ?auto=1
    if (searchParams.get('auto') === 'true' || searchParams.get('auto') === '1') {
      handleReset();
    }
  }, [searchParams]);

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light p-3">
      <div className="card border-0 shadow-lg" style={{ maxWidth: '480px', width: '100%', borderRadius: '24px' }}>
        <div className="card-body p-4 p-md-5 text-center">
          <div
            className="rounded-circle d-inline-flex align-items-center justify-content-center mb-4 shadow-sm"
            style={{
              width: '80px',
              height: '80px',
              backgroundColor: isResetting ? '#e7f1ff' : '#fee2e2',
              color: isResetting ? '#0d6efd' : '#dc3545',
              fontSize: '2.5rem'
            }}
          >
            {isResetting ? (
              <span className="spinner-border spinner-border-lg" role="status"></span>
            ) : (
              <i className="bi bi-arrow-repeat"></i>
            )}
          </div>

          <h4 className="fw-bold text-dark mb-2">Reset Data</h4>
          <p className="text-muted small mb-4">
            Fitur ini akan menghapus seluruh data offline lokal di browser ini dan memuat ulang versi terbaru aplikasi.
          </p>

          {statusMessage && (
            <div className="alert alert-info py-2 px-3 small rounded-pill mb-4">
              {statusMessage}
            </div>
          )}

          <div className="d-grid gap-2">
            <button
              type="button"
              className="btn btn-danger rounded-pill py-3 fw-bold shadow-sm"
              onClick={handleReset}
              disabled={isResetting}
            >
              <i className="bi bi-trash3-fill me-2"></i>
              {isResetting ? 'Sedang Mereset...' : 'Bersihkan Data'}
            </button>

            <button
              type="button"
              className="btn btn-outline-secondary rounded-pill py-2 fw-semibold"
              onClick={() => navigate('/login')}
              disabled={isResetting}
            >
              Batal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
