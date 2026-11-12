import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { playSuccessChime } from '../utils/soundHelper';

const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:3000/api';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!token) {
      setErrorMsg('Token reset password tidak ditemukan pada tautan.');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg('Password baru minimal 6 karakter.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Konfirmasi password tidak cocok.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          newPassword,
          confirmPassword,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json.message || 'Gagal mengatur ulang password.');
      }

      setIsSuccess(true);
      playSuccessChime();
      toast.success('Password berhasil diatur ulang!');
    } catch (err) {
      setErrorMsg(err.message || 'Terjadi kesalahan saat memproses reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="login-wrapper d-flex align-items-center justify-content-center py-4"
      style={{ backgroundColor: '#f0f4fd', minHeight: '100vh' }}
    >
      <div className="container" style={{ maxWidth: '440px' }}>
        <div className="card shadow-sm border-0" style={{ borderRadius: '20px', overflow: 'hidden' }}>
          <div className="card-body p-4 p-md-4">
            {/* Header Brand */}
            <div className="text-center mb-4">
              <div
                className="d-inline-flex align-items-center justify-content-center text-white mb-2 shadow-sm"
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '16px',
                  backgroundColor: '#0134d4',
                  fontSize: '24px',
                }}
              >
                <i className="bi bi-shield-lock-fill"></i>
              </div>
              <h5 className="fw-bold text-dark mb-1" style={{ fontSize: '18px' }}>
                Reset Password Akun
              </h5>
              <p className="text-muted small mb-0" style={{ fontSize: '12px' }}>
                Buat password baru untuk akun kasir / owner laundry Anda.
              </p>
            </div>

            {/* Jika Token Kosong */}
            {!token && (
              <div className="alert alert-warning border-0 rounded-3 p-3 text-center small mb-3">
                <i className="bi bi-exclamation-triangle-fill fs-5 d-block text-warning mb-1"></i>
                <strong>Tautan Tidak Valid</strong>
                <p className="mb-2 mt-1">
                  Tautan ini tidak memiliki token reset password atau sudah kedaluwarsa.
                </p>
                <Link to="/login" className="btn btn-sm btn-primary rounded-pill px-3 fw-bold">
                  Kembali ke Halaman Login
                </Link>
              </div>
            )}

            {/* Sukses Alert */}
            {isSuccess ? (
              <div className="text-center py-3">
                <div
                  className="d-inline-flex align-items-center justify-content-center bg-success text-white rounded-circle mb-3"
                  style={{ width: '56px', height: '56px' }}
                >
                  <i className="bi bi-check-lg fs-2"></i>
                </div>
                <h6 className="fw-bold text-dark mb-1">Password Berhasil Diubah!</h6>
                <p className="text-muted small mb-4">
                  Password baru Anda sudah aktif. Silakan login kembali menggunakan password baru.
                </p>
                <button
                  type="button"
                  className="btn btn-primary w-100 py-2.5 rounded-3 fw-bold"
                  style={{ backgroundColor: '#0134d4', borderColor: '#0134d4' }}
                  onClick={() => navigate('/login')}
                >
                  Masuk ke Halaman Login
                </button>
              </div>
            ) : token && (
              <form onSubmit={handleSubmit}>
                {errorMsg && (
                  <div className="alert alert-danger border-0 rounded-3 p-2.5 small mb-3 d-flex align-items-center gap-2">
                    <i className="bi bi-exclamation-circle-fill flex-shrink-0 text-danger"></i>
                    <div>{errorMsg}</div>
                  </div>
                )}

                {/* Password Baru */}
                <div className="form-group mb-3">
                  <label className="form-label small fw-bold text-muted mb-1" style={{ fontSize: '12px' }}>
                    Password Baru
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
                        padding: '8px 14px',
                      }}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Minimal 6 karakter"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
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

                {/* Konfirmasi Password Baru */}
                <div className="form-group mb-4">
                  <label className="form-label small fw-bold text-muted mb-1" style={{ fontSize: '12px' }}>
                    Konfirmasi Password Baru
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
                        padding: '8px 14px',
                      }}
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Ketik ulang password baru"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
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
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      <i className={`bi ${showConfirmPassword ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`}></i>
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className="btn btn-primary w-100 fw-bold shadow-sm"
                  style={{
                    height: '46px',
                    borderRadius: '12px',
                    fontSize: '15px',
                    backgroundColor: '#0134d4',
                    borderColor: '#0134d4',
                  }}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      Menyimpan...
                    </>
                  ) : (
                    'Simpan Password Baru'
                  )}
                </button>
              </form>
            )}

            {/* Back to Login Link */}
            <div className="text-center mt-3 pt-1">
              <Link to="/login" className="small text-muted text-decoration-none">
                <i className="bi bi-arrow-left me-1"></i> Kembali ke Halaman Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;

