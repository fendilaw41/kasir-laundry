import { useState } from 'react';
import { getSettingsQuery, updateSettings } from '../db/repositories/settings';
import { getKasirUsersQuery, addUser, updateUser, deleteUser as deleteUserRepo } from '../db/repositories/users';
import { useLiveQuery } from 'dexie-react-hooks';
import toast from 'react-hot-toast';

const Setting = ({ user }) => {
  const settings = useLiveQuery(getSettingsQuery);
  const users = useLiveQuery(getKasirUsersQuery);
  const [isEditing, setIsEditing] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userFormData, setUserFormData] = useState({ fullname: '', username: '', password: '', role: 'kasir' });
  const [formData, setFormData] = useState({
    namaLaundry: '',
    motto: '',
    alamat: '',
    kota: '',
    telepon: '',
    jamBuka: '',
    menerimaCucian: true,
    headerStruk: '',
    footerStruk: ''
  });

  const startEditing = () => {
    setFormData(settings);
    setIsEditing(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await updateSettings(formData);
      setIsEditing(false);
      toast.success('Pengaturan berhasil diperbarui');
    } catch (err) {
      console.error(err);
      toast.error('Gagal memperbarui pengaturan');
    }
  };

  const handleUserSave = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await updateUser(editingUser.id, userFormData);
        toast.success('Data kasir diperbarui');
      } else {
        await addUser(userFormData);
        toast.success('Kasir baru ditambahkan');
      }
      setShowUserModal(false);
      setEditingUser(null);
      setUserFormData({ fullname: '', username: '', password: '', role: 'kasir' });
    } catch (err) {
      toast.error('Gagal menyimpan data', err);
    }
  };

  const deleteUser = async (id) => {
    if (window.confirm('Hapus akun kasir ini?')) {
      await deleteUserRepo(id);
      toast.success('Kasir berhasil dihapus');
    }
  };

  const openUserModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setUserFormData({ ...user });
    } else {
      setEditingUser(null);
      setUserFormData({ fullname: '', username: '', password: '', role: 'kasir' });
    }
    setShowUserModal(true);
  };

  if (!settings) return <div className="p-5 text-center text-muted"><div className="spinner-border text-primary mb-3"></div><br />Memuat pengaturan...</div>;

  return (
    <div className="setting-page pb-5" style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      <div className="px-3 pt-4">

        {/* HEADER & EDIT TOGGLE */}
        <div className="d-flex justify-content-between align-items-center mb-4 px-1">
          <div>
            <h5 className="fw-bold mb-0 text-dark">Pengaturan</h5>
            <small className="text-muted">Kelola informasi toko dan struk</small>
          </div>
          {!isEditing && user.role === 'owner' && (
            <button type="button" className="btn btn-outline-primary rounded-pill px-4 fw-bold shadow-sm" onClick={startEditing}>
              <i className="bi bi-pencil-square me-2"></i>Edit
            </button>
          )}
        </div>

        <form onSubmit={handleSave}>

          {/* SECTION: INFORMASI TOKO */}
          <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '20px', overflow: 'hidden' }}>
            <div className="card-header bg-white border-0 pt-4 pb-0 px-4">
              <h6 className="fw-bold text-primary mb-0"><i className="bi bi-shop me-2"></i>Informasi Toko</h6>
            </div>
            <div className="card-body p-4">
              {isEditing ? (
                <div className="row g-3">
                  <div className="col-12">
                    <label className="small text-muted fw-bold mb-2">Nama Laundry</label>
                    <input type="text" className="form-control rounded-4 bg-light border-0 px-3 py-3 fw-bold text-dark" id="namaLaundry" placeholder="Contoh: Keenan Laundry" value={formData.namaLaundry} onChange={(e) => setFormData({ ...formData, namaLaundry: e.target.value })} required />
                  </div>
                  <div className="col-12">
                    <label className="small text-muted fw-bold mb-2">Motto</label>
                    <input type="text" className="form-control rounded-4 bg-light border-0 px-3 py-3 fw-bold text-dark" id="motto" placeholder="Contoh: Solusi Laundry Bersih & Cepat" value={formData.motto} onChange={(e) => setFormData({ ...formData, motto: e.target.value })} />
                  </div>
                  <div className="col-12">
                    <label className="small text-muted fw-bold mb-2">Alamat Lengkap</label>
                    <textarea className="form-control rounded-4 bg-light border-0 px-3 py-3 fw-bold text-dark" id="alamatToko" placeholder="Contoh: Jl. Imam Bonjol 007" rows="2" value={formData.alamat} onChange={(e) => setFormData({ ...formData, alamat: e.target.value })} required></textarea>
                  </div>
                  <div className="col-12">
                    <label className="small text-muted fw-bold mb-2">Kota / Kabupaten</label>
                    <input type="text" className="form-control rounded-4 bg-light border-0 px-3 py-3 fw-bold text-dark" id="kota" placeholder="Contoh: Karawang" value={formData.kota} onChange={(e) => setFormData({ ...formData, kota: e.target.value })} required />
                  </div>
                </div>
              ) : (
                <div className="d-flex flex-column gap-3">
                  <div className="px-3 py-2 bg-light rounded-4">
                    <div className="text-muted small mb-1" style={{ fontSize: '0.8rem' }}>Nama Laundry</div>
                    <div className="fw-bold text-dark" style={{ fontSize: '1.05rem' }}>{settings.namaLaundry}</div>
                  </div>
                  <div className="px-3 py-2 bg-light rounded-4">
                    <div className="text-muted small mb-1" style={{ fontSize: '0.8rem' }}>Motto / Tagline</div>
                    <div className="fw-bold text-dark" style={{ fontSize: '1.05rem' }}>{settings.motto || '-'}</div>
                  </div>
                  <div className="px-3 py-2 bg-light rounded-4">
                    <div className="text-muted small mb-1" style={{ fontSize: '0.8rem' }}>Alamat Lengkap</div>
                    <div className="fw-bold text-dark" style={{ fontSize: '1.05rem' }}>{settings.alamat}</div>
                  </div>
                  <div className="px-3 py-2 bg-light rounded-4">
                    <div className="text-muted small mb-1" style={{ fontSize: '0.8rem' }}>Kota / Kabupaten</div>
                    <div className="fw-bold text-dark" style={{ fontSize: '1.05rem' }}>{settings.kota}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SECTION: KONTAK & WAKTU */}
          <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '20px', overflow: 'hidden' }}>
            <div className="card-header bg-white border-0 pt-4 pb-0 px-4">
              <h6 className="fw-bold text-dark mb-0"><i className="bi bi-telephone me-2"></i>Kontak & Operasional</h6>
            </div>
            <div className="card-body p-4">
              {isEditing ? (
                <div className="row g-3">
                  <div className="col-6">
                    <label className="small text-muted fw-bold mb-2">No. WhatsApp</label>
                    <input type="tel" className="form-control rounded-4 bg-light border-0 px-3 py-3 fw-bold text-dark" id="wa" placeholder="08..." value={formData.telepon} onChange={(e) => setFormData({ ...formData, telepon: e.target.value })} required />
                  </div>
                  <div className="col-6">
                    <label className="small text-muted fw-bold mb-2">Jam Buka</label>
                    <input type="text" className="form-control rounded-4 bg-light border-0 px-3 py-3 fw-bold text-dark" id="jamBuka" placeholder="08.00 - 17.00" value={formData.jamBuka} onChange={(e) => setFormData({ ...formData, jamBuka: e.target.value })} required />
                  </div>
                  <div className="col-12 mt-4">
                    <div className="form-check form-switch d-flex align-items-center justify-content-between p-0 px-2">
                      <label className="form-check-label text-dark fw-bold mb-0" htmlFor="menerimaCucian">Status Menerima Cucian</label>
                      <input className="form-check-input ms-0 mt-0" type="checkbox" role="switch" id="menerimaCucian" style={{ width: '45px', height: '22px', cursor: 'pointer' }} checked={formData.menerimaCucian} onChange={(e) => setFormData({ ...formData, menerimaCucian: e.target.checked })} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="d-flex flex-column gap-3">
                  <div className="row g-3">
                    <div className="col-6">
                      <div className="px-3 py-2 bg-light rounded-4 h-100">
                        <div className="text-muted small mb-1" style={{ fontSize: '0.8rem' }}>No. WhatsApp</div>
                        <div className="fw-bold text-dark" style={{ fontSize: '1.05rem' }}>{settings.telepon}</div>
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="px-3 py-2 bg-light rounded-4 h-100">
                        <div className="text-muted small mb-1" style={{ fontSize: '0.8rem' }}>Jam Buka</div>
                        <div className="fw-bold text-dark" style={{ fontSize: '1.05rem' }}>{settings.jamBuka}</div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 d-flex justify-content-between align-items-center px-1">
                    <span className="fw-bold text-dark" style={{ fontSize: '1.05rem' }}>Status Menerima Cucian</span>
                    <div className="form-check form-switch p-0 m-0 d-flex align-items-center">
                      <input className="form-check-input ms-0 mt-0" type="checkbox" role="switch" checked={settings.menerimaCucian} readOnly style={{ width: '45px', height: '22px', opacity: 1, backgroundColor: settings.menerimaCucian ? '#0d6efd' : '#e9ecef', borderColor: settings.menerimaCucian ? '#0d6efd' : '#dee2e6' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SECTION: PENGATURAN STRUK */}
          <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '20px', overflow: 'hidden' }}>
            <div className="card-header bg-white border-0 pt-4 pb-0 px-4">
              <h6 className="fw-bold text-dark mb-0"><i className="bi bi-receipt me-2"></i>Pengaturan Struk</h6>
            </div>
            <div className="card-body p-4">
              {isEditing ? (
                <div className="row g-3">
                  <div className="col-12">
                    <label className="small text-muted fw-bold mb-2">Pesan Atas Struk (Header)</label>
                    <input type="text" className="form-control rounded-4 bg-light border-0 px-3 py-3 fw-bold text-dark" id="headerStruk" placeholder="Terima kasih atas kunjungan anda" value={formData.headerStruk} onChange={(e) => setFormData({ ...formData, headerStruk: e.target.value })} />
                  </div>
                  <div className="col-12">
                    <label className="small text-muted fw-bold mb-2">Pesan Bawah Struk (Footer)</label>
                    <textarea className="form-control rounded-4 bg-light border-0 px-3 py-3 fw-bold text-dark" id="footerStruk" placeholder="Layanan komplain 1x24 jam" rows="2" value={formData.footerStruk} onChange={(e) => setFormData({ ...formData, footerStruk: e.target.value })}></textarea>
                  </div>
                </div>
              ) : (
                <div className="d-flex flex-column gap-3">
                  <div className="px-3 py-2 bg-light rounded-4">
                    <div className="text-muted small mb-1" style={{ fontSize: '0.8rem' }}>Pesan Header (Atas)</div>
                    <div className="fw-bold text-dark" style={{ fontSize: '1.05rem' }}>{settings.headerStruk || '-'}</div>
                  </div>
                  <div className="px-3 py-2 bg-light rounded-4">
                    <div className="text-muted small mb-1" style={{ fontSize: '0.8rem' }}>Pesan Footer (Bawah)</div>
                    <div className="fw-bold text-dark" style={{ fontSize: '1.05rem', whiteSpace: 'pre-wrap' }}>{settings.footerStruk || '-'}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* BUTTON ACTIONS */}
          {isEditing && (
            <div className="d-flex gap-3 px-2 mb-5">
              <button type="button" className="btn btn-light w-50 rounded-pill fw-bold py-3 shadow-sm text-muted" onClick={() => { setIsEditing(false); setFormData(settings); }}>
                Batal
              </button>
              <button type="submit" className="btn btn-outline-primary w-50 rounded-pill fw-bold py-3 shadow-sm">
                <i className="bi bi-save me-2"></i>Simpan
              </button>
            </div>
          )}
        </form>

        {/* SECTION: MANAJEMEN KASIR (Hanya Owner) */}
        {!isEditing && user.role === 'owner' && (
          <div className="mt-5 mb-5">
            <div className="d-flex justify-content-between align-items-center mb-3 px-2">
              <div>
                <h6 className="fw-bold mb-0 text-dark">Manajemen Kasir</h6>
                <small className="text-muted">Kelola akun akses pegawai</small>
              </div>
              <button className="btn btn-outline-primary btn-sm rounded-pill px-3 py-2 fw-bold" onClick={() => openUserModal()}>
                <i className="bi bi-person-plus-fill me-1"></i> Tambah
              </button>
            </div>

            <div className="inventory-list">
              {users?.length === 0 ? (
                <div className="card border-0 shadow-sm rounded-4 p-5 text-center bg-white">
                  <div className="icon-wrapper bg-light rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3" style={{ width: '80px', height: '80px' }}>
                    <i className="bi bi-people text-muted opacity-50" style={{ fontSize: '2.5rem' }}></i>
                  </div>
                  <h6 className="fw-bold text-dark">Belum Ada Kasir</h6>
                  <p className="text-muted small mb-0">Tambahkan akun kasir untuk pegawai Anda.</p>
                </div>
              ) : (
                users?.map(u => (
                  <div key={u.id} className="card border-0 shadow-sm rounded-4 mb-3 overflow-hidden bg-white">
                    <div className="card-body p-3 d-flex align-items-center justify-content-between">
                      <div className="d-flex align-items-center">
                        <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold text-white me-3 shadow-sm"
                          style={{ width: '45px', height: '45px', background: 'linear-gradient(135deg, #0134d4 0%, #2855e1 100%)', fontSize: '1rem' }}>
                          {u.fullname.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h6 className="fw-bold text-dark mb-0">{u.fullname}</h6>
                          <small className="text-muted"><i className="bi bi-person-badge me-1"></i> {u.username} • <span className="text-capitalize">{u.role}</span></small>
                        </div>
                      </div>
                      <div className="d-flex gap-2">
                        <button className="btn btn-light btn-sm rounded-circle shadow-sm d-flex align-items-center justify-content-center" style={{ width: '35px', height: '35px' }} onClick={() => openUserModal(u)}>
                          <i className="bi bi-pencil-fill text-primary"></i>
                        </button>
                        <button className="btn btn-light btn-sm rounded-circle shadow-sm d-flex align-items-center justify-content-center" style={{ width: '35px', height: '35px' }} onClick={() => deleteUser(u.id)}>
                          <i className="bi bi-trash-fill text-danger"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal Tambah/Edit Kasir */}
      {showUserModal && (
        <>
          <div className="modal-backdrop fade show" style={{ backdropFilter: 'blur(5px)', backgroundColor: 'rgba(0,0,0,0.5)' }}></div>
          <div className="modal fade show d-block" tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered mx-3">
              <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '24px', overflow: 'hidden' }}>
                <div className="modal-header border-0 pb-0 pt-4 px-4">
                  <h5 className="fw-bold mb-0 text-primary">{editingUser ? 'Edit Akun Kasir' : 'Tambah Kasir Baru'}</h5>
                  <button type="button" className="btn-close" onClick={() => setShowUserModal(false)}></button>
                </div>
                <div className="modal-body p-4">
                  <form onSubmit={handleUserSave}>
                    <div className="mb-3">
                      <label className="small text-muted fw-bold mb-2">Nama Lengkap</label>
                      <input type="text" className="form-control border-0 bg-light rounded-4 px-3 py-3 fw-bold text-dark" id="fullname" value={userFormData.fullname} onChange={(e) => setUserFormData({ ...userFormData, fullname: e.target.value })} placeholder="Contoh: Budi Santoso" required />
                    </div>
                    <div className="mb-3">
                      <label className="small text-muted fw-bold mb-2">Username Login</label>
                      <input type="text" className="form-control border-0 bg-light rounded-4 px-3 py-3 fw-bold text-dark" id="username" value={userFormData.username} onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })} placeholder="Username untuk login" required />
                    </div>
                    <div className="mb-4">
                      <label className="small text-muted fw-bold mb-2">Password</label>
                      <input type="password" className="form-control border-0 bg-light rounded-4 px-3 py-3 fw-bold text-dark" id="password" onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })} placeholder="*****" required />
                    </div>
                    <button type="submit" className="btn btn-outline-primary w-100 rounded-pill fw-bold py-3 shadow-sm">
                      <i className="bi bi-check-circle me-2"></i>{editingUser ? 'Simpan Perubahan' : 'Simpan Kasir Baru'}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Setting;
