import React, { useState, useEffect, useMemo } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { fetchConversationsFromBackend } from '../services/chatService';
import { getSettingsQuery } from '../db/repositories/settings';
import { Skeleton } from './common/Skeleton';
import OfflineAlertBanner from './OfflineAlertBanner';

const Layout = ({ user, onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const settings = useLiveQuery(getSettingsQuery);
  const [chatHeaderState, setChatHeaderState] = useState(null);

  const outletContext = useMemo(
    () => ({ chatHeaderState, setChatHeaderState }),
    [chatHeaderState]
  );

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

  // Sinkronisasi data percakapan dari backend saat user aktif
  useEffect(() => {
    if (user) {
      fetchConversationsFromBackend().catch(() => {});
      const interval = setInterval(() => {
        fetchConversationsFromBackend().catch(() => {});
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Reset header chat jika pindah halaman selain /chat
  useEffect(() => {
    if (location.pathname !== '/chat') {
      setChatHeaderState(null);
    }
  }, [location.pathname]);

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
    if (path === '/chat') return 'Chat';
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
                <Link to="/" className="text-decoration-none">
                  {settings === undefined ? (
                    <Skeleton width="130px" height="22px" borderRadius="6px" className="my-1" />
                  ) : (
                    <h5 className="mb-0 fw-bold text-primary">{settings?.namaLaundry || 'Kasir Laundry'}</h5>
                  )}
                </Link>
              </div>
              <div className="navbar--toggler" id="affanNavbarToggler" onClick={onLogout} style={{ cursor: 'pointer' }}>
                <i className="bi bi-box-arrow-right fs-4"></i>
              </div>
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
                    <button className="btn btn-sm p-0 text-primary" onClick={() => navigate(-1)}>
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

      <div className="page-content-wrapper pb-3">
        <OfflineAlertBanner />
        <div className="container-fluid px-3">
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
