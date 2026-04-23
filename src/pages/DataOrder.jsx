import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';

const DataOrder = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'Proses';
  const [activeTab, setActiveTab] = useState(initialTab);

  // State Filter
  const [filterAntar, setFilterAntar] = useState('Semua');
  const [filterBayar, setFilterBayar] = useState('Semua');
  const [filterPrioritas, setFilterPrioritas] = useState('Semua');

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
    alert('ID Order berhasil disalin!');
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
            {['Proses', 'Selesai', 'Ambil', 'Req Hapus'].map(tab => (
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
      <div className="row g-2 mb-3 align-items-end">
        <div className="col">
          <label className="small fw-bold text-muted mb-1 d-block text-center" style={{ fontSize: '0.65rem' }}>Status Antar</label>
          <select className="form-select form-select-sm" value={filterAntar} onChange={e => setFilterAntar(e.target.value)}>
            <option value="Semua">Semua</option>
            <option value="Datang Langsung">Datang Langsung</option>
            <option value="Jemput/Antar">Jemput/Antar</option>
          </select>
        </div>
        <div className="col">
          <label className="small fw-bold text-muted mb-1 d-block text-center" style={{ fontSize: '0.65rem' }}>Status Bayar</label>
          <select className="form-select form-select-sm" value={filterBayar} onChange={e => setFilterBayar(e.target.value)}>
            <option value="Semua">Semua</option>
            <option value="Lunas">Lunas</option>
            <option value="DP">DP</option>
            <option value="Belum Bayar">Belum Bayar</option>
          </select>
        </div>
        <div className="col">
          <label className="small fw-bold text-muted mb-1 d-block text-center" style={{ fontSize: '0.65rem' }}>Prioritas</label>
          <select className="form-select form-select-sm" value={filterPrioritas} onChange={e => setFilterPrioritas(e.target.value)}>
            <option value="Semua">Semua</option>
            <option value="Ya">Ya</option>
            <option value="Tidak">Tidak</option>
          </select>
        </div>
        <div className="col-auto">
          <button className="btn btn-primary btn-sm px-3">
            <i className="bi bi-search"></i>
          </button>
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

                <div className="d-flex gap-1 mb-3">
                  <span className={`badge rounded-pill ${order.statusBayar === 'Lunas' ? 'bg-success-light text-success' : 'bg-warning-light text-warning'}`} style={{ backgroundColor: '#d1f7e0', color: '#00a854', fontSize: '0.65rem' }}>
                    {order.statusBayar?.toLowerCase() || 'belum bayar'}
                  </span>
                  <span className="badge rounded-pill bg-info-light text-info" style={{ backgroundColor: '#e1f5fe', color: '#0288d1', fontSize: '0.65rem' }}>
                    cuci
                  </span>
                  <span className="badge rounded-pill bg-warning-light text-warning" style={{ backgroundColor: '#fff9c4', color: '#fbc02d', fontSize: '0.65rem' }}>
                    {order.tipeLayanan?.toLowerCase()}
                  </span>
                </div>

                <div className="row g-2">
                  <div className="col-6">
                    {activeTab === 'Proses' && (
                      <button className="btn btn-primary btn-sm w-100 fw-bold" onClick={() => updateStatus(order.id, 'Selesai')}>Jadikan Selesai</button>
                    )}
                    {activeTab === 'Selesai' && (
                      <button className="btn btn-success btn-sm w-100 fw-bold" onClick={() => updateStatus(order.id, 'Ambil')}>Siap Ambil</button>
                    )}
                    {activeTab === 'Ambil' && (
                      <button className="btn btn-dark btn-sm w-100 fw-bold disabled">Sudah Diambil</button>
                    )}
                  </div>
                  <div className="col-6">
                    <button className="btn btn-outline-primary btn-sm w-100 fw-bold" onClick={() => navigate(`/order/${order.id}`)}>Detail Nota</button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default DataOrder;
