import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { registerUser } from '../db/repositories/users';
import { db } from '../db';
import { updatePwaManifest, promptPwaInstall, fetchStoreInfoByCode } from '../utils/pwaHelper';
import { Skeleton } from '../components/common/Skeleton';

const Register = () => {
  const [storeCode, setStoreCode] = useState('');
  const [hasSavedStore, setHasSavedStore] = useState(false);
  const [fullname, setFullname] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // PWA & Store State
  const [storeInfo, setStoreInfo] = useState(null);
  const [isCheckingStore, setIsCheckingStore] = useState(false);
  const [showInstallPopup, setShowInstallPopup] = useState(false);
  const [installManualHelp, setInstallManualHelp] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const initRegister = async () => {
      try {
        const s = await db.settings.get(1);

        // 1. Prioritaskan query param ?code=STORE02 dari URL jika ada
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
        console.warn('[Register] Belum ada pengaturan tersimpan:', err);
      }
    };

    initRegister();
  }, [searchParams]);

  // Debounce check nama store dari backend / lokal saat storeCode berubah
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
          const localSettings = await db.settings.get(1);
          if (localSettings?.storeCode?.toUpperCase() === cleanCode) {
            info = {
              code: cleanCode,
              name: localSettings.namaLaundry || 'Kasir Laundry',
              address: localSettings.alamat || '',
              city: localSettings.kota || '',
              phone: localSettings.telepon || '',
            };
          }
        }

        if (info) {
          setStoreInfo(info);
          setHasSavedStore(true);
          updatePwaManifest(info.name);
          localStorage.setItem('last_store_code', cleanCode);
          db.settings.update(1, { storeCode: cleanCode, namaLaundry: info.name }).catch(() => {});

          // Munculkan popup HANYA jika belum pernah install PWA dan belum di-dismiss
          const localSettings = await db.settings.get(1);
          const isInstalled = localSettings?.isAppInstalled === true || localStorage.getItem('pwa_user_clicked_install') === 'true';
          const dismissed = sessionStorage.getItem(`pwa_dismissed_${cleanCode}`);
          if (!dismissed && !isInstalled) {
            setShowInstallPopup(true);
          }
        } else {
          setStoreInfo(null);
          setHasSavedStore(false);
        }
      } catch (err) {
        console.warn('[Register] Gagal memeriksa kode toko:', err);
      } finally {
        setIsCheckingStore(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [storeCode]);

  const handleInstallApp = async () => {
    try {
      await db.settings.update(1, { isAppInstalled: true, appInstalledAt: new Date() });
    } catch (e) {
      console.warn('[PWA] Gagal simpan status install ke Dexie:', e);
    }
    localStorage.setItem('pwa_user_clicked_install', 'true');

    const res = await promptPwaInstall();
    if (res?.outcome === 'accepted') {
      setInstallSuccess(true);
      setTimeout(() => {
        setShowInstallPopup(false);
        setInstallSuccess(false);
      }, 2000);
    } else {
      setInstallManualHelp(true);
    }
  };

  const handleCloseInstallPopup = () => {
    if (storeInfo?.code) {
      sessionStorage.setItem(`pwa_dismissed_${storeInfo.code}`, 'true');
    }
    setShowInstallPopup(false);
    setInstallManualHelp(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setMessage('');
    setLoading(true);

    try {
      await registerUser({
        storeCode: storeCode.trim().toUpperCase(),
        fullname,
        username,
        password,
        role: 'owner', // Role di-hardcode menjadi owner
      });

      setIsSuccess(true);
      setMessage('Registrasi Owner berhasil! Mengalihkan ke halaman login...');
      setTimeout(() => navigate('/login'), 1800);
    } catch (err) {
      setIsSuccess(false);
      setMessage(err.message || 'Gagal registrasi.');
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
      {/* Modal Popup Install PWA Android / Desktop */}
      {showInstallPopup && storeInfo && (
        <>
          <div
            className="modal-backdrop fade show"
            style={{
              backdropFilter: 'blur(6px)',
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              zIndex: 1080,
            }}
            onClick={handleCloseInstallPopup}
          ></div>
          <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1085 }}>
            <div className="modal-dialog modal-dialog-centered mx-auto px-3" style={{ maxWidth: '380px' }}>
              <div className="modal-content border-0 shadow-lg text-center p-4" style={{ borderRadius: '24px' }}>
                {/* Close Button Top Right */}
                <button
                  type="button"
                  className="btn-close position-absolute top-0 end-0 m-3 shadow-none"
                  aria-label="Close"
                  onClick={handleCloseInstallPopup}
                ></button>

                {/* App Icon Preview */}
                <div
                  className="mx-auto d-flex align-items-center justify-content-center shadow-sm mb-3"
                  style={{
                    width: '68px',
                    height: '68px',
                    background: 'linear-gradient(135deg, #0134d4 0%, #2855e1 100%)',
                    borderRadius: '20px',
                  }}
                >
                  <i className="bi bi-phone text-white fs-1"></i>
                </div>

                <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill px-3 py-1 mb-2 fw-semibold" style={{ fontSize: '11px' }}>
                  Aplikasi Siap Diinstall
                </span>

                <h5 className="fw-bold mb-1 text-dark" style={{ letterSpacing: '-0.3px' }}>
                  Install Aplikasi {storeInfo.name}
                </h5>
                <p className="text-muted small mb-3" style={{ fontSize: '12px', lineHeight: '1.5' }}>
                  Pasang aplikasi kasir <strong>{storeInfo.name}</strong> langsung di layar utama smartphone Android Anda untuk akses cepat &amp; fitur offline.
                </p>

                {/* Outlet Details Card */}
                <div className="bg-light p-3 rounded-3 mb-3 text-start small border">
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Nama App:</span>
                    <span className="fw-bold text-dark text-truncate ps-2">{storeInfo.name}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Kode Toko:</span>
                    <span className="badge bg-secondary-subtle text-dark border px-2 py-0.5">{storeInfo.code}</span>
                  </div>
                  {storeInfo.address && (
                    <div className="d-flex justify-content-between">
                      <span className="text-muted">Alamat:</span>
                      <span className="text-dark text-truncate ps-2" style={{ maxWidth: '180px' }}>{storeInfo.address}</span>
                    </div>
                  )}
                </div>

                {/* Status Sukses Install */}
                {installSuccess ? (
                  <div className="alert alert-success py-2 px-3 rounded-3 small mb-2 d-flex align-items-center justify-content-center gap-2">
                    <i className="bi bi-check-circle-fill"></i>
                    <span>Aplikasi berhasil dipasang di perangkat!</span>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary btn-lg rounded-pill fw-bold w-100 shadow-sm mb-2 d-flex align-items-center justify-content-center gap-2"
                      style={{ fontSize: '14px', height: '46px', backgroundColor: '#0134d4', borderColor: '#0134d4' }}
                      onClick={handleInstallApp}
                    >
                      <i className="bi bi-download"></i>
                      <span>Install Aplikasi Sekarang</span>
                    </button>

                    {installManualHelp && (
                      <div className="alert alert-info py-2 px-3 text-start rounded-3 mb-2 small" style={{ fontSize: '11px', lineHeight: '1.4' }}>
                        <i className="bi bi-info-circle-fill me-1"></i>
                        Jika prompt tidak muncul otomatis:
                        <br />
                        Buka menu browser titik 3 (<strong>⋮</strong>) di pojok kanan atas, lalu pilih <strong>&quot;Tambahkan ke Layar Utama&quot;</strong> atau <strong>&quot;Install Aplikasi&quot;</strong>.
                      </div>
                    )}

                    <button
                      type="button"
                      className="btn btn-light rounded-pill py-2 w-100 text-muted fw-semibold"
                      style={{ fontSize: '13px' }}
                      onClick={handleCloseInstallPopup}
                    >
                      Lanjut Registrasi Dulu
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}

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
                {storeInfo?.name ? `Pendaftaran Akun Owner - ${storeInfo.name}` : 'Pendaftaran Akun Owner Toko'}
              </p>
            </div>

            <div className="register-form">
              <h5 className="mb-3 text-center fw-bold text-dark" style={{ fontSize: '16px' }}>
                Register Akun Owner
              </h5>

              {message && (
                <div className={`alert ${isSuccess ? 'alert-success' : 'alert-danger'} rounded-3 py-2 px-3 small mb-3`} role="alert" style={{ fontSize: '12.5px' }}>
                  {message}
                </div>
              )}

              <form onSubmit={handleRegister}>
                {/* Kode Toko */}
                <div className="form-group mb-2.5">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <label className="form-label small fw-bold text-muted mb-0" style={{ fontSize: '12px' }}>
                      Kode Toko <span className="text-danger">*</span>
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
                      height: '42px',
                      backgroundColor: '#f8fafc',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: '10px',
                      fontSize: '15px',
                      padding: '8px 14px',
                    }}
                    type="text"
                    placeholder="Masukkan Kode Toko"
                    value={storeCode}
                    onChange={(e) => setStoreCode(e.target.value.toUpperCase())}
                    required
                  />

                  {/* Outlet Terdeteksi Card */}
                  {storeInfo && (
                    <div
                      className="mt-2 p-2 px-3 rounded-3 d-flex align-items-center justify-content-between"
                      style={{
                        backgroundColor: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: '10px',
                      }}
                    >
                      <div className="d-flex align-items-center gap-2 overflow-hidden me-2" style={{ minWidth: 0 }}>
                        <i className="bi bi-patch-check-fill text-primary flex-shrink-0" style={{ fontSize: '16px' }}></i>
                        <div className="overflow-hidden">
                          <div className="fw-bold text-primary text-truncate" style={{ fontSize: '13px', lineHeight: 1.2 }}>
                            {storeInfo.name}
                          </div>
                          <span className="text-muted d-block" style={{ fontSize: '10px' }}>
                            Outlet Terdeteksi
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm rounded-pill px-2.5 py-1 fw-bold flex-shrink-0 d-flex align-items-center gap-1 shadow-xs"
                        style={{ fontSize: '11px', backgroundColor: '#0134d4', color: '#fff', border: 'none' }}
                        onClick={() => setShowInstallPopup(true)}
                      >
                        <i className="bi bi-phone"></i>
                        <span>Install</span>
                      </button>
                    </div>
                  )}

                  {!storeInfo && (
                    <div className="form-text text-muted mt-1" style={{ fontSize: '11px' }}>
                      Diberikan oleh administrator sistem saat outlet didaftarkan.
                    </div>
                  )}
                </div>

                {/* Nama Lengkap */}
                <div className="form-group mb-2.5">
                  <label className="form-label small fw-bold text-muted mb-1" style={{ fontSize: '12px' }}>
                    Nama Lengkap
                  </label>
                  <input
                    className="form-control"
                    style={{
                      height: '42px',
                      backgroundColor: '#f8fafc',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: '10px',
                      fontSize: '14px',
                      color: '#0f172a',
                      padding: '8px 14px',
                    }}
                    type="text"
                    placeholder="Masukkan nama lengkap"
                    value={fullname}
                    onChange={(e) => setFullname(e.target.value)}
                    required
                  />
                </div>

                {/* Username */}
                <div className="form-group mb-2.5">
                  <label className="form-label small fw-bold text-muted mb-1" style={{ fontSize: '12px' }}>
                    Username
                  </label>
                  <input
                    className="form-control"
                    style={{
                      height: '42px',
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
                <div className="form-group mb-3">
                  <label className="form-label small fw-bold text-muted mb-1" style={{ fontSize: '12px' }}>
                    Password
                  </label>
                  <input
                    className="form-control"
                    style={{
                      height: '42px',
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
                  {loading ? 'Memproses...' : 'Daftar'}
                </button>
              </form>
            </div>

            {/* Footer */}
            <div className="login-meta-data text-center mt-3 pt-1">
              <p className="mb-0 text-muted" style={{ fontSize: '13px' }}>
                Sudah punya akun?{' '}
                <Link to="/login" className="fw-bold text-decoration-none" style={{ color: '#0134d4' }}>
                  Login di sini
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
