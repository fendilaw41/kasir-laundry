import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { loginUser } from '../db/repositories/users';
import { db } from '../db';
import { fetchStoreInfoByCode, updatePwaManifest } from '../utils/pwaHelper';
import { Skeleton } from '../components/common/Skeleton';

const Login = ({ onLogin }) => {
  const [storeCode, setStoreCode] = useState('');
  const [hasSavedStore, setHasSavedStore] = useState(false);
  const [isPwaInstalled, setIsPwaInstalled] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [storeInfo, setStoreInfo] = useState(null);
  const [isCheckingStore, setIsCheckingStore] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/';

  useEffect(() => {
    const initLogin = async () => {
      try {
        const s = await db.settings.get(1);

        // 1. Cek apakah aplikasi sudah diinstall (PWA standalone / cache Dexie)
        const standalone = typeof window !== 'undefined' && (
          window.matchMedia('(display-mode: standalone)').matches ||
          window.navigator.standalone === true ||
          document.referrer.includes('android-app://')
        );
        const installed = standalone || s?.isAppInstalled === true || localStorage.getItem('pwa_user_clicked_install') === 'true';
        if (installed) {
          setIsPwaInstalled(true);
          if (!s?.isAppInstalled) {
            await db.settings.update(1, { isAppInstalled: true });
          }
        }

        // 2. Cek apakah ada storeCode dari URL, Dexie settings, atau localStorage
        const urlCode = searchParams.get('code');
        const savedCode = urlCode
          ? urlCode.trim().toUpperCase()
          : (s?.storeCode || localStorage.getItem('last_store_code') || '').trim().toUpperCase();

        if (savedCode) {
          setStoreCode(savedCode);
          if (s?.storeCode && s.storeCode.toUpperCase() === savedCode && s.namaLaundry) {
            setStoreInfo({
              code: savedCode,
              name: s.namaLaundry,
              address: s.alamat || '',
              city: s.kota || '',
              phone: s.telepon || '',
            });
            setHasSavedStore(true);
          }
        }
      } catch (err) {
        console.warn('[Login] Belum ada pengaturan tersimpan:', err);
      }
    };

    initLogin();
  }, [searchParams]);

  // Cek nama toko dari backend / lokal saat storeCode berubah
  useEffect(() => {
    const cleanCode = storeCode.trim().toUpperCase();
    if (!cleanCode || cleanCode.length < 3) {
      setStoreInfo(null);
      setHasSavedStore(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingStore(true);
      try {
        let info = await fetchStoreInfoByCode(cleanCode);

        // Fallback ke Dexie lokal jika offline / cocok
        if (!info) {
          const s = await db.settings.get(1);
          if (s?.storeCode?.toUpperCase() === cleanCode) {
            info = {
              code: cleanCode,
              name: s.namaLaundry || 'Kasir Laundry',
              address: s.alamat || '',
              city: s.kota || '',
              phone: s.telepon || '',
            };
          }
        }

        if (info) {
          setStoreInfo(info);
          setHasSavedStore(true);
          updatePwaManifest(info.name);
          localStorage.setItem('last_store_code', cleanCode);
          // Simpan permanen ke Dexie db.settings selamanya
          db.settings.update(1, {
            storeCode: cleanCode,
            namaLaundry: info.name,
          }).catch(() => {});
        } else {
          setStoreInfo(null);
          setHasSavedStore(false);
        }
      } catch (err) {
        console.warn('[Login] Gagal cek info toko:', err);
      } finally {
        setIsCheckingStore(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [storeCode]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await loginUser(username, password, storeCode.trim().toUpperCase());
      onLogin(user);
      navigate(redirectPath, { replace: true });
    } catch (err) {
      setError(err.message || 'Gagal login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="login-wrapper d-flex align-items-start align-items-sm-center justify-content-center w-100 py-3 py-sm-4"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100vh',
        overflowY: 'auto',
        backgroundColor: '#f1f5f9',
        zIndex: 1050,
      }}
    >
      <div className="container px-3" style={{ maxWidth: '440px' }}>
        <div
          className="card border-0 shadow-sm"
          style={{
            borderRadius: '20px',
            backgroundColor: '#ffffff',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03)',
            border: '1px solid #e2e8f0',
          }}
        >
          <div className="card-body p-4">
            {/* Header Logo & Title */}
            <div className="text-center mb-3">
              <div
                className="mx-auto d-flex align-items-center justify-content-center shadow-sm"
                style={{
                  width: '64px',
                  height: '64px',
                  background: 'linear-gradient(135deg, #0134d4 0%, #2855e1 100%)',
                  borderRadius: '18px',
                  marginBottom: '12px',
                  boxShadow: '0 8px 16px -4px rgba(1, 52, 212, 0.35)',
                }}
              >
                <span style={{ fontSize: '32px', fontWeight: '900', color: '#fff', letterSpacing: '-1px' }}>
                  {storeInfo?.name ? storeInfo.name.charAt(0).toUpperCase() : 'K'}
                </span>
              </div>
              {isCheckingStore ? (
                <div className="d-flex justify-content-center my-1">
                  <Skeleton width="180px" height="26px" borderRadius="8px" />
                </div>
              ) : (
                <h4
                  className="fw-bold mb-1"
                  style={{
                    letterSpacing: '0.3px',
                    color: '#0134d4',
                    fontSize: '1.25rem',
                  }}
                >
                  {(storeInfo?.name || 'KASIR LAUNDRY').toUpperCase()}
                </h4>
              )}
              <p className="text-muted small mb-0" style={{ fontSize: '12px' }}>
                {storeInfo?.name ? `Sistem Manajemen & Kasir - ${storeInfo.name}` : 'Sistem Manajemen & Kasir Toko'}
              </p>
            </div>

            <div className="login-form">
              <h5 className="mb-3 text-center fw-bold text-dark" style={{ fontSize: '16px' }}>
                Log In
              </h5>

              {error && (
                <div className="alert alert-danger rounded-3 py-2 px-3 small mb-3" role="alert" style={{ fontSize: '12.5px' }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin}>
                {/* Kode Toko: Hanya tampilkan input jika BELUM ADA toko tersimpan di Dexie */}
                {!hasSavedStore && (
                  <div className="form-group mb-3">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <label className="form-label small fw-bold text-muted mb-0" style={{ fontSize: '12px' }}>
                        Kode Toko
                      </label>
                      {isCheckingStore && (
                        <span className="small text-muted d-flex align-items-center gap-1" style={{ fontSize: '11px' }}>
                          <span className="spinner-border spinner-border-sm" role="status" style={{ width: '10px', height: '10px' }}></span>
                          Cek toko...
                        </span>
                      )}
                    </div>
                    <input
                      className="form-control fw-bold text-primary"
                      style={{
                        height: '44px',
                        backgroundColor: '#f8fafc',
                        border: '1.5px solid #cbd5e1',
                        borderRadius: '10px',
                        fontSize: '15px',
                        padding: '8px 14px',
                      }}
                      type="text"
                      placeholder="Masukan Kode Toko (contoh: STORE02)"
                      value={storeCode}
                      onChange={(e) => setStoreCode(e.target.value.toUpperCase())}
                    />
                    <div className="form-text text-muted mt-1" style={{ fontSize: '11px' }}>
                      Masukkan kode toko tempat Anda terdaftar.
                    </div>
                  </div>
                )}

                {/* Outlet Aktif Card: Tampil permanen jika toko tersimpan di Dexie */}
                {storeInfo && (
                  <div className="form-group mb-3">
                    <div
                      className="p-2 px-3 rounded-3 d-flex align-items-center justify-content-between shadow-xs"
                      style={{
                        backgroundColor: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: '12px',
                      }}
                    >
                      <div className="d-flex align-items-center gap-2 overflow-hidden me-2" style={{ minWidth: 0 }}>
                        <i className="bi bi-patch-check-fill text-primary flex-shrink-0" style={{ fontSize: '18px' }}></i>
                        <div className="overflow-hidden">
                          <div className="fw-bold text-primary text-truncate" style={{ fontSize: '12.5px', lineHeight: 1.2 }}>
                            {storeInfo.name}
                          </div>
                          <span className="text-muted d-block" style={{ fontSize: '10px' }}>
                            Outlet Aktif
                          </span>
                        </div>
                      </div>
                      <span
                        className="badge rounded-pill px-2.5 py-1 text-white flex-shrink-0"
                        style={{ backgroundColor: '#0134d4', fontSize: '11px', fontWeight: '600' }}
                      >
                        {storeInfo.code}
                      </span>
                    </div>
                  </div>
                )}

                {/* Username */}
                <div className="form-group mb-3">
                  <label className="form-label small fw-bold text-muted mb-1" style={{ fontSize: '12px' }}>
                    Username
                  </label>
                  <input
                    className="form-control"
                    style={{
                      height: '44px',
                      backgroundColor: '#f8fafc',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: '10px',
                      fontSize: '14px',
                      color: '#0f172a',
                      padding: '8px 14px',
                    }}
                    type="text"
                    placeholder="Masukkan username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>

                {/* Password */}
                <div className="form-group mb-4">
                  <label className="form-label small fw-bold text-muted mb-1" style={{ fontSize: '12px' }}>
                    Password
                  </label>
                  <input
                    className="form-control"
                    style={{
                      height: '44px',
                      backgroundColor: '#f8fafc',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: '10px',
                      fontSize: '14px',
                      color: '#0f172a',
                      padding: '8px 14px',
                    }}
                    type="password"
                    placeholder="Masukkan password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                {/* Submit Button */}
                <button
                  className="btn btn-primary w-100 fw-bold shadow-sm"
                  style={{
                    height: '46px',
                    borderRadius: '12px',
                    fontSize: '15px',
                    backgroundColor: '#0134d4',
                    borderColor: '#0134d4',
                    boxShadow: '0 4px 12px rgba(1, 52, 212, 0.25)',
                  }}
                  type="submit"
                  disabled={loading}
                >
                  {loading ? 'Memeriksa...' : 'Log In'}
                </button>
              </form>
            </div>

            {/* Footer: Jika sudah pernah install aplikasi PWA maka link to register dihilangkan */}
            {!isPwaInstalled && (
              <div className="login-meta-data text-center mt-3 pt-1">
                <p className="mb-0 text-muted" style={{ fontSize: '13px' }}>
                  Belum punya akun?{' '}
                  <Link to="/register" className="fw-bold text-decoration-none" style={{ color: '#0134d4' }}>
                    Register sekarang
                  </Link>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
