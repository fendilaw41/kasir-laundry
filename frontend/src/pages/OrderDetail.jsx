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
import { getSubscriptionReport, isTrialExpired, isPaidExpired } from '../services/subscriptionService';
import { QRCodeSVG } from '../components/common/QRCodeSVG';
import { Skeleton, OrderDetailSkeleton } from '../components/common/Skeleton';
import { db } from '../db';

const isSameInventory = (a, b) => {
  if (!a || !b) return false;
  if (a.id && b.id && String(a.id) === String(b.id)) return true;
  if (a.uuid && b.uuid && String(a.uuid) === String(b.uuid)) return true;
  if (a.uuid && b.id && String(a.uuid) === String(b.id)) return true;
  if (a.id && b.uuid && String(a.id) === String(b.uuid)) return true;
  if (a.nama && b.nama && a.nama.trim().toLowerCase() === b.nama.trim().toLowerCase()) return true;
  return false;
};

const OrderDetail = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const order = useLiveQuery(() => getOrderByIdQuery(id), [id]);
  const pelanggan = useLiveQuery(() => order ? getPelangganByIdQuery(order.pelangganId, order.pelangganNama) : null, [order]);
  const settings = useLiveQuery(getSettingsQuery);

  const allUsers = useLiveQuery(() => db.users.toArray(), []);
  const currentUser = user || JSON.parse(typeof sessionStorage !== 'undefined' ? (sessionStorage.getItem('user') || '{}') : '{}');
  const isOwner = currentUser?.role === 'owner';

  const [catatan, setCatatan] = useState('');
  const [catatanKasir, setCatatanKasir] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showCashierNoteModal, setShowCashierNoteModal] = useState(false);

  const getKasirUsername = () => {
    if (order?.kasirUsername) return order.kasirUsername;
    if (order?.user?.username) return order.user.username;
    if (order?.userId && allUsers) {
      const u = allUsers.find(userItem => userItem.uuid === order.userId || String(userItem.id) === String(order.userId));
      if (u) return u.username || u.fullname;
    }
    return '-';
  };
  const [showHpModal, setShowHpModal] = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [selectedInventory, setSelectedInventory] = useState([]);
  const [localInventoryUsed, setLocalInventoryUsed] = useState(null);
  const [newHp, setNewHp] = useState('');
  const [printType, setPrintType] = useState(null);
  const [gateModal, setGateModal] = useState({ open: false, type: 'PDF_LIMIT', data: {} });
  const [isQueryTimeout, setIsQueryTimeout] = useState(false);
  const [isCompactDrawer, setIsCompactDrawer] = useState(false);
  const [showFloatingDrawer, setShowFloatingDrawer] = useState(true);

  const allInventory = useLiveQuery(getInventoryQuery);

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
    try {
      const sub = await getSubscriptionReport().catch(() => null);
      if (isPaidExpired(sub)) {
        setShowConfirmModal(false);
        setGateModal({ open: true, type: 'SUBSCRIPTION_EXPIRED', data: { plan: sub?.plan, isTrial: false } });
        return;
      }
    } catch (e) {}

    try {
      await updateOrder(order.id, { status });
      setShowConfirmModal(false);
      toast.success(TOAST_MESSAGES.SUCCESS);
    } catch (error) {
      toast.error(error?.message || TOAST_MESSAGES.ERROR);
      setShowConfirmModal(false);
    }
  };

  const updateCatatan = async () => {
    try {
      const sub = await getSubscriptionReport().catch(() => null);
      if (sub?.isExpired) {
        setShowNoteModal(false);
        setGateModal({
          open: true,
          type: isTrialExpired(sub) ? 'TRIAL_EXPIRED' : 'SUBSCRIPTION_EXPIRED',
          data: { plan: sub?.plan, isTrial: isTrialExpired(sub) },
        });
        return;
      }
    } catch (e) {}
    if (isCustomerNoteLocked) {
      toast.error('Catatan pelanggan tidak dapat diedit karena cucian sudah selesai/diambil');
      setShowNoteModal(false);
      return;
    }
    try {
      await updateOrder(order.id, { catatan });
      toast.success(TOAST_MESSAGES.SUCCESS);
      setShowNoteModal(false);
    } catch (error) {
      toast.error(TOAST_MESSAGES.ERROR);
    }
  };

  const updateCatatanKasir = async () => {
    try {
      const sub = await getSubscriptionReport().catch(() => null);
      if (sub?.isExpired) {
        setShowCashierNoteModal(false);
        setGateModal({
          open: true,
          type: isTrialExpired(sub) ? 'TRIAL_EXPIRED' : 'SUBSCRIPTION_EXPIRED',
          data: { plan: sub?.plan, isTrial: isTrialExpired(sub) },
        });
        return;
      }
    } catch (e) {}
    if (isCashierNoteLocked) {
      toast.error('Catatan kasir tidak dapat diedit karena pesanan sudah diambil pelanggan');
      setShowCashierNoteModal(false);
      return;
    }
    try {
      await updateOrder(order.id, { catatanKasir });
      toast.success(TOAST_MESSAGES.SUCCESS);
      setShowCashierNoteModal(false);
    } catch (error) {
      toast.error(TOAST_MESSAGES.ERROR);
    }
  };

  const togglePriority = async () => {
    try {
      const sub = await getSubscriptionReport().catch(() => null);
      if (sub?.isExpired) {
        setGateModal({
          open: true,
          type: isTrialExpired(sub) ? 'TRIAL_EXPIRED' : 'SUBSCRIPTION_EXPIRED',
          data: { plan: sub?.plan, isTrial: isTrialExpired(sub) },
        });
        return;
      }
    } catch (e) {}
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
    try {
      const sub = await getSubscriptionReport().catch(() => null);
      if (sub?.isExpired) {
        setShowHpModal(false);
        setGateModal({
          open: true,
          type: isTrialExpired(sub) ? 'TRIAL_EXPIRED' : 'SUBSCRIPTION_EXPIRED',
          data: { plan: sub?.plan, isTrial: isTrialExpired(sub) },
        });
        return;
      }
    } catch (e) {}
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
          paddingBottom: !showFloatingDrawer ? '85px' : isCompactDrawer ? '140px' : '280px',
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

        <div
          className="card shadow-sm border-0 mb-0 overflow-hidden d-flex flex-column"
          style={{ minHeight: 'calc(100vh - 140px)' }}
        >
          {/* Banner */}
          <div className={`p-4 text-center text-white position-relative ${order.isPriority ? 'bg-danger' : 'bg-primary'}`}>
            {order.isPriority && (
              <div className="position-absolute top-0 start-0 p-2">
                <span className="badge bg-white text-danger fw-bold shadow-sm"><i className="bi bi-star-fill me-1"></i> PRIORITAS</span>
              </div>
            )}
            {settings === undefined ? (
              <Skeleton
                width="150px"
                height="22px"
                borderRadius="6px"
                className="my-1"
                style={{
                  background: 'linear-gradient(90deg, rgba(255,255,255,0.2) 25%, rgba(255,255,255,0.4) 37%, rgba(255,255,255,0.2) 63%)',
                  backgroundSize: '200% 100%'
                }}
              />
            ) : (
              <h5 className="text-white fw-bold mb-0">{settings?.namaLaundry || 'Kasir Laundry'}</h5>
            )}
            <small className="opacity-75">{settings?.motto || 'Solusi Laundry Bersih & Cepat'}</small>

            {/* Operator / Kasir / Owner pembuat transaksi di pojok kanan bawah kotak biru (Khusus Owner) */}
            {isOwner && (
              <div className="position-absolute bottom-0 end-0 p-2">
                <span
                  className="badge rounded-pill px-2 py-1 text-white shadow-sm d-inline-flex align-items-center gap-1"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.22)',
                    backdropFilter: 'blur(6px)',
                    border: '1px solid rgba(255, 255, 255, 0.35)',
                    fontSize: '0.68rem',
                    fontWeight: '500',
                    letterSpacing: '0.3px',
                  }}
                  title="Petugas yang melakukan transaksi"
                >
                  <i className="bi bi-person-circle"></i>
                  <span>{getKasirUsername()}</span>
                </span>
              </div>
            )}
          </div>

          {/* Info Ringkas */}
          <div className="card-body p-3 small border-bottom">
            <div className="d-flex justify-content-between mb-1 align-items-center">
              <span className="text-primary fw-bold">ID: {order.invoiceId || 'KL'}</span>
              <span className="text-muted">{new Date(order.createdAt).toLocaleString('id-ID')}</span>
            </div>
            <div className="d-flex justify-content-between mb-1">
              <h6 className="mb-0 fw-bold">{pelanggan?.nama || order.pelangganNama || 'Pelanggan Umum'}</h6>
              <div className="text-muted mb-1"><i className="bi bi-telephone me-1"></i> {pelanggan?.hp || order.pelangganHp || '-'}</div>
            </div>
            <div className="d-flex justify-content-between">
              <span>Estimasi Selesai :</span>
              <span className="fw-bold">({order.estimasi} Hari) {new Date(new Date(order.createdAt).getTime() + (order.estimasi * 86400000)).toLocaleDateString('id-ID')}</span>
            </div>
            <div className="d-flex justify-content-between mt-1 align-items-center">
              <span>Metode Bayar :</span>
              <span className={`badge ${isStatusLunas(order.statusBayar) ? 'bg-success' : 'bg-warning'} text-uppercase`}>
                {order.statusBayar}
              </span>
            </div>

            {/* Catatan Pelanggan */}
            <div
              className={`d-flex justify-content-between mt-2 pt-2 border-top align-items-start ${isCustomerNoteLocked ? 'opacity-75' : ''}`}
            >
              <div>
                <span className="fw-semibold text-secondary d-flex align-items-center gap-1">
                  <i className="bi bi-tag-fill text-primary"></i> Catatan Pelanggan :
                </span>
              </div>
              <div className="text-end ps-2">
                <span className="fw-bold text-primary small d-block">{order.catatan || '-'}</span>
                {!isCustomerNoteLocked && (
                  <small
                    className="text-primary fw-semibold cursor-pointer"
                    style={{ fontSize: '0.65rem', cursor: 'pointer' }}
                    onClick={() => {
                      setCatatan(order.catatan || '');
                      setShowNoteModal(true);
                    }}
                  >
                    <i className="bi bi-pencil-square me-1"></i>Edit
                  </small>
                )}
              </div>
            </div>

            {/* Catatan Kasir (Internal) */}
            <div
              className={`d-flex justify-content-between mt-2 pt-2 border-top align-items-start ${isCashierNoteLocked ? 'opacity-75' : ''}`}
             >
              <div>
                <span className="fw-semibold text-warning-emphasis d-flex align-items-center gap-1">
                  <i className="bi bi-shield-lock-fill text-warning"></i> Catatan Kasir :
                </span>
              </div>
              <div className="text-end ps-2">
                <span className="fw-bold text-dark small d-block">{order.catatanKasir || '-'}</span>
                {!isCashierNoteLocked && (
                  <small
                    className="text-warning fw-semibold cursor-pointer"
                    style={{ fontSize: '0.65rem', cursor: 'pointer' }}
                    onClick={() => {
                      setCatatanKasir(order.catatanKasir || '');
                      setShowCashierNoteModal(true);
                    }}
                  >
                    <i className="bi bi-pencil-square me-1"></i>Edit
                  </small>
                )}
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
                <div className="fw-bold text-muted mb-1" style={{ fontSize: '0.7rem', letterSpacing: '0px' }}>LAYANAN / PRODUK</div>
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
                <div className="fw-bold text-muted" style={{ fontSize: '0.7rem', letterSpacing: '0px' }}>INVENTORY TERPAKAI</div>
                {order.status === 'Proses' && (
                  <small
                    className="text-primary"
                    style={{ fontSize: '0.7rem', cursor: 'pointer' }}
                    onClick={() => {
                      setSelectedInventory(order.inventoryUsed || displayedInventory || []);
                      setShowInventoryModal(true);
                    }}
                  >
                    <i className="bi bi-pencil-square me-1"></i>Edit
                  </small>
                )}
              </div>
              {displayedInventory && displayedInventory.length > 0 ? (
                displayedInventory.map((inv, idx) => (
                  <div key={idx} className="d-flex justify-content-between mb-1 text-muted" style={{ fontSize: '0.75rem' }}>
                    <span>{inv.nama}</span>
                    <span>{inv.quantity ?? inv.qty ?? 1}x</span>
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

        {/* FLOATING BOTTOM DRAWER / PANEL AKSI & CETAK SEPERTI DI TRANSAKSI */}
        {showFloatingDrawer ? (
          <div
            className="position-fixed bottom-0 start-50 translate-middle-x w-100 px-2 pb-0"
            style={{
              maxWidth: isCompactDrawer ? '540px' : '580px',
              zIndex: 1055,
              animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              pointerEvents: 'none',
            }}
          >
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
                      <span
                        className={`badge rounded-pill px-2 py-2 ${isStatusLunas(order.statusBayar) ? 'bg-success' : 'bg-warning text-dark'}`}
                        style={{ fontSize: '0.65rem' }}
                      >
                        {order.statusBayar}
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
                  <button
                    type="button"
                    className="btn btn-sm btn-light rounded-circle p-1 d-flex align-items-center justify-content-center text-muted border shadow-xs"
                    style={{ width: isCompactDrawer ? '28px' : '32px', height: isCompactDrawer ? '28px' : '32px' }}
                    onClick={() => setIsCompactDrawer(!isCompactDrawer)}
                    title={isCompactDrawer ? 'Perbesar tampilan drawer' : 'Perkecil tampilan drawer'}
                  >
                    <i className={`bi ${isCompactDrawer ? 'bi-arrows-angle-expand' : 'bi-arrows-angle-contract'}`} style={{ fontSize: isCompactDrawer ? '0.75rem' : '0.85rem' }}></i>
                  </button>
                  {/* Tombol Tutup / Collapse */}
                  <button
                    type="button"
                    className="btn btn-sm btn-light rounded-circle p-1 d-flex align-items-center justify-content-center text-muted border shadow-xs"
                    style={{ width: isCompactDrawer ? '28px' : '32px', height: isCompactDrawer ? '28px' : '32px' }}
                    onClick={() => setShowFloatingDrawer(false)}
                    title="Sembunyikan Drawer"
                  >
                    <i className="bi bi-x-lg" style={{ fontSize: isCompactDrawer ? '0.75rem' : '0.85rem' }}></i>
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
                        onClick={() => navigate('/pembayaran', { state: { orderData: order, isPaymentOnly: true } })}
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
                <div className="d-flex flex-column gap-2 pt-1">
                  {/* Status & Aksi Pembayaran */}
                  {!isStatusLunas(order.statusBayar) ? (
                    <div className="d-flex gap-2">
                      <button
                        type="button"
                        className="btn btn-primary rounded-pill py-2 fw-bold flex-fill shadow-sm d-flex align-items-center justify-content-center gap-1"
                        style={{ fontSize: '0.84rem' }}
                        onClick={() => navigate('/pembayaran', { state: { orderData: order, isPaymentOnly: true } })}
                      >
                        <i className="bi bi-wallet2"></i>
                        <span>Bayar</span>
                      </button>
                      {order.status !== 'Ambil' && (
                        <button
                          type="button"
                          className="btn btn-outline-success rounded-pill py-2 fw-bold px-3 d-flex align-items-center justify-content-center gap-1"
                          style={{ fontSize: '0.82rem' }}
                          onClick={toggleLunas}
                        >
                          <i className="bi bi-check-circle"></i>
                          <span>Tandai Lunas</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="d-flex align-items-center justify-content-between px-2 py-1 rounded-3 bg-success-subtle text-success border border-success-subtle">
                      <span className="fw-semibold small d-flex align-items-center gap-1" style={{ fontSize: '0.78rem' }}>
                        <i className="bi bi-check-circle-fill fs-6"></i>
                        <span>Lunas ({order.metodeBayar || 'Cash'})</span>
                      </span>
                      {order.status !== 'Ambil' && (
                        <button
                          type="button"
                          className="btn btn-sm btn-link text-danger p-0 text-decoration-none fw-semibold"
                          style={{ fontSize: '0.72rem' }}
                          onClick={toggleLunas}
                        >
                          Jadikan Belum Lunas
                        </button>
                      )}
                    </div>
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
        ) : (
          /* TOMBOL FLOATING CETAK MELAYANG DI BAWAH (DI ATAS BOTTOM NAV) */
          <div
            className="position-fixed bottom-0 start-50 translate-middle-x w-100 px-3 pb-3 text-center"
            style={{ maxWidth: '580px', zIndex: 1045, pointerEvents: 'none' }}
          >
            <button
              type="button"
              className="btn btn-primary rounded-pill shadow-lg px-4 mb-5 py-2 fw-bold d-inline-flex align-items-center gap-2 border-0"
              style={{
                backgroundColor: '#0134d4',
                pointerEvents: 'auto',
                fontSize: '0.86rem',
                boxShadow: '0 8px 24px rgba(1, 52, 212, 0.35)',
              }}
              onClick={() => setShowFloatingDrawer(true)}
            >
              <i className="bi bi-receipt fs-5"></i>
              <span>Cetak</span>
            </button>
          </div>
        )}

        {/* Modal Edit Catatan */}
        {showNoteModal && (
          <>
            <div className="modal-backdrop fade show" style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.4)' }}></div>
            <div className="modal fade show d-block" tabIndex="-1">
              <div className="modal-dialog modal-dialog-centered mx-3">
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
              <div className="modal-dialog modal-dialog-centered mx-3">
                <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '24px' }}>
                  <div className="modal-header border-0 pb-0 pt-4 px-4">
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
              <div className="modal-dialog modal-dialog-centered mx-3">
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
              className="position-fixed bottom-0 start-50 translate-middle-x w-100 px-2 pb-2"
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
