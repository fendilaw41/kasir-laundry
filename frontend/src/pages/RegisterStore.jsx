import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:3000/api';
const APP_URL = (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_APP_URL || import.meta.env?.VITE_PUBLIC_TRACKING_URL)) || (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '');

const RegisterStore = () => {
  const navigate = useNavigate();

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState(null);

  // Helper untuk format nomor telepon ke format WhatsApp internasional (62...)
  const formatWhatsAppNumber = (rawPhone) => {
    let clean = (rawPhone || '').replace(/\D/g, '');
    if (clean.startsWith('0')) {
      clean = '62' + clean.slice(1);
    } else if (clean.startsWith('8')) {
      clean = '62' + clean;
    }
    return clean;
  };

  // Helper pembuat pesan template WhatsApp ajakan registrasi owner
  const buildWhatsAppMessage = (storeCode, storeName, storeAddress, storeCity) => {
    const origin = (APP_URL || (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '')).replace(/\/+$/, '');
    const registerUrl = `${origin}/register?code=${encodeURIComponent(storeCode)}`;

    return `Halo *${storeName}*,\n\nToko Anda telah berhasil didaftarkan di sistem Kasir Laundry dengan detail:\n🏪 *Nama Toko*: ${storeName}\n🔑 *Kode Toko*: ${storeCode}\n📍 *Alamat*: ${storeAddress || '-'}${storeCity ? ` (${storeCity})` : ''}\n\nSilakan segera selesaikan pendaftaran akun Owner Anda melalui tautan resmi berikut:\n👉 ${registerUrl}\n\nSetelah mendaftar, Anda dapat langsung login dan mengelola kasir serta operasional laundry Anda.\n\nTerima kasih! 🙏`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();
    const cleanAddress = address.trim();
    const cleanCity = city.trim();
    const cleanPhone = phone.trim();

    if (!cleanCode || !cleanName) {
      setError('Kode Toko dan Nama Laundry wajib diisi.');
      setLoading(false);
      return;
    }

    if (!cleanPhone) {
      setError('Nomor WhatsApp wajib diisi untuk mengirim undangan registrasi.');
      setLoading(false);
      return;
    }

    if (!password) {
      setError('Password otorisasi wajib diisi.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register-store`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: cleanCode,
          name: cleanName,
          address: cleanAddress || undefined,
          city: cleanCity || undefined,
          phone: cleanPhone || undefined,
          password,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.message || 'Gagal mendaftarkan store baru.');
      }

      // Siapkan URL & pesan WhatsApp
      const waNumber = formatWhatsAppNumber(cleanPhone);
      const waMessage = buildWhatsAppMessage(cleanCode, cleanName, cleanAddress, cleanCity);
      const waUrl = `https://api.whatsapp.com/send?phone=${waNumber}&text=${encodeURIComponent(waMessage)}`;

      setSuccessData({
        code: cleanCode,
        name: cleanName,
        phone: cleanPhone,
        waNumber,
        waUrl,
      });

      // Buka WhatsApp di tab baru secara otomatis
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan saat mendaftarkan store.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="register-store-wrapper d-flex align-items-start align-items-sm-center justify-content-center w-100 py-4"
      style={{
        minHeight: '100vh',
        backgroundColor: '#f1f5f9',
      }}
    >
      <div className="container px-3" style={{ maxWidth: '500px' }}>
        <div
          className="card border-0 shadow-sm"
          style={{
            borderRadius: '20px',
            backgroundColor: '#ffffff',
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
                <i className="bi bi-shop-window text-white fs-2"></i>
              </div>
              <h4
                className="fw-bold mb-1"
                style={{
                  letterSpacing: '0.3px',
                  color: '#0134d4',
                  fontSize: '1.25rem',
                }}
              >
                DAFTAR STORE BARU
              </h4>
              <p className="text-muted small mb-0" style={{ fontSize: '12px' }}>
                Registrasi tenant toko laundry & kirim undangan pendaftaran Owner via WhatsApp
              </p>
            </div>

            {error && (
              <div className="alert alert-danger rounded-3 py-2 px-3 small mb-3" role="alert" style={{ fontSize: '12.5px' }}>
                <i className="bi bi-exclamation-circle-fill me-1.5"></i>
                {error}
              </div>
            )}

            {/* Modal / Alert Sukses dengan Tombol WhatsApp */}
            {successData ? (
              <div className="text-center py-2">
                <div
                  className="mx-auto rounded-circle d-flex align-items-center justify-content-center mb-3"
                  style={{ width: '64px', height: '64px', backgroundColor: '#dcfce7', color: '#16a34a' }}
                >
                  <i className="bi bi-check-circle-fill fs-2"></i>
                </div>
                <h5 className="fw-bold text-dark mb-1">Store Berhasil Didaftarkan!</h5>
                <p className="text-muted small mb-3" style={{ fontSize: '13px' }}>
                  Toko <strong>{successData.name}</strong> (<code>{successData.code}</code>) telah tersimpan di database.
                </p>

                <div className="p-3 rounded-3 bg-light border mb-3 text-start small">
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Kode Toko:</span>
                    <span className="fw-bold text-primary">{successData.code}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Nama Toko:</span>
                    <span className="fw-bold text-dark">{successData.name}</span>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span className="text-muted">No. WhatsApp:</span>
                    <span className="fw-bold text-dark">{successData.phone}</span>
                  </div>
                </div>

                <div className="d-grid gap-2 mb-3">
                  <a
                    href={successData.waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-success fw-bold py-2.5 rounded-3 d-flex align-items-center justify-content-center gap-2 shadow-sm"
                    style={{ fontSize: '14px' }}
                  >
                    <i className="bi bi-whatsapp fs-5"></i>
                    Buka WhatsApp / Kirim Ulang
                  </a>

                  <button
                    type="button"
                    className="btn btn-primary fw-bold py-2.5 rounded-3 shadow-sm"
                    style={{ fontSize: '14px', backgroundColor: '#0134d4', borderColor: '#0134d4' }}
                    onClick={() => navigate(`/register?code=${successData.code}`)}
                  >
                    Lanjut Registrasi Akun Owner
                  </button>

                  <button
                    type="button"
                    className="btn btn-outline-secondary py-2 rounded-3 small"
                    onClick={() => {
                      setSuccessData(null);
                      setCode('');
                      setName('');
                      setAddress('');
                      setCity('');
                      setPhone('');
                    }}
                  >
                    Daftarkan Store Lain
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                {/* Kode Toko */}
                <div className="form-group mb-2.5">
                  <label className="form-label small fw-bold text-muted mb-1" style={{ fontSize: '12px' }}>
                    Kode Toko (Code) <span className="text-danger">*</span>
                  </label>
                  <div className="position-relative">
                    <input
                      className="form-control fw-bold text-primary"
                      style={{
                        height: '42px',
                        backgroundColor: '#f8fafc',
                        border: '1.5px solid #cbd5e1',
                        borderRadius: '10px',
                        fontSize: '14px',
                        padding: '8px 14px',
                      }}
                      type="text"
                      placeholder="Contoh: STORE02"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      required
                    />
                  </div>
                  <div className="form-text text-muted" style={{ fontSize: '11px' }}>
                    Kode unik identifikasi toko untuk login dan registrasi owner/kasir.
                  </div>
                </div>

                {/* Nama Toko */}
                <div className="form-group mb-2.5">
                  <label className="form-label small fw-bold text-muted mb-1" style={{ fontSize: '12px' }}>
                    Nama Laundry / Toko <span className="text-danger">*</span>
                  </label>
                  <input
                    className="form-control"
                    style={{
                      height: '42px',
                      backgroundColor: '#f8fafc',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: '10px',
                      fontSize: '14px',
                      padding: '8px 14px',
                    }}
                    type="text"
                    placeholder="Contoh: Laundry Bersih"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                {/* Alamat Toko */}
                <div className="form-group mb-2.5">
                  <label className="form-label small fw-bold text-muted mb-1" style={{ fontSize: '12px' }}>
                    Alamat Lengkap
                  </label>
                  <input
                    className="form-control"
                    style={{
                      height: '42px',
                      backgroundColor: '#f8fafc',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: '10px',
                      fontSize: '14px',
                      padding: '8px 14px',
                    }}
                    type="text"
                    placeholder="Contoh: Jl. Ahmad Yani No. 45"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>

                {/* Kota */}
                <div className="form-group mb-2.5">
                  <label className="form-label small fw-bold text-muted mb-1" style={{ fontSize: '12px' }}>
                    Kota
                  </label>
                  <input
                    className="form-control"
                    style={{
                      height: '42px',
                      backgroundColor: '#f8fafc',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: '10px',
                      fontSize: '14px',
                      padding: '8px 14px',
                    }}
                    type="text"
                    placeholder="Contoh: Karawang"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>

                {/* Nomor HP / WhatsApp */}
                <div className="form-group mb-2.5">
                  <label className="form-label small fw-bold text-muted mb-1 d-flex align-items-center gap-1" style={{ fontSize: '12px' }}>
                    <i className="bi bi-whatsapp text-success"></i>
                    Nomor WhatsApp Owner <span className="text-danger">*</span>
                  </label>
                  <input
                    className="form-control"
                    style={{
                      height: '42px',
                      backgroundColor: '#f8fafc',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: '10px',
                      fontSize: '14px',
                      padding: '8px 14px',
                    }}
                    type="tel"
                    placeholder="Contoh: 081234567890"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                  <div className="form-text text-muted" style={{ fontSize: '11px' }}>
                    Saat submit, link ajakan registrasi owner akan otomatis diarahkan ke nomor ini.
                  </div>
                </div>

                {/* Password Otorisasi Bypass */}
                <div className="form-group mb-3.5">
                  <label className="form-label small fw-bold text-muted mb-1" style={{ fontSize: '12px' }}>
                    Password Otorisasi <span className="text-danger">*</span>
                  </label>
                  <div className="input-group">
                    <input
                      className="form-control"
                      style={{
                        height: '42px',
                        backgroundColor: '#f8fafc',
                        border: '1.5px solid #cbd5e1',
                        borderTopLeftRadius: '10px',
                        borderBottomLeftRadius: '10px',
                        fontSize: '14px',
                        padding: '8px 14px',
                      }}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Masukkan password otorisasi"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      style={{
                        border: '1.5px solid #cbd5e1',
                        borderLeft: 'none',
                        borderTopRightRadius: '10px',
                        borderBottomRightRadius: '10px',
                        backgroundColor: '#f8fafc',
                      }}
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  className="btn btn-primary w-100 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2"
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
                    <>
                      <span className="spinner-border spinner-border-sm" role="status"></span>
                      <span>Menyimpan Store...</span>
                    </>
                  ) : (
                    <>
                      <i className="bi bi-send-check-fill"></i>
                      <span>Kirim Undangan</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterStore;

