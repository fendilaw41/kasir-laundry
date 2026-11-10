import { useState, useEffect } from 'react';
import { useTransaksi } from './hooks/useTransaksi';
import toast from 'react-hot-toast';
import { TOAST_MESSAGES, BUTTON_TEXT, BUTTON_TITLE } from '../constants/appConstants';
import { CustomerListSkeleton } from '../components/common/Skeleton';
import PlanGateModal from '../components/PlanGateModal';
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

  // State untuk Floating Bottom Sheet / Drawer Pembayaran
  const [showPaymentDrawer, setShowPaymentDrawer] = useState(false);
  const [orderDataPending, setOrderDataPending] = useState(null);
  const [isLunas, setIsLunas] = useState(true);
  const [nominalBayar, setNominalBayar] = useState('');
  const [drawerMetodeBayar, setDrawerMetodeBayar] = useState(metodeBayar || 'Cash');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    if (isSubmitting || !orderDataPending) return;
    setIsSubmitting(true);
    try {
      const finalBayar = parsedNominal !== null ? parsedNominal : (isLunas ? total : 0);
      const finalKembalian = isLunas ? Math.max(0, finalBayar - total) : 0;

      const newId = await createOrderFromCheckout({
        orderData: {
          ...orderDataPending,
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
        pelangganNama: orderDataPending.pelangganNama || 'Pelanggan Umum',
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
    <div className="card shadow-sm mb-5 border-0" style={{ borderRadius: '28px' }}>
      <div className="card-body p-4">

        {/* Info Pelanggan - Tidak Wajib, Default: Pelanggan Umum */}
        <div
          className="p-3 p-sm-4 rounded-4 mb-4 d-flex justify-content-between align-items-center border-0 shadow-sm transition-all"
          style={{
            background: selectedPelanggan
              ? 'linear-gradient(135deg, #0134d4 0%, #1e40af 100%)'
              : '#f8fafc',
            border: selectedPelanggan ? 'none' : '1px solid #e2e8f0'
          }}
        >
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <small className={`fw-bold text-uppercase ${selectedPelanggan ? 'text-white-50' : 'text-muted'}`} style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                Pelanggan
              </small>
              {!selectedPelanggan && (
                <span className="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill" style={{ fontSize: '0.65rem' }}>
                  Umum (Default)
                </span>
              )}
            </div>
            <h6 className={`${selectedPelanggan ? 'text-white' : 'text-dark'} mb-0 fw-bold fs-5`}>
              {selectedPelanggan ? selectedPelanggan.nama : 'Pelanggan Umum'}
            </h6>
            <small className={selectedPelanggan ? 'text-white-50' : 'text-muted'}>
              {selectedPelanggan?.hp && selectedPelanggan.hp !== '-'
                ? selectedPelanggan.hp
                : (selectedPelanggan ? 'Tanpa No HP' : 'Klik tombol di samping jika ingin pilih member')}
            </small>
          </div>
          <div className="d-flex align-items-center gap-2">
            {selectedPelanggan && (
              <button
                className="btn btn-sm btn-outline-light rounded-circle d-flex align-items-center justify-content-center"
                style={{ width: '36px', height: '36px' }}
                onClick={() => setSelectedPelanggan(null)}
                title="Ganti ke Pelanggan Umum"
              >
                <i className="bi bi-x-lg"></i>
              </button>
            )}
            <button
              className={`btn rounded-circle d-flex align-items-center justify-content-center shadow-sm ${selectedPelanggan ? 'btn-white text-primary' : 'btn-primary'}`}
              onClick={() => setShowModal(true)}
              style={{ width: '45px', height: '45px', backgroundColor: selectedPelanggan ? 'white' : '' }}
              title="Pilih / Tambah Pelanggan"
            >
              <i className={`bi ${selectedPelanggan ? 'bi-person-check-fill' : 'bi-person-plus-fill'} fs-4`}></i>
            </button>
          </div>
        </div>

        {/* Action Tambah Layanan - Selalu Aktif */}
        {!cartItems || cartItems.length === 0 ? (
          <div
            onClick={() => navigate('/product')}
            className="p-4 mb-4 rounded-4 text-center border-dashed d-flex flex-column align-items-center justify-content-center transition-all bg-white border-primary border-2 shadow-sm"
            style={{ border: '2px dashed #0134d4', cursor: 'pointer', minHeight: '150px' }}
          >
            <div className="rounded-circle mb-3 d-flex align-items-center justify-content-center bg-primary-light text-primary" style={{ width: '60px', height: '60px', backgroundColor: '#e3f2fd' }}>
              <i className="bi bi-plus-circle-fill fs-1"></i>
            </div>
            <h6 className="fw-bold mb-1">New Layanan</h6>
            <small className="text-muted">Klik untuk memilih jenis cuci/setrika</small>
          </div>
        ) : (
          <div className="mb-4">
            <div className="d-flex justify-content-between align-items-center mb-2 px-1">
              <h6 className="fw-bold mb-0 text-muted small text-uppercase">Layanan Dipilih</h6>
              <button className="btn btn-sm btn-outline-primary rounded-pill px-3 py-1 small fw-bold" onClick={() => navigate('/product')}>
                <i className="bi bi-plus-lg me-1"></i> New
              </button>
            </div>
            <div className="d-grid gap-2">
              {cartItems.map(item => (
                <div key={item.id} className="bg-white p-3 rounded-4 shadow-sm border d-flex justify-content-between align-items-center">
                  <div className="d-flex align-items-center">
                    <div>
                      <div className="fw-bold small">{item.name}</div>
                      <div className="d-flex align-items-center gap-2 mt-1">
                        <button className="btn btn-sm btn-light border p-0 d-flex align-items-center justify-content-center" style={{ width: '24px', height: '24px' }} onClick={() => updateItemQty(item.id, -1)}>
                          <i className="bi bi-dash"></i>
                        </button>
                        <small className="fw-bold px-1">{item.quantity}</small>
                        <button className="btn btn-sm btn-light border p-0 d-flex align-items-center justify-content-center" style={{ width: '24px', height: '24px' }} onClick={() => updateItemQty(item.id, 1)}>
                          <i className="bi bi-plus"></i>
                        </button>
                        <small className="text-muted ms-2">x Rp {item.price.toLocaleString()}</small>
                      </div>
                    </div>
                  </div>
                  <div className="text-end">
                    <div className="fw-bold text-primary mb-1">Rp {(item.price * item.quantity).toLocaleString()}</div>
                    <i className="bi bi-x-circle-fill text-danger fs-5" onClick={() => removeItem(item.id)} style={{ cursor: 'pointer' }}></i>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Inventory Horizontal Scroller */}
        <div className="mb-4">
          <label className="form-label small fw-bold text-muted text-uppercase mb-3 px-1">Gunakan Inventori</label>
          <div className="d-flex overflow-auto pb-3 gap-2 mx-n1 px-1 inventory-scroller">
            <style>{`
              .inventory-scroller::-webkit-scrollbar { height: 6px; }
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
                  className={`flex-shrink-0 p-3 rounded-4 border d-flex flex-column align-items-center justify-content-center transition-all ${isActive
                    ? 'bg-outline-primary text-dark border-primary shadow-sm'
                    : isOutOfStock
                      ? 'bg-light text-muted border-dashed opacity-50'
                      : 'bg-white text-dark shadow-xs'
                    }`}
                  style={{ minWidth: '120px', height: '140px' }}
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
                    <i className={`bi ${isActive ? 'bi-check-circle-fill text-primary' : 'bi-box-seam'} d-block mb-1 fs-4`}></i>
                    <div className="small fw-bold text-truncate" style={{ fontSize: '0.75rem' }}>{inv.nama}</div>
                    <small className={isOutOfStock ? 'text-danger fw-bold' : 'text-muted'} style={{ fontSize: '0.65rem' }}>
                      {isOutOfStock ? 'Habis (0)' : `Stok: ${inv.stok}`}
                    </small>
                  </div>
                  {isActive && (
                    <div className="d-flex align-items-center gap-2 bg-white rounded-pill p-1 shadow-sm mt-2 w-100 justify-content-center">
                      <button className="btn btn-sm btn-light rounded-circle p-0 d-flex align-items-center justify-content-center" style={{ width: '18px', height: '18px' }} onClick={(e) => { e.stopPropagation(); updateInventoryQty(inv.id, -1); }}>
                        <i className="bi bi-dash text-dark"></i>
                      </button>
                      <span className="fw-bold text-dark px-1" style={{ fontSize: '0.8rem', minWidth: '16px', textAlign: 'center' }}>{activeItem.quantity || 1}</span>
                      <button className="btn btn-sm btn-light rounded-circle p-0 d-flex align-items-center justify-content-center" style={{ width: '18px', height: '18px' }} onClick={(e) => { e.stopPropagation(); updateInventoryQty(inv.id, 1); }}>
                        <i className="bi bi-plus text-dark"></i>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Form Detail Tambahan - Grouped Card */}
        <div className="bg-light p-3 p-sm-4 rounded-4 border-0 mb-4 shadow-sm">
          <div className="row g-3">
            <div className="col-12 col-sm-6">
              <label className="form-label small fw-bold text-muted px-1">Metode Bayar</label>
              <select className="form-select border-0 shadow-sm rounded-3 py-2" value={metodeBayar} onChange={e => setMetodeBayar(e.target.value)}>
                <option value="Cash">Cash</option>
                <option value="QRIS">QRIS</option>
                <option value="Deposit">Deposit</option>
              </select>
            </div>
            <div className="col-12 col-sm-6">
              <label className="form-label small fw-bold text-muted px-1">Delivery</label>
              <select className="form-select border-0 shadow-sm rounded-3 py-2" value={tipeLayanan} onChange={e => setTipeLayanan(e.target.value)}>
                <option value="Datang Langsung">Datang Langsung</option>
                <option value="Jemput/Antar">Antar Jemput</option>
              </select>
            </div>
            <div className="col-12 col-sm-6">
              <label htmlFor="estimasi-input" className="form-label small fw-bold text-muted px-1 d-flex justify-content-between align-items-center">
                <span>Estimasi (Hari)</span>
              </label>
              <input
                id="estimasi-input"
                aria-label="Estimasi (Hari)"
                type="number"
                className="form-control border-0 shadow-sm rounded-3 py-2"
                value={estimasi}
                onChange={e => setEstimasi(e.target.value)}
                onFocus={(e) => e.target.select()}
                min="0"
                required
              />
            </div>
            <div className="col-12 col-sm-6">
              <label className="form-label small fw-bold text-muted px-1">Prioritas</label>
              <select className="form-select border-0 shadow-sm rounded-3 py-2" value={isPriority} onChange={e => setIsPriority(e.target.value)}>
                <option value="Tidak">Biasa</option>
                <option value="Ya">Prioritas</option>
              </select>
            </div>
          </div>
        </div>

        {/* Ringkasan Biaya & Diskon */}
        <div className="mb-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <label className="form-label small fw-bold text-muted text-uppercase mb-0">Diskon</label>
            <div className="d-flex bg-white shadow-sm rounded-pill p-1" style={{ border: '1px solid #eee' }}>
              <button
                type="button"
                className={`btn btn-sm rounded-pill px-3 fw-bold border-0 ${diskonTipe === 'Persentase' ? 'btn-primary shadow-sm' : 'btn-light bg-transparent text-muted'}`}
                onClick={() => setDiskonTipe('Persentase')}
                style={{ fontSize: '0.7rem' }}
              >
                %
              </button>
              <button
                type="button"
                className={`btn btn-sm rounded-pill px-3 fw-bold border-0 ${diskonTipe === 'Harga' ? 'btn-primary shadow-sm' : 'btn-light bg-transparent text-muted'}`}
                onClick={() => setDiskonTipe('Harga')}
                style={{ fontSize: '0.7rem' }}
              >
                Rp
              </button>
            </div>
          </div>
          <div className="position-relative mb-3">
            <span className="position-absolute top-50 start-0 translate-middle-y ms-3 fw-bold text-muted">
              {diskonTipe === 'Persentase' ? '%' : 'Rp'}
            </span>
            <input
              type="number"
              className="form-control form-control-lg border-1 bg-light rounded-4 shadow-sm ps-5 fw-bold"
              placeholder="0"
              value={diskonNilai}
              onChange={e => setDiskonNilai(e.target.value)}
              onFocus={(e) => e.target.select()}
            />
          </div>

          <div className="bg-outline-primary text-black p-4 rounded-4 shadow-sm">
            <div className="d-flex justify-content-between mb-1 opacity-75">
              <span className="small">Subtotal</span>
              <span className="small">Rp {subtotal.toLocaleString()}</span>
            </div>
            <div className="d-flex justify-content-between mb-2 opacity-75">
              <span className="small">Diskon</span>
              <span className="small text-warning fw-bold">- Rp {nilaiDiskon.toLocaleString()}</span>
            </div>
            <div className="d-flex justify-content-between align-items-center border-top pt-2 mt-1">
              <span className="small">TOTAL AKHIR</span>
              <span className="small fw-bold">Rp {total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Tombol Lanjutkan / Bayar yang Membuka Floating Payment Drawer */}
        <button
          className="btn btn-primary w-100 btn-lg shadow rounded-4 py-3 fw-bold mt-2"
          onClick={handleOpenPayment}
          disabled={!cartItems || cartItems.length === 0}
        >
          <i className="bi bi-wallet2 me-2"></i> BAYAR SEKARANG (Rp {total.toLocaleString()})
        </button>
      </div>

      {/* Floating Bottom Drawer Pembayaran */}
      {showPaymentDrawer && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-end justify-content-center"
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 1055,
            animation: 'fadeIn 0.2s ease-out'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmitting) setShowPaymentDrawer(false);
          }}
        >
          <div
            className="bg-white w-100 shadow-lg"
            style={{
              maxWidth: '560px',
              borderRadius: '28px 28px 0 0',
              maxHeight: '92vh',
              overflowY: 'auto',
              padding: '24px 20px 28px',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.25)',
              animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {/* Grabber indicator */}
            <div
              className="mx-auto mb-3"
              style={{
                width: '45px',
                height: '5px',
                backgroundColor: '#cbd5e1',
                borderRadius: '10px'
              }}
            ></div>

            {/* Header Drawer */}
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h5 className="fw-bold mb-0 text-dark">Pembayaran Kasir</h5>
                <small className="text-muted">
                  Pelanggan: <span className="fw-bold text-dark">{orderDataPending?.pelangganNama || 'Pelanggan Umum'}</span>
                </small>
              </div>
              <button
                type="button"
                className="btn-close shadow-none"
                onClick={() => !isSubmitting && setShowPaymentDrawer(false)}
                disabled={isSubmitting}
              ></button>
            </div>

            {/* Total Tagihan Card */}
            <div
              className="p-3 rounded-4 mb-3 text-center"
              style={{
                background: 'linear-gradient(135deg, #0134d4 0%, #1e40af 100%)',
                color: '#fff'
              }}
            >
              <small className="text-white-50 text-uppercase fw-bold" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                Total Tagihan
              </small>
              <h2 className="fw-bold mb-0 mt-1">Rp {total.toLocaleString('id-ID')}</h2>
            </div>

            {/* Status Pembayaran Toggle: Lunas vs Belum Lunas */}
            <div className="mb-3">
              <label className="form-label small fw-bold text-muted text-uppercase mb-2">Status Pembayaran</label>
              <div className="d-flex p-1 bg-light rounded-4 border">
                <button
                  type="button"
                  className={`btn flex-fill rounded-3 py-2 fw-bold transition-all border-0 ${isLunas ? 'btn-success shadow-sm text-white' : 'btn-light text-muted bg-transparent'}`}
                  onClick={() => setIsLunas(true)}
                >
                  <i className="bi bi-check-circle-fill me-1"></i> Lunas
                </button>
                <button
                  type="button"
                  className={`btn flex-fill rounded-3 py-2 fw-bold transition-all border-0 ${!isLunas ? 'btn-warning shadow-sm text-dark' : 'btn-light text-muted bg-transparent'}`}
                  onClick={() => setIsLunas(false)}
                >
                  <i className="bi bi-clock-history me-1"></i> Belum Lunas
                </button>
              </div>
            </div>

            {/* Pilihan Metode Bayar */}
            <div className="mb-3">
              <label className="form-label small fw-bold text-muted text-uppercase mb-2">Metode Pembayaran</label>
              <div className="row g-2">
                {[
                  { key: 'Cash', label: 'Cash / Tunai', icon: 'bi-cash-stack' },
                  { key: 'QRIS', label: 'QRIS', icon: 'bi-qr-code' },
                  { key: 'Transfer', label: 'Transfer', icon: 'bi-bank' },
                  { key: 'Deposit', label: 'Deposit', icon: 'bi-wallet2' },
                ].map((item) => (
                  <div key={item.key} className="col-6 col-sm-3">
                    <button
                      type="button"
                      className={`btn w-100 py-2 rounded-3 border d-flex flex-column align-items-center justify-content-center transition-all ${drawerMetodeBayar === item.key ? 'border-primary bg-primary-subtle text-primary fw-bold shadow-xs' : 'bg-white text-dark'}`}
                      onClick={() => setDrawerMetodeBayar(item.key)}
                      style={{ fontSize: '0.8rem' }}
                    >
                      <i className={`bi ${item.icon} fs-5 mb-1`}></i>
                      <span>{item.label}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Input Nominal Pembayaran */}
            <div className="mb-3">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <label htmlFor="nominal-bayar-input" className="form-label small fw-bold text-muted text-uppercase mb-0">
                  {isLunas ? 'Nominal Uang Diterima' : 'Nominal Uang Muka (DP)'}
                </label>
                {nominalBayar && (
                  <button
                    type="button"
                    className="btn btn-link btn-sm text-decoration-none text-danger p-0"
                    onClick={() => setNominalBayar('')}
                    style={{ fontSize: '0.75rem' }}
                  >
                    Reset Input
                  </button>
                )}
              </div>
              <div className="input-group input-group-lg shadow-sm rounded-4 overflow-hidden border">
                <span className="input-group-text bg-white border-0 fw-bold text-muted">Rp</span>
                <input
                  id="nominal-bayar-input"
                  type="number"
                  className="form-control border-0 ps-1 fw-bold fs-4"
                  placeholder={isLunas ? `Uang Pas (Rp ${total.toLocaleString('id-ID')})` : '0 (Belum Bayar)'}
                  value={nominalBayar}
                  onChange={(e) => setNominalBayar(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  min="0"
                />
              </div>
              <small className="text-muted d-block mt-1" style={{ fontSize: '0.75rem' }}>
                {isLunas
                  ? 'Kosongkan jika uang pas (otomatis lunas Rp ' + total.toLocaleString('id-ID') + ')'
                  : 'Kosongkan jika belum ada pembayaran uang muka sama sekali'}
              </small>
            </div>

            {/* Tombol Cepat Nominal */}
            <div className="d-flex flex-wrap gap-2 mb-3">
              <button
                type="button"
                className="btn btn-sm btn-outline-primary rounded-pill px-3 py-1 fw-bold"
                onClick={() => handleQuickNominal('pas')}
              >
                Uang Pas
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary rounded-pill px-3 py-1 fw-bold"
                onClick={() => handleQuickNominal(20000)}
              >
                20rb
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary rounded-pill px-3 py-1 fw-bold"
                onClick={() => handleQuickNominal(50000)}
              >
                50rb
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary rounded-pill px-3 py-1 fw-bold"
                onClick={() => handleQuickNominal(100000)}
              >
                100rb
              </button>
              {total > 100000 && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary rounded-pill px-3 py-1 fw-bold"
                  onClick={() => handleQuickNominal(Math.ceil(total / 50000) * 50000)}
                >
                  {(Math.ceil(total / 50000) * 50).toLocaleString()}rb
                </button>
              )}
            </div>

            {/* Rincian Kembalian / Sisa Tagihan */}
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

            {/* Tombol Konfirmasi Selesai Pembayaran */}
            <button
              type="button"
              className="btn btn-primary w-100 py-3 rounded-4 fw-bold fs-5 shadow"
              onClick={handleConfirmPayment}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                  Memproses Transaksi...
                </>
              ) : (
                <>
                  <i className="bi bi-check2-circle me-2"></i>
                  {isLunas
                    ? `Selesaikan Transaksi (Rp ${effectiveBayar.toLocaleString('id-ID')})`
                    : (effectiveBayar > 0 ? `Simpan DP (Rp ${effectiveBayar.toLocaleString('id-ID')})` : 'Simpan Belum Lunas')}
                </>
              )}
            </button>
          </div>
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
            className="bg-white rounded-5 shadow-lg p-4 p-sm-5 text-center w-100"
            style={{
              maxWidth: '460px',
              animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {/* Animasi Ikon Sukses */}
            <div
              className="rounded-circle mx-auto mb-3 d-flex align-items-center justify-content-center shadow-sm"
              style={{
                width: '80px',
                height: '80px',
                backgroundColor: '#dcfce7',
                color: '#16a34a',
                animation: 'bounceIn 0.5s ease-out'
              }}
            >
              <i className="bi bi-check-lg" style={{ fontSize: '3rem' }}></i>
            </div>

            <h4 className="fw-bold text-dark mb-1">Transaksi Berhasil!</h4>
            <p className="text-muted small mb-3">Pesanan telah berhasil dicatat dan diproses.</p>

            {/* Animasi Angka Berjalan dari 0 ke Total */}
            <div className="bg-light p-3 rounded-4 mb-4 border">
              <small className="text-muted text-uppercase fw-bold d-block mb-1" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                Total Transaksi
              </small>
              <h1 className="fw-bold text-primary mb-0" style={{ fontSize: '2.4rem' }}>
                Rp {animatedAmount.toLocaleString('id-ID')}
              </h1>
              {successOrder.isLunas ? (
                <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-3 py-1 mt-2">
                  <i className="bi bi-check-circle-fill me-1"></i> Lunas
                </span>
              ) : (
                <span className="badge bg-warning-subtle text-warning border border-warning-subtle rounded-pill px-3 py-1 mt-2">
                  <i className="bi bi-clock-fill me-1"></i> Belum Lunas
                </span>
              )}
            </div>

            {/* Rincian Transaksi */}
            <div className="text-start bg-white p-3 rounded-4 border mb-4" style={{ fontSize: '0.85rem' }}>
              <div className="d-flex justify-content-between mb-1">
                <span className="text-muted">No. Nota:</span>
                <span className="fw-bold text-dark">{successOrder.invoiceId}</span>
              </div>
              <div className="d-flex justify-content-between mb-1">
                <span className="text-muted">Pelanggan:</span>
                <span className="fw-bold text-dark">{successOrder.pelangganNama}</span>
              </div>
              <div className="d-flex justify-content-between mb-1">
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
            <div className="d-grid gap-2">
              <button
                type="button"
                className="btn btn-outline-primary py-3 rounded-4 fw-bold"
                onClick={() => {
                  setShowSuccessModal(false);
                  navigate(`/order/${successOrder.id}`);
                }}
              >
                <i className="bi bi-receipt me-2"></i> Lihat Detail Order
              </button>
              <button
                type="button"
                className="btn btn-primary py-3 rounded-4 fw-bold shadow-sm"
                onClick={() => {
                  setShowSuccessModal(false);
                  setSuccessOrder(null);
                  toast.success('Siap untuk transaksi berikutnya');
                }}
              >
                <i className="bi bi-plus-circle me-2"></i> Transaksi Baru
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pilih Pelanggan (Opsional / Manual) */}
      {showModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content border-0 shadow">
              <div className="modal-header">
                <h5 className="modal-title">{isAdding ? 'Tambah Pelanggan Baru' : 'Pilih Pelanggan'}</h5>
                <button type="button" className="btn-close" onClick={() => { setShowModal(false); setIsAdding(false); }}></button>
              </div>
              <div className="modal-body">
                {isAdding ? (
                  <form onSubmit={handleAddPelanggan}>
                    <div className="mb-2">
                      <input className="form-control" placeholder="Nama" value={newPelanggan.nama} onChange={e => setNewPelanggan({ ...newPelanggan, nama: e.target.value })} required />
                    </div>
                    <div className="mb-2">
                      <input className="form-control" placeholder="No HP" value={newPelanggan.hp} onChange={e => setNewPelanggan({ ...newPelanggan, hp: e.target.value })} required />
                    </div>
                    <div className="mb-3">
                      <textarea className="form-control" placeholder="Alamat" value={newPelanggan.alamat} onChange={e => setNewPelanggan({ ...newPelanggan, alamat: e.target.value })}></textarea>
                    </div>
                    <button type="submit" className="btn btn-outline-primary w-100">{BUTTON_TEXT.SAVE}</button>
                    <button type="button" className="btn btn-outline-primary w-100 mt-2" onClick={() => setIsAdding(false)}>Batal</button>
                  </form>
                ) : (
                  <>
                    <button className="btn btn-outline-primary w-100 mb-3" onClick={() => setIsAdding(true)} title={BUTTON_TITLE.ADD}>
                      <i className="bi bi-plus-lg me-1"></i> Tambah Pelanggan Baru
                    </button>
                    <button
                      type="button"
                      className="btn btn-light w-100 mb-3 text-start border d-flex justify-content-between align-items-center"
                      onClick={() => {
                        setSelectedPelanggan(null);
                        setShowModal(false);
                      }}
                    >
                      <div>
                        <div className="fw-bold">Pelanggan Umum</div>
                        <small className="text-muted">Pelanggan tanpa data kontak (Default)</small>
                      </div>
                      <span className="badge bg-secondary">Pilih</span>
                    </button>
                    <div className="list-group list-group-flush">
                      {daftarPelanggan === undefined ? (
                        <CustomerListSkeleton count={3} />
                      ) : daftarPelanggan.length === 0 ? (
                        <p className="text-center text-muted">Belum ada data pelanggan</p>
                      ) : (
                        daftarPelanggan?.map(p => (
                          <button key={p.id} className="list-group-item list-group-item-action text-start py-3" onClick={() => { setSelectedPelanggan(p); setShowModal(false); }}>
                            <div className="fw-bold">{p.nama}</div>
                            <small className="text-muted">{p.hp}</small>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
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
    </div>
  );
};

export default Transaksi;
