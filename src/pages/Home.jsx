import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useHome } from './hooks/useHome';

const Home = ({ user }) => {
  const {
    showPelangganModal, setShowPelangganModal,
    showInventoryModal, setShowInventoryModal,
    showOmzet, setShowOmzet,
    confirmModal, setConfirmModal,
    editPelanggan, setEditPelanggan,
    newPelanggan, setNewPelanggan,
    inventory, pelangganList,
    searchPelanggan, setSearchPelanggan,
    searchInventory, setSearchInventory,
    inventoryTab, setInventoryTab,
    handleUpdateStok, handleApproveInventory, handleRejectInventory,
    stats, handleSelectPelanggan, handleAddPelanggan,
    updatePelanggan, addInventoryManual
  } = useHome();

  return (
    <div className="home-wrapper pb-5">
      {/* Modal Konfirmasi Bawaan */}
      {confirmModal.show && (
        <>
          <div className="modal-backdrop fade show" style={{ backdropFilter: 'blur(5px)', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1075 }}></div>
          <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1080 }}>
            <div className="modal-dialog modal-dialog-centered mx-auto" style={{ maxWidth: '320px' }}>
              <div className="modal-content border-0 shadow-lg text-center p-4" style={{ borderRadius: '24px' }}>
                <h6 className="fw-bold mb-2">Konfirmasi</h6>
                <p className="text-muted small mb-4" style={{ whiteSpace: 'pre-wrap' }}>{confirmModal.message}</p>
                <div className="d-flex gap-2">
                  <button className="btn btn-outline-primary rounded-pill flex-fill fw-bold" onClick={() => setConfirmModal({ show: false, message: '', onConfirm: null })}>Batal</button>
                  <button className="btn btn-outline-primary rounded-pill flex-fill fw-bold" onClick={confirmModal.onConfirm}>Ya, Lanjutkan</button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Top Background Section (ShopeePay Style) */}
      <div style={{ background: 'linear-gradient(135deg, #0134d4 0%, #2855e1 100%)', padding: '24px 20px 65px 20px', borderBottomLeftRadius: '32px', borderBottomRightRadius: '32px' }}>
        {/* Header Compact */}
        <div className="d-flex justify-content-between align-items-center mb-0">
          <div className="d-flex align-items-center">
            <div className="bg-white text-primary rounded-circle d-flex align-items-center justify-content-center me-3 shadow-sm flex-shrink-0" style={{ width: '48px', height: '48px' }}>
              <i className="bi bi-person-fill fs-3"></i>
            </div>
            <div>
              <h5 className="fw-bold mb-0 text-white">{user.fullname}</h5>
              <small className="text-white opacity-75">@{user.username}</small>
            </div>
          </div>
          <div className="bg-white text-success px-3 py-1 rounded-pill fw-bold d-flex align-items-center shadow-sm" style={{ fontSize: '0.8rem' }}>
            <i className="bi bi-patch-check-fill me-1"></i> Aktif
          </div>
        </div>
      </div>

      {/* Overlapping Cards (Omzet & Status) */}
      <div style={{ marginTop: '-45px', position: 'relative', zIndex: 5 }}>
        <div className="row g-2 px-3">
          {/* Omzet Card */}
          <div className="col-6">
            <div className="card shadow-sm border-0 h-100 position-relative" style={{ borderRadius: '16px', background: '#fff' }}>
              <i
                className={`bi ${showOmzet ? 'bi-eye-slash' : 'bi-eye'} text-muted position-absolute`}
                style={{ top: '12px', right: '12px', cursor: 'pointer', fontSize: '1rem', zIndex: 10 }}
                onClick={() => setShowOmzet(!showOmzet)}
              ></i>
              <Link to="/reports?today=true" className="text-decoration-none text-dark h-100">
                <div className="card-body p-3">
                  <div className="d-flex align-items-center mb-1">
                    <i className="bi bi-wallet2 text-success me-2"></i>
                    <small className="text-muted fw-bold" style={{ fontSize: '0.7rem' }}>Omzet</small>
                  </div>
                  <h6 className="fw-bold mb-0 text-dark mt-2" style={{ letterSpacing: '-0.5px' }}>
                    {showOmzet ? `Rp ${stats?.totalOmzet.toLocaleString() || 0}` : 'Rp ••••••'}
                  </h6>
                </div>
              </Link>
            </div>
          </div>
          {/* Status Order Card */}
          <div className="col-6">
            <div className="card shadow-sm border-0 h-100" style={{ borderRadius: '16px', background: '#fff' }}>
              <div className="card-body p-3">
                <div className="d-flex align-items-center mb-1">
                  <i className="bi bi-clipboard-data text-primary me-2"></i>
                  <small className="text-muted fw-bold" style={{ fontSize: '0.7rem' }}>Status</small>
                </div>
                <div className="d-flex justify-content-between mt-2">
                  <div className="text-center">
                    <h6 className="fw-bold mb-0 text-dark">{stats?.pendingOrders || 0}</h6>
                    <small className="text-muted" style={{ fontSize: '0.65rem' }}>Proses</small>
                  </div>
                  <div className="text-center">
                    <h6 className="fw-bold mb-0 text-dark">{stats?.readyToPickUp || 0}</h6>
                    <small className="text-muted" style={{ fontSize: '0.65rem' }}>Siap</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Menu Icons (White Area) */}
      <div className="card shadow-sm border-0 mt-4 mx-3" style={{ borderRadius: '20px', background: '#fff' }}>
        <div className="card-body p-4">
          <div className="row g-2 text-center align-items-start">
            
            {/* Proses */}
            <div className="col-3">
              <Link to="/orders?tab=Proses" className="text-decoration-none customer-card-clickable d-block">
                <div className="mx-auto text-primary rounded-1 d-flex align-items-center justify-content-center mb-2 shadow-sm flex-shrink-0" style={{ width: '45px', height: '45px', backgroundColor: '#e3f2fd', border: '1px solid #bbdefb' }}>
                  <i className="bi bi-bag-check fs-5"></i>
                </div>
                <span className="d-block text-nowrap" style={{ fontSize: '0.65rem', lineHeight: '1.2', color: '#4a4a4a', overflow: 'hidden', textOverflow: 'ellipsis' }}>Order<br/>Proses</span>
              </Link>
            </div>

            {/* Siap Ambil */}
            <div className="col-3">
              <Link to="/orders?tab=Selesai" className="text-decoration-none customer-card-clickable d-block">
                <div className="mx-auto text-primary rounded-1 border-1 d-flex align-items-center justify-content-center mb-2 shadow-sm flex-shrink-0" style={{ width: '45px', height: '45px', backgroundColor: '#e3f2fd', border: '1px solid #bbdefb' }}>
                  <i className="bi bi-box-seam fs-5"></i>
                </div>
                <span className="d-block text-nowrap" style={{ fontSize: '0.65rem', lineHeight: '1.2', color: '#4a4a4a', overflow: 'hidden', textOverflow: 'ellipsis' }}>Siap<br/>Ambil</span>
              </Link>
            </div>

            {/* Inventory */}
            <div className="col-3">
              <div className="text-decoration-none customer-card-clickable d-block" onClick={() => setShowInventoryModal(true)} style={{ cursor: 'pointer' }}>
                <div className="mx-auto text-primary rounded-1 d-flex align-items-center justify-content-center mb-2 shadow-sm flex-shrink-0" style={{ width: '45px', height: '45px', backgroundColor: '#e3f2fd', border: '1px solid #bbdefb' }}>
                  <i className="bi bi-archive fs-5"></i>
                </div>
                <span className="d-block text-nowrap" style={{ fontSize: '0.65rem', lineHeight: '1.2', color: '#4a4a4a', overflow: 'hidden', textOverflow: 'ellipsis' }}>Stok</span>
              </div>
            </div>

            {/* Pelanggan */}
            <div className="col-3">
              <div className="text-decoration-none customer-card-clickable d-block" onClick={() => setShowPelangganModal(true)} style={{ cursor: 'pointer' }}>
                <div className="mx-auto text-primary rounded-1 d-flex align-items-center justify-content-center mb-2 shadow-sm flex-shrink-0" style={{ width: '45px', height: '45px', backgroundColor: '#e3f2fd', border: '1px solid #bbdefb' }}>
                  <i className="bi bi-people fs-5"></i>
                </div>
                <span className="d-block text-nowrap" style={{ fontSize: '0.65rem', lineHeight: '1.2', color: '#4a4a4a', overflow: 'hidden', textOverflow: 'ellipsis' }}>Cust.</span>
              </div>
            </div>

            {/* Report */}
              <div className="col-3">
                <Link to="/reports" className="text-decoration-none customer-card-clickable d-block">
                  <div className="mx-auto text-primary rounded-1 d-flex align-items-center justify-content-center mb-2 shadow-sm flex-shrink-0" style={{ width: '45px', height: '45px', backgroundColor: '#e3f2fd', border: '1px solid #bbdefb' }}>
                    <i className="bi bi-bar-chart-fill fs-5"></i>
                  </div>
                  <span className="d-block text-nowrap" style={{ fontSize: '0.65rem', lineHeight: '1.2', color: '#4a4a4a', overflow: 'hidden', textOverflow: 'ellipsis' }}>Laporan</span>
                </Link>
              </div>

            {/* Setting */}
            <div className="col-3">
              <Link to="/setting" className="text-decoration-none customer-card-clickable d-block">
                <div className="mx-auto text-primary rounded-1 d-flex align-items-center justify-content-center mb-2 shadow-sm flex-shrink-0" style={{ width: '45px', height: '45px', backgroundColor: '#e3f2fd', border: '1px solid #bbdefb' }}>
                  <i className="bi bi-gear-fill fs-5"></i>
                </div>
                <span className="d-block text-nowrap" style={{ fontSize: '0.65rem', lineHeight: '1.2', color: '#4a4a4a', overflow: 'hidden', textOverflow: 'ellipsis' }}>Setting</span>
              </Link>
            </div>

            {/* Layanan (Hanya Owner) */}
            {user?.role === 'owner' && (
              <div className="col-3">
                <div className="text-decoration-none customer-card-clickable d-block" onClick={() => toast('Fitur Layanan/Produk segera hadir!', { icon: '🚀' })} style={{ cursor: 'pointer' }}>
                  <div className="mx-auto text-primary rounded-1 d-flex align-items-center justify-content-center mb-2 shadow-sm flex-shrink-0" style={{ width: '45px', height: '45px', backgroundColor: '#e3f2fd', border: '1px solid #bbdefb' }}>
                    <i className="bi bi-grid fs-5"></i>
                  </div>
                  <span className="d-block text-nowrap" style={{ fontSize: '0.65rem', lineHeight: '1.2', color: '#4a4a4a', overflow: 'hidden', textOverflow: 'ellipsis' }}>Layanan</span>
                </div>
              </div>
            )}

            {/* Promo (Hanya Owner) */}
            {user?.role === 'owner' && (
              <div className="col-3">
                <div className="text-decoration-none customer-card-clickable d-block" onClick={() => toast('Fitur Promo segera hadir!', { icon: '🚀' })} style={{ cursor: 'pointer' }}>
                  <div className="mx-auto text-primary rounded-1 d-flex align-items-center justify-content-center mb-2 shadow-sm flex-shrink-0" style={{ width: '45px', height: '45px', backgroundColor: '#e3f2fd', border: '1px solid #bbdefb' }}>
                    <i className="bi bi-percent fs-5"></i>
                  </div>
                  <span className="d-block text-nowrap" style={{ fontSize: '0.65rem', lineHeight: '1.2', color: '#4a4a4a', overflow: 'hidden', textOverflow: 'ellipsis' }}>Promo</span>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Order dalam Proses Alert */}
      {stats?.pendingOrders > 0 && (
        <div className="alert alert-warning border-0 shadow-sm d-flex align-items-center mx-3 mt-3" style={{ borderRadius: '12px' }}>
          <i className="bi bi-exclamation-triangle-fill fs-4 me-3"></i>
          <div>
            <h6 className="alert-heading mb-1 fw-bold">Ada {stats.pendingOrders} Order Tertunda</h6>
            <p className="small mb-0">Segera selesaikan pengerjaan laundry hari ini.</p>
          </div>
        </div>
      )}

      {/* Inventory Pending Alert (Khusus Owner) */}
      {user?.role === 'owner' && inventory?.filter(i => i.status === 'pending').length > 0 && (
        <div 
          className="alert alert-info border-0 shadow-sm d-flex align-items-center mx-3 mt-3" 
          style={{ borderRadius: '12px', cursor: 'pointer', backgroundColor: '#e3f2fd' }}
          onClick={() => {
            setInventoryTab('pending');
            setShowInventoryModal(true);
          }}
        >
          <i className="bi bi-box-seam fs-4 me-3 text-primary"></i>
          <div>
            <h6 className="alert-heading mb-1 fw-bold text-primary">Ada {inventory.filter(i => i.status === 'pending').length} Pengajuan Stok</h6>
            <p className="small mb-0 text-primary opacity-75">Klik untuk meninjau dan menyetujui stok baru.</p>
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
                    <button className="btn btn-outline-primary w-100 rounded-pill fw-bold py-2 mb-3 shadow-sm" type="button" data-bs-toggle="collapse" data-bs-target="#collapseAddPelanggan">
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
                          <button type="submit" className="btn btn-outline-primary w-100 rounded-pill fw-bold shadow-sm">SIMPAN DATA</button>
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
                            <div className="flex-grow-1 overflow-hidden" onClick={() => handleSelectPelanggan(p)}>
                              <h6 className="mb-0 fw-bold text-dark text-truncate">{p.nama}</h6>
                              <div className="text-muted d-flex align-items-center gap-1" style={{ fontSize: '0.75rem' }}>
                                <i className="bi bi-whatsapp text-success flex-shrink-0"></i> 
                                <span className="text-truncate">{p.hp}</span>
                              </div>
                            </div>
                            <div className="ms-1 d-flex gap-1 flex-shrink-0">
                              <button 
                                className="btn btn-sm btn-light rounded-circle shadow-sm d-flex align-items-center justify-content-center"
                                style={{ width: '32px', height: '32px' }}
                                onClick={(e) => { e.stopPropagation(); setEditPelanggan({ show: true, data: { ...p } }); }}
                              >
                                <i className="bi bi-pencil-square text-primary"></i>
                              </button>
                              <button 
                                className="btn btn-sm btn-light rounded-circle shadow-sm d-flex align-items-center justify-content-center"
                                style={{ width: '32px', height: '32px' }}
                                onClick={(e) => { e.stopPropagation(); handleSelectPelanggan(p); }}
                              >
                                <i className="bi bi-arrow-right text-success"></i>
                              </button>
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

      {/* Modal Edit Pelanggan */}
      {editPelanggan.show && (
        <>
          <div className="modal-backdrop fade show" style={{ backdropFilter: 'blur(5px)', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1065 }}></div>
          <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1070 }}>
            <div className="modal-dialog modal-dialog-centered mx-3">
              <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '24px' }}>
                <div className="modal-header border-0 pb-0 pt-4 px-4">
                  <h5 className="fw-bold mb-0 text-primary">Edit Pelanggan</h5>
                  <button type="button" className="btn-close" onClick={() => setEditPelanggan({ show: false, data: { id: null, nama: '', hp: '', alamat: '' } })}></button>
                </div>
                <div className="modal-body p-4">
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    setConfirmModal({
                      show: true,
                      message: `Simpan perubahan data pelanggan ${editPelanggan.data.nama}?`,
                      onConfirm: async () => {
                        try {
                          await updatePelanggan(editPelanggan.data.id, {
                            nama: editPelanggan.data.nama,
                            hp: editPelanggan.data.hp,
                            alamat: editPelanggan.data.alamat
                          });
                          toast.success('Data pelanggan diperbarui!');
                          setConfirmModal({ show: false, message: '', onConfirm: null });
                          setEditPelanggan({ show: false, data: { id: null, nama: '', hp: '', alamat: '' } });
                        } catch (e) {
                          toast.error(e.message);
                        }
                      }
                    });
                  }}>
                    <div className="mb-3">
                      <label className="small fw-bold text-muted mb-1">Nama Lengkap</label>
                      <input type="text" className="form-control border-0 bg-light rounded-3 py-2" value={editPelanggan.data.nama} onChange={(e) => setEditPelanggan({ ...editPelanggan, data: { ...editPelanggan.data, nama: e.target.value } })} required />
                    </div>
                    <div className="mb-3">
                      <label className="small fw-bold text-muted mb-1">No. WhatsApp</label>
                      <input type="tel" className="form-control border-0 bg-light rounded-3 py-2" value={editPelanggan.data.hp} onChange={(e) => setEditPelanggan({ ...editPelanggan, data: { ...editPelanggan.data, hp: e.target.value } })} required />
                    </div>
                    <div className="mb-4">
                      <label className="small fw-bold text-muted mb-1">Alamat</label>
                      <textarea className="form-control border-0 bg-light rounded-3 py-2" rows="2" value={editPelanggan.data.alamat || ''} onChange={(e) => setEditPelanggan({ ...editPelanggan, data: { ...editPelanggan.data, alamat: e.target.value } })}></textarea>
                    </div>
                    <button type="submit" className="btn btn-outline-primary w-100 rounded-pill fw-bold shadow-sm py-2">Simpan Perubahan</button>
                  </form>
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
                  {user.role !== 'kasir' && (
                    <div className="bg-light p-3 rounded-4 mb-4">
                      <form onSubmit={async (e) => {
                        e.preventDefault();
                        const form = e.target;
                        const nama = form.nama.value;
                        const stok = parseInt(form.stok.value);
                        
                        setConfirmModal({
                          show: true,
                          message: `Konfirmasi penambahan stok manual:\n\nNama Barang: ${nama}\nJumlah: ${stok}\n\nApakah data sudah sesuai?`,
                          onConfirm: async () => {
                            try {
                              await addInventoryManual(nama, stok);
                              form.reset();
                              toast.success('Barang telah ditambahkan');
                              setConfirmModal({ show: false, message: '', onConfirm: null });
                            } catch (error) {
                              toast.error(error.message);
                            }
                          }
                        });
                      }}>
                        <label className="small fw-bold text-muted mb-2 px-1">Tambah Stok Barang Baru</label>
                        <div className="row g-2">
                          <div className="col-8">
                            <input type="text" name="nama" className="form-control border-0 py-2 rounded-3 shadow-sm" placeholder="Nama item..." required />
                          </div>
                          <div className="col-4">
                            <div className="input-group shadow-sm rounded-3 overflow-hidden">
                              <input type="number" name="stok" className="form-control border-0 py-2 px-2 text-center" placeholder="Qty" required />
                              <button className="btn btn-outline-primary border-0 px-2" type="submit">
                                <i className="bi bi-plus-lg"></i>
                              </button>
                            </div>
                          </div>
                        </div>
                      </form>
                    </div>
                  )}

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

                  {/* Tab Inventory */}
                  <div className="d-flex bg-white rounded-pill p-1 shadow-sm mb-3">
                    <button 
                      className={`btn flex-fill rounded-pill py-2 border-0 ${inventoryTab === 'selesai' ? 'btn-primary' : 'btn-light text-muted bg-transparent'}`}
                      onClick={() => setInventoryTab('selesai')}
                    >
                      Selesai
                    </button>
                    <button 
                      className={`btn flex-fill rounded-pill py-2 border-0 ${inventoryTab === 'pending' ? 'btn-primary' : 'btn-light text-muted bg-transparent'}`}
                      onClick={() => setInventoryTab('pending')}
                    >
                      Pending
                    </button>
                  </div>

                  {/* Daftar Item Inventory */}
                  <div className="inventory-list">
                    {inventory?.filter(item => {
                      const matchSearch = item.nama.toLowerCase().includes(searchInventory.toLowerCase());
                      const matchTab = inventoryTab === 'pending' ? item.status === 'pending' : (item.status === 'approved' || item.status === undefined);
                      return matchSearch && matchTab;
                    }).map(item => (
                      <div key={item.id} className="card border-0 mb-3 rounded-4 shadow-sm overflow-hidden" style={{ background: '#fff' }}>
                        <div className="card-body p-3 d-flex justify-content-between align-items-center">
                          <div className="d-flex align-items-center">
                            <div className="rounded-4 bg-light d-flex align-items-center justify-content-center me-3" style={{ width: '45px', height: '45px' }}>
                              <i className={`bi ${item.nama.toLowerCase().includes('plastik') ? 'bi-box' : 'bi-archive'} text-success fs-4`}></i>
                            </div>
                            <div>
                              <div className="d-flex align-items-center mb-1">
                                <h6 className="fw-bold mb-0 text-dark" style={{ maxWidth: '140px', fontSize: '12px', wordWrap: 'break-word' }}>{item.nama}</h6>
                                <i 
                                  className="bi bi-copy text-muted ms-2" 
                                  style={{ cursor: 'pointer', fontSize: '0.8rem' }}
                                  onClick={() => {
                                    navigator.clipboard.writeText(item.nama);
                                    toast.success('Nama disalin!');
                                  }}
                                  title="Copy nama stok"
                                ></i>
                              </div>
                              <div className="d-flex flex-wrap gap-1">
                                <span className={`badge rounded-pill ${item.stok < 5 ? 'bg-danger bg-opacity-10' : 'bg-success bg-opacity-10'}`} style={{ fontSize: '0.65rem' }}>
                                  Stok: {item.stok}
                                </span>
                                {item.status === 'pending' && (
                                  <span className="badge bg-warning text-dark rounded-pill" style={{ fontSize: '0.65rem' }}>
                                    +{item.qty} {item.unit || 'pcs'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {item.status === 'pending' ? (
                            user.role !== 'kasir' && (
                              <div className="d-flex gap-2">
                                <button
                                  className="btn btn-sm btn-danger rounded-circle shadow-sm d-flex align-items-center justify-content-center"
                                  style={{ width: '32px', height: '32px' }}
                                  onClick={() => handleRejectInventory(item)}
                                  title="Tolak"
                                >
                                  <i className="bi bi-x fs-6"></i>
                                </button>
                                <button
                                  className="btn btn-sm btn-success rounded-circle shadow-sm d-flex align-items-center justify-content-center"
                                  style={{ width: '32px', height: '32px' }}
                                  onClick={() => handleApproveInventory(item)}
                                  title="Setujui"
                                >
                                  <i className="bi bi-check2 fs-6"></i>
                                </button>
                              </div>
                            )
                          ) : (

                            user.role !== 'kasir' && (
                              <div className="d-flex align-items-center gap-2 bg-light rounded-pill p-1">
                                <button
                                  className="btn btn-sm btn-white rounded-circle shadow-sm border-0 d-flex align-items-center justify-content-center"
                                  style={{ width: '28px', height: '28px', backgroundColor: '#fff' }}
                                  onClick={() => handleUpdateStok(item, -1)}
                                >
                                  <i className="bi bi-dash text-dark"></i>
                                </button>
                                <span className="fw-bold text-dark px-1" style={{ fontSize: '0.9rem', minWidth: '20px', textAlign: 'center' }}>{item.stok}</span>
                                <button
                                  className="btn btn-sm btn-white rounded-circle shadow-sm border-0 d-flex align-items-center justify-content-center"
                                  style={{ width: '28px', height: '28px', backgroundColor: '#fff' }}
                                  onClick={() => handleUpdateStok(item, 1)}
                                >
                                  <i className="bi bi-plus text-dark"></i>
                                </button>
                              </div>
                            )
                          )}
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
