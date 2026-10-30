import React, { useState, useEffect, useRef } from 'react';
import {
  getMessages,
  sendMessage,
  markConversationAsRead,
  joinConversationRoom,
  leaveConversationRoom,
  emitTyping,
} from '../../services/chatService';
import { compressImage } from '../../utils/imageCompressor';
import { isOfflineExceeded3Days } from '../../utils/offlineGuard';

export const ChatRoom = ({ conversation, currentUser, onBack, onUpdateSubtitle }) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [selectedImage, setSelectedImage] = useState(null); // { blob, previewUrl, width, height, size }
  const [isSending, setIsSending] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const [selectedZoomImage, setSelectedZoomImage] = useState(null);
  const [showOffline3DaysModal, setShowOffline3DaysModal] = useState(false);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
  const SERVER_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

  const isGroup = conversation?.type === 'GROUP' || conversation?.type === 'CROSS_STORE';

  useEffect(() => {
    if (onUpdateSubtitle) {
      if (typingUser) {
        onUpdateSubtitle(`${typingUser} sedang mengetik...`);
      } else {
        const isGrp = conversation?.type === 'GROUP' || conversation?.type === 'CROSS_STORE';
        onUpdateSubtitle(isGrp ? `${conversation?.members?.length || 0} anggota` : 'Obrolan Langsung');
      }
    }
  }, [typingUser, conversation, onUpdateSubtitle]);

  // Muat pesan saat pertama kali masuk ke percakapan
  const loadMessages = async () => {
    try {
      const list = await getMessages(conversation.id);
      setMessages(list);
    } catch (err) {
      console.warn('Gagal memuat pesan:', err);
    }
  };

  useEffect(() => {
    if (!conversation?.id) return;

    loadMessages();
    markConversationAsRead(conversation.id);
    joinConversationRoom(conversation.id);

    // Listener saat ada sinkronisasi pesan offline
    const handleSynced = () => loadMessages();
    window.addEventListener('chatMessagesSynced', handleSynced);

    return () => {
      leaveConversationRoom(conversation.id);
      window.removeEventListener('chatMessagesSynced', handleSynced);
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
  const handleCameraClick = () => {
    if (isOfflineExceeded3Days()) {
      setShowOffline3DaysModal(true);
      return;
    }
    cameraInputRef.current?.click();
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

  // Submit pengiriman pesan
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if ((!inputValue.trim() && !selectedImage) || isSending) return;

    setIsSending(true);
    const content = inputValue;
    const imgData = selectedImage;

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
        currentUser,
      });

      // Tambahkan ke state lokal agar pesan langsung muncul di antarmuka
      setMessages((prev) => [...prev, createdMsg]);
    } catch (err) {
      console.error('Gagal mengirim pesan:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
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
      return URL.createObjectURL(msg.imageBlob);
    }
    if (msg.imageUrl) {
      if (msg.imageUrl.startsWith('http://') || msg.imageUrl.startsWith('https://')) {
        return msg.imageUrl;
      }
      return `${SERVER_ORIGIN}${msg.imageUrl}`;
    }
    return '';
  };

  return (
    <div className="d-flex flex-column h-100 bg-white" style={{ position: 'relative' }}>
      {/* DAFTAR PESAN (MESSAGE BUBBLES) */}
      <div className="chat-content-wrap px-3 pt-3 flex-grow-1" style={{ overflowY: 'auto' }}>
        {messages.length === 0 ? (
          <div className="text-center py-5 text-muted small">
            <i className="bi bi-chat-square-text fs-2 d-block mb-2 text-secondary opacity-50"></i>
            Kirim sapaan atau foto untuk memulai percakapan.
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = (msg.senderId === currentUser.id) || (msg.senderId === currentUser.userId);
            const imageUrl = getRenderImageUrl(msg);

            return (
              <div
                key={msg.uuid || msg.id || index}
                className={`d-flex mb-3 ${isMe ? 'justify-content-end' : 'justify-content-start'}`}
              >
                <div
                  className={`p-2 shadow-sm ${isMe ? 'text-white' : 'text-dark'}`}
                  style={{
                    maxWidth: '82%',
                    minWidth: '100px',
                    backgroundColor: isMe ? '#155dfc' : '#f8f9fa',
                    border: '1px solid #eef0f2',
                    borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  }}
                >
                  {/* Nama Pengirim (Hanya tampil di Grup jika bukan pesan kita sendiri) */}
                  {!isMe && isGroup && msg.sender?.fullname && (
                    <div className="fw-bold mb-1" style={{ fontSize: '0.75rem', color: '#0d6efd' }}>
                      {msg.sender.fullname}
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
                        color: isMe ? '#ffffff' : '#212529',
                      }}
                    >
                      {msg.content}
                    </p>
                  )}

                  {/* Jam & Status Centang Pengiriman */}
                  <div
                    className={`d-flex align-items-center justify-content-end gap-1 px-1 ${
                      isMe ? 'text-white-50' : 'text-muted'
                    }`}
                    style={{ fontSize: '0.68rem' }}
                  >
                    <span>{formatTime(msg.createdAt)}</span>

                    {/* Centang Status Pengiriman (Hanya untuk pesan kita) */}
                    {isMe && (
                      <span className="ms-1 fw-bold" title={msg.status === 'PENDING' ? 'Menunggu koneksi (Pending)' : 'Terkirim'}>
                        {msg.status === 'PENDING' ? (
                          <span style={{ color: '#d1e7dd', letterSpacing: '-2px' }}>✓</span>
                        ) : (
                          <span style={{ color: '#ffffff', letterSpacing: '-2px' }}>✓✓</span>
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
        <div className="px-3 pt-2 pb-1 bg-light border-top d-flex align-items-center justify-content-between">
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
            className="btn btn-sm btn-outline-danger rounded-circle p-1"
            style={{ width: '28px', height: '28px' }}
            onClick={() => setSelectedImage(null)}
            title="Hapus Foto"
          >
            <i className="bi bi-x"></i>
          </button>
        </div>
      )}

      {/* 4. FOOTER INPUT CHAT */}
      <div className="border-top p-2 px-3 bg-white">
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
            onClick={() => galleryInputRef.current?.click()}
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
            className="btn btn-primary rounded-circle text-white p-0 d-flex align-items-center justify-content-center shadow-sm"
            style={{ width: '40px', height: '40px', flexShrink: 0 }}
            disabled={isSending || (!inputValue.trim() && !selectedImage)}
            title="Kirim Pesan"
          >
            <i className="bi bi-send-fill fs-6"></i>
          </button>
        </form>
      </div>

      {/* 5. MODAL ZOOM FOTO BESAR */}
      {selectedZoomImage && (
        <>
          <div
            className="modal-backdrop fade show"
            style={{ backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1070 }}
            onClick={() => setSelectedZoomImage(null)}
          />
          <div
            className="modal fade show d-block"
            tabIndex="-1"
            style={{ zIndex: 1075 }}
            onClick={() => setSelectedZoomImage(null)}
          >
            <div className="modal-dialog modal-dialog-centered mx-auto text-center p-3" style={{ maxWidth: '90vw' }}>
              <div className="position-relative d-inline-block">
                <button
                  type="button"
                  className="btn btn-light btn-sm rounded-circle position-absolute top-0 end-0 m-2 shadow"
                  style={{ zIndex: 10 }}
                  onClick={() => setSelectedZoomImage(null)}
                >
                  <i className="bi bi-x-lg"></i>
                </button>
                <img
                  src={selectedZoomImage}
                  alt="Zoom Foto"
                  className="img-fluid rounded-3 shadow-lg"
                  style={{ maxHeight: '85vh', objectFit: 'contain' }}
                />
              </div>
            </div>
          </div>
        </>
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
    </div>
  );
};

export default ChatRoom;

