import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

const Transaksi = () => {
  const cartItems = useLiveQuery(() => db.cart.toArray());
  const daftarPelanggan = useLiveQuery(() => db.pelanggan.toArray());
  const inventory = useLiveQuery(() => db.inventory.toArray());
  const navigate = useNavigate();

  const [selectedPelanggan, setSelectedPelanggan] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newPelanggan, setNewPelanggan] = useState({ nama: '', hp: '', alamat: '' });

  // State untuk detail transaksi tambahan
  const [diskonTipe, setDiskonTipe] = useState('Persentase'); // Persentase atau Harga
  const [diskonNilai, setDiskonNilai] = useState(0);
  const [estimasi, setEstimasi] = useState(0);
  const [metodeBayar, setMetodeBayar] = useState('Cash');
  const [tipeLayanan, setTipeLayanan] = useState('Datang Langsung');
  const [isPriority, setIsPriority] = useState('Tidak');
  const [selectedInvId, setSelectedInvId] = useState('');

  const subtotal = cartItems?.reduce((acc, item) => acc + (item.price * item.quantity), 0) || 0;
  
  // Kalkulasi Diskon
  const nilaiDiskon = diskonTipe === 'Persentase' 
    ? (subtotal * (diskonNilai / 100)) 
    : parseInt(diskonNilai || 0);
  
  const total = subtotal - nilaiDiskon;

  const handleCheckout = async () => {
    if (!cartItems || cartItems.length === 0) return;
    if (!selectedPelanggan) {
      setShowModal(true);
      return;
    }

    const user = JSON.parse(localStorage.getItem('user'));
    
    // Siapkan data untuk dikirim ke halaman pembayaran
    const orderData = {
      userId: user.id,
      pelangganId: selectedPelanggan.id,
      pelangganNama: selectedPelanggan.nama,
      items: cartItems,
      subtotal: subtotal,
      diskon: nilaiDiskon,
      total: total,
      metodeBayar,
      estimasi,
      tipeLayanan,
      isPriority: isPriority === 'Ya',
      selectedInvId: selectedInvId // Kirim ID inventory untuk dikurangi nanti
    };

    navigate('/pembayaran', { state: { orderData } });
  };

  const removeItem = async (id) => {
    await db.cart.delete(id);
  };

  const handleAddPelanggan = async (e) => {
    e.preventDefault();
    const id = await db.pelanggan.add(newPelanggan);
    const created = { id, ...newPelanggan };
    setSelectedPelanggan(created);
    setIsAdding(false);
    setNewPelanggan({ nama: '', hp: '', alamat: '' });
  };

  return (
    <div className="card shadow-sm mb-5">
      <div className="card-body p-3">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="mb-0">Konfirmasi Pesanan</h5>
          <button className="btn btn-sm btn-outline-danger" onClick={() => navigate('/product')}>
            <i className="bi bi-plus-lg"></i>
          </button>
        </div>

        {/* Info Pelanggan */}
        <div className="p-3 bg-light border rounded mb-3 d-flex justify-content-between align-items-center">
          <div>
            <small className="text-muted d-block">Pelanggan:</small>
            <h6 className="mb-0 text-primary">{selectedPelanggan ? selectedPelanggan.nama : 'Pilih Pelanggan...'}</h6>
          </div>
          <button className="btn btn-sm btn-primary" onClick={() => setShowModal(true)}>
            {selectedPelanggan ? 'Ganti' : 'Pilih'}
          </button>
        </div>

        {/* Ringkasan Item */}
        <div className="row g-2 mb-3">
          <div className="col-6">
            <div className="border rounded p-2 text-center bg-white">
              <small className="text-muted d-block">Jumlah Item</small>
              <span className="fw-bold text-primary">{cartItems?.length || 0}</span>
            </div>
          </div>
          <div className="col-6">
            <div className="border rounded p-2 text-center bg-white">
              <small className="text-muted d-block">Total</small>
              <span className="fw-bold text-primary">Rp {total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Pilih Inventori */}
        <div className="mb-3">
          <label className="form-label small fw-bold text-uppercase">Pilih Inventori</label>
          <select className="form-select border-primary" value={selectedInvId} onChange={e => setSelectedInvId(e.target.value)}>
            <option value="">-- Tanpa Inventori --</option>
            {inventory?.map(inv => (
              <option key={inv.id} value={inv.id} disabled={inv.stok <= 0}>
                {inv.nama} (Stok: {inv.stok})
              </option>
            ))}
          </select>
        </div>

        {/* Form Detail Tambahan */}
        <div className="bg-light p-3 rounded border mb-3">
          <div className="mb-3">
            <label className="form-label small fw-bold">Jenis Diskon</label>
            <select className="form-select" value={diskonTipe} onChange={e => setDiskonTipe(e.target.value)}>
              <option value="Persentase">Persentase</option>
              <option value="Harga">Harga</option>
            </select>
          </div>

          <div className="mb-3">
            <label className="form-label small fw-bold">Diskon ({diskonTipe === 'Persentase' ? '%' : 'Rp'})</label>
            <input type="number" className="form-control" value={diskonNilai} onChange={e => setDiskonNilai(e.target.value)} />
          </div>

          <div className="mb-3">
            <label className="form-label small fw-bold">Estimasi Pengerjaan (Hari)</label>
            <input type="number" className="form-control" placeholder="ex: 2" value={estimasi} onChange={e => setEstimasi(e.target.value)} />
            <small className="text-danger small">*jika tidak diisi, default 0</small>
          </div>

          <div className="mb-3">
            <label className="form-label small fw-bold">Metode Bayar</label>
            <select className="form-select" value={metodeBayar} onChange={e => setMetodeBayar(e.target.value)}>
              <option value="Cash">Cash</option>
              <option value="QRIS">QRIS</option>
              <option value="Deposit">Deposit</option>
            </select>
          </div>

          <div className="mb-3">
            <label className="form-label small fw-bold">Jemput/Antar</label>
            <select className="form-select" value={tipeLayanan} onChange={e => setTipeLayanan(e.target.value)}>
              <option value="Datang Langsung">Datang Langsung</option>
              <option value="Jemput/Antar">Jemput/Antar</option>
            </select>
          </div>

          <div className="mb-0">
            <label className="form-label small fw-bold">Jadikan Prioritas</label>
            <select className="form-select" value={isPriority} onChange={e => setIsPriority(e.target.value)}>
              <option value="Tidak">Tidak</option>
              <option value="Ya">Ya</option>
            </select>
          </div>
        </div>

        {/* Daftar Item di Keranjang */}
        <div className="mb-4">
          <h6 className="mb-2 border-bottom pb-2">Daftar Layanan</h6>
          {cartItems?.map(item => (
            <div key={item.id} className="d-flex justify-content-between align-items-center mb-2">
              <div className="d-flex align-items-center">
                <i className="bi bi-trash text-danger me-2" onClick={() => removeItem(item.id)} style={{cursor: 'pointer'}}></i>
                <span>({item.quantity}) {item.name}</span>
              </div>
              <span className="fw-bold">Rp {(item.price * item.quantity).toLocaleString()}</span>
            </div>
          ))}
        </div>

        <button className="btn btn-primary w-100 btn-lg shadow" onClick={handleCheckout} disabled={cartItems?.length === 0}>
          SIMPAN TRANSAKSI
        </button>
      </div>

      {/* Modal Pilih Pelanggan */}
      {showModal && (
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
                      <input className="form-control" placeholder="Nama" value={newPelanggan.nama} onChange={e => setNewPelanggan({...newPelanggan, nama: e.target.value})} required />
                    </div>
                    <div className="mb-2">
                      <input className="form-control" placeholder="No HP" value={newPelanggan.hp} onChange={e => setNewPelanggan({...newPelanggan, hp: e.target.value})} required />
                    </div>
                    <div className="mb-3">
                      <textarea className="form-control" placeholder="Alamat" value={newPelanggan.alamat} onChange={e => setNewPelanggan({...newPelanggan, alamat: e.target.value})}></textarea>
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
      )}
    </div>
  );
};

export default Transaksi;
