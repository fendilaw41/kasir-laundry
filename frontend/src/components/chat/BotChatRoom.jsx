import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { getChatLogQuery } from '../../db/repositories/chatLog';
import { parseChatCommand } from '../../utils/chatbot';

export const BotChatRoom = ({ user, onBack }) => {
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showQuickCommands, setShowQuickCommands] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ show: false, message: '', onConfirm: null });

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const messages = useLiveQuery(() => getChatLogQuery(), []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const handleInsert = (e) => setInputValue(e.detail);
    const handleQuickCommands = () => setShowQuickCommands(true);
    const handleReset = () => {
      setConfirmModal({
        show: true,
        message: 'Mulai percakapan baru? Riwayat chat di layar ini akan dihapus.',
        onConfirm: async () => {
          try {
            await db.chatLog.clear();
            setConfirmModal({ show: false, message: '', onConfirm: null });
          } catch (error) {
            console.error('Failed to clear chat log:', error);
          }
        },
      });
    };

    window.addEventListener('insertChatTemplate', handleInsert);
    window.addEventListener('openQuickCommandsModal', handleQuickCommands);
    window.addEventListener('openResetBotChatModal', handleReset);

    return () => {
      window.removeEventListener('insertChatTemplate', handleInsert);
      window.removeEventListener('openQuickCommandsModal', handleQuickCommands);
      window.removeEventListener('openResetBotChatModal', handleReset);
    };
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = Math.min(scrollHeight, 120) + 'px';
      textareaRef.current.style.overflowY = scrollHeight > 120 ? 'auto' : 'hidden';
    }
  }, [inputValue]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isProcessing) return;

    const messageText = inputValue;
    setInputValue('');
    setIsProcessing(true);

    try {
      await parseChatCommand(messageText, user);
    } catch (error) {
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSelectTemplate = (templateText) => {
    setInputValue(templateText);
    setShowQuickCommands(false);
  };

  return (
    <div className="d-flex flex-column h-100 bg-white" style={{ position: 'relative' }}>
      {/* Konten Chat Bot */}
      <div className="chat-content-wrap px-3 pt-3 flex-grow-1" style={{ overflowY: 'auto' }}>
        {messages && messages.length === 0 && (
          <div className="my-4 text-center">
            <div
              className="mx-auto rounded-circle d-flex align-items-center justify-content-center mb-3 shadow-sm"
              style={{ width: '64px', height: '64px', backgroundColor: '#eaf1ff', color: '#0d5afd' }}
            >
              <i className="bi bi-robot fs-2"></i>
            </div>
            <h5 className="fw-bold mb-1 text-dark">
              Halo, {user?.fullname ? user.fullname.split(' ')[0] : (user?.username || 'Kasir')}!
            </h5>
            <p className="text-muted small px-3 mb-0" style={{ maxWidth: '380px', margin: '0 auto' }}>
              Ketik perintah di bawah atau gunakan tombol ⚡ <strong>Mode Cepat</strong> di pojok kanan atas.
            </p>
          </div>
        )}

        {messages &&
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`d-flex mb-3 ${!msg.isBot ? 'justify-content-end' : 'justify-content-start'}`}
            >
              <div
                className={`p-3 shadow-sm ${!msg.isBot ? 'text-white' : 'text-dark'}`}
                style={{
                  maxWidth: !msg.isBot ? '85%' : '95%',
                  width: 'fit-content',
                  backgroundColor: !msg.isBot ? '#155dfc' : '#f8f9fa',
                  border: '1px solid #eef0f2',
                  borderRadius: !msg.isBot ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                }}
              >
                <p
                  className="mb-0"
                  style={{
                    whiteSpace: 'pre-wrap',
                    lineHeight: '1.5',
                    fontSize: '13px',
                    color: !msg.isBot ? '#ffffff' : '#333333',
                  }}
                >
                  {msg.pesan}
                </p>
              </div>
            </div>
          ))}

        {isProcessing && (
          <div className="d-flex mb-3 justify-content-start">
            <div
              className="p-3 shadow-sm bg-light"
              style={{ maxWidth: '85%', border: '1px solid #eef0f2', borderRadius: '16px 16px 16px 4px' }}
            >
              <div className="typing d-flex gap-1 py-1">
                <span className="spinner-grow spinner-grow-sm text-primary" role="status" style={{ width: '0.4rem', height: '0.4rem' }}></span>
                <span className="spinner-grow spinner-grow-sm text-primary" role="status" style={{ width: '0.4rem', height: '0.4rem', animationDelay: '0.2s' }}></span>
                <span className="spinner-grow spinner-grow-sm text-primary" role="status" style={{ width: '0.4rem', height: '0.4rem', animationDelay: '0.4s' }}></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 3. Footer Input Bot */}
      <div className="border-top p-3 bg-white">
        <form onSubmit={handleSubmit} className="d-flex position-relative align-items-end">
          <textarea
            ref={textareaRef}
            className="form-control border-0 shadow-sm w-100"
            placeholder="Ketik perintah order di sini..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isProcessing}
            style={{
              fontSize: '13px',
              borderRadius: '24px',
              padding: '12px 50px 12px 20px',
              backgroundColor: '#f0f4f9',
              resize: 'none',
              minHeight: '48px',
              lineHeight: '1.4',
            }}
            rows={1}
          />
          <button
            type="submit"
            className="btn btn-link position-absolute end-0 text-primary p-0 me-3"
            style={{ textDecoration: 'none', bottom: '8px' }}
            disabled={isProcessing || !inputValue.trim()}
          >
            <i className="bi bi-send-fill fs-5"></i>
          </button>
        </form>
      </div>

      {/* 4. Modal Perintah Cepat (Mode Cepat) */}
      {showQuickCommands && (
        <>
          <div
            className="modal-backdrop fade show"
            style={{ backdropFilter: 'blur(5px)', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}
            onClick={() => setShowQuickCommands(false)}
          ></div>
          <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1065 }}>
            <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable mx-auto" style={{ maxWidth: '500px' }}>
              <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '24px' }}>
                <div className="modal-header border-0 pb-0 pt-4 px-4">
                  <div>
                    <h5 className="fw-bold mb-0 text-primary">
                      <i className="bi bi-lightning-charge-fill me-2"></i>Perintah Cepat
                    </h5>
                  </div>
                  <button type="button" className="btn-close" onClick={() => setShowQuickCommands(false)}></button>
                </div>
                <div className="modal-body p-4">
                  <div className="row g-3">
                    <div className="col-12">
                      <div
                        className="card shadow-sm border-0 h-100 text-start p-3 customer-card-clickable"
                        style={{ cursor: 'pointer', borderRadius: '16px', background: '#f0f4f9' }}
                        onClick={() => handleSelectTemplate('trx CLR 5kg agus lunas besok DL')}
                      >
                        <h6 className="mb-1 text-primary" style={{ fontSize: '0.95rem' }}>
                          <i className="bi bi-cart-plus me-2"></i>Transaksi Lengkap
                        </h6>
                        <code className="bg-white p-2 rounded-3 d-block shadow-sm" style={{ fontSize: '0.8rem', color: '#555' }}>
                          trx CLR 5kg agus lunas besok DL
                        </code>
                      </div>
                    </div>
                    <div className="col-12">
                      <div
                        className="card shadow-sm border-0 h-100 text-start p-3 customer-card-clickable"
                        style={{ cursor: 'pointer', borderRadius: '16px', background: '#f0f4f9' }}
                        onClick={() => handleSelectTemplate('trx CLR 5kg agus-0812345678 dp 2hari AJ')}
                      >
                        <h6 className="mb-1 text-primary" style={{ fontSize: '0.95rem' }}>
                          <i className="bi bi-person-plus me-2"></i>Transaksi + Kontak Baru
                        </h6>
                        <code className="bg-white p-2 rounded-3 d-block shadow-sm" style={{ fontSize: '0.8rem', color: '#555' }}>
                          trx CLR 5kg agus-081234 dp 2hari AJ
                        </code>
                      </div>
                    </div>
                    <div className="col-12">
                      <div
                        className="card shadow-sm border-0 h-100 text-start p-3 customer-card-clickable"
                        style={{ cursor: 'pointer', borderRadius: '16px', background: '#e1f5fe' }}
                        onClick={() => handleSelectTemplate('tambah plastik 100pcs, molto 5pcs')}
                      >
                        <h6 className="mb-1 text-info" style={{ fontSize: '0.95rem' }}>
                          <i className="bi bi-box-seam me-2"></i>Tambah Stok Inventaris
                        </h6>
                        <code className="bg-white p-2 rounded-3 d-block shadow-sm" style={{ fontSize: '0.8rem', color: '#555' }}>
                          tambah plastik 100pcs, molto 5
                        </code>
                      </div>
                    </div>
                    {user?.role === 'owner' && (
                      <div className="col-12">
                        <div
                          className="card shadow-sm border-0 h-100 text-start p-3 customer-card-clickable"
                          style={{ cursor: 'pointer', borderRadius: '16px', background: '#e1f5fe' }}
                          onClick={() => handleSelectTemplate('acc semua inventory')}
                        >
                          <h6 className="mb-1 text-info" style={{ fontSize: '0.95rem' }}>
                            <i className="bi bi-check-circle me-2"></i>Approval (Khusus Owner)
                          </h6>
                          <code className="bg-white p-2 rounded-3 d-block shadow-sm" style={{ fontSize: '0.8rem', color: '#555' }}>
                            acc semua inventory
                          </code>
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

      {/* 5. Modal Konfirmasi Reset Percakapan */}
      {confirmModal.show && (
        <>
          <div
            className="modal-backdrop fade show"
            style={{ backdropFilter: 'blur(5px)', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}
          ></div>
          <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1065 }}>
            <div className="modal-dialog modal-dialog-centered mx-auto" style={{ maxWidth: '320px' }}>
              <div className="modal-content border-0 shadow-lg text-center p-4" style={{ borderRadius: '24px' }}>
                <h6 className="fw-bold mb-2">Konfirmasi</h6>
                <p className="text-muted small mb-4" style={{ whiteSpace: 'pre-wrap' }}>
                  {confirmModal.message}
                </p>
                <div className="d-flex gap-2">
                  <button
                    className="btn btn-outline-primary rounded-pill w-50 fw-bold"
                    onClick={() => setConfirmModal({ show: false, message: '', onConfirm: null })}
                  >
                    Batal
                  </button>
                  <button
                    className="btn btn-outline-primary rounded-pill w-50 fw-bold"
                    onClick={() => {
                      if (confirmModal.onConfirm) confirmModal.onConfirm();
                    }}
                  >
                    Lanjutkan
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default BotChatRoom;
