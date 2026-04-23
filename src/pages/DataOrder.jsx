import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import toast from 'react-hot-toast';

const DataOrder = ({ user }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'Proses';
  const [activeTab, setActiveTab] = useState(initialTab);

  // State Filter
  const [filterAntar, setFilterAntar] = useState('Semua');
  const [filterBayar, setFilterBayar] = useState('Semua');
  const [filterPrioritas, setFilterPrioritas] = useState('Semua');

  // State Modal Konfirmasi
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmData, setConfirmData] = useState({ id: null, type: '', message: '' });

  // Query Data dengan Filter
  const orders = useLiveQuery(async () => {
    let collection = db.orders.orderBy('createdAt').reverse();

    const allOrders = await collection.toArray();

    return allOrders.filter(order => {
      const matchTab = order.status === activeTab || (!order.status && activeTab === 'Proses');
      const matchAntar = filterAntar === 'Semua' || order.tipeLayanan === filterAntar;
      const matchBayar = filterBayar === 'Semua' || order.statusBayar === filterBayar;
      const matchPrioritas = filterPrioritas === 'Semua' || (filterPrioritas === 'Ya' ? order.isPriority : !order.isPriority);

      return matchTab && matchAntar && matchBayar && matchPrioritas;
    });
  }, [activeTab, filterAntar, filterBayar, filterPrioritas]);

  const updateStatus = async (id, newStatus) => {
    await db.orders.update(id, { status: newStatus });
  };

  const handleCopy = (e, text) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    toast.success('ID Order berhasil disalin!');
  };

  const requestDelete = (id) => {
    setConfirmData({
      id,
      type: 'request',
      message: 'Apakah Anda yakin ingin mengajukan penghapusan untuk order ini?'
    });
    setShowConfirmModal(true);
  };

  const hardDelete = (id) => {
    setConfirmData({
      id,
      type: 'hard',
      message: 'PERINGATAN: Order akan dihapus secara permanen dari database. Lanjutkan?'
    });
    setShowConfirmModal(true);
  };

  const handleExecuteAction = async () => {
    if (!confirmData.id) return;

    if (confirmData.type === 'request') {
      await db.orders.update(confirmData.id, { status: 'Req Hapus' });
      toast.success('Permintaan hapus terkirim');
    } else if (confirmData.type === 'hard') {
      await db.orders.delete(confirmData.id);
      toast.success('Order berhasil dihapus permanen');
    }

    setShowConfirmModal(false);
  };

  return (
    <div className="data-order-wrapper pb-5">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0 fw-bold">Data Order</h5>
        <i className="bi bi-arrow-clockwise fs-5" onClick={() => window.location.reload()} style={{ cursor: 'pointer' }}></i>
      </div>

      {/* Tabs */}
      <div className="card shadow-sm border-0 mb-3">
        <div className="card-body p-0">
          <ul className="nav nav-tabs nav-fill border-0">
            {['Proses', 'Selesai', 'Ambil', user.role === 'owner' ? 'Req Hapus' : null].filter(Boolean).map(tab => (
              <li className="nav-item" key={tab}>
                <button
                  className={`nav-link border-0 fw-bold py-3 ${activeTab === tab ? 'active border-bottom border-primary text-primary' : 'text-muted'}`}
                  onClick={() => setActiveTab(tab)}
                  style={{ fontSize: '0.75rem' }}
                >
                  {tab.toUpperCase()}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Filters */}
      <div className="row g-2 mb-4">
        <div className="col-4 text-center">
          <label className="small fw-bold text-muted mb-1 d-block" style={{ fontSize: '0.65rem' }}>Layanan</label>
          <select className="form-select form-select-sm border-0 shadow-sm rounded-3" style={{ fontSize: '0.7rem' }} value={filterAntar} onChange={e => setFilterAntar(e.target.value)}>
            <option value="Semua">Semua</option>
            <option value="Datang Langsung">Datang</option>
            <option value="Jemput/Antar">Antar</option>
          </select>
        </div>
        <div className="col-4 text-center">
          <label className="small fw-bold text-muted mb-1 d-block" style={{ fontSize: '0.65rem' }}>Bayar</label>
          <select className="form-select form-select-sm border-0 shadow-sm rounded-3" style={{ fontSize: '0.7rem' }} value={filterBayar} onChange={e => setFilterBayar(e.target.value)}>
            <option value="Semua">Semua</option>
            <option value="Lunas">Lunas</option>
            <option value="DP">DP</option>
            <option value="Belum Bayar">Belum</option>
          </select>
        </div>
        <div className="col-4 text-center">
          <label className="small fw-bold text-muted mb-1 d-block" style={{ fontSize: '0.65rem' }}>Prioritas</label>
          <select className="form-select form-select-sm border-0 shadow-sm rounded-3" style={{ fontSize: '0.7rem' }} value={filterPrioritas} onChange={e => setFilterPrioritas(e.target.value)}>
            <option value="Semua">Semua</option>
            <option value="Ya">Ya</option>
            <option value="Tidak">Tidak</option>
          </select>
        </div>
      </div>

      {/* Order List */}
      <div className="order-list">
        {orders?.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <i className="bi bi-inbox fs-1 d-block mb-2"></i>
            <p>Tidak ada data order</p>
          </div>
        ) : (
          orders?.map(order => (
            <div className="card shadow-sm border-0 mb-3" key={order.id}>
              <div className="card-body p-3">
                <div className="d-flex justify-content-between mb-1">
                  <div className="d-flex align-items-center">
                    <span className="text-primary fw-bold small">ID: {order.invoiceId}</span>
                    <i className="bi bi-clipboard ms-2 text-muted" style={{ cursor: 'pointer', fontSize: '0.8rem' }} onClick={(e) => handleCopy(e, `${order.invoiceId}/${order.id}`)}></i>
                    {order.isPriority && <span className="badge bg-danger ms-2" style={{ fontSize: '0.55rem' }}>PRIORITAS</span>}
                  </div>
                  <span className="text-muted small">{new Date(order.createdAt).toLocaleString('id-ID')}</span>
                </div>
                <div className="d-flex justify-content-between mb-1">
                  <span className="fw-bold">{order.pelangganNama || 'Umum'}</span>
                  <span className="fw-bold">Rp {order.total.toLocaleString()}</span>
                </div>
                <div className="d-flex justify-content-between mb-2">
                  <span className="small text-muted">Est Selesai :</span>
                  <span className="small text-muted">{new Date(new Date(order.createdAt).getTime() + (order.estimasi * 86400000)).toLocaleDateString('id-ID')}</span>
                </div>

                {order.catatan && (
                  <div className="mb-3 p-2 rounded-3 bg-light border-start border-3 border-info" style={{ fontSize: '0.7rem', backgroundColor: '#f0faff !important' }}>
                    <i className="bi bi-pencil-square me-2 text-info"></i>
                    <span className="text-dark">{order.catatan}</span>
                  </div>
                )}

                <div className="d-flex gap-1 mb-3">
                  <span className={`badge rounded-pill ${order.statusBayar === 'Lunas' ? 'bg-success-light text-success' : 'bg-warning-light text-warning'}`} style={{ backgroundColor: '#d1f7e0', color: '#00a854', fontSize: '0.65rem' }}>
                    {order.statusBayar?.toLowerCase() || 'belum bayar'}
                  </span>
                  <span className="badge rounded-pill bg-warning-light text-warning" style={{ backgroundColor: '#fff9c4', color: '#fbc02d', fontSize: '0.65rem' }}>
                    {order.tipeLayanan?.toLowerCase()}
                  </span>
                </div>

                <div className="row g-2 mt-2">
                  <div className={user.role === 'owner' ? 'col-4' : 'col-6'}>
                    {activeTab === 'Proses' && (
                      <button className="btn btn-primary btn-sm w-100 fw-bold shadow-sm" onClick={() => updateStatus(order.id, 'Selesai')}>Selesai</button>
                    )}
                    {activeTab === 'Selesai' && (
                      <button className="btn btn-success btn-sm w-100 fw-bold shadow-sm" onClick={() => updateStatus(order.id, 'Ambil')}>Ambil</button>
                    )}
                    {activeTab === 'Ambil' && (
                      <button className="btn btn-dark btn-sm w-100 fw-bold disabled opacity-50">Lunas</button>
                    )}
                    {activeTab === 'Req Hapus' && (
                      <button className="btn btn-danger btn-sm w-100 fw-bold shadow-sm" onClick={() => hardDelete(order.id)}>Hapus</button>
                    )}
                  </div>
                  <div className={user.role === 'owner' ? 'col-4' : 'col-6'}>
                    <button className="btn btn-outline-primary btn-sm w-100 fw-bold shadow-sm" onClick={() => navigate(`/order/${order.id}`)}>Nota</button>
                  </div>
                  {user.role === 'owner' && (
                    <div className="col-4 text-end">
                      {(activeTab === 'Proses' || activeTab === 'Selesai') && (
                        <button className="btn btn-outline-danger btn-sm w-100 fw-bold shadow-sm" onClick={() => requestDelete(order.id)}>Hapus</button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Konfirmasi Kustom */}
      {showConfirmModal && (
        <>
          <div className="modal-backdrop fade show" style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.4)' }}></div>
          <div className="modal fade show d-block" tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered mx-auto px-4" style={{ maxWidth: '400px' }}>
              <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '24px' }}>
                <div className="modal-body p-4 text-center">
                  <div className="mb-3">
                    <i className={`bi ${confirmData.type === 'hard' ? 'bi-exclamation-octagon text-danger' : 'bi-exclamation-circle text-warning'} `} style={{ fontSize: '3.5rem' }}></i>
                  </div>
                  <h5 className="fw-bold mb-2">Konfirmasi Tindakan</h5>
                  <p className="text-muted small mb-4">{confirmData.message}</p>

                  <div className="d-flex gap-2">
                    <button className="btn btn-light w-100 rounded-pill fw-bold py-2" onClick={() => setShowConfirmModal(false)}>Batal</button>
                    <button
                      className={`btn ${confirmData.type === 'hard' ? 'btn-danger' : 'btn-primary'} w-100 rounded-pill fw-bold py-2 shadow-sm`}
                      onClick={handleExecuteAction}
                    >
                      {confirmData.type === 'hard' ? 'Hapus' : 'Ya, Ajukan'}
                    </button>
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

export default DataOrder;
