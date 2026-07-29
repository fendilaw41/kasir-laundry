import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerUser } from '../db/repositories/users';

const Register = () => {
  const [fullname, setFullname] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await registerUser({ fullname, username, password });
      setMessage('Registrasi berhasil! Silakan login.');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setMessage('Gagal registrasi: ' + err.message);
    }
  };

  return (
    <div className="login-wrapper d-flex align-items-center justify-content-center w-100" style={{ position: 'fixed', top: 0, left: 0, height: '100vh', overflowY: 'auto', backgroundColor: '#f8f9fa', zIndex: 1050 }}>
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-12 col-sm-10 col-md-8 col-lg-6 col-xl-5">
            <div className="card p-4 p-md-5">
              <div className="card-body p-0">
                <div className="text-center mb-4">
                  <div className="mx-auto d-flex align-items-center justify-content-center shadow-sm" style={{
                    width: '80px',
                    height: '80px',
                    background: 'linear-gradient(135deg, #0134d4 0%, #2855e1 100%)',
                    borderRadius: '22px',
                    marginBottom: '20px'
                  }}>
                    <span style={{ fontSize: '42px', fontWeight: '900', color: '#fff', letterSpacing: '-2px' }}>K</span>
                  </div>
                  <h2 className="fw-bold mb-1" style={{ letterSpacing: '1px', color: '#0134d4' }}>KASIR</h2>
                  <p className="text-muted small mb-0">Laundry Management System</p>
                </div>
                
                <div className="register-form mt-4">
                  <h4 className="mb-4 text-center">Register Akun</h4>
                  {message && <div className={`alert ${message.includes('berhasil') ? 'alert-success' : 'alert-danger'} rounded-3`}>{message}</div>}
                  <form onSubmit={handleRegister}>
                    <div className="form-group mb-3">
                      <label className="form-label small fw-bold text-muted">Nama Lengkap</label>
                      <input className="form-control form-control-lg bg-light border-0" style={{ fontSize: '15px' }} type="text" placeholder="Masukkan nama lengkap" value={fullname} onChange={(e) => setFullname(e.target.value)} required />
                    </div>
                    <div className="form-group mb-3">
                      <label className="form-label small fw-bold text-muted">Username</label>
                      <input className="form-control form-control-lg bg-light border-0" style={{ fontSize: '15px' }} type="text" placeholder="Masukkan username" value={username} onChange={(e) => setUsername(e.target.value)} required />
                    </div>
                    <div className="form-group mb-4">
                      <label className="form-label small fw-bold text-muted">Password</label>
                      <input className="form-control form-control-lg bg-light border-0" style={{ fontSize: '15px' }} type="password" placeholder="Masukkan password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    </div>
                    <button className="btn btn-outline-primary btn-lg w-100 fw-bold shadow-sm" style={{ borderRadius: '12px' }} type="submit">Register</button>
                  </form>
                </div>

                <div className="login-meta-data text-center mt-4">
                  <p className="mb-0 text-muted small">Sudah punya akun? <Link to="/login" className="fw-bold text-primary text-decoration-none">Login di sini</Link></p>
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
