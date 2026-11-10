import React, { useState, useEffect, useRef } from 'react';
import {
  getMessages,
  sendMessage,
  markConversationAsRead,
  joinConversationRoom,
  leaveConversationRoom,
  emitTyping,
  getAuthToken,
} from '../../services/chatService';
import { compressImage } from '../../utils/imageCompressor';
import { isOfflineExceeded3Days } from '../../utils/offlineGuard';
import { getSubscriptionReport, isTrialExpired } from '../../services/subscriptionService';
import PlanGateModal from '../PlanGateModal';
import { ChatMessagesSkeleton } from '../common/Skeleton';

export const ChatRoom = ({ conversation, currentUser, onBack, onUpdateSubtitle }) => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [selectedImage, setSelectedImage] = useState(null); // { blob, previewUrl, width, height, size }
  const [isSending, setIsSending] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const [selectedZoomImage, setSelectedZoomImage] = useState(null);
  const [showOffline3DaysModal, setShowOffline3DaysModal] = useState(false);
  const [gateModal, setGateModal] = useState({ open: false, type: 'PHOTO_LIMIT', data: {} });
  const isSendingRef = useRef(false);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
  const SERVER_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

  const isGroup = conversation?.type === 'GROUP' || conversation?.type === 'CROSS_STORE';
  // Pastikan data pengguna aktif teresolusi secara akurat (dari props atau fallback storage)
  const resolvedCurrentUser = currentUser || (() => {
    try {
      return JSON.parse(sessionStorage.getItem('user') || localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  })();

  // Fungsi pengecekan akurat apakah pesan ini dikirim oleh pengguna saat ini (Sender)
  const checkIsMe = (msg) => {
    if (!msg) return false;

    // Kumpulan seluruh kemungkinan ID user aktif
    const myIds = [
      resolvedCurrentUser?.uuid,
      resolvedCurrentUser?.id,
      resolvedCurrentUser?.userId,
      resolvedCurrentUser?.sub,
      resolvedCurrentUser?._id,
    ].filter(Boolean).map(String);

    // Kumpulan seluruh ID sender pada objek pesan
    const senderIds = [
      msg.senderId,
      msg.sender?.id,
      msg.sender?.uuid,
      msg.sender?.userId,
    ].filter(Boolean).map(String);

    // 1. Cocokkan ID jika ada yang sama
    if (myIds.some((myId) => senderIds.includes(myId))) {
      return true;
    }

    // 2. Cocokkan Username jika ID tidak cocok (misal Dexie integer vs Server UUID)
    const myUsername = (resolvedCurrentUser?.username || '').toLowerCase().trim();
    const msgUsername = (msg.sender?.username || msg.username || '').toLowerCase().trim();
    if (myUsername && msgUsername && myUsername === msgUsername) {
      return true;
    }

    // 3. Cocokkan Nama Lengkap sebagai cadangan
    const myFullname = (resolvedCurrentUser?.fullname || '').toLowerCase().trim();
    const msgFullname = (msg.sender?.fullname || msg.senderName || '').toLowerCase().trim();
    if (myFullname && msgFullname && myFullname === msgFullname) {
      return true;
    }

    return false;
  };

  useEffect(() => {
    if (!onUpdateSubtitle) return;
    if (typingUser) {
      onUpdateSubtitle(`${typingUser} sedang mengetik...`);
    } else {
      const isGrp = conversation?.type === 'GROUP' || conversation?.type === 'CROSS_STORE';
    }
  }, [typingUser]);

  // Muat pesan saat pertama kali masuk ke percakapan
  const loadMessages = async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const list = await getMessages(conversation.id);
      setMessages(list);
    } catch (err) {
      console.warn('Gagal memuat pesan:', err);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!conversation?.id) return;

    loadMessages(true);
    markConversationAsRead(conversation.id);
    joinConversationRoom(conversation.id);

    // Listener saat ada sinkronisasi, pesan masuk, terkirim, atau dibaca
    const handleNewMessage = (e) => {
      const incomingMsg = e.detail;
      // Jika pesan masuk untuk percakapan yang sedang dibuka dan bukan dari diri sendiri,
      // langsung tandai sebagai READ secara realtime tanpa perlu keluar ke list chat!
      if (incomingMsg?.conversationId === conversation.id && !checkIsMe(incomingMsg)) {
        markConversationAsRead(conversation.id);
      }
      loadMessages();
    };

    const handleRefresh = () => loadMessages();
    window.addEventListener('chatMessagesSynced', handleRefresh);
    window.addEventListener('chatNewMessage', handleNewMessage);
    window.addEventListener('chatMessageDelivered', handleRefresh);
    window.addEventListener('chatMessagesRead', handleRefresh);

    return () => {
      leaveConversationRoom(conversation.id);
      window.removeEventListener('chatMessagesSynced', handleRefresh);
      window.removeEventListener('chatNewMessage', handleNewMessage);
      window.removeEventListener('chatMessageDelivered', handleRefresh);
      window.removeEventListener('chatMessagesRead', handleRefresh);
    };
  }, [conversation?.id]);

  // Scroll otomatis ke pesan terbawah
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUser]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = Math.min(scrollHeight, 100) + 'px';
      textareaRef.current.style.overflowY = scrollHeight > 100 ? 'auto' : 'hidden';
    }
  }, [inputValue]);

  // Handle pemilihan file foto (Kamera atau Galeri)
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const sub = await getSubscriptionReport().catch(() => null);
      if (isTrialExpired(sub)) {
        setGateModal({
          open: true,
          type: 'TRIAL_EXPIRED',
          data: { plan: 'TRIAL', isTrial: true },
        });
        e.target.value = '';
        return;
      }
      if (sub && sub.isEnforced && sub.usage?.photos?.isExceeded) {
        setGateModal({
          open: true,
          type: 'PHOTO_LIMIT',
          data: { plan: sub.plan, limit: sub.limits?.maxChatPhotos },
        });
        e.target.value = '';
        return;
      }

      // Kompres gambar otomatis di sisi klien
      const compressed = await compressImage(file, { maxWidth: 1280, maxHeight: 1280, quality: 0.82 });
      const previewUrl = URL.createObjectURL(compressed.blob);

      setSelectedImage({
        blob: compressed.blob,
        previewUrl,
        width: compressed.width,
        height: compressed.height,
        size: compressed.size,
      });
    } catch (err) {
      console.error('Gagal memproses gambar:', err);
    } finally {
      e.target.value = '';
    }
  };

  // Cek penjagaan offline 3 hari sebelum membuka kamera
  const handleCameraClick = async () => {
    const sub = await getSubscriptionReport().catch(() => null);
    if (isTrialExpired(sub)) {
      setGateModal({
        open: true,
        type: 'TRIAL_EXPIRED',
        data: { plan: 'TRIAL', isTrial: true },
      });
      return;
    }
    if (isOfflineExceeded3Days()) {
      setShowOffline3DaysModal(true);
      return;
    }
    cameraInputRef.current?.click();
  };

  const handleGalleryClick = async () => {
    const sub = await getSubscriptionReport().catch(() => null);
    if (isTrialExpired(sub)) {
      setGateModal({
        open: true,
        type: 'TRIAL_EXPIRED',
        data: { plan: 'TRIAL', isTrial: true },
      });
      return;
    }
    galleryInputRef.current?.click();
  };

  const handleConfirmCameraOffline = () => {
    setShowOffline3DaysModal(false);
    cameraInputRef.current?.click();
  };

  // Handle perubahan input teks dan emit status mengetik
  const handleInputChange = (e) => {
    setInputValue(e.target.value);

    emitTyping(conversation.id, true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      emitTyping(conversation.id, false);
    }, 2000);
  };

  // Submit pengiriman pesan dengan Optimistic UI (bubble muncul instan)
  const handleSendMessage = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if ((!inputValue.trim() && !selectedImage) || isSending || isSendingRef.current) return;

    const sub = await getSubscriptionReport().catch(() => null);
    if (isTrialExpired(sub)) {
      setGateModal({
        open: true,
        type: 'TRIAL_EXPIRED',
        data: { plan: 'TRIAL', isTrial: true },
      });
      return;
    }

    isSendingRef.current = true;
    setIsSending(true);

    const content = inputValue;
    const imgData = selectedImage;
    const tempId = 'temp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);

    // Siapkan pesan optimistik
    const optimisticMsg = {
      id: tempId,
      uuid: tempId,
      conversationId: conversation.id,
      content,
      type: imgData ? 'IMAGE' : 'TEXT',
      imageBlob: imgData ? imgData.blob : null,
      imageUrl: imgData ? imgData.previewUrl : null,
      senderId: resolvedCurrentUser?.uuid || resolvedCurrentUser?.id,
      sender: resolvedCurrentUser,
      status: 'SENDING',
      createdAt: new Date().toISOString(),
      isOptimistic: true,
    };

    // Munculkan bubble secara instan ke state antarmuka pengguna
    setMessages((prev) => [...prev, optimisticMsg]);
    setInputValue('');
    setSelectedImage(null);
    emitTyping(conversation.id, false);

    try {
      const createdMsg = await sendMessage({
        conversationId: conversation.id,
        content,
        type: imgData ? 'IMAGE' : 'TEXT',
        imageBlob: imgData ? imgData.blob : null,
        imageWidth: imgData ? imgData.width : null,
        imageHeight: imgData ? imgData.height : null,
        currentUser: resolvedCurrentUser,
      });

      // Gantikan bubble optimistik dengan data pesan valid dari server
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId || m.uuid === tempId ? createdMsg : m))
      );
    } catch (err) {
      console.error('Gagal mengirim pesan:', err);
      // Tandai bubble sebagai gagal jika proses websocket/jaringan error
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId || m.uuid === tempId ? { ...m, status: 'FAILED' } : m
        )
      );
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      handleSendMessage(e);
    }
  };

  // Format jam (HH:mm)
  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  // Resolve URL gambar untuk rendering
  const getRenderImageUrl = (msg) => {
    if (msg.imageBlob) {
      try {
        return URL.createObjectURL(msg.imageBlob);
      } catch (err) {
        console.warn('Gagal membuat objectURL blob:', err);
      }
    }
    if (msg.imageUrl) {
      let url = msg.imageUrl;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `${SERVER_ORIGIN}${url}`;
      }
      const token = getAuthToken();
      if (token && !url.includes('token=')) {
        url += (url.includes('?') ? '&' : '?') + `token=${encodeURIComponent(token)}`;
      }
      return url;
    }
    return '';
  };

  // Pengecekan akses anggota jika pengguna adalah kasir
  const myIds = [
    resolvedCurrentUser?.uuid,
    resolvedCurrentUser?.id,
    resolvedCurrentUser?.userId,
  ].filter(Boolean).map(String);
  const myUsername = (resolvedCurrentUser?.username || '').toLowerCase().trim();

  const isMemberOfConversation =
    !conversation?.members ||
    !Array.isArray(conversation.members) ||
    conversation.members.some((m) => {
      const memberUserId = String(m.userId || m.user?.id || m.user?.uuid || '');
      const memberUsername = (m.user?.username || '').toLowerCase().trim();
      return (memberUserId && myIds.includes(memberUserId)) || (myUsername && memberUsername === myUsername);
    });

  if (resolvedCurrentUser?.role === 'kasir' && !isMemberOfConversation) {
    return (
      <div className="d-flex flex-column align-items-center justify-content-center h-100 p-4 text-center bg-white">
        <i className="bi bi-shield-lock-fill text-danger fs-1 mb-3"></i>
        <h5 className="fw-bold text-dark">Akses Obrolan Ditolak</h5>
        <p className="text-muted small mb-4" style={{ maxWidth: '320px' }}>
          Anda tidak memiliki izin untuk membuka percakapan ini karena Anda bukan anggota dalam obrolan ini.
        </p>
        <button className="btn btn-outline-primary rounded-pill px-4" onClick={onBack}>
          Kembali ke Kotak Masuk
        </button>
      </div>
    );
  }

  return (
    <div className="d-flex flex-column h-100 bg-white" style={{ position: 'relative' }}>
      {/* DAFTAR PESAN (MESSAGE BUBBLES) */}
      <div className="chat-content-wrap px-3 pt-3 flex-grow-1" style={{ overflowY: 'auto', backgroundColor: '#f4f6f8' }}>
        {isLoading ? (
          <ChatMessagesSkeleton count={4} />
        ) : messages.length === 0 ? (
          <div className="text-center py-5 text-muted small">
            <i className="bi bi-chat-square-text fs-2 d-block mb-2 text-secondary opacity-50"></i>
            Kirim sapaan atau foto untuk memulai percakapan.
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = checkIsMe(msg);
            const imageUrl = getRenderImageUrl(msg);
            const isOwnerSender = msg.sender?.role?.toLowerCase() === 'owner';

            return (
              <div
                key={msg.uuid || msg.id || index}
                className={`d-flex mb-2 ${isMe ? 'justify-content-end' : 'justify-content-start'}`}
              >
                <div
                  className="p-2 shadow-sm"
                  style={{
                    maxWidth: '78%',
                    minWidth: '105px',
                    backgroundColor: isMe ? '#155dfc' : '#ffffff',
                    color: isMe ? '#ffffff' : '#1e293b',
                    border: isMe ? 'none' : '1px solid #e2e8f0',
                    borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    boxShadow: isMe
                      ? '0 2px 6px rgba(21, 93, 252, 0.22)'
                      : '0 1px 3px rgba(0, 0, 0, 0.05)',
                  }}
                >
                  {/* Nama Pengirim & Verified Badge Owner */}
                  {!isMe && (isGroup || isOwnerSender) && (
                    <div className="fw-bold mb-1 px-1 d-flex align-items-center gap-1" style={{ fontSize: '0.75rem', color: '#155dfc' }}>
                      {msg.sender?.fullname && <span>{msg.sender.fullname}</span>}
                      {isOwnerSender && (
                        <i
                          className="bi bi-patch-check-fill text-primary"
                          style={{ fontSize: '11px' }}
                          title="Owner Terverifikasi"
                        ></i>
                      )}
                    </div>
                  )}

                  {/* Tampilan Lampiran Foto */}
                  {imageUrl && (
                    <div className="mb-1 text-center" style={{ overflow: 'hidden', borderRadius: '12px' }}>
                      <img
                        src={imageUrl}
                        alt="Foto Chat"
                        className="img-fluid"
                        style={{
                          maxWidth: '240px',
                          maxHeight: '280px',
                          objectFit: 'cover',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          backgroundColor: '#00000010',
                        }}
                        onClick={() => setSelectedZoomImage(imageUrl)}
                      />
                    </div>
                  )}

                  {/* Konten Teks Pesan */}
                  {msg.content && (
                    <p
                      className="mb-1 px-1"
                      style={{
                        whiteSpace: 'pre-wrap',
                        lineHeight: '1.4',
                        fontSize: '13px',
                        color: isMe ? '#ffffff' : '#1e293b',
                        margin: 0,
                      }}
                    >
                      {msg.content}
                    </p>
                  )}

                  {/* Jam & Status Centang Pengiriman */}
                  <div
                    className={`d-flex align-items-center justify-content-end gap-1 px-1 mt-1 ${
                      isMe ? 'text-white-50' : 'text-muted'
                    }`}
                    style={{ fontSize: '0.68rem', lineHeight: 1 }}
                  >
                    <span>{formatTime(msg.createdAt)}</span>

                    {/* Status Centang (Hanya untuk pesan pengirim / isMe) */}
                    {isMe && (
                      <span className="d-inline-flex align-items-center ms-1">
                        {msg.status === 'SENDING' ? (
                          <span
                            className="spinner-border spinner-border-sm"
                            style={{ width: '9px', height: '9px', borderWidth: '1.5px', color: 'rgba(255, 255, 255, 0.85)' }}
                            title="Mengirim pesan..."
                          />
                        ) : msg.status === 'FAILED' ? (
                          <i
                            className="bi bi-exclamation-circle-fill text-warning"
                            style={{ fontSize: '11px' }}
                            title="Gagal terkirim"
                          />
                        ) : msg.status === 'PENDING' ? (
                          <i
                            className="bi bi-clock"
                            style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.7)' }}
                            title="Menunggu jaringan (Pending)"
                          />
                        ) : msg.status === 'READ' ? (
                          <i
                            className="bi bi-check-all"
                            style={{ fontSize: '16px', color: '#67e8f9', lineHeight: 1 }}
                            title="Dibaca (Ceklis 2 Biru)"
                          />
                        ) : msg.status === 'DELIVERED' ? (
                          <i
                            className="bi bi-check-all"
                            style={{ fontSize: '16px', color: 'rgba(255, 255, 255, 0.85)', lineHeight: 1 }}
                            title="Tersampaikan (Ceklis 2)"
                          />
                        ) : (
                          <i
                            className="bi bi-check"
                            style={{ fontSize: '16px', color: 'rgba(255, 255, 255, 0.85)', lineHeight: 1 }}
                            title="Terkirim (Ceklis 1)"
                          />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 3. PRATINJAU FOTO TERPILIH (SEBELUM DIKIRIM) */}
      {selectedImage && (
        <div
          className="px-3 pt-2 pb-2 bg-light border-top d-flex align-items-center justify-content-between position-relative"
          style={{ zIndex: 50 }}
        >
          <div className="d-flex align-items-center gap-2">
            <img
              src={selectedImage.previewUrl}
              alt="Pratinjau"
              style={{
                width: '54px',
                height: '54px',
                objectFit: 'cover',
                borderRadius: '8px',
                border: '2px solid #0d6efd',
              }}
            />
            <div>
              <span className="fw-semibold small d-block text-dark">Foto siap dikirim</span>
              <small className="text-muted" style={{ fontSize: '0.72rem' }}>
                {(selectedImage.size / 1024).toFixed(0)} KB • Terkompres rapi
              </small>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-light text-danger border shadow-xs rounded-circle d-flex align-items-center justify-content-center p-0 flex-shrink-0"
            style={{ width: '32px', height: '32px', backgroundColor: '#fff' }}
            onClick={() => {
              if (selectedImage?.previewUrl) {
                try { URL.revokeObjectURL(selectedImage.previewUrl); } catch (_) {}
              }
              setSelectedImage(null);
            }}
            title="Batal kirim foto"
          >
            <i className="bi bi-x-lg" style={{ fontSize: '13px' }}></i>
          </button>
        </div>
      )}

      {/* 4. FOOTER INPUT CHAT */}
      <div className="border-top p-2 px-3 bg-white position-relative" style={{ zIndex: 50 }}>
        <form onSubmit={handleSendMessage} className="d-flex align-items-center gap-2 position-relative">
          {/* Hidden Inputs untuk Kamera dan File */}
          <input
            type="file"
            ref={cameraInputRef}
            accept="image/*"
            capture="environment"
            className="d-none"
            onChange={handleFileChange}
          />
          <input
            type="file"
            ref={galleryInputRef}
            accept="image/*"
            className="d-none"
            onChange={handleFileChange}
          />

          {/* Tombol Kamera */}
          <button
            type="button"
            className="btn btn-light rounded-circle text-primary p-0 d-flex align-items-center justify-content-center shadow-sm"
            style={{ width: '40px', height: '40px', flexShrink: 0 }}
            onClick={handleCameraClick}
            title="Ambil Foto dari Kamera"
          >
            <i className="bi bi-camera-fill fs-5"></i>
          </button>

          {/* Tombol Berkas / Galeri */}
          <button
            type="button"
            className="btn btn-light rounded-circle text-secondary p-0 d-flex align-items-center justify-content-center shadow-sm"
            style={{ width: '40px', height: '40px', flexShrink: 0 }}
            onClick={handleGalleryClick}
            title="Pilih Foto dari Galeri"
          >
            <i className="bi bi-image-fill fs-5"></i>
          </button>

          {/* Input Teks Pesan */}
          <textarea
            ref={textareaRef}
            className="form-control border-0 shadow-sm flex-grow-1"
            placeholder="Ketik pesan..."
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={isSending}
            style={{
              fontSize: '13px',
              borderRadius: '20px',
              padding: '10px 16px',
              backgroundColor: '#f0f4f9',
              resize: 'none',
              minHeight: '40px',
              maxHeight: '100px',
              lineHeight: '1.4',
            }}
            rows={1}
          />

          {/* Tombol Kirim */}
          <button
            type="submit"
            className="btn btn-primary rounded-circle text-white p-0 d-flex align-items-center justify-content-center shadow-sm transition-all"
            style={{
              width: '40px',
              height: '40px',
              flexShrink: 0,
              backgroundColor: (!inputValue.trim() && !selectedImage) ? '#94a3b8' : '#0d5afd',
              borderColor: (!inputValue.trim() && !selectedImage) ? '#94a3b8' : '#0d5afd',
              opacity: isSending ? 0.7 : 1,
            }}
            disabled={isSending || (!inputValue.trim() && !selectedImage)}
            title="Kirim Pesan"
          >
            {isSending ? (
              <span className="spinner-border spinner-border-sm" role="status" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></span>
            ) : (
              <i className="bi bi-send-fill" style={{ fontSize: '15px', transform: 'translateX(1px)' }}></i>
            )}
          </button>
        </form>
      </div>

      {/* 5. PRATINJAU / ZOOM FOTO DI DALAM CHAT (HEADER & BOTTOM CHAT TETAP TAMPIL) */}
      {selectedZoomImage && (
        <div
          className="position-absolute start-0 end-0 d-flex flex-column align-items-center justify-content-center p-3"
          style={{
            top: 0,
            bottom: selectedImage ? '135px' : '65px',
            backgroundColor: 'rgba(15, 23, 42, 0.92)',
            zIndex: 40,
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setSelectedZoomImage(null)}
        >
          <div
            className="position-relative text-center d-flex flex-column align-items-center justify-content-center"
            style={{ maxWidth: '96%', maxHeight: '100%' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Tombol Tutup Preview */}
            <button
              type="button"
              className="btn btn-light btn-sm rounded-circle shadow position-absolute top-0 end-0 m-2 d-flex align-items-center justify-content-center"
              style={{ width: '34px', height: '34px', zIndex: 10, backgroundColor: 'rgba(255,255,255,0.95)' }}
              onClick={() => setSelectedZoomImage(null)}
              title="Tutup Preview Foto"
            >
              <i className="bi bi-x-lg text-dark fw-bold" style={{ fontSize: '13px' }}></i>
            </button>
            <img
              src={selectedZoomImage}
              alt="Zoom Foto"
              className="img-fluid rounded-4 shadow-lg"
              style={{
                maxHeight: 'calc(100vh - 220px)',
                maxWidth: '100%',
                objectFit: 'contain',
              }}
            />
          </div>
        </div>
      )}

      {/* 6. MODAL KONFIRMASI OFFLINE > 3 HARI SAAT BUKA KAMERA */}
      {showOffline3DaysModal && (
        <>
          <div
            className="modal-backdrop fade show"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1070 }}
            onClick={() => setShowOffline3DaysModal(false)}
          />
          <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1075 }}>
            <div className="modal-dialog modal-dialog-centered mx-auto" style={{ maxWidth: '400px' }}>
              <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '20px' }}>
                <div className="modal-body p-4 text-center">
                  <div
                    className="mx-auto rounded-circle d-flex align-items-center justify-content-center mb-3"
                    style={{ width: '60px', height: '60px', backgroundColor: '#fffbeb', color: '#d97706' }}
                  >
                    <i className="bi bi-exclamation-triangle-fill fs-2"></i>
                  </div>
                  <h6 className="fw-bold mb-2 text-dark">Penyimpanan Offline Mencapai Batas</h6>
                  <p className="text-muted small mb-4">
                    ⚠️ Sudah 3 hari offline! Foto kamera baru akan disimpan di memori perangkat. Disarankan hubungkan kasir ke internet yuk, biar foto langsung sinkron aman.
                  </p>
                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className="btn btn-outline-secondary w-50 rounded-pill py-2 small fw-semibold"
                      onClick={() => setShowOffline3DaysModal(false)}
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      className="btn btn-warning w-50 rounded-pill py-2 small fw-semibold text-dark"
                      onClick={handleConfirmCameraOffline}
                    >
                      Tetap Ambil
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Plan Gate Modal untuk limitasi foto chat */}
      <PlanGateModal
        isOpen={gateModal.open}
        onClose={() => setGateModal({ ...gateModal, open: false })}
        type={gateModal.type}
        customData={gateModal.data}
        user={currentUser}
      />
    </div>
  );
};

export default ChatRoom;

