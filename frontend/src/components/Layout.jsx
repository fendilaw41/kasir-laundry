import React, { useState, useEffect, useMemo } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { fetchConversationsFromBackend } from '../services/chatService';
import { getSettingsQuery } from '../db/repositories/settings';
import { getActiveStoreId } from '../db/repositories/storeHelper';
import { Skeleton } from './common/Skeleton';
import OfflineAlertBanner from './OfflineAlertBanner';
import NotificationBell from './NotificationBell';
import { isStatusLunas } from '../utils/paymentStatus';

const Layout = ({ user, onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const settings = useLiveQuery(getSettingsQuery);
  const [chatHeaderState, setChatHeaderState] = useState(null);
  const [homeSearchQuery, setHomeSearchQuery] = useState('');
  const [homeSearchResults, setHomeSearchResults] = useState([]);
  const [isHomeSearchOpen, setIsHomeSearchOpen] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const searchDropdownRef = React.useRef(null);

  const outletContext = useMemo(
    () => ({
      chatHeaderState,
      setChatHeaderState,
      productSearchTerm,
      setProductSearchTerm,
    }),
    [chatHeaderState, productSearchTerm]
  );

  // Close search dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(event.target)) {
        setIsHomeSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close search dropdown on route change
  useEffect(() => {
    setIsHomeSearchOpen(false);
  }, [location.pathname]);

  // Debounced search for Home
  useEffect(() => {
    const q = homeSearchQuery.trim().toLowerCase();
    if (!q) {
      setHomeSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const storeId = await getActiveStoreId();
        const all = await db.orders.orderBy('createdAt').reverse().toArray();
        const storeOrders = all.filter(o => !o.deletedAt && (!storeId || !o.storeId || o.storeId === storeId));
        const matched = storeOrders.filter(o =>
          (o.pelangganNama && o.pelangganNama.toLowerCase().includes(q)) ||
          (o.invoiceId && o.invoiceId.toLowerCase().includes(q)) ||
          (o.id && String(o.id).toLowerCase() === q)
        ).slice(0, 10);
        setHomeSearchResults(matched);
      } catch (err) {
        console.warn('Error searching home orders:', err);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [homeSearchQuery]);

  const handleHomeSearchKeyDown = async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = homeSearchQuery.trim().toLowerCase();
      if (!q) return;

      const storeId = await getActiveStoreId();
      const all = await db.orders.orderBy('createdAt').reverse().toArray();
      const storeOrders = all.filter(o => !o.deletedAt && (!storeId || !o.storeId || o.storeId === storeId));
      const matched = storeOrders.filter(o =>
        (o.pelangganNama && o.pelangganNama.toLowerCase().includes(q)) ||
        (o.invoiceId && o.invoiceId.toLowerCase().includes(q)) ||
        (o.id && String(o.id).toLowerCase() === q)
      );

      if (matched.length === 1) {
        setHomeSearchQuery('');
        setIsHomeSearchOpen(false);
        navigate(`/order/${matched[0].id || matched[0].uuid}`);
      } else {
        setHomeSearchResults(matched.slice(0, 10));
        setIsHomeSearchOpen(true);
      }
    }
  };

  // Ambil total pesan chat belum dibaca secara reaktif dari Dexie IndexedDB
  const totalUnreadChat = useLiveQuery(async () => {
    try {
      if (!db.conversations) return 0;
      const convs = await db.conversations.toArray();
      const currentUserId = String(user?.uuid || user?.id || user?.userId || '');
      const currentUsername = (user?.username || '').toLowerCase().trim();

      const userConvs = convs.filter((conv) => {
        if (user?.role === 'kasir' && conv.members && Array.isArray(conv.members)) {
          return conv.members.some((m) => {
            const memberUserId = String(m.userId || m.user?.id || m.user?.uuid || '');
            const memberUsername = (m.user?.username || '').toLowerCase().trim();
            return (
              (memberUserId && memberUserId === currentUserId) ||
              (currentUsername && memberUsername === currentUsername)
            );
          });
        }
        return true;
      });

      return userConvs.reduce((sum, c) => sum + (Number(c.unreadCount) || 0), 0);
    } catch {
      return 0;
    }
  }, [user]) || 0;

  // Sinkronisasi data percakapan dari backend saat user aktif (hemat resource jika di luar /chat)
  useEffect(() => {
    if (user) {
      const isChat = location.pathname === '/chat';
      fetchConversationsFromBackend(isChat).catch(() => {});
      const intervalMs = isChat ? 20000 : 120000;
      const interval = setInterval(() => {
        if (!document.hidden) {
          fetchConversationsFromBackend(isChat).catch(() => {});
        }
      }, intervalMs);
      return () => clearInterval(interval);
    }
  }, [user, location.pathname]);

  // Reset header chat jika pindah halaman selain /chat
  useEffect(() => {
    if (location.pathname !== '/chat') {
      setChatHeaderState(null);
    }
  }, [location.pathname]);

  const titleApp = settings?.namaLaundry || 'Kasir Laundry';

  // Daftar menu utama (yang ada di footer)
  const searchParams = new URLSearchParams(location.search);
  const isSettingSub = location.pathname === '/setting' && Boolean(searchParams.get('tab'));
  const mainMenus = ['/', '/product', '/transaksi', '/orders', '/setting'];
  const isMainMenu = mainMenus.includes(location.pathname) && !isSettingSub;

  // Mapping Judul Halaman untuk Sub-menu
  const getPageTitle = () => {
    const path = location.pathname;
    const tab = searchParams.get('tab');
    if (path === '/setting' && tab) {
      if (tab === 'umum') return 'Pengaturan Toko';
      if (tab === 'product') return 'Layanan';
      if (tab === 'struk') return 'Format Nota & Struk';
      if (tab === 'kasir') return 'Manajemen Kasir';
      if (tab === 'password') return 'Ubah Password';
    }
    if (path === '/setting') return 'Pengaturan';
    if (path === '/pembayaran') return 'Pembayaran';
    if (path.startsWith('/order/')) return 'Detail Order';
    if (path === '/product') return 'Layanan';
    if (path === '/chat') return 'Chat';
    if (path === '/pergerakan-stok' || path === '/inventory-movement') return 'Stock History';
    if (path === '/plan' || path === '/paket') return 'Plan';
    return titleApp;
  };

  return (
    <>
      {/* Header Area */}
      <div className="header-area" id="headerArea">
        <div className="container-fluid h-100 d-flex align-items-center justify-content-between px-3">
          {isMainMenu ? (
            <>
              {location.pathname === '/' ? (
                /* Header Halaman Home: Searching Pelanggan & Kode Transaksi */
                <div className="d-flex align-items-center flex-grow-1 me-2 position-relative">
                  <i
                    className="bi bi-search position-absolute start-0 ms-3"
                    style={{ color: '#0d6efd', fontSize: '0.92rem', zIndex: 2 }}
                  ></i>
                  <input
                    type="text"
                    className="form-control rounded-pill ps-5 pe-4 py-1.5 shadow-xs"
                    style={{
                      fontSize: '0.84rem',
                      fontWeight: 500,
                      color: '#1e293b',
                      backgroundColor: '#f0f5ff',
                      border: '1.5px solid #b9d5ff',
                      height: '38px',
                      transition: 'all 0.2s ease',
                    }}
                    onFocus={(e) => {
                      e.target.style.backgroundColor = '#ffffff';
                      e.target.style.borderColor = '#0d6efd';
                      e.target.style.boxShadow = '0 0 0 3px rgba(13, 110, 253, 0.15)';
                      if (homeSearchQuery.trim()) setIsHomeSearchOpen(true);
                    }}
                    onBlur={(e) => {
                      e.target.style.backgroundColor = '#f0f5ff';
                      e.target.style.borderColor = '#b9d5ff';
                      e.target.style.boxShadow = 'none';
                    }}
                    placeholder="Cari pelanggan / Nomor Order..."
                    value={homeSearchQuery}
                    onChange={(e) => {
                      setHomeSearchQuery(e.target.value);
                      setIsHomeSearchOpen(true);
                    }}
                    onKeyDown={handleHomeSearchKeyDown}
                  />
                  {homeSearchQuery && (
                    <button
                      type="button"
                      className="btn btn-sm btn-link position-absolute end-0 me-2 p-0 text-muted"
                      onClick={() => {
                        setHomeSearchQuery('');
                        setHomeSearchResults([]);
                        setIsHomeSearchOpen(false);
                      }}
                      style={{ zIndex: 2 }}
                    >
                      <i className="bi bi-x-circle-fill" style={{ fontSize: '0.92rem', color: '#64748b' }}></i>
                    </button>
                  )}
                </div>
              ) : location.pathname === '/product' ? (
                /* Header Halaman Produk: Cari Layanan */
                <div className="d-flex align-items-center flex-grow-1 me-2 position-relative">
                  <i
                    className="bi bi-search position-absolute start-0 ms-3"
                    style={{ color: '#0d6efd', fontSize: '0.92rem', zIndex: 2 }}
                  ></i>
                  <input
                    type="text"
                    className="form-control rounded-pill ps-5 pe-4 py-1.5 shadow-xs"
                    style={{
                      fontSize: '0.84rem',
                      fontWeight: 500,
                      color: '#1e293b',
                      backgroundColor: '#f0f5ff',
                      border: '1.5px solid #b9d5ff',
                      height: '38px',
                      transition: 'all 0.2s ease',
                    }}
                    onFocus={(e) => {
                      e.target.style.backgroundColor = '#ffffff';
                      e.target.style.borderColor = '#0d6efd';
                      e.target.style.boxShadow = '0 0 0 3px rgba(13, 110, 253, 0.15)';
                    }}
                    onBlur={(e) => {
                      e.target.style.backgroundColor = '#f0f5ff';
                      e.target.style.borderColor = '#b9d5ff';
                      e.target.style.boxShadow = 'none';
                    }}
                    placeholder="Cari nama layanan..."
                    value={productSearchTerm}
                    onChange={(e) => setProductSearchTerm(e.target.value)}
                  />
                  {productSearchTerm && (
                    <button
                      type="button"
                      className="btn btn-sm btn-link position-absolute end-0 me-2 p-0 text-muted"
                      onClick={() => setProductSearchTerm('')}
                      style={{ zIndex: 2 }}
                    >
                      <i className="bi bi-x-circle-fill" style={{ fontSize: '0.92rem', color: '#64748b' }}></i>
                    </button>
                  )}
                </div>
              ) : (
                /* Header Halaman Transaksi / Data Order */
                <div className="logo-wrapper">
                  <h5 className="mb-0 fw-bold text-primary">
                    {location.pathname === '/transaksi' ? 'Transaksi' : location.pathname === '/orders' ? 'Data Order' : (settings?.namaLaundry || 'Kasir Laundry')}
                  </h5>
                </div>
              )}
              <NotificationBell user={user} />
            </>
          ) : (
            <>
              {location.pathname === '/chat' && chatHeaderState ? (
                /* Header Aktif Saat Masuk Ruang Chat / Bot */
                <div className="d-flex align-items-center justify-content-between w-100">
                  <div className="d-flex align-items-center overflow-hidden" style={{ minWidth: 0 }}>
                    <button
                      type="button"
                      className="btn btn-sm p-0 text-primary me-2 flex-shrink-0"
                      onClick={chatHeaderState.onBack}
                      title="Kembali ke Daftar Chat"
                    >
                      <i className="bi bi-arrow-left fs-4"></i>
                    </button>

                    {/* Image / Avatar di samping nama orang / bot */}
                    {chatHeaderState.type === 'bot' ? (
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 me-2"
                        style={{ width: '36px', height: '36px', backgroundColor: '#eaf1ff', color: '#0d5afd' }}
                      >
                        <i className="bi bi-robot fs-5"></i>
                      </div>
                    ) : chatHeaderState.avatarImage ? (
                      <img
                        src={chatHeaderState.avatarImage}
                        alt=""
                        className="rounded-circle object-fit-cover flex-shrink-0 me-2"
                        style={{ width: '36px', height: '36px' }}
                      />
                    ) : (
                      <div
                        className={`rounded-circle d-flex align-items-center justify-content-center text-white fw-bold shadow-sm flex-shrink-0 me-2 ${chatHeaderState.isCrossStore
                          ? 'bg-purple'
                          : chatHeaderState.isGroup
                            ? 'bg-info'
                            : 'bg-primary'
                          }`}
                        style={{
                          width: '36px',
                          height: '36px',
                          backgroundColor: chatHeaderState.isCrossStore ? '#6f42c1' : undefined,
                          fontSize: '0.9rem',
                        }}
                      >
                        {chatHeaderState.isCrossStore ? (
                          <i className="bi bi-globe2 fs-5"></i>
                        ) : chatHeaderState.isGroup ? (
                          <i className="bi bi-people-fill fs-5"></i>
                        ) : (
                          chatHeaderState.avatarLetter || 'U'
                        )}
                      </div>
                    )}

                    {/* Nama bot / orang & subtitle */}
                    <div className="overflow-hidden" style={{ minWidth: 0 }}>
                      <div className="d-flex align-items-center gap-1">
                        <h6 className="mb-0 fw-bold text-dark text-truncate" style={{ fontSize: '0.92rem', lineHeight: '1.2' }}>
                          {chatHeaderState.title}
                        </h6>
                        {chatHeaderState.isOwner && (
                          <i
                            className="bi bi-patch-check-fill text-primary"
                            style={{ fontSize: '13px' }}
                            title="Owner Terverifikasi"
                          ></i>
                        )}
                      </div>
                      {chatHeaderState.subtitle && (
                        <small className="text-muted text-truncate d-block" style={{ fontSize: '0.72rem', lineHeight: '1.2' }}>
                          {chatHeaderState.subtitle}
                        </small>
                      )}
                    </div>
                  </div>

                  {/* Tombol aksi kanan: Hanya untuk Chat Bot (Mode Cepat ⚡ & Reset +), new chat hilang */}
                  <div className="d-flex align-items-center gap-1 flex-shrink-0 ms-2">
                    {chatHeaderState.type === 'bot' ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-sm btn-light rounded-circle text-primary shadow-sm d-flex align-items-center justify-content-center p-0"
                          style={{ width: '34px', height: '34px' }}
                          onClick={() => window.dispatchEvent(new CustomEvent('openQuickCommandsModal'))}
                          title="Pilihan Perintah Cepat (Mode Cepat)"
                        >
                          <i className="bi bi-lightning-charge-fill fs-6"></i>
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-light rounded-circle text-primary shadow-sm d-flex align-items-center justify-content-center p-0"
                          style={{ width: '34px', height: '34px' }}
                          onClick={() => window.dispatchEvent(new CustomEvent('openResetBotChatModal'))}
                          title="Percakapan Baru"
                        >
                          <i className="bi bi-plus-lg fs-6"></i>
                        </button>
                      </>
                    ) : chatHeaderState.isCrossStore ? (
                      <span className="badge bg-purple-subtle text-purple border rounded-pill px-2 py-1" style={{ fontSize: '0.65rem' }}>
                        Lintas Cabang
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : (
                <>
                  {/* Tampilan Sub-Menu Default (Back Button & Title) */}
                  <div className="back-button">
                    <button
                      className="btn btn-sm p-0 text-primary"
                      onClick={() => {
                        if (location.pathname === '/setting' && location.search.includes('tab=')) {
                          navigate('/setting');
                        } else {
                          navigate(-1);
                        }
                      }}
                      title="Kembali"
                    >
                      <i className="bi bi-arrow-left fs-4"></i>
                    </button>
                  </div>
                  <div className="page-heading">
                    {settings === undefined && getPageTitle() === titleApp ? (
                      <Skeleton width="120px" height="18px" borderRadius="6px" />
                    ) : (
                      <h6 className="mb-0 fw-bold">{getPageTitle()}</h6>
                    )}
                  </div>
                  <div className="setting-wrapper d-flex gap-3 align-items-center">
                    {location.pathname === '/chat' && (
                      <button
                        className="btn btn-primary btn-sm rounded-pill px-3 py-1 shadow-sm d-flex align-items-center gap-1"
                        onClick={() => window.dispatchEvent(new CustomEvent('openNewChatModal'))}
                        title="Mulai Chat Baru"
                      >
                        <i className="bi bi-plus-lg"></i>
                        <span style={{ fontSize: '0.8rem' }}>Chat Baru</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Dropdown Hasil Pencarian Home (Muncul di bawah header saat mencari / tekan enter) */}
      {location.pathname === '/' && isHomeSearchOpen && homeSearchQuery.trim() && (
        <div
          ref={searchDropdownRef}
          className="position-fixed shadow-lg bg-white border border-top-0 rounded-bottom-4 p-3"
          style={{
            top: '50px',
            left: '12px',
            right: '12px',
            maxWidth: '480px',
            margin: '0 auto',
            maxHeight: '75vh',
            overflowY: 'auto',
            zIndex: 1055,
          }}
        >
          <div className="d-flex justify-content-between align-items-center mb-2 pb-1 border-bottom">
            <span className="small text-muted fw-bold" style={{ fontSize: '11px' }}>
              HASIL PENCARIAN ({homeSearchResults.length})
            </span>
            <button
              type="button"
              className="btn-close"
              style={{ width: '8px', height: '8px' }}
              onClick={() => setIsHomeSearchOpen(false)}
            ></button>
          </div>

          {homeSearchResults.length === 0 ? (
            <div className="text-center py-3 text-muted small">
              <i className="bi bi-search d-block fs-3 text-muted opacity-50 mb-1"></i>
              Tidak ditemukan order dengan kata kunci &quot;{homeSearchQuery}&quot;
            </div>
          ) : (
            <div className="d-flex flex-column gap-2">
              {homeSearchResults.map((order) => {
                const isLunas = isStatusLunas(order.statusBayar) || order.sisaBayar === 0 || (order.total > 0 && (order.bayar || 0) >= order.total);
                const dateStr = order.createdAt
                  ? new Date(order.createdAt).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : '';
                return (
                  <div
                    key={order.id || order.uuid}
                    className="p-3 rounded-3 border bg-light d-flex justify-content-between align-items-center"
                    style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                    onClick={() => {
                      setHomeSearchQuery('');
                      setIsHomeSearchOpen(false);
                      navigate(`/order/${order.id || order.uuid}`);
                    }}
                  >
                    <div className="overflow-hidden me-2" style={{ minWidth: 0 }}>
                      <div className="d-flex align-items-center gap-1.5">
                        <span className="fw-bold text-primary text-truncate" style={{ fontSize: '13px' }}>
                          {order.invoiceId || `#${order.id}`}
                        </span>
                        &nbsp;
                        <span
                          className={`badge rounded-pill ${
                            order.status === 'Selesai'
                              ? 'bg-success'
                              : order.status === 'Diambil'
                              ? 'bg-secondary'
                              : 'bg-primary'
                          }`}
                          style={{ fontSize: '9.5px' }}
                        >
                          {order.status || 'Baru'}
                        </span>
                      </div>
                      <div className="small text-dark text-truncate mt-0.5" style={{ fontSize: '12px' }}>
                        <i className="bi bi-person me-1 text-muted"></i>
                        {order.pelangganNama || 'Pelanggan Umum'}
                        {dateStr && <span className="text-muted ms-1">({dateStr})</span>}
                      </div>
                    </div>
                    <div className="text-end flex-shrink-0">
                      <div className="fw-bold text-primary" style={{ fontSize: '13px' }}>
                        Rp {(order.total || 0).toLocaleString('id-ID')}
                      </div>
                      <span
                        className={`badge rounded-pill ${
                          isLunas ? 'bg-success-subtle text-success border border-success' : 'bg-warning-subtle text-dark border border-warning'
                        }`}
                        style={{ fontSize: '9px' }}
                      >
                        {isLunas ? 'Lunas' : 'Belum Lunas'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="page-content-wrapper pb-3">
        <OfflineAlertBanner />
        <div className="container-fluid px-0">
          <Outlet context={outletContext} />
        </div>
      </div>

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
                <li className={location.pathname === '/orders' ? 'active' : ''}>
                  <Link to="/orders">
                    <i className={`bi ${location.pathname === '/orders' ? 'bi-list-check' : 'bi-list'}`} style={{ fontSize: '20px' }}></i>
                    <span>Riwayat</span>
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
                    <div className="position-relative d-inline-block">
                      <i className={`bi ${location.pathname === '/chat' ? 'bi-chat-dots-fill' : 'bi-chat-dots'}`} style={{ fontSize: '20px' }}></i>
                      {totalUnreadChat > 0 && (
                        <span
                          className="badge bg-success rounded-pill px-2 py-1 position-absolute top-0 start-100 translate-middle"
                          style={{ fontSize: '0.7rem', flexShrink: 0 }}
                        >
                          {totalUnreadChat}
                        </span>
                      )}
                    </div>
                    <span>Chat</span>
                  </Link>
                </li>
                <li className={location.pathname.startsWith('/setting') ? 'active' : ''}>
                  <Link to="/setting">
                    <i className={`bi ${location.pathname.startsWith('/setting') ? 'bi-gear-fill' : 'bi-gear'}`} style={{ fontSize: '20px' }}></i>
                    <span>Pengaturan</span>
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
