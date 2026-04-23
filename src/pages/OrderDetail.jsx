import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { formatWhatsAppMessage } from '../utils/whatsapp';
import PrintLayout from '../components/PrintLayout';
import { printViaRawBT } from '../utils/rawbt';
import { printDirectBluetooth } from '../utils/bluetooth';

const OrderDetail = () => {
  const { id } = useParams();
  // const navigate = useNavigate();
  const order = useLiveQuery(() => db.orders.get(parseInt(id)));
  const pelanggan = useLiveQuery(() => order ? db.pelanggan.get(order.pelangganId) : null, [order]);

  const [catatan, setCatatan] = useState('');
  const [prevId, setPrevId] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [printType, setPrintType] = useState(null);

  if (order && order.id !== prevId) {
    setPrevId(order.id);
    setCatatan(order.catatan || '');
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
    await db.orders.update(order.id, { status });
    setShowConfirmModal(false);
  };

  const updateCatatan = async () => {
    await db.orders.update(order.id, { catatan });
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
    await db.orders.update(order.id, { isPriority: !order.isPriority });
  };

  const setLunas = async () => {
    await db.orders.update(order.id, { statusBayar: 'Lunas', bayar: order.total, kembalian: 0 });
  };

  const sendWhatsApp = () => {
    const waData = formatWhatsAppMessage(order, pelanggan);
    if (!waData) {
      toast.error('Nomor HP pelanggan tidak ditemukan!');
      return;
    }
    window.open(waData.url, '_blank');
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
            <h6 className="mb-0 text-primary fw-bold">Rp {order.total.toLocaleString()}</h6>
          </div>
          <div className="text-muted mb-1"><i className="bi bi-telephone me-1"></i> {pelanggan?.hp || '-'}</div>
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
            <button className="btn btn-info w-100 py-3 fw-bold text-white dropdown-toggle shadow-sm" type="button" data-bs-toggle="dropdown">
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
            <button className="btn btn-warning w-100 py-3 fw-bold dropdown-toggle shadow-sm" type="button" data-bs-toggle="dropdown">
              <i className="bi bi-gear-fill me-2"></i>Aksi
            </button>
            <ul className="dropdown-menu dropdown-menu-end shadow border-0 w-100">
              <li><button className="dropdown-item py-2 small" onClick={setLunas}><i className="bi bi-check-circle me-2 text-success"></i> Jadikan Lunas</button></li>
              <li><button className="dropdown-item py-2 small" onClick={togglePriority}><i className={`bi ${order.isPriority ? 'bi-star-fill text-warning' : 'bi-star'} me-2`}></i> {order.isPriority ? 'Batal Prioritas' : 'Jadikan Prioritas'}</button></li>
              <li><hr className="dropdown-divider" /></li>
              <li className="bg-primary-light"><button className="dropdown-item py-2 small fw-bold text-primary" onClick={() => printViaRawBT(order, pelanggan)}><i className="bi bi-bluetooth me-2"></i> Cetak Bluetooth</button></li>
              <li className="bg-success-light"><button className="dropdown-item py-2 small fw-bold text-success" onClick={() => printDirectBluetooth(order, pelanggan)}><i className="bi bi-lightning-fill me-2"></i> Direct Bluetooth</button></li>
              {/* <li><hr className="dropdown-divider" /></li>
              <li><button className="dropdown-item py-2 small text-danger" onClick={hapusTransaksi}><i className="bi bi-trash me-2"></i> Hapus Order</button></li> */}
            </ul>
          </div>
        </div>

        <div className="col-12">
          <button className="btn btn-success w-100 py-3 fw-bold shadow-sm mb-1" onClick={sendWhatsApp}>
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
                    <button className="btn btn-light w-100 fw-bold py-2" onClick={() => setShowConfirmModal(false)} style={{ borderRadius: '10px' }}>Batal</button>
                    <button className="btn btn-primary w-100 fw-bold py-2" onClick={() => updateStatus('Proses')} style={{ borderRadius: '10px' }}>Ya, Proses</button>
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
