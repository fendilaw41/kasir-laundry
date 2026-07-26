import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { getOrderByIdQuery, updateOrder } from '../db/repositories/orders';
import { getPelangganByIdQuery, updatePelanggan, addPelanggan } from '../db/repositories/pelanggan';
import { getInventoryQuery, getInventoryById, updateInventory } from '../db/repositories/inventory';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { formatWhatsAppMessage } from '../utils/whatsapp';
import PrintLayout from '../components/PrintLayout';

const OrderDetail = () => {
  const { id } = useParams();
  // const navigate = useNavigate();
  const order = useLiveQuery(() => getOrderByIdQuery(id), [id]);
  const pelanggan = useLiveQuery(() => order ? getPelangganByIdQuery(order.pelangganId) : null, [order]);

  const [catatan, setCatatan] = useState('');
  const [prevId, setPrevId] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showHpModal, setShowHpModal] = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [selectedInventory, setSelectedInventory] = useState([]);
  const [newHp, setNewHp] = useState('');
  const [printType, setPrintType] = useState(null);
  
  const allInventory = useLiveQuery(getInventoryQuery);

  if (order && order.id !== prevId) {
    setPrevId(order.id);
    setCatatan(order.catatan || '');
    setSelectedInventory(order.inventoryUsed || []);
  }

  if (!order) return <div className="p-3">Loading...</div>;

  const handleStatusClick = (newStatus) => {
    if ((order.status === 'Selesai' || order.status === 'Ambil') && newStatus === 'Proses') {
      setShowConfirmModal(true);
    } else {
      updateStatus(newStatus);
    }
  };

  const updateStatus = async (status) => {
    try {
      await updateOrder(order.id, { status });
      setShowConfirmModal(false);
    } catch (error) {
      toast.error(error.message);
      setShowConfirmModal(false);
    }
  };

  const updateCatatan = async () => {
    await updateOrder(order.id, { catatan });
    toast.success('Catatan diperbarui!');
    setShowNoteModal(false);
  };

  // const hapusTransaksi = async () => {
  //   if (window.confirm('Hapus transaksi ini?')) {
  //     await db.orders.delete(order.id);
  //     navigate('/orders');
  //   }
  // };

  const togglePriority = async () => {
    await updateOrder(order.id, { isPriority: !order.isPriority });
  };

  const setLunas = async () => {
    await updateOrder(order.id, { statusBayar: 'Lunas', bayar: order.total, kembalian: 0 });
  };

  const sendWhatsApp = () => {
    if (!pelanggan || !pelanggan.hp || pelanggan.hp === '-') {
      setNewHp('');
      setShowHpModal(true);
      return;
    }
    const waData = formatWhatsAppMessage(order, pelanggan);
    if (!waData) {
      toast.error('Gagal memformat pesan WhatsApp!');
      return;
    }
    window.open(waData.url, '_blank');
  };

  const saveHpAndSend = async () => {
    if (!newHp.trim()) {
      toast.error('Nomor HP tidak boleh kosong');
      return;
    }
    let updatedPelanggan = { ...pelanggan, hp: newHp };
    if (pelanggan && pelanggan.id) {
      await updatePelanggan(pelanggan.id, { hp: newHp });
    } else {
      const newPelangganId = await addPelanggan({ nama: order.pelangganNama || 'Pelanggan Umum', hp: newHp, alamat: '-' });
      await updateOrder(order.id, { pelangganId: newPelangganId });
      updatedPelanggan = { id: newPelangganId, nama: order.pelangganNama || 'Pelanggan Umum', hp: newHp, alamat: '-' };
    }
    setShowHpModal(false);
    toast.success('Nomor HP berhasil disimpan');
    
    setTimeout(() => {
        const waData = formatWhatsAppMessage(order, updatedPelanggan);
        if (waData) window.open(waData.url, '_blank');
    }, 300);
  };

  const toggleInventory = (inv) => {
    setSelectedInventory(prev => {
      const exists = prev.find(item => item.id === inv.id);
      if (exists) {
        return prev.filter(item => item.id !== inv.id);
      } else {
        return [...prev, { id: inv.id, nama: inv.nama, quantity: 1 }];
      }
    });
  };

  const updateInventoryQty = (invId, delta) => {
    setSelectedInventory(prev => {
      const existing = prev.find(item => item.id === invId);
      if (existing) {
        const newQty = (existing.quantity || 1) + delta;
        if (newQty <= 0) {
           return prev.filter(item => item.id !== invId);
        } else {
           return prev.map(item => item.id === invId ? { ...item, quantity: newQty } : item);
        }
      }
      return prev;
    });
  };

  const saveInventory = async () => {
    const oldInv = order.inventoryUsed || [];
    const newInv = selectedInventory;
    
    const allIds = new Set([...oldInv.map(i => i.id), ...newInv.map(i => i.id)]);
    
    for (const id of allIds) {
       const oldItem = oldInv.find(i => i.id === id);
       const newItem = newInv.find(i => i.id === id);
       
       const oldQty = oldItem ? (oldItem.quantity || 1) : 0;
       const newQty = newItem ? (newItem.quantity || 1) : 0;
       
       const diff = newQty - oldQty; 
       if (diff !== 0) {
          const invData = await getInventoryById(id);
          if (invData) {
             const newStok = Math.max(0, invData.stok - diff);
             await updateInventory(id, { stok: newStok });
          }
       }
    }
    
    await updateOrder(order.id, { inventoryUsed: newInv });
    toast.success('Inventory terpakai diperbarui!');
    setShowInventoryModal(false);
  };

  const triggerPrint = (type) => {
    setPrintType(type);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  return (
    <>
      {/* Komponen Cetak Standar */}
      <PrintLayout order={order} pelanggan={pelanggan} printType={printType} />

      <div className="order-detail-wrapper pb-5">

      <div className="card shadow-sm border-0 mb-3 overflow-hidden">
        {/* Banner */}
        <div className={`p-4 text-center text-white position-relative ${order.isPriority ? 'bg-danger' : 'bg-primary'}`}>
          {order.isPriority && (
            <div className="position-absolute top-0 start-0 p-2">
              <span className="badge bg-white text-danger fw-bold shadow-sm"><i className="bi bi-star-fill me-1"></i> PRIORITAS</span>
            </div>
          )}
          <h5 className="text-white fw-bold mb-0">Keenan Laundry</h5>
          <small className="opacity-75">Solusi Laundry Bersih & Cepat</small>
        </div>

        {/* Info Ringkas */}
        <div className="card-body p-3 small border-bottom">
          <div className="d-flex justify-content-between mb-1">
            <span className="text-primary fw-bold">ID: {order.invoiceId || 'KL'}</span>
            <span className="text-muted">{new Date(order.createdAt).toLocaleString('id-ID')}</span>
          </div>
          <div className="d-flex justify-content-between mb-1">
            <h6 className="mb-0 fw-bold">{pelanggan?.nama || 'Pelanggan Umum'}</h6>
            <div className="text-muted mb-1"><i className="bi bi-telephone me-1"></i> {pelanggan?.hp || '-'}</div>
          </div>
          <div className="d-flex justify-content-between">
            <span>Estimasi Selesai :</span>
            <span className="fw-bold">({order.estimasi} Hari) {new Date(new Date(order.createdAt).getTime() + (order.estimasi * 86400000)).toLocaleDateString('id-ID')}</span>
          </div>
          <div className="d-flex justify-content-between mt-1 align-items-center">
            <span>Metode Bayar :</span>
            <span className={`badge ${order.statusBayar === 'Lunas' ? 'bg-success' : 'bg-warning'} text-uppercase`}>{order.statusBayar} {order.metodeBayar}</span>
          </div>
          <div className="d-flex justify-content-between mt-1 align-items-start" onClick={() => setShowNoteModal(true)} style={{ cursor: 'pointer' }}>
            <span>Catatan :</span>
            <div className="text-end">
              <span className="fw-bold text-primary small d-block">{order.catatan || '-'}</span>
              <small className="text-muted" style={{ fontSize: '0.65rem' }}><i className="bi bi-pencil-square me-1"></i>Edit Catatan</small>
            </div>
          </div>
        </div>



        {/* Status Tracker */}
        <div className="p-3 border-bottom">
          <div className="small fw-bold text-muted text-uppercase mb-3 text-center" style={{ letterSpacing: '1px', fontSize: '0.7rem' }}>Status Pengerjaan</div>
          <div className="row g-2 text-center">
            <div className="col-4" onClick={() => handleStatusClick('Proses')}>
              <div className={`py-3 px-1 border rounded-4 ${order.status === 'Proses' || !order.status ? 'bg-primary text-white shadow-sm' : 'bg-light text-muted'}`} style={{ transition: 'all 0.3s' }}>
                <i className={`bi bi-gear-wide-connected fs-3 d-block mb-1 ${order.status === 'Proses' || !order.status ? 'text-white' : 'text-primary opacity-50'}`}></i>
                <span className="fw-bold" style={{ fontSize: '0.65rem' }}>PROSES</span>
              </div>
            </div>
            <div className="col-4" onClick={() => handleStatusClick('Selesai')}>
              <div className={`py-3 px-1 border rounded-4 ${order.status === 'Selesai' ? 'bg-success text-white shadow-sm' : 'bg-light text-muted'}`} style={{ transition: 'all 0.3s' }}>
                <i className={`bi bi-check2-circle fs-3 d-block mb-1 ${order.status === 'Selesai' ? 'text-white' : 'text-success opacity-50'}`}></i>
                <span className="fw-bold" style={{ fontSize: '0.65rem' }}>SELESAI</span>
              </div>
            </div>
            <div className="col-4" onClick={() => handleStatusClick('Ambil')}>
              <div className={`py-3 px-1 border rounded-4 ${order.status === 'Ambil' ? 'bg-dark text-white shadow-sm' : 'bg-light text-muted'}`} style={{ transition: 'all 0.3s' }}>
                <i className={`bi bi-box-seam fs-3 d-block mb-1 ${order.status === 'Ambil' ? 'text-white' : 'text-dark opacity-50'}`}></i>
                <span className="fw-bold" style={{ fontSize: '0.65rem' }}>AMBIL</span>
              </div>
            </div>
          </div>
        </div>

        {/* Rincian Harga */}
        <div className="p-3 bg-light small">
          {order.items && order.items.length > 0 && (
            <div className="mb-2 pb-2 border-bottom">
              <div className="fw-bold text-muted mb-1" style={{ fontSize: '0.7rem', letterSpacing: '0.5px' }}>LAYANAN / PRODUK</div>
              {order.items.map((item, idx) => (
                <div key={idx} className="d-flex justify-content-between mb-1" style={{ fontSize: '0.75rem' }}>
                  <span>{item.quantity}x <span className="text-dark text-capitalize">{(item.category || '').toLowerCase()} <span className="d-inline-block">{item.name}</span></span></span>
                  <span className="text-dark fw-bold">Rp {(item.price * item.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mb-2 pb-2 border-bottom">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <div className="fw-bold text-muted" style={{ fontSize: '0.7rem', letterSpacing: '0.5px' }}>INVENTORY TERPAKAI</div>
              {order.status === 'Proses' && (
                <small className="text-primary" style={{ fontSize: '0.7rem', cursor: 'pointer' }} onClick={() => setShowInventoryModal(true)}><i className="bi bi-pencil-square me-1"></i>Edit</small>
              )}
            </div>
            {order.inventoryUsed && order.inventoryUsed.length > 0 ? (
              order.inventoryUsed.map((inv, idx) => (
                <div key={idx} className="d-flex justify-content-between mb-1 text-muted" style={{ fontSize: '0.75rem' }}>
                  <span>{inv.nama}</span>
                  <span>{inv.quantity || 1}x</span>
                </div>
              ))
            ) : (
              <div className="text-muted fst-italic" style={{ fontSize: '0.75rem' }}>Belum ada inventory yang ditambahkan</div>
            )}
          </div>

          <div className="d-flex justify-content-between mb-1 text-muted">
            <span>Sub-total</span>
            <span>Rp {order.subtotal?.toLocaleString()}</span>
          </div>
          {order.diskon > 0 && (
            <div className="d-flex justify-content-between mb-1 text-danger">
              <span>Diskon</span>
              <span>- Rp {order.diskon.toLocaleString()}</span>
            </div>
          )}
          <div className="d-flex justify-content-between fw-bold border-top pt-2 mt-1">
            <span className="text-dark">TOTAL AKHIR</span>
            <span className="text-primary fs-5">Rp {order.total.toLocaleString()}</span>
          </div>
          <div className="d-flex justify-content-between mt-2 pt-2 border-top text-muted">
            <span>Bayar</span>
            <span className="fw-bold text-dark">Rp {order.bayar?.toLocaleString() || 0}</span>
          </div>
          <div className="d-flex justify-content-between mt-1 text-success">
            <span className="fw-bold">Kembalian</span>
            <span className="fw-bold">Rp {order.kembalian?.toLocaleString() || 0}</span>
          </div>
        </div>
      </div>

      {/* Button Group Dropdown (Paling Bawah) */}
      <div className="row g-2 px-1">
        <div className="col-6">
          <div className="dropdown">
            <button className="btn btn-outline-primary w-100 py-3 fw-bold dropdown-toggle shadow-sm" type="button" data-bs-toggle="dropdown">
              <i className="bi bi-printer me-2"></i>Cetak
            </button>
            <ul className="dropdown-menu shadow border-0 w-100">
              <li><button className="dropdown-item py-2 small" onClick={() => triggerPrint('thermal')}><i className="bi bi-file-earmark-text me-2 text-info"></i> Nota Thermal</button></li>
              <li><button className="dropdown-item py-2 small" onClick={() => triggerPrint('a4')}><i className="bi bi-file-earmark-pdf me-2 text-danger"></i> Nota PDF (A4)</button></li>
              <li><button className="dropdown-item py-2 small" onClick={() => triggerPrint('label')}><i className="bi bi-tag me-2 text-primary"></i> Label (Pcs)</button></li>
              <li><button className="dropdown-item py-2 small" onClick={() => triggerPrint('qr')}><i className="bi bi-qr-code me-2 text-dark"></i> Label QR Code</button></li>
            </ul>
          </div>
        </div>

        <div className="col-6">
          <div className="dropdown">
            <button className="btn btn-outline-primary w-100 py-3 fw-bold dropdown-toggle shadow-sm" type="button" data-bs-toggle="dropdown">
              <i className="bi bi-gear-fill me-2"></i>Aksi
            </button>
            <ul className="dropdown-menu dropdown-menu-end shadow border-0 w-100">
              <li><button className="dropdown-item py-2 small" onClick={setLunas}><i className="bi bi-check-circle me-2 text-success"></i> Jadikan Lunas</button></li>
              <li><button className="dropdown-item py-2 small" onClick={togglePriority}><i className={`bi ${order.isPriority ? 'bi-star-fill text-warning' : 'bi-star'} me-2`}></i> {order.isPriority ? 'Batal Prioritas' : 'Jadikan Prioritas'}</button></li>
              {/* <li><hr className="dropdown-divider" /></li>
              <li className="bg-primary-light"><button className="dropdown-item py-2 small fw-bold text-primary" onClick={() => printViaRawBT(order, pelanggan)}><i className="bi bi-bluetooth me-2"></i> Cetak Bluetooth</button></li>
              <li className="bg-success-light"><button className="dropdown-item py-2 small fw-bold text-success" onClick={() => printDirectBluetooth(order, pelanggan)}><i className="bi bi-lightning-fill me-2"></i> Direct Bluetooth</button></li> */}
              {/* <li><hr className="dropdown-divider" /></li>
              <li><button className="dropdown-item py-2 small text-danger" onClick={hapusTransaksi}><i className="bi bi-trash me-2"></i> Hapus Order</button></li> */}
            </ul>
          </div>
        </div>

        <div className="col-12">
          <button className="btn btn-outline-primary w-100 py-3 fw-bold shadow-sm mb-1" onClick={sendWhatsApp}>
            <i className="bi bi-whatsapp me-2"></i>Kirim WhatsApp
          </button>
        </div>
      </div>

      {/* Modal Edit Catatan */}
      {showNoteModal && (
        <>
          <div className="modal-backdrop fade show" style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.4)' }}></div>
          <div className="modal fade show d-block" tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered mx-3">
              <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '24px' }}>
                <div className="modal-header border-0 pb-0 pt-4 px-4">
                  <h5 className="fw-bold mb-0">Edit Catatan</h5>
                  <button type="button" className="btn-close" onClick={() => setShowNoteModal(false)}></button>
                </div>
                <div className="modal-body p-4">
                  <label className="small fw-bold text-muted text-uppercase mb-2">Pesan Tambahan</label>
                  <textarea
                    className="form-control border-0 bg-light rounded-4 p-3 mb-3"
                    value={catatan}
                    onChange={(e) => setCatatan(e.target.value)}
                    rows="4"
                    placeholder="Masukkan catatan pesanan di sini..."
                  ></textarea>
                  <button className="btn btn-outline-primary w-100 rounded-pill fw-bold py-3 shadow-sm" onClick={updateCatatan}>Lanjutkan</button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal Edit Inventory */}
      {showInventoryModal && (
        <>
          <div className="modal-backdrop fade show" style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.4)' }}></div>
          <div className="modal fade show d-block" tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered mx-3">
              <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '24px' }}>
                <div className="modal-header border-0 pb-0 pt-4 px-4">
                  <h5 className="fw-bold mb-0">Edit Inventory</h5>
                  <button type="button" className="btn-close" onClick={() => {
                    setShowInventoryModal(false);
                    setSelectedInventory(order.inventoryUsed || []);
                  }}></button>
                </div>
                <div className="modal-body p-4">
                  <label className="small fw-bold text-muted text-uppercase mb-3">Pilih Inventori & Jumlahnya</label>
                  <div className="d-flex flex-column gap-2 mb-4 max-h-50 overflow-auto">
                    {allInventory?.map(inv => {
                      const activeItem = selectedInventory.find(s => s.id === inv.id);
                      const isActive = !!activeItem;
                      return (
                        <div key={inv.id} className={`d-flex align-items-center justify-content-between p-3 rounded-4 border transition-all ${isActive ? 'bg-outline-primary text-dark border-primary shadow-sm' : 'bg-white text-dark shadow-sm'}`}>
                          <div className="d-flex align-items-center gap-3 flex-grow-1" style={{ cursor: 'pointer' }} onClick={() => toggleInventory(inv)}>
                            <i className={`bi ${isActive ? 'bi-check-circle-fill text-primary' : 'bi-box-seam'} fs-4`}></i>
                            <div>
                               <div className="fw-bold">{inv.nama}</div>
                               <small className={isActive ? 'text-primary-50' : 'text-muted'}>Sisa Stok: {inv.stok}</small>
                            </div>
                          </div>
                          {isActive && (
                            <div className="d-flex align-items-center gap-2 bg-white rounded-pill p-1 shadow-sm" onClick={e => e.stopPropagation()}>
                              <button className="btn btn-sm btn-light rounded-circle p-0 d-flex align-items-center justify-content-center" style={{ width: '16px', height: '16px' }} onClick={() => updateInventoryQty(inv.id, -1)}>
                                <i className="bi bi-dash text-primary"></i>
                              </button>
                              <span className="fw-bold text-primary px-1" style={{ fontSize: '0.9rem', minWidth: '20px', textAlign: 'center' }}>{activeItem.quantity || 1}</span>
                              <button className="btn btn-sm btn-light rounded-circle p-0 d-flex align-items-center justify-content-center" style={{ width: '16px', height: '16px' }} onClick={() => updateInventoryQty(inv.id, 1)}>
                                <i className="bi bi-plus text-primary"></i>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {(!allInventory || allInventory.length === 0) && (
                      <div className="w-100 text-center text-muted small p-3 bg-light rounded-4">Belum ada data inventory</div>
                    )}
                  </div>
                  <button className="btn btn-outline-primary w-100 rounded-pill fw-bold py-3" onClick={saveInventory}>Simpan Perubahan</button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal Edit HP WhatsApp */}
      {showHpModal && (
        <>
          <div className="modal-backdrop fade show" style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.4)' }}></div>
          <div className="modal fade show d-block" tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered mx-3">
              <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '24px' }}>
                <div className="modal-header border-0 pb-0 pt-4 px-4">
                  <h5 className="fw-bold mb-0">No. WhatsApp</h5>
                  <button type="button" className="btn-close" onClick={() => setShowHpModal(false)}></button>
                </div>
                <div className="modal-body p-4">
                  <p className="small text-muted mb-3">Pelanggan ini belum memiliki nomor HP. Silakan masukkan nomor HP untuk mengirim nota dan menyimpannya.</p>
                  <input
                    type="number"
                    className="form-control bg-light border-0 rounded-pill px-4 py-3 mb-3 fw-bold"
                    value={newHp}
                    onChange={(e) => setNewHp(e.target.value)}
                    placeholder="Contoh: 081234567890"
                    autoFocus
                  />
                  <button className="btn btn-outline-primary w-100 rounded-pill fw-bold py-3 shadow-sm" onClick={saveHpAndSend}>
                    <i className="bi bi-whatsapp me-2"></i>Simpan & Kirim
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal Konfirmasi */}
      {showConfirmModal && (
        <>
          <div className="modal-backdrop fade show"></div>
          <div className="modal fade show d-block" tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered mx-3">
              <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '20px' }}>
                <div className="modal-body text-center p-4">
                  <div className="icon-wrapper mb-3 mx-auto bg-warning-light d-flex align-items-center justify-content-center" style={{ width: '60px', height: '60px', backgroundColor: '#fff9c4', borderRadius: '50%' }}>
                    <i className="bi bi-exclamation-triangle text-warning fs-1"></i>
                  </div>
                  <h5 className="fw-bold mb-2">Konfirmasi Status</h5>
                  <p className="text-muted small mb-4">Apakah Anda yakin ingin mengembalikan status order ini ke <strong>PROSES</strong>?</p>
                  <div className="d-flex gap-2">
                    <button className="btn btn-outline-primary w-100 fw-bold py-2" onClick={() => setShowConfirmModal(false)} style={{ borderRadius: '10px' }}>Batal</button>
                    <button className="btn btn-outline-primary w-100 fw-bold py-2" onClick={() => updateStatus('Proses')} style={{ borderRadius: '10px' }}>Ya, Proses</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      </div>
    </>
  );
};

export default OrderDetail;
