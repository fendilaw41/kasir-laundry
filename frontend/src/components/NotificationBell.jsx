import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  getNotificationsQuery,
  markNotificationRead,
  markAllNotificationsRead,
  syncNotificationsFromBackend,
} from '../db/repositories/notifications';

function formatNotificationTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const timeStr = date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (isToday) {
    return `Hari ini, ${timeStr}`;
  }

  const dateStr = date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
  });
  return `${dateStr}, ${timeStr}`;
}

export default function NotificationBell({ user }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Ambil notifikasi dari Dexie (maksimal 5 item terbaru sesuai role)
  const notifications = useLiveQuery(getNotificationsQuery(user), [user?.role]) || [];
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sinkronkan notifikasi dari backend saat dropdown dibuka atau saat mount
  useEffect(() => {
    syncNotificationsFromBackend();
  }, []);

  const handleToggle = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      syncNotificationsFromBackend();
    }
  };

  const handleClickItem = async (item) => {
    await markNotificationRead(item.id, item.uuid);
    setIsOpen(false);
    if (item.link) {
      navigate(item.link);
    }
  };

  const handleMarkAllRead = async (e) => {
    e.stopPropagation();
    await markAllNotificationsRead(user);
  };

  return (
    <div className="position-relative" ref={dropdownRef}>
      {/* Tombol Lonceng di Header */}
      <div
        className="navbar--toggler flex-shrink-0 d-flex align-items-center justify-content-center rounded-circle border shadow-xs position-relative"
        onClick={handleToggle}
        style={{
          cursor: 'pointer',
          width: '38px',
          height: '38px',
          backgroundColor: '#f8fafc',
          borderColor: '#e2e8f0',
          color: '#0d6efd',
        }}
        title="Notifikasi"
        aria-label="Notifikasi"
      >
        <i className="bi bi-bell fs-5"></i>
        {unreadCount > 0 && (
          <span
            className="position-absolute rounded-circle border border-white"
            style={{
              top: '4px',
              right: '4px',
              width: '9px',
              height: '9px',
              backgroundColor: '#ef4444',
            }}
          />
        )}
      </div>

      {/* Dropdown Menu Notifikasi */}
      {isOpen && (
        <div
          className="card border shadow-lg position-absolute end-0 bg-white"
          style={{
            top: '46px',
            width: '320px',
            maxWidth: 'calc(100vw - 32px)',
            borderRadius: '16px',
            borderColor: '#e2e8f0',
            zIndex: 1060,
            overflow: 'hidden',
          }}
        >
          {/* Header Dropdown */}
          <div className="px-3 py-3 bg-white border-bottom d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center gap-2">
              <span className="fw-bold text-dark" style={{ fontSize: '0.85rem' }}>
                Notifikasi
              </span>
              {unreadCount > 0 && (
                <span
                  className="badge rounded-pill bg-danger bg-opacity-10"
                  style={{ fontSize: '0.65rem' }}
                >
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                className="btn btn-link p-0 text-decoration-none text-primary fw-medium"
                style={{ fontSize: '0.72rem' }}
                onClick={handleMarkAllRead}
              >
                Tandai dibaca
              </button>
            )}
          </div>

          {/* List Notifikasi (Maks 5 item) */}
          <div className="list-group list-group-flush" style={{ maxHeight: '360px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-muted">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-2 text-muted"
                  style={{ width: '42px', height: '42px', backgroundColor: '#f1f5f9' }}
                >
                  <i className="bi bi-bell-slash fs-5"></i>
                </div>
                <p className="mb-0 fw-semibold" style={{ fontSize: '0.8rem', color: '#475569' }}>
                  Belum ada notifikasi
                </p>
                <small style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                  Aktivitas transaksi & stok akan muncul di sini
                </small>
              </div>
            ) : (
              notifications.map((item) => {
                const isUnread = !item.isRead;
                return (
                  <div
                    key={item.id || item.uuid}
                    className="list-group-item list-group-item-action p-2.5 border-bottom text-start"
                    onClick={() => handleClickItem(item)}
                    style={{
                      cursor: 'pointer',
                      backgroundColor: isUnread ? '#f1f5f9' : '#ffffff',
                      borderLeft: isUnread ? '3px solid #0d6efd' : '3px solid transparent',
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    <div className="d-flex align-items-center justify-content-between mb-1">
                      <span
                        className={`text-truncate me-2 ${isUnread ? 'fw-bold text-dark' : 'fw-semibold text-secondary'}`}
                        style={{ fontSize: '0.78rem' }}
                      >
                        {item.title}
                      </span>
                      <small
                        className="text-muted flex-shrink-0"
                        style={{ fontSize: '0.65rem' }}
                      >
                        {formatNotificationTime(item.createdAt)}
                      </small>
                    </div>
                    <p
                      className="mb-0 text-muted"
                      style={{
                        fontSize: '0.72rem',
                        lineHeight: '1.35',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={item.message}
                    >
                      {item.message}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

