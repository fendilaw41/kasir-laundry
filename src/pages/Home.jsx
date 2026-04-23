import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import toast from 'react-hot-toast';

const Home = ({ user }) => {
  const [showPelangganModal, setShowPelangganModal] = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [showOmzet, setShowOmzet] = useState(false);

  // State Form Pelanggan
  const [newPelanggan, setNewPelanggan] = useState({ nama: '', hp: '', alamat: '' });

  // State Form Inventory
  const [newInv, setNewInv] = useState({ nama: '', stok: '' });

  // Ambil data inventory
  const inventory = useLiveQuery(() => db.inventory.toArray());

  // Ambil statistik singkat
  const stats = useLiveQuery(async () => {
    const allOrders = await db.orders.toArray();
    const today = new Date().toLocaleDateString();
    const todayOrders = allOrders.filter(o => new Date(o.createdAt).toLocaleDateString() === today);

    const totalOmzet = todayOrders.reduce((acc, o) => acc + o.total, 0);
    const pendingOrders = allOrders.filter(o => o.status === 'Proses').length;
    const readyToPickUp = allOrders.filter(o => o.status === 'Selesai').length;

    return {
      totalOmzet,
      orderHariIni: todayOrders.length,
      pendingOrders,
      readyToPickUp
    };
  });

  const handleAddPelanggan = async (e) => {
    e.preventDefault();

    // Validasi Duplikat
    const existing = await db.pelanggan
      .where('nama').equalsIgnoreCase(newPelanggan.nama)
      .or('hp').equals(newPelanggan.hp)
      .first();

    if (existing) {
      toast.error('Gagal! Nama atau No. HP sudah terdaftar.');
      return;
    }

    await db.pelanggan.add(newPelanggan);
    toast.success('Pelanggan berhasil ditambahkan');
    setNewPelanggan({ nama: '', hp: '', alamat: '' });
    setShowPelangganModal(false);
  };

  const handleAddInventory = async (e) => {
    e.preventDefault();

    // Validasi Duplikat
    const existing = await db.inventory
      .where('nama').equalsIgnoreCase(newInv.nama)
      .first();

    if (existing) {
      toast.error('Barang sudah ada di inventory!');
      return;
    }

    await db.inventory.add({
      nama: newInv.nama,
      stok: parseInt(newInv.stok)
    });
    toast.success('Inventory berhasil ditambahkan');
    setNewInv({ nama: '', stok: '' });
  };

  const deleteInventory = async (id) => {
    if (window.confirm('Hapus item ini dari inventory?')) {
      await db.inventory.delete(id);
      toast.success('Item dihapus');
    }
  };

  return (
    <div className="home-wrapper pb-5">
      {/* Kartu Profil & Welcome */}
      <div className="card shadow-sm border-0 mb-4 overflow-hidden" style={{ borderRadius: '20px', background: 'linear-gradient(135deg, #0134d4 0%, #2855e1 100%)' }}>
        <div className="card-body p-4 text-white">
          <div className="d-flex align-items-center mb-3">
            <div className="avatar-wrapper me-3">
              <div className="bg-white rounded-circle d-flex align-items-center justify-content-center" style={{ width: '60px', height: '60px' }}>
                <i className="bi bi-person-fill text-primary fs-2"></i>
              </div>
            </div>
            <div>
              <small className="opacity-75 d-block">Selamat Datang,</small>
              <h4 className="text-white fw-bold mb-0">{user.fullname}</h4>
              <small className="opacity-50">@{user.username}</small>
            </div>
          </div>
          <div className="row g-2 mt-2">
            <div className="col-6">
              <div className="bg-white bg-opacity-10 rounded p-2 text-center">
                <small className="d-block opacity-75">Status</small>
                <span className="fw-bold"><i className="bi bi-patch-check-fill me-1"></i> Aktif</span>
              </div>
            </div>
            <div className="col-6">
              <div className="bg-white bg-opacity-10 rounded p-2 text-center">
                <small className="d-block opacity-75">Shift</small>
                <span className="fw-bold">{new Date().getHours() >= 18 ? 'Malam' : 'Siang'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Statistik Ringkas */}
      <h6 className="fw-bold mb-3 px-1">Ringkasan Hari Ini</h6>
      <div className="row g-2 mb-4 px-1">
        <div className="col-4">
          <div className="card shadow-sm border-0 h-100 position-relative" style={{ borderRadius: '15px' }}>
            <i 
              className={`bi ${showOmzet ? 'bi-eye-slash' : 'bi-eye'} text-muted position-absolute`} 
              style={{ top: '8px', right: '8px', cursor: 'pointer', fontSize: '0.75rem', zIndex: 10 }}
              onClick={() => setShowOmzet(!showOmzet)}
            ></i>
            <Link to="/reports?today=true" className="text-decoration-none text-dark h-100">
              <div className="card-body p-2 text-center">
                <div className="icon-circle bg-success-light text-success mb-2 mx-auto" style={{ width: '35px', height: '35px', backgroundColor: '#d1f7e0', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="bi bi-wallet2 fs-5"></i>
                </div>
                <small className="text-muted d-block" style={{ fontSize: '0.65rem' }}>Omzet</small>
                <h6 className="fw-bold mb-0" style={{ fontSize: '0.8rem' }}>
                  {showOmzet ? `Rp ${stats?.totalOmzet.toLocaleString() || 0}` : 'Rp ••••••'}
                </h6>
              </div>
            </Link>
          </div>
        </div>
        <div className="col-4">
          <Link to="/orders?tab=Proses" className="text-decoration-none text-dark">
            <div className="card shadow-sm border-0 h-100" style={{ borderRadius: '15px' }}>
              <div className="card-body p-2 text-center">
                <div className="icon-circle bg-primary-light text-primary mb-2 mx-auto" style={{ width: '35px', height: '35px', backgroundColor: '#e1f5fe', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="bi bi-bag-check fs-5"></i>
                </div>
                <small className="text-muted d-block" style={{ fontSize: '0.65rem' }}>Proses</small>
                <h6 className="fw-bold mb-0" style={{ fontSize: '0.8rem' }}>{stats?.pendingOrders || 0} Item</h6>
              </div>
            </div>
          </Link>
        </div>
        <div className="col-4">
          <Link to="/orders?tab=Selesai" className="text-decoration-none text-dark">
            <div className="card shadow-sm border-0 h-100" style={{ borderRadius: '15px' }}>
              <div className="card-body p-2 text-center">
                <div className="icon-circle bg-warning-light text-warning mb-2 mx-auto" style={{ width: '35px', height: '35px', backgroundColor: '#fff9c4', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="bi bi-box-seam fs-5"></i>
                </div>
                <small className="text-muted d-block" style={{ fontSize: '0.65rem' }}>Siap</small>
                <h6 className="fw-bold mb-0" style={{ fontSize: '0.8rem' }}>{stats?.readyToPickUp || 0} Item</h6>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Menu Cepat / Shortcut */}
      <h6 className="fw-bold mb-3 px-1">Menu Utama</h6>
      <div className="row g-3 mb-4 px-1">
        <div className="col-3 text-center">
          <Link to="/cari" className="text-decoration-none">
            <div className="bg-white shadow-sm rounded-circle mx-auto mb-2 d-flex align-items-center justify-content-center" style={{ width: '55px', height: '55px' }}>
              <i className="bi bi-plus-lg fs-4 text-primary"></i>
            </div>
            <small className="text-dark fw-bold" style={{ fontSize: '0.7rem' }}>Baru</small>
          </Link>
        </div>
        <div className="col-3 text-center" onClick={() => setShowInventoryModal(true)} style={{ cursor: 'pointer' }}>
          <div className="bg-white shadow-sm rounded-circle mx-auto mb-2 d-flex align-items-center justify-content-center" style={{ width: '55px', height: '55px' }}>
            <i className="bi bi-box-seam fs-4 text-success"></i>
          </div>
          <small className="text-dark fw-bold" style={{ fontSize: '0.7rem' }}>Inventory</small>
        </div>
        <div className="col-3 text-center" onClick={() => setShowPelangganModal(true)} style={{ cursor: 'pointer' }}>
          <div className="bg-white shadow-sm rounded-circle mx-auto mb-2 d-flex align-items-center justify-content-center" style={{ width: '55px', height: '55px' }}>
            <i className="bi bi-person-plus fs-4 text-info"></i>
          </div>
          <small className="text-dark fw-bold" style={{ fontSize: '0.7rem' }}>Pelanggan</small>
        </div>
        <div className="col-3 text-center">
          <Link to="/reports" className="text-decoration-none">
            <div className="bg-white shadow-sm rounded-circle mx-auto mb-2 d-flex align-items-center justify-content-center" style={{ width: '55px', height: '55px' }}>
              <i className="bi bi-file-earmark-bar-graph fs-4 text-warning"></i>
            </div>
            <small className="text-dark fw-bold" style={{ fontSize: '0.7rem' }}>Report</small>
          </Link>
        </div>
      </div>

      {/* Order dalam Proses Alert */}
      {stats?.pendingOrders > 0 && (
        <div className="alert alert-warning border-0 shadow-sm d-flex align-items-center mx-1" style={{ borderRadius: '12px' }}>
          <i className="bi bi-exclamation-triangle-fill fs-4 me-3"></i>
          <div>
            <h6 className="alert-heading mb-1 fw-bold">Ada {stats.pendingOrders} Order Tertunda</h6>
            <p className="small mb-0">Segera selesaikan pengerjaan laundry hari ini.</p>
          </div>
        </div>
      )}

      {/* Modal Tambah Pelanggan */}
      {showPelangganModal && (
        <>
          <div className="modal-backdrop fade show"></div>
          <div className="modal fade show d-block" tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered mx-3">
              <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '20px' }}>
                <div className="modal-header border-0 pb-0">
                  <h5 className="fw-bold mb-0">Tambah Pelanggan</h5>
                  <button type="button" className="btn-close" onClick={() => setShowPelangganModal(false)}></button>
                </div>
                <div className="modal-body p-4">
                  <form onSubmit={handleAddPelanggan}>
                    <div className="mb-3">
                      <label className="small fw-bold text-muted mb-1">Nama Lengkap</label>
                      <input type="text" className="form-control" value={newPelanggan.nama} onChange={e => setNewPelanggan({ ...newPelanggan, nama: e.target.value })} required />
                    </div>
                    <div className="mb-3">
                      <label className="small fw-bold text-muted mb-1">No. WhatsApp</label>
                      <input type="tel" className="form-control" value={newPelanggan.hp} onChange={e => setNewPelanggan({ ...newPelanggan, hp: e.target.value })} required />
                    </div>
                    <div className="mb-4">
                      <label className="small fw-bold text-muted mb-1">Alamat (Opsional)</label>
                      <textarea className="form-control" rows="2" value={newPelanggan.alamat} onChange={e => setNewPelanggan({ ...newPelanggan, alamat: e.target.value })}></textarea>
                    </div>
                    <button type="submit" className="btn btn-primary w-100 py-2 fw-bold">SIMPAN PELANGGAN</button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal Inventory */}
      {showInventoryModal && (
        <>
          <div className="modal-backdrop fade show"></div>
          <div className="modal fade show d-block" tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered mx-3 modal-dialog-scrollable" style={{ maxHeight: '90vh' }}>
              <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '20px' }}>
                <div className="modal-header border-0 pb-0">
                  <h5 className="fw-bold mb-0">Manajemen Inventory</h5>
                  <button type="button" className="btn-close" onClick={() => setShowInventoryModal(false)}></button>
                </div>
                <div className="modal-body p-4">
                  {/* Form Tambah */}
                  <form onSubmit={handleAddInventory} className="bg-light p-3 rounded mb-4 border">
                    <h6 className="small fw-bold mb-3">TAMBAH STOK BARANG</h6>
                    <div className="mb-2">
                      <input type="text" className="form-control form-control-sm" placeholder="Nama Barang (ex: Plastik)" value={newInv.nama} onChange={e => setNewInv({ ...newInv, nama: e.target.value })} required />
                    </div>
                    <div className="d-flex gap-2">
                      <input type="number" className="form-control form-control-sm" placeholder="Stok" value={newInv.stok} onChange={e => setNewInv({ ...newInv, stok: e.target.value })} required />
                      <button type="submit" className="btn btn-success btn-sm px-3">TAMBAH</button>
                    </div>
                  </form>

                  {/* List Inventory */}
                  <h6 className="small fw-bold mb-2">DAFTAR INVENTORY</h6>
                  <div className="list-group list-group-flush">
                    {inventory?.length === 0 ? (
                      <p className="text-center text-muted py-3 small">Belum ada data barang</p>
                    ) : (
                      inventory?.map(inv => (
                        <div key={inv.id} className="list-group-item px-0 py-2 d-flex justify-content-between align-items-center">
                          <div>
                            <div className="fw-bold small">{inv.nama}</div>
                            <small className={`badge ${inv.stok <= 5 ? 'bg-danger' : 'bg-success'}`}>Stok: {inv.stok}</small>
                          </div>
                          <button className="btn btn-link text-danger p-0" onClick={() => deleteInventory(inv.id)}>
                            <i className="bi bi-trash fs-5"></i>
                          </button>
                        </div>
                      ))
                    )}
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

export default Home;
