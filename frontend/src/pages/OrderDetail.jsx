import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { getOrderByIdQuery, updateOrder } from '../db/repositories/orders';
import { getPelangganByIdQuery, updatePelanggan, addPelanggan } from '../db/repositories/pelanggan';
import { getInventoryQuery, getInventoryById, updateInventory } from '../db/repositories/inventory';
import { getSettingsQuery } from '../db/repositories/settings';
import { pullOrdersFromBackend, syncOrderToBackend, syncInventoryToBackend, syncInventoryEventsToBackend } from '../services/syncService';
import { withNewSyncMeta, withUpdatedSyncMeta } from '../db/syncMeta';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { TOAST_MESSAGES, CONFIRM_MESSAGES, BUTTON_TEXT } from '../constants/appConstants';
import { formatWhatsAppMessage } from '../utils/whatsapp';
import { getTrackingUrl } from '../utils/tracking';
import { getStatusLunasByMetode, isStatusLunas } from '../utils/paymentStatus';
import PrintLayout from '../components/PrintLayout';
import PlanGateModal from '../components/PlanGateModal';
import { getSubscriptionReport, getCachedSubscriptionReportSync, isTrialExpired, isPaidExpired } from '../services/subscriptionService';
import { QRCodeSVG } from '../components/common/QRCodeSVG';
import { Skeleton, OrderDetailSkeleton } from '../components/common/Skeleton';
import { db } from '../db';
import { playSuccessChime } from '../utils/soundHelper';
import { getIsCompactCetak, setIsCompactCetak } from '../utils/userPreferences';

// true  = drawer / tombol Cetak menempel tepat di bawah konten (tidak ada celah kosong), lalu
//         menempel di dasar layar kalau konten panjang.
// false = perilaku lama (selalu menempel di dasar layar).
const DRAWER_FOLLOW_CONTENT = true;
// Tinggi menu bawah aplikasi (px) - dipakai untuk posisi tombol Cetak saat drawer disembunyikan
const BOTTOM_MENU_HEIGHT = 62; // .footer-nav-area di CSS = 62px

const isSameInventory = (a, b) => {
  if (!a || !b) return false;
  if (a.id && b.id && String(a.id) === String(b.id)) return true;
  if (a.uuid && b.uuid && String(a.uuid) === String(b.uuid)) return true;
  if (a.uuid && b.id && String(a.uuid) === String(b.id)) return true;
  if (a.id && b.uuid && String(a.id) === String(b.uuid)) return true;
  if (a.nama && b.nama && a.nama.trim().toLowerCase() === b.nama.trim().toLowerCase()) return true;
  return false;
};

// Komponen Counter Angka Terisolasi (Render 60fps Halus Tanpa Re-render Parent)
const AnimatedCounter = ({ target, duration = 1100 }) => {
  const [val, setVal] = useState(0);

  useEffect(() => {
    const endVal = Number(target) || 0;
    if (endVal <= 0) {
      setVal(0);
      return;
    }

    setVal(0);
    const startTime = performance.now();
    let animationFrameId;

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Quartic ease-out: akselerasi responsif di awal, lalu melambat sangat halus di akhir
      const easeOut = 1 - Math.pow(1 - progress, 4);
      const currentVal = Math.round(easeOut * endVal);

      setVal(currentVal);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        setVal(endVal);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [target, duration]);

  return <span>Rp {val.toLocaleString('id-ID')}</span>;
};

/* Gaya konten Order Detail (prefix .od-) */
const OD_CSS = `
.od-content { padding: 10px 12px 0; }
.od-hero { position: relative; overflow: hidden; border-radius: 20px; padding: 14px 16px 15px; color: #fff; margin-bottom: 8px;
  background: radial-gradient(260px 160px at 100% 0%, rgba(255,255,255,.24), rgba(255,255,255,0) 70%), linear-gradient(135deg, #0134d4 0%, #0d5afd 100%);
  box-shadow: 0 16px 28px -18px rgba(13, 90, 253, .8); }
.od-hero.prio { background: radial-gradient(260px 160px at 100% 0%, rgba(255,255,255,.22), rgba(255,255,255,0) 70%), linear-gradient(135deg, #c81e3a 0%, #ef4444 100%); box-shadow: 0 16px 28px -18px rgba(239, 68, 68, .8); }
.od-hero::before { content: ''; position: absolute; inset: 0; pointer-events: none; opacity: .5;
  background-image: radial-gradient(rgba(255,255,255,.25) 1px, transparent 1.2px); background-size: 18px 18px;
  -webkit-mask-image: linear-gradient(135deg, #000, transparent 65%); mask-image: linear-gradient(135deg, #000, transparent 65%); }
.od-hero > * { position: relative; }
.od-shop { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.od-shop b { display: block; font-size: .95rem; font-weight: 700; letter-spacing: -.01em; line-height: 1.2; }
.od-shop small { display: block; margin-top: 1px; font-size: .68rem; opacity: .8; }
.od-kasir { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 999px; background: rgba(255,255,255,.2); border: 1px solid rgba(255,255,255,.35); font-size: .66rem; font-weight: 600; white-space: nowrap; }
.od-prio { display: inline-flex; align-items: center; gap: 4px; margin-top: 6px; padding: 3px 9px; border-radius: 999px; background: #fff; color: #c81e3a; font-size: .62rem; font-weight: 800; }
.od-inv { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; margin-top: 12px; }
.od-inv > div > span { display: block; font-size: .62rem; font-weight: 600; letter-spacing: .08em; opacity: .75; }
.od-inv strong { display: block; font-size: 1.2rem; font-weight: 800; letter-spacing: -.02em; line-height: 1.15; }
.od-chip { display: inline-flex; align-items: center; gap: 5px; padding: 5px 11px; border-radius: 999px; font-size: .66rem; font-weight: 800; text-transform: uppercase; white-space: nowrap; }
.od-chip.ok { background: #d9f6e6; color: #0b7a47; }
.od-chip.wait { background: #fff1cf; color: #8a5a00; }
.od-card { background: #fff; border: 1px solid #e8ebfa; border-radius: 18px; padding: 12px 14px; margin-bottom: 8px; box-shadow: 0 6px 14px -12px rgba(31, 7, 87, .35); }
.od-cust { display: flex; align-items: center; gap: 11px; }
.od-av { width: 42px; height: 42px; border-radius: 14px; flex: none; display: inline-flex; align-items: center; justify-content: center; background: #e9f0ff; color: #0d5afd; font-size: 1.05rem; font-weight: 800; }
.od-cust .n { flex: 1; min-width: 0; }
.od-cust .n b { display: block; font-size: .95rem; font-weight: 700; color: #1f0757; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.od-cust .n span { display: flex; align-items: center; gap: 5px; margin-top: 1px; font-size: .74rem; color: #8480ae; }
.od-tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 11px; }
.od-tile { padding: 8px 11px; border-radius: 12px; background: #f4f6ff; }
.od-tile small { display: block; font-size: .6rem; font-weight: 700; letter-spacing: .06em; color: #8480ae; text-transform: uppercase; }
.od-tile b { display: block; margin-top: 2px; font-size: .78rem; font-weight: 700; color: #1f0757; line-height: 1.3; }
.od-note { display: flex; align-items: center; gap: 10px; }
.od-note + .od-note { margin-top: 10px; padding-top: 10px; border-top: 1px dashed #e4e8fb; }
.od-note.lock { opacity: .75; }
.od-note .ic { width: 30px; height: 30px; border-radius: 10px; flex: none; display: inline-flex; align-items: center; justify-content: center; font-size: .85rem; }
.od-note .ic.b { background: #e9f0ff; color: #0d5afd; }
.od-note .ic.y { background: #fff3d6; color: #d98f00; }
.od-note .t { flex: 1; min-width: 0; }
.od-note .t small { display: block; font-size: .62rem; font-weight: 700; letter-spacing: .05em; color: #8480ae; text-transform: uppercase; }
.od-note .t b { display: block; margin-top: 1px; font-size: .82rem; font-weight: 600; color: #1f0757; word-break: break-word; }
.od-note .t b.empty { color: #b4b0d0; font-weight: 500; }
.od-edit { height: 26px; padding: 0 10px; border-radius: 999px; border: 1px solid #d4e1ff; background: #f4f8ff; color: #0d5afd; font-size: .68rem; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; flex: none; cursor: pointer; line-height: 1; }
.od-edit.y { border-color: #f6dca0; background: #fffaf0; color: #b77900; }
.od-title { font-size: .64rem; font-weight: 800; letter-spacing: .09em; color: #8480ae; text-transform: uppercase; }
.od-title-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.od-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; margin-top: 9px; }
.od-step { border: 1px solid #e4e8fb; border-radius: 14px; background: #f4f6ff; color: #8480ae; padding: 9px 4px 8px; display: flex; flex-direction: column; align-items: center; gap: 3px; font-size: .64rem; font-weight: 800; letter-spacing: .03em; cursor: pointer; transition: all .2s ease; }
.od-step i { font-size: 1.25rem; line-height: 1; }
.od-step.proses i { color: #0d5afd; opacity: .55; }
.od-step.selesai i { color: #12b76a; opacity: .6; }
.od-step.ambil i { color: #1f0757; opacity: .45; }
.od-step.on { border-color: transparent; color: #fff; box-shadow: 0 10px 18px -10px rgba(31, 7, 87, .5); }
.od-step.on i { color: #fff; opacity: 1; }
.od-step.proses.on { background: linear-gradient(135deg, #0134d4, #0d5afd); }
.od-step.selesai.on { background: linear-gradient(135deg, #0e9f5a, #12b76a); }
.od-step.ambil.on { background: linear-gradient(135deg, #1f0757, #3b2a8c); }
.od-line { display: flex; align-items: baseline; gap: 8px; padding: 5px 0; font-size: .78rem; }
.od-line .q { flex: none; min-width: 26px; padding: 1px 6px; border-radius: 6px; background: #e9f0ff; color: #0134d4; font-size: .68rem; font-weight: 800; text-align: center; }
.od-line .nm { flex: 1; min-width: 0; color: #1f0757; font-weight: 500; }
.od-line .nm em { font-style: normal; display: block; font-size: .62rem; font-weight: 600; letter-spacing: .02em; color: #8480ae; text-transform: uppercase; }
.od-line .pr { flex: none; font-weight: 700; color: #1f0757; }
.od-sep { height: 0; border-top: 1px dashed #e4e8fb; margin: 8px 0; }
.od-inv-row { display: flex; justify-content: space-between; gap: 8px; padding: 2px 0; font-size: .76rem; color: #5f5a86; }
.od-inv-empty { font-size: .74rem; color: #b4b0d0; font-style: italic; }
.od-sum { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; padding: 3px 0; font-size: .8rem; color: #5f5a86; }
.od-sum.red { color: #e5484d; }
.od-total { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin: 8px 0 6px; padding: 11px 13px; border-radius: 14px; background: linear-gradient(135deg, #eaf1ff, #f3f0ff); }
.od-total span { font-size: .7rem; font-weight: 800; letter-spacing: .08em; color: #1f0757; }
.od-total b { font-size: 1.2rem; font-weight: 800; letter-spacing: -.02em; color: #0d5afd; }
.od-pay { display: flex; justify-content: space-between; gap: 8px; padding: 2px 0; font-size: .78rem; color: #5f5a86; }
.od-pay b { color: #1f0757; font-weight: 700; }
.od-pay.g, .od-pay.g b { color: #0e8f55; font-weight: 700; }
`;

const OrderDetail = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const order = useLiveQuery(() => getOrderByIdQuery(id), [id]);
  const pelanggan = useLiveQuery(() => order ? getPelangganByIdQuery(order.pelangganId, order.pelangganNama) : null, [order]);
  const settings = useLiveQuery(getSettingsQuery);

  const allUsers = useLiveQuery(() => db.users.toArray(), []);
  const allInventory = useLiveQuery(getInventoryQuery);
  const currentUser = user || JSON.parse(typeof sessionStorage !== 'undefined' ? (sessionStorage.getItem('user') || '{}') : '{}');
  const isOwner = currentUser?.role === 'owner';

  const [catatan, setCatatan] = useState('');
  const [catatanKasir, setCatatanKasir] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showCashierNoteModal, setShowCashierNoteModal] = useState(false);
  const [showHpModal, setShowHpModal] = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [selectedInventory, setSelectedInventory] = useState([]);
  const [localInventoryUsed, setLocalInventoryUsed] = useState(null);
  const [newHp, setNewHp] = useState('');
  const [printType, setPrintType] = useState(null);
  const [gateModal, setGateModal] = useState({ open: false, type: 'PDF_LIMIT', data: {} });
  const [isQueryTimeout, setIsQueryTimeout] = useState(false);
  const [isCompactDrawer, setIsCompactDrawerState] = useState(() => getIsCompactCetak(user));

  const setIsCompactDrawer = (val) => {
    setShowCompactState(val);
    setIsCompactCetak(val, user);
  };

  const setShowCompactState = (val) => {
    setIsCompactDrawerState(val);
  };

  useEffect(() => {
    setIsCompactDrawerState(getIsCompactCetak(user));
  }, [user]);

  // State untuk Floating Popup Pembayaran (mirip Transaksi)
  const [showPayModal, setShowPayModal] = useState(false);
  const [payMetodeBayar, setPayMetodeBayar] = useState('Cash');
  const [payIsLunas, setPayIsLunas] = useState(true);
  const [payNominal, setPayNominal] = useState('');
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successPayData, setSuccessPayData] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsQueryTimeout(true);
    }, 2500);
    return () => clearTimeout(timer);
  }, [id]);

  // Tarik order dari server HANYA jika data belum ada di Dexie lokal (misal direct URL)
  useEffect(() => {
    if (navigator.onLine && id && order === null && isQueryTimeout) {
      pullOrdersFromBackend(true).catch(err => console.warn('[OrderDetail] Auto pull error:', err));
    }
  }, [id, order, isQueryTimeout]);

  // Sinkronkan state catatan & inventory yang dipilih setiap kali data order diperbarui
  useEffect(() => {
    if (order) {
      setCatatan(order.catatan || '');
      setCatatanKasir(order.catatanKasir || '');
      setSelectedInventory(order.inventoryUsed || []);
      setLocalInventoryUsed(order.inventoryUsed || []);
    }
  }, [order?.id, JSON.stringify(order?.inventoryUsed), order?.catatan, order?.catatanKasir]);

  if (order === undefined || (order === null && !isQueryTimeout)) {
    return <OrderDetailSkeleton />;
  }

  if (!order) {
    return (
      <div className="text-center py-5">
        <div className="mb-3 text-muted">
          <i className="bi bi-search fs-1"></i>
        </div>
        <h5 className="fw-bold">Pesanan Tidak Ditemukan</h5>
        <p className="text-muted small">Data pesanan #{id} tidak ditemukan di penyimpanan lokal.</p>
        <button className="btn btn-outline-primary rounded-pill px-4" onClick={() => navigate('/orders')}>
          Kembali ke Data Order
        </button>
      </div>
    );
  }

  const getKasirUsername = () => {
    if (order?.kasirUsername) return order.kasirUsername;
    if (order?.user?.username) return order.user.username;
    if (order?.userId && allUsers) {
      const u = allUsers.find(userItem => userItem.uuid === order.userId || String(userItem.id) === String(order.userId));
      if (u) return u.username || u.fullname;
    }
    return '-';
  };

  const currentStatus = order?.status || 'Proses';
  // Catatan pelanggan tidak bisa diedit jika status sudah Selesai, Ambil, atau Dibatalkan
  const isCustomerNoteLocked = currentStatus === 'Selesai' || currentStatus === 'Ambil' || currentStatus === 'Dibatalkan';
  // Catatan kasir tidak bisa diedit jika status sudah Diambil (Ambil) atau Dibatalkan
  const isCashierNoteLocked = currentStatus === 'Ambil' || currentStatus === 'Dibatalkan';

  const displayedInventory = localInventoryUsed !== null ? localInventoryUsed : (order?.inventoryUsed || []);

  const handleStatusClick = (newStatus) => {
    if ((order.status === 'Selesai' || order.status === 'Ambil') && newStatus === 'Proses') {
      setShowConfirmModal(true);
    } else {
      updateStatus(newStatus);
    }
  };

  const updateStatus = async (status) => {
    setShowConfirmModal(false);

    // Cek subscription dari cache secara instan (0 ms, non-blocking)
    const sub = getCachedSubscriptionReportSync();
    if (isPaidExpired(sub)) {
      setGateModal({ open: true, type: 'SUBSCRIPTION_EXPIRED', data: { plan: sub?.plan, isTrial: false } });
      return;
    }

    try {
      // Optimistic update langsung ke Dexie lokal (0-2 ms), sync berjalan di background
      await updateOrder(order.id, { status });
      toast.success(TOAST_MESSAGES.SUCCESS);
    } catch (error) {
      toast.error(error?.message || TOAST_MESSAGES.ERROR);
    }
  };

  const updateCatatan = async () => {
    setShowNoteModal(false);
    const sub = getCachedSubscriptionReportSync();
    if (sub?.isExpired) {
      setGateModal({
        open: true,
        type: isTrialExpired(sub) ? 'TRIAL_EXPIRED' : 'SUBSCRIPTION_EXPIRED',
        data: { plan: sub?.plan, isTrial: isTrialExpired(sub) },
      });
      return;
    }
    if (isCustomerNoteLocked) {
      toast.error('Catatan pelanggan tidak dapat diedit karena cucian sudah selesai/diambil');
      return;
    }
    try {
      await updateOrder(order.id, { catatan });
      toast.success(TOAST_MESSAGES.SUCCESS);
    } catch (error) {
      toast.error(TOAST_MESSAGES.ERROR);
    }
  };

  const updateCatatanKasir = async () => {
    setShowCashierNoteModal(false);
    const sub = getCachedSubscriptionReportSync();
    if (sub?.isExpired) {
      setGateModal({
        open: true,
        type: isTrialExpired(sub) ? 'TRIAL_EXPIRED' : 'SUBSCRIPTION_EXPIRED',
        data: { plan: sub?.plan, isTrial: isTrialExpired(sub) },
      });
      return;
    }
    if (isCashierNoteLocked) {
      toast.error('Catatan kasir tidak dapat diedit karena pesanan sudah diambil pelanggan');
      return;
    }
    try {
      await updateOrder(order.id, { catatanKasir });
      toast.success(TOAST_MESSAGES.SUCCESS);
    } catch (error) {
      toast.error(TOAST_MESSAGES.ERROR);
    }
  };

  const togglePriority = async () => {
    const sub = getCachedSubscriptionReportSync();
    if (sub?.isExpired) {
      setGateModal({
        open: true,
        type: isTrialExpired(sub) ? 'TRIAL_EXPIRED' : 'SUBSCRIPTION_EXPIRED',
        data: { plan: sub?.plan, isTrial: isTrialExpired(sub) },
      });
      return;
    }
    try {
      await updateOrder(order.id, { isPriority: !order.isPriority });
      toast.success(TOAST_MESSAGES.SUCCESS);
    } catch (error) {
      toast.error(TOAST_MESSAGES.ERROR);
    }
  };

  const toggleLunas = async () => {
    try {
      if (isStatusLunas(order.statusBayar)) {
        await updateOrder(order.id, { statusBayar: 'Belum Lunas', bayar: 0, kembalian: 0 });
        toast.success(TOAST_MESSAGES.SUCCESS);
      } else {
        const newStatus = getStatusLunasByMetode(order.metodeBayar);
        await updateOrder(order.id, { statusBayar: newStatus, bayar: order.total, kembalian: 0 });
        toast.success(TOAST_MESSAGES.SUCCESS);
      }
    } catch (error) {
      toast.error(TOAST_MESSAGES.ERROR);
    }
  };

  // Hitung sisa tagihan yang harus dibayar
  const tagihanToPay = (order?.statusBayar === 'DP' && Number(order?.bayar) > 0)
    ? Math.max(0, Number(order.total || 0) - Number(order.bayar || 0))
    : Number(order?.total || 0);

  const parsedPayNominal = payNominal !== '' ? Math.max(0, Number(payNominal) || 0) : null;
  const effectivePayBayar = parsedPayNominal !== null ? parsedPayNominal : (payIsLunas ? tagihanToPay : 0);
  const payKembalian = payIsLunas ? Math.max(0, effectivePayBayar - tagihanToPay) : 0;
  const paySisaTagihan = Math.max(0, tagihanToPay - effectivePayBayar);

  const handleOpenPayModal = () => {
    setPayMetodeBayar(order?.metodeBayar || 'Cash');
    setPayIsLunas(true);
    setPayNominal('');
    setShowPayModal(true);
  };

  const handleQuickNominal = (val) => {
    if (val === 'pas') {
      setPayNominal(tagihanToPay.toString());
    } else {
      setPayNominal(val.toString());
    }
  };

  const handleConfirmPayment = async () => {
    if (isSubmittingPay || !order) return;
    setIsSubmittingPay(true);
    try {
      const finalBayar = parsedPayNominal !== null ? parsedPayNominal : (payIsLunas ? tagihanToPay : 0);
      const finalKembalian = payIsLunas ? Math.max(0, finalBayar - tagihanToPay) : 0;
      const totalPaidCumulative = ((order.statusBayar === 'DP' ? Number(order.bayar || 0) : 0) + (finalBayar - finalKembalian));
      const isNowLunas = payIsLunas || totalPaidCumulative >= Number(order.total || 0);

      const newStatusBayar = isNowLunas
        ? getStatusLunasByMetode(payMetodeBayar)
        : (totalPaidCumulative > 0 ? 'DP' : 'Belum Lunas');

      await updateOrder(order.id, {
        statusBayar: newStatusBayar,
        bayar: totalPaidCumulative,
        kembalian: finalKembalian,
        metodeBayar: payMetodeBayar,
      });

      syncOrderToBackend(order.id).catch(err => console.warn('[Sync] order error:', err));

      setShowPayModal(false);
      playSuccessChime();

      setSuccessPayData({
        id: order.id,
        invoiceId: order.invoiceId || `#${order.id}`,
        pelangganNama: pelanggan?.nama || order.pelangganNama || 'Pelanggan Umum',
        total: tagihanToPay,
        bayar: finalBayar,
        kembalian: finalKembalian,
        metodeBayar: payMetodeBayar,
        isLunas: isNowLunas,
      });
      setShowSuccessModal(true);
      toast.success('Pembayaran berhasil diproses!');
    } catch (err) {
      console.error('[OrderDetail] confirm payment error:', err);
      toast.error(err?.message || TOAST_MESSAGES.ERROR);
    } finally {
      setIsSubmittingPay(false);
    }
  };

  const sendWhatsApp = () => {
    if (!pelanggan || !pelanggan.hp || pelanggan.hp === '-') {
      setNewHp('');
      setShowHpModal(true);
      return;
    }
    const waData = formatWhatsAppMessage(order, pelanggan, settings);
    if (!waData) {
      toast.error(TOAST_MESSAGES.ERROR);
      return;
    }
    window.open(waData.url, '_blank');
  };

  const saveHpAndSend = async () => {
    if (!newHp.trim()) {
      toast.error(TOAST_MESSAGES.ERROR);
      return;
    }
    const sub = getCachedSubscriptionReportSync();
    if (sub?.isExpired) {
      setShowHpModal(false);
      setGateModal({
        open: true,
        type: isTrialExpired(sub) ? 'TRIAL_EXPIRED' : 'SUBSCRIPTION_EXPIRED',
        data: { plan: sub?.plan, isTrial: isTrialExpired(sub) },
      });
      return;
    }
    try {
      let updatedPelanggan = { ...pelanggan, hp: newHp };
      if (pelanggan && pelanggan.id) {
        await updatePelanggan(pelanggan.id, { hp: newHp });
      } else {
        const newPelangganId = await addPelanggan({ nama: order.pelangganNama || 'Pelanggan Umum', hp: newHp, alamat: '-' });
        await updateOrder(order.id, { pelangganId: newPelangganId });
        updatedPelanggan = { id: newPelangganId, nama: order.pelangganNama || 'Pelanggan Umum', hp: newHp, alamat: '-' };
      }
      setShowHpModal(false);
      toast.success(TOAST_MESSAGES.SUCCESS);

      setTimeout(() => {
        const waData = formatWhatsAppMessage(order, updatedPelanggan, settings);
        if (waData) window.open(waData.url, '_blank');
      }, 300);
    } catch (error) {
      toast.error(TOAST_MESSAGES.ERROR);
    }
  };

  const toggleInventory = (inv) => {
    setSelectedInventory(prev => {
      const exists = prev.find(item => isSameInventory(item, inv));
      if (exists) {
        return prev.filter(item => !isSameInventory(item, inv));
      } else {
        const oldInv = order?.inventoryUsed || [];
        const oldItem = oldInv.find(i => isSameInventory(i, inv));
        const oldQty = oldItem ? Number(oldItem.quantity ?? oldItem.qty ?? 1) : 0;
        const availableStock = (Number(inv.stok) || 0) + oldQty;

        if (availableStock <= 0) {
          toast.error(TOAST_MESSAGES.ERROR);
          return prev;
        }
        return [...prev, { id: inv.id, uuid: inv.uuid, nama: inv.nama, quantity: 1 }];
      }
    });
  };

  const updateInventoryQty = (inv, delta) => {
    setSelectedInventory(prev => {
      const existing = prev.find(item => isSameInventory(item, inv));
      if (existing) {
        const currentQty = Number(existing.quantity ?? existing.qty ?? 1);
        const newQty = currentQty + delta;
        if (newQty <= 0) {
          return prev.filter(item => !isSameInventory(item, inv));
        } else {
          if (delta > 0) {
            const oldInv = order?.inventoryUsed || [];
            const oldItem = oldInv.find(i => isSameInventory(i, inv));
            const oldQty = oldItem ? Number(oldItem.quantity ?? oldItem.qty ?? 1) : 0;
            const availableStock = (Number(inv.stok) || 0) + oldQty;
            if (newQty > availableStock) {
              toast.error(TOAST_MESSAGES.ERROR);
              return prev;
            }
          }
          return prev.map(item => isSameInventory(item, inv) ? { ...item, quantity: newQty } : item);
        }
      }
      return prev;
    });
  };

  const saveInventory = async () => {
    try {
      const oldInv = order.inventoryUsed || [];

      // Normalisasi dan pastikan deduplikasi
      const newInv = [];
      for (const item of selectedInventory) {
        const existing = newInv.find(x => isSameInventory(x, item));
        if (!existing) {
          newInv.push({
            id: item.id,
            uuid: item.uuid || undefined,
            nama: item.nama,
            quantity: Math.max(1, Number(item.quantity ?? item.qty ?? 1))
          });
        }
      }

      const allItems = [...oldInv];
      for (const n of newInv) {
        if (!allItems.some(o => isSameInventory(o, n))) {
          allItems.push(n);
        }
      }

      const targetOrderId = order.id || id;
      const targetInvoiceId = order.invoiceId || `#${targetOrderId}`;
      const storeId = order.storeId || currentUser?.storeId || undefined;
      const actor = currentUser?.username || currentUser?.fullname || 'Kasir';

      // Atomic Dexie transaction: Jika terjadi kegagalan, SEMUA perubahan dibatalkan (rollback)
      await db.transaction('rw', [db.orders, db.inventory, db.inventoryEvents], async () => {
        for (const refItem of allItems) {
          const oldItem = oldInv.find(i => isSameInventory(i, refItem));
          const newItem = newInv.find(i => isSameInventory(i, refItem));

          const oldQty = oldItem ? Number(oldItem.quantity ?? oldItem.qty ?? 1) : 0;
          const newQty = newItem ? Number(newItem.quantity ?? newItem.qty ?? 1) : 0;

          const diff = newQty - oldQty;
          if (diff === 0) continue;

          // Lookup item inventori di db.inventory
          let invData = null;
          if (typeof refItem.id === 'number') {
            invData = await db.inventory.get(refItem.id);
          } else if (typeof refItem.id === 'string' && /^\d+$/.test(refItem.id.trim())) {
            invData = await db.inventory.get(parseInt(refItem.id.trim(), 10));
          }
          if (!invData && refItem.uuid) {
            invData = await db.inventory.where('uuid').equals(refItem.uuid).first();
          }
          if (!invData && typeof refItem.id === 'string' && refItem.id.trim()) {
            invData = await db.inventory.where('uuid').equals(refItem.id.trim()).first();
          }
          if (!invData && refItem.nama) {
            const sName = refItem.nama.trim().toLowerCase();
            invData = await db.inventory.filter(i => i.nama && i.nama.trim().toLowerCase() === sName).first();
          }

          if (!invData) {
            throw new Error(`Data barang "${refItem.nama || 'inventori'}" tidak ditemukan di database. Perubahan dibatalkan.`);
          }

          const currentStok = Number(invData.stok || 0);

          if (diff > 0) {
            // Pemakaian inventori bertambah -> kurangi stok dan catat event SUBTRACT
            if (currentStok < diff) {
              throw new Error(`Stok "${invData.nama}" tidak mencukupi (sisa: ${currentStok}, dibutuhkan tambahan: ${diff}). Perubahan dibatalkan.`);
            }
            const newStok = Math.max(0, currentStok - diff);
            await db.inventory.update(invData.id, withUpdatedSyncMeta({ stok: newStok }));
            await db.inventoryEvents.add(withNewSyncMeta({
              storeId: storeId || invData.storeId || undefined,
              inventoryId: invData.id,
              inventoryName: invData.nama,
              type: 'SUBTRACT',
              qty: diff,
              note: `Penambahan penggunaan inventori order #${targetInvoiceId}`,
              invoiceId: targetInvoiceId,
              createdBy: actor,
              createdAt: new Date(),
            }));
          } else {
            // Pemakaian inventori berkurang -> kembalikan stok dan catat event ADD
            const returnedQty = Math.abs(diff);
            const newStok = currentStok + returnedQty;
            await db.inventory.update(invData.id, withUpdatedSyncMeta({ stok: newStok }));
            await db.inventoryEvents.add(withNewSyncMeta({
              storeId: storeId || invData.storeId || undefined,
              inventoryId: invData.id,
              inventoryName: invData.nama,
              type: 'ADD',
              qty: returnedQty,
              note: `Pengembalian inventori order #${targetInvoiceId}`,
              invoiceId: targetInvoiceId,
              createdBy: actor,
              createdAt: new Date(),
            }));
          }
        }

        // Simpan perubahan inventoryUsed ke order
        await db.orders.update(targetOrderId, withUpdatedSyncMeta({ inventoryUsed: newInv }));
      });

      setLocalInventoryUsed(newInv);
      toast.success(TOAST_MESSAGES.SUCCESS);
      setShowInventoryModal(false);

      // Trigger sync ke backend di background
      syncInventoryToBackend().catch(err => console.warn('[Sync] inventory error:', err));
      syncInventoryEventsToBackend().catch(err => console.warn('[Sync] inventoryEvents error:', err));
      syncOrderToBackend(targetOrderId).catch(err => console.warn('[Sync] order error:', err));
    } catch (err) {
      console.error('[OrderDetail] saveInventory error:', err);
      toast.error(err.message || TOAST_MESSAGES.ERROR);
    }
  };

  const triggerPrint = async (type) => {
    if (type === 'a4') {
      try {
        const sub = await getSubscriptionReport();
        if (sub && sub.isEnforced) {
          if (sub.limits?.maxPdfInvoice === 0) {
            setGateModal({ open: true, type: 'PDF_LIMIT', data: { plan: sub.plan, limit: 0 } });
            return;
          }
        }
      } catch (err) {
        console.warn('Check PDF limit error:', err);
      }
    }
    setPrintType(type);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  return (
    <>
      {/* Komponen Cetak Standar */}
      <PrintLayout order={order} pelanggan={pelanggan || { nama: order.pelangganNama, hp: order.pelangganHp }} printType={printType} />

      <div
        className="order-detail-wrapper"
        style={{
          paddingBottom: DRAWER_FOLLOW_CONTENT
            ? '0px'
            : (isCompactDrawer ? '140px' : '280px'),
          // Layout memberi jarak di bawah halaman: pb-3 (1rem) + .page-content-wrapper margin-bottom 62px.
          // Saat drawer menempel di bawah konten, jarak itu ditarik balik agar drawer tepat rata
          // dengan dasar layar (menutupi menu bawah, sama seperti sebelumnya) di akhir scroll.
          marginBottom: DRAWER_FOLLOW_CONTENT ? `calc(-1rem - ${BOTTOM_MENU_HEIGHT}px)` : 0,
          transition: 'padding-bottom 0.22s ease-out',
        }}
      >
        {order?.deletedAt && (
          <div className="alert alert-warning py-2 px-3 rounded-4 small mb-2 d-flex align-items-center gap-2 shadow-xs">
            <i className="bi bi-exclamation-triangle-fill text-warning fs-5"></i>
            <div>
              <strong>Pesanan Dibatalkan / Dihapus</strong>
              <div className="text-muted" style={{ fontSize: '0.72rem' }}>Pesanan ini telah dibatalkan dari sistem operasional.</div>
            </div>
          </div>
        )}

        {/* ===== KONTEN ORDER DETAIL ===== */}
        <div className="od-content">
          <style>{OD_CSS}</style>

          {/* Banner toko + nomor order */}
          <div className={`od-hero ${order.isPriority ? 'prio' : ''}`}>
            <div className="od-shop">
              <div>
                {settings === undefined ? (
                  <Skeleton
                    width="130px"
                    height="18px"
                    borderRadius="6px"
                    style={{
                      background: 'linear-gradient(90deg, rgba(255,255,255,0.2) 25%, rgba(255,255,255,0.4) 37%, rgba(255,255,255,0.2) 63%)',
                      backgroundSize: '200% 100%'
                    }}
                  />
                ) : (
                  <b>{settings?.namaLaundry || 'TokoPlus'}</b>
                )}
                <small>{settings?.motto || 'Solusi Laundry Bersih & Cepat'}</small>
                {order.isPriority && (
                  <span className="od-prio"><i className="bi bi-star-fill"></i> PRIORITAS</span>
                )}
              </div>

              {/* Operator / Kasir pembuat transaksi (khusus Owner) */}
              {isOwner && (
                <span className="od-kasir" title="Petugas yang melakukan transaksi">
                  <i className="bi bi-person-circle"></i>
                  <span>{getKasirUsername()}</span>
                </span>
              )}
            </div>

            <div className="od-inv">
              <div>
                <span>NO. ORDER</span>
                <strong>{order.invoiceId || 'KL'}</strong>
              </div>
              <span className={`od-chip ${isStatusLunas(order.statusBayar) ? 'ok' : 'wait'}`}>
                <i className={`bi ${isStatusLunas(order.statusBayar) ? 'bi-check-circle-fill' : 'bi-hourglass-split'}`}></i>
                {order.statusBayar}
              </span>
            </div>
          </div>

          {/* Pelanggan + waktu */}
          <div className="od-card">
            <div className="od-cust">
              <span className="od-av">{(pelanggan?.nama || order.pelangganNama || 'U').trim().charAt(0).toUpperCase()}</span>
              <div className="n">
                <b>{pelanggan?.nama || order.pelangganNama || 'Pelanggan Umum'}</b>
                <span><i className="bi bi-telephone"></i> {pelanggan?.hp || order.pelangganHp || '-'}</span>
              </div>
            </div>
            <div className="od-tiles">
              <div className="od-tile">
                <small>Tanggal Masuk</small>
                <b>{new Date(order.createdAt).toLocaleString('id-ID')}</b>
              </div>
              <div className="od-tile">
                <small>Estimasi Selesai</small>
                <b>({order.estimasi} Hari) {new Date(new Date(order.createdAt).getTime() + (order.estimasi * 86400000)).toLocaleDateString('id-ID')}</b>
              </div>
            </div>
          </div>

          {/* Catatan */}
          <div className="od-card">
            <div className={`od-note ${isCustomerNoteLocked ? 'lock' : ''}`}>
              <span className="ic b"><i className="bi bi-tag-fill"></i></span>
              <div className="t">
                <small>Catatan Pelanggan</small>
                <b className={order.catatan ? '' : 'empty'}>{order.catatan || '-'}</b>
              </div>
              {!isCustomerNoteLocked && (
                <button
                  type="button"
                  className="od-edit"
                  onClick={() => {
                    setCatatan(order.catatan || '');
                    setShowNoteModal(true);
                  }}
                >
                  <i className="bi bi-pencil-square"></i>Edit
                </button>
              )}
            </div>

            <div className={`od-note ${isCashierNoteLocked ? 'lock' : ''}`}>
              <span className="ic y"><i className="bi bi-shield-lock-fill"></i></span>
              <div className="t">
                <small>Catatan Kasir (internal)</small>
                <b className={order.catatanKasir ? '' : 'empty'}>{order.catatanKasir || '-'}</b>
              </div>
              {!isCashierNoteLocked && (
                <button
                  type="button"
                  className="od-edit y"
                  onClick={() => {
                    setCatatanKasir(order.catatanKasir || '');
                    setShowCashierNoteModal(true);
                  }}
                >
                  <i className="bi bi-pencil-square"></i>Edit
                </button>
              )}
            </div>
          </div>

          {/* Status pengerjaan */}
          <div className="od-card">
            <div className="od-title">Status Pengerjaan</div>
            <div className="od-steps">
              <button type="button" className={`od-step proses ${order.status === 'Proses' || !order.status ? 'on' : ''}`} onClick={() => handleStatusClick('Proses')}>
                <i className="bi bi-gear-wide-connected"></i>
                <span>PROSES</span>
              </button>
              <button type="button" className={`od-step selesai ${order.status === 'Selesai' ? 'on' : ''}`} onClick={() => handleStatusClick('Selesai')}>
                <i className="bi bi-check2-circle"></i>
                <span>SELESAI</span>
              </button>
              <button type="button" className={`od-step ambil ${order.status === 'Ambil' ? 'on' : ''}`} onClick={() => handleStatusClick('Ambil')}>
                <i className="bi bi-box-seam"></i>
                <span>AMBIL</span>
              </button>
            </div>
          </div>

          {/* Rincian layanan, inventory, harga */}
          <div className="od-card">
            {order.items && order.items.length > 0 && (
              <>
                <div className="od-title-row"><span className="od-title">Layanan / Produk</span></div>
                {order.items.map((item, idx) => (
                  <div key={idx} className="od-line">
                    <span className="q">{item.quantity}x</span>
                    <span className="nm">
                      {item.category ? <em>{(item.category || '').toLowerCase()}</em> : null}
                      {item.name}
                    </span>
                    <span className="pr">Rp {(item.price * item.quantity).toLocaleString()}</span>
                  </div>
                ))}
                <div className="od-sep"></div>
              </>
            )}

            <div className="od-title-row">
              <span className="od-title">Inventory Terpakai</span>
              {order.status === 'Proses' && (
                <button
                  type="button"
                  className="od-edit"
                  onClick={() => {
                    setSelectedInventory(order.inventoryUsed || displayedInventory || []);
                    setShowInventoryModal(true);
                  }}
                >
                  <i className="bi bi-pencil-square"></i>Edit
                </button>
              )}
            </div>
            {displayedInventory && displayedInventory.length > 0 ? (
              displayedInventory.map((inv, idx) => (
                <div key={idx} className="od-inv-row">
                  <span>{inv.nama}</span>
                  <span>{inv.quantity ?? inv.qty ?? 1}x</span>
                </div>
              ))
            ) : (
              <div className="od-inv-empty">Belum ada inventory yang ditambahkan</div>
            )}

            <div className="od-sep"></div>

            <div className="od-sum">
              <span>Sub-total</span>
              <span>Rp {order.subtotal?.toLocaleString()}</span>
            </div>
            {order.diskon > 0 && (
              <div className="od-sum red">
                <span>Diskon</span>
                <span>- Rp {order.diskon.toLocaleString()}</span>
              </div>
            )}

            <div className="od-total">
              <span>TOTAL AKHIR</span>
              <b>Rp {order.total.toLocaleString()}</b>
            </div>

            <div className="od-pay">
              <span>Bayar</span>
              <b>Rp {order.bayar?.toLocaleString() || 0}</b>
            </div>
            <div className="od-pay g">
              <span>Kembalian</span>
              <b>Rp {order.kembalian?.toLocaleString() || 0}</b>
            </div>
          </div>
        </div>

        {/* FLOATING BOTTOM DRAWER / PANEL AKSI & CETAK SEPERTI DI TRANSAKSI */}
        <div
          className={DRAWER_FOLLOW_CONTENT ? 'w-100 px-2 pb-0 mx-auto order-detail-drawer' : 'position-fixed bottom-0 start-50 translate-middle-x w-100 px-2 pb-0 order-detail-drawer'}
          style={DRAWER_FOLLOW_CONTENT ? {
            position: 'sticky',
            bottom: 0,
            marginTop: '8px',
            maxWidth: isCompactDrawer ? '540px' : '580px',
            zIndex: 1055,
            animation: 'drawerRise 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            pointerEvents: 'none',
          } : {
            maxWidth: isCompactDrawer ? '540px' : '580px',
            zIndex: 1055,
            animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            pointerEvents: 'none',
          }}
        >
          <style>{`@keyframes drawerRise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }`}</style>
          <div
            className="bg-white w-100 shadow-lg border"
            style={{
              borderRadius: isCompactDrawer ? '22px' : '26px',
              maxHeight: '88vh',
              overflowY: 'auto',
              padding: isCompactDrawer ? '10px 14px 14px' : '14px 16px 18px',
              boxShadow: '0 -10px 35px rgba(0,0,0,0.18)',
              pointerEvents: 'auto',
              transition: 'all 0.22s ease-out',
            }}
          >
            {/* Grabber indicator */}
            <div
              className="mx-auto"
              style={{
                width: isCompactDrawer ? '36px' : '45px',
                height: isCompactDrawer ? '4px' : '5px',
                backgroundColor: '#cbd5e1',
                borderRadius: '10px',
                marginBottom: isCompactDrawer ? '6px' : '10px',
                cursor: 'pointer',
              }}
              onClick={() => setIsCompactDrawer(!isCompactDrawer)}
              title={isCompactDrawer ? 'Klik untuk perbesar' : 'Klik untuk perkecil'}
            ></div>

            {/* Header Drawer: Info Pelanggan & Toggle Ukuran */}
            <div className={`d-flex justify-content-between align-items-center ${isCompactDrawer ? 'mb-1' : 'mb-2'}`}>
              <div className="d-flex align-items-center gap-2 overflow-hidden me-2">

                <div className="overflow-hidden">
                  <div className="d-flex align-items-center gap-1">
                    <span className="fw-bold text-dark text-truncate" style={{ fontSize: '0.7rem' }}>
                      {pelanggan?.nama || order.pelangganNama || 'Pelanggan Umum'}
                    </span>
                  </div>
                  {!isCompactDrawer && (pelanggan?.hp || order.pelangganHp) && (
                    <small className="text-muted text-truncate d-block" style={{ fontSize: '0.68rem', lineHeight: 1.1 }}>
                      <i className="bi bi-telephone me-1"></i>{pelanggan?.hp || order.pelangganHp}
                    </small>
                  )}
                </div>
              </div>

              <div className="d-flex align-items-center gap-1 flex-shrink-0">
                {/* Tombol Toggle Mode Kecil / Fullscreen */}
                {order.status !== 'Ambil' && isStatusLunas(order.statusBayar) && (
                  <button
                    type="button"
                    className="btn btn-primary rounded-pill px-3 py-1 fw-bold d-flex align-items-center justify-content-center gap-1 shadow-xs flex-fill text-nowrap"
                    style={{ fontSize: '0.72rem' }}
                    onClick={toggleLunas}
                  >
                    Set Belum Lunas
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-sm btn-light rounded-circle p-1 d-flex align-items-center justify-content-center text-muted border shadow-xs"
                  style={{ width: isCompactDrawer ? '28px' : '32px', height: isCompactDrawer ? '28px' : '32px' }}
                  onClick={() => setIsCompactDrawer(!isCompactDrawer)}
                  title={isCompactDrawer ? 'Perbesar tampilan drawer' : 'Perkecil tampilan drawer'}
                >
                  <i className={`bi ${isCompactDrawer ? 'bi-arrows-angle-expand' : 'bi-arrows-angle-contract'}`} style={{ fontSize: isCompactDrawer ? '0.75rem' : '0.85rem' }}></i>
                </button>
              </div>
            </div>

              {/* KONTEN ACTIONS */}
              {isCompactDrawer ? (
                /* MODE KECIL (COMPACT): Tombol-Tombol Aksi Cepat Sejajar */
                <div className="d-flex align-items-center gap-1 pt-0">
                  {!isStatusLunas(order.statusBayar) ? (
                    <>
                      {/* WA */}
                      <button
                        type="button"
                        className="btn btn-success rounded-pill px-2 py-1 fw-bold d-flex align-items-center justify-content-center gap-1 shadow-xs"
                        style={{ fontSize: '0.78rem' }}
                        onClick={sendWhatsApp}
                        title="Kirim Nota via WhatsApp"
                      >
                        <i className="bi bi-whatsapp"></i>
                        <span>WA</span>
                      </button>

                      {/* Bayar Sekarang */}
                      <button
                        type="button"
                        className="btn btn-primary rounded-pill px-3 py-1 fw-bold d-flex align-items-center justify-content-center gap-1 shadow-xs flex-fill text-nowrap"
                        style={{ fontSize: '0.78rem', backgroundColor: '#0134d4', borderColor: '#0134d4' }}
                        onClick={handleOpenPayModal}
                        title="Bayar Sekarang"
                      >
                        <i className="bi bi-wallet2"></i>
                        <span>Bayar</span>
                      </button>

                      {/* Tandai Lunas (Thermal & PDF tidak ditampilkan saat belum lunas) */}
                      {order.status !== 'Ambil' && (
                        <button
                          type="button"
                          className="btn btn-outline-success rounded-pill px-2 py-1 fw-bold d-flex align-items-center justify-content-center gap-1 shadow-xs flex-fill text-nowrap"
                          style={{ fontSize: '0.78rem' }}
                          onClick={toggleLunas}
                          title="Tandai pesanan lunas"
                        >
                          <i className="bi bi-check-circle"></i>
                          <span>Lunas</span>
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn btn-success rounded-pill px-2 py-1 fw-bold d-flex align-items-center justify-content-center gap-1 shadow-xs flex-fill"
                        style={{ fontSize: '0.78rem' }}
                        onClick={sendWhatsApp}
                        title="Kirim Nota via WhatsApp"
                      >
                        <i className="bi bi-whatsapp"></i>
                        <span>WA</span>
                      </button>

                      <button
                        type="button"
                        className="btn btn-outline-primary rounded-pill px-2 py-1 fw-bold d-flex align-items-center justify-content-center gap-1 shadow-xs flex-fill"
                        style={{ fontSize: '0.78rem' }}
                        onClick={() => triggerPrint('thermal')}
                        title="Cetak Nota Thermal"
                      >
                        <i className="bi bi-printer"></i>
                        <span>Thermal</span>
                      </button>

                      <button
                        type="button"
                        className="btn btn-outline-danger rounded-pill px-2 py-1 fw-bold d-flex align-items-center justify-content-center gap-1 shadow-xs flex-fill"
                        style={{ fontSize: '0.78rem' }}
                        onClick={() => triggerPrint('a4')}
                        title="Cetak PDF A4"
                      >
                        <i className="bi bi-file-earmark-pdf"></i>
                        <span>PDF</span>
                      </button>

                      <button
                        type="button"
                        className="btn btn-outline-secondary rounded-pill px-2 py-1 fw-semibold d-flex align-items-center justify-content-center gap-1 shadow-xs"
                        style={{ fontSize: '0.78rem' }}
                        onClick={() => setShowQrModal(true)}
                        title="Bagikan QR"
                      >
                        <i className="bi bi-qr-code"></i>
                        <span>QR</span>
                      </button>
                    </>
                  )}
                </div>
              ) : (
                /* MODE PENUH (EXPANDED): Semua Tombol Dikeluarkan & Disusun Rapi */
                <div className="d-flex flex-column gap-2">
                  {/* Status & Aksi Pembayaran */}
                  {!isStatusLunas(order.statusBayar) ? (
                    <div className="d-flex gap-2">
                      <button
                        type="button"
                        className="btn btn-primary rounded-pill py-2 px-4 fw-bold flex-fill shadow-sm d-flex align-items-center justify-content-center gap-1"
                        style={{ fontSize: '0.84rem' }}
                        onClick={handleOpenPayModal}
                      >
                        <i className="bi bi-wallet2"></i>
                        <span>Bayar</span>
                      </button>
                      {order.status !== 'Ambil' && (
                        <button
                          type="button"
                          className="btn btn-outline-success rounded-pill py-2 fw-bold flex-fill px-2 d-flex align-items-center justify-content-center gap-1"
                          style={{ fontSize: '0.82rem' }}
                          onClick={toggleLunas}
                        >
                          <i className="bi bi-check-circle"></i>
                          <span>Tandai Lunas</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    ''
                  )}

                  {/* Grid Tombol Cetak (Semua Button Cetak Dikeluarkan Rapi) */}
                  <div>
                    <div className="text-muted fw-bold mb-1 text-uppercase px-1" style={{ fontSize: '0.68rem', letterSpacing: '0px' }}>
                      Pilihan Cetak Nota & Label
                    </div>
                    <div className="row g-1 text-center">
                      <div className="col-3">
                        <button
                          type="button"
                          className="btn btn-outline-primary rounded-3 w-100 py-1 px-1 d-flex flex-column align-items-center justify-content-center shadow-xs"
                          onClick={() => triggerPrint('thermal')}
                          title="Nota Thermal"
                        >
                          <i className="bi bi-receipt fs-5 mb-0"></i>
                          <span style={{ fontSize: '0.68rem', fontWeight: 600 }}>Thermal</span>
                        </button>
                      </div>
                      <div className="col-3">
                        <button
                          type="button"
                          className="btn btn-outline-danger rounded-3 w-100 py-1 px-1 d-flex flex-column align-items-center justify-content-center shadow-xs"
                          onClick={() => triggerPrint('a4')}
                          title="Nota PDF (A4)"
                        >
                          <i className="bi bi-file-earmark-pdf fs-5 mb-0"></i>
                          <span style={{ fontSize: '0.68rem', fontWeight: 600 }}>PDF A4</span>
                        </button>
                      </div>
                      <div className="col-3">
                        <button
                          type="button"
                          className="btn btn-outline-info rounded-3 w-100 py-1 px-1 d-flex flex-column align-items-center justify-content-center shadow-xs text-dark"
                          onClick={() => triggerPrint('label')}
                          title="Label (Pcs)"
                        >
                          <i className="bi bi-tag fs-5 mb-0 text-info"></i>
                          <span style={{ fontSize: '0.68rem', fontWeight: 600 }}>Label</span>
                        </button>
                      </div>
                      <div className="col-3">
                        <button
                          type="button"
                          className="btn btn-outline-secondary rounded-3 w-100 py-1 px-1 d-flex flex-column align-items-center justify-content-center shadow-xs text-dark"
                          onClick={() => triggerPrint('barcode')}
                          title="Label Barcode"
                        >
                          <i className="bi bi-upc-scan fs-5 mb-0"></i>
                          <span style={{ fontSize: '0.68rem', fontWeight: 600 }}>Barcode</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Tombol Kirim WhatsApp */}
                  <button
                    type="button"
                    className="btn btn-success rounded-pill w-100 py-2 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2 mt-0"
                    style={{ fontSize: '0.88rem' }}
                    onClick={sendWhatsApp}
                  >
                    <i className="bi bi-whatsapp fs-5"></i>
                    <span>Kirim WhatsApp</span>
                  </button>

                  {/* Baris Tambahan: Prioritas & Bagikan QR */}
                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className={`btn ${order.isPriority ? 'btn-warning text-dark' : 'btn-light text-muted border'} rounded-pill flex-fill py-1 d-flex align-items-center justify-content-center gap-1 fw-medium`}
                      style={{ fontSize: '0.78rem' }}
                      onClick={togglePriority}
                    >
                      <i className={`bi ${order.isPriority ? 'bi-star-fill text-dark' : 'bi-star'}`}></i>
                      <span>{order.isPriority ? 'Batal Prioritas' : 'Prioritas'}</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-light text-muted border rounded-pill flex-fill py-1 d-flex align-items-center justify-content-center gap-1 fw-medium"
                      style={{ fontSize: '0.78rem' }}
                      onClick={() => setShowQrModal(true)}
                    >
                      <i className="bi bi-share text-primary"></i>
                      <span>Bagikan QR</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

        {/* Modal Edit Catatan */}
        {showNoteModal && (
          <>
            <div className="modal-backdrop fade show" style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.4)' }}></div>
            <div className="modal fade show d-block" tabIndex="-1">
              <div className="modal-dialog modal-dialog-centered mx-auto px-3" style={{ maxWidth: '420px', width: '100%' }}>
                <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '24px' }}>
                  <div className="modal-header border-0 pb-0 pt-4 px-4">
                    <h5 className="fw-bold mb-0">Catatan</h5>
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
                    <button className="btn btn-outline-primary w-100 rounded-pill fw-bold py-3 shadow-sm" onClick={updateCatatan}>{BUTTON_TEXT.SAVE}</button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Modal Edit Catatan Kasir (Internal) */}
        {showCashierNoteModal && (
          <>
            <div className="modal-backdrop fade show" style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.4)' }}></div>
            <div className="modal fade show d-block" tabIndex="-1">
              <div className="modal-dialog modal-dialog-centered mx-auto px-3" style={{ maxWidth: '420px', width: '100%' }}>
                <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '24px' }}>
                  <div className="modal-header border-0 pb-0 pt-4 px-4 justify-content-between align-items-center">
                    <div className="d-flex align-items-center gap-2">
                      <i className="bi bi-shield-lock-fill text-warning fs-4"></i>
                      <h5 className="fw-bold mb-0">Catatan Kasir</h5>
                    </div>
                    <button type="button" className="btn-close" onClick={() => setShowCashierNoteModal(false)}></button>
                  </div>
                  <div className="modal-body p-4">
                    <textarea
                      className="form-control border-0 bg-light rounded-4 p-3 mb-3"
                      value={catatanKasir}
                      onChange={(e) => setCatatanKasir(e.target.value)}
                      rows="4"
                      placeholder="Contoh: Baju putih ada noda luntur di kerah, kancing jas kurang 1..."
                    ></textarea>
                    <button className="btn btn-warning text-dark w-100 rounded-pill fw-bold py-3 shadow-sm" onClick={updateCatatanKasir}>
                      {BUTTON_TEXT.SAVE}
                    </button>
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
              <div className="modal-dialog modal-dialog-centered mx-auto px-3" style={{ maxWidth: '480px', width: '100%' }}>
                <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '24px' }}>
                  <div className="modal-header border-0 pb-0 pt-4 px-4">
                    <h5 className="fw-bold mb-0">Edit Inventory</h5>
                    <button type="button" className="btn-close" onClick={() => {
                      setShowInventoryModal(false);
                      setSelectedInventory(order.inventoryUsed || displayedInventory || []);
                    }}></button>
                  </div>
                  <div className="modal-body p-4">
                    <label className="small fw-bold text-muted text-uppercase mb-3">Pilih Inventori & Jumlahnya</label>
                    <div className="d-flex flex-column gap-2 mb-4 max-h-50 overflow-auto">
                      {allInventory?.filter(inv => !(inv.status === 'pending' && inv.stok === 0)).map(inv => {
                        const activeItem = selectedInventory.find(s => isSameInventory(s, inv));
                        const isActive = !!activeItem;
                        const oldInv = order?.inventoryUsed || [];
                        const oldItem = oldInv.find(i => isSameInventory(i, inv));
                        const oldQty = oldItem ? Number(oldItem.quantity ?? oldItem.qty ?? 1) : 0;
                        const availableStock = (Number(inv.stok) || 0) + oldQty;
                        const isOutOfStock = availableStock <= 0;

                        return (
                          <div
                            key={inv.id}
                            className={`d-flex align-items-center justify-content-between p-3 rounded-4 border transition-all ${isActive
                              ? 'bg-outline-primary text-dark border-primary shadow-sm'
                              : isOutOfStock
                                ? 'bg-light text-muted opacity-50'
                                : 'bg-white text-dark shadow-sm'
                              }`}
                          >
                            <div
                              className="d-flex align-items-center gap-3 flex-grow-1"
                              style={{ cursor: isOutOfStock && !isActive ? 'not-allowed' : 'pointer' }}
                              onClick={() => {
                                if (isOutOfStock && !isActive) {
                                  toast.error(TOAST_MESSAGES.ERROR);
                                  return;
                                }
                                toggleInventory(inv);
                              }}
                            >
                              <i className={`bi ${isActive ? 'bi-check-circle-fill text-primary' : 'bi-box-seam'} fs-4`}></i>
                              <div>
                                <div className="fw-bold">{inv.nama}</div>
                                <small className={isOutOfStock && !isActive ? 'text-danger fw-bold' : isActive ? 'text-primary-50' : 'text-muted'}>
                                  {isOutOfStock && !isActive ? 'Stok Habis (0)' : `Sisa Stok: ${inv.stok}`}
                                </small>
                              </div>
                            </div>
                            {isActive && (
                              <div className="d-flex align-items-center gap-2 bg-white rounded-pill p-1 shadow-sm" onClick={e => e.stopPropagation()}>
                                <button className="btn btn-sm btn-light rounded-circle p-0 d-flex align-items-center justify-content-center" style={{ width: '16px', height: '16px' }} onClick={() => updateInventoryQty(inv, -1)}>
                                  <i className="bi bi-dash text-primary"></i>
                                </button>
                                <span className="fw-bold text-primary px-1" style={{ fontSize: '0.9rem', minWidth: '20px', textAlign: 'center' }}>{activeItem.quantity ?? activeItem.qty ?? 1}</span>
                                <button className="btn btn-sm btn-light rounded-circle p-0 d-flex align-items-center justify-content-center" style={{ width: '16px', height: '16px' }} onClick={() => updateInventoryQty(inv, 1)}>
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
                    <button className="btn btn-outline-primary w-100 rounded-pill fw-bold py-3" onClick={saveInventory}>{BUTTON_TEXT.SAVE}</button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Floating Bottom Sheet Input Nomor WhatsApp */}
        {showHpModal && (
          <>
            <div
              className="modal-backdrop fade show"
              style={{
                zIndex: 1060,
                backgroundColor: 'rgba(0,0,0,0.4)',
                backdropFilter: 'blur(4px)',
              }}
              onClick={() => setShowHpModal(false)}
            ></div>
            <div
              className="position-fixed bottom-0 start-50 translate-middle-x w-100 px-2 pb-2 order-detail-drawer"
              style={{
                maxWidth: '540px',
                zIndex: 1065,
                animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              <div
                className="bg-white w-100 shadow-lg border"
                style={{
                  borderRadius: '24px',
                  padding: '14px 18px 18px',
                  boxShadow: '0 -10px 35px rgba(0,0,0,0.18)',
                }}
              >
                {/* Grabber indicator */}
                <div
                  className="mx-auto"
                  style={{
                    width: '38px',
                    height: '4px',
                    backgroundColor: '#cbd5e1',
                    borderRadius: '10px',
                    marginBottom: '10px',
                  }}
                ></div>

                {/* Header */}
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <div className="d-flex align-items-center gap-2">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center text-success flex-shrink-0"
                      style={{ width: '34px', height: '34px', backgroundColor: '#dcfce7' }}
                    >
                      <i className="bi bi-whatsapp fs-5"></i>
                    </div>
                    <div>
                      <h6 className="fw-bold mb-0 text-dark" style={{ fontSize: '0.95rem' }}>
                        WhatsApp Pelanggan
                      </h6>
                      <small className="text-muted" style={{ fontSize: '0.72rem' }}>
                        {pelanggan?.nama || order.pelangganNama || 'Pelanggan'} belum memiliki nomor WhatsApp
                      </small>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-light rounded-circle p-1 d-flex align-items-center justify-content-center text-muted border shadow-xs"
                    style={{ width: '30px', height: '30px' }}
                    onClick={() => setShowHpModal(false)}
                    title="Tutup"
                  >
                    <i className="bi bi-x-lg" style={{ fontSize: '0.8rem' }}></i>
                  </button>
                </div>

                {/* Body Form */}
                <div className="mb-3">
                  <label className="form-label small fw-semibold text-muted mb-1" style={{ fontSize: '0.74rem' }}>
                    Nomor WhatsApp
                  </label>
                  <input
                    type="tel"
                    className="form-control bg-light border-0 rounded-pill px-3 py-2 fw-bold text-dark shadow-none"
                    style={{ fontSize: '0.92rem' }}
                    value={newHp}
                    onChange={(e) => setNewHp(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        saveHpAndSend();
                      }
                    }}
                    placeholder="Contoh: 081234567890"
                    autoFocus
                  />
                </div>

                {/* Tombol Aksi */}
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-light rounded-pill px-3 py-2 text-muted fw-semibold flex-shrink-0"
                    style={{ fontSize: '0.82rem' }}
                    onClick={() => setShowHpModal(false)}
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    className="btn btn-success rounded-pill w-100 py-2 fw-bold shadow-xs d-flex align-items-center justify-content-center gap-1"
                    style={{ fontSize: '0.86rem' }}
                    onClick={saveHpAndSend}
                  >
                    <i className="bi bi-whatsapp"></i>
                    <span>&nbsp; Kirim WhatsApp</span>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Modal QR Code Cek Status Cucian */}
        {showQrModal && (
          <>
            <div className="modal-backdrop fade show" style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0)', zIndex: 1060 }}></div>
            <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1065 }}>
              <div className="modal-dialog modal-dialog-centered mx-auto" style={{ maxWidth: '360px' }}>
                <div className="modal-content border-0 shadow-lg text-center p-4" style={{ borderRadius: '24px' }}>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="fw-bold mb-0 text-dark">
                      <i className="bi bi-qr-code-scan text-primary me-2"></i>Bagikan Cek Order
                    </h6>
                    <button
                      type="button"
                      className="btn-close"
                      onClick={() => setShowQrModal(false)}
                    ></button>
                  </div>

                  <div className="p-3 bg-light rounded-4 mb-3 d-inline-block shadow-sm">
                    <QRCodeSVG
                      value={getTrackingUrl(order.invoiceId)}
                      size={180}
                      className="rounded-3"
                    />
                  </div>

                  <div className="small fw-bold text-dark mb-1">#{order.invoiceId}</div>
                  <p className="text-muted small mb-3" style={{ fontSize: '0.78rem' }}>
                    Arahkan kamera HP ke QR Code di atas untuk membuka status pesanan secara langsung.
                  </p>

                  <div className="d-flex gap-2">
                    <button
                      className="btn btn-outline-primary rounded-pill flex-fill py-2 fw-semibold small"
                      onClick={() => {
                        const url = getTrackingUrl(order.invoiceId);
                        if (navigator.clipboard) {
                          navigator.clipboard.writeText(url).then(() => toast.success(TOAST_MESSAGES.SUCCESS));
                        }
                      }}
                    >
                      <i className="bi bi-link-45deg me-1"></i>Salin Link
                    </button>
                    <a
                      href={getTrackingUrl(order.invoiceId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary rounded-pill flex-fill py-2 fw-semibold small"
                    >
                      <i className="bi bi-box-arrow-up-right me-1"></i>Buka Link
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Floating Modal Pembayaran (Mode Ramping / Kompak Sesuai Mockup) */}
        {showPayModal && (
          <>
            <div
              className="position-fixed top-0 start-0 w-100 h-100"
              style={{
                zIndex: 1060,
                animation: 'fadeIn 0.2s ease-out',
              }}
              onClick={() => !isSubmittingPay && setShowPayModal(false)}
            ></div>
            <div
              className="position-fixed bottom-0 start-50 translate-middle-x w-100 px-2 pb-0 order-detail-drawer"
              style={{
                maxWidth: '520px',
                zIndex: 1065,
                animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              <div
                className="bg-white w-100 shadow-lg border"
                style={{
                  borderRadius: '20px 20px 0 0',
                  maxHeight: '90vh',
                  overflowY: 'auto',
                  padding: '10px 14px 14px',
                  boxShadow: '0 -10px 35px rgba(0,0,0,0.22)',
                }}
              >
                {/* Grabber indicator */}
                <div
                  className="mx-auto"
                  style={{
                    width: '36px',
                    height: '4px',
                    backgroundColor: '#cbd5e1',
                    borderRadius: '10px',
                    marginBottom: '6px',
                    cursor: 'pointer',
                  }}
                  onClick={() => setShowPayModal(false)}
                ></div>

                {/* Header */}
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div className="d-flex align-items-center gap-2 overflow-hidden me-2">
                    <div
                      className="rounded-circle bg-light d-flex align-items-center justify-content-center text-primary flex-shrink-0 border"
                      style={{ width: '30px', height: '30px' }}
                    >
                      <i className="bi bi-person-fill" style={{ fontSize: '0.88rem' }}></i>
                    </div>
                    <div className="overflow-hidden">
                      <div className="fw-bold text-dark text-truncate" style={{ fontSize: '0.88rem' }}>
                        {pelanggan?.nama || order.pelangganNama || 'Pelanggan Umum'}
                      </div>
                    </div>
                  </div>
                  <div className="d-flex align-items-center gap-1">
                    <button
                      type="button"
                      className="btn btn-sm btn-light rounded-circle p-1 d-flex align-items-center justify-content-center text-muted border shadow-xs"
                      style={{ width: '28px', height: '28px' }}
                      onClick={() => !isSubmittingPay && setShowPayModal(false)}
                      disabled={isSubmittingPay}
                      title="Tutup"
                    >
                      <i className="bi bi-x-lg" style={{ fontSize: '0.78rem' }}></i>
                    </button>
                  </div>
                </div>

                {/* Total Tagihan Banner Sesuai Mockup */}
                <div
                  className="rounded-3 mb-2 d-flex justify-content-between align-items-center py-2 px-3"
                  style={{
                    backgroundColor: '#0134d4',
                    color: '#ffffff',
                    borderRadius: '14px',
                  }}
                >
                  <div className="fw-bold text-uppercase" style={{ fontSize: '0.72rem', letterSpacing: '0px', opacity: 0.95 }}>
                    {order.statusBayar === 'DP' ? 'SISA TAGIHAN' : 'TOTAL TAGIHAN'}
                  </div>
                  <div className="fw-bolder mb-0 text-white" style={{ fontSize: '1.45rem', lineHeight: 1 }}>
                    Rp {tagihanToPay.toLocaleString('id-ID')}
                  </div>
                </div>

                {/* Status Pembayaran Toggle: Lunas vs Belum Lunas */}
                <div className="mb-2">
                  <div className="d-flex p-1 rounded-3 bg-light border gap-1">
                    <button
                      type="button"
                      className={`btn flex-fill rounded-2 py-1 fw-bold transition-all border-0 d-flex align-items-center justify-content-center gap-1 ${payIsLunas ? 'btn-success shadow-xs text-white' : 'btn-light text-muted bg-transparent'}`}
                      style={{ fontSize: '0.8rem', height: '32px' }}
                      onClick={() => setPayIsLunas(true)}
                    >
                      <i className="bi bi-check-circle-fill"></i> Lunas
                    </button>
                    <button
                      type="button"
                      className={`btn flex-fill rounded-2 py-1 fw-bold transition-all border-0 d-flex align-items-center justify-content-center gap-1 ${!payIsLunas ? 'btn-warning shadow-xs text-dark' : 'btn-light text-muted bg-transparent'}`}
                      style={{ fontSize: '0.8rem', height: '32px' }}
                      onClick={() => setPayIsLunas(false)}
                    >
                      <i className="bi bi-clock"></i> Belum Lunas
                    </button>
                  </div>
                </div>

                {/* Pilihan Metode Bayar */}
                <div className="mb-2">
                  <div className="row g-1">
                    {[
                      { key: 'Cash', label: 'Cash', icon: 'bi-cash-stack' },
                      { key: 'QRIS', label: 'QRIS', icon: 'bi-qr-code' },
                      { key: 'Transfer', label: 'Transfer', icon: 'bi-bank' },
                    ].map((item) => (
                      <div key={item.key} className="col-4">
                        <button
                          type="button"
                          className={`btn w-100 py-1 rounded-2 border d-flex flex-column align-items-center justify-content-center transition-all ${payMetodeBayar === item.key ? 'border-primary bg-primary-subtle text-primary fw-bold shadow-xs' : 'bg-white text-secondary'}`}
                          onClick={() => setPayMetodeBayar(item.key)}
                          style={{ height: '48px', fontSize: '0.74rem' }}
                        >
                          <i className={`bi ${item.icon} fs-6 mb-0`}></i>
                          <span className="text-truncate">{item.label}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pilihan Nominal Cepat */}
                <div className="mb-1">
                  <div className="d-flex justify-content-between align-items-center">
                    <label className="form-label small fw-bold text-muted text-uppercase mb-0" style={{ fontSize: '0.5rem', letterSpacing: '0.3px' }}>
                      {payIsLunas ? 'Pilihan Uang Diterima' : 'Nominal Uang Muka (DP)'}
                    </label>
                  </div>
                  <div className="d-flex align-items-center gap-0 overflow-x-auto no-scrollbar py-0">
                    <button
                      type="button"
                      className={`btn btn-sm ${payNominal === tagihanToPay.toString() ? 'btn-primary text-white' : 'btn-outline-secondary'} fw-bold py-0 px-2 rounded-2 text-nowrap`}
                      style={{ fontSize: '0.68rem', height: '26px', lineHeight: '24px' }}
                      onClick={() => handleQuickNominal('pas')}
                    >
                      Uang Pas
                    </button>
                    {[20000, 50000, 100000, 200000].map((nom) => (
                      <button
                        key={nom}
                        type="button"
                        className={`btn btn-sm ${payNominal === nom.toString() ? 'btn-primary text-white' : 'btn-outline-secondary'} fw-bold py-0 px-2 rounded-2 text-nowrap`}
                        style={{ fontSize: '0.68rem', height: '26px', lineHeight: '24px' }}
                        onClick={() => handleQuickNominal(nom)}
                      >
                        {nom / 1000}rb
                      </button>
                    ))}
                    {tagihanToPay > 100000 && (
                      <button
                        type="button"
                        className={`btn btn-sm ${payNominal === String(Math.ceil(tagihanToPay / 50000) * 50000) ? 'btn-primary text-white' : 'btn-outline-secondary'} fw-bold py-0 px-2 rounded-2 text-nowrap`}
                        style={{ fontSize: '0.68rem', height: '26px', lineHeight: '24px' }}
                        onClick={() => handleQuickNominal(Math.ceil(tagihanToPay / 50000) * 50000)}
                      >
                        {(Math.ceil(tagihanToPay / 50000) * 50).toLocaleString()}rb
                      </button>
                    )}
                  </div>
                </div>

                {/* Input Nominal Pembayaran (Rp di Kiri) */}
                <div className="mb-1">
                  <div className="input-group rounded-2 overflow-hidden border bg-white" style={{ height: '38px' }}>
                    <span className="input-group-text bg-white border-0 text-muted fw-bold ps-2 pe-1" style={{ fontSize: '0.88rem' }}>
                      Rp
                    </span>
                    <input
                      id="order-detail-pay-input"
                      aria-label="Nominal Uang Diterima"
                      type="number"
                      className="form-control border-0 px-1 fw-bold text-dark"
                      style={{
                        fontSize: '1rem',
                        height: '38px',
                        boxShadow: 'none',
                      }}
                      placeholder={payIsLunas ? `Uang Pas (${tagihanToPay.toLocaleString('id-ID')})` : '0 (Belum Bayar)'}
                      value={payNominal}
                      onChange={(e) => setPayNominal(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      min="0"
                    />
                    {payNominal && (
                      <button
                        type="button"
                        className="btn btn-sm btn-link text-decoration-none text-muted p-0 pe-2 d-flex align-items-center"
                        onClick={() => setPayNominal('')}
                        title="Hapus nominal"
                      >
                        <i className="bi bi-x-circle-fill text-secondary" style={{ fontSize: '0.88rem' }}></i>
                      </button>
                    )}
                  </div>
                </div>

                {/* Rincian Kembalian / Sisa Tagihan (Satu Baris Padat Sesuai Mockup) */}
                <div className="bg-light px-2 py-1 rounded-3 mb-1 border d-flex justify-content-between align-items-center">
                  <span className="fw-semibold text-secondary" style={{ fontSize: '0.82rem' }}>
                    {payIsLunas ? 'Kembalian:' : 'Sisa Tagihan:'}
                  </span>
                  <span className={`fw-bolder ${payIsLunas ? 'text-success' : 'text-danger'}`} style={{ fontSize: '0.96rem' }}>
                    Rp {(payIsLunas ? payKembalian : paySisaTagihan).toLocaleString('id-ID')}
                  </span>
                </div>

                {/* Tombol Konfirmasi Selesai Pembayaran */}
                <button
                  type="button"
                  className="btn btn-primary w-100 py-1 rounded-3 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-0"
                  style={{ fontSize: '0.8rem', backgroundColor: '#0134d4', borderColor: '#0134d4', height: '42px' }}
                  onClick={handleConfirmPayment}
                  disabled={isSubmittingPay}
                >
                  {isSubmittingPay ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                      Memproses...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check2 fs-5"></i>
                      <span>
                        {payIsLunas
                          ? `Bayar`
                          : (effectivePayBayar > 0
                            ? `Bayar DP`
                            : 'Simpan')}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Modal Sukses Pembayaran dengan Animasi Counter & Suara */}
        {showSuccessModal && successPayData && (
          <div
            className="position-fixed bottom-0 start-50 translate-middle-x w-100 px-2 pb-0 order-detail-drawer"
            style={{
              maxWidth: '540px',
              zIndex: 1070,
              animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <div
              className="bg-white w-100 shadow-lg border d-flex flex-column"
              style={{
                borderRadius: '24px 24px 0 0',
                padding: '16px 18px 20px',
                boxShadow: '0 -10px 35px rgba(0,0,0,0.22)',
              }}
            >
              {/* Grabber */}
              <div
                className="mx-auto"
                style={{ width: '40px', height: '4px', backgroundColor: '#cbd5e1', borderRadius: '10px', marginBottom: '10px' }}
              ></div>

              <div className="text-center">
                <div
                  className="rounded-circle mx-auto mb-1 d-flex align-items-center justify-content-center"
                  style={{ width: '48px', height: '48px', backgroundColor: '#dcfce7', color: '#16a34a' }}
                >
                  <i className="bi bi-check-lg" style={{ fontSize: '1.75rem' }}></i>
                </div>
                <h5 className="fw-bold text-dark mb-0" style={{ fontSize: '1.05rem' }}>Pembayaran Berhasil!</h5>
                <p className="text-muted mb-2" style={{ fontSize: '0.72rem' }}>Pembayaran pesanan telah berhasil dicatat & diproses.</p>
              </div>

              <div
                className="px-3 py-2 mb-2 d-flex justify-content-between align-items-center"
                style={{ backgroundColor: '#0134d4', color: '#ffffff', borderRadius: '16px' }}
              >
                <div>
                  <div className="fw-bold text-uppercase" style={{ fontSize: '0.7rem', letterSpacing: '0px', opacity: 0.85 }}>
                    Total Pembayaran
                  </div>
                  {successPayData.isLunas ? (
                    <span className="badge rounded-pill px-2 py-1 mt-1" style={{ fontSize: '0.66rem', backgroundColor: '#dcfce7', color: '#166534' }}>
                      <i className="bi bi-check-circle-fill me-1"></i> Lunas
                    </span>
                  ) : (
                    <span className="badge rounded-pill px-2 py-1 mt-1" style={{ fontSize: '0.66rem', backgroundColor: '#fef3c7', color: '#92400e' }}>
                      <i className="bi bi-clock-fill me-1"></i> DP / Belum Lunas
                    </span>
                  )}
                </div>
                <div className="fw-bold text-white" style={{ fontSize: '1.45rem' }}>
                  <AnimatedCounter target={successPayData.total} />
                </div>
              </div>

              <div className="text-start bg-light px-3 py-2 rounded-3 border mb-3" style={{ fontSize: '0.78rem' }}>
                <div className="d-flex justify-content-between mb-1">
                  <span className="text-muted">No. Nota:</span>
                  <span className="fw-bold text-dark">{successPayData.invoiceId}</span>
                </div>
                <div className="d-flex justify-content-between mb-1">
                  <span className="text-muted">Pelanggan:</span>
                  <span className="fw-bold text-dark">{successPayData.pelangganNama}</span>
                </div>
                <div className="d-flex justify-content-between mb-1">
                  <span className="text-muted">Metode Bayar:</span>
                  <span className="fw-bold text-dark">{successPayData.metodeBayar}</span>
                </div>
                {successPayData.kembalian > 0 && (
                  <div className="d-flex justify-content-between border-top pt-1 mt-1">
                    <span className="text-muted fw-bold">Kembalian:</span>
                    <span className="fw-bold text-success">Rp {successPayData.kembalian.toLocaleString('id-ID')}</span>
                  </div>
                )}
              </div>

              <div className="d-grid gap-2">
                <button
                  type="button"
                  className="btn btn-primary py-2 rounded-3 fw-bold text-white shadow-sm"
                  style={{ fontSize: '0.9rem', backgroundColor: '#0134d4', borderColor: '#0134d4' }}
                  onClick={() => {
                    setShowSuccessModal(false);
                    setSuccessPayData(null);
                  }}
                >
                  <i className="bi bi-check-circle me-1"></i> Selesai
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Konfirmasi */}
        {showConfirmModal && (
          <>
            <div className="modal-backdrop fade show"></div>
            <div className="modal fade show d-block" tabIndex="-1">
              <div className="modal-dialog modal-dialog-centered mx-auto px-3" style={{ maxWidth: '400px', width: '100%' }}>
                <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '20px' }}>
                  <div className="modal-body text-center p-4">
                    <div className="icon-wrapper mb-3 mx-auto bg-warning-light d-flex align-items-center justify-content-center" style={{ width: '60px', height: '60px', backgroundColor: '#fff9c4', borderRadius: '50%' }}>
                      <i className="bi bi-exclamation-triangle text-warning fs-1"></i>
                    </div>
                    <h5 className="fw-bold mb-2">Konfirmasi Status</h5>
                    <p className="text-muted small mb-4">{CONFIRM_MESSAGES.RESET_STATUS}</p>
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
        {/* Plan Gate Modal untuk limitasi fitur Nota PDF */}
        <PlanGateModal
          isOpen={gateModal.open}
          onClose={() => setGateModal({ ...gateModal, open: false })}
          type={gateModal.type}
          customData={gateModal.data}
          user={user}
        />
      </div>
    </>
  );
};

export default OrderDetail;
