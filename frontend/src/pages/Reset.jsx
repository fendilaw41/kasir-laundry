import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { clearAllLocalData } from '../utils/storageReset';
import { db } from '../db';

export default function Reset({ user }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isResetting, setIsResetting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [unsyncedCount, setUnsyncedCount] = useState(0);

  // Periksa apakah pengguna saat ini sudah login
  const checkIsLoggedIn = () => {
    if (user) return true;
    try {
      const sessionUser = sessionStorage.getItem('user');
      const token = sessionStorage.getItem('token') || localStorage.getItem('auth_token');
      if (sessionUser || token) return true;
    } catch {}
    return false;
  };

  const isLoggedIn = checkIsLoggedIn();

  // Cek apakah ada data lokal yang belum tersinkron
  useEffect(() => {
    const checkUnsynced = async () => {
      try {
        if (db && db.orders) {
          const count = await db.orders.filter((o) => o.isDirty === 1).count();
          setUnsyncedCount(count);
        }
      } catch (e) {
        console.warn('Gagal membaca data offline yang belum tersinkron:', e);
      }
    };
    checkUnsynced();
  }, []);

  const handleReset = async () => {
    if (!checkIsLoggedIn()) {
      navigate('/login?redirect=' + encodeURIComponent('/reset'));
      return;
    }

    setShowConfirmModal(false);
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
      if (!checkIsLoggedIn()) {
        navigate('/login?redirect=' + encodeURIComponent('/reset?auto=true'));
      } else {
        handleReset();
      }
    }
  }, [searchParams]);

  return (
    <div className="min-vh-90 d-flex align-items-center justify-content-center bg-light p-3 position-relative">
      <div className="card border-0 shadow-lg" style={{ maxWidth: '480px', width: '100%', borderRadius: '24px' }}>
        {/* Header dengan tombol kembali */}
        <div className="card-header bg-transparent border-0 pt-4 px-4 pb-0 d-flex align-items-center justify-content-between">
          <button
            type="button"
            className="btn btn-sm btn-light rounded-circle shadow-xs d-flex align-items-center justify-content-center"
            style={{ width: '38px', height: '38px' }}
            onClick={() => (isLoggedIn ? navigate('/setting') : navigate('/login'))}
            title="Kembali"
          >
            <i className="bi bi-arrow-left fs-5 text-dark"></i>
          </button>
          <span className="badge rounded-pill bg-primary-subtle text-primary px-3 py-1 fw-semibold" style={{ fontSize: '0.75rem' }}>
            Pemeliharaan Sistem
          </span>
        </div>

        <div className="card-body p-4 p-md-5 text-center">
          {/* Ikon Animasi / Visual */}
          <div
            className="rounded-circle d-inline-flex align-items-center justify-content-center mb-4 shadow-sm"
            style={{
              width: '84px',
              height: '84px',
              backgroundColor: isResetting ? '#e0f2fe' : '#fee2e2',
              color: isResetting ? '#0284c7' : '#dc2626',
              fontSize: '2.5rem',
            }}
          >
            {isResetting ? (
              <span className="spinner-border spinner-border-lg" role="status"></span>
            ) : (
              <i className="bi bi-arrow-repeat"></i>
            )}
          </div>

          <h4 className="fw-bold text-dark mb-2">Reset Data Offline</h4>
          <p className="text-muted small mb-4" style={{ fontSize: '0.84rem' }}>
            Fitur ini digunakan jika aplikasi terasa berat, tampilan belum terupdate ke versi terbaru, atau mengalami kendala sinkronisasi.
          </p>

          {statusMessage && (
            <div className="alert alert-info py-2 px-3 small rounded-pill mb-4 shadow-xs">
              {statusMessage}
            </div>
          )}

          {/* Tombol Aksi */}
          <div className="d-grid gap-0">
            <button
              type="button"
              className="btn btn-danger rounded-pill py-3 mb-2 fw-bold shadow-sm"
              onClick={() => setShowConfirmModal(true)}
              disabled={isResetting}
            >
              <i className="bi bi-trash3-fill me-2"></i>
              {isResetting ? 'Sedang Mereset...' : 'Bersihkan'}
            </button>

            <button
              type="button"
              className="btn btn-outline-secondary rounded-pill py-2 fw-semibold"
              onClick={() => (isLoggedIn ? navigate('/setting') : navigate('/login'))}
              disabled={isResetting}
            >
              {isLoggedIn ? 'Kembali ke Pengaturan' : 'Ke Halaman Login'}
            </button>
          </div>
        </div>
      </div>

      {/* Modal Konfirmasi Reset Cache */}
      {showConfirmModal && (
        <>
          <div className="modal-backdrop fade show" style={{ backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1075 }}></div>
          <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1080 }}>
            <div className="modal-dialog modal-dialog-centered mx-auto" style={{ maxWidth: '340px' }}>
              <div className="modal-content border-0 shadow-lg text-center p-4" style={{ borderRadius: '24px' }}>
                <div
                  className="rounded-circle d-inline-flex align-items-center justify-content-center mx-auto mb-3"
                  style={{ width: '56px', height: '56px', backgroundColor: '#fee2e2', color: '#dc2626' }}
                >
                  <i className="bi bi-exclamation-triangle-fill fs-3"></i>
                </div>
                <h5 className="fw-bold mb-2">Konfirmasi Reset Cache</h5>
                <p className="text-muted small mb-4" style={{ fontSize: '0.82rem' }}>
                  Tindakan ini akan membersihkan seluruh cache lokal dan mengakhiri sesi login saat ini. Anda perlu login kembali setelah reset selesai. Lanjutkan?
                </p>
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-light rounded-pill flex-fill fw-bold py-2"
                    onClick={() => setShowConfirmModal(false)}
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger rounded-pill flex-fill fw-bold py-2 shadow-sm"
                    onClick={handleReset}
                  >
                    Ya, Bersihkan
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
