import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Transaksi from './pages/Transaksi';
import Cari from './pages/Cari';
import Pembayaran from './pages/Pembayaran';
import OrderDetail from './pages/OrderDetail';
import Product from './pages/Product';
import Layout from './components/Layout';
import DataOrder from './pages/DataOrder';
import Reports from './pages/Reports';
import Setting from './pages/Setting';

function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(() => {
    const loggedInUser = localStorage.getItem('user');
    return loggedInUser ? JSON.parse(loggedInUser) : null;
  });

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="splash-screen d-flex align-items-center justify-content-center w-100 vh-100" style={{
        backgroundColor: '#f8f9fa',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 9999,
        transition: 'all 0.5s ease'
      }}>
        <div className="text-center px-4">
          <div className="mx-auto d-flex align-items-center justify-content-center shadow" style={{ 
            width: '100px', 
            height: '100px', 
            background: 'linear-gradient(135deg, #0134d4 0%, #2855e1 100%)', 
            borderRadius: '28px',
            marginBottom: '15px',
            animation: 'pulse 2s infinite'
          }}>
            <span style={{ fontSize: '52px', fontWeight: '900', color: '#fff', letterSpacing: '-3px' }}>K</span>
          </div>
          <h1 className="fw-bold mb-0" style={{ letterSpacing: '2px', color: '#0134d4' }}>KASIR</h1>
          <p className="text-muted small mb-3">Laundry Management System</p>
          <div className="spinner-border spinner-border-sm text-primary opacity-50" role="status"></div>
        </div>
        <style>{`
          @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <Router>
      <ScrollToTop />
      <Toaster position="top-center" reverseOrder={false} />
      <Routes>
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="/register" element={<Register />} />
        <Route element={<Layout onLogout={handleLogout} />}>
          <Route path="/" element={user ? <Home user={user} /> : <Navigate to="/login" />} />
          <Route path="/transaksi" element={user ? <Transaksi /> : <Navigate to="/login" />} />
          <Route path="/cari" element={user ? <Cari /> : <Navigate to="/login" />} />
          <Route path="/product" element={user ? <Product /> : <Navigate to="/login" />} />
          <Route path="/pembayaran" element={user ? <Pembayaran /> : <Navigate to="/login" />} />
          <Route path="/order/:id" element={user ? <OrderDetail /> : <Navigate to="/login" />} />
          <Route path="/orders" element={user ? <DataOrder /> : <Navigate to="/login" />} />
          <Route path="/reports" element={user ? <Reports /> : <Navigate to="/login" />} />
          <Route path="/setting" element={user ? <Setting /> : <Navigate to="/login" />} />
        </Route>
      </Routes>
    </Router>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

export default App;
