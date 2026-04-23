import { useState } from 'react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import toast from 'react-hot-toast';

const Setting = () => {
  const settings = useLiveQuery(() => db.settings.get(1));
  const [isEditing, setIsEditing] = useState(false);
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
      toast.success('Pengaturan berhasil diperbarui', {
        position: 'bottom-center',
        style: { borderRadius: '12px', background: '#333', color: '#fff' }
      });
    } catch (err) {
      console.error(err);
      toast.error('Gagal memperbarui pengaturan');
    }
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
              {!isEditing && (
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
      </div>
    </div>
  );
};

export default Setting;
