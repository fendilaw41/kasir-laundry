import { useState, useEffect } from 'react';
import { getSettingsQuery, updateSettings } from '../db/repositories/settings';
import { getKasirUsersQuery, addUser, updateUser, deleteUser as deleteUserRepo } from '../db/repositories/users';
import { useLiveQuery } from 'dexie-react-hooks';
import toast from 'react-hot-toast';

const Setting = ({ user }) => {
  const settings = useLiveQuery(getSettingsQuery);
  const users = useLiveQuery(getKasirUsersQuery);

  // Tab aktif: 'umum' (Informasi Toko & Kontak) | 'struk' (Format Nota Struk) | 'kasir' (Manajemen Kasir)
  const [activeTab, setActiveTab] = useState('umum');

  const [isSaving, setIsSaving] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const [userFormData, setUserFormData] = useState({
    fullname: '',
    username: '',
    password: '',
    role: 'kasir',
  });

  const [formData, setFormData] = useState({
    namaLaundry: '',
    motto: '',
    alamat: '',
    kota: '',
    telepon: '',
    jamBuka: '',
    menerimaCucian: true,
    headerStruk: '',
    footerStruk: '',
  });

  // Sinkronisasi data form dengan data lokal settings di Dexie
  useEffect(() => {
    if (settings) {
      setFormData({
        namaLaundry: settings.namaLaundry || '',
        motto: settings.motto || '',
        alamat: settings.alamat || '',
        kota: settings.kota || '',
        telepon: settings.telepon || '',
        jamBuka: settings.jamBuka || '',
        menerimaCucian: typeof settings.menerimaCucian === 'boolean' ? settings.menerimaCucian : true,
        headerStruk: settings.headerStruk || '',
        footerStruk: settings.footerStruk || '',
      });
    }
  }, [settings]);

  const handleSaveSettings = async (e) => {
    e?.preventDefault();
    if (user?.role !== 'owner') {
      toast.error('Hanya akun Pemilik (Owner) yang dapat mengubah pengaturan');
      return;
    }

    setIsSaving(true);
    try {
      await updateSettings(formData);
      toast.success('Pengaturan berhasil disimpan');
    } catch (err) {
      console.error(err);
      toast.error('Gagal menyimpan pengaturan');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUserSave = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await updateUser(editingUser.id, userFormData);
        toast.success('Data akun kasir diperbarui');
      } else {
        await addUser(userFormData);
        toast.success('Kasir baru berhasil ditambahkan');
      }
      setShowUserModal(false);
      setEditingUser(null);
      setUserFormData({ fullname: '', username: '', password: '', role: 'kasir' });
    } catch (err) {
      toast.error(err.message || 'Gagal menyimpan akun kasir');
    }
  };

  const deleteUser = async (id) => {
    if (window.confirm('Hapus akun kasir ini? Pegawai tidak akan bisa login lagi.')) {
      try {
        await deleteUserRepo(id);
        toast.success('Akun kasir berhasil dihapus');
      } catch (err) {
        toast.error(err.message || 'Gagal menghapus kasir');
      }
    }
  };

  const openUserModal = (selectedUser = null) => {
    if (selectedUser) {
      setEditingUser(selectedUser);
      setUserFormData({
        fullname: selectedUser.fullname || '',
        username: selectedUser.username || '',
        password: '',
        role: 'kasir',
      });
    } else {
      setEditingUser(null);
      setUserFormData({ fullname: '', username: '', password: '', role: 'kasir' });
    }
    setShowPassword(false);
    setShowUserModal(true);
  };

  if (!settings) {
    return (
      <div className="p-5 text-center text-muted">
        <div className="spinner-border text-primary mb-3" role="status"></div>
        <p className="small mb-0">Memuat data pengaturan...</p>
      </div>
    );
  }

  const isOwner = user?.role === 'owner';

  return (
    <div className="setting-page pb-5" style={{ backgroundColor: '#f4f6fa', minHeight: '100vh' }}>
      <div className="container px-3 pt-3" style={{ maxWidth: '640px' }}>
        {/* 1. MOBILE SEGMENTED TABS (DI BAGI 3 BAGIAN) */}
        <div className="sticky-top pt-1 pb-3" style={{ backgroundColor: '#f4f6fa', zIndex: 10 }}>
          <div
            className="d-flex p-1 bg-white rounded-pill shadow-sm border"
            style={{ borderColor: '#e2e8f0' }}
          >
            <button
              type="button"
              className={`btn btn-sm rounded-pill flex-fill py-2 fw-semibold d-flex align-items-center justify-content-center gap-1 transition-all ${
                activeTab === 'umum' ? 'btn-primary text-white shadow-sm' : 'text-muted border-0 bg-transparent'
              }`}
              style={{ fontSize: '0.82rem' }}
              onClick={() => setActiveTab('umum')}
            >
              <i className="bi bi-shop"></i>
              <span>Toko</span>
            </button>

            <button
              type="button"
              className={`btn btn-sm rounded-pill flex-fill py-2 fw-semibold d-flex align-items-center justify-content-center gap-1 transition-all ${
                activeTab === 'struk' ? 'btn-primary text-white shadow-sm' : 'text-muted border-0 bg-transparent'
              }`}
              style={{ fontSize: '0.82rem' }}
              onClick={() => setActiveTab('struk')}
            >
              <i className="bi bi-receipt"></i>
              <span>Struk</span>
            </button>

            {isOwner && (
              <button
                type="button"
                className={`btn btn-sm rounded-pill flex-fill py-2 fw-semibold d-flex align-items-center justify-content-center gap-1 transition-all ${
                  activeTab === 'kasir' ? 'btn-primary text-white shadow-sm' : 'text-muted border-0 bg-transparent'
                }`}
                style={{ fontSize: '0.82rem' }}
                onClick={() => setActiveTab('kasir')}
              >
                <i className="bi bi-people-fill"></i>
                <span>Kasir</span>
                {users && users.length > 0 && (
                  <span
                    className={`badge rounded-pill ms-1 ${
                      activeTab === 'kasir' ? 'bg-white text-primary' : 'bg-light text-muted'
                    }`}
                    style={{ fontSize: '0.65rem' }}
                  >
                    {users.length}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* NOTIFIKASI KHUSUS JIKA BUKAN OWNER */}
        {!isOwner && (
          <div
            className="alert alert-warning border-0 rounded-4 py-2 px-3 small d-flex align-items-center gap-2 mb-3 shadow-sm"
            style={{ backgroundColor: '#fff9e6', color: '#8a6200', fontSize: '0.78rem' }}
          >
            <i className="bi bi-shield-lock-fill fs-6 text-warning"></i>
            <span>Mode Baca: Pengaturan hanya dapat diedit oleh akun Pemilik (Owner).</span>
          </div>
        )}

        {/* ======================================================== */}
        {/* BAGIAN 1: PENGATURAN UMUM (PROFIL TOKO & OPERASIONAL)     */}
        {/* ======================================================== */}
        {activeTab === 'umum' && (
          <form onSubmit={handleSaveSettings}>
            {/* CARD 1A: PROFIL TOKO */}
            <div className="card border-0 shadow-sm rounded-4 mb-3 bg-white overflow-hidden">
              <div className="px-3 pt-3 pb-2 border-bottom bg-white d-flex align-items-center gap-2">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center text-primary flex-shrink-0"
                  style={{ width: '32px', height: '32px', backgroundColor: '#eaf1ff' }}
                >
                  <i className="bi bi-shop fs-6"></i>
                </div>
                <div>
                  <h6 className="fw-bold mb-0 text-dark" style={{ fontSize: '0.9rem' }}>Profil Laundry</h6>
                  <small className="text-muted" style={{ fontSize: '0.72rem' }}>Identitas usaha laundry Anda</small>
                </div>
              </div>

              <div className="p-3 d-flex flex-column gap-3">
                {/* Nama Laundry */}
                <div>
                  <label className="text-muted small fw-semibold mb-1 d-block" style={{ fontSize: '0.74rem' }}>
                    NAMA LAUNDRY <span className="text-danger">*</span>
                  </label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-0 text-muted rounded-start-3">
                      <i className="bi bi-tag-fill"></i>
                    </span>
                    <input
                      type="text"
                      className="form-control bg-light border-0 py-2 rounded-end-3 text-dark fw-semibold"
                      style={{ fontSize: '0.88rem' }}
                      value={formData.namaLaundry}
                      onChange={(e) => setFormData({ ...formData, namaLaundry: e.target.value })}
                      placeholder="Contoh: Laundry Bersih"
                      required
                      disabled={!isOwner}
                    />
                  </div>
                </div>

                {/* Motto / Tagline */}
                <div>
                  <label className="text-muted small fw-semibold mb-1 d-block" style={{ fontSize: '0.74rem' }}>
                    MOTTO / SLOGAN
                  </label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-0 text-muted rounded-start-3">
                      <i className="bi bi-chat-quote-fill"></i>
                    </span>
                    <input
                      type="text"
                      className="form-control bg-light border-0 py-2 rounded-end-3 text-dark fw-semibold"
                      style={{ fontSize: '0.88rem' }}
                      value={formData.motto}
                      onChange={(e) => setFormData({ ...formData, motto: e.target.value })}
                      placeholder="Contoh: Solusi Cuci Bersih & Wangi"
                      disabled={!isOwner}
                    />
                  </div>
                </div>

                {/* Alamat Toko */}
                <div>
                  <label className="text-muted small fw-semibold mb-1 d-block" style={{ fontSize: '0.74rem' }}>
                    ALAMAT LENGKAP <span className="text-danger">*</span>
                  </label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-0 text-muted rounded-start-3 align-items-start pt-2">
                      <i className="bi bi-geo-alt-fill"></i>
                    </span>
                    <textarea
                      className="form-control bg-light border-0 py-2 rounded-end-3 text-dark fw-semibold"
                      style={{ fontSize: '0.88rem' }}
                      rows="2"
                      value={formData.alamat}
                      onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
                      placeholder="Contoh: Jl. Ahmad Yani No. 45"
                      required
                      disabled={!isOwner}
                    />
                  </div>
                </div>

                {/* Kota / Kabupaten */}
                <div>
                  <label className="text-muted small fw-semibold mb-1 d-block" style={{ fontSize: '0.74rem' }}>
                    KOTA / KABUPATEN <span className="text-danger">*</span>
                  </label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-0 text-muted rounded-start-3">
                      <i className="bi bi-building"></i>
                    </span>
                    <input
                      type="text"
                      className="form-control bg-light border-0 py-2 rounded-end-3 text-dark fw-semibold"
                      style={{ fontSize: '0.88rem' }}
                      value={formData.kota}
                      onChange={(e) => setFormData({ ...formData, kota: e.target.value })}
                      placeholder="Contoh: Karawang"
                      required
                      disabled={!isOwner}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 1B: KONTAK & JAM OPERASIONAL */}
            <div className="card border-0 shadow-sm rounded-4 mb-4 bg-white overflow-hidden">
              <div className="px-3 pt-3 pb-2 border-bottom bg-white d-flex align-items-center gap-2">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center text-success flex-shrink-0"
                  style={{ width: '32px', height: '32px', backgroundColor: '#e6f9ed' }}
                >
                  <i className="bi bi-telephone-fill fs-6"></i>
                </div>
                <div>
                  <h6 className="fw-bold mb-0 text-dark" style={{ fontSize: '0.9rem' }}>Kontak & Operasional</h6>
                  <small className="text-muted" style={{ fontSize: '0.72rem' }}>Saluran WhatsApp dan jam kerja</small>
                </div>
              </div>

              <div className="p-3 d-flex flex-column gap-3">
                <div className="row g-2">
                  {/* WhatsApp */}
                  <div className="col-12 col-sm-6">
                    <label className="text-muted small fw-semibold mb-1 d-block" style={{ fontSize: '0.74rem' }}>
                      NOMOR WHATSAPP <span className="text-danger">*</span>
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-light border-0 text-success rounded-start-3">
                        <i className="bi bi-whatsapp"></i>
                      </span>
                      <input
                        type="tel"
                        className="form-control bg-light border-0 py-2 rounded-end-3 text-dark fw-semibold"
                        style={{ fontSize: '0.88rem' }}
                        value={formData.telepon}
                        onChange={(e) => setFormData({ ...formData, telepon: e.target.value })}
                        placeholder="08123456789"
                        required
                        disabled={!isOwner}
                      />
                    </div>
                  </div>

                  {/* Jam Buka */}
                  <div className="col-12 col-sm-6">
                    <label className="text-muted small fw-semibold mb-1 d-block" style={{ fontSize: '0.74rem' }}>
                      JAM OPERASIONAL <span className="text-danger">*</span>
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-light border-0 text-muted rounded-start-3">
                        <i className="bi bi-clock-fill"></i>
                      </span>
                      <input
                        type="text"
                        className="form-control bg-light border-0 py-2 rounded-end-3 text-dark fw-semibold"
                        style={{ fontSize: '0.88rem' }}
                        value={formData.jamBuka}
                        onChange={(e) => setFormData({ ...formData, jamBuka: e.target.value })}
                        placeholder="08.00 - 17.00"
                        required
                        disabled={!isOwner}
                      />
                    </div>
                  </div>
                </div>

                {/* Switch Status Menerima Cucian (Shopee Mobile Style) */}
                <div
                  className="d-flex align-items-center justify-content-between p-3 rounded-3"
                  style={{ backgroundColor: '#f8fafc', border: '1px solid #edf2f7' }}
                >
                  <div className="pe-2">
                    <h6 className="mb-0 fw-bold text-dark" style={{ fontSize: '0.88rem' }}>Status Menerima Cucian</h6>
                    <small className="text-muted d-block" style={{ fontSize: '0.72rem' }}>
                      {formData.menerimaCucian
                        ? '🟢 Toko BUKA (Kasir dapat input pesanan baru)'
                        : '🔴 Toko TUTUP (Sementara tidak menerima cucian)'}
                    </small>
                  </div>
                  <div className="form-check form-switch m-0 p-0 d-flex align-items-center">
                    <input
                      className="form-check-input ms-0"
                      type="checkbox"
                      role="switch"
                      checked={formData.menerimaCucian}
                      onChange={(e) => setFormData({ ...formData, menerimaCucian: e.target.checked })}
                      style={{ width: '46px', height: '24px', cursor: isOwner ? 'pointer' : 'default' }}
                      disabled={!isOwner}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* STICKY BOTTOM ACTION BUTTON */}
            {isOwner && (
              <button
                type="submit"
                className="btn btn-primary w-100 rounded-pill py-3 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2"
                disabled={isSaving}
                style={{ fontSize: '0.92rem' }}
              >
                {isSaving ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status"></span>
                    <span>Menyimpan Pengaturan...</span>
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-circle-fill fs-5"></i>
                    <span>Simpan Pengaturan Toko</span>
                  </>
                )}
              </button>
            )}
          </form>
        )}

        {/* ======================================================== */}
        {/* BAGIAN 2: PENGATURAN FORMAT STRUK / NOTA                  */}
        {/* ======================================================== */}
        {activeTab === 'struk' && (
          <form onSubmit={handleSaveSettings}>
            <div className="card border-0 shadow-sm rounded-4 mb-3 bg-white overflow-hidden">
              <div className="px-3 pt-3 pb-2 border-bottom bg-white d-flex align-items-center gap-2">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center text-primary flex-shrink-0"
                  style={{ width: '32px', height: '32px', backgroundColor: '#eaf1ff' }}
                >
                  <i className="bi bi-printer-fill fs-6"></i>
                </div>
                <div>
                  <h6 className="fw-bold mb-0 text-dark" style={{ fontSize: '0.9rem' }}>Pesan Pada Struk</h6>
                  <small className="text-muted" style={{ fontSize: '0.72rem' }}>Teks yang dicetak di atas dan bawah nota</small>
                </div>
              </div>

              <div className="p-3 d-flex flex-column gap-3">
                {/* Header Struk */}
                <div>
                  <label className="text-muted small fw-semibold mb-1 d-block" style={{ fontSize: '0.74rem' }}>
                    HEADER STRUK (PESAN ATAS)
                  </label>
                  <input
                    type="text"
                    className="form-control bg-light border-0 py-2 rounded-3 text-dark fw-semibold"
                    style={{ fontSize: '0.88rem' }}
                    value={formData.headerStruk}
                    onChange={(e) => setFormData({ ...formData, headerStruk: e.target.value })}
                    placeholder="Contoh: Terima kasih atas kunjungan anda"
                    disabled={!isOwner}
                  />
                  <small className="text-muted d-block mt-1" style={{ fontSize: '0.7rem' }}>
                    Muncul tepat di bawah nama & alamat laundry pada struk thermal.
                  </small>
                </div>

                {/* Footer Struk */}
                <div>
                  <label className="text-muted small fw-semibold mb-1 d-block" style={{ fontSize: '0.74rem' }}>
                    FOOTER STRUK (PESAN BAWAH / KETENTUAN)
                  </label>
                  <textarea
                    className="form-control bg-light border-0 py-2 rounded-3 text-dark fw-semibold"
                    style={{ fontSize: '0.88rem' }}
                    rows="3"
                    value={formData.footerStruk}
                    onChange={(e) => setFormData({ ...formData, footerStruk: e.target.value })}
                    placeholder="Contoh: Barang tidak diambil dalam 30 hari di luar tanggung jawab."
                    disabled={!isOwner}
                  />
                  <small className="text-muted d-block mt-1" style={{ fontSize: '0.7rem' }}>
                    Ketentuan klaim atau ucapan penutup di bagian paling bawah struk.
                  </small>
                </div>
              </div>
            </div>

            {/* LIVE PREVIEW MINI STRUK THERMAL */}
            <div className="card border-0 shadow-sm rounded-4 mb-4 bg-white overflow-hidden">
              <div className="px-3 py-2 bg-light border-bottom d-flex align-items-center justify-content-between">
                <small className="fw-bold text-muted" style={{ fontSize: '0.75rem' }}>
                  <i className="bi bi-eye me-1"></i> SIMULASI STRUK THERMAL (58MM)
                </small>
                <span className="badge bg-secondary-subtle text-secondary rounded-pill" style={{ fontSize: '0.65rem' }}>
                  Live Preview
                </span>
              </div>
              <div className="p-3 bg-light d-flex justify-content-center">
                <div
                  className="bg-white p-3 shadow-sm rounded-2 font-monospace text-dark text-center"
                  style={{
                    width: '240px',
                    fontSize: '11px',
                    lineHeight: '1.3',
                    border: '1px dashed #cbd5e1',
                  }}
                >
                  <div className="fw-bold text-uppercase">{formData.namaLaundry || 'NAMA LAUNDRY'}</div>
                  <div style={{ fontSize: '9px' }}>{formData.alamat || 'Alamat Toko'}</div>
                  <div style={{ fontSize: '9px' }}>WA: {formData.telepon || '08...'}</div>
                  {formData.headerStruk && (
                    <div className="my-1 border-top border-bottom py-1 text-muted" style={{ fontSize: '9px' }}>
                      {formData.headerStruk}
                    </div>
                  )}
                  <div className="my-1 text-start" style={{ borderBottom: '1px dashed #000', paddingBottom: '3px' }}>
                    <div>No : #8126-00001</div>
                    <div>Tgl: {new Date().toLocaleDateString('id-ID')}</div>
                  </div>
                  <div className="text-start my-1" style={{ borderBottom: '1px dashed #000', paddingBottom: '3px' }}>
                    <div className="d-flex justify-content-between">
                      <span>Cuci Komplit (3kg)</span>
                      <span>21.000</span>
                    </div>
                    <div className="d-flex justify-content-between fw-bold pt-1">
                      <span>TOTAL</span>
                      <span>21.000</span>
                    </div>
                  </div>
                  <div className="mt-2 text-muted" style={{ fontSize: '9px', whiteSpace: 'pre-wrap' }}>
                    {formData.footerStruk || 'Terima kasih atas kepercayaan Anda'}
                  </div>
                </div>
              </div>
            </div>

            {isOwner && (
              <button
                type="submit"
                className="btn btn-primary w-100 rounded-pill py-3 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2"
                disabled={isSaving}
                style={{ fontSize: '0.92rem' }}
              >
                {isSaving ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status"></span>
                    <span>Menyimpan Format Struk...</span>
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-circle-fill fs-5"></i>
                    <span>Simpan Format Struk</span>
                  </>
                )}
              </button>
            )}
          </form>
        )}

        {/* ======================================================== */}
        {/* BAGIAN 3: MANAJEMEN PEGAWAI KASIR                         */}
        {/* ======================================================== */}
        {activeTab === 'kasir' && isOwner && (
          <div>
            {/* ACTION HEADER */}
            <div className="d-flex justify-content-between align-items-center mb-3 px-1">
              <div>
                <h6 className="fw-bold mb-0 text-dark">Daftar Akun Kasir</h6>
                <small className="text-muted" style={{ fontSize: '0.74rem' }}>
                  Total {users?.length || 0} kasir terdaftar di toko ini
                </small>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm rounded-pill px-3 py-2 fw-semibold d-flex align-items-center gap-1 shadow-sm"
                onClick={() => openUserModal()}
                style={{ fontSize: '0.8rem' }}
              >
                <i className="bi bi-person-plus-fill"></i>
                <span>Tambah Kasir</span>
              </button>
            </div>

            {/* LIST KASIR (SHOPEE / MOBILE USER CARD) */}
            <div className="d-flex flex-column gap-2 mb-4">
              {!users || users.length === 0 ? (
                <div className="card border-0 shadow-sm rounded-4 p-5 text-center bg-white my-2">
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3"
                    style={{ width: '64px', height: '64px', backgroundColor: '#eaf1ff', color: '#0d5afd' }}
                  >
                    <i className="bi bi-people fs-2"></i>
                  </div>
                  <h6 className="fw-bold text-dark mb-1">Belum Ada Akun Kasir</h6>
                  <p className="text-muted small mb-3">
                    Tambahkan akun pegawai untuk melayani transaksi di kasir.
                  </p>
                  <div>
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm rounded-pill px-4"
                      onClick={() => openUserModal()}
                    >
                      + Tambah Kasir Pertama
                    </button>
                  </div>
                </div>
              ) : (
                users.map((u) => (
                  <div
                    key={u.id}
                    className="p-3 bg-white rounded-4 shadow-sm border d-flex align-items-center justify-content-between"
                    style={{ borderColor: '#f1f5f9' }}
                  >
                    <div className="d-flex align-items-center gap-3 overflow-hidden">
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold shadow-xs flex-shrink-0"
                        style={{
                          width: '42px',
                          height: '42px',
                          background: 'linear-gradient(135deg, #0d5afd 0%, #1e40af 100%)',
                          fontSize: '1.05rem',
                        }}
                      >
                        {u.fullname?.charAt(0).toUpperCase() || 'K'}
                      </div>
                      <div className="overflow-hidden">
                        <h6 className="mb-0 fw-bold text-dark text-truncate" style={{ fontSize: '0.9rem' }}>
                          {u.fullname}
                        </h6>
                        <small className="text-muted text-truncate d-block" style={{ fontSize: '0.74rem' }}>
                          <span className="fw-semibold">@{u.username}</span> •{' '}
                          <span className="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill px-2">
                            Kasir
                          </span>
                        </small>
                      </div>
                    </div>

                    <div className="d-flex align-items-center gap-1 flex-shrink-0 ms-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-light rounded-circle text-primary border shadow-xs d-flex align-items-center justify-content-center"
                        style={{ width: '34px', height: '34px' }}
                        onClick={() => openUserModal(u)}
                        title="Edit Data Kasir"
                      >
                        <i className="bi bi-pencil-fill" style={{ fontSize: '0.8rem' }}></i>
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-light rounded-circle text-danger border shadow-xs d-flex align-items-center justify-content-center"
                        style={{ width: '34px', height: '34px' }}
                        onClick={() => deleteUser(u.id)}
                        title="Hapus Kasir"
                      >
                        <i className="bi bi-trash-fill" style={{ fontSize: '0.8rem' }}></i>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* MODAL TAMBAH / EDIT KASIR (SHOPEE MOBILE SHEET STYLE)     */}
      {/* ======================================================== */}
      {showUserModal && (
        <>
          <div
            className="modal-backdrop fade show"
            style={{ backdropFilter: 'blur(5px)', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}
            onClick={() => setShowUserModal(false)}
          ></div>
          <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1065 }}>
            <div className="modal-dialog modal-dialog-centered mx-auto" style={{ maxWidth: '400px' }}>
              <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                <div className="modal-header border-bottom px-4 py-3 bg-white">
                  <div className="d-flex align-items-center gap-2">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center text-primary"
                      style={{ width: '32px', height: '32px', backgroundColor: '#eaf1ff' }}
                    >
                      <i className={`bi ${editingUser ? 'bi-pencil-square' : 'bi-person-plus-fill'}`}></i>
                    </div>
                    <h6 className="fw-bold mb-0 text-dark">
                      {editingUser ? 'Edit Akun Kasir' : 'Tambah Kasir Baru'}
                    </h6>
                  </div>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowUserModal(false)}
                  ></button>
                </div>

                <form onSubmit={handleUserSave}>
                  <div className="modal-body p-4 d-flex flex-column gap-3">
                    {/* Nama Lengkap */}
                    <div>
                      <label className="text-muted small fw-semibold mb-1 d-block" style={{ fontSize: '0.74rem' }}>
                        NAMA LENGKAP PEGAWAI <span className="text-danger">*</span>
                      </label>
                      <div className="input-group">
                        <span className="input-group-text bg-light border-0 text-muted rounded-start-3">
                          <i className="bi bi-person-fill"></i>
                        </span>
                        <input
                          type="text"
                          className="form-control bg-light border-0 py-2 rounded-end-3 text-dark fw-semibold"
                          style={{ fontSize: '0.88rem' }}
                          value={userFormData.fullname}
                          onChange={(e) => setUserFormData({ ...userFormData, fullname: e.target.value })}
                          placeholder="Contoh: Siti Rahmawati"
                          required
                        />
                      </div>
                    </div>

                    {/* Username */}
                    <div>
                      <label className="text-muted small fw-semibold mb-1 d-block" style={{ fontSize: '0.74rem' }}>
                        USERNAME LOGIN <span className="text-danger">*</span>
                      </label>
                      <div className="input-group">
                        <span className="input-group-text bg-light border-0 text-muted rounded-start-3">
                          <i className="bi bi-at"></i>
                        </span>
                        <input
                          type="text"
                          className="form-control bg-light border-0 py-2 rounded-end-3 text-dark fw-semibold"
                          style={{ fontSize: '0.88rem' }}
                          value={userFormData.username}
                          onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })}
                          placeholder="kasir1"
                          required
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <label className="text-muted small fw-semibold mb-1 d-block" style={{ fontSize: '0.74rem' }}>
                        PASSWORD {editingUser ? '(Opsional)' : <span className="text-danger">*</span>}
                      </label>
                      <div className="input-group">
                        <span className="input-group-text bg-light border-0 text-muted rounded-start-3">
                          <i className="bi bi-lock-fill"></i>
                        </span>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          className="form-control bg-light border-0 py-2 text-dark fw-semibold"
                          style={{ fontSize: '0.88rem' }}
                          value={userFormData.password}
                          onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                          placeholder={editingUser ? 'Kosongkan jika password tetap' : 'Minimal 4 karakter'}
                          required={!editingUser}
                        />
                        <button
                          type="button"
                          className="btn bg-light border-0 text-muted rounded-end-3 px-3"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          <i className={`bi ${showPassword ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`}></i>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="modal-footer border-0 px-4 pb-4 pt-0">
                    <button
                      type="submit"
                      className="btn btn-primary w-100 rounded-pill py-2 fw-bold shadow-sm"
                      style={{ fontSize: '0.88rem' }}
                    >
                      <i className="bi bi-check2-circle me-1"></i>
                      <span>{editingUser ? 'Simpan Perubahan' : 'Daftarkan Kasir'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Setting;
