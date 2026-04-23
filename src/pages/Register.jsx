import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../db';

const Register = () => {
  const [fullname, setFullname] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const existing = await db.users.where('username').equals(username).first();
      if (existing) {
        setMessage('Username sudah terdaftar');
        return;
      }
      await db.users.add({ fullname, username, password, role: 'owner' });
      setMessage('Registrasi berhasil! Silakan login.');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setMessage('Gagal registrasi: ' + err.message);
    }
  };

  return (
    <div className="login-wrapper d-flex align-items-center justify-content-center w-100" style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-12 col-sm-9 col-md-7 col-lg-5 col-xl-4">
            <div className="text-center px-4">
              <div className="text-center px-4 mb-4">
                <div className="mx-auto d-flex align-items-center justify-content-center shadow-sm" style={{
                  width: '80px',
                  height: '80px',
                  background: 'linear-gradient(135deg, #0134d4 0%, #2855e1 100%)',
                  borderRadius: '22px',
                  marginBottom: '15px'
                }}>
                  <span style={{ fontSize: '42px', fontWeight: '900', color: '#fff', letterSpacing: '-2px' }}>K</span>
                </div>
                <h2 className="fw-bold mb-0" style={{ letterSpacing: '1px', color: '#0134d4' }}>KASIR</h2>
                <p className="text-muted small">Laundry Management System</p>
              </div>
            </div>
            <div className="register-form mt-4 px-4">
              <h4 className="mb-4 text-center">Register Akun</h4>
              {message && <div className={`alert ${message.includes('berhasil') ? 'alert-success' : 'alert-danger'}`}>{message}</div>}
              <form onSubmit={handleRegister}>
                <div className="form-group text-start mb-3">
                  <input className="form-control" type="text" placeholder="Nama Lengkap" value={fullname} onChange={(e) => setFullname(e.target.value)} required />
                </div>
                <div className="form-group text-start mb-3">
                  <input className="form-control" type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
                </div>
                <div className="form-group text-start mb-3">
                  <input className="form-control" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <button className="btn btn-primary w-100" type="submit">Register</button>
              </form>
            </div>
            <div className="login-meta-data text-center mt-3">
              <p className="mb-0">Sudah punya akun? <Link to="/login">Login di sini</Link></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
