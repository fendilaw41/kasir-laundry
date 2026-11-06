import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { loginUser } from '../db/repositories/users';
import { db } from '../db';
import { fetchStoreInfoByCode, updatePwaManifest } from '../utils/pwaHelper';
import { Skeleton } from '../components/common/Skeleton';

const Login = ({ onLogin }) => {
  const [storeCode, setStoreCode] = useState('');
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
    // 1. Prioritaskan query param ?code=STORE02 dari URL jika ada
    const urlCode = searchParams.get('code');
    if (urlCode) {
      setStoreCode(urlCode.trim().toUpperCase());
      return;
    }

    // 2. Autofill kode toko jika sudah tersimpan di browser sebelumnya
    db.settings.get(1).then((s) => {
      if (s?.storeCode) {
        setStoreCode(s.storeCode.toUpperCase());
      } else {
        const lastCode = localStorage.getItem('last_store_code');
        if (lastCode) {
          setStoreCode(lastCode.toUpperCase());
        }
      }
    }).catch((err) => {
      console.warn('[Login] Belum ada pengaturan tersimpan:', err);
    });
  }, [searchParams]);

  // Cek nama toko dari backend / lokal saat storeCode berubah
  useEffect(() => {
    const cleanCode = storeCode.trim().toUpperCase();
    if (!cleanCode || cleanCode.length < 3) {
      setStoreInfo(null);
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
          updatePwaManifest(info.name);
          localStorage.setItem('last_store_code', cleanCode);
        } else {
          setStoreInfo(null);
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
      className="login-wrapper d-flex align-items-start align-items-md-center justify-content-center w-100 py-3 py-md-4"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100vh',
        overflowY: 'auto',
        backgroundColor: '#f4f7f6',
        zIndex: 1050,
      }}
    >
      <div className="container px-3">
        <div className="row justify-content-center">
          <div className="col-12 col-sm-10 col-md-8 col-lg-6 col-xl-5">
            <div className="card p-3 p-sm-4 p-md-4 border-0 shadow-sm rounded-4">
              <div className="card-body p-0">
                {/* Header Logo & App Title */}
                <div className="text-center mb-2.5">
                  <div
                    className="mx-auto d-flex align-items-center justify-content-center shadow-sm"
                    style={{
                      width: '54px',
                      height: '54px',
                      background: 'linear-gradient(135deg, #0134d4 0%, #2855e1 100%)',
                      borderRadius: '16px',
                      marginBottom: '10px',
                    }}
                  >
                    <span style={{ fontSize: '28px', fontWeight: '900', color: '#fff', letterSpacing: '-1px' }}>
                      {storeInfo?.name ? storeInfo.name.charAt(0).toUpperCase() : 'K'}
                    </span>
                  </div>
                  {isCheckingStore ? (
                    <div className="d-flex justify-content-center my-1">
                      <Skeleton width="160px" height="24px" borderRadius="6px" />
                    </div>
                  ) : (
                    <h4 className="fw-bold mb-0" style={{ letterSpacing: '0.3px', color: '#0134d4', fontSize: '1.2rem' }}>
                      {(storeInfo?.name || 'KASIR LAUNDRY').toUpperCase()}
                    </h4>
                  )}
                  <p className="text-muted small mb-0" style={{ fontSize: '11.5px' }}>
                    {storeInfo?.name ? `Sistem Manajemen & Kasir - ${storeInfo.name}` : 'Sistem Manajemen & Kasir Toko'}
                  </p>
                </div>

                <div className="register-form mt-2">
                  <h6 className="mb-2.5 text-center fw-bold text-dark" style={{ fontSize: '14px' }}>Log In</h6>

                  {error && (
                    <div className="alert alert-danger rounded-3 py-1.5 px-3 small mb-2.5" role="alert" style={{ fontSize: '12px' }}>
                      {error}
                    </div>
                  )}

                  <form onSubmit={handleLogin}>
                    <div className="form-group mb-2">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <label className="form-label small fw-bold text-muted mb-0" style={{ fontSize: '12px' }}>
                          Kode Toko
                        </label>
                        {isCheckingStore && (
                          <span className="small text-muted d-flex align-items-center gap-1" style={{ fontSize: '10.5px' }}>
                            <span className="spinner-border spinner-border-sm" role="status" style={{ width: '9px', height: '9px' }}></span>
                            Cek toko...
                          </span>
                        )}
                      </div>
                      <input
                        className="form-control bg-light border-0 fw-bold text-primary py-2 px-3"
                        style={{ fontSize: '14px' }}
                        type="text"
                        placeholder="Masukan Kode (contoh: STORE02)"
                        value={storeCode}
                        onChange={(e) => setStoreCode(e.target.value.toUpperCase())}
                      />

                      {/* Store Detected Feedback (Compact) */}
                      {storeInfo && (
                        <div className="mt-1.5 p-1.5 px-2.5 rounded-3 border border-primary border-opacity-25 d-flex align-items-center justify-content-between" style={{ backgroundColor: '#f0f5ff' }}>
                          <div className="d-flex align-items-center gap-1.5 overflow-hidden me-2" style={{ minWidth: 0 }}>
                            <i className="bi bi-patch-check-fill text-primary flex-shrink-0" style={{ fontSize: '13px' }}></i>
                            <span className="fw-bold text-primary text-truncate" style={{ fontSize: '12px' }}>
                              {storeInfo.name}
                            </span>
                          </div>
                          <span className="badge bg-primary rounded-pill px-2 py-0.5 flex-shrink-0" style={{ fontSize: '10px' }}>
                            {storeInfo.code}
                          </span>
                        </div>
                      )}

                      {!storeInfo && (
                        <div className="form-text text-muted mt-1" style={{ fontSize: '10.5px' }}>
                          Masukkan kode toko tempat Anda terdaftar.
                        </div>
                      )}
                    </div>

                    <div className="form-group mb-2">
                      <label className="form-label small fw-bold text-muted mb-1" style={{ fontSize: '12px' }}>Username</label>
                      <input
                        className="form-control bg-light border-0 py-2 px-3"
                        style={{ fontSize: '14px' }}
                        type="text"
                        placeholder="Masukkan username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group mb-3">
                      <label className="form-label small fw-bold text-muted mb-1" style={{ fontSize: '12px' }}>Password</label>
                      <input
                        className="form-control bg-light border-0 py-2 px-3"
                        style={{ fontSize: '14px' }}
                        type="password"
                        placeholder="Masukkan password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>

                    <button
                      className="btn btn-primary w-100 fw-bold shadow-sm py-2"
                      style={{ borderRadius: '10px', fontSize: '14px' }}
                      type="submit"
                      disabled={loading}
                    >
                      {loading ? 'Memeriksa...' : 'Log In'}
                    </button>
                  </form>
                </div>

                <div className="login-meta-data text-center mt-2.5">
                  <p className="mb-0 text-muted" style={{ fontSize: '12px' }}>
                    Belum punya akun?{' '}
                    <Link to="/register" className="fw-bold text-primary text-decoration-none">
                      Register sekarang
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
