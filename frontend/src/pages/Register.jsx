import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { registerUser } from '../db/repositories/users';
import { fetchStoreInfoByCode } from '../utils/pwaHelper';
import AuthShell from '../components/auth/AuthShell';

const formatWhatsAppNumber = (rawPhone) => {
  let clean = (rawPhone || '').replace(/\D/g, '');
  if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1);
  } else if (clean.startsWith('8')) {
    clean = '62' + clean;
  }
  return clean;
};

const Register = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Form State
  const [fullname, setFullname] = useState('');
  const [storeName, setStoreName] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [storeCodeInput, setStoreCodeInput] = useState(searchParams.get('code') || '');
  const [existingStoreInfo, setExistingStoreInfo] = useState(null);

  // UI State
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Success State
  const [successData, setSuccessData] = useState(null);

  // Validasi Password Helper
  const hasMinLen = password.length >= 6;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);
  const isPassMatching = password && confirmPassword && password === confirmPassword;
  const isPasswordValid = hasMinLen && hasLower && hasUpper && hasSpecial;

  // Auto detect if code param exists from URL (misal setelah registrasi toko baru)
  useEffect(() => {
    const urlCode = searchParams.get('code');
    if (urlCode) {
      const cleanCode = urlCode.trim().toUpperCase();
      setStoreCodeInput(cleanCode);
      fetchStoreInfoByCode(cleanCode).then((info) => {
        if (info) {
          setExistingStoreInfo(info);
          if (info.name) setStoreName(info.name);
          if (info.phone) setPhone(info.phone);
        }
      });
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    if (!fullname.trim() || !username.trim() || !password) {
      setMessage('Nama Lengkap, Username, dan Password wajib diisi.');
      return;
    }

    if (!isPasswordValid) {
      setMessage('Password minimal 6 karakter dan wajib mengandung kombinasi huruf besar, huruf kecil, dan spesial karakter.');
      return;
    }

    if (password !== confirmPassword) {
      setMessage('Konfirmasi password tidak cocok.');
      return;
    }

    if (!storeCodeInput) {
      if (!storeName.trim()) {
        setMessage('Nama Toko / Laundry wajib diisi.');
        return;
      }
      if (!phone.trim()) {
        setMessage('Nomor WhatsApp Owner wajib diisi.');
        return;
      }
    }

    setLoading(true);

    try {
      const res = await registerUser({
        storeName: storeCodeInput ? (existingStoreInfo?.name || storeName.trim()) : storeName.trim(),
        phone: storeCodeInput ? (existingStoreInfo?.phone || phone.trim()) : phone.trim(),
        storeCode: storeCodeInput ? storeCodeInput.trim().toUpperCase() : undefined,
        fullname: fullname.trim(),
        username: username.trim(),
        password,
        confirmPassword,
        role: 'owner',
      });

      const finalCode = res.storeCode || (typeof res === 'object' && res.storeCode) || storeCodeInput.toUpperCase();
      const finalName = res.storeName || storeName.trim() || existingStoreInfo?.name || 'Laundry';
      const cleanWa = formatWhatsAppNumber(phone || existingStoreInfo?.phone || '');
      const origin = window.location.origin;
      const activationUrl = `${origin}/login?code=${encodeURIComponent(finalCode)}&activated=true`;

      // Simpan kode toko ke cache lokal
      localStorage.setItem('last_store_code', finalCode);
      localStorage.setItem('saved_store_code', finalCode);

      // Template pesan WhatsApp dengan kode toko BOLD
      const waMessage = `Halo *${finalName}*,\n\nSelamat! Pendaftaran Toko Laundry dan Akun Owner Anda berhasil didaftarkan di sistem TokoPlus:\n\n *Nama Toko*: ${finalName}\n *Kode Toko*: *${finalCode}*\n *Username*: ${username.trim()}\n\nSilakan klik tautan resmi aktivasi & login berikut untuk langsung membuka toko Anda:\n ${activationUrl}\n\n Simpan Kode Toko Anda untuk login di perangkat lain atau menambahkan kasir. Terima kasih! 🙏`;
      const waUrl = `https://wa.me/${cleanWa}?text=${encodeURIComponent(waMessage)}`;

      setSuccessData({
        storeCode: finalCode,
        storeName: finalName,
        username: username.trim(),
        phone: cleanWa,
        activationUrl,
        waUrl,
      });

      toast.success('Pendaftaran akun Owner berhasil!');

      // Langsung buka WhatsApp owner untuk kirim undangan & link aktivasi
      if (cleanWa && typeof window !== 'undefined') {
        window.open(waUrl, '_blank');
      }
    } catch (err) {
      setMessage(err.message || 'Gagal melakukan pendaftaran.');
    } finally {
      setLoading(false);
    }
  };

  const strength = [hasMinLen, hasLower && hasUpper, hasSpecial].filter(Boolean).length;
  const displayStoreName = existingStoreInfo?.name || storeName || 'Laundry';

  return (
    <AuthShell
      headline="Daftar sekali, kelola seluruh toko dari satu akun owner."
      lead="Buat akun owner, dapatkan kode toko, lalu undang kasir Anda kapan saja."
    >
      {/* Header kartu */}
      <div className="au-head">
        <div className="au-logo"><i className={`bi ${successData ? 'bi-check2-circle' : 'bi-person-plus-fill'}`}></i></div>
        <h1 className="au-title">{successData ? 'Pendaftaran Berhasil!' : 'Daftar Akun Owner'}</h1>
        <p className="au-sub">
          {successData ? 'Akun dan Toko Anda siap digunakan' : 'Satu akun owner untuk kelola cucian, kasir & nota otomatis'}
        </p>
      </div>

      {/* KARTU SUKSES & AKTIVASI VIA WHATSAPP */}
      {successData ? (
        <div className="text-center">
          <div className="au-ok-ico"><i className="bi bi-check-lg"></i></div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800 }}>{successData.storeName}</h2>
          <p style={{ marginTop: 4 }}>Toko dan akun Owner berhasil didaftarkan.</p>

          <div className="au-summary">
            <div><span>Kode Toko</span><b className="code">{successData.storeCode}</b></div>
            <div><span>Username</span><b>{successData.username}</b></div>
          </div>

          <div className="au-wa-box">
            <i className="bi bi-whatsapp"></i>
            <div>
              <b>Undangan Aktivasi Terkirim ke WhatsApp</b>
              <p>Silahkan buka WhatsApp dan klik tautan untuk langsung mengaktifkan toko.</p>
            </div>
          </div>

          <div className="au-stack">
            {successData.phone && (
              <a href={successData.waUrl} target="_blank" rel="noopener noreferrer" className="au-btn au-btn-wa">
                <i className="bi bi-whatsapp"></i>
                <span>Buka WhatsApp Owner</span>
              </a>
            )}
            <Link to={`/login?code=${encodeURIComponent(successData.storeCode)}`} className="au-btn au-btn-primary">
              <i className="bi bi-box-arrow-in-right"></i>
              <span>Lanjut ke Halaman Login</span>
            </Link>
          </div>
        </div>
      ) : (
        /* FORM REGISTRASI OWNER */
        <>
          {message && (
            <div className="au-alert err" role="alert">
              <i className="bi bi-exclamation-circle-fill"></i>
              <span>{message}</span>
            </div>
          )}

          {/* Info Toko Terdaftar jika kode toko disertakan */}
          {storeCodeInput && (
            <div className="au-alert info">
              <i className="bi bi-info-circle-fill"></i>
              <div>
                <strong>Mendaftarkan Akun Owner</strong> untuk toko <strong>{displayStoreName}</strong>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* KHUSUS PENDAFTARAN TOKO BARU (TANPA KODE TOKO DI URL) */}
            {!storeCodeInput && (
              <>
                <div className="au-sec">Data Toko</div>

                <div className="au-field">
                  <label className="au-label" htmlFor="reg-store">
                    <span>Nama Toko / Laundry <span className="req">*</span></span>
                  </label>
                  <div className="au-ctl">
                    <i className="au-ico bi bi-shop"></i>
                    <input
                      id="reg-store"
                      className="au-input"
                      type="text"
                      placeholder="Contoh: Berkah Laundry"
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="au-field">
                  <label className="au-label" htmlFor="reg-phone">
                    <span>No. WhatsApp Owner <span className="req">*</span></span>
                  </label>
                  <div className="au-ctl with-prefix">
                    <span className="au-prefix">+62</span>
                    <input
                      id="reg-phone"
                      className="au-input"
                      type="tel"
                      placeholder="81234567890"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </div>
                  <p className="au-hint">
                    <i className="bi bi-whatsapp"></i>
                    <span>Tautan undangan dan aktivasi toko akan otomatis dikirim ke nomor ini.</span>
                  </p>
                </div>

                <div className="au-sec" style={{ marginTop: 22 }}>Akun Owner</div>
              </>
            )}

            {/* Nama Lengkap Owner */}
            <div className="au-field">
              <label className="au-label" htmlFor="reg-fullname">
                <span>Nama Lengkap Owner <span className="req">*</span></span>
              </label>
              <div className="au-ctl">
                <i className="au-ico bi bi-person"></i>
                <input
                  id="reg-fullname"
                  className="au-input"
                  type="text"
                  placeholder="Contoh: John Pratama"
                  value={fullname}
                  onChange={(e) => setFullname(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Username */}
            <div className="au-field">
              <label className="au-label" htmlFor="reg-username">
                <span>Username <span className="req">*</span></span>
              </label>
              <div className="au-ctl">
                <i className="au-ico bi bi-at"></i>
                <input
                  id="reg-username"
                  className="au-input"
                  type="text"
                  placeholder="Contoh: john"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="au-field">
              <label className="au-label" htmlFor="reg-pass">
                <span>Password <span className="req">*</span></span>
              </label>
              <div className="au-ctl">
                <i className="au-ico bi bi-lock"></i>
                <input
                  id="reg-pass"
                  className="au-input has-eye"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Minimal 6 karakter"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button type="button" className="au-eye" aria-label="Tampilkan password" onClick={() => setShowPassword(!showPassword)}>
                  <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                </button>
              </div>
            </div>

            {/* Konfirmasi Password */}
            <div className="au-field">
              <label className="au-label" htmlFor="reg-pass2">
                <span>Konfirmasi Password <span className="req">*</span></span>
              </label>
              <div className="au-ctl">
                <i className="au-ico bi bi-shield-lock"></i>
                <input
                  id="reg-pass2"
                  className="au-input has-eye"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Ulangi password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <button type="button" className="au-eye" aria-label="Tampilkan konfirmasi password" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                  <i className={`bi ${showConfirmPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                </button>
              </div>
            </div>

            {/* Indikator Validasi Password Ringkas */}
            {password && (
              <div className="au-rules">
                <div className="au-rules-t">Ketentuan Keamanan Password</div>
                <div className="au-bar" aria-hidden="true">
                  <i className={strength >= 1 ? 'on' : ''}></i>
                  <i className={strength >= 2 ? 'on' : ''}></i>
                  <i className={strength >= 3 ? 'on' : ''}></i>
                </div>
                <div className="au-rule-list">
                  <span className={`au-rule ${hasMinLen ? 'ok' : ''}`}>
                    <i className={`bi ${hasMinLen ? 'bi-check-circle-fill' : 'bi-circle'}`}></i> Min 6 karakter
                  </span>
                  <span className={`au-rule ${hasUpper && hasLower ? 'ok' : ''}`}>
                    <i className={`bi ${hasUpper && hasLower ? 'bi-check-circle-fill' : 'bi-circle'}`}></i> Huruf besar &amp; kecil
                  </span>
                  <span className={`au-rule ${hasSpecial ? 'ok' : ''}`}>
                    <i className={`bi ${hasSpecial ? 'bi-check-circle-fill' : 'bi-circle'}`}></i> Karakter spesial (!@#$)
                  </span>
                  {confirmPassword && (
                    <span className={`au-rule ${isPassMatching ? 'ok' : 'bad'}`}>
                      <i className={`bi ${isPassMatching ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`}></i>
                      {isPassMatching ? 'Password cocok' : 'Password belum cocok'}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button className="au-btn au-btn-primary" type="submit" disabled={loading} style={{ marginTop: 6 }}>
              {loading ? (
                <>
                  <span className="au-spin" role="status"></span>
                  <span>Membuat Akun Owner...</span>
                </>
              ) : (
                <>
                  <span>Daftar</span>
                  <i className="bi bi-arrow-right"></i>
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="au-foot">
            Sudah punya akun? <Link to="/login">Login di sini</Link>
          </p>
        </>
      )}
    </AuthShell>
  );
};

export default Register;
