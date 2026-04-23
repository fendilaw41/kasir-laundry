import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import toast from 'react-hot-toast';

const Home = ({ user }) => {
  const navigate = useNavigate();
  const [showPelangganModal, setShowPelangganModal] = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [showOmzet, setShowOmzet] = useState(false);

  // State Form Pelanggan
  const [newPelanggan, setNewPelanggan] = useState({ nama: '', hp: '', alamat: '' });

  // Ambil data inventory
  const inventory = useLiveQuery(() => db.inventory.toArray());
  const pelangganList = useLiveQuery(() => db.pelanggan.toArray());

  const [searchPelanggan, setSearchPelanggan] = useState('');
  const [searchInventory, setSearchInventory] = useState('');

  // Update Stok Inventory
  const handleUpdateStok = async (id, delta) => {
    const item = await db.inventory.get(id);
    if (item) {
      await db.inventory.update(id, { stok: Math.max(0, item.stok + delta) });
    }
  };

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
    }
  });

  const handleSelectPelanggan = (pelanggan) => {
    localStorage.setItem('activePelanggan', JSON.stringify(pelanggan));
    setShowPelangganModal(false);
    navigate('/transaksi');
  };

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
        <div className="col-3 text-center">
          <Link to="/setting" className="text-decoration-none">
            <div className="bg-white shadow-sm rounded-circle mx-auto mb-2 d-flex align-items-center justify-content-center" style={{ width: '55px', height: '55px' }}>
              <i className="bi bi-gear-fill fs-4 text-primary"></i>
            </div>
            <small className="text-dark fw-bold" style={{ fontSize: '0.7rem' }}>Setting</small>
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

      {/* Modal Pelanggan (Search & Add) */}
      {showPelangganModal && (
        <>
          <div className="modal-backdrop fade show" style={{ backdropFilter: 'blur(15px)', backgroundColor: 'rgba(255,255,255,0.7)' }}></div>
          <div className="modal fade show d-block" tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable mx-2" style={{ maxWidth: '450px' }}>
              <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '28px', height: '90vh' }}>
                <div className="modal-header border-0 pb-0 pt-4 px-4">
                  <div>
                    <h5 className="fw-bold mb-0 text-success">Data Pelanggan</h5>
                    <small className="text-muted">Manajemen pelanggan laundry anda</small>
                  </div>
                  <button type="button" className="btn-close" onClick={() => setShowPelangganModal(false)}></button>
                </div>
                <div className="modal-body p-3 p-sm-4">
                  {/* Form Tambah Baru (Collapsible) */}
                  <div className="mb-4">
                    <button className="btn btn-success w-100 rounded-pill fw-bold py-2 mb-3 shadow-sm" type="button" data-bs-toggle="collapse" data-bs-target="#collapseAddPelanggan">
                      <i className="bi bi-person-plus me-2"></i> Pelanggan Baru
                    </button>
                    <div className="collapse" id="collapseAddPelanggan">
                      <div className="card card-body border-0 bg-light rounded-4 p-3 mb-3 shadow-inner">
                        <form onSubmit={handleAddPelanggan}>
                          <div className="mb-2">
                            <input type="text" className="form-control border-0 py-2 rounded-3" placeholder="Nama Lengkap" value={newPelanggan.nama} onChange={(e) => setNewPelanggan({ ...newPelanggan, nama: e.target.value })} required />
                          </div>
                          <div className="mb-2">
                            <input type="tel" className="form-control border-0 py-2 rounded-3" placeholder="No. WhatsApp" value={newPelanggan.hp} onChange={(e) => setNewPelanggan({ ...newPelanggan, hp: e.target.value })} required />
                          </div>
                          <div className="mb-3">
                            <textarea className="form-control border-0 py-2 rounded-3" placeholder="Alamat (Kota)" rows="2" value={newPelanggan.alamat} onChange={(e) => setNewPelanggan({ ...newPelanggan, alamat: e.target.value })}></textarea>
                          </div>
                          <button type="submit" className="btn btn-primary w-100 rounded-pill fw-bold shadow-sm">SIMPAN DATA</button>
                        </form>
                      </div>
                    </div>
                  </div>

                  {/* Search Bar */}
                  <div className="position-relative mb-4">
                    <i className="bi bi-search position-absolute top-50 start-0 translate-middle-y ms-3 text-muted opacity-50"></i>
                    <input
                      type="text"
                      className="form-control ps-5 border-0 bg-light rounded-pill py-2"
                      placeholder="Cari nama atau no. whatsapp..."
                      value={searchPelanggan}
                      onChange={(e) => setSearchPelanggan(e.target.value)}
                    />
                  </div>

                  {/* List Pelanggan Terdaftar */}
                  <div className="pelanggan-list">
                    {pelangganList?.filter(p =>
                      p.nama.toLowerCase().includes(searchPelanggan.toLowerCase()) ||
                      p.hp.includes(searchPelanggan)
                    ).length === 0 ? (
                      <div className="text-center py-5">
                        <i className="bi bi-people text-muted opacity-25" style={{ fontSize: '3rem' }}></i>
                        <p className="text-muted small mt-2">Tidak ada pelanggan ditemukan</p>
                      </div>
                    ) : (
                      pelangganList?.filter(p =>
                        p.nama.toLowerCase().includes(searchPelanggan.toLowerCase()) ||
                        p.hp.includes(searchPelanggan)
                      ).sort((a, b) => b.id - a.id).map(p => (
                        <div
                          key={p.id}
                          className="card border-0 mb-3 rounded-4 shadow-sm customer-card-clickable"
                          style={{ background: '#fff', cursor: 'pointer', transition: 'all 0.2s ease' }}
                          onClick={() => handleSelectPelanggan(p)}
                        >
                          <div className="card-body p-3 d-flex align-items-center">
                            <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold text-white me-3"
                              style={{ width: '48px', height: '48px', background: 'linear-gradient(135deg, #0134d4 0%, #2855e1 100%)', fontSize: '1.2rem', boxShadow: '0 4px 10px rgba(1, 52, 212, 0.2)' }}>
                              {p.nama.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-grow-1 overflow-hidden">
                              <h6 className="mb-0 fw-bold text-dark text-truncate">{p.nama}</h6>
                              <div className="text-muted d-flex align-items-center gap-1" style={{ fontSize: '0.75rem' }}>
                                <i className="bi bi-whatsapp text-success"></i> {p.hp}
                              </div>
                            </div>
                            <div className="ms-2">
                              <i className="bi bi-arrow-right-circle text-primary fs-5 opacity-50"></i>
                            </div>
                          </div>
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

      {/* Modal Inventory (Stock Management) */}
      {showInventoryModal && (
        <>
          <div className="modal-backdrop fade show" style={{ backdropFilter: 'blur(15px)', backgroundColor: 'rgba(255,255,255,0.7)' }}></div>
          <div className="modal fade show d-block" tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable mx-2" style={{ maxWidth: '450px' }}>
              <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '28px', height: '90vh' }}>
                <div className="modal-header border-0 pb-0 pt-4 px-4">
                  <div>
                    <h5 className="fw-bold mb-0 text-success">Inventaris Barang</h5>
                    <small className="text-muted">Atur stok kebutuhan laundry</small>
                  </div>
                  <button type="button" className="btn-close" onClick={() => setShowInventoryModal(false)}></button>
                </div>
                <div className="modal-body p-3 p-sm-4">
                  {/* Tambah Stok Baru Quick Form */}
                  <div className="bg-light p-3 rounded-4 mb-4">
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      const form = e.target;
                      const nama = form.nama.value;
                      const stok = parseInt(form.stok.value);
                      await db.inventory.add({ nama, stok });
                      form.reset();
                      toast.success('Barang baru telah ditambahkan');
                    }}>
                      <label className="small fw-bold text-muted mb-2 px-1">TAMBAH BARANG BARU</label>
                      <div className="row g-2">
                        <div className="col-8">
                          <input type="text" name="nama" className="form-control border-0 py-2 rounded-3 shadow-sm" placeholder="Nama item..." required />
                        </div>
                        <div className="col-4">
                          <div className="input-group shadow-sm rounded-3 overflow-hidden">
                            <input type="number" name="stok" className="form-control border-0 py-2 px-2 text-center" placeholder="Qty" required />
                            <button className="btn btn-success border-0 px-2" type="submit">
                              <i className="bi bi-plus-lg"></i>
                            </button>
                          </div>
                        </div>
                      </div>
                    </form>
                  </div>

                  {/* Search Bar Inventory */}
                  <div className="position-relative mb-4">
                    <i className="bi bi-search position-absolute top-50 start-0 translate-middle-y ms-3 text-muted opacity-50"></i>
                    <input
                      type="text"
                      className="form-control ps-5 border-0 bg-light rounded-pill py-2"
                      placeholder="Cari item barang..."
                      value={searchInventory}
                      onChange={(e) => setSearchInventory(e.target.value)}
                    />
                  </div>

                  {/* Daftar Item Inventory */}
                  <div className="inventory-list">
                    {inventory?.filter(item => item.nama.toLowerCase().includes(searchInventory.toLowerCase())).map(item => (
                      <div key={item.id} className="card border-0 mb-3 rounded-4 shadow-sm overflow-hidden" style={{ background: '#fff' }}>
                        <div className="card-body p-3 d-flex justify-content-between align-items-center">
                          <div className="d-flex align-items-center">
                            <div className="rounded-4 bg-light d-flex align-items-center justify-content-center me-3" style={{ width: '45px', height: '45px' }}>
                              <i className={`bi ${item.nama.toLowerCase().includes('plastik') ? 'bi-box' : 'bi-archive'} text-success fs-4`}></i>
                            </div>
                            <div>
                              <h6 className="fw-bold mb-1 text-dark">{item.nama}</h6>
                              <span className={`badge rounded-pill ${item.stok < 5 ? 'bg-danger bg-opacity-10 text-white' : 'bg-success bg-opacity-10 text-white'}`} style={{ fontSize: '0.65rem' }}>
                                Stok: {item.stok}
                              </span>
                            </div>
                          </div>

                          <div className="d-flex align-items-center gap-2 bg-light rounded-pill p-1">
                            <button
                              className="btn btn-sm btn-white rounded-circle shadow-sm border-0 d-flex align-items-center justify-content-center"
                              style={{ width: '28px', height: '28px', backgroundColor: '#fff' }}
                              onClick={() => handleUpdateStok(item.id, -1)}
                            >
                              <i className="bi bi-dash text-dark"></i>
                            </button>
                            <span className="fw-bold text-dark px-1" style={{ fontSize: '0.9rem', minWidth: '20px', textAlign: 'center' }}>{item.stok}</span>
                            <button
                              className="btn btn-sm btn-white rounded-circle shadow-sm border-0 d-flex align-items-center justify-content-center"
                              style={{ width: '28px', height: '28px', backgroundColor: '#fff' }}
                              onClick={() => handleUpdateStok(item.id, 1)}
                            >
                              <i className="bi bi-plus text-dark"></i>
                            </button>
                          </div>
                        </div>
                        {/* Danger Indicator Line */}
                        {item.stok < 5 && <div style={{ height: '3px', backgroundColor: '#ff5252', width: '100%' }}></div>}
                      </div>
                    ))}
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
