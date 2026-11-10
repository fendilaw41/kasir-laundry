import { useLiveQuery } from 'dexie-react-hooks';
import { getOrdersSortedByDateQuery, updateOrder, deleteOrder } from '../db/repositories/orders';
import { pullOrdersFromBackend, syncTwoWay } from '../services/syncService';
import { isStatusLunas } from '../utils/paymentStatus';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { TOAST_MESSAGES, CONFIRM_MESSAGES, BUTTON_TITLE } from '../constants/appConstants';
import { OrderListSkeleton } from '../components/common/Skeleton';
import { db } from '../db';
import PlanGateModal from '../components/PlanGateModal';
import { getSubscriptionReport, isTrialExpired, isPaidExpired } from '../services/subscriptionService';

const DataOrder = ({ user }) => {
  const navigate = useNavigate();
  const allUsers = useLiveQuery(() => db.users.toArray(), []);
  const currentUserRole = user?.role || JSON.parse(sessionStorage.getItem('user') || '{}')?.role;
  const isOwner = currentUserRole === 'owner';

  const getKasirUsername = (order) => {
    if (order.kasirUsername) return order.kasirUsername;
    if (order.user?.username) return order.user.username;
    if (order.userId && allUsers) {
      const u = allUsers.find(userItem => userItem.uuid === order.userId || String(userItem.id) === String(order.userId));
      if (u) return u.username || u.fullname;
    }
    return '-';
  };
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'Proses';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [gateModalConfig, setGateModalConfig] = useState({ open: false, type: 'SUBSCRIPTION_EXPIRED', plan: '', isTrial: false });

  // Tarik data order terbaru dari backend saat membuka halaman
  useEffect(() => {
    pullOrdersFromBackend().catch(err => console.warn('[DataOrder] Auto pull error:', err));
  }, []);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await syncTwoWay();
      toast.success(TOAST_MESSAGES.SUCCESS);
    } catch (err) {
      toast.error(TOAST_MESSAGES.ERROR);
    } finally {
      setIsRefreshing(false);
    }
  };

  // State Filter
  const [filterAntar, setFilterAntar] = useState('Semua');
  const [filterBayar, setFilterBayar] = useState('Semua');
  const [filterPrioritas, setFilterPrioritas] = useState('Semua');

  // State Modal Konfirmasi
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmData, setConfirmData] = useState({ id: null, type: '', message: '' });

  // Query Data dengan Filter
  const orders = useLiveQuery(async () => {
    const allOrders = await getOrdersSortedByDateQuery();

    return allOrders.filter(order => {
      const matchTab = order.status === activeTab || (!order.status && activeTab === 'Proses') || (order.status === 'Baru' && activeTab === 'Proses');
      const matchAntar = filterAntar === 'Semua' || order.tipeLayanan === filterAntar || order.status === 'Baru';
      const matchBayar = filterBayar === 'Semua' || (filterBayar === 'Lunas' ? isStatusLunas(order.statusBayar) : (filterBayar === 'DP' ? order.statusBayar === 'DP' : !isStatusLunas(order.statusBayar)));
      const matchPrioritas = filterPrioritas === 'Semua' || (filterPrioritas === 'Ya' ? order.isPriority : !order.isPriority);

      return matchTab && matchAntar && matchBayar && matchPrioritas;
    });
  }, [activeTab, filterAntar, filterBayar, filterPrioritas]);


  const handleCopy = (e, text) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    toast.success(TOAST_MESSAGES.SUCCESS);
  };

  const requestDelete = (id) => {
    setConfirmData({
      id,
      type: 'request',
      message: CONFIRM_MESSAGES.CANCEL_ORDER
    });
    setShowConfirmModal(true);
  };

  const hardDelete = (id) => {
    setConfirmData({
      id,
      type: 'hard',
      message: CONFIRM_MESSAGES.DELETE_ORDER
    });
    setShowConfirmModal(true);
  };

  const confirmSelesai = (id) => {
    setConfirmData({
      id,
      type: 'selesai',
      message: CONFIRM_MESSAGES.FINISH_ORDER
    });
    setShowConfirmModal(true);
  };

  const confirmAmbil = (id) => {
    setConfirmData({
      id,
      type: 'ambil',
      message: CONFIRM_MESSAGES.TAKE_ORDER
    });
    setShowConfirmModal(true);
  };

  const handleExecuteAction = async () => {
    if (!confirmData.id) return;

    try {
      const sub = await getSubscriptionReport().catch(() => null);
      if (isPaidExpired(sub)) {
        setShowConfirmModal(false);
        setGateModalConfig({
          open: true,
          type: 'SUBSCRIPTION_EXPIRED',
          plan: sub?.plan,
          isTrial: false,
        });
        return;
      }
      if ((confirmData.type === 'request' || confirmData.type === 'hard') && isTrialExpired(sub)) {
        setShowConfirmModal(false);
        setGateModalConfig({
          open: true,
          type: 'TRIAL_EXPIRED',
          plan: 'TRIAL',
          isTrial: true,
        });
        return;
      }
    } catch (e) {}

    try {
      if (confirmData.type === 'request') {
        await updateOrder(confirmData.id, { status: 'Dibatalkan' });
        toast.success(TOAST_MESSAGES.SUCCESS);
      } else if (confirmData.type === 'hard') {
        await deleteOrder(confirmData.id);
        toast.success(TOAST_MESSAGES.SUCCESS);
      } else if (confirmData.type === 'selesai') {
        await updateOrder(confirmData.id, { status: 'Selesai' });
        toast.success(TOAST_MESSAGES.SUCCESS);
      } else if (confirmData.type === 'ambil') {
        await updateOrder(confirmData.id, { status: 'Ambil' });
        toast.success(TOAST_MESSAGES.SUCCESS);
      }
      setShowConfirmModal(false);
    } catch (error) {
      toast.error(error?.message || TOAST_MESSAGES.ERROR);
      setShowConfirmModal(false);
    }
  };

  return (
    <div className="data-order-wrapper pb-5">
      <div className="d-flex justify-content-between align-items-center mb-2.5 pt-1">
        <small className="text-muted fw-semibold" style={{ fontSize: '0.78rem' }}>
          <i className="bi bi-list-check me-1 mb-2 text-primary"></i>
          {orders?.length || 0} order terdaftar
        </small>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="btn btn-sm btn-light border rounded-pill px-2.5 mb-3 py-1 shadow-xs d-flex align-items-center gap-1.5 text-primary fw-semibold"
          style={{ fontSize: '0.78rem' }}
          title="Sinkronisasi Data"
        >
          <i className="bi bi-arrow-clockwise"></i>
        </button>
      </div>

      {/* Tabs */}
      <div className="card shadow-sm border-0 mb-3">
        <div className="card-body p-0">
          <ul className="nav nav-tabs nav-fill border-0">
            {['Proses', 'Selesai', 'Ambil', 'Dibatalkan'].map(tab => (
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
        {orders === undefined ? (
          <OrderListSkeleton count={3} />
        ) : orders.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <i className="bi bi-inbox fs-1 d-block mb-2"></i>
            <p>Tidak ada data order</p>
          </div>
        ) : (
          orders.map(order => (
            <div className="card shadow-sm border-0 mb-3" key={order.id}>
              <div className="card-body p-3">
                <div className="d-flex justify-content-between mb-1">
                  <div className="d-flex align-items-center flex-wrap gap-1">
                    <span className="text-primary fw-bold small">{order.invoiceId}</span>
                    <i className="bi bi-clipboard ms-1 text-muted" style={{ cursor: 'pointer', fontSize: '0.8rem' }} onClick={(e) => handleCopy(e, `${order.invoiceId}/${order.id}`)}></i>
                    {order.isPriority && <span className="badge bg-danger ms-1" style={{ fontSize: '0.55rem' }}>PRIORITAS</span>}
                  
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
                <div className="d-flex justify-content-between mb-2">
                  {isOwner && (
                      <span
                        className="badge rounded-pill d-inline-flex align-items-center gap-1"
                        style={{
                          backgroundColor: '#eef2ff',
                          color: '#4338ca',
                          fontSize: '0.65rem',
                          fontWeight: '600',
                          border: '1px solid #c7d2fe'
                        }}
                        title="Kasir yang memproses order ini"
                      >
                        <i className="bi bi-person-fill"></i>
                        <span>Kasir: {getKasirUsername(order)}</span>
                      </span>
                    )}
                </div>

                {order.catatan && (
                  <div className="mb-2 p-2 rounded-3 border-start border-3 border-info" style={{ fontSize: '0.7rem', backgroundColor: '#f0faff' }}>
                    <div className="d-flex align-items-center gap-1 text-info fw-bold mb-0.5">
                      <i className="bi bi-tag-fill"></i>
                      <span>Catatan Pelanggan:</span>
                    </div>
                    <span className="text-dark">{order.catatan}</span>
                  </div>
                )}

                {order.catatanKasir && (
                  <div className="mb-2 p-2 rounded-3 border-start border-3 border-warning" style={{ fontSize: '0.7rem', backgroundColor: '#fffdf0' }}>
                    <div className="d-flex align-items-center gap-1 text-warning-emphasis fw-bold mb-0.5">
                      <i className="bi bi-shield-lock-fill text-warning"></i>
                      <span>Note Kasir:</span>
                    </div>
                    <span className="text-dark">{order.catatanKasir}</span>
                  </div>
                )}

                <div className="d-flex gap-1 mb-3">
                  <span
                    className={`badge rounded-pill ${isStatusLunas(order.statusBayar) ? 'bg-success-light text-success' : 'bg-warning-light text-warning'}`}
                    style={{
                      backgroundColor: isStatusLunas(order.statusBayar) ? '#d1f7e0' : '#fff3cd',
                      color: isStatusLunas(order.statusBayar) ? '#00a854' : '#856404',
                      fontSize: '0.65rem'
                    }}
                  >
                    {order.statusBayar?.toLowerCase() || 'belum bayar'}
                  </span>
                  <span className="badge rounded-pill bg-warning-light text-warning" style={{ backgroundColor: '#fff9c4', color: '#fbc02d', fontSize: '0.65rem' }}>
                    {order.tipeLayanan?.toLowerCase()}
                  </span>
                </div>

                <div className="row g-2 mt-2">
                  <div className={
                    activeTab === 'Proses'
                      ? 'col-4'
                      : activeTab === 'Selesai'
                        ? (user?.role === 'owner' ? 'col-4' : 'col-6')
                        : (user?.role === 'owner' ? 'col-6' : 'col-12')
                  }>
                    <button className="btn btn-outline-primary btn-sm w-100 fw-bold shadow-sm" onClick={() => navigate(`/order/${order.id}`)}>Detail</button>
                  </div>

                  {activeTab === 'Proses' && (
                    <div className="col-4">
                      <button className="btn btn-outline-primary btn-sm w-100 fw-bold shadow-sm" onClick={() => confirmSelesai(order.id)}>Selesai</button>
                    </div>
                  )}

                  {activeTab === 'Selesai' && (
                    <div className={user?.role === 'owner' ? 'col-4' : 'col-6'}>
                      <button className="btn btn-outline-primary btn-sm w-100 fw-bold shadow-sm" onClick={() => confirmAmbil(order.id)}>Ambil</button>
                    </div>
                  )}

                  {activeTab === 'Dibatalkan' && user?.role === 'owner' && (
                    <div className="col-6">
                      <button className="btn btn-outline-danger btn-sm w-100 fw-bold shadow-sm" onClick={() => hardDelete(order.id)} title={BUTTON_TITLE.DELETE}>
                        Hapus
                      </button>
                    </div>
                  )}

                  {/* Kasir boleh delete jika masih proses (hanya request delete). Owner boleh langsung hapus di Proses dan Selesai */}
                  {((activeTab === 'Proses') || (activeTab === 'Selesai' && user?.role === 'owner')) && (
                    <div className="col-4 text-end">
                      <button
                        className="btn btn-outline-danger btn-sm w-100 fw-bold shadow-sm"
                        onClick={() => (user?.role === 'owner' ? hardDelete(order.id) : requestDelete(order.id))}
                        title={BUTTON_TITLE.DELETE}
                      >
                        Hapus
                      </button>
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
                    <i className={`bi ${confirmData.type === 'hard' ? 'bi-exclamation-octagon text-danger' : (confirmData.type === 'selesai' || confirmData.type === 'ambil') ? 'bi-check-circle text-success' : 'bi-exclamation-circle text-warning'} `} style={{ fontSize: '3.5rem' }}></i>
                  </div>
                  <h5 className="fw-bold mb-2">Konfirmasi Tindakan</h5>
                  <p className="text-muted small mb-4">{confirmData.message}</p>

                  <div className="d-flex gap-2">
                    <button className="btn btn-outline-primary w-100 rounded-pill fw-bold py-2" onClick={() => setShowConfirmModal(false)}>Batal</button>
                    <button
                      className="btn btn-outline-primary w-100 rounded-pill fw-bold py-2 shadow-sm"
                      onClick={handleExecuteAction}
                    >
                      {confirmData.type === 'hard' ? 'Hapus' : confirmData.type === 'selesai' ? 'Ya, Selesai' : confirmData.type === 'ambil' ? 'Ya, Ambil' : 'Ya, Ajukan'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Plan Gate Modal untuk EXPIRED (TRIAL / PAID) */}
      <PlanGateModal
        isOpen={gateModalConfig.open}
        onClose={() => setGateModalConfig((prev) => ({ ...prev, open: false }))}
        type={gateModalConfig.type}
        customData={{ plan: gateModalConfig.plan, isTrial: gateModalConfig.isTrial }}
        user={user}
      />
    </div>
  );
};

export default DataOrder;
