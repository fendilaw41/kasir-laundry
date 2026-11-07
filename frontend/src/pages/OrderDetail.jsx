import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { getOrderByIdQuery, updateOrder } from '../db/repositories/orders';
import { getPelangganByIdQuery, updatePelanggan, addPelanggan } from '../db/repositories/pelanggan';
import { getInventoryQuery, getInventoryById, updateInventory } from '../db/repositories/inventory';
import { getSettingsQuery } from '../db/repositories/settings';
import { pullOrdersFromBackend } from '../services/syncService';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { TOAST_MESSAGES, CONFIRM_MESSAGES, BUTTON_TEXT } from '../constants/appConstants';
import { formatWhatsAppMessage } from '../utils/whatsapp';
import { getTrackingUrl } from '../utils/tracking';
import { getStatusLunasByMetode, isStatusLunas } from '../utils/paymentStatus';
import PrintLayout from '../components/PrintLayout';
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

  const allInventory = useLiveQuery(getInventoryQuery);

  // Tarik order terbaru dari server saat membuka halaman jika online
  useEffect(() => {
    if (navigator.onLine && id) {
      pullOrdersFromBackend(true).catch(err => console.warn('[OrderDetail] Auto pull error:', err));
    }
  }, [id]);

  // Sinkronkan state catatan & inventory yang dipilih setiap kali data order diperbarui
  useEffect(() => {
    if (order) {
      setCatatan(order.catatan || '');
      setCatatanKasir(order.catatanKasir || '');
      setSelectedInventory(order.inventoryUsed || []);
      setLocalInventoryUsed(order.inventoryUsed || []);
    }
  }, [order?.id, JSON.stringify(order?.inventoryUsed), order?.catatan, order?.catatanKasir]);

  const [isQueryTimeout, setIsQueryTimeout] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsQueryTimeout(true);
    }, 2500);
    return () => clearTimeout(timer);
  }, [id]);

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
      await updateOrder(order.id, { status });
      setShowConfirmModal(false);
      toast.success(TOAST_MESSAGES.SUCCESS);
    } catch (error) {
      toast.error(TOAST_MESSAGES.ERROR);
      setShowConfirmModal(false);
    }
  };

  const updateCatatan = async () => {
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

      for (const refItem of allItems) {
        const oldItem = oldInv.find(i => isSameInventory(i, refItem));
        const newItem = newInv.find(i => isSameInventory(i, refItem));

        const oldQty = oldItem ? Number(oldItem.quantity ?? oldItem.qty ?? 1) : 0;
        const newQty = newItem ? Number(newItem.quantity ?? newItem.qty ?? 1) : 0;

        const diff = newQty - oldQty;
        if (diff > 0) {
          const invId = refItem.id || refItem.uuid || refItem.nama;
          const invData = await getInventoryById(invId);
          const currentStok = invData ? Number(invData.stok || 0) : 0;
          if (currentStok < diff) {
            toast.error(TOAST_MESSAGES.ERROR);
            return;
          }
        }
      }

      for (const refItem of allItems) {
        const oldItem = oldInv.find(i => isSameInventory(i, refItem));
        const newItem = newInv.find(i => isSameInventory(i, refItem));

        const oldQty = oldItem ? Number(oldItem.quantity ?? oldItem.qty ?? 1) : 0;
        const newQty = newItem ? Number(newItem.quantity ?? newItem.qty ?? 1) : 0;

        const diff = newQty - oldQty;
        if (diff !== 0) {
          const invId = refItem.id || refItem.uuid || refItem.nama;
          const invData = await getInventoryById(invId);
          if (invData) {
            const newStok = Math.max(0, (Number(invData.stok) || 0) - diff);
            await updateInventory(invData.id, { stok: newStok });
          }
        }
      }

      setLocalInventoryUsed(newInv);
      const targetOrderId = order.id || id;
      await updateOrder(targetOrderId, { inventoryUsed: newInv });
      toast.success(TOAST_MESSAGES.SUCCESS);
      setShowInventoryModal(false);
    } catch (err) {
      toast.error(TOAST_MESSAGES.ERROR);
    }
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
      <PrintLayout order={order} pelanggan={pelanggan || { nama: order.pelangganNama, hp: order.pelangganHp }} printType={printType} />

      <div className="order-detail-wrapper pb-5">
        {order?.deletedAt && (
          <div className="alert alert-warning py-2 px-3 rounded-4 small mb-3 d-flex align-items-center gap-2 shadow-xs">
            <i className="bi bi-exclamation-triangle-fill text-warning fs-5"></i>
            <div>
              <strong>Pesanan Dibatalkan / Dihapus</strong>
              <div className="text-muted" style={{ fontSize: '0.72rem' }}>Pesanan ini telah dibatalkan dari sistem operasional.</div>
            </div>
          </div>
        )}

        <div className="card shadow-sm border-0 mb-3 overflow-hidden">
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
                  className="badge rounded-pill px-2.5 py-1 text-white shadow-sm d-inline-flex align-items-center gap-1"
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

        {/* Button Group Dropdown (Paling Bawah) */}
        <div className="row g-2 px-1">
          <div className="col-6">
            <div className="dropdown">
              <button className="btn btn-outline-primary w-100 py-3 fw-bold dropdown-toggle shadow-sm" type="button" data-bs-toggle="dropdown">
                <i className="bi bi-printer me-2"></i>Cetak
              </button>
              <ul className="dropdown-menu shadow border-0 rounded-3 py-2" style={{ minWidth: '180px' }}>
                <li><button className="dropdown-item py-2 small d-flex align-items-center" onClick={() => triggerPrint('thermal')}><i className="bi bi-file-earmark-text me-2 text-info fs-6"></i> Nota Thermal</button></li>
                <li><button className="dropdown-item py-2 small d-flex align-items-center" onClick={() => triggerPrint('a4')}><i className="bi bi-file-earmark-pdf me-2 text-danger fs-6"></i> Nota PDF (A4)</button></li>
                <li><button className="dropdown-item py-2 small d-flex align-items-center" onClick={() => triggerPrint('label')}><i className="bi bi-tag me-2 text-primary fs-6"></i> Label (Pcs)</button></li>
                <li><button className="dropdown-item py-2 small d-flex align-items-center" onClick={() => triggerPrint('barcode')}><i className="bi bi-upc-scan me-2 text-dark fs-6"></i> Label Barcode</button></li>
              </ul>
            </div>
          </div>

          <div className="col-6">
            <div className="dropdown">
              <button className="btn btn-outline-primary w-100 py-3 fw-bold dropdown-toggle shadow-sm" type="button" data-bs-toggle="dropdown">
                <i className="bi bi-gear-fill me-2"></i>Aksi
              </button>
              <ul className="dropdown-menu dropdown-menu-end shadow border-0 rounded-3 py-2" style={{ minWidth: '210px' }}>
                {!isStatusLunas(order.statusBayar) && (
                  <li><button className="dropdown-item py-2 small d-flex align-items-center" onClick={() => navigate('/pembayaran', { state: { orderData: order, isPaymentOnly: true } })}><i className="bi bi-wallet2 me-2 text-primary fs-6"></i> Bayar</button></li>
                )}
                {order.status !== 'Ambil' && (
                  <li>
                    <button className="dropdown-item py-2 small d-flex align-items-center" onClick={toggleLunas}>
                      {isStatusLunas(order.statusBayar) ? (
                        <><i className="bi bi-x-circle me-2 text-danger fs-6"></i> Jadikan Tidak Lunas</>
                      ) : (
                        <><i className="bi bi-check-circle me-2 text-success fs-6"></i> Jadikan {getStatusLunasByMetode(order.metodeBayar)}</>
                      )}
                    </button>
                  </li>
                )}
                <li>
                  <button className="dropdown-item py-2 small d-flex align-items-center" onClick={togglePriority}>
                    <i className={`bi ${order.isPriority ? 'bi-star-fill text-warning' : 'bi-star'} me-2 fs-6`}></i>
                    {order.isPriority ? 'Batal Prioritas' : 'Jadikan Prioritas'}
                  </button>
                </li>
                <li><hr className="dropdown-divider my-1" /></li>
                <li>
                  <button
                    className="dropdown-item py-2 small d-flex align-items-center"
                    onClick={() => setShowQrModal(true)}
                  >
                    <i className="bi bi-share me-2 text-success fs-6"></i>
                    <span>Bagikan</span>
                  </button>
                </li>
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
                      <i className="bi bi-whatsapp me-2"></i>{BUTTON_TEXT.SAVE}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Modal QR Code Cek Status Cucian */}
        {showQrModal && (
          <>
            <div className="modal-backdrop fade show" style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}></div>
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
      </div>
    </>
  );
};

export default OrderDetail;
