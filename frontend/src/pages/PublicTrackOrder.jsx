import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { fetchPublicOrder } from '../utils/tracking';
import { isStatusLunas } from '../utils/paymentStatus';

const TRACKING_STEPS = [
  { key: 'Baru', label: 'Diterima', icon: 'bi-inbox-fill', desc: 'Pesanan masuk antrean kasir' },
  { key: 'Proses', label: 'Diproses', icon: 'bi-arrow-repeat', desc: 'Sedang dicuci & disetrika' },
  { key: 'Selesai', label: 'Siap Diambil', icon: 'bi-check2-circle', desc: 'Sudah bersih, wangi & rapi' },
  { key: 'Diambil', label: 'Sudah Diambil', icon: 'bi-bag-check-fill', desc: 'Pesanan telah diserahkan' },
];

export default function PublicTrackOrder() {
  const { code: rawParamCode } = useParams();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isOfflineData, setIsOfflineData] = useState(false);

  // Ambil data pesanan
  const loadOrder = useCallback(async (codeToLoad) => {
    if (!codeToLoad || !codeToLoad.trim()) {
      setLoading(false);
      return;
    }

    try {
      setErrorMsg('');
      const result = await fetchPublicOrder(codeToLoad);
      setOrder(result.order);
      setIsOfflineData(result.isOffline);
    } catch (err) {
      console.warn('[PublicTrackOrder] Gagal memuat:', err);
      setErrorMsg(err.message || 'Pesanan tidak ditemukan');
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (rawParamCode) {
      setLoading(true);
      loadOrder(rawParamCode);
    } else {
      setLoading(false);
    }
  }, [rawParamCode, loadOrder]);

  // Listener saat koneksi internet kembali online: otomatis sync dari server
  useEffect(() => {
    const handleOnline = () => {
      if (rawParamCode) {
        toast.success('Kembali online! Menyinkronkan status pesanan...');
        loadOrder(rawParamCode);
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [rawParamCode, loadOrder]);

  // Hitung index step aktif saat ini
  const getStepIndex = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'baru' || s === 'antri') return 0;
    if (s === 'proses') return 1;
    if (s === 'selesai') return 2;
    if (s === 'diambil' || s === 'ambil') return 3;
    if (s === 'dibatalkan') return -1;
    return 1;
  };

  const currentStepIndex = order ? getStepIndex(order.status) : 0;
  const isCanceled = (order?.status || '').toLowerCase() === 'dibatalkan';
  // Halaman publik khusus menampilkan 'Lunas' tanpa detail metode bayar (misal: Lunas QRIS -> Lunas)
  const publicStatusBayar = isStatusLunas(order?.statusBayar) ? 'Lunas' : (order?.statusBayar || 'Belum Lunas');

  // Format tanggal & estimasi
  const formatTanggal = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).replace(/\./g, ':');
  };

  const getEstimatedDate = (createdStr, estimasiHari) => {
    if (!createdStr) return '-';
    const days = parseInt(estimasiHari, 10) || 2;
    const estTime = new Date(createdStr).getTime() + days * 86400000;
    return new Date(estTime).toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div style={{ backgroundColor: '#f3f6fc', minHeight: '100vh', paddingBottom: '70px' }}>
      <div className="container px-3 pt-3" style={{ maxWidth: '640px' }}>
        {/* 1. OFFLINE STATUS BANNER */}
        {isOfflineData && (
          <div
            className="alert alert-warning border-0 shadow-sm rounded-4 mb-3 py-2 px-3 d-flex align-items-center gap-2"
            style={{ fontSize: '0.8rem', backgroundColor: '#fff9e6', color: '#8a6200' }}
          >
            <i className="bi bi-cloud-slash-fill fs-5 flex-shrink-0 text-warning"></i>
            <div>
              <strong>Mode Offline:</strong> Menampilkan data terakhir yang tersimpan di perangkat. Terhubung otomatis saat online.
            </div>
          </div>
        )}

        {/* 2. LOADING STATE */}
        {loading && (
          <div className="card border-0 shadow-sm rounded-4 p-5 text-center bg-white my-3">
            <div className="spinner-border text-primary mx-auto mb-3" role="status"></div>
            <h6 className="fw-bold mb-1 text-dark">Memuat Data Pesanan...</h6>
            <p className="text-muted small mb-0">Mengambil status terbaru cucian Anda</p>
          </div>
        )}

        {/* 3. ERROR STATE */}
        {!loading && errorMsg && (
          <div className="card border-0 shadow-sm rounded-4 p-5 text-center bg-white my-3">
            <div
              className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3 text-danger"
              style={{ width: '64px', height: '64px', backgroundColor: '#ffebe6' }}
            >
              <i className="bi bi-exclamation-triangle-fill fs-2"></i>
            </div>
            <h6 className="fw-bold text-dark mb-1">Pesanan Tidak Ditemukan</h6>
            <p className="text-muted small mb-4 px-2">{errorMsg}</p>
            <div className="d-flex justify-content-center gap-2">
              <button
                type="button"
                className="btn btn-outline-primary rounded-pill px-4 btn-sm"
                onClick={() => rawParamCode && loadOrder(rawParamCode)}
              >
                Coba Muat Ulang
              </button>
            </div>
          </div>
        )}

        {/* 4. ORDER DETAIL CONTENT */}
        {!loading && !errorMsg && order && (
          <>
            {/* HERO ORDER CARD */}
            <div
              className="card border-0 shadow-sm rounded-4 mb-3 overflow-hidden text-white position-relative"
              style={{
                background: isCanceled
                  ? 'linear-gradient(135deg, #4b5563 0%, #1f2937 100%)'
                  : currentStepIndex === 2
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : currentStepIndex === 3
                      ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
                      : 'linear-gradient(135deg, #0d5afd 0%, #1e40af 100%)',
              }}
            >
              <div className="card-body p-4 position-relative">
                <div className="d-flex justify-content-between align-items-start mb-3">
                  <div>
                    <div className="d-flex align-items-center gap-1 mb-2">
                      <span
                        className="badge rounded-pill px-3 py-1 text-uppercase fw-semibold"
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.25)',
                          backdropFilter: 'blur(4px)',
                          fontSize: '0.72rem',
                          letterSpacing: '0.5px',
                        }}
                      >
                        {order.tipeLayanan || 'Kiloan'} {order.isPriority ? '⚡ Prioritas' : ''}
                      </span>
                    </div>
                    <h4 className="fw-bold mb-0 text-white">#{order.invoiceId}</h4>
                    <small className="opacity-75" style={{ fontSize: '0.8rem' }}>
                      Atas Nama: <span className="fw-semibold">{order.pelanggan?.nama || 'Pelanggan Umum'}</span>
                    </small>
                  </div>

                  {/* STATUS BAYAR BADGE */}
                  <div className="text-end">
                    <span
                      className="badge rounded-pill px-3 py-2 fw-bold text-white shadow-sm"
                      style={{
                        backgroundColor: isCanceled
                          ? '#ef4444'
                          : isStatusLunas(order.statusBayar)
                            ? '#10b981'
                            : '#f59e0b',
                        fontSize: '0.8rem',
                      }}
                    >
                      <i className={`bi ${isStatusLunas(order.statusBayar) ? 'bi-check-circle-fill' : 'bi-clock-fill'} me-1`}></i>
                      {publicStatusBayar}
                    </span>
                  </div>
                </div>

                {/* ESTIMASI */}
                <div
                  className="rounded-3 p-2 px-3 d-flex align-items-center justify-content-between"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(4px)' }}
                >
                  <div className="d-flex align-items-center gap-2">
                    <i className="bi bi-calendar2-check fs-5"></i>
                    <div>
                      <small className="d-block opacity-75" style={{ fontSize: '0.68rem', lineHeight: '1.2' }}>
                        Estimasi Selesai
                      </small>
                      <span className="fw-bold" style={{ fontSize: '0.85rem' }}>
                        {getEstimatedDate(order.createdAt, order.estimasi)}
                      </span>
                    </div>
                  </div>
                  <div className="text-end">
                    <small className="d-block opacity-75" style={{ fontSize: '0.68rem', lineHeight: '1.2' }}>
                      Tanggal Masuk
                    </small>
                    <span className="fw-semibold" style={{ fontSize: '0.78rem' }}>
                      {formatTanggal(order.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* TRACKING STEPPER CARD */}
            <div className="card border-0 shadow-sm rounded-4 mb-3 bg-white">
              <div className="card-body p-4">
                <div className="d-flex align-items-center justify-content-between mb-4">
                  <h6 className="fw-bold mb-0 text-dark">
                    <i className="bi bi-geo-alt-fill text-primary me-2"></i>
                    Status Pengerjaan
                  </h6>
                  <span
                    className="badge rounded-pill px-3 py-1"
                    style={{
                      backgroundColor: isCanceled ? '#fee2e2' : '#e0ebff',
                      color: isCanceled ? '#dc2626' : '#0d5afd',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}
                  >
                    {order.status || 'Baru'}
                  </span>
                </div>

                {/* WORKFLOW TIMELINE */}
                {isCanceled ? (
                  <div className="alert alert-danger border-0 rounded-4 py-3 text-center mb-0">
                    <i className="bi bi-x-circle-fill fs-1 text-danger d-block mb-2"></i>
                    <h6 className="fw-bold text-danger mb-1">Pesanan Dibatalkan</h6>
                    <small className="text-muted">
                      Transaksi ini telah dibatalkan oleh kasir atau sistem.
                    </small>
                  </div>
                ) : (
                  <div className="position-relative px-2">
                    {/* Stepper Vertical */}
                    {TRACKING_STEPS.map((step, idx) => {
                      const isPassed = currentStepIndex > idx;
                      const isCurrent = currentStepIndex === idx;
                      const isLast = idx === TRACKING_STEPS.length - 1;

                      return (
                        <div key={step.key} className="d-flex gap-3 position-relative pb-4" style={{ minHeight: '58px' }}>
                          {/* Garis Penghubung */}
                          {!isLast && (
                            <div
                              className="position-absolute"
                              style={{
                                top: '34px',
                                left: '17px',
                                width: '2px',
                                bottom: 0,
                                backgroundColor: isPassed ? '#10b981' : '#e2e8f0',
                                zIndex: 1,
                              }}
                            />
                          )}

                          {/* Node Icon Circle */}
                          <div
                            className="rounded-circle d-flex align-items-center justify-content-center shadow-sm flex-shrink-0 position-relative"
                            style={{
                              width: '36px',
                              height: '36px',
                              backgroundColor: (isCurrent && isLast) || isPassed ? '#10b981' : isCurrent ? '#0d5afd' : '#f1f5f9',
                              color: isCurrent || isPassed ? '#ffffff' : '#94a3b8',
                              zIndex: 2,
                              transition: 'all 0.3s ease',
                              border: isCurrent && !isLast ? '3px solid #dbeafe' : isCurrent && isLast ? '3px solid #d1fae5' : 'none',
                            }}
                          >
                            <i className={`bi ${step.icon} fs-6`}></i>
                          </div>

                          {/* Info Text */}
                          <div className="flex-grow-1 overflow-hidden pt-1">
                            <div className="d-flex align-items-center justify-content-between">
                              <h6
                                className={`mb-0 ${isCurrent && isLast
                                  ? 'fw-bold text-success'
                                  : isCurrent
                                    ? 'fw-bold text-primary'
                                    : isPassed
                                      ? 'fw-bold text-dark'
                                      : 'text-muted'
                                  }`}
                                style={{ fontSize: '0.9rem' }}
                              >
                                {step.label}
                              </h6>
                              {isCurrent && !isLast && (
                                <span
                                  className="spinner-grow spinner-grow-sm text-primary"
                                  style={{ width: '9px', height: '9px' }}
                                  role="status"
                                  title="Sedang Dikerjakan"
                                />
                              )}
                              {(isPassed || (isCurrent && isLast)) && (
                                <i className="bi bi-check-lg text-success fw-bold"></i>
                              )}
                            </div>
                            <small className="text-muted d-block mt-1" style={{ fontSize: '0.74rem' }}>
                              {step.desc}
                            </small>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* RINCIAN LAYANAN & ITEM CUCIAN */}
            <div className="card border-0 shadow-sm rounded-4 mb-3 bg-white">
              <div className="card-body p-4">
                <h6 className="fw-bold mb-3 text-dark">
                  <i className="bi bi-receipt text-primary me-2"></i>
                  Rincian Cucian
                </h6>

                <div className="table-responsive">
                  <table className="table table-borderless align-middle mb-0" style={{ fontSize: '0.85rem' }}>
                    <thead className="border-bottom bg-light">
                      <tr className="text-muted" style={{ fontSize: '0.75rem' }}>
                        <th className="py-2">Layanan</th>
                        <th className="text-center py-2">Qty</th>
                        <th className="text-end py-2">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.items && order.items.length > 0 ? (
                        order.items.map((item, idx) => (
                          <tr key={item.id || idx} className="border-bottom">
                            <td className="py-3">
                              <span className="fw-semibold text-dark d-block">{item.name}</span>
                              <small className="text-muted">@Rp {(item.price || 0).toLocaleString('id-ID')}</small>
                            </td>
                            <td className="text-center py-3 fw-medium">
                              {item.quantity}
                            </td>
                            <td className="text-end py-3 fw-bold text-dark">
                              Rp {(item.subtotal || item.price * item.quantity || 0).toLocaleString('id-ID')}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="3" className="text-center text-muted py-3">
                            Rincian cucian tidak tersedia
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* TOTAL SUMMARY */}
                <div className="pt-3 border-top mt-2">
                  <div className="d-flex justify-content-between mb-1 text-muted" style={{ fontSize: '0.82rem' }}>
                    <span>Subtotal</span>
                    <span>Rp {((order.total || 0) + (order.diskon || 0)).toLocaleString('id-ID')}</span>
                  </div>
                  {order.diskon > 0 && (
                    <div className="d-flex justify-content-between mb-1 text-danger" style={{ fontSize: '0.82rem' }}>
                      <span>Diskon Promo</span>
                      <span>- Rp {order.diskon.toLocaleString('id-ID')}</span>
                    </div>
                  )}
                  <div className="d-flex justify-content-between align-items-center pt-2 border-top">
                    <span className="fw-bold text-dark">Total Tagihan</span>
                    <h5 className="fw-bold text-primary mb-0">Rp {(order.total || 0).toLocaleString('id-ID')}</h5>
                  </div>
                  <div className="d-flex justify-content-between mt-2 pt-2 border-top text-muted" style={{ fontSize: '0.78rem' }}>
                    <span>Metode Bayar: <strong>{order.metodeBayar || 'Tunai'}</strong></span>
                    <span>Status: <strong className={isStatusLunas(order.statusBayar) ? 'text-success' : 'text-warning'}>{publicStatusBayar}</strong></span>
                  </div>
                </div>

                {/* CATATAN PELANGGAN */}
                {order.catatan && (
                  <div
                    className="mt-3 p-3 rounded-3"
                    style={{ backgroundColor: '#f8fafc', borderLeft: '3px solid #0d5afd' }}
                  >
                    <small className="text-muted d-block fw-semibold mb-1" style={{ fontSize: '0.72rem' }}>
                      <i className="bi bi-sticky-fill me-1 text-primary"></i> Catatan Kasir / Pakaian:
                    </small>
                    <span className="text-dark" style={{ fontSize: '0.82rem' }}>
                      {order.catatan}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* INFORMASI TOKO & KONTAK */}
            <div className="card border-0 shadow-sm rounded-4 mb-3 bg-white">
              <div className="card-body p-4">
                <div className="d-flex align-items-start gap-3">
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center text-primary flex-shrink-0"
                    style={{ width: '48px', height: '48px', backgroundColor: '#eaf1ff' }}
                  >
                    <i className="bi bi-shop fs-4"></i>
                  </div>
                  <div className="flex-grow-1 overflow-hidden">
                    <h6 className="fw-bold text-dark mb-1">{order.store?.name || 'Kasir Laundry'}</h6>
                    {order.store?.motto && (
                      <p className="text-muted small mb-1">{order.store.motto}</p>
                    )}
                    {order.store?.address && (
                      <small className="text-muted d-block mb-1">
                        <i className="bi bi-geo-alt me-1"></i>
                        {order.store.address}{order.store.city ? `, ${order.store.city}` : ''}
                      </small>
                    )}
                    {order.store?.jamBuka && (
                      <small className="text-muted d-block">
                        <i className="bi bi-clock me-1"></i> Jam Buka: {order.store.jamBuka}
                      </small>
                    )}
                  </div>
                </div>

                {/* TOMBOL HUBUNGI VIA WA */}
                {order.store?.phone && (
                  <div className="mt-4 pt-2">
                    <a
                      href={`https://wa.me/${order.store.phone.replace(/\D/g, '').replace(/^0/, '62')}?text=${encodeURIComponent(
                        `Halo kak, mau tanya tentang cucian saya di ${order.store.name} dengan Nota #${order.invoiceId}`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-success w-100 rounded-pill py-2 fw-semibold d-flex align-items-center justify-content-center gap-2 shadow-sm"
                      style={{ fontSize: '0.88rem' }}
                    >
                      <i className="bi bi-whatsapp fs-5"></i>
                      <span>Tanya Kasir via WhatsApp</span>
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* WATERMARK BUKTI ORDER RESMI */}
            <div className="text-center text-muted small py-2">
              <div className="d-flex align-items-center justify-content-center gap-1">
                <i className="bi bi-shield-check text-success"></i>
                <span>Tautan Resmi Pelacakan Cucian Online</span>
              </div>
            </div>
          </>
        )}

        {/* 5. INITIAL EMPTY STATE TANPA PARAMETER */}
        {!loading && !errorMsg && !order && !rawParamCode && (
          <div className="card border-0 shadow-sm rounded-4 p-5 text-center bg-white my-3">
            <div
              className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3 text-primary"
              style={{ width: '64px', height: '64px', backgroundColor: '#eaf1ff' }}
            >
              <i className="bi bi-receipt fs-2"></i>
            </div>
            <h6 className="fw-bold text-dark mb-1">Status Cucian Anda</h6>
            <p className="text-muted small mb-0 px-3">
              Gunakan tautan yang tertera pada nota fisik atau pesan WhatsApp Anda untuk melihat status cucian secara langsung.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
