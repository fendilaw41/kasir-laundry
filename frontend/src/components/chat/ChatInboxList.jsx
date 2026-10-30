import React, { useState } from 'react';

export const ChatInboxList = ({
  conversations = [],
  onSelectConversation,
  onOpenNewChatModal,
  enableCrossStore = false,
  currentUser,
}) => {
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'store' | 'cross'
  const [searchQuery, setSearchQuery] = useState('');

  // Format waktu pesan terakhir (HH:mm atau DD/MM)
  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    return `${date.getDate()}/${date.getMonth() + 1}`;
  };

  // Filter percakapan
  const filteredConversations = conversations.filter((conv) => {
    // Filter tab
    if (activeFilter === 'store' && conv.type === 'CROSS_STORE') return false;
    if (activeFilter === 'cross' && conv.type !== 'CROSS_STORE') return false;

    // Filter teks pencarian
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const titleMatch = (conv.title || '').toLowerCase().includes(q);
    const lastMsgMatch = (conv.lastMessage?.content || '').toLowerCase().includes(q);
    return titleMatch || lastMsgMatch;
  });

  return (
    <div className="d-flex flex-column h-100 bg-white" style={{ position: 'relative' }}>
      {/* Search & Filter Bar */}
      <div className="p-3 border-bottom bg-light">
        {/* Input Pencarian */}
        <div className="position-relative">
          <i className="bi bi-search position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"></i>
          <input
            type="text"
            className="form-control rounded-pill ps-5 bg-white border-0 shadow-sm"
            style={{ fontSize: '0.85rem' }}
            placeholder="Cari chat atau pesan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filter Chips - Hanya tampil jika fitur lintas cabang aktif */}
        {enableCrossStore && (
          <div className="d-flex gap-2 overflow-x-auto pb-1 mt-2">
            <button
              type="button"
              className={`btn btn-sm rounded-pill px-3 py-1 ${activeFilter === 'all' ? 'btn-primary' : 'btn-outline-secondary'}`}
              style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}
              onClick={() => setActiveFilter('all')}
            >
              Semua
            </button>
            <button
              type="button"
              className={`btn btn-sm rounded-pill px-3 py-1 ${activeFilter === 'store' ? 'btn-primary' : 'btn-outline-secondary'}`}
              style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}
              onClick={() => setActiveFilter('store')}
            >
              Toko Saya
            </button>
            <button
              type="button"
              className={`btn btn-sm rounded-pill px-3 py-1 ${activeFilter === 'cross' ? 'btn-primary' : 'btn-outline-secondary'}`}
              style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}
              onClick={() => setActiveFilter('cross')}
            >
              🌐 Lintas Cabang
            </button>
          </div>
        )}
      </div>

      {/* List Percakapan */}
      <div className="flex-grow-1 overflow-y-auto">
        {/* 1. PINNED CHAT AT THE VERY TOP: ASISTEN ORDER BOT */}
        <div
          className="d-flex align-items-center gap-3 p-3 border-bottom cursor-pointer customer-card-clickable"
          style={{
            cursor: 'pointer',
            backgroundColor: '#f6f8fc',
            borderLeft: '4px solid #0d5afd',
            transition: 'background-color 0.2s',
          }}
          onClick={() => onSelectConversation('bot')}
        >
          <div
            className="rounded-circle d-flex align-items-center justify-content-center shadow-sm flex-shrink-0"
            style={{ width: '46px', height: '46px', backgroundColor: '#eaf1ff', color: '#0d5afd' }}
          >
            <i className="bi bi-robot fs-4"></i>
          </div>
          <div className="flex-grow-1 text-start overflow-hidden">
            <div className="d-flex align-items-center justify-content-between mb-1">
              <h6 className="mb-0 fw-bold text-dark text-truncate" style={{ fontSize: '0.92rem' }}>
                Asisten Order &amp; Bot
              </h6>
              <span
                className="badge rounded-pill px-2 py-1 fw-semibold"
                style={{ backgroundColor: '#e0ebff', color: '#0d5afd', fontSize: '0.68rem' }}
              >
                📌
              </span>
            </div>
            <p className="mb-0 text-muted text-truncate" style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Ketik perintah buat transaksi / cek order otomatis
            </p>
          </div>
        </div>

        {/* 2. DAFTAR CHAT SESAMA MEMBER & GRUP */}
        {filteredConversations.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <i className="bi bi-chat-square-dots fs-1 text-secondary opacity-50 d-block mb-2"></i>
            <p className="small mb-2">Belum ada percakapan dengan anggota lain.</p>
            <button
              type="button"
              className="btn btn-outline-primary btn-sm rounded-pill px-3"
              onClick={onOpenNewChatModal}
            >
              Mulai Obrolan Pertama
            </button>
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isGroup = conv.type === 'GROUP' || conv.type === 'CROSS_STORE';
            const isCrossStore = conv.type === 'CROSS_STORE';
            const timeLabel = formatTime(conv.lastMessage?.createdAt || conv.updatedAt);
            const snippet = conv.lastMessage?.type === 'IMAGE'
              ? '📷 Foto'
              : (conv.lastMessage?.content || 'Belum ada pesan');

            return (
              <div
                key={conv.id}
                className="d-flex align-items-center gap-3 p-3 border-bottom hover-bg cursor-pointer customer-card-clickable"
                style={{ cursor: 'pointer', transition: 'background-color 0.15s' }}
                onClick={() => onSelectConversation(conv)}
              >
                {/* Avatar */}
                <div
                  className={`rounded-circle d-flex align-items-center justify-content-center text-white fw-bold shadow-sm ${isCrossStore
                    ? 'bg-purple'
                    : isGroup
                      ? 'bg-info'
                      : 'bg-primary'
                    }`}
                  style={{
                    width: '46px',
                    height: '46px',
                    flexShrink: 0,
                    backgroundColor: isCrossStore ? '#6f42c1' : undefined,
                  }}
                >
                  {isCrossStore ? (
                    <i className="bi bi-globe2 fs-5"></i>
                  ) : isGroup ? (
                    <i className="bi bi-people-fill fs-5"></i>
                  ) : (
                    conv.title?.charAt(0).toUpperCase() || 'U'
                  )}
                </div>

                {/* Info Percakapan */}
                <div className="flex-grow-1 text-start overflow-hidden">
                  <div className="d-flex align-items-center justify-content-between mb-1">
                    <div className="d-flex align-items-center gap-1 overflow-hidden">
                      <h6 className="mb-0 fw-semibold text-dark text-truncate" style={{ fontSize: '0.9rem' }}>
                        {conv.title}
                      </h6>
                      {isCrossStore && (
                        <span className="badge bg-purple-subtle text-purple border rounded-pill px-2 py-0" style={{ fontSize: '0.65rem' }}>
                          Lintas Cabang
                        </span>
                      )}
                      {!isCrossStore && isGroup && (
                        <span className="badge bg-info-subtle text-info border rounded-pill px-2 py-0" style={{ fontSize: '0.65rem' }}>
                          Grup
                        </span>
                      )}
                    </div>
                    <small className="text-muted" style={{ fontSize: '0.72rem', flexShrink: 0 }}>
                      {timeLabel}
                    </small>
                  </div>

                  <div className="d-flex align-items-center justify-content-between">
                    <p className="mb-0 text-muted text-truncate" style={{ fontSize: '0.8rem' }}>
                      {conv.lastMessage?.sender?.fullname && isGroup ? (
                        <span className="fw-medium text-secondary">{conv.lastMessage.sender.fullname.split(' ')[0]}: </span>
                      ) : null}
                      {snippet}
                    </p>
                    {conv.unreadCount > 0 && (
                      <span
                        className="badge bg-success rounded-pill px-2 py-1 ms-2"
                        style={{ fontSize: '0.7rem', flexShrink: 0 }}
                      >
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ChatInboxList;

