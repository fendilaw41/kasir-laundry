import { useState, useEffect } from 'react';
import { useTransaksi } from './hooks/useTransaksi';
import toast from 'react-hot-toast';
import { TOAST_MESSAGES, BUTTON_TEXT, BUTTON_TITLE } from '../constants/appConstants';
import { CustomerListSkeleton } from '../components/common/Skeleton';
import PlanGateModal from '../components/PlanGateModal';
import ProductPickerModal from '../components/ProductPickerModal';
import { createOrderFromCheckout, getOrderByIdQuery } from '../db/repositories/orders';
import { clearDraftOrder } from '../db/repositories/draftOrder';
import { playSuccessChime } from '../utils/soundHelper';

const Transaksi = () => {
  const {
    cartItems, daftarPelanggan, inventory, navigate,
    selectedPelanggan, setSelectedPelanggan,
    showModal, setShowModal,
    isAdding, setIsAdding,
    newPelanggan, setNewPelanggan,
    diskonTipe, setDiskonTipe,
    diskonNilai, setDiskonNilai,
    estimasi, setEstimasi,
    metodeBayar, setMetodeBayar,
    tipeLayanan, setTipeLayanan,
    isPriority, setIsPriority,
    selectedInventory,
    subtotal, nilaiDiskon, total,
    prepareOrderData, removeItem, updateItemQty, toggleInventory, updateInventoryQty, handleAddPelanggan,
    resetTransaksi,
    gateModal, setGateModal,
  } = useTransaksi();

  // State untuk Floating Bottom Sheet / Drawer Pembayaran (Default: Terbuka)
  const [showPaymentDrawer, setShowPaymentDrawer] = useState(true);
  const [isCompactPayment, setIsCompactPayment] = useState(true);
  const [orderDataPending, setOrderDataPending] = useState(null);
  const [isLunas, setIsLunas] = useState(true);
  const [nominalBayar, setNominalBayar] = useState('');
  const [drawerMetodeBayar, setDrawerMetodeBayar] = useState(metodeBayar || 'Cash');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State untuk Popup Modal Pilih Layanan / Produk & Search Pelanggan
  const [showProductModal, setShowProductModal] = useState(false);
  const [pelangganSearchTerm, setPelangganSearchTerm] = useState('');

  // State untuk Modal Sukses Transaksi (Animasi Angka & Suara)
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successOrder, setSuccessOrder] = useState(null);
  const [animatedAmount, setAnimatedAmount] = useState(0);

  // Sinkronkan drawerMetodeBayar dengan metodeBayar default
  useEffect(() => {
    if (metodeBayar) setDrawerMetodeBayar(metodeBayar);
  }, [metodeBayar]);

  // Buka Floating Payment Drawer
  const handleOpenPayment = async () => {
    const data = await prepareOrderData();
    if (!data) return;
    setOrderDataPending(data);
    setIsLunas(true);
    setNominalBayar('');
    setDrawerMetodeBayar(metodeBayar || 'Cash');
    setShowPaymentDrawer(true);
  };

  // Kalkulasi nominal bayar & kembalian / sisa tagihan di drawer
  const parsedNominal = nominalBayar.trim() === '' ? null : parseInt(nominalBayar, 10);
  const effectiveBayar = parsedNominal !== null ? parsedNominal : (isLunas ? total : 0);
  const kembalian = isLunas ? Math.max(0, effectiveBayar - total) : 0;
  const sisaTagihan = !isLunas ? Math.max(0, total - effectiveBayar) : 0;

  // Tombol Cepat Nominal
  const handleQuickNominal = (val) => {
    if (val === 'pas') {
      setNominalBayar(total.toString());
    } else {
      setNominalBayar(val.toString());
    }
  };

  // Proses Selesaikan Pembayaran
  const handleConfirmPayment = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      let currentOrderData = orderDataPending;
      if (!currentOrderData) {
        currentOrderData = await prepareOrderData();
        if (!currentOrderData) {
          setIsSubmitting(false);
          return;
        }
      }

      const finalBayar = parsedNominal !== null ? parsedNominal : (isLunas ? total : 0);
      const finalKembalian = isLunas ? Math.max(0, finalBayar - total) : 0;

      const newId = await createOrderFromCheckout({
        orderData: {
          ...currentOrderData,
          metodeBayar: drawerMetodeBayar,
        },
        bayarNum: finalBayar,
        kembalian: finalKembalian,
        isLunas
      });

      await clearDraftOrder();
      if (resetTransaksi) await resetTransaksi();

      // Ambil data order tersimpan untuk invoice ID
      const saved = await getOrderByIdQuery(newId);

      setShowPaymentDrawer(false);

      // Putar audio chime sukses transaksi
      playSuccessChime();

      // Set data untuk modal sukses
      setSuccessOrder({
        id: newId,
        invoiceId: saved?.invoiceId || `INV-${newId}`,
        pelangganNama: currentOrderData.pelangganNama || 'Pelanggan Umum',
        total: total,
        bayar: finalBayar,
        kembalian: finalKembalian,
        metodeBayar: drawerMetodeBayar,
        isLunas: isLunas && finalBayar >= total
      });
      setShowSuccessModal(true);
    } catch (err) {
      toast.error(err?.message || TOAST_MESSAGES.ERROR);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Animasi Counter Angka Berjalan dari 0 sampai Total saat Modal Sukses Terbuka
  useEffect(() => {
    if (!showSuccessModal || !successOrder) return;

    const target = successOrder.total || 0;
    setAnimatedAmount(0);

    const duration = 1200; // 1.2 detik pergerakan pelan dan halus
    const startTime = performance.now();

    let animationFrameId;
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Easing cubic ease-out
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentVal = Math.floor(easeOut * target);

      setAnimatedAmount(currentVal);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        setAnimatedAmount(target);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [showSuccessModal, successOrder]);

  return (
    <div className="card shadow-sm border-0" style={{ borderRadius: '20px', marginBottom: showPaymentDrawer ? (isCompactPayment ? '180px' : '380px') : '85px' }}>
      <div className="card-body p-3">

        {/* Action Tambah Layanan - Selalu Aktif */}
        {!cartItems || cartItems.length === 0 ? (
          <div
            onClick={() => setShowProductModal(true)}
            className="p-1 mb-1 rounded-3 text-center border-dashed d-flex flex-column align-items-center justify-content-center transition-all bg-white border-primary border-2 shadow-xs"
            style={{ border: '2px dashed #0134d4', cursor: 'pointer', minHeight: '100px' }}
          >
            <div className="rounded-circle mb-2 d-flex align-items-center justify-content-center bg-primary-light text-primary" style={{ width: '42px', height: '42px', backgroundColor: '#e3f2fd' }}>
              <i className="bi bi-plus-circle-fill fs-4"></i>
            </div>
            <div className="fw-bold small mb-0">New Layanan</div>
            <small className="text-muted" style={{ fontSize: '0.72rem' }}>Klik untuk memilih jenis cuci/setrika</small>
          </div>
        ) : (
          <div className="mb-3">
            <div className="d-flex justify-content-between align-items-center mb-2 px-1">
              <h6 className="fw-bold mb-0 text-muted small text-uppercase" style={{ fontSize: '0.72rem' }}>Layanan Dipilih</h6>
              <button className="btn btn-sm btn-outline-primary rounded-pill px-2 py-0 fw-bold" style={{ fontSize: '0.72rem' }} onClick={() => setShowProductModal(true)}>
                <i className="bi bi-plus-lg me-1"></i> New
              </button>
            </div>
            <div className="d-grid gap-2">
              {cartItems.map(item => (
                <div key={item.id} className="bg-white p-2 rounded-3 shadow-xs border d-flex justify-content-between align-items-center">
                  <div className="d-flex align-items-center">
                    <div>
                      <div className="fw-bold text-dark" style={{ fontSize: '0.8rem' }}>{item.name}</div>
                      <div className="d-flex align-items-center gap-1 mt-0">
                        <button className="btn btn-sm btn-light border p-0 d-flex align-items-center justify-content-center rounded-2" style={{ width: '20px', height: '20px' }} onClick={() => updateItemQty(item.id, -1)}>
                          <i className="bi bi-dash" style={{ fontSize: '0.7rem' }}></i>
                        </button>
                        <small className="fw-bold px-1" style={{ fontSize: '0.75rem' }}>{item.quantity}</small>
                        <button className="btn btn-sm btn-light border p-0 d-flex align-items-center justify-content-center rounded-2" style={{ width: '20px', height: '20px' }} onClick={() => updateItemQty(item.id, 1)}>
                          <i className="bi bi-plus" style={{ fontSize: '0.7rem' }}></i>
                        </button>
                        <small className="text-muted ms-1" style={{ fontSize: '0.72rem' }}>x Rp {item.price.toLocaleString()}</small>
                      </div>
                    </div>
                  </div>
                  <div className="text-end">
                    <div className="fw-bold text-primary mb-0" style={{ fontSize: '0.82rem' }}>Rp {(item.price * item.quantity).toLocaleString()}</div>
                    <i className="bi bi-x-circle-fill text-danger fs-6" onClick={() => removeItem(item.id)} style={{ cursor: 'pointer' }}></i>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Inventory Horizontal Scroller - Ringkas & Kecil */}
        <div className="mb-1">
          <label className="form-label small fw-bold text-muted text-uppercase mb-1 px-1" style={{ fontSize: '0.72rem' }}>Gunakan Inventori</label>
          <div className="d-flex overflow-auto pb-2 gap-2 mx-n1 px-1 inventory-scroller">
            <style>{`
              .inventory-scroller::-webkit-scrollbar { height: 4px; }
              .inventory-scroller::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 4px; }
              .inventory-scroller::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 4px; }
              .inventory-scroller::-webkit-scrollbar-thumb:hover { background: #a8a8a8; }
            `}</style>
            {inventory?.filter(inv => !(inv.status === 'pending' && inv.stok === 0)).map(inv => {
              const activeItem = selectedInventory.find(s => s.id === inv.id);
              const isActive = !!activeItem;
              const isOutOfStock = Number(inv.stok || 0) <= 0;
              return (
                <div
                  key={inv.id}
                  className={`flex-shrink-0 p-2 rounded-3 border d-flex flex-column align-items-center justify-content-center transition-all ${isActive
                    ? 'bg-outline-primary text-dark border-primary shadow-xs'
                    : isOutOfStock
                      ? 'bg-light text-muted border-dashed opacity-50'
                      : 'bg-white text-dark shadow-xs'
                    }`}
                  style={{ minWidth: '85px', height: '88px' }}
                >
                  <div
                    className="text-center w-100"
                    onClick={() => {
                      if (isOutOfStock && !isActive) {
                        toast.error(TOAST_MESSAGES.ERROR);
                        return;
                      }
                      toggleInventory(inv);
                    }}
                    style={{ cursor: isOutOfStock && !isActive ? 'not-allowed' : 'pointer' }}
                  >
                    <i className={`bi ${isActive ? 'bi-check-circle-fill text-primary' : 'bi-box-seam'} d-block mb-0 fs-5`}></i>
                    <div className="fw-bold text-truncate" style={{ fontSize: '0.7rem', maxWidth: '75px' }}>{inv.nama}</div>
                    <small className={isOutOfStock ? 'text-danger fw-bold' : 'text-muted'} style={{ fontSize: '0.62rem' }}>
                      {isOutOfStock ? 'Habis (0)' : `Stok: ${inv.stok}`}
                    </small>
                  </div>
                  {isActive && (
                    <div className="d-flex align-items-center gap-1 bg-white rounded-pill px-1 py-0 shadow-xs mt-1 w-100 justify-content-center border">
                      <button className="btn btn-sm btn-light rounded-circle p-0 d-flex align-items-center justify-content-center" style={{ width: '16px', height: '16px' }} onClick={(e) => { e.stopPropagation(); updateInventoryQty(inv.id, -1); }}>
                        <i className="bi bi-dash text-dark" style={{ fontSize: '0.65rem' }}></i>
                      </button>
                      <span className="fw-bold text-dark px-0" style={{ fontSize: '0.7rem', minWidth: '14px', textAlign: 'center' }}>{activeItem.quantity || 1}</span>
                      <button className="btn btn-sm btn-light rounded-circle p-0 d-flex align-items-center justify-content-center" style={{ width: '16px', height: '16px' }} onClick={(e) => { e.stopPropagation(); updateInventoryQty(inv.id, 1); }}>
                        <i className="bi bi-plus text-dark" style={{ fontSize: '0.65rem' }}></i>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 4 Input Berjejer Jadi 2 Baris: Delivery, Estimasi, Prioritas, Diskon (Metode Bayar dihapus) */}
        <div className="bg-light p-2 rounded-3 border mb-3">
          <div className="row g-2">
            {/* Baris 1: Delivery & Estimasi */}
            <div className="col-6">
              <label className="form-label text-muted px-1 mb-1 fw-bold" style={{ fontSize: '0.72rem' }}>Delivery</label>
              <select
                className="form-select form-select-sm border shadow-xs rounded-3 py-1"
                style={{ fontSize: '0.8rem' }}
                value={tipeLayanan}
                onChange={e => setTipeLayanan(e.target.value)}
              >
                <option value="Datang Langsung">Datang Langsung</option>
                <option value="Jemput/Antar">Antar Jemput</option>
              </select>
            </div>
            <div className="col-6">
              <label htmlFor="estimasi-input" className="form-label text-muted px-1 mb-1 fw-bold" style={{ fontSize: '0.72rem' }}>
                Estimasi (Hari)
              </label>
              <input
                id="estimasi-input"
                aria-label="Estimasi (Hari)"
                type="number"
                className="form-control form-control-sm border shadow-xs rounded-3 py-1"
                style={{ fontSize: '0.8rem' }}
                value={estimasi}
                onChange={e => setEstimasi(e.target.value)}
                onFocus={(e) => e.target.select()}
                min="0"
                required
              />
            </div>

            {/* Baris 2: Prioritas & Diskon */}
            <div className="col-6">
              <label className="form-label text-muted px-1 mb-1 fw-bold" style={{ fontSize: '0.72rem' }}>Prioritas</label>
              <select
                className="form-select form-select-sm border shadow-xs rounded-3 py-1"
                style={{ fontSize: '0.8rem' }}
                value={isPriority}
                onChange={e => setIsPriority(e.target.value)}
              >
                <option value="Tidak">Biasa</option>
                <option value="Ya">Prioritas</option>
              </select>
            </div>
            <div className="col-6">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <label className="form-label text-muted px-1 mb-0 fw-bold" style={{ fontSize: '0.72rem' }}>Diskon</label>
                <div className="d-flex bg-white shadow-xs rounded-pill p-0 border">
                  <button
                    type="button"
                    className={`btn btn-sm rounded-pill px-2 py-0 fw-bold border-0 ${diskonTipe === 'Persentase' ? 'btn-primary shadow-xs' : 'btn-light bg-transparent text-muted'}`}
                    onClick={() => setDiskonTipe('Persentase')}
                    style={{ fontSize: '0.65rem', lineHeight: '1.2' }}
                  >
                    %
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm rounded-pill px-2 py-0 fw-bold border-0 ${diskonTipe === 'Harga' ? 'btn-primary shadow-xs' : 'btn-light bg-transparent text-muted'}`}
                    onClick={() => setDiskonTipe('Harga')}
                    style={{ fontSize: '0.65rem', lineHeight: '1.2' }}
                  >
                    Rp
                  </button>
                </div>
              </div>
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-white border text-muted fw-bold px-1" style={{ fontSize: '0.75rem' }}>
                  {diskonTipe === 'Persentase' ? '%' : 'Rp'}
                </span>
                <input
                  type="number"
                  className="form-control form-control-sm border shadow-xs rounded-end-3 py-1 fw-bold"
                  style={{ fontSize: '0.8rem' }}
                  placeholder="0"
                  value={diskonNilai}
                  onChange={e => setDiskonNilai(e.target.value)}
                  onFocus={(e) => e.target.select()}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Bottom Drawer Pembayaran (Docked Bottom) */}
      {showPaymentDrawer ? (
        <div
          className="position-fixed bottom-0 start-50 translate-middle-x w-100 px-2 pb-2"
          style={{
            maxWidth: isCompactPayment ? '540px' : '580px',
            zIndex: 1055,
            animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            pointerEvents: 'none'
          }}
        >
          <div
            className="bg-white w-100 shadow-lg border"
            style={{
              borderRadius: isCompactPayment ? '20px' : '26px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: isCompactPayment ? '10px 14px 14px' : '20px 20px 24px',
              boxShadow: '0 -10px 35px rgba(0,0,0,0.2)',
              pointerEvents: 'auto',
              transition: 'all 0.22s ease-out'
            }}
          >
            {/* Grabber indicator */}
            <div
              className="mx-auto"
              style={{
                width: isCompactPayment ? '36px' : '45px',
                height: isCompactPayment ? '4px' : '5px',
                backgroundColor: '#cbd5e1',
                borderRadius: '10px',
                marginBottom: isCompactPayment ? '6px' : '12px',
                cursor: 'pointer'
              }}
              onClick={() => setIsCompactPayment(!isCompactPayment)}
              title={isCompactPayment ? 'Klik untuk perbesar' : 'Klik untuk perkecil'}
            ></div>

            {/* Header Drawer */}
            <div className={`d-flex justify-content-between align-items-center ${isCompactPayment ? 'mb-1' : 'mb-3'}`}>
              <div className="d-flex align-items-center gap-1 flex-grow-1 overflow-hidden me-2">
                <h6 className="fw-bold mb-0 text-dark flex-shrink-0" style={{ fontSize: isCompactPayment ? '0.85rem' : '1.1rem' }}>
                  Pembayaran Kasir
                </h6>
                <div
                  className="d-inline-flex align-items-center gap-1 px-2 py-0 rounded-pill bg-light border text-truncate"
                  style={{ fontSize: isCompactPayment ? '0.7rem' : '0.8rem', cursor: 'pointer', maxWidth: '170px' }}
                  onClick={() => setShowModal(true)}
                  title="Klik untuk pilih / ganti pelanggan"
                >
                  <i className="bi bi-person-fill text-primary" style={{ fontSize: '0.72rem' }}></i>
                  <span className="fw-semibold text-dark text-truncate">
                    {selectedPelanggan ? selectedPelanggan.nama : (orderDataPending?.pelangganNama || 'Pelanggan Umum')}
                  </span>
                </div>
              </div>
              <div className="d-flex align-items-center gap-1 flex-shrink-0">
                {/* Tombol Person Plus untuk Memilih Pelanggan - di samping icon pembesar paling kiri */}
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary rounded-circle p-0 d-flex align-items-center justify-content-center shadow-xs"
                  style={{ width: isCompactPayment ? '28px' : '32px', height: isCompactPayment ? '28px' : '32px' }}
                  onClick={() => setShowModal(true)}
                  title="Pilih / Tambah Pelanggan"
                >
                  <i className="bi bi-person-plus-fill" style={{ fontSize: isCompactPayment ? '0.8rem' : '0.9rem' }}></i>
                </button>
                {/* Tombol Toggle Perbesar / Perkecil */}
                <button
                  type="button"
                  className="btn btn-sm btn-light rounded-circle p-1 d-flex align-items-center justify-content-center text-muted"
                  style={{ width: isCompactPayment ? '28px' : '32px', height: isCompactPayment ? '28px' : '32px' }}
                  onClick={() => setIsCompactPayment(!isCompactPayment)}
                  title={isCompactPayment ? 'Perbesar tampilan drawer' : 'Perkecil tampilan drawer'}
                >
                  <i className={`bi ${isCompactPayment ? 'bi-arrows-angle-expand' : 'bi-arrows-angle-contract'}`} style={{ fontSize: isCompactPayment ? '0.75rem' : '0.85rem' }}></i>
                </button>
                {/* Tombol Close Drawer agar bisa menutup */}
                <button
                  type="button"
                  className="btn-close shadow-none"
                  style={{ transform: isCompactPayment ? 'scale(0.8)' : 'scale(1)' }}
                  onClick={() => !isSubmitting && setShowPaymentDrawer(false)}
                  disabled={isSubmitting}
                  title="Tutup Pembayaran"
                  aria-label="Tutup Pembayaran"
                ></button>
              </div>
            </div>

            {/* Total Tagihan Card / Bar */}
            {isCompactPayment ? (
              <div
                className="px-3 py-1 rounded-3 mb-2 d-flex justify-content-between align-items-center"
                style={{
                  background: 'linear-gradient(135deg, #0134d4 0%, #1e40af 100%)',
                  color: '#fff'
                }}
              >
                <small className="text-white-50 text-uppercase fw-bold" style={{ fontSize: '0.68rem', letterSpacing: '0px' }}>
                  Total Tagihan
                </small>
                <span className="fw-bold fs-6 mb-0">Rp {total.toLocaleString('id-ID')}</span>
              </div>
            ) : (
              <div
                className="p-3 rounded-4 mb-3 text-center"
                style={{
                  background: 'linear-gradient(135deg, #0134d4 0%, #1e40af 100%)',
                  color: '#fff'
                }}
              >
                <small className="text-white-50 text-uppercase fw-bold" style={{ fontSize: '0.75rem', letterSpacing: '0px' }}>
                  Total Tagihan
                </small>
                <h2 className="fw-bold mb-0 mt-1 text-white">Rp {total.toLocaleString('id-ID')}</h2>
              </div>
            )}

            {/* Status Pembayaran Toggle: Lunas vs Belum Lunas */}
            <div className={isCompactPayment ? 'mb-1' : 'mb-3'}>
              {!isCompactPayment && (
                <label className="form-label small fw-bold text-muted text-uppercase mb-2">Status Pembayaran</label>
              )}
              <div className={`d-flex ${isCompactPayment ? 'p-0 rounded-3' : 'p-1 rounded-4'} bg-light border`}>
                <button
                  type="button"
                  className={`btn flex-fill ${isCompactPayment ? 'rounded-2 py-1' : 'rounded-3 py-2'} fw-bold transition-all border-0 ${isLunas ? 'btn-success shadow-sm text-white' : 'btn-light text-muted bg-transparent'}`}
                  style={{ fontSize: isCompactPayment ? '0.72rem' : '0.85rem' }}
                  onClick={() => setIsLunas(true)}
                >
                  <i className="bi bi-check-circle-fill me-1"></i> Lunas
                </button>
                <button
                  type="button"
                  className={`btn flex-fill ${isCompactPayment ? 'rounded-2 py-1' : 'rounded-3 py-2'} fw-bold transition-all border-0 ${!isLunas ? 'btn-warning shadow-sm text-dark' : 'btn-light text-muted bg-transparent'}`}
                  style={{ fontSize: isCompactPayment ? '0.72rem' : '0.85rem' }}
                  onClick={() => setIsLunas(false)}
                >
                  <i className="bi bi-clock-history me-1"></i> Belum Lunas
                </button>
              </div>
            </div>

            {/* Pilihan Metode Bayar */}
            <div className={isCompactPayment ? 'mb-1' : 'mb-3'}>
              {!isCompactPayment && (
                <label className="form-label small fw-bold text-muted text-uppercase mb-2">Metode Pembayaran</label>
              )}
              <div className="row g-1">
                {[
                  { key: 'Cash', label: 'Cash', icon: 'bi-cash-stack' },
                  { key: 'QRIS', label: 'QRIS', icon: 'bi-qr-code' },
                  { key: 'Transfer', label: 'Transfer', icon: 'bi-bank' },
                  { key: 'Deposit', label: 'Deposit', icon: 'bi-wallet2' },
                ].map((item) => (
                  <div key={item.key} className={isCompactPayment ? 'col-3' : 'col-6 col-sm-3'}>
                    <button
                      type="button"
                      className={`btn w-100 ${isCompactPayment ? 'py-1 px-1 rounded-2' : 'py-2 rounded-3'} border d-flex flex-column align-items-center justify-content-center transition-all ${drawerMetodeBayar === item.key ? 'border-primary bg-primary-subtle text-primary fw-bold shadow-xs' : 'bg-white text-dark'}`}
                      onClick={() => setDrawerMetodeBayar(item.key)}
                      style={{ fontSize: isCompactPayment ? '0.68rem' : '0.8rem' }}
                    >
                      <i className={`bi ${item.icon} ${isCompactPayment ? 'fs-6' : 'fs-5 mb-1'}`}></i>
                      <span className="text-truncate">{item.label}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Input Nominal Pembayaran */}
            <div className={isCompactPayment ? 'mb-1' : 'mb-3'}>
              <div className={`d-flex justify-content-between align-items-center ${isCompactPayment ? 'mb-0' : 'mb-1'}`}>
                <label
                  htmlFor="nominal-bayar-input"
                  className={isCompactPayment ? 'small fw-bold text-muted text-uppercase mb-0' : 'form-label small fw-bold text-muted text-uppercase mb-0'}
                  style={{ fontSize: isCompactPayment ? '0.68rem' : '0.75rem' }}
                >
                  {isLunas ? 'Nominal Uang Diterima' : 'Nominal Uang Muka (DP)'}
                </label>
                {!isCompactPayment && nominalBayar && (
                  <button
                    type="button"
                    className="btn btn-link btn-sm text-decoration-none text-danger p-0"
                    onClick={() => setNominalBayar('')}
                    style={{ fontSize: '0.75rem' }}
                  >
                    Reset
                  </button>
                )}
              </div>
              <div className={`input-group ${isCompactPayment ? 'input-group-sm rounded-3' : 'input-group-lg rounded-4 shadow-sm'} overflow-hidden border`}>
                <span className="input-group-text bg-white border-0 fw-bold text-muted" style={{ fontSize: isCompactPayment ? '0.75rem' : '0.9rem' }}>Rp</span>
                <input
                  id="nominal-bayar-input"
                  type="number"
                  className="form-control border-0 ps-1 fw-bold"
                  style={{ fontSize: isCompactPayment ? '0.85rem' : '1.1rem', height: isCompactPayment ? '32px' : 'auto' }}
                  placeholder={isLunas ? `Uang Pas (Rp ${total.toLocaleString('id-ID')})` : '0 (Belum Bayar)'}
                  value={nominalBayar}
                  onChange={(e) => setNominalBayar(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  min="0"
                />
                {isCompactPayment && (
                  <div className="d-flex align-items-center gap-1 pe-1 bg-white">
                    {nominalBayar && (
                      <button
                        type="button"
                        className="btn btn-sm btn-link text-decoration-none text-danger p-0 me-0"
                        onClick={() => setNominalBayar('')}
                        style={{ fontSize: '0.68rem' }}
                        title="Reset nominal"
                      >
                        <i className="bi bi-x-circle-fill"></i>
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary fw-bold py-0 px-1 rounded-2 text-nowrap"
                      style={{ fontSize: '0.65rem', height: '24px', lineHeight: '22px' }}
                      onClick={() => handleQuickNominal('pas')}
                    >
                      Uang Pas
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary fw-bold py-0 px-1 rounded-2 text-nowrap"
                      style={{ fontSize: '0.65rem', height: '24px', lineHeight: '22px' }}
                      onClick={() => handleQuickNominal(20000)}
                    >
                      20rb
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary fw-bold py-0 px-1 rounded-2 text-nowrap"
                      style={{ fontSize: '0.65rem', height: '24px', lineHeight: '22px' }}
                      onClick={() => handleQuickNominal(50000)}
                    >
                      50rb
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary fw-bold py-0 px-1 rounded-2 text-nowrap"
                      style={{ fontSize: '0.65rem', height: '24px', lineHeight: '22px' }}
                      onClick={() => handleQuickNominal(100000)}
                    >
                      100rb
                    </button>
                  </div>
                )}
              </div>
              {!isCompactPayment && (
                <small className="text-muted d-block mt-1" style={{ fontSize: '0.75rem' }}>
                  {isLunas
                    ? 'Kosongkan jika uang pas (otomatis lunas Rp ' + total.toLocaleString('id-ID') + ')'
                    : 'Kosongkan jika belum ada pembayaran uang muka sama sekali'}
                </small>
              )}
            </div>

            {/* Tombol Cepat Nominal Khusus Tampilan Besar */}
            {!isCompactPayment && (
              <div className="d-flex flex-wrap gap-2 mb-3">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary rounded-pill px-3 py-1 fw-bold"
                  style={{ fontSize: '0.75rem' }}
                  onClick={() => handleQuickNominal('pas')}
                >
                  Uang Pas
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary rounded-pill px-3 py-1 fw-bold"
                  style={{ fontSize: '0.75rem' }}
                  onClick={() => handleQuickNominal(20000)}
                >
                  20rb
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary rounded-pill px-3 py-1 fw-bold"
                  style={{ fontSize: '0.75rem' }}
                  onClick={() => handleQuickNominal(50000)}
                >
                  50rb
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary rounded-pill px-3 py-1 fw-bold"
                  style={{ fontSize: '0.75rem' }}
                  onClick={() => handleQuickNominal(100000)}
                >
                  100rb
                </button>
                {total > 100000 && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary rounded-pill px-3 py-1 fw-bold"
                    style={{ fontSize: '0.75rem' }}
                    onClick={() => handleQuickNominal(Math.ceil(total / 50000) * 50000)}
                  >
                    {(Math.ceil(total / 50000) * 50).toLocaleString()}rb
                  </button>
                )}
              </div>
            )}

            {/* Rincian Kembalian / Sisa Tagihan */}
            {isCompactPayment ? (
              <div className="bg-light px-2 py-2 rounded-3 mb-2 border d-flex justify-content-between align-items-center">
                <span className="small text-muted" style={{ fontSize: '0.75rem' }}>
                  {isLunas ? 'Kembalian:' : 'Sisa Tagihan:'}
                </span>
                <span className={`fw-bold ${isLunas ? 'text-success' : 'text-danger'}`} style={{ fontSize: '0.85rem' }}>
                  Rp {(isLunas ? kembalian : sisaTagihan).toLocaleString('id-ID')}
                </span>
              </div>
            ) : (
              <div className="bg-light p-3 rounded-4 mb-4 border">
                <div className="d-flex justify-content-between mb-1">
                  <span className="small text-muted">Total Tagihan:</span>
                  <span className="small fw-bold">Rp {total.toLocaleString('id-ID')}</span>
                </div>
                <div className="d-flex justify-content-between mb-2">
                  <span className="small text-muted">Diterima:</span>
                  <span className="small fw-bold text-primary">Rp {effectiveBayar.toLocaleString('id-ID')}</span>
                </div>
                <div className="border-top pt-2 d-flex justify-content-between align-items-center">
                  {isLunas ? (
                    <>
                      <span className="fw-bold text-dark">Kembalian:</span>
                      <span className="fw-bold fs-5 text-success">
                        Rp {kembalian.toLocaleString('id-ID')}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="fw-bold text-dark">Sisa Tagihan:</span>
                      <span className="fw-bold fs-5 text-danger">
                        Rp {sisaTagihan.toLocaleString('id-ID')}
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Tombol Konfirmasi Selesai Pembayaran */}
            <button
              type="button"
              className={`btn btn-primary w-100 ${isCompactPayment ? 'py-2 rounded-3' : 'py-3 rounded-4 fs-5 shadow'} fw-bold`}
              style={{ fontSize: isCompactPayment ? '0.88rem' : '1.1rem' }}
              onClick={handleConfirmPayment}
              disabled={isSubmitting || !cartItems || cartItems.length === 0}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                  Memproses...
                </>
              ) : (
                <>
                  <i className="bi bi-check2-circle me-1"></i>
                  {isLunas ? 'Bayar' : (effectiveBayar > 0 ? 'Bayar DP' : 'Simpan')}
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div
          className="position-fixed bottom-0 start-50 translate-middle-x mb-5 text-center"
          style={{ zIndex: 1050, animation: 'fadeIn 0.2s ease-out' }}
        >
          <button
            type="button"
            className="btn btn-primary shadow-lg rounded-pill px-4 py-2 fw-bold d-inline-flex align-items-center gap-2 border-2 border-white"
            onClick={() => setShowPaymentDrawer(true)}
            style={{ fontSize: '0.9rem' }}
          >
            <i className="bi bi-wallet2 fs-6"></i>
            <span>Bayar</span>
          </button>
        </div>
      )}

      {/* Modal Sukses Transaksi dengan Animasi Counter dan Suara */}
      {showSuccessModal && successOrder && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(5px)',
            zIndex: 1060,
            animation: 'fadeIn 0.25s ease-out'
          }}
        >
          <div
            className="bg-white rounded-4 shadow-lg p-3 text-center w-100"
            style={{
              maxWidth: '340px',
              animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {/* Animasi Ikon Sukses - Padat & Ringkas */}
            <div
              className="rounded-circle mx-auto mb-2 d-flex align-items-center justify-content-center shadow-xs"
              style={{
                width: '48px',
                height: '48px',
                backgroundColor: '#dcfce7',
                color: '#16a34a',
                animation: 'bounceIn 0s ease-out'
              }}
            >
              <i className="bi bi-check-lg" style={{ fontSize: '1.75rem' }}></i>
            </div>

            <h5 className="fw-bold text-dark mb-0" style={{ fontSize: '1.05rem' }}>Transaksi Berhasil!</h5>
            <p className="text-muted small mb-2" style={{ fontSize: '0.72rem' }}>Pesanan telah berhasil dicatat & diproses.</p>

            {/* Animasi Angka Berjalan dari 0 ke Total */}
            <div className="bg-light p-2 rounded-3 mb-2 border">
              <small className="text-muted text-uppercase fw-bold d-block" style={{ fontSize: '0.65rem', letterSpacing: '0px' }}>
                Total Transaksi
              </small>
              <h2 className="fw-bold text-primary mb-0 mt-0" style={{ fontSize: '1.45rem' }}>
                Rp {animatedAmount.toLocaleString('id-ID')}
              </h2>
              {successOrder.isLunas ? (
                <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2 py-0 mt-1" style={{ fontSize: '0.68rem' }}>
                  <i className="bi bi-check-circle-fill me-1"></i> Lunas
                </span>
              ) : (
                <span className="badge bg-warning-subtle text-warning border border-warning-subtle rounded-pill px-2 py-0 mt-1" style={{ fontSize: '0.68rem' }}>
                  <i className="bi bi-clock-fill me-1"></i> Belum Lunas
                </span>
              )}
            </div>

            {/* Rincian Transaksi */}
            <div className="text-start bg-white p-2 rounded-3 border mb-2" style={{ fontSize: '0.75rem' }}>
              <div className="d-flex justify-content-between mb-0">
                <span className="text-muted">No. Nota:</span>
                <span className="fw-bold text-dark">{successOrder.invoiceId}</span>
              </div>
              <div className="d-flex justify-content-between mb-0">
                <span className="text-muted">Pelanggan:</span>
                <span className="fw-bold text-dark">{successOrder.pelangganNama}</span>
              </div>
              <div className="d-flex justify-content-between mb-0">
                <span className="text-muted">Metode Bayar:</span>
                <span className="fw-bold text-dark">{successOrder.metodeBayar}</span>
              </div>
              {successOrder.kembalian > 0 && (
                <div className="d-flex justify-content-between border-top pt-1 mt-1">
                  <span className="text-muted fw-bold">Kembalian:</span>
                  <span className="fw-bold text-success">Rp {successOrder.kembalian.toLocaleString('id-ID')}</span>
                </div>
              )}
            </div>

            {/* Tombol Aksi: Detail Order & Transaksi Baru */}
            <div className="d-grid gap-1">
              <button
                type="button"
                className="btn btn-outline-primary py-1 rounded-3 fw-bold"
                style={{ fontSize: '0.8rem' }}
                onClick={() => {
                  setShowSuccessModal(false);
                  navigate(`/order/${successOrder.id}`);
                }}
              >
                <i className="bi bi-receipt me-1"></i> Lihat Detail Order
              </button>
              <button
                type="button"
                className="btn btn-primary py-1 rounded-3 fw-bold shadow-xs"
                style={{ fontSize: '0.8rem' }}
                onClick={() => {
                  setShowSuccessModal(false);
                  setSuccessOrder(null);
                  setShowPaymentDrawer(true);
                }}
              >
                <i className="bi bi-plus-circle me-1"></i> Transaksi Baru
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pilih Pelanggan (Kecil, Rapi & di Atas Floating Pembayaran) */}
      {showModal && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 1070,
            animation: 'fadeIn 0.15s ease-out'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowModal(false);
              setIsAdding(false);
              setPelangganSearchTerm('');
            }
          }}
        >
          <div
            className="bg-white rounded-4 shadow-xl w-100 overflow-hidden"
            style={{
              maxWidth: '380px',
              animation: 'scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {/* Modal Header */}
            <div className="d-flex justify-content-between align-items-center px-3 py-2 border-bottom bg-light">
              <div className="d-flex align-items-center gap-2">
                <div
                  className="rounded-circle bg-primary-subtle text-primary d-flex align-items-center justify-content-center"
                  style={{ width: '30px', height: '30px' }}
                >
                  <i className={`bi ${isAdding ? 'bi-person-plus-fill' : 'bi-people-fill'}`} style={{ fontSize: '0.9rem' }}></i>
                </div>
                <h6 className="fw-bold mb-0 text-dark" style={{ fontSize: '0.9rem' }}>
                  {isAdding ? 'Tambah Pelanggan Baru' : 'Pilih Pelanggan'}
                </h6>
              </div>
              <button
                type="button"
                className="btn-close shadow-none"
                style={{ transform: 'scale(0.8)' }}
                onClick={() => {
                  setShowModal(false);
                  setIsAdding(false);
                  setPelangganSearchTerm('');
                }}
                aria-label="Tutup"
              ></button>
            </div>

            {/* Modal Body */}
            <div className="p-3">
              {isAdding ? (
                <form onSubmit={handleAddPelanggan}>
                  <div className="mb-2">
                    <label className="form-label text-muted fw-bold mb-1" style={{ fontSize: '0.72rem' }}>Nama Pelanggan</label>
                    <input
                      className="form-control form-control-sm rounded-3 border py-1"
                      style={{ fontSize: '0.82rem' }}
                      placeholder="Nama lengkap"
                      value={newPelanggan.nama}
                      onChange={e => setNewPelanggan({ ...newPelanggan, nama: e.target.value })}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="mb-2">
                    <label className="form-label text-muted fw-bold mb-1" style={{ fontSize: '0.72rem' }}>Nomor WhatsApp / HP</label>
                    <input
                      className="form-control form-control-sm rounded-3 border py-1"
                      style={{ fontSize: '0.82rem' }}
                      placeholder="Contoh: 08123456789"
                      value={newPelanggan.hp}
                      onChange={e => setNewPelanggan({ ...newPelanggan, hp: e.target.value })}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label text-muted fw-bold mb-1" style={{ fontSize: '0.72rem' }}>Alamat (Opsional)</label>
                    <textarea
                      className="form-control form-control-sm rounded-3 border"
                      style={{ fontSize: '0.82rem' }}
                      rows="2"
                      placeholder="Alamat pelanggan"
                      value={newPelanggan.alamat}
                      onChange={e => setNewPelanggan({ ...newPelanggan, alamat: e.target.value })}
                    ></textarea>
                  </div>
                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-light border flex-fill rounded-3 fw-bold py-1"
                      style={{ fontSize: '0.8rem' }}
                      onClick={() => setIsAdding(false)}
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="btn btn-sm btn-primary flex-fill rounded-3 fw-bold py-1 shadow-xs"
                      style={{ fontSize: '0.8rem' }}
                    >
                      {BUTTON_TEXT.SAVE}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="d-flex gap-2 mb-2">
                    {/* Tombol Tambah Member Baru */}
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary rounded-3 w-100 fw-bold py-1 d-flex align-items-center justify-content-center gap-1 shadow-xs"
                      style={{ fontSize: '0.78rem' }}
                      onClick={() => setIsAdding(true)}
                      title={BUTTON_TITLE.ADD}
                    >
                      <i className="bi bi-person-plus-fill"></i>
                      <span>Tambah Pelanggan Baru</span>
                    </button>
                  </div>

                  {/* Search Pelanggan */}
                  <div className="input-group input-group-sm mb-2 border rounded-3 overflow-hidden shadow-xs">
                    <span className="input-group-text bg-white border-0 text-muted ps-2">
                      <i className="bi bi-search" style={{ fontSize: '0.75rem' }}></i>
                    </span>
                    <input
                      type="text"
                      className="form-control border-0 shadow-none ps-1 py-1"
                      style={{ fontSize: '0.8rem' }}
                      placeholder="Cari nama atau no. HP..."
                      value={pelangganSearchTerm}
                      onChange={(e) => setPelangganSearchTerm(e.target.value)}
                    />
                    {pelangganSearchTerm && (
                      <button
                        type="button"
                        className="btn btn-sm btn-link text-decoration-none text-muted pe-2"
                        onClick={() => setPelangganSearchTerm('')}
                      >
                        <i className="bi bi-x-circle-fill"></i>
                      </button>
                    )}
                  </div>

                  {/* Opsi Pelanggan Umum (Default) */}
                  <div
                    className="p-2 rounded-3 border mb-2 d-flex justify-content-between align-items-center transition-all bg-light"
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      setSelectedPelanggan(null);
                      setShowModal(false);
                      setPelangganSearchTerm('');
                    }}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <div
                        className="rounded-circle bg-secondary-subtle text-secondary d-flex align-items-center justify-content-center"
                        style={{ width: '28px', height: '28px' }}
                      >
                        <i className="bi bi-person-dash" style={{ fontSize: '0.8rem' }}></i>
                      </div>
                      <div>
                        <div className="fw-bold text-dark" style={{ fontSize: '0.8rem' }}>Pelanggan Umum</div>
                        <small className="text-muted" style={{ fontSize: '0.68rem' }}>Pelanggan tanpa data kontak (Default)</small>
                      </div>
                    </div>
                    <span className="badge bg-secondary-subtle text-secondary rounded-pill px-2 py-0" style={{ fontSize: '0.65rem' }}>
                      Pilih
                    </span>
                  </div>

                  {/* Daftar Member Pelanggan */}
                  <div className="overflow-y-auto" style={{ maxHeight: '220px' }}>
                    {daftarPelanggan === undefined ? (
                      <CustomerListSkeleton count={3} />
                    ) : (daftarPelanggan || []).length === 0 ? (
                      <p className="text-center text-muted py-3 small mb-0">Belum ada data pelanggan</p>
                    ) : (
                      <div className="d-grid gap-1">
                        {(daftarPelanggan || [])
                          .filter(p => {
                            if (!pelangganSearchTerm) return true;
                            const q = pelangganSearchTerm.toLowerCase();
                            return (p.nama && p.nama.toLowerCase().includes(q)) || (p.hp && p.hp.toLowerCase().includes(q));
                          })
                          .map(p => (
                            <div
                              key={p.id}
                              className="p-2 rounded-3 border d-flex justify-content-between align-items-center transition-all bg-white"
                              style={{ cursor: 'pointer' }}
                              onClick={() => {
                                setSelectedPelanggan(p);
                                setShowModal(false);
                                setPelangganSearchTerm('');
                              }}
                            >
                              <div className="d-flex align-items-center gap-2">
                                <div
                                  className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold"
                                  style={{ width: '28px', height: '28px', fontSize: '0.72rem' }}
                                >
                                  {p.nama ? p.nama.charAt(0).toUpperCase() : 'P'}
                                </div>
                                <div>
                                  <div className="fw-bold text-dark text-truncate" style={{ fontSize: '0.8rem', maxWidth: '190px' }}>
                                    {p.nama}
                                  </div>
                                  <small className="text-muted" style={{ fontSize: '0.68rem' }}>
                                    {p.hp || '-'}
                                  </small>
                                </div>
                              </div>
                              <span className="badge bg-primary-subtle text-primary rounded-pill px-2 py-0" style={{ fontSize: '0.65rem' }}>
                                Pilih
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Plan Gate Modal untuk batas transaksi / expired */}
      <PlanGateModal
        isOpen={gateModal?.open}
        onClose={() => setGateModal({ open: false, type: 'TRANSACTION_LIMIT', data: {} })}
        type={gateModal?.type || 'TRANSACTION_LIMIT'}
        customData={gateModal?.data || {}}
      />

      {/* Modal Popup Pilih Layanan / Produk */}
      <ProductPickerModal
        isOpen={showProductModal}
        onClose={() => setShowProductModal(false)}
      />
    </div>
  );
};

export default Transaksi;
