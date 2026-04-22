import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

const Layout = ({ onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();

  // Daftar menu utama (yang ada di footer)
  const mainMenus = ['/', '/transaksi', '/cari', '/orders'];
  const isMainMenu = mainMenus.includes(location.pathname);

  // Mapping Judul Halaman untuk Sub-menu
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/pembayaran') return 'Pembayaran';
    if (path.startsWith('/order/')) return 'Detail Order';
    if (path === '/product') return 'Pilih Layanan';
    return 'Kasir Laundry';
  };

  return (
    <>
      {/* Header Area */}
      <div className="header-area" id="headerArea">
        <div className="container-fluid h-100 d-flex align-items-center justify-content-between px-3">
          {isMainMenu ? (
            <>
              {/* Tampilan Menu Utama (Logo & Toggler) */}
              <div className="logo-wrapper">
                <Link to="/">
                  <h5 className="mb-0 fw-bold text-primary">Kasir Laundry</h5>
                </Link>
              </div>
              <div className="navbar--toggler" id="affanNavbarToggler" onClick={onLogout} style={{ cursor: 'pointer' }}>
                <i className="bi bi-box-arrow-right fs-4"></i>
              </div>
            </>
          ) : (
            <>
              {/* Tampilan Sub-Menu (Back Button & Title) */}
              <div className="back-button">
                <button className="btn btn-sm p-0 text-primary" onClick={() => navigate(-1)}>
                  <i className="bi bi-arrow-left fs-4"></i>
                </button>
              </div>
              <div className="page-heading">
                <h6 className="mb-0 fw-bold">{getPageTitle()}</h6>
              </div>
              <div className="setting-wrapper">
              </div>
            </>
          )}
        </div>
      </div>

      <div className="page-content-wrapper pb-3">
        <div className="container-fluid px-3">
          <Outlet />
        </div>
      </div>

      {/* Footer Nav */}
      <div className="footer-nav-area" id="footerNav">
        <div className="container px-0">
          <div className="footer-nav position-relative shadow-sm" style={{ borderTop: '1px solid #ebebeb' }}>
            <ul className="h-100 d-flex align-items-center justify-content-between ps-0 mb-0">
              <li className={location.pathname === '/' ? 'active' : ''}>
                <Link to="/">
                  <i className={`bi ${location.pathname === '/' ? 'bi-house-fill' : 'bi-house'}`} style={{ fontSize: '20px' }}></i>
                  <span>Home</span>
                </Link>
              </li>
              <li className={location.pathname === '/cari' ? 'active' : ''}>
                <Link to="/cari">
                  <i className={`bi ${location.pathname === '/cari' ? 'bi-search' : 'bi-search'}`} style={{ fontSize: '20px' }}></i>
                  <span>Cari Order</span>
                </Link>
              </li>
              <li className={location.pathname === '/transaksi' ? 'active' : ''}>
                <Link to="/transaksi">
                  <i className={`bi ${location.pathname === '/transaksi' ? 'bi-cart-plus-fill' : 'bi-cart-plus'}`} style={{ fontSize: '20px' }}></i>
                  <span>Transaksi</span>
                </Link>
              </li>
              <li className={location.pathname === '/orders' ? 'active' : ''}>
                <Link to="/orders">
                  <i className={`bi ${location.pathname === '/orders' ? 'bi-list-check' : 'bi-list'}`} style={{ fontSize: '20px' }}></i>
                  <span>Riwayat</span>
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
};

export default Layout;
