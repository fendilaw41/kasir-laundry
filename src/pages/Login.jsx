import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../db';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Ambil daftar user untuk ditampilkan sebagai bantuan
  const users = useLiveQuery(() => db.users.toArray());

  const handleLogin = async (e) => {
    e.preventDefault();
    const user = await db.users.where('username').equals(username).first();
    if (user && user.password === password) {
      onLogin(user);
      navigate('/');
    } else {
      setError('Username atau password salah');
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
              {error && <div className="alert alert-danger">{error}</div>}
              <form onSubmit={handleLogin}>
                <div className="form-group text-start mb-3">
                  <input className="form-control" type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
                </div>
                <div className="form-group text-start mb-3">
                  <input className="form-control" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <button className="btn btn-primary w-100" type="submit">Log In</button>
              </form>
            </div>
            <div className="login-meta-data text-center mt-3">
              <p className="mb-0">Belum punya akun? <Link to="/register">Register sekarang</Link></p>
            </div>

            {/* Hint Akun Terdaftar */}
            {users && users.length > 0 && (
              <div className="mt-4 p-3 border rounded bg-white shadow-sm mx-4">
                <p className="small fw-bold text-muted mb-2 text-center">Akun Terdaftar (Demo):</p>
                {users.map(u => (
                  <div key={u.id} className="small border-bottom py-1 d-flex justify-content-between">
                    <span>User: <strong>{u.username}</strong></span>
                    <span>Pass: <strong>{u.password}</strong></span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
