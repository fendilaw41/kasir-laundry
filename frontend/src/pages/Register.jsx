import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerUser } from '../db/repositories/users';
import { db } from '../db';

const Register = () => {
  const [storeCode, setStoreCode] = useState('');
  const [fullname, setFullname] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Coba autofill storeCode jika sudah ada di settings
    db.settings.get(1).then((s) => {
      if (s?.storeCode) {
        setStoreCode(s.storeCode);
      }
    });
  }, []);

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
      className="login-wrapper d-flex align-items-center justify-content-center w-100 py-4"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100vh',
        overflowY: 'auto',
        backgroundColor: '#f8f9fa',
        zIndex: 1050,
      }}
    >
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-12 col-sm-10 col-md-8 col-lg-6 col-xl-5">
            <div className="card p-4 p-md-5 border-0 shadow-sm rounded-4">
              <div className="card-body p-0">
                <div className="text-center mb-4">
                  <div
                    className="mx-auto d-flex align-items-center justify-content-center shadow-sm"
                    style={{
                      width: '76px',
                      height: '76px',
                      background: 'linear-gradient(135deg, #0134d4 0%, #2855e1 100%)',
                      borderRadius: '20px',
                      marginBottom: '16px',
                    }}
                  >
                    <span style={{ fontSize: '38px', fontWeight: '900', color: '#fff', letterSpacing: '-2px' }}>K</span>
                  </div>
                  <h3 className="fw-bold mb-1" style={{ letterSpacing: '0.5px', color: '#0134d4' }}>
                    KASIR LAUNDRY
                  </h3>
                  <p className="text-muted small mb-0">Pendaftaran Akun Owner Toko</p>
                </div>

                <div className="register-form mt-3">
                  <h5 className="mb-3 text-center fw-bold text-dark">Register Akun Owner</h5>

                  {message && (
                    <div className={`alert ${isSuccess ? 'alert-success' : 'alert-danger'} rounded-3 py-2 px-3 small`} role="alert">
                      {message}
                    </div>
                  )}

                  <form onSubmit={handleRegister}>
                    <div className="form-group mb-3">
                      <label className="form-label small fw-bold text-muted">
                        Kode Toko <span className="text-danger">*</span>
                      </label>
                      <input
                        className="form-control form-control-lg bg-light border-0 fw-bold text-primary"
                        style={{ fontSize: '15px' }}
                        type="text"
                        placeholder="Masukkan Kode Toko (contoh: STORE01)"
                        value={storeCode}
                        onChange={(e) => setStoreCode(e.target.value.toUpperCase())}
                        required
                      />
                      <div className="form-text text-muted small" style={{ fontSize: '11px' }}>
                        Diberikan oleh administrator sistem saat outlet didaftarkan.
                      </div>
                    </div>

                    <div className="form-group mb-3">
                      <label className="form-label small fw-bold text-muted">Nama Lengkap</label>
                      <input
                        className="form-control form-control-lg bg-light border-0"
                        style={{ fontSize: '15px' }}
                        type="text"
                        placeholder="Masukkan nama lengkap"
                        value={fullname}
                        onChange={(e) => setFullname(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group mb-3">
                      <label className="form-label small fw-bold text-muted">Username</label>
                      <input
                        className="form-control form-control-lg bg-light border-0"
                        style={{ fontSize: '15px' }}
                        type="text"
                        placeholder="Masukkan username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group mb-4">
                      <label className="form-label small fw-bold text-muted">Password</label>
                      <input
                        className="form-control form-control-lg bg-light border-0"
                        style={{ fontSize: '15px' }}
                        type="password"
                        placeholder="Masukkan password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>

                    <button
                      className="btn btn-primary btn-lg w-100 fw-bold shadow-sm"
                      style={{ borderRadius: '12px' }}
                      type="submit"
                      disabled={loading}
                    >
                      {loading ? 'Memproses...' : 'Daftar'}
                    </button>
                  </form>
                </div>

                <div className="login-meta-data text-center mt-4">
                  <p className="mb-0 text-muted small">
                    Sudah punya akun?{' '}
                    <Link to="/login" className="fw-bold text-primary text-decoration-none">
                      Login di sini
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

export default Register;
