import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { loginUser } from '../db/repositories/users';
import { db } from '../db';
import { fetchStoreInfoByCode, updatePwaManifest, promptPwaInstall } from '../utils/pwaHelper';
import { Skeleton } from '../components/common/Skeleton';

// Cek apakah browser mendukung WebkitTextSecurity untuk memblokir peringatan password breach Chrome
const isTextSecuritySupported =
  typeof window !== 'undefined' &&
  typeof CSS !== 'undefined' &&
  CSS.supports &&
  (CSS.supports('-webkit-text-security', 'disc') || CSS.supports('text-security', 'disc'));

const Login = ({ onLogin }) => {
  const [storeCode, setStoreCode] = useState('');
  const [hasSavedStore, setHasSavedStore] = useState(false);
  const [isPwaInstalled, setIsPwaInstalled] = useState(false);
  const [installHelp, setInstallHelp] = useState(false);
  const [savedUsernames, setSavedUsernames] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showTopInstallAlert, setShowTopInstallAlert] = useState(false);
  const [showInstallPopup, setShowInstallPopup] = useState(false);
  const [installManualHelp, setInstallManualHelp] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);
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

        // Tampilkan alert menggantung di paling atas jika belum di-install & belum 3x diabaikan
        try {
          const isForever = localStorage.getItem('pwa_dismissed_forever') === 'true';
          if (!installed && !isForever) {
            const dismissData = JSON.parse(localStorage.getItem('pwa_alert_dismiss_info') || '{}');
            const count = Number(dismissData.count) || 0;
            const today = new Date().toISOString().split('T')[0];
            if (count < 3 && dismissData.lastDate !== today) {
              setShowTopInstallAlert(true);
            }
          }
        } catch (e) {
          if (!installed) setShowTopInstallAlert(true);
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

        // 3. Baca riwayat username dari cache (localStorage) dan Dexie (db.users) untuk autocomplete
        try {
          const cachedList = JSON.parse(localStorage.getItem('saved_usernames') || '[]');
          const dbUsers = (await db.users?.toArray()) || [];
          const dbUsernames = dbUsers.map((u) => u.username).filter(Boolean);
          const lastUser = localStorage.getItem('last_logged_username') || cachedList[0] || dbUsernames[0] || '';

          const allUsernames = Array.from(
            new Set([
              ...(lastUser ? [lastUser] : []),
              ...cachedList,
              ...dbUsernames,
            ])
          ).filter((u) => typeof u === 'string' && u.trim().length > 0);

          setSavedUsernames(allUsernames);

          // Otomatis isi username dari cache sehingga user tinggal memasukkan password
          if (lastUser) {
            setUsername(lastUser);
          }
        } catch (err) {
          console.warn('[Login] Gagal membaca cache username:', err);
        }
      } catch (err) {
        console.warn('[Login] Belum ada pengaturan tersimpan:', err);
      }
    };

    initLogin();

    const handleInstalled = () => {
      setIsPwaInstalled(true);
      localStorage.setItem('pwa_user_clicked_install', 'true');
      db.settings.update(1, { isAppInstalled: true }).catch(() => {});
    };

    window.addEventListener('pwa:installed', handleInstalled);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('pwa:installed', handleInstalled);
      window.removeEventListener('appinstalled', handleInstalled);
    };
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

  // User klik close (X) pada alert menggantung: abaikan hari ini, simpan hitungan maks 3x (muncul besok pagi)
  const handleDismissTopAlert = () => {
    setShowTopInstallAlert(false);
    try {
      const today = new Date().toISOString().split('T')[0];
      const dismissData = JSON.parse(localStorage.getItem('pwa_alert_dismiss_info') || '{}');
      const newCount = (Number(dismissData.count) || 0) + 1;
      const newInfo = {
        count: newCount,
        lastDate: today,
      };
      localStorage.setItem('pwa_alert_dismiss_info', JSON.stringify(newInfo));
      if (newCount >= 3) {
        localStorage.setItem('pwa_dismissed_forever', 'true');
      }
    } catch (e) {
      console.warn('[PWA] Error simpan dismiss info:', e);
    }
  };

  const handleCloseInstallPopup = () => {
    setShowInstallPopup(false);
    setInstallManualHelp(false);
  };

  const handleInstallApp = async () => {
    try {
      await db.settings.update(1, { isAppInstalled: true, appInstalledAt: new Date() });
    } catch (e) {
      console.warn('[PWA] Gagal simpan status install ke Dexie:', e);
    }
    localStorage.setItem('pwa_user_clicked_install', 'true');
    localStorage.setItem('pwa_dismissed_forever', 'true');
    setIsPwaInstalled(true);
    setShowTopInstallAlert(false);

    try {
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
    } catch (err) {
      console.warn('[PWA] prompt error:', err);
      setInstallManualHelp(true);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await loginUser(username, password, storeCode.trim().toUpperCase());

      // Simpan username ke cache agar autocomplete dan auto-fill berfungsi di login berikutnya
      try {
        const cleanUser = username.trim();
        localStorage.setItem('last_logged_username', cleanUser);
        const existing = JSON.parse(localStorage.getItem('saved_usernames') || '[]');
        const updated = Array.from(new Set([cleanUser, ...existing]));
        localStorage.setItem('saved_usernames', JSON.stringify(updated));
      } catch (e) {
        console.warn('[Login] Gagal menyimpan username ke cache:', e);
      }

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
      {/* Alert Install PWA Menggantung Paling Atas (Muncul besok pagi jika diabaikan, maks 3x) */}
      {showTopInstallAlert && !isPwaInstalled && (
        <div
          className="position-fixed top-0 start-0 w-100 d-flex justify-content-center px-3 pt-2"
          style={{ zIndex: 1060, pointerEvents: 'none' }}
        >
          <div
            className="alert border-0 shadow-lg rounded-pill py-1.5 px-3 d-flex align-items-center justify-content-between gap-2.5 transition-all"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.96)',
              backdropFilter: 'blur(8px)',
              border: '1.5px solid #bfdbfe',
              maxWidth: '200px',
              width: '100%',
              pointerEvents: 'auto',
              boxShadow: '0 8px 24px -4px rgba(1, 52, 212, 0.25)',
            }}
          >
            {/* Tombol Install Saja di Dalam Alert */}
            <button
              type="button"
              className="btn btn-sm rounded-pill flex-fill fw-bold text-white d-flex align-items-center justify-content-center gap-1.5 shadow-xs border-0 py-1.5"
              style={{ backgroundColor: '#0134d4', fontSize: '12.5px' }}
              onClick={() => setShowInstallPopup(true)}
            >
              <i className="bi bi-phone"></i>
              <span>Install App</span>
            </button>

            {/* Tombol Close jika diabaikan */}
            <button
              type="button"
              className="btn-close shadow-none flex-shrink-0"
              style={{ fontSize: '11px', padding: '6px' }}
              aria-label="Tutup"
              onClick={handleDismissTopAlert}
              title="Abaikan untuk hari ini"
            ></button>
          </div>
        </div>
      )}

      {/* Modal Popup Panduan Install PWA Android / Desktop (Copas dari Register) */}
      {showInstallPopup && (
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
                  Install Aplikasi {storeInfo?.name || 'Kasir Laundry'}
                </h5>
                <p className="text-muted small mb-3" style={{ fontSize: '12px', lineHeight: '1.5' }}>
                  Pasang aplikasi kasir <strong>{storeInfo?.name || 'Kasir Laundry'}</strong> langsung di layar utama smartphone Android Anda untuk akses cepat &amp; fitur offline.
                </p>

                {/* Outlet Details Card */}
                {storeInfo && (
                  <div className="bg-light p-3 rounded-3 mb-3 text-start small border">
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-muted">Nama App:</span>
                      <span className="fw-bold text-dark text-truncate ps-2">{storeInfo.name}</span>
                    </div>
                    {storeInfo.code && (
                      <div className="d-flex justify-content-between mb-1">
                        <span className="text-muted">Kode Toko:</span>
                        <span className="badge bg-secondary-subtle text-dark border px-2 py-0.5">{storeInfo.code}</span>
                      </div>
                    )}
                    {storeInfo.address && (
                      <div className="d-flex justify-content-between">
                        <span className="text-muted">Alamat:</span>
                        <span className="text-dark text-truncate ps-2" style={{ maxWidth: '180px' }}>{storeInfo.address}</span>
                      </div>
                    )}
                  </div>
                )}

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
                      Nanti Saja
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

              <form onSubmit={handleLogin} autoComplete="off">
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
                            {hasSavedStore ? 'Outlet Aktif' : 'Outlet Terdeteksi'}
                          </span>
                        </div>
                      </div>

                      {/* Tombol Install PWA persis seperti di Register (Hanya muncul jika belum install) */}
                      <div className="d-flex align-items-center gap-1.5 flex-shrink-0">
                        {!isPwaInstalled ? (
                          <button
                            type="button"
                            className="btn btn-sm rounded-pill px-2.5 py-1 fw-bold flex-shrink-0 d-flex align-items-center gap-1 shadow-xs"
                            style={{ fontSize: '11px', backgroundColor: '#0134d4', color: '#fff', border: 'none' }}
                            onClick={() => setShowInstallPopup(true)}
                          >
                            <i className="bi bi-phone"></i>
                            <span>Install</span>
                          </button>
                        ) : (
                          <span
                            className="badge rounded-pill px-2.5 py-1 text-white flex-shrink-0"
                            style={{ backgroundColor: '#0134d4', fontSize: '11px', fontWeight: '600' }}
                          >
                            {storeInfo.code}
                          </span>
                        )}
                      </div>
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
                    name="username"
                    autoComplete="username"
                    list="saved-username-options"
                    placeholder="Masukkan username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />

                  {/* Datalist Browser Autocomplete dari Cache */}
                  <datalist id="saved-username-options">
                    {savedUsernames.map((u) => (
                      <option key={u} value={u} />
                    ))}
                  </datalist>
                </div>

                {/* Password */}
                <div className="form-group mb-4">
                  <label className="form-label small fw-bold text-muted mb-1" style={{ fontSize: '12px' }}>
                    Password
                  </label>
                  <div className="input-group">
                    <input
                      className="form-control"
                      style={{
                        height: '44px',
                        backgroundColor: '#f8fafc',
                        border: '1.5px solid #cbd5e1',
                        borderTopLeftRadius: '10px',
                        borderBottomLeftRadius: '10px',
                        fontSize: '14px',
                        color: '#0f172a',
                        padding: '8px 14px',
                        WebkitTextSecurity: showPassword ? 'none' : 'disc',
                      }}
                      type={isTextSecuritySupported ? 'text' : (showPassword ? 'text' : 'password')}
                      name="access_code"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck="false"
                      data-lpignore="true"
                      data-form-type="other"
                      placeholder="Masukkan password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      style={{
                        border: '1.5px solid #cbd5e1',
                        borderLeft: 'none',
                        borderTopRightRadius: '10px',
                        borderBottomRightRadius: '10px',
                        backgroundColor: '#f8fafc',
                        color: '#64748b',
                      }}
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      <i className={`bi ${showPassword ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`}></i>
                    </button>
                  </div>
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
