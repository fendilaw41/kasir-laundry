import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Transaksi from './pages/Transaksi';
import Cari from './pages/Cari';
import DataOrder from './pages/DataOrder';
import Pembayaran from './pages/Pembayaran';
import OrderDetail from './pages/OrderDetail';
import Product from './pages/Product';
import Layout from './components/Layout';

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
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
