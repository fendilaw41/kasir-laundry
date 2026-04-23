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
