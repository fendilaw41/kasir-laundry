import { useTransaksi } from './hooks/useTransaksi';

const Transaksi = () => {
  const {
    cartItems, daftarPelanggan, inventory, navigate,
    selectedPelanggan, setSelectedPelanggan,
    showModal, setShowModal,
    isAdding, setIsAdding,
    newPelanggan, setNewPelanggan,
    diskonTipe, setDiskonTipe,
    diskonNilai, setDiskonNilai,
    estimasi, setEstimasi,
    metodeBayar, setMetodeBayar,
    tipeLayanan, setTipeLayanan,
    isPriority, setIsPriority,
    selectedInventory,
    subtotal, nilaiDiskon, total,
    handleCheckout, removeItem, toggleInventory, updateInventoryQty, handleAddPelanggan
  } = useTransaksi();

  return (
    <div className="card shadow-sm mb-5 border-0" style={{ borderRadius: '28px' }}>
      <div className="card-body p-4">
        <div className="text-center mb-4">
          <h5 className="fw-bold mb-0">Transaksi</h5>
          <small className="text-muted">Lengkapi detail laundry pelanggan</small>
        </div>

        {/* Info Pelanggan - Mobile Card Style */}
        <div className={`p-4 rounded-4 mb-4 d-flex justify-content-between align-items-center border-0 shadow-sm transition-all ${selectedPelanggan ? 'bg-primary text-white scale-up' : 'bg-warning-light border'}`}
          style={{ backgroundColor: !selectedPelanggan ? '#fff9c4' : '#0134d4', transform: selectedPelanggan ? 'scale(1.01)' : 'scale(1)' }}>
          <div>
            <small className={`d-block mb-1 ${selectedPelanggan ? 'opacity-75' : 'text-muted'}`}>Pelanggan:</small>
            <h6 className={`${selectedPelanggan ? 'text-white' : 'text-dark'} mb-0 fw-bold fs-5`}>{selectedPelanggan ? selectedPelanggan.nama : 'Pilih Pelanggan...'}</h6>
            {selectedPelanggan && <small className="opacity-75">{selectedPelanggan.hp}</small>}
          </div>
          <button className={`btn rounded-circle d-flex align-items-center justify-content-center shadow-sm ${selectedPelanggan ? 'btn-white text-primary' : 'btn-primary'}`}
            onClick={() => setShowModal(true)} style={{ width: '45px', height: '45px', backgroundColor: selectedPelanggan ? 'white' : '' }}>
            <i className={`bi ${selectedPelanggan ? 'bi-person-check-fill' : 'bi-person-plus-fill'} fs-4`}></i>
          </button>
        </div>

        {/* Action Tambah Layanan - Large Button */}
        {!cartItems || cartItems.length === 0 ? (
          <div
            onClick={() => selectedPelanggan && navigate('/product')}
            className={`p-4 mb-4 rounded-4 text-center border-dashed d-flex flex-column align-items-center justify-content-center transition-all ${selectedPelanggan ? 'bg-white border-primary border-2 shadow-sm' : 'bg-light opacity-50'}`}
            style={{ border: '2px dashed #ccc', cursor: selectedPelanggan ? 'pointer' : 'not-allowed', minHeight: '150px' }}
          >
            <div className={`rounded-circle mb-3 d-flex align-items-center justify-content-center ${selectedPelanggan ? 'bg-primary-light text-primary' : 'bg-secondary text-white'}`} style={{ width: '60px', height: '60px', backgroundColor: selectedPelanggan ? '#e3f2fd' : '#eee' }}>
              <i className="bi bi-plus-circle-fill fs-1"></i>
            </div>
            <h6 className="fw-bold mb-1">Tambah Layanan</h6>
            <small className="text-muted">Klik untuk memilih jenis cuci/setrika</small>
          </div>
        ) : (
          <div className="mb-4">
            <div className="d-flex justify-content-between align-items-center mb-2 px-1">
              <h6 className="fw-bold mb-0 text-muted small text-uppercase">Layanan Dipilih</h6>
              <button className="btn btn-sm btn-outline-primary rounded-pill px-3 py-1 small fw-bold" onClick={() => navigate('/product')}>
                <i className="bi bi-plus-lg me-1"></i> Tambah
              </button>
            </div>
            <div className="d-grid gap-2">
              {cartItems.map(item => (
                <div key={item.id} className="bg-white p-3 rounded-4 shadow-sm border d-flex justify-content-between align-items-center">
                  <div className="d-flex align-items-center">
                    <div className="bg-primary-light text-primary rounded-3 p-2 me-3" style={{ backgroundColor: '#e3f2fd' }}>
                      <i className="bi bi-tsunami fs-4"></i>
                    </div>
                    <div>
                      <div className="fw-bold small">{item.name}</div>
                      <small className="text-muted">{item.quantity} x Rp {item.price.toLocaleString()}</small>
                    </div>
                  </div>
                  <div className="text-end">
                    <div className="fw-bold text-primary mb-1">Rp {(item.price * item.quantity).toLocaleString()}</div>
                    <i className="bi bi-x-circle-fill text-danger fs-5" onClick={() => removeItem(item.id)} style={{ cursor: 'pointer' }}></i>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Inventory Horizontal Scroller */}
        <div className="mb-4">
          <label className="form-label small fw-bold text-muted text-uppercase mb-3 px-1">Gunakan Inventori</label>
          <div className="d-flex overflow-auto pb-3 gap-2 mx-n1 px-1 inventory-scroller">
            <style>{`
              .inventory-scroller::-webkit-scrollbar { height: 6px; }
              .inventory-scroller::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 4px; }
              .inventory-scroller::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 4px; }
              .inventory-scroller::-webkit-scrollbar-thumb:hover { background: #a8a8a8; }
            `}</style>
            {inventory?.map(inv => {
              const activeItem = selectedInventory.find(s => s.id === inv.id);
              const isActive = !!activeItem;
              return (
                <div
                  key={inv.id}
                  className={`flex-shrink-0 p-3 rounded-4 border d-flex flex-column align-items-center justify-content-center transition-all ${isActive ? 'bg-outline-success text-dark border-success shadow-sm' : 'bg-white text-dark shadow-xs'}`}
                  style={{ minWidth: '120px', height: '140px', opacity: inv.stok <= 0 && !isActive ? 0.5 : 1 }}
                >
                  <div className="text-center w-100" onClick={() => (inv.stok > 0 || isActive) && toggleInventory(inv)} style={{ cursor: inv.stok > 0 || isActive ? 'pointer' : 'not-allowed' }}>
                    <i className={`bi ${isActive ? 'bi-check-circle-fill text-success' : 'bi-box-seam'} d-block mb-1 fs-4`}></i>
                    <div className="small fw-bold text-truncate" style={{ fontSize: '0.75rem' }}>{inv.nama}</div>
                    <small className="text-muted" style={{ fontSize: '0.65rem' }}>Stok: {inv.stok}</small>
                  </div>
                  {isActive && (
                    <div className="d-flex align-items-center gap-2 bg-white rounded-pill p-1 shadow-sm mt-2 w-100 justify-content-center">
                      <button className="btn btn-sm btn-light rounded-circle p-0 d-flex align-items-center justify-content-center" style={{ width: '18px', height: '18px' }} onClick={(e) => { e.stopPropagation(); updateInventoryQty(inv.id, -1); }}>
                        <i className="bi bi-dash text-dark"></i>
                      </button>
                      <span className="fw-bold text-dark px-1" style={{ fontSize: '0.8rem', minWidth: '16px', textAlign: 'center' }}>{activeItem.quantity || 1}</span>
                      <button className="btn btn-sm btn-light rounded-circle p-0 d-flex align-items-center justify-content-center" style={{ width: '18px', height: '18px' }} onClick={(e) => { e.stopPropagation(); updateInventoryQty(inv.id, 1); }}>
                        <i className="bi bi-plus text-dark"></i>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Form Detail Tambahan - Grouped Card */}
        <div className="bg-light p-3 p-sm-4 rounded-4 border-0 mb-4 shadow-sm">
          <div className="row g-3">
            <div className="col-12 col-sm-6">
              <label className="form-label small fw-bold text-muted px-1">Metode Bayar</label>
              <select className="form-select border-0 shadow-sm rounded-3 py-2" value={metodeBayar} onChange={e => setMetodeBayar(e.target.value)}>
                <option value="Cash">Cash</option>
                <option value="QRIS">QRIS</option>
                <option value="Deposit">Deposit</option>
              </select>
            </div>
            <div className="col-12 col-sm-6">
              <label className="form-label small fw-bold text-muted px-1">Layanan</label>
              <select className="form-select border-0 shadow-sm rounded-3 py-2" value={tipeLayanan} onChange={e => setTipeLayanan(e.target.value)}>
                <option value="Datang Langsung">Datang Langsung</option>
                <option value="Jemput/Antar">Antar Jemput</option>
              </select>
            </div>
            <div className="col-12 col-sm-6">
              <label className="form-label small fw-bold text-muted px-1">Estimasi (Hari)</label>
              <input
                type="number"
                className="form-control border-0 shadow-sm rounded-3 py-2"
                value={estimasi}
                onChange={e => setEstimasi(e.target.value)}
                onFocus={(e) => e.target.select()}
                required
              />
            </div>
            <div className="col-12 col-sm-6">
              <label className="form-label small fw-bold text-muted px-1">Prioritas</label>
              <select className="form-select border-0 shadow-sm rounded-3 py-2" value={isPriority} onChange={e => setIsPriority(e.target.value)}>
                <option value="Tidak">Biasa</option>
                <option value="Ya">Prioritas</option>
              </select>
            </div>
          </div>
        </div>

        {/* Ringkasan Biaya & Diskon */}
        <div className="mb-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <label className="form-label small fw-bold text-muted text-uppercase mb-0">Diskon</label>
            <div className="d-flex bg-white shadow-sm rounded-pill p-1" style={{ border: '1px solid #eee' }}>
              <button
                type="button"
                className={`btn btn-sm rounded-pill px-3 fw-bold border-0 ${diskonTipe === 'Persentase' ? 'btn-primary shadow-sm' : 'btn-light bg-transparent text-muted'}`}
                onClick={() => setDiskonTipe('Persentase')}
                style={{ fontSize: '0.7rem' }}
              >
                %
              </button>
              <button
                type="button"
                className={`btn btn-sm rounded-pill px-3 fw-bold border-0 ${diskonTipe === 'Harga' ? 'btn-primary shadow-sm' : 'btn-light bg-transparent text-muted'}`}
                onClick={() => setDiskonTipe('Harga')}
                style={{ fontSize: '0.7rem' }}
              >
                Rp
              </button>
            </div>
          </div>
          <div className="position-relative mb-3">
            <span className="position-absolute top-50 start-0 translate-middle-y ms-3 fw-bold text-muted">
              {diskonTipe === 'Persentase' ? '%' : 'Rp'}
            </span>
            <input
              type="number"
              className="form-control form-control-lg border-1 bg-light rounded-4 shadow-sm ps-5 fw-bold"
              placeholder="0"
              value={diskonNilai}
              onChange={e => setDiskonNilai(e.target.value)}
              onFocus={(e) => e.target.select()}
            />
          </div>

          <div className="bg-outline-primary text-black p-4 rounded-4 shadow-sm">
            <div className="d-flex justify-content-between mb-1 opacity-75">
              <span className="small">Subtotal</span>
              <span className="small">Rp {subtotal.toLocaleString()}</span>
            </div>
            <div className="d-flex justify-content-between mb-2 opacity-75">
              <span className="small">Diskon</span>
              <span className="small text-warning fw-bold">- Rp {nilaiDiskon.toLocaleString()}</span>
            </div>
            <div className="d-flex justify-content-between align-items-center border-top pt-2 mt-1">
              <span className="small">TOTAL AKHIR</span>
              <span className="small fw-bold">Rp {total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <button className="btn btn-outline-primary w-100 btn-lg shadow rounded-4 py-3 fw-bold mt-2" onClick={handleCheckout} disabled={cartItems?.length === 0}>
          LANJUTKAN
        </button>
      </div>

      {/* Modal Pilih Pelanggan */}
      {
        showModal && (
          <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
              <div className="modal-content border-0 shadow">
                <div className="modal-header">
                  <h5 className="modal-title">{isAdding ? 'Tambah Pelanggan Baru' : 'Pilih Pelanggan'}</h5>
                  <button type="button" className="btn-close" onClick={() => { setShowModal(false); setIsAdding(false); }}></button>
                </div>
                <div className="modal-body">
                  {isAdding ? (
                    <form onSubmit={handleAddPelanggan}>
                      <div className="mb-2">
                        <input className="form-control" placeholder="Nama" value={newPelanggan.nama} onChange={e => setNewPelanggan({ ...newPelanggan, nama: e.target.value })} required />
                      </div>
                      <div className="mb-2">
                        <input className="form-control" placeholder="No HP" value={newPelanggan.hp} onChange={e => setNewPelanggan({ ...newPelanggan, hp: e.target.value })} required />
                      </div>
                      <div className="mb-3">
                        <textarea className="form-control" placeholder="Alamat" value={newPelanggan.alamat} onChange={e => setNewPelanggan({ ...newPelanggan, alamat: e.target.value })}></textarea>
                      </div>
                      <button type="submit" className="btn btn-primary w-100">Simpan & Pilih</button>
                      <button type="button" className="btn btn-link w-100 mt-2" onClick={() => setIsAdding(false)}>Batal</button>
                    </form>
                  ) : (
                    <>
                      <button className="btn btn-outline-success w-100 mb-3" onClick={() => setIsAdding(true)}>
                        <i className="bi bi-plus-lg me-1"></i> Pelanggan Baru
                      </button>
                      <div className="list-group list-group-flush">
                        {daftarPelanggan?.length === 0 ? (
                          <p className="text-center text-muted">Belum ada data pelanggan</p>
                        ) : (
                          daftarPelanggan?.map(p => (
                            <button key={p.id} className="list-group-item list-group-item-action text-start py-3" onClick={() => { setSelectedPelanggan(p); setShowModal(false); }}>
                              <div className="fw-bold">{p.nama}</div>
                              <small className="text-muted">{p.hp}</small>
                            </button>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default Transaksi;
