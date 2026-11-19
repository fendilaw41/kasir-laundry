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
.do-wrap { padding: 0px 12px 24px; }
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
.do-search { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.do-sbox { flex: 1; min-width: 0; position: relative; }
.do-sbox i { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); font-size: .8rem; color: #8480ae; pointer-events: none; }
.do-sin { width: 100%; height: 36px; padding: 0 30px 0 32px; border: 1px solid #e1e6fa; border-radius: 12px; background: #fff; font-size: .78rem; color: #1f0757; outline: none; }
.do-sin:focus { border-color: #0d5afd; box-shadow: 0 0 0 3px rgba(13, 90, 253, .12); }
.do-sclr { position: absolute; right: 4px; top: 50%; transform: translateY(-50%); width: 26px; height: 26px; border: 0; background: none; color: #a3a9c9; font-size: .7rem; }
.do-fbtn { position: relative; height: 36px; padding: 0 13px; border-radius: 12px; border: 1px solid #e1e6fa; background: #fff; color: #1f0757; font-size: .74rem; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
.do-fbtn.on { border-color: #0d5afd; color: #0d5afd; background: #f1f5ff; }
.do-fbtn em { font-style: normal; min-width: 17px; height: 17px; padding: 0 4px; border-radius: 9px; background: #0d5afd; color: #fff; font-size: .62rem; display: inline-flex; align-items: center; justify-content: center; }
.do-act { display: flex; flex-wrap: wrap; gap: 5px; margin: -2px 0 8px; }
.do-ach { display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 5px 0 10px; border-radius: 999px; background: #e8efff; color: #0134d4; font-size: .68rem; font-weight: 600; border: 0; }
.do-ach i { width: 16px; height: 16px; border-radius: 50%; background: rgba(13, 90, 253, .15); display: inline-flex; align-items: center; justify-content: center; font-size: .55rem; }
.do-ach.rst { background: none; color: #8480ae; padding: 0 4px; }
.do-sbg { position: fixed; inset: 0; z-index: 1190; background: rgba(31, 7, 87, .4); animation: do-fade .18s ease-out; }
.do-sheet { position: fixed; left: 0; right: 0; bottom: 0; z-index: 1200; max-width: 560px; margin: 0 auto; max-height: 86vh; overflow-y: auto; padding: 8px 16px 18px; background: #fff; border-radius: 24px 24px 0 0; box-shadow: 0 -20px 40px -20px rgba(31, 7, 87, .35); animation: do-slide .22s ease-out; }
.do-grab { width: 38px; height: 4px; border-radius: 4px; background: #dfe3f6; margin: 0 auto 10px; }
.do-sh-h { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.do-sh-h b { font-size: 1rem; color: #1f0757; }
.do-sh-h button { border: 0; background: none; color: #0d5afd; font-size: .78rem; font-weight: 700; padding: 4px 0; }
.do-fl { margin: 12px 0 6px; font-size: .68rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: #8480ae; }
.do-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.do-chip { height: 32px; padding: 0 13px; border-radius: 999px; border: 1px solid #e1e6fa; background: #fff; color: #1f0757; font-size: .74rem; font-weight: 600; cursor: pointer; }
.do-chip.on { background: #0d5afd; border-color: #0d5afd; color: #fff; }
.do-dates { display: flex; align-items: center; gap: 6px; margin-top: 8px; }
.do-date-in { flex: 1; min-width: 0; height: 34px; padding: 0 8px; border: 1px solid #e1e6fa; border-radius: 10px; font-size: .74rem; font-weight: 600; color: #1f0757; background: #f8faff; }
.do-date-sep { color: #8480ae; font-weight: 700; }
.do-cta { width: 100%; height: 44px; margin-top: 18px; border: 0; border-radius: 14px; background: #0d5afd; color: #fff; font-size: .86rem; font-weight: 700; box-shadow: 0 12px 22px -10px rgba(13, 90, 253, .7); }
@keyframes do-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes do-slide { from { transform: translateY(40px); opacity: 0; } to { transform: none; opacity: 1; } }

.do-more-wrap { display: flex; gap: 6px; margin-top: 6px; }
.do-more {
  flex: 1; height: 34px; border-radius: 12px; border: 1px dashed #b9c8fe; background: #f5f8ff; color: #0d5afd;
  font-size: .72rem; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer;
  transition: all .15s ease;
}
.do-more:active { transform: scale(.99); background: #e8efff; }
.do-more.sub { flex: 0 0 auto; padding: 0 12px; border-style: solid; border-color: #e1e6fa; background: #fff; color: #8480ae; }
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
.do-r2 { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-top: 1px; }
.do-name { font-size: .8rem; font-weight: 700; color: #1f0757; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.do-total { font-size: .84rem; font-weight: 700; color: #0d5afd; white-space: nowrap; }
.do-notes { display: flex; gap: 6px; margin-top: 3px; }
.do-note { flex: 1; min-width: 0; display: flex; align-items: center; gap: 4px; padding: 2px 7px; border-radius: 7px; font-size: .64rem; color: #1f0757; background: #eef7ff; border-left: 2px solid #38bdf8; }
.do-note.k { background: #fff9e6; border-left-color: #f5b301; }
.do-note span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.do-note i { font-size: .66rem; color: #0284c7; flex: none; }
.do-note.k i { color: #b78103; }
.do-r3 { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
.do-meta { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; font-size: .64rem; color: #8480ae; line-height: 1.25; white-space: nowrap; }
.do-meta span { display: inline-flex; align-items: center; gap: 4px; }
.do-meta i { font-size: .62rem; }
.do-meta .late { color: #e5484d; font-weight: 700; }
.do-meta .soon { color: #b78103; font-weight: 700; }
.do-rt { display: flex; align-items: center; gap: 4px; flex: none; }
.do-chip-pay { height: 20px; padding: 0 8px; border-radius: 999px; border: 0; font-size: .62rem; font-weight: 700; cursor: pointer; line-height: 1; }
.do-chip-pay.ok { background: #d9f6e6; color: #0e8f55; }
.do-chip-pay.wait { background: #fff1cf; color: #a76a00; }
.do-btns { display: flex; gap: 5px; flex: none; }
.do-b {
  height: 30px; padding: 0 14px; border-radius: 999px; border: 1px solid #0d5afd; background: #fff; color: #0d5afd; font-size: .72rem; font-weight: 700;
  display: inline-flex; align-items: center; justify-content: center; gap: 4px; cursor: pointer; line-height: 1;
}
.do-b.p { background: #0d5afd; color: #fff; padding: 0 16px; }
.do-b.sq { width: 30px; padding: 0; border-color: #f3c3c5; background: #fff5f5; color: #e5484d; }

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

  // State Filter & Pagination (Show More)
  const PAGE_SIZE = 5;
  const [filterAntar, setFilterAntar] = useState('Semua');
  const [filterBayar, setFilterBayar] = useState('Semua');
  const [filterPrioritas, setFilterPrioritas] = useState('Semua');
  const [filterTanggal, setFilterTanggal] = useState('Semua');
  const [tanggalMulai, setTanggalMulai] = useState('');
  const [tanggalAkhir, setTanggalAkhir] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilter, setShowFilter] = useState(false);

  // Reset jumlah tampil saat tab atau filter berubah
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeTab, filterAntar, filterBayar, filterPrioritas, filterTanggal, tanggalMulai, tanggalAkhir, searchQuery]);

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

      let matchTanggal = true;
      if (filterTanggal !== 'Semua') {
        if (!order.createdAt) {
          matchTanggal = false;
        } else {
          const d = new Date(order.createdAt);
          if (isNaN(d.getTime())) {
            matchTanggal = false;
          } else {
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
            const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

            if (filterTanggal === 'Hari Ini') {
              matchTanggal = d >= todayStart && d <= todayEnd;
            } else if (filterTanggal === 'Kemarin') {
              const yStart = new Date(todayStart);
              yStart.setDate(yStart.getDate() - 1);
              const yEnd = new Date(todayEnd);
              yEnd.setDate(yEnd.getDate() - 1);
              matchTanggal = d >= yStart && d <= yEnd;
            } else if (filterTanggal === '7 Hari') {
              const start7 = new Date(todayStart);
              start7.setDate(start7.getDate() - 6);
              matchTanggal = d >= start7 && d <= todayEnd;
            } else if (filterTanggal === 'Bulan Ini') {
              const mStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
              const mEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
              matchTanggal = d >= mStart && d <= mEnd;
            } else if (filterTanggal === 'Custom') {
              if (tanggalMulai) {
                const [y, m, day] = tanggalMulai.split('-').map(Number);
                const startCustom = new Date(y, m - 1, day, 0, 0, 0, 0);
                if (d < startCustom) matchTanggal = false;
              }
              if (matchTanggal && tanggalAkhir) {
                const [y, m, day] = tanggalAkhir.split('-').map(Number);
                const endCustom = new Date(y, m - 1, day, 23, 59, 59, 999);
                if (d > endCustom) matchTanggal = false;
              }
            }
          }
        }
      }

      const q = searchQuery.trim().toLowerCase();
      const matchSearch = !q
        || String(order.invoiceId || '').toLowerCase().includes(q)
        || String(order.pelangganNama || 'umum').toLowerCase().includes(q);

      return matchTab && matchAntar && matchBayar && matchPrioritas && matchTanggal && matchSearch;
    });
  }, [activeTab, filterAntar, filterBayar, filterPrioritas, filterTanggal, tanggalMulai, tanggalAkhir, searchQuery]);

  const visibleOrders = orders ? orders.slice(0, visibleCount) : undefined;
  const remainingOrdersCount = orders ? Math.max(0, orders.length - visibleCount) : 0;


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
  const estDate = (order) => {
    if (!order.createdAt || order.estimasi === undefined || order.estimasi === null || isNaN(order.estimasi)) return null;
    return new Date(new Date(order.createdAt).getTime() + order.estimasi * 86400000);
  };
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  // "Hari ini, 18.17" / "Kemarin, 18.17" / "14 Nov, 18.17"
  const formatCreated = (order) => {
    const d = new Date(order.createdAt);
    if (isNaN(d.getTime())) return '-';
    const now = new Date();
    const yest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const jam = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const hari = sameDay(d, now) ? 'Hari ini' : sameDay(d, yest) ? 'Kemarin' : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    return `${hari}, ${jam}`;
  };
  const payText = (order) => {
    const s = (order.statusBayar || '').toLowerCase();
    if (isStatusLunas(order.statusBayar)) return 'Lunas';
    if (s === 'dp') return 'DP';
    return 'Belum bayar';
  };
  const filterOptions = [
    { key: 'antar', label: 'Layanan', value: filterAntar, set: setFilterAntar, opts: ['Semua', 'Datang Langsung', 'Jemput/Antar'] },
    { key: 'bayar', label: 'Pembayaran', value: filterBayar, set: setFilterBayar, opts: ['Semua', 'Lunas', 'DP', 'Belum Bayar'] },
    { key: 'prio', label: 'Prioritas', value: filterPrioritas, set: setFilterPrioritas, opts: ['Semua', 'Ya', 'Tidak'] },
  ];
  const tanggalOptions = [['Semua', 'Semua'], ['Hari Ini', 'Hari ini'], ['Kemarin', 'Kemarin'], ['7 Hari', '7 hari'], ['Bulan Ini', 'Bulan ini'], ['Custom', 'Pilih tanggal']];
  const pickTanggal = (val) => {
    setFilterTanggal(val);
    if (val === 'Custom' && !tanggalMulai && !tanggalAkhir) {
      const todayStr = new Date().toISOString().slice(0, 10);
      setTanggalMulai(todayStr);
      setTanggalAkhir(todayStr);
    }
  };
  const activeFilters = [
    filterAntar !== 'Semua' && { key: 'antar', text: filterAntar, clear: () => setFilterAntar('Semua') },
    filterBayar !== 'Semua' && { key: 'bayar', text: filterBayar, clear: () => setFilterBayar('Semua') },
    filterPrioritas !== 'Semua' && { key: 'prio', text: `Prioritas: ${filterPrioritas}`, clear: () => setFilterPrioritas('Semua') },
    filterTanggal !== 'Semua' && {
      key: 'tgl',
      text: filterTanggal === 'Custom' ? `${tanggalMulai || '…'} → ${tanggalAkhir || '…'}` : (tanggalOptions.find((t) => t[0] === filterTanggal)?.[1] || filterTanggal),
      clear: () => setFilterTanggal('Semua'),
    },
  ].filter(Boolean);
  const resetFilters = () => {
    setFilterAntar('Semua');
    setFilterBayar('Semua');
    setFilterPrioritas('Semua');
    setFilterTanggal('Semua');
    setTanggalMulai('');
    setTanggalAkhir('');
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
          {orders && orders.length > PAGE_SIZE
            ? `${visibleOrders?.length || 0} dari ${orders.length} order`
            : `${orders?.length || 0} order terdaftar`}
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

      {/* Cari + tombol filter */}
      <div className="do-search">
        <div className="do-sbox">
          <i className="bi bi-search"></i>
          <input
            type="search"
            className="do-sin"
            placeholder="Cari nama / no. order"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Cari order"
          />
          {searchQuery && (
            <button type="button" className="do-sclr" onClick={() => setSearchQuery('')} aria-label="Hapus pencarian">
              <i className="bi bi-x-lg" style={{ position: 'static', transform: 'none', color: 'inherit' }}></i>
            </button>
          )}
        </div>
        <button type="button" className={`do-fbtn ${activeFilters.length ? 'on' : ''}`} onClick={() => setShowFilter(true)}>
          <i className="bi bi-sliders"></i>
          Filter
          {activeFilters.length > 0 && <em>{activeFilters.length}</em>}
        </button>
      </div>

      {/* Filter aktif (ketuk untuk menghapus) */}
      {activeFilters.length > 0 && (
        <div className="do-act">
          {activeFilters.map((f) => (
            <button key={f.key} type="button" className="do-ach" onClick={f.clear}>
              {f.text}
              <i className="bi bi-x-lg"></i>
            </button>
          ))}
          <button type="button" className="do-ach rst" onClick={resetFilters}>Reset</button>
        </div>
      )}

      {/* Lembar filter (bottom sheet) */}
      {showFilter && (
        <>
          <div className="do-sbg" onClick={() => setShowFilter(false)}></div>
          <div className="do-sheet" role="dialog" aria-label="Filter order">
            <div className="do-grab"></div>
            <div className="do-sh-h">
              <b>Filter Order</b>
              <button type="button" onClick={resetFilters}>Reset</button>
            </div>
            {filterOptions.map((g) => (
              <div key={g.key}>
                <div className="do-fl">{g.label}</div>
                <div className="do-chips">
                  {g.opts.map((o) => (
                    <button key={o} type="button" className={`do-chip ${g.value === o ? 'on' : ''}`} onClick={() => g.set(o)}>
                      {o === 'Ya' ? 'Prioritas saja' : o === 'Tidak' ? 'Non-prioritas' : o}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="do-fl">Tanggal order</div>
            <div className="do-chips">
              {tanggalOptions.map(([val, lbl]) => (
                <button key={val} type="button" className={`do-chip ${filterTanggal === val ? 'on' : ''}`} onClick={() => pickTanggal(val)}>
                  {lbl}
                </button>
              ))}
            </div>
            {filterTanggal === 'Custom' && (
              <div className="do-dates">
                <input type="date" className="do-date-in" value={tanggalMulai} onChange={(e) => setTanggalMulai(e.target.value)} aria-label="Dari tanggal" />
                <span className="do-date-sep">–</span>
                <input type="date" className="do-date-in" value={tanggalAkhir} min={tanggalMulai || undefined} onChange={(e) => setTanggalAkhir(e.target.value)} aria-label="Sampai tanggal" />
              </div>
            )}
            <button type="button" className="do-cta" onClick={() => setShowFilter(false)}>
              Lihat {orders ? orders.length : 0} order
            </button>
          </div>
        </>
      )}

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
          visibleOrders.map((order) => {
            const isSelected = selectedOrderIds.includes(order.id);
            const isProses = order.status === 'Proses' || (!order.status && activeTab === 'Proses') || order.status === 'Baru';
            const pay = payMeta(order);
            const srv = serviceMeta(order);

            // Aksi yang tampil (urutan: Detail, aksi utama, Hapus)
            const canDelete = activeTab === 'Proses' || (isOwner && (activeTab === 'Selesai' || activeTab === 'Dibatalkan'));
            const ed = estDate(order);
            const now0 = new Date();
            const today0 = new Date(now0.getFullYear(), now0.getMonth(), now0.getDate());
            const estLate = isProses && ed && ed < today0 && !sameDay(ed, today0);
            const estToday = isProses && ed && sameDay(ed, today0);

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
                  {/* Baris 1: invoice + prioritas | kasir, layanan, status bayar */}
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
                    </div>
                    <div className="do-rt">
                      {isOwner && (
                        <span className="do-icw">
                          <button type="button" className="do-ic kasir" aria-label={`Kasir ${getKasirUsername(order)}`} onClick={(e) => showTip(e, order.id, 'kasir')}>
                            <i className="bi bi-person-fill"></i>
                          </button>
                          {tip?.id === order.id && tip.key === 'kasir' && <span className="do-tip" role="status">Kasir: {getKasirUsername(order)}</span>}
                        </span>
                      )}
                      <span className="do-icw">
                        <button type="button" className="do-ic srv" aria-label={`Layanan ${srv.label}`} onClick={(e) => showTip(e, order.id, 'srv')}>
                          <i className={`bi ${srv.icon}`}></i>
                        </button>
                        {tip?.id === order.id && tip.key === 'srv' && <span className="do-tip" role="status">Layanan: {srv.label}</span>}
                      </span>
                      <span className="do-icw">
                        <button type="button" className={`do-chip-pay ${pay.cls}`} aria-label={`Pembayaran ${pay.label}`} onClick={(e) => showTip(e, order.id, 'pay')}>
                          {payText(order)}
                        </button>
                        {tip?.id === order.id && tip.key === 'pay' && <span className="do-tip" role="status" style={{ left: 'auto', right: 0, transform: 'none' }}>Bayar: {pay.label}</span>}
                      </span>
                    </div>
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

                  {/* Baris 3: tanggal + estimasi | tombol aksi */}
                  <div className="do-r3" onClick={(e) => e.stopPropagation()}>
                    <div className="do-meta">
                      <span><i className="bi bi-clock"></i>{formatCreated(order)}</span>
                      <span className={estLate ? 'late' : estToday ? 'soon' : ''}>
                        <i className="bi bi-calendar-event"></i>
                        {estLate ? `Telat · ${formatEst(order)}` : estToday ? 'Est hari ini' : `Est ${formatEst(order)}`}
                      </span>
                    </div>
                    <div className="do-btns">
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
                      {canDelete && activeTab === 'Proses' && (
                        <button
                          type="button"
                          className="do-b sq"
                          title={BUTTON_TITLE.DELETE}
                          aria-label="Hapus"
                          onClick={() => (isOwner ? hardDelete(order.id) : requestDelete(order.id))}
                        >
                          <i className="bi bi-trash3"></i>
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

      {/* Tombol Show More / Ringkas */}
      {orders && orders.length > PAGE_SIZE && (
        <div className="do-more-wrap">
          {remainingOrdersCount > 0 && (
            <button
              type="button"
              className="do-more"
              onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
            >
              <i className="bi bi-chevron-down"></i>
              <span>Show More ({remainingOrdersCount} order lagi)</span>
            </button>
          )}
          {visibleCount > PAGE_SIZE && (
            <button
              type="button"
              className="do-more sub"
              onClick={() => setVisibleCount(PAGE_SIZE)}
              title="Kembali tampilkan 5 order teratas"
            >
              <i className="bi bi-chevron-up"></i>
              <span>Ringkas</span>
            </button>
          )}
        </div>
      )}

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
              {activeTab !== 'Ambil' && activeTab === 'Selesai' && (
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