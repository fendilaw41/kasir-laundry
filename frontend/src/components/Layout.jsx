import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getSettingsQuery } from '../db/repositories/settings';

const Layout = ({ user, onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showChatOptions, setShowChatOptions] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ show: false, message: '', onConfirm: null });
  const settings = useLiveQuery(getSettingsQuery);

  const titleApp = settings?.namaLaundry || 'Kasir Laundry';

  // Daftar menu utama (yang ada di footer)
  const mainMenus = ['/', '/product', '/transaksi', '/orders'];
  const isMainMenu = mainMenus.includes(location.pathname);

  // Mapping Judul Halaman untuk Sub-menu
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/pembayaran') return 'Pembayaran';
    if (path.startsWith('/order/')) return 'Detail Order';
    if (path === '/product') return 'Pilih Layanan';
    if (path === '/chat') return 'Assisten Chat';
    return titleApp;
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
                  <h5 className="mb-0 fw-bold text-primary">{titleApp}</h5>
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
              <div className="setting-wrapper d-flex gap-3 align-items-center">
                {location.pathname === '/chat' && (
                  <>
                    <button 
                      className="btn btn-sm p-0 text-primary" 
                      onClick={() => setShowChatOptions(true)}
                      title="Pilihan Perintah Cepat"
                    >
                      <i className="bi bi-lightning-charge-fill fs-4"></i>
                    </button>
                    <button 
                      className="btn btn-sm p-0 text-primary" 
                      onClick={() => {
                        setConfirmModal({
                          show: true,
                          message: "Mulai percakapan baru? Riwayat chat di layar ini akan dihapus.",
                          onConfirm: async () => {
                            try {
                              const { db } = await import('../db');
                              await db.chatLog.clear();
                              setConfirmModal({ show: false, message: '', onConfirm: null });
                            } catch (error) {
                              console.error('Failed to clear chat log:', error);
                            }
                          }
                        });
                      }}
                      title="Percakapan Baru"
                    >
                      <i className="bi bi-plus-lg fs-4"></i>
                    </button>
                  </>
                )}
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

      {/* Modal Quick Commands (Chat) */}
      {showChatOptions && (
        <>
          <div className="modal-backdrop fade show" style={{ backdropFilter: 'blur(5px)', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }} onClick={() => setShowChatOptions(false)}></div>
          <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1065 }}>
            <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable mx-auto" style={{ maxWidth: '500px' }}>
              <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '24px' }}>
                <div className="modal-header border-0 pb-0 pt-4 px-4">
                  <div>
                    <h5 className="fw-bold mb-0 text-primary"><i className="bi bi-lightning-charge-fill me-2"></i>Perintah Cepat</h5>
                    {/* <small className="text-muted d-block mb-2 mt-2" style={{ fontSize: '0.8rem', lineHeight: '1.3' }}>Format: trx [layanan] [berat]kg [nama] [bayar] [estimasi] [tipe layanan]</small> */}
                  </div>
                  <button type="button" className="btn-close" onClick={() => setShowChatOptions(false)}></button>
                </div>
                <div className="modal-body p-4">
                  <div className="row g-3">
                    <div className="col-12">
                      <div className="card shadow-sm border-0 h-100 text-start p-3 customer-card-clickable" style={{ cursor: 'pointer', borderRadius: '16px', background: '#f0f4f9' }} onClick={() => { window.dispatchEvent(new CustomEvent('insertChatTemplate', { detail: 'trx CLR 5kg agus lunas besok DL' })); setShowChatOptions(false); }}>
                        <h6 className="mb-1 text-primary" style={{ fontSize: '0.95rem' }}><i className="bi bi-cart-plus me-2"></i>Transaksi Lengkap</h6>
                        <code className="bg-white p-2 rounded-3 d-block shadow-sm" style={{ fontSize: '0.8rem', color: '#555' }}>trx CLR 5kg agus lunas besok DL</code>
                      </div>
                    </div>
                    <div className="col-12">
                      <div className="card shadow-sm border-0 h-100 text-start p-3 customer-card-clickable" style={{ cursor: 'pointer', borderRadius: '16px', background: '#f0f4f9' }} onClick={() => { window.dispatchEvent(new CustomEvent('insertChatTemplate', { detail: 'trx CLR 5kg agus-0812345678 dp 2hari AJ' })); setShowChatOptions(false); }}>
                        <h6 className="mb-1 text-primary" style={{ fontSize: '0.95rem' }}><i className="bi bi-person-plus me-2"></i>Transaksi + Kontak Baru</h6>
                        <code className="bg-white p-2 rounded-3 d-block shadow-sm" style={{ fontSize: '0.8rem', color: '#555' }}>trx CLR 5kg agus-081234 dp 2hari AJ</code>
                      </div>
                    </div>
                    <div className="col-12">
                      <div className="card shadow-sm border-0 h-100 text-start p-3 customer-card-clickable" style={{ cursor: 'pointer', borderRadius: '16px', background: '#e1f5fe' }} onClick={() => { window.dispatchEvent(new CustomEvent('insertChatTemplate', { detail: 'tambah plastik 100pcs, molto 5pcs' })); setShowChatOptions(false); }}>
                        <h6 className="mb-1 text-info" style={{ fontSize: '0.95rem' }}><i className="bi bi-box-seam me-2"></i>Tambah Stok Inventaris</h6>
                        <code className="bg-white p-2 rounded-3 d-block shadow-sm" style={{ fontSize: '0.8rem', color: '#555' }}>tambah plastik 100pcs, molto 5</code>
                      </div>
                    </div>
                    {user?.role === 'owner' && (
                      <div className="col-12">
                        <div className="card shadow-sm border-0 h-100 text-start p-3 customer-card-clickable" style={{ cursor: 'pointer', borderRadius: '16px', background: '#e1f5fe' }} onClick={() => { window.dispatchEvent(new CustomEvent('insertChatTemplate', { detail: 'acc semua inventory' })); setShowChatOptions(false); }}>
                          <h6 className="mb-1 text-info" style={{ fontSize: '0.95rem' }}><i className="bi bi-check-circle me-2"></i>Approval (Khusus Owner)</h6>
                          <code className="bg-white p-2 rounded-3 d-block shadow-sm" style={{ fontSize: '0.8rem', color: '#555' }}>acc semua inventory</code>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal Konfirmasi */}
      {confirmModal.show && (
        <>
          <div className="modal-backdrop fade show" style={{ backdropFilter: 'blur(5px)', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}></div>
          <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1065 }}>
            <div className="modal-dialog modal-dialog-centered mx-auto" style={{ maxWidth: '320px' }}>
              <div className="modal-content border-0 shadow-lg text-center p-4" style={{ borderRadius: '24px' }}>
                <h6 className="fw-bold mb-2">Konfirmasi</h6>
                <p className="text-muted small mb-4" style={{ whiteSpace: 'pre-wrap' }}>{confirmModal.message}</p>
                <div className="d-flex gap-2">
                  <button className="btn btn-outline-primary rounded-pill w-50 fw-bold" onClick={() => setConfirmModal({ show: false, message: '', onConfirm: null })}>Batal</button>
                  <button className="btn btn-outline-primary rounded-pill w-50 fw-bold" onClick={() => { if(confirmModal.onConfirm) confirmModal.onConfirm(); }}>Lanjutkan</button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Footer Nav */}
      {location.pathname !== '/chat' && (
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
                <li className={location.pathname === '/product' ? 'active' : ''}>
                  <Link to="/product">
                    <i className={`bi ${location.pathname === '/product' ? 'bi-grid-fill' : 'bi-grid'}`} style={{ fontSize: '20px' }}></i>
                    <span>Produk</span>
                  </Link>
                </li>
                <li className={location.pathname === '/transaksi' ? 'active' : ''}>
                  <Link to="/transaksi">
                    <i className={`bi ${location.pathname === '/transaksi' ? 'bi-cart-plus-fill' : 'bi-cart-plus'}`} style={{ fontSize: '20px' }}></i>
                    <span>Transaksi</span>
                  </Link>
                </li>
                <li className={location.pathname === '/chat' ? 'active' : ''}>
                  <Link to="/chat">
                    <i className={`bi ${location.pathname === '/chat' ? 'bi-chat-dots-fill' : 'bi-chat-dots'}`} style={{ fontSize: '20px' }}></i>
                    <span>Chat</span>
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
      )}
    </>
  );
};

export default Layout;
