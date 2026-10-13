import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginUser } from '../db/repositories/users';
import { db } from '../db';

const Login = ({ onLogin }) => {
  const [storeCode, setStoreCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Autofill kode toko jika sudah tersimpan di browser ini sebelumnya
    db.settings.get(1).then((s) => {
      if (s?.storeCode) {
        setStoreCode(s.storeCode);
      }
    });
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await loginUser(username, password, storeCode.trim().toUpperCase());
      onLogin(user);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Gagal login');
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
        backgroundColor: '#f4f7f6',
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
                  <p className="text-muted small mb-0">Sistem Manajemen & Kasir Toko</p>
                </div>

                <div className="register-form mt-3">
                  <h5 className="mb-3 text-center fw-bold text-dark">Log In</h5>

                  {error && (
                    <div className="alert alert-danger rounded-3 py-2 px-3 small" role="alert">
                      {error}
                    </div>
                  )}

                  <form onSubmit={handleLogin}>
                    <div className="form-group mb-3">
                      <label className="form-label small fw-bold text-muted">
                        Kode Toko
                      </label>
                      <input
                        className="form-control form-control-lg bg-light border-0 fw-bold text-primary"
                        style={{ fontSize: '15px' }}
                        type="text"
                        placeholder="Masukan Kode"
                        value={storeCode}
                        onChange={(e) => setStoreCode(e.target.value.toUpperCase())}
                      />
                      <div className="form-text text-muted small" style={{ fontSize: '11px' }}>
                        Masukkan kode toko tempat Anda terdaftar.
                      </div>
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
                      {loading ? 'Memeriksa...' : 'Log In'}
                    </button>
                  </form>
                </div>

                <div className="login-meta-data text-center mt-4">
                  <p className="mb-0 text-muted small">
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
