import { useLiveQuery } from 'dexie-react-hooks';
import { getOrdersSortedByDateQuery, updateOrder, deleteOrder } from '../db/repositories/orders';
import { pullOrdersFromBackend, syncTwoWay } from '../services/syncService';
import { isStatusLunas } from '../utils/paymentStatus';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { TOAST_MESSAGES, CONFIRM_MESSAGES, BUTTON_TITLE } from '../constants/appConstants';
import { OrderListSkeleton } from '../components/common/Skeleton';
import { db } from '../db';
import PlanGateModal from '../components/PlanGateModal';
import { getSubscriptionReport, getCachedSubscriptionReportSync, isTrialExpired, isPaidExpired } from '../services/subscriptionService';

/* Gaya khusus halaman Data Order (prefix .do-). Dibuat sendiri karena kelas seperti
   gap-1.5 / p-2.5 / mb-1.5 TIDAK ada di Bootstrap 5, jadi spasi sebelumnya tidak terkontrol. */
const DO_CSS = `
.do-wrap { padding: 10px 12px 24px; }
.do-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
.do-count { display: inline-flex; align-items: center; gap: 5px; font-size: .74rem; font-weight: 600; color: #5f5a86; }
.do-count i { color: #0d5afd; }
.do-tools { display: flex; align-items: center; gap: 6px; }
.do-pill {
  height: 28px; padding: 0 11px; border-radius: 999px; border: 1px solid #e1e6fa; background: #fff; color: #1f0757;
  font-size: .72rem; font-weight: 600; display: inline-flex; align-items: center; gap: 5px; cursor: pointer; line-height: 1;
}
.do-pill.on { background: #0134d4; border-color: #0134d4; color: #fff; }
.do-pill.sq { width: 28px; padding: 0; justify-content: center; color: #0d5afd; }
.do-pill:disabled { opacity: .6; }
.do-tabs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px; padding: 3px; margin-bottom: 6px; background: #fff; border: 1px solid #e8ebfa; border-radius: 13px; }
.do-tab {
  height: 28px; border: 0; border-radius: 10px; background: transparent; color: #8480ae; font-size: .66rem; font-weight: 700;
  letter-spacing: .03em; display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.do-tab.on { background: #0d5afd; color: #fff; box-shadow: 0 6px 12px -6px rgba(13, 90, 253, .7); }
.do-filters { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 8px; }
.do-sel {
  width: 100%; height: 30px; padding: 0 20px 0 8px; border: 1px solid #e1e6fa; border-radius: 10px; color: #1f0757; font-size: .66rem; font-weight: 500;
  appearance: none; -webkit-appearance: none; background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none' stroke='%238480ae' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M1 1l4 4 4-4'/%3E%3C/svg%3E") no-repeat right 8px center;
}
.do-selall { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 10px; margin-bottom: 6px; background: #fff; border: 1px solid #e1e6fa; border-radius: 12px; font-size: .72rem; }
.do-selall label { display: inline-flex; align-items: center; gap: 8px; margin: 0; font-weight: 700; color: #1f0757; }
.do-selall button { border: 0; background: none; color: #8480ae; font-size: .7rem; padding: 0; }
.do-chk { width: 17px; height: 17px; accent-color: #0d5afd; flex: none; margin: 0; }
.do-list { display: flex; flex-direction: column; gap: 6px; }
.do-card { position: relative; overflow: hidden; border-radius: 14px; border: 1px solid #e8ebfa; background: #fff; touch-action: pan-y; }
.do-card.sel { border-color: #0d5afd; }
.do-swipe { position: absolute; inset: 0; z-index: 1; display: flex; align-items: center; gap: 6px; padding-left: 14px; background: #ef4444; color: #fff; font-size: .72rem; font-weight: 700; }
.do-fg { position: relative; z-index: 2; background: #fff; padding: 7px 10px 8px; }
.do-card.sel .do-fg { background: #f5f8ff; }
.do-r1 { display: flex; align-items: center; justify-content: space-between; gap: 6px; min-height: 20px; }
.do-r1 .l { display: flex; align-items: center; gap: 5px; min-width: 0; }
.do-inv { font-size: .76rem; font-weight: 700; color: #0d5afd; white-space: nowrap; }
.do-copy { font-size: .72rem; color: #a3a9c9; cursor: pointer; padding: 2px; }
.do-prio { font-size: .5rem; font-weight: 800; letter-spacing: .03em; padding: 2px 5px; border-radius: 5px; background: #ef4444; color: #fff; }
.do-icw { position: relative; display: inline-flex; }
button.do-ic { border: 0; padding: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.do-tip {
  position: absolute; top: 25px; left: 50%; transform: translateX(-50%); z-index: 6; padding: 5px 10px; border-radius: 9px;
  background: #1f0757; color: #fff; font-size: .68rem; font-weight: 600; line-height: 1.2; white-space: nowrap; pointer-events: none;
  box-shadow: 0 10px 20px -8px rgba(31, 7, 87, .5); animation: do-pop .15s ease-out;
}
.do-tip::before { content: ''; position: absolute; top: -4px; left: 50%; width: 8px; height: 8px; background: #1f0757; transform: translateX(-50%) rotate(45deg); border-radius: 2px; }
@keyframes do-pop { from { opacity: 0; transform: translate(-50%, -4px); } to { opacity: 1; transform: translate(-50%, 0); } }
.do-ic { width: 20px; height: 20px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: .66rem; flex: none; }
.do-ic.kasir { background: #eef2ff; color: #4338ca; }
.do-ic.ok { background: #d9f6e6; color: #0e8f55; }
.do-ic.wait { background: #fff1cf; color: #a76a00; }
.do-ic.srv { background: #e9f0ff; color: #0134d4; }
.do-date { font-size: .64rem; color: #8480ae; white-space: nowrap; }
.do-r2 { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-top: 1px; }
.do-name { font-size: .8rem; font-weight: 700; color: #1f0757; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.do-total { font-size: .84rem; font-weight: 700; color: #0d5afd; white-space: nowrap; }
.do-notes { display: flex; gap: 6px; margin-top: 3px; }
.do-note { flex: 1; min-width: 0; display: flex; align-items: center; gap: 4px; padding: 2px 7px; border-radius: 7px; font-size: .64rem; color: #1f0757; background: #eef7ff; border-left: 2px solid #38bdf8; }
.do-note.k { background: #fff9e6; border-left-color: #f5b301; }
.do-note span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.do-note i { font-size: .66rem; color: #0284c7; flex: none; }
.do-note.k i { color: #b78103; }
.do-r3 { display: flex; align-items: center; gap: 8px; margin-top: 5px; }
.do-est { font-size: .62rem; color: #8480ae; white-space: nowrap; line-height: 1.15; }
.do-est b { display: block; font-size: .66rem; color: #5f5a86; font-weight: 600; }
.do-btns { flex: 1; display: grid; gap: 5px; }
.do-b {
  height: 26px; border-radius: 999px; border: 1px solid #0d5afd; background: #fff; color: #0d5afd; font-size: .7rem; font-weight: 700;
  display: inline-flex; align-items: center; justify-content: center; gap: 4px; cursor: pointer; padding: 0; line-height: 1;
}
.do-b.p { background: #0d5afd; color: #fff; }
.do-b.d { border-color: #f3b4b6; color: #e5484d; }
.do-empty { text-align: center; padding: 36px 0; color: #8480ae; background: #fff; border-radius: 14px; border: 1px solid #e8ebfa; }
.do-empty i { display: block; font-size: 1.8rem; opacity: .5; margin-bottom: 4px; }
.do-empty p { margin: 0; font-size: .8rem; }
/* Bar ikut di bawah daftar (tidak ada gap); saat daftar panjang menempel di atas menu bawah */
.do-bulk { position: sticky; bottom: 70px; z-index: 1050; margin-top: 8px; animation: do-up .2s ease-out; }
.do-bulk-in { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 10px; background: #fff; border: 1px solid #e1e6fa; border-radius: 18px; box-shadow: 0 16px 30px -12px rgba(31, 7, 87, .35); }
.do-bulk-in b { font-size: .76rem; color: #1f0757; padding-left: 4px; white-space: nowrap; }
.do-bulk-in .g { display: flex; gap: 6px; }
.do-bulk-in .do-b { height: 32px; padding: 0 12px; }
@keyframes do-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
`;

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

  // State Bulk Status
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // State Touch Swipe Right to Delete
  const touchStartRef = useRef({});
  const [swipeOffset, setSwipeOffset] = useState({});

  // Tooltip badge ikon (tap di Android/HP): { id, key } -> hilang otomatis / tap di luar
  const [tip, setTip] = useState(null);
  useEffect(() => {
    if (!tip) return undefined;
    const timer = setTimeout(() => setTip(null), 2600);
    const close = () => setTip(null);
    document.addEventListener('click', close);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', close);
    };
  }, [tip]);
  const showTip = (e, id, key) => {
    e.stopPropagation();
    setTip((prev) => (prev && prev.id === id && prev.key === key ? null : { id, key }));
  };

  const handleTouchStart = (e, orderId) => {
    if (isBulkMode) return;
    touchStartRef.current[orderId] = e.touches[0].clientX;
  };

  const handleTouchMove = (e, orderId) => {
    if (isBulkMode) return;
    const startX = touchStartRef.current[orderId];
    if (startX === undefined) return;
    const currentX = e.touches[0].clientX;
    const diffX = currentX - startX;
    if (diffX > 0 && diffX < 120) {
      setSwipeOffset((prev) => ({ ...prev, [orderId]: diffX }));
    }
  };

  const handleTouchEnd = (order) => {
    if (isBulkMode) return;
    const offset = swipeOffset[order.id] || 0;
    setSwipeOffset((prev) => ({ ...prev, [order.id]: 0 }));
    delete touchStartRef.current[order.id];

    if (offset > 65) {
      const isProses = order.status === 'Proses' || (!order.status && activeTab === 'Proses') || order.status === 'Baru';
      if (isProses) {
        if (isOwner) {
          hardDelete(order.id);
        } else {
          requestDelete(order.id);
        }
      } else {
        toast('Geser hapus hanya berlaku untuk order yang masih status Proses', { icon: 'ℹ️' });
      }
    }
  };

  const handleBulkChangeStatus = async (targetStatus) => {
    if (selectedOrderIds.length === 0 || isBulkProcessing) return;
    const sub = getCachedSubscriptionReportSync();
    if (isPaidExpired(sub)) {
      setGateModalConfig({
        open: true,
        type: 'SUBSCRIPTION_EXPIRED',
        plan: sub?.plan,
        isTrial: false,
      });
      return;
    }
    setIsBulkProcessing(true);
    try {
      let count = 0;
      for (const id of selectedOrderIds) {
        try {
          await updateOrder(id, { status: targetStatus });
          count++;
        } catch (err) {
          console.warn(`[BulkStatus] Gagal update order ${id}:`, err);
        }
      }
      toast.success(`${count} order berhasil diubah ke status ${targetStatus}`);
      setSelectedOrderIds([]);
      setIsBulkMode(false);
    } catch (e) {
      toast.error(TOAST_MESSAGES.ERROR);
    } finally {
      setIsBulkProcessing(false);
    }
  };

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
    setShowConfirmModal(false);

    const sub = getCachedSubscriptionReportSync();
    if (isPaidExpired(sub)) {
      setGateModalConfig({
        open: true,
        type: 'SUBSCRIPTION_EXPIRED',
        plan: sub?.plan,
        isTrial: false,
      });
      return;
    }
    if ((confirmData.type === 'request' || confirmData.type === 'hard') && isTrialExpired(sub)) {
      setGateModalConfig({
        open: true,
        type: 'TRIAL_EXPIRED',
        plan: 'TRIAL',
        isTrial: true,
      });
      return;
    }

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
    } catch (error) {
      toast.error(error?.message || TOAST_MESSAGES.ERROR);
    }
  };


  // Ikon status untuk badge ringkas (hanya ikon; detail ada di atribut title)
  const payMeta = (order) => {
    const s = (order.statusBayar || '').toLowerCase();
    if (isStatusLunas(order.statusBayar)) return { cls: 'ok', icon: 'bi-check-circle-fill', label: s || 'lunas' };
    if (s === 'dp') return { cls: 'wait', icon: 'bi-circle-half', label: 'dp' };
    return { cls: 'wait', icon: 'bi-hourglass-split', label: s || 'belum bayar' };
  };
  const serviceMeta = (order) => {
    const t = (order.tipeLayanan || 'Datang Langsung');
    return /jemput|antar/i.test(t)
      ? { icon: 'bi-truck', label: t.toLowerCase() }
      : { icon: 'bi-shop', label: t.toLowerCase() };
  };
  const formatEst = (order) => {
    if (!order.createdAt || order.estimasi === undefined || order.estimasi === null || isNaN(order.estimasi)) return '-';
    return new Date(new Date(order.createdAt).getTime() + order.estimasi * 86400000)
      .toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  };
  const toggleSelect = (id) => {
    setSelectedOrderIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="data-order-wrapper do-wrap">
      <style>{DO_CSS}</style>

      {/* Bar ringkas: jumlah order + pilih banyak + sinkron */}
      <div className="do-top">
        <span className="do-count">
          <i className="bi bi-list-check"></i>
          {orders?.length || 0} order terdaftar
        </span>
        <div className="do-tools">
          {orders && orders.length > 0 && (
            <button
              type="button"
              className={`do-pill ${isBulkMode ? 'on' : ''}`}
              onClick={() => {
                setIsBulkMode(!isBulkMode);
                if (isBulkMode) setSelectedOrderIds([]);
              }}
            >
              <i className="bi bi-check2-square"></i>
              <span>{isBulkMode ? 'Batal' : 'Pilih Banyak'}</span>
            </button>
          )}
          <button
            type="button"
            className="do-pill sq"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Sinkronisasi Data"
            aria-label="Sinkronisasi Data"
          >
            <i className={`bi bi-arrow-clockwise ${isRefreshing ? 'spin' : ''}`}></i>
          </button>
        </div>
      </div>

      {/* Tab status */}
      <div className="do-tabs" role="tablist">
        {['Proses', 'Selesai', 'Ambil', 'Dibatalkan'].map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={`do-tab ${activeTab === tab ? 'on' : ''}`}
            onClick={() => {
              setActiveTab(tab);
              setSelectedOrderIds([]);
            }}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Filter */}
      <div className="do-filters">
        <select className="do-sel" value={filterAntar} onChange={(e) => setFilterAntar(e.target.value)} aria-label="Filter layanan">
          <option value="Semua">Semua Layanan</option>
          <option value="Datang Langsung">Datang Langsung</option>
          <option value="Jemput/Antar">Jemput/Antar</option>
        </select>
        <select className="do-sel" value={filterBayar} onChange={(e) => setFilterBayar(e.target.value)} aria-label="Filter pembayaran">
          <option value="Semua">Semua Bayar</option>
          <option value="Lunas">Lunas</option>
          <option value="DP">DP</option>
          <option value="Belum Bayar">Belum Bayar</option>
        </select>
        <select className="do-sel" value={filterPrioritas} onChange={(e) => setFilterPrioritas(e.target.value)} aria-label="Filter prioritas">
          <option value="Semua">Semua Prioritas</option>
          <option value="Ya">Prioritas: Ya</option>
          <option value="Tidak">Prioritas: Tidak</option>
        </select>
      </div>

      {/* Pilih semua saat mode bulk */}
      {isBulkMode && orders && orders.length > 0 && (
        <div className="do-selall">
          <label htmlFor="selectAllOrders">
            <input
              type="checkbox"
              className="do-chk"
              id="selectAllOrders"
              checked={selectedOrderIds.length === orders.length && orders.length > 0}
              onChange={(e) => setSelectedOrderIds(e.target.checked ? orders.map((o) => o.id) : [])}
            />
            Pilih Semua ({selectedOrderIds.length}/{orders.length})
          </label>
          {selectedOrderIds.length > 0 && (
            <button type="button" onClick={() => setSelectedOrderIds([])}>Bersihkan</button>
          )}
        </div>
      )}

      {/* Daftar order */}
      <div className="do-list">
        {orders === undefined ? (
          <OrderListSkeleton count={4} />
        ) : orders.length === 0 ? (
          <div className="do-empty">
            <i className="bi bi-inbox"></i>
            <p>Tidak ada data order</p>
          </div>
        ) : (
          orders.map((order) => {
            const isSelected = selectedOrderIds.includes(order.id);
            const isProses = order.status === 'Proses' || (!order.status && activeTab === 'Proses') || order.status === 'Baru';
            const pay = payMeta(order);
            const srv = serviceMeta(order);

            // Aksi yang tampil (urutan: Detail, aksi utama, Hapus)
            const canDelete = activeTab === 'Proses' || (isOwner && (activeTab === 'Selesai' || activeTab === 'Dibatalkan'));
            const actionCount = 1 + (activeTab === 'Proses' || activeTab === 'Selesai' ? 1 : 0) + (canDelete ? 1 : 0);

            return (
              <div
                key={order.id}
                className={`do-card ${isSelected ? 'sel' : ''}`}
                onTouchStart={(e) => handleTouchStart(e, order.id)}
                onTouchMove={(e) => handleTouchMove(e, order.id)}
                onTouchEnd={() => handleTouchEnd(order)}
              >
                {/* Latar merah: geser kanan untuk hapus (hanya status Proses) */}
                {isProses && !isBulkMode && (
                  <div className="do-swipe">
                    <i className="bi bi-trash-fill"></i>
                    <span>Geser untuk Hapus</span>
                  </div>
                )}

                <div
                  className="do-fg"
                  style={{
                    transform: `translateX(${swipeOffset[order.id] || 0}px)`,
                    transition: swipeOffset[order.id] ? 'none' : 'transform 0.2s ease',
                  }}
                  onClick={() => {
                    if (isBulkMode) toggleSelect(order.id);
                  }}
                >
                  {/* Baris 1: invoice + badge ikon (kasir, bayar, layanan) + tanggal */}
                  <div className="do-r1">
                    <div className="l">
                      {isBulkMode && (
                        <input
                          type="checkbox"
                          className="do-chk"
                          checked={isSelected}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggleSelect(order.id)}
                          aria-label={`Pilih order ${order.invoiceId}`}
                        />
                      )}
                      <span className="do-inv">{order.invoiceId}</span>
                      <i
                        className="bi bi-clipboard do-copy"
                        onClick={(e) => handleCopy(e, `${order.invoiceId}/${order.id}`)}
                        title="Salin No. Order"
                      ></i>
                      {order.isPriority && <span className="do-prio">PRIORITAS</span>}
                      {isOwner && (
                        <span className="do-icw">
                          <button type="button" className="do-ic kasir" aria-label={`Kasir ${getKasirUsername(order)}`} onClick={(e) => showTip(e, order.id, 'kasir')}>
                            <i className="bi bi-person-fill"></i>
                          </button>
                          {tip?.id === order.id && tip.key === 'kasir' && <span className="do-tip" role="status">Kasir: {getKasirUsername(order)}</span>}
                        </span>
                      )}
                      <span className="do-icw">
                        <button type="button" className={`do-ic ${pay.cls}`} aria-label={`Pembayaran ${pay.label}`} onClick={(e) => showTip(e, order.id, 'pay')}>
                          <i className={`bi ${pay.icon}`}></i>
                        </button>
                        {tip?.id === order.id && tip.key === 'pay' && <span className="do-tip" role="status">Bayar: {pay.label}</span>}
                      </span>
                      <span className="do-icw">
                        <button type="button" className="do-ic srv" aria-label={`Layanan ${srv.label}`} onClick={(e) => showTip(e, order.id, 'srv')}>
                          <i className={`bi ${srv.icon}`}></i>
                        </button>
                        {tip?.id === order.id && tip.key === 'srv' && <span className="do-tip" role="status">Layanan: {srv.label}</span>}
                      </span>
                    </div>
                    <span className="do-date">
                      {new Date(order.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}{' '}
                      {new Date(order.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Baris 2: nama + total */}
                  <div className="do-r2">
                    <span className="do-name">{order.pelangganNama || 'Umum'}</span>
                    <span className="do-total">Rp {order.total.toLocaleString('id-ID')}</span>
                  </div>

                  {/* Catatan (satu baris, hanya jika ada) */}
                  {(order.catatan || order.catatanKasir) && (
                    <div className="do-notes">
                      {order.catatan && (
                        <div className="do-note" title={order.catatan}>
                          <i className="bi bi-chat-left-text-fill"></i>
                          <span>{order.catatan}</span>
                        </div>
                      )}
                      {order.catatanKasir && (
                        <div className="do-note k" title={order.catatanKasir}>
                          <i className="bi bi-person-lines-fill"></i>
                          <span>{order.catatanKasir}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Baris 3: estimasi + tombol aksi */}
                  <div className="do-r3" onClick={(e) => e.stopPropagation()}>
                    <span className="do-est">
                      Est
                      <b>{formatEst(order)}</b>
                    </span>
                    <div className="do-btns" style={{ gridTemplateColumns: `repeat(${actionCount}, 1fr)` }}>
                      <button type="button" className="do-b" onClick={() => navigate(`/order/${order.id}`)}>
                        Detail
                      </button>

                      {activeTab === 'Proses' && (
                        <button type="button" className="do-b p" onClick={() => confirmSelesai(order.id)}>
                          Selesai
                        </button>
                      )}

                      {activeTab === 'Selesai' && (
                        <button type="button" className="do-b p" onClick={() => confirmAmbil(order.id)}>
                          Ambil
                        </button>
                      )}

                      {/* Kasir boleh ajukan hapus jika masih Proses; owner langsung hapus */}
                      {canDelete && (
                        <button
                          type="button"
                          className="do-b d"
                          title={BUTTON_TITLE.DELETE}
                          onClick={() => (isOwner ? hardDelete(order.id) : requestDelete(order.id))}
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bar bulk pindah status (di atas menu bawah) */}
      {isBulkMode && selectedOrderIds.length > 0 && (
        <div className="do-bulk">
          <div className="do-bulk-in">
            <b>{selectedOrderIds.length} dipilih</b>
            <div className="g">
              {activeTab !== 'Selesai' && (
                <button type="button" className="do-b p" disabled={isBulkProcessing} onClick={() => handleBulkChangeStatus('Selesai')}>
                  <i className="bi bi-check-all"></i> Selesai
                </button>
              )}
              {activeTab !== 'Ambil' && (
                <button type="button" className="do-b" disabled={isBulkProcessing} onClick={() => handleBulkChangeStatus('Ambil')}>
                  <i className="bi bi-bag-check"></i> Ambil
                </button>
              )}
              <button
                type="button"
                className="do-b"
                style={{ borderColor: '#e1e6fa', color: '#8480ae' }}
                onClick={() => {
                  setSelectedOrderIds([]);
                  setIsBulkMode(false);
                }}
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

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
                    <button className="btn btn-outline-secondary w-100 rounded-pill fw-bold py-2" onClick={() => setShowConfirmModal(false)}>Batal</button>
                    <button
                      className={`btn w-100 rounded-pill fw-bold py-2 shadow-sm ${confirmData.type === 'hard' ? 'btn-danger' : 'btn-primary'}`}
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
