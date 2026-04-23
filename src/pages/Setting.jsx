import { useState } from 'react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import toast from 'react-hot-toast';

const Setting = ({ user }) => {
  const settings = useLiveQuery(() => db.settings.get(1));
  const users = useLiveQuery(() => db.users.where('role').equals('kasir').toArray());
  const [isEditing, setIsEditing] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userFormData, setUserFormData] = useState({ fullname: '', username: '', password: '', role: 'kasir' });
  const [formData, setFormData] = useState({
    namaLaundry: '',
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
      await db.settings.put({ ...formData, id: 1 });
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
        await db.users.update(editingUser.id, userFormData);
        toast.success('Data kasir diperbarui');
      } else {
        const existing = await db.users.where('username').equals(userFormData.username).first();
        if (existing) return toast.error('Username sudah digunakan');
        await db.users.add(userFormData);
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
      await db.users.delete(id);
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

  if (!settings) return <div className="p-5 text-center">Memuat pengaturan...</div>;

  return (
    <div className="setting-page pb-5" style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>

      <div className="px-3 pt-4">
        {/* Profile Card Header (Visual Only) */}

        <form onSubmit={handleSave}>
          {/* Section: Profil Laundry */}
          <div className="mb-4">
            <div className="d-flex justify-content-between align-items-center mb-3 px-1">
              <h6 className="fw-bold mb-0 text-dark small text-uppercase" style={{ letterSpacing: '1px' }}>Pengaturan Toko</h6>
              {!isEditing && user.role === 'owner' && (
                <button type="button" className="btn btn-primary btn-sm rounded-pill px-3 fw-bold" onClick={startEditing}>
                  <i className="bi bi-pencil-square me-1"></i> Edit
                </button>
              )}
            </div>

            <div className="card border-0 shadow-sm" style={{ borderRadius: '20px' }}>
              <div className="card-body p-0">
                <div className="p-3 border-bottom">
                  <label className="small text-muted mb-1 d-block fw-bold">Nama Laundry</label>
                  {isEditing ? (
                    <input
                      type="text"
                      className="form-control border-light bg-light"
                      value={formData.namaLaundry}
                      onChange={(e) => setFormData({ ...formData, namaLaundry: e.target.value })}
                      required
                    />
                  ) : (
                    <div className="fw-bold text-dark">{settings.namaLaundry}</div>
                  )}
                </div>
                <div className="p-3 border-bottom">
                  <div className="row g-3">
                    <div className="col-8">
                      <label className="small text-muted mb-1 d-block fw-bold">Alamat Toko</label>
                      {isEditing ? (
                        <textarea
                          className="form-control border-light bg-light"
                          rows="1"
                          value={formData.alamat}
                          onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
                          required
                        ></textarea>
                      ) : (
                        <div className="small text-dark">{settings.alamat}</div>
                      )}
                    </div>
                    <div className="col-4 ps-3 border-start">
                      <label className="small text-muted mb-1 d-block fw-bold">Kota</label>
                      {isEditing ? (
                        <input
                          type="text"
                          className="form-control border-light bg-light"
                          value={formData.kota}
                          onChange={(e) => setFormData({ ...formData, kota: e.target.value })}
                          required
                        />
                      ) : (
                        <div className="fw-bold text-dark">{settings.kota}</div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="p-3">
                  <div className="row g-3">
                    <div className="col-6">
                      <label className="small text-muted mb-1 d-block fw-bold">No. WA</label>
                      {isEditing ? (
                        <input
                          type="text"
                          className="form-control border-light bg-light"
                          value={formData.telepon}
                          onChange={(e) => setFormData({ ...formData, telepon: e.target.value })}
                        />
                      ) : (
                        <div className="fw-bold text-dark">{settings.telepon}</div>
                      )}
                    </div>
                    <div className="col-6 ps-3 border-start">
                      <label className="small text-muted mb-1 d-block fw-bold">Jam Buka</label>
                      {isEditing ? (
                        <input
                          type="text"
                          className="form-control border-light bg-light"
                          value={formData.jamBuka}
                          onChange={(e) => setFormData({ ...formData, jamBuka: e.target.value })}
                        />
                      ) : (
                        <div className="fw-bold text-dark">{settings.jamBuka}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Konfigurasi Struk */}
          <div className="mb-4">
            <h6 className="fw-bold mb-3 px-1 text-dark small text-uppercase" style={{ letterSpacing: '1px' }}>Konfigurasi Struk</h6>
            <div className="card border-0 shadow-sm" style={{ borderRadius: '20px' }}>
              <div className="card-body p-0">
                <div className="p-3 border-bottom">
                  <label className="small text-muted mb-1 d-block fw-bold">Pesan Header (Atas Struk)</label>
                  {isEditing ? (
                    <input
                      type="text"
                      className="form-control border-light bg-light"
                      value={formData.headerStruk}
                      onChange={(e) => setFormData({ ...formData, headerStruk: e.target.value })}
                    />
                  ) : (
                    <div className="small italic text-dark">{settings.headerStruk || '-'}</div>
                  )}
                </div>
                <div className="p-3 border-bottom">
                  <label className="small text-muted mb-1 d-block fw-bold">Pesan Footer (Bawah Struk)</label>
                  {isEditing ? (
                    <textarea
                      className="form-control border-light bg-light"
                      rows="2"
                      value={formData.footerStruk}
                      onChange={(e) => setFormData({ ...formData, footerStruk: e.target.value })}
                    ></textarea>
                  ) : (
                    <div className="small text-dark">{settings.footerStruk || '-'}</div>
                  )}
                </div>
                <div className="p-3 d-flex justify-content-between align-items-center">
                  <label className="small text-muted mb-0 fw-bold">Status Menerima Cucian</label>
                  <div className={`badge rounded-pill ${settings.menerimaCucian ? 'bg-success' : 'bg-danger'}`}>
                    {settings.menerimaCucian ? 'AKTIF' : 'TUTUP'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {isEditing && (
            <div className="d-flex gap-2 px-1">
              <button type="button" className="btn btn-light w-100 rounded-pill fw-bold py-2 shadow-sm" onClick={() => { setIsEditing(false); setFormData(settings); }}>
                Batal
              </button>
              <button type="submit" className="btn btn-primary w-100 rounded-pill fw-bold py-2 shadow-sm">
                Simpan
              </button>
            </div>
          )}
        </form>

        {/* Section: Manajemen Kasir (Hanya Owner) */}
        {user.role === 'owner' && (
          <div className="mt-5 mb-5">
            <div className="d-flex justify-content-between align-items-center mb-3 px-1">
              <h6 className="fw-bold mb-0 text-dark small text-uppercase" style={{ letterSpacing: '1px' }}>Manajemen Kasir</h6>
              <button className="btn btn-success btn-sm rounded-pill px-3 fw-bold" onClick={() => openUserModal()}>
                Tambah
              </button>

            </div>

            <div className="inventory-list">
              {users?.length === 0 ? (
                <div className="card border-0 shadow-sm rounded-4 p-4 text-center">
                  <i className="bi bi-people text-muted opacity-25 mb-2" style={{ fontSize: '2.5rem' }}></i>
                  <p className="text-muted small mb-0">Belum ada akun kasir</p>
                </div>
              ) : (
                users?.map(u => (
                  <div key={u.id} className="card border-0 shadow-sm rounded-4 mb-3 overflow-hidden">
                    <div className="card-body p-3 d-flex align-items-center justify-content-between">
                      <div className="d-flex align-items-center">
                        <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold text-white me-3 shadow-sm"
                          style={{ width: '45px', height: '45px', background: 'linear-gradient(135deg, #0134d4 0%, #2855e1 100%)', fontSize: '1rem' }}>
                          {u.fullname.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h6 className="fw-bold text-dark mb-0">{u.fullname}</h6>
                          <small className="text-muted">@{u.username}</small>
                        </div>
                      </div>
                      <div className="d-flex gap-2">
                        <button className="btn btn-light btn-sm rounded-circle shadow-sm" onClick={() => openUserModal(u)}>
                          <i className="bi bi-pencil text-primary"></i>
                        </button>
                        <button className="btn btn-light btn-sm rounded-circle shadow-sm" onClick={() => deleteUser(u.id)}>
                          <i className="bi bi-trash text-danger"></i>
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
          <div className="modal-backdrop fade show" style={{ backdropFilter: 'blur(10px)', backgroundColor: 'rgba(0,0,0,0.4)' }}></div>
          <div className="modal fade show d-block" tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered mx-3">
              <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '24px' }}>
                <div className="modal-header border-0 pb-0 pt-4 px-4">
                  <h5 className="fw-bold mb-0">{editingUser ? 'Edit Akun Kasir' : 'Tambah Kasir Baru'}</h5>
                  <button type="button" className="btn-close" onClick={() => setShowUserModal(false)}></button>
                </div>
                <div className="modal-body p-4">
                  <form onSubmit={handleUserSave}>
                    <div className="mb-3">
                      <label className="small fw-bold text-muted text-uppercase mb-2">Nama Lengkap</label>
                      <input
                        type="text"
                        className="form-control border-0 bg-light rounded-4 p-3"
                        value={userFormData.fullname}
                        onChange={(e) => setUserFormData({ ...userFormData, fullname: e.target.value })}
                        placeholder="Contoh: Budi Santoso"
                        required
                      />
                    </div>
                    <div className="mb-3">
                      <label className="small fw-bold text-muted text-uppercase mb-2">Username</label>
                      <input
                        type="text"
                        className="form-control border-0 bg-light rounded-4 p-3"
                        value={userFormData.username}
                        onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })}
                        placeholder="Username login"
                        required
                      />
                    </div>
                    <div className="mb-4">
                      <label className="small fw-bold text-muted text-uppercase mb-2">Password</label>
                      <input
                        type="password"
                        className="form-control border-0 bg-light rounded-4 p-3"
                        value={userFormData.password}
                        onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                        placeholder="••••••••"
                        required
                      />
                    </div>
                    <button type="submit" className="btn btn-outline-primary w-100 rounded-pill fw-bold py-3 shadow-sm">
                      {editingUser ? 'Simpan' : 'Simpan'}
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
