import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getSettingsQuery } from './db/repositories/settings';
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
import PageLoader from './components/PageLoader';
import DataOrder from './pages/DataOrder';
import Reports from './pages/Reports';
import Setting from './pages/Setting';
import Chat from './pages/Chat';

function App() {
  const [user, setUser] = useState(() => {
    const loggedInUser = sessionStorage.getItem('user');
    return loggedInUser ? JSON.parse(loggedInUser) : null;
  });

  const settings = useLiveQuery(getSettingsQuery);

  useEffect(() => {
    if (settings && settings.namaLaundry) {
      document.title = settings.namaLaundry;
    }
  }, [settings]);

  const handleLogin = (userData) => {
    const { password: _, ...safeUser } = userData;
    setUser(safeUser);
    sessionStorage.setItem('user', JSON.stringify(safeUser));
  };

  const handleLogout = () => {
    setUser(null);
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
  };

  useEffect(() => {
    const handleUnauthorized = () => {
      console.warn('[Auth] Sesi berakhir atau token tidak valid (401 Unauthorized)');
      setUser(null);
      sessionStorage.removeItem('user');
      sessionStorage.removeItem('token');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  return (
    <Router>
      <ScrollToTop />
      <PageLoader />
      <Toaster position="top-center" reverseOrder={false} />
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/" replace /> : <Login onLogin={handleLogin} />}
        />
        <Route path="/register" element={<Register />} />
        <Route element={<ProtectedLayout user={user} onLogout={handleLogout} />}>
          <Route path="/" element={<Home user={user} />} />
          <Route path="/transaksi" element={<Transaksi user={user} />} />
          <Route path="/cari" element={<Cari user={user} />} />
          <Route path="/product" element={<Product user={user} />} />
          <Route path="/pembayaran" element={<Pembayaran user={user} />} />
          <Route path="/order/:id" element={<OrderDetail user={user} />} />
          <Route path="/orders" element={<DataOrder user={user} />} />
          <Route path="/reports" element={<Reports user={user} />} />
          <Route path="/setting" element={<Setting user={user} />} />
          <Route path="/chat" element={<Chat user={user} />} />
        </Route>
        <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />
      </Routes>
    </Router>
  );
}

// Wrapper Layout terproteksi: jika user belum login, alihkan langsung ke /login dengan replace
function ProtectedLayout({ user, onLogout }) {
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <Layout user={user} onLogout={onLogout} />;
}

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

export default App;
