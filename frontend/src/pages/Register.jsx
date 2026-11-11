import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { registerUser } from '../db/repositories/users';
import { fetchStoreInfoByCode } from '../utils/pwaHelper';

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
      const waMessage = `Halo *${finalName}*,\n\nSelamat! Pendaftaran Toko Laundry dan Akun Owner Anda berhasil didaftarkan di sistem Kasir Laundry:\n\n *Nama Toko*: ${finalName}\n *Kode Toko*: *${finalCode}*\n *Username*: ${username.trim()}\n\nSilakan klik tautan resmi aktivasi & login berikut untuk langsung membuka toko Anda:\n ${activationUrl}\n\n Simpan Kode Toko Anda untuk login di perangkat lain atau menambahkan kasir. Terima kasih! 🙏`;
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

  return (
    <div className="login-wrapper d-flex align-items-center justify-content-center py-4" style={{ backgroundColor: '#f0f4fd', minHeight: '100vh' }}>
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-12 col-sm-10 col-md-8 col-lg-5">
            {/* Logo / Header Branding */}
            <div className="text-center px-4 mb-3">
              <div
                className="d-inline-flex align-items-center justify-content-center rounded-circle shadow-sm mb-2"
                style={{ width: '56px', height: '56px', backgroundColor: '#0134d4', color: '#fff' }}
              >
                <i className="bi bi-shop fs-3"></i>
              </div>
              <h4 className="fw-bold text-dark mb-0" style={{ letterSpacing: '-0.3px' }}>
                {successData ? 'Pendaftaran Berhasil!' : 'Daftar Akun'}
              </h4>
              <p className="text-muted small mb-0" style={{ fontSize: '13px' }}>
                {successData ? 'Akun dan Toko Anda siap digunakan' : 'Satu akun owner untuk kelola cucian, kasir & nota otomatis'}
              </p>
            </div>

            {/* KARTU SUKSES & AKTIVASI VIA WHATSAPP */}
            {successData ? (
              <div className="card shadow-sm border-0 rounded-4 overflow-hidden bg-white p-4 text-center">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3"
                  style={{ width: '64px', height: '64px', backgroundColor: '#dcfce7', color: '#16a34a' }}
                >
                  <i className="bi bi-check-circle-fill fs-1"></i>
                </div>

                <h5 className="fw-bold text-dark mb-1">{successData.storeName}</h5>
                <p className="text-muted small mb-3" style={{ fontSize: '13px' }}>
                  Toko dan akun Owner berhasil didaftarkan.
                </p>

                {/* Konfirmasi Undangan & Aktivasi WhatsApp */}
                <div className="p-3 rounded-3 mb-3 text-center" style={{ backgroundColor: '#f0fdf4', border: '1.5px solid #bbf7d0' }}>
                  <i className="bi bi-whatsapp text-success fs-2 d-block mb-1"></i>
                  <h6 className="fw-bold text-success mb-1" style={{ fontSize: '14px' }}>
                    Undangan Aktivasi Terkirim ke WhatsApp
                  </h6>
                  <p className="text-muted small mb-0" style={{ fontSize: '12px' }}>
                    Silahkan buka WhatsApp dan klik tautan untuk langsung mengaktifkan toko.
                  </p>
                </div>

                {/* Tombol Kirim WA & Login */}
                <div className="d-grid gap-2 mb-2">
                  {successData.phone && (
                    <a
                      href={successData.waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-success fw-bold py-2.5 rounded-3 d-flex align-items-center justify-content-center gap-2 shadow-sm text-decoration-none"
                      style={{ fontSize: '14px' }}
                    >
                      <i className="bi bi-whatsapp fs-5"></i>
                      <span>Buka WhatsApp Owner</span>
                    </a>
                  )}
                </div>
              </div>
            ) : (
              /* FORM REGISTRASI OWNER */
              <div className="card shadow-sm border-0 rounded-4 overflow-hidden bg-white">
                <div className="card-body p-4">
                  {message && (
                    <div className="alert alert-danger border-0 rounded-3 py-2 px-3 small d-flex align-items-center gap-2 mb-3">
                      <i className="bi bi-exclamation-circle-fill fs-5 flex-shrink-0"></i>
                      <span>{message}</span>
                    </div>
                  )}

                  {/* Info Toko Terdaftar jika kode toko disertakan */}
                  {storeCodeInput && (
                    <div className="alert alert-primary border-0 rounded-3 py-2 px-3 small d-flex align-items-center gap-2 mb-3">
                      <i className="bi bi-info-circle-fill fs-5 flex-shrink-0 text-primary"></i>
                      <div>
                        <strong>Mendaftarkan Akun Owner</strong> untuk toko{' '}
                        <strong>{existingStoreInfo?.name || storeName || 'Laundry'}</strong>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleSubmit}>
                    {/* KHUSUS PENDAFTARAN TOKO BARU (TANPA KODE TOKO DI URL) */}
                    {!storeCodeInput && (
                      <>
                        <div className="form-group mb-2.5">
                          <label className="form-label small fw-bold text-muted mb-1" style={{ fontSize: '12px' }}>
                            Nama Toko / Laundry <span className="text-danger">*</span>
                          </label>
                          <input
                            className="form-control"
                            style={{
                              height: '42px',
                              backgroundColor: '#f8fafc',
                              border: '1.5px solid #cbd5e1',
                              borderRadius: '10px',
                              fontSize: '14px',
                            }}
                            type="text"
                            placeholder="Contoh: Berkah Laundry"
                            value={storeName}
                            onChange={(e) => setStoreName(e.target.value)}
                            required
                          />
                        </div>

                        <div className="form-group mb-2.5">
                          <label className="form-label small fw-bold text-muted mb-1" style={{ fontSize: '12px' }}>
                            No. WhatsApp Owner <span className="text-danger">*</span>
                          </label>
                          <div className="input-group">
                            <span className="input-group-text bg-light text-muted fw-bold" style={{ border: '1.5px solid #cbd5e1', borderRight: 'none', borderRadius: '10px 0 0 10px', fontSize: '13px' }}>
                              +62
                            </span>
                            <input
                              className="form-control"
                              style={{
                                height: '42px',
                                backgroundColor: '#f8fafc',
                                border: '1.5px solid #cbd5e1',
                                borderLeft: 'none',
                                borderRadius: '0 10px 10px 0',
                                fontSize: '14px',
                              }}
                              type="tel"
                              placeholder="81234567890"
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              required
                            />
                          </div>
                          <div className="form-text text-muted" style={{ fontSize: '11px' }}>
                            Tautan undangan dan aktivasi toko akan otomatis dikirim ke nomor ini.
                          </div>
                        </div>
                      </>
                    )}

                    {/* Nama Lengkap Owner */}
                    <div className="form-group mb-2.5">
                      <label className="form-label small fw-bold text-muted mb-1" style={{ fontSize: '12px' }}>
                        Nama Lengkap Owner <span className="text-danger">*</span>
                      </label>
                      <input
                        className="form-control"
                        style={{
                          height: '42px',
                          backgroundColor: '#f8fafc',
                          border: '1.5px solid #cbd5e1',
                          borderRadius: '10px',
                          fontSize: '14px',
                        }}
                        type="text"
                        placeholder="Contoh: John Pratama"
                        value={fullname}
                        onChange={(e) => setFullname(e.target.value)}
                        required
                      />
                    </div>

                    {/* Username */}
                    <div className="form-group mb-2.5">
                      <label className="form-label small fw-bold text-muted mb-1" style={{ fontSize: '12px' }}>
                        Username <span className="text-danger">*</span>
                      </label>
                      <input
                        className="form-control"
                        style={{
                          height: '42px',
                          backgroundColor: '#f8fafc',
                          border: '1.5px solid #cbd5e1',
                          borderRadius: '10px',
                          fontSize: '14px',
                        }}
                        type="text"
                        placeholder="Contoh: john"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                        required
                      />
                    </div>

                    {/* Password */}
                    <div className="form-group mb-2">
                      <label className="form-label small fw-bold text-muted mb-1" style={{ fontSize: '12px' }}>
                        Password <span className="text-danger">*</span>
                      </label>
                      <div className="position-relative">
                        <input
                          className="form-control pe-5"
                          style={{
                            height: '42px',
                            backgroundColor: '#f8fafc',
                            border: '1.5px solid #cbd5e1',
                            borderRadius: '10px',
                            fontSize: '14px',
                          }}
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Minimal 6 karakter"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          className="btn btn-sm btn-link position-absolute end-0 top-50 translate-middle-y text-muted text-decoration-none me-1"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                        </button>
                      </div>
                    </div>

                    {/* Konfirmasi Password */}
                    <div className="form-group mb-2.5">
                      <label className="form-label small fw-bold text-muted mb-1" style={{ fontSize: '12px' }}>
                        Konfirmasi Password <span className="text-danger">*</span>
                      </label>
                      <div className="position-relative">
                        <input
                          className="form-control pe-5"
                          style={{
                            height: '42px',
                            backgroundColor: '#f8fafc',
                            border: '1.5px solid #cbd5e1',
                            borderRadius: '10px',
                            fontSize: '14px',
                          }}
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder="Ulangi password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          className="btn btn-sm btn-link position-absolute end-0 top-50 translate-middle-y text-muted text-decoration-none me-1"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          <i className={`bi ${showConfirmPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                        </button>
                      </div>
                    </div>

                    {/* Indikator Validasi Password Ringkas */}
                    {password && (
                      <div className="p-3 rounded-3 mb-3 bg-light" style={{ fontSize: '11px', border: '1px solid #e2e8f0' }}>
                        <div className="fw-semibold text-muted mb-1">Ketentuan Keamanan Password:</div>
                        <div className="d-flex flex-wrap gap-x-3 gap-y-1">
                          <span className={hasMinLen ? 'text-success fw-bold' : 'text-muted'}>
                            {hasMinLen ? '✓' : '•'} Min 6 karakter
                          </span>
                          <span className={hasUpper && hasLower ? 'text-success fw-bold' : 'text-muted'}>
                            {hasUpper && hasLower ? '✓' : '•'} Huruf besar & kecil
                          </span>
                          <span className={hasSpecial ? 'text-success fw-bold' : 'text-muted'}>
                            {hasSpecial ? '✓' : '•'} Karakter spesial (!@#$)
                          </span>
                          {confirmPassword && (
                            <span className={isPassMatching ? 'text-success fw-bold' : 'text-danger'}>
                              {isPassMatching ? '✓ Password cocok' : '✗ Password belum cocok'}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Submit Button */}
                    <button
                      className="btn btn-primary w-100 fw-bold shadow-sm mt-2"
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
                      {loading ? (
                        <div className="d-flex align-items-center justify-content-center gap-2">
                          <div className="spinner-border spinner-border-sm" role="status"></div>
                          <span>Membuat Akun Owner...</span>
                        </div>
                      ) : ('Daftar')}
                    </button>
                  </form>
                </div>

                {/* Footer */}
                <div className="login-meta-data text-center pb-3 pt-1">
                  <p className="mb-0 text-muted" style={{ fontSize: '13px' }}>
                    Sudah punya akun?{' '}
                    <Link to="/login" className="fw-bold text-decoration-none" style={{ color: '#0134d4' }}>
                      Login di sini
                    </Link>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
