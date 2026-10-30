import React, { useState, useEffect } from 'react';
import { getChatContacts, createConversation } from '../../services/chatService';

export const NewChatModal = ({ show, onClose, onConversationCreated, currentUser, enableCrossStore }) => {
  const [activeTab, setActiveTab] = useState('direct'); // 'direct' | 'group'
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Form Buat Grup
  const [groupTitle, setGroupTitle] = useState('');
  const [isCrossStore, setIsCrossStore] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (show) {
      loadContacts();
      setErrorMsg('');
      setGroupTitle('');
      setSelectedMemberIds([]);
      setIsCrossStore(false);
    }
  }, [show]);

  const loadContacts = async () => {
    setLoading(true);
    try {
      const list = await getChatContacts();
      setContacts(list);
    } catch (err) {
      setErrorMsg(err.message || 'Gagal memuat kontak.');
    } finally {
      setLoading(false);
    }
  };

  const isOwner = currentUser?.role?.toLowerCase() === 'owner';

  // Filter kontak berdasarkan pencarian
  const filteredContacts = contacts.filter((c) => {
    const q = searchQuery.toLowerCase();
    const matchName = (c.fullname || c.username).toLowerCase().includes(q);
    const matchStore = c.store?.name?.toLowerCase().includes(q) || false;
    return matchName || matchStore;
  });

  // Mulai obrolan 1-on-1
  const handleStartDirectChat = async (targetUser) => {
    setSubmitting(true);
    setErrorMsg('');
    try {
      const conv = await createConversation({
        type: 'DIRECT',
        targetUserId: targetUser.id,
      });
      onConversationCreated(conv);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Gagal memulai chat.');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle pilihan anggota grup
  const toggleSelectMember = (userId) => {
    if (selectedMemberIds.includes(userId)) {
      setSelectedMemberIds(selectedMemberIds.filter((id) => id !== userId));
    } else {
      setSelectedMemberIds([...selectedMemberIds, userId]);
    }
  };

  // Submit pembuatan grup
  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupTitle.trim()) {
      setErrorMsg('Nama grup wajib diisi.');
      return;
    }
    if (selectedMemberIds.length < 1) {
      setErrorMsg('Pilih minimal 1 anggota tambahan untuk grup.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      const type = isOwner && enableCrossStore && isCrossStore ? 'CROSS_STORE' : 'GROUP';
      const conv = await createConversation({
        type,
        title: groupTitle.trim(),
        memberIds: selectedMemberIds,
      });
      onConversationCreated(conv);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Gagal membuat grup.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!show) return null;

  return (
    <>
      <div
        className="modal-backdrop fade show"
        style={{ backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}
        onClick={onClose}
      />
      <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1065 }}>
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable mx-auto" style={{ maxWidth: '480px' }}>
          <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '20px' }}>
            {/* Modal Header */}
            <div className="modal-header border-0 pb-0 pt-3 px-4">
              <h5 className="fw-bold mb-0 text-primary">
                <i className="bi bi-chat-dots me-2"></i>Mulai Percakapan
              </h5>
              <button type="button" className="btn-close" onClick={onClose} disabled={submitting}></button>
            </div>

            {/* Nav Tab */}
            <div className="px-4 pt-3">
              <ul className="nav nav-pills nav-fill bg-light p-1 rounded-3">
                <li className="nav-item">
                  <button
                    className={`nav-link py-1 fw-semibold ${activeTab === 'direct' ? 'active shadow-sm' : 'text-dark'}`}
                    style={{ fontSize: '0.85rem' }}
                    onClick={() => setActiveTab('direct')}
                  >
                    <i className="bi bi-person me-1"></i>Chat
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    className={`nav-link py-1 fw-semibold ${activeTab === 'group' ? 'active shadow-sm' : 'text-dark'}`}
                    style={{ fontSize: '0.85rem' }}
                    onClick={() => setActiveTab('group')}
                  >
                    <i className="bi bi-people me-1"></i>Buat Grup
                  </button>
                </li>
              </ul>
            </div>

            {/* Modal Body */}
            <div className="modal-body p-4 pt-3">
              {errorMsg && (
                <div className="alert alert-danger py-2 px-3 small rounded-3 mb-3" role="alert">
                  {errorMsg}
                </div>
              )}

              {/* TAB 1: DIRECT CHAT */}
              {activeTab === 'direct' && (
                <div>
                  <div className="position-relative mb-3">
                    <i className="bi bi-search position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"></i>
                    <input
                      type="text"
                      className="form-control rounded-pill ps-5 bg-light border-0 shadow-none"
                      style={{ fontSize: '0.85rem' }}
                      placeholder="Cari nama anggota atau cabang..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  {loading ? (
                    <div className="text-center py-4 text-muted">
                      <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                      Memuat kontak...
                    </div>
                  ) : filteredContacts.length === 0 ? (
                    <div className="text-center py-4 text-muted small">
                      Tidak ada kontak ditemukan.
                    </div>
                  ) : (
                    <div className="list-group list-group-flush" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                      {filteredContacts.map((contact) => (
                        <button
                          key={contact.id}
                          type="button"
                          className="list-group-item list-group-item-action d-flex align-items-center gap-3 py-2 px-2 border-0 rounded-3 mb-1"
                          onClick={() => handleStartDirectChat(contact)}
                          disabled={submitting}
                        >
                          <div
                            className="rounded-circle fw-bold d-flex align-items-center justify-content-center flex-shrink-0"
                            style={{ width: '40px', height: '40px', backgroundColor: '#eaf1ff', color: '#0d5afd', fontSize: '0.9rem' }}
                          >
                            {contact.fullname?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div className="flex-grow-1 text-start">
                            <h6 className="mb-0 fw-semibold text-dark" style={{ fontSize: '0.9rem' }}>
                              {contact.fullname || contact.username}
                            </h6>
                            <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                              <span className="badge rounded-pill me-1" style={{ backgroundColor: '#f1f5f9', color: '#475569' }}>
                                {contact.role}
                              </span>
                              {contact.store?.name || 'Cabang'}
                            </small>
                          </div>
                          <i className="bi bi-chevron-right text-muted small"></i>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: BUAT GRUP */}
              {activeTab === 'group' && (
                <form onSubmit={handleCreateGroup}>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold text-dark">Nama Grup</label>
                    <input
                      type="text"
                      className="form-control rounded-3"
                      style={{ fontSize: '0.85rem' }}
                      placeholder="Contoh: Kasir Shift Pagi / Tim Laundry"
                      value={groupTitle}
                      onChange={(e) => setGroupTitle(e.target.value)}
                      required
                    />
                  </div>

                  {isOwner && enableCrossStore && (
                    <div className="form-check form-switch mb-3 p-2 bg-light rounded-3 d-flex justify-content-between align-items-center">
                      <div>
                        <label className="form-check-label fw-semibold small text-primary mb-0" htmlFor="crossStoreSwitch">
                          🌐 Grup Lintas Cabang
                        </label>
                        <small className="text-muted d-block" style={{ fontSize: '0.72rem' }}>
                          Anggota dapat berasal dari berbagai toko cabang
                        </small>
                      </div>
                      <input
                        className="form-check-input ms-0"
                        type="checkbox"
                        id="crossStoreSwitch"
                        checked={isCrossStore}
                        onChange={(e) => setIsCrossStore(e.target.checked)}
                      />
                    </div>
                  )}

                  <label className="form-label small fw-semibold text-dark mb-2">
                    Pilih Anggota ({selectedMemberIds.length} dipilih)
                  </label>

                  <div className="list-group list-group-flush border rounded-3 p-2 mb-3" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {filteredContacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="d-flex align-items-center gap-2 py-2 px-2 rounded-2 hover-bg"
                        style={{ cursor: 'pointer' }}
                        onClick={() => toggleSelectMember(contact.id)}
                      >
                        <input
                          type="checkbox"
                          className="form-check-input mt-0"
                          checked={selectedMemberIds.includes(contact.id)}
                          onChange={() => { }}
                        />
                        <div className="flex-grow-1 text-start">
                          <span className="fw-semibold text-dark d-block" style={{ fontSize: '0.85rem' }}>
                            {contact.fullname || contact.username}
                          </span>
                          <small className="text-muted" style={{ fontSize: '0.72rem' }}>
                            {contact.role} • {contact.store?.name}
                          </small>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary w-100 rounded-pill py-2 fw-semibold"
                    style={{ fontSize: '0.9rem' }}
                    disabled={submitting || !groupTitle.trim() || selectedMemberIds.length < 1}
                  >
                    {submitting ? 'Membuat Grup...' : 'Buat Grup Sekarang'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default NewChatModal;

