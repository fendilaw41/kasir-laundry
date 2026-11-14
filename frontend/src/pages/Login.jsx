import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { loginUser } from '../db/repositories/users';
import { db } from '../db';
import { fetchStoreInfoByCode, updatePwaManifest, promptPwaInstall } from '../utils/pwaHelper';
import { Skeleton } from '../components/common/Skeleton';
import AuthShell from '../components/auth/AuthShell';

const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:3000/api';

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

  // State untuk Modal Forgot Password via WhatsApp Owner
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStoreCode, setForgotStoreCode] = useState('');
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccessData, setForgotSuccessData] = useState(null);

  const handleRequestForgotPassword = async (e) => {
    e.preventDefault();
    setForgotError('');

    const cleanCode = forgotStoreCode.trim().toUpperCase();
    const cleanUser = forgotUsername.trim();

    if (!cleanCode) {
      setForgotError('Kode Toko wajib diisi.');
      return;
    }
    if (!cleanUser) {
      setForgotError('Username wajib diisi.');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          storeCode: cleanCode,
          username: cleanUser,
          origin: window.location.origin,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.message || 'Gagal memproses permintaan reset password.');
      }

      setForgotSuccessData(json.data);
      toast.success('Tautan reset password berhasil disiapkan!');

      // Langsung buka WhatsApp owner jika tersedia
      if (json.data?.waUrl && typeof window !== 'undefined') {
        window.open(json.data.waUrl, '_blank');
      }
    } catch (err) {
      setForgotError(err.message || 'Terjadi kesalahan saat memproses reset password.');
    } finally {
      setForgotLoading(false);
    }
  };

  useEffect(() => {
    const initLogin = async () => {
      try {
        const s = await db.settings.get(1);

        // 1. Cek apakah aplikasi sudah diinstall (PWA standalone / cache Dexie)
        const standalone = typeof window !== 'undefined' && (
          (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
          window.navigator?.standalone === true ||
          (typeof document !== 'undefined' && document.referrer?.includes('android-app://'))
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

          if (searchParams.get('activated') === 'true') {
            toast.success(`Akun toko ${savedCode} berhasil diaktivasi! Silakan login.`);
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
      db.settings.update(1, { isAppInstalled: true }).catch(() => { });
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
              name: s.namaLaundry || 'TokoPlus',
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
          // Jangan update db.settings di sini sebelum login berhasil,
          // agar data toko aktif tidak rusak sebelum autentikasi selesai.
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

      // Simpan username dan storeCode ke cache setelah login berhasil
      try {
        const cleanUser = username.trim();
        localStorage.setItem('last_logged_username', cleanUser);
        if (storeCode?.trim()) {
          localStorage.setItem('last_store_code', storeCode.trim().toUpperCase());
        }
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

  const overlays = (
    <>
      {/* Alert Install PWA Menggantung Paling Atas (Muncul besok pagi jika diabaikan, maks 3x) */}
      {showTopInstallAlert && !isPwaInstalled && (
        <div className="au-toast">
          <div className="au-toast-in">
            <button type="button" className="au-chip" onClick={() => setShowInstallPopup(true)}>
              <i className="bi bi-phone"></i>
              <span>Install App</span>
            </button>
            <button
              type="button"
              className="au-x"
              aria-label="Tutup"
              onClick={handleDismissTopAlert}
              title="Abaikan untuk hari ini"
            >
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
        </div>
      )}

      {/* Modal Popup Panduan Install PWA Android / Desktop */}
      {showInstallPopup && (
        <div className="au-overlay" onClick={handleCloseInstallPopup}>
          <div className="au-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="au-x" aria-label="Close" onClick={handleCloseInstallPopup}>
              <i className="bi bi-x-lg"></i>
            </button>

            <div className="au-ico-lg"><i className="bi bi-phone"></i></div>
            <span className="au-badge">Aplikasi Siap Diinstall</span>

            <h5>Install Aplikasi {storeInfo?.name || 'TokoPlus'}</h5>
            <p>
              Pasang aplikasi kasir <strong>{storeInfo?.name || 'TokoPlus'}</strong> langsung di layar utama smartphone Android Anda untuk akses cepat &amp; fitur offline.
            </p>

            {/* Outlet Details Card */}
            {storeInfo && (
              <div className="au-summary">
                <div><span>Nama App</span><b className="text-truncate">{storeInfo.name}</b></div>
                {storeInfo.code && (
                  <div><span>Kode Toko</span><b className="code">{storeInfo.code}</b></div>
                )}
                {storeInfo.address && (
                  <div><span>Alamat</span><b style={{ fontWeight: 500, textAlign: 'right', maxWidth: 190 }}>{storeInfo.address}</b></div>
                )}
              </div>
            )}

            {/* Status Sukses Install */}
            {installSuccess ? (
              <div className="au-alert info" style={{ marginTop: 16, marginBottom: 0, justifyContent: 'center' }}>
                <i className="bi bi-check-circle-fill"></i>
                <span>Aplikasi berhasil dipasang di perangkat!</span>
              </div>
            ) : (
              <>
                <div className="au-stack">
                  <button type="button" className="au-btn au-btn-primary" onClick={handleInstallApp}>
                    <i className="bi bi-download"></i>
                    <span>Install Aplikasi Sekarang</span>
                  </button>
                  <button type="button" className="au-btn au-btn-ghost au-btn-sm" onClick={handleCloseInstallPopup}>
                    Nanti Saja
                  </button>
                </div>

                {installManualHelp && (
                  <div className="au-manual">
                    <i className="bi bi-info-circle-fill me-1"></i>
                    Jika prompt tidak muncul otomatis: buka menu browser titik 3 (<strong>⋮</strong>) di pojok kanan atas, lalu pilih <strong>&quot;Tambahkan ke Layar Utama&quot;</strong> atau <strong>&quot;Install Aplikasi&quot;</strong>.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal Lupa Password (Kirim Link ke WhatsApp Owner) */}
      {showForgotModal && (
        <div className="au-overlay" style={{ zIndex: 1085 }}>
          <div className="au-modal" style={{ textAlign: 'left' }}>
            <div className="au-m-head">
              <span className="au-ico-sm"><i className="bi bi-key-fill"></i></span>
              <h5 style={{ flex: 1 }}>Lupa Password</h5>
              <button type="button" className="au-x" style={{ position: 'static' }} aria-label="Tutup" onClick={() => setShowForgotModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            {forgotSuccessData ? (
              <div className="text-center">
                <div className="au-ok-ico" style={{ width: 64, height: 64, fontSize: '2rem' }}>
                  <i className="bi bi-whatsapp"></i>
                </div>
                <h5 style={{ textAlign: 'center' }}>Tautan Reset Disiapkan!</h5>

                <div className="au-summary">
                  <div><span>Toko</span><b>{forgotSuccessData.storeName} ({forgotSuccessData.storeCode})</b></div>
                  <div><span>Username</span><b>{forgotSuccessData.username}</b></div>
                  <div><span>No. WA Owner</span><b style={{ color: '#0e8f55' }}>{forgotSuccessData.maskedPhone}</b></div>
                </div>

                <a href={forgotSuccessData.waUrl} target="_blank" rel="noreferrer" className="au-btn au-btn-wa">
                  <i className="bi bi-whatsapp"></i>
                  <span>Buka WhatsApp Owner</span>
                </a>
              </div>
            ) : (
              <form onSubmit={handleRequestForgotPassword}>
                <p style={{ marginBottom: 16 }}>Tautan reset password akan langsung dikirimkan ke nomor WhatsApp Owner toko.</p>

                {forgotError && (
                  <div className="au-alert err" role="alert">
                    <i className="bi bi-exclamation-circle-fill"></i>
                    <div>{forgotError}</div>
                  </div>
                )}

                <div className="au-field">
                  <label className="au-label" htmlFor="fg-code"><span>Kode Toko</span></label>
                  <div className="au-ctl">
                    <i className="au-ico bi bi-upc-scan"></i>
                    <input
                      id="fg-code"
                      type="text"
                      className="au-input code"
                      placeholder="Contoh: STORE01"
                      value={forgotStoreCode}
                      onChange={(e) => setForgotStoreCode(e.target.value.toUpperCase())}
                      required
                    />
                  </div>
                </div>

                <div className="au-field">
                  <label className="au-label" htmlFor="fg-user"><span>Username</span></label>
                  <div className="au-ctl">
                    <i className="au-ico bi bi-person"></i>
                    <input
                      id="fg-user"
                      type="text"
                      className="au-input"
                      placeholder="Masukkan username akun"
                      value={forgotUsername}
                      onChange={(e) => setForgotUsername(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="au-btn au-btn-primary" disabled={forgotLoading}>
                  {forgotLoading ? (
                    <>
                      <span className="au-spin" role="status"></span>
                      <span>Memproses...</span>
                    </>
                  ) : (
                    <>
                      <i className="bi bi-whatsapp"></i>
                      <span>Kirim Link ke WhatsApp Owner</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );

  return (
    <AuthShell
      overlays={overlays}
      headline="Selamat datang kembali, yuk lanjutkan transaksi hari ini."
      lead="Masuk untuk membuka kasir, memantau pesanan, dan melihat omzet toko Anda."
    >
      {/* Header Logo & Title */}
      <div className="au-head">
        <div className="au-logo">{storeInfo?.name ? storeInfo.name.charAt(0).toUpperCase() : 'T'}</div>
        {isCheckingStore ? (
          <div className="d-flex justify-content-center my-1">
            <Skeleton width="180px" height="26px" borderRadius="8px" />
          </div>
        ) : (
          <h1 className="au-store-name">{(storeInfo?.name || 'TOKOPLUS').toUpperCase()}</h1>
        )}
        <p className="au-sub">
          {storeInfo?.name ? `Sistem Manajemen & Kasir - ${storeInfo.name}` : 'Sistem Manajemen & Kasir Toko'}
        </p>
      </div>

      {error && (
        <div className="au-alert err" role="alert">
          <i className="bi bi-exclamation-circle-fill"></i>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleLogin} autoComplete="off">
        {/* Kode Toko: Hanya tampilkan input jika BELUM ADA toko tersimpan di Dexie */}
        {!hasSavedStore && (
          <div className="au-field">
            <label className="au-label" htmlFor="lg-code">
              <span>Kode Toko</span>
              {isCheckingStore && (
                <span style={{ fontSize: '.72rem', fontWeight: 500, color: '#7d84ab', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span className="spinner-border spinner-border-sm" role="status" style={{ width: 10, height: 10, color: '#0d5afd' }}></span>
                  Cek toko...
                </span>
              )}
            </label>
            <div className="au-ctl">
              <i className="au-ico bi bi-upc-scan"></i>
              <input
                id="lg-code"
                className="au-input code"
                type="text"
                placeholder="Masukan Kode Toko (contoh: STORE02)"
                value={storeCode}
                onChange={(e) => setStoreCode(e.target.value.toUpperCase())}
              />
            </div>
            <p className="au-hint"><i className="bi bi-info-circle"></i><span>Masukkan kode toko tempat Anda terdaftar.</span></p>
          </div>
        )}

        {/* Outlet Aktif Card: Tampil permanen jika toko tersimpan di Dexie */}
        {storeInfo && (
          <div className="au-store">
            <div className="au-store-l">
              <i className="bi bi-patch-check-fill"></i>
              <div style={{ minWidth: 0 }}>
                <b>{storeInfo.name}</b>
                <small>{hasSavedStore ? 'Outlet Aktif' : 'Outlet Terdeteksi'}</small>
              </div>
            </div>

            {!isPwaInstalled ? (
              <button type="button" className="au-chip" onClick={() => setShowInstallPopup(true)}>
                <i className="bi bi-phone"></i>
                <span>Install</span>
              </button>
            ) : (
              <span className="au-chip static">{storeInfo.code}</span>
            )}
          </div>
        )}

        {/* Username */}
        <div className="au-field">
          <label className="au-label" htmlFor="lg-user"><span>Username</span></label>
          <div className="au-ctl">
            <i className="au-ico bi bi-person"></i>
            <input
              id="lg-user"
              className="au-input"
              type="text"
              name="username"
              autoComplete="username"
              list="saved-username-options"
              placeholder="Masukkan username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          {/* Datalist Browser Autocomplete dari Cache */}
          <datalist id="saved-username-options">
            {savedUsernames.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </div>

        {/* Password */}
        <div className="au-field" style={{ marginBottom: 22 }}>
          <label className="au-label" htmlFor="lg-pass">
            <span>Password</span>
            <button
              type="button"
              onClick={() => {
                setForgotStoreCode(storeCode || storeInfo?.code || '');
                setForgotUsername(username || '');
                setForgotError('');
                setForgotSuccessData(null);
                setShowForgotModal(true);
              }}
            >
              Lupa Password?
            </button>
          </label>
          <div className="au-ctl">
            <i className="au-ico bi bi-lock"></i>
            <input
              id="lg-pass"
              className="au-input has-eye"
              style={{ WebkitTextSecurity: showPassword ? 'none' : 'disc' }}
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
            <button type="button" className="au-eye" aria-label="Tampilkan password" onClick={() => setShowPassword(!showPassword)}>
              <i className={`bi ${showPassword ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`}></i>
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <button className="au-btn au-btn-primary" type="submit" disabled={loading}>
          {loading ? (
            <>
              <span className="au-spin" role="status"></span>
              <span>Memeriksa...</span>
            </>
          ) : (
            <>
              <span>Log In</span>
              <i className="bi bi-arrow-right"></i>
            </>
          )}
        </button>
      </form>

      {/* Footer: Jika sudah pernah install aplikasi PWA maka link to register dihilangkan */}
      {!isPwaInstalled && (
        <p className="au-foot">
          Belum punya akun? <Link to="/register">Register sekarang</Link>
        </p>
      )}
    </AuthShell>
  );
};

export default Login;
