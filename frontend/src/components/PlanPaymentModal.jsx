import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import {
  getSupportedPaymentMethods,
  createPaymentOrder,
  checkPaymentStatus,
  pullSubscriptionFromBackend,
} from '../services/subscriptionService';

export default function PlanPaymentModal({ plan, storeName, onClose, onSuccess }) {
  const [methods, setMethods] = useState([]);
  const [selectedMethod, setSelectedMethod] = useState('qris');
  const [loadingMethods, setLoadingMethods] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orderData, setOrderData] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [timeLeft, setTimeLeft] = useState(3600); // 60 menit default

  const pollIntervalRef = useRef(null);

  // 1. Ambil daftar metode pembayaran yang didukung
  useEffect(() => {
    let isMounted = true;
    async function loadMethods() {
      try {
        const list = await getSupportedPaymentMethods();
        if (isMounted) {
          if (list && list.length > 0) {
            setMethods(list);
            setSelectedMethod(list[0].code);
          } else {
            // Default fallback
            setMethods([
              { code: 'qris', name: 'QRIS (Semua E-Wallet & Bank)', type: 'QRIS', serviceFee: 1000 },
              { code: 'va/bca', name: 'BCA VA', type: 'VA', serviceFee: 2000 },
              { code: 'va/mandiri', name: 'Mandiri VA', type: 'VA', serviceFee: 2000 },
              { code: 'va/bri', name: 'BRI VA', type: 'VA', serviceFee: 2000 },
              { code: 'va/bni', name: 'BNI VA', type: 'VA', serviceFee: 2000 },
              { code: 'va/permata', name: 'Permata VA', type: 'VA', serviceFee: 2000 },
            ]);
            setSelectedMethod('qris');
          }
        }
      } catch (err) {
        console.warn('Gagal memuat metode pembayaran:', err);
      } finally {
        if (isMounted) setLoadingMethods(false);
      }
    }
    loadMethods();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Countdown timer untuk masa berlaku invoice
  useEffect(() => {
    if (!orderData || isSuccess) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [orderData, isSuccess]);

  // 3. Polling otomatis status pembayaran
  useEffect(() => {
    if (!orderData || isSuccess) return;

    let pollCount = 0;
    const intervalMs = 5000; // 5 detik

    pollIntervalRef.current = setInterval(async () => {
      pollCount++;
      try {
        const result = await checkPaymentStatus(orderData.orderId);
        if (result?.status === 'PAID') {
          clearInterval(pollIntervalRef.current);
          setIsSuccess(true);
          toast.success('Pembayaran berhasil! Paket telah aktif 🎉');
          await pullSubscriptionFromBackend();
          if (onSuccess) onSuccess();
        }
      } catch (err) {
        console.warn('Polling error:', err);
      }
    }, intervalMs);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [orderData, isSuccess, onSuccess]);

  if (!plan) return null;

  const currentMethodObj = methods.find((m) => m.code === selectedMethod);
  const serviceFee = currentMethodObj?.serviceFee ?? (selectedMethod === 'qris' ? 1000 : 2000);
  const basePrice = plan.price ?? 0;
  const totalAmount = basePrice + serviceFee;

  // Format countdown string mm:ss
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Submit order ke Mayar
  const handleCreateOrder = async () => {
    setSubmitting(true);
    try {
      const data = await createPaymentOrder(plan.key, selectedMethod);
      setOrderData(data);
      if (data.expiredAt) {
        const diffSecs = Math.max(0, Math.floor((new Date(data.expiredAt).getTime() - Date.now()) / 1000));
        setTimeLeft(diffSecs || 3600);
      }
    } catch (err) {
      toast.error(err.message || 'Gagal membuat tagihan pembayaran.');
    } finally {
      setSubmitting(false);
    }
  };

  // Cek status manual
  const handleManualCheck = async () => {
    if (!orderData) return;
    setCheckingStatus(true);
    try {
      const result = await checkPaymentStatus(orderData.orderId);
      if (result?.status === 'PAID') {
        setIsSuccess(true);
        toast.success('Pembayaran berhasil! Paket telah aktif 🎉');
        await pullSubscriptionFromBackend();
        if (onSuccess) onSuccess();
      } else {
        toast('Pembayaran belum diterima. Silakan selesaikan pembayaran.', { icon: '⏳' });
      }
    } catch (err) {
      toast.error(err.message || 'Gagal memeriksa status pembayaran.');
    } finally {
      setCheckingStatus(false);
    }
  };

  const copyToClipboard = (text, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`${label} berhasil disalin ke clipboard!`);
  };

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 1060 }} onClick={onClose}></div>
      <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1065 }}>
        <div className="modal-dialog modal-dialog-centered mx-auto px-3" style={{ maxWidth: orderData ? '460px' : '480px' }}>
          <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden bg-white">

            {/* MODAL HEADER */}
            <div className="modal-header border-bottom bg-light px-4 py-3 d-flex justify-content-between align-items-center">
              <div>
                <h6 className="modal-title fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                  <i className="bi bi-shield-check text-primary"></i>
                  {isSuccess
                    ? 'Pembayaran Berhasil'
                    : orderData
                      ? 'Selesaikan Pembayaran'
                      : `Beli Paket ${plan.name}`}
                </h6>
              </div>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>

            {/* MODAL BODY */}
            <div className="modal-body p-4">
              {/* ======================================================== */}
              {/* TAMPILAN 1: SUKSES                                       */}
              {/* ======================================================== */}
              {isSuccess ? (
                <div className="text-center py-4">
                  <div
                    className="mx-auto rounded-circle d-flex align-items-center justify-content-center mb-3 shadow-sm"
                    style={{ width: '64px', height: '64px', backgroundColor: '#dcfce7', color: '#16a34a' }}
                  >
                    <i className="bi bi-check-lg" style={{ fontSize: '2rem' }}></i>
                  </div>
                  <h5 className="fw-bold text-dark mb-1">Aktivasi Paket Berhasil!</h5>
                  <p className="text-muted small mb-4">
                    Selamat, toko Anda kini aktif menggunakan paket <b>{plan.name}</b>. Semua batas kuota transaksi, foto, dan fitur telah otomatis diperbarui.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary rounded-pill px-4 py-2 fw-semibold w-100"
                    onClick={() => {
                      if (onSuccess) onSuccess();
                      onClose();
                    }}
                  >
                    Selesai & Mulai Gunakan
                  </button>
                </div>
              ) : orderData ? (
                /* ======================================================== */
                /* TAMPILAN 2: NATIVE CHECKOUT INSTRUMENT (QRIS / VA)       */
                /* ======================================================== */
                <div>
                  {/* Banner Total & Countdown */}
                  <div className="card border-0 bg-primary-subtle text-primary-emphasis rounded-3 p-3 mb-3 text-center">
                    <span className="small text-muted mb-1" style={{ fontSize: '0.75rem' }}>Total yang Harus Dibayar</span>
                    <h4 className="fw-bold mb-1" style={{ letterSpacing: '-0.5px' }}>
                      Rp {Number(orderData.totalAmount || totalAmount).toLocaleString('id-ID')}
                    </h4>
                    <div className="d-flex justify-content-center align-items-center gap-2 mt-1 small">
                      <span className="badge bg-white text-danger border border-danger-subtle rounded-pill px-2.5 py-1 fw-medium">
                        <i className="bi bi-clock me-1"></i> Sisa Waktu: {formatTime(timeLeft)}
                      </span>
                    </div>
                  </div>

                  {/* INSTRUMEN: QRIS */}
                  {orderData.qrString ? (
                    <div className="text-center my-3">
                      <div className="p-3 bg-white border rounded-4 d-inline-block shadow-xs mb-2">
                        <QRCodeSVG value={orderData.qrString} size={200} level="M" />
                      </div>
                      <div className="text-center">
                        <span className="badge bg-dark text-white rounded-pill px-3 py-1 fw-normal mb-2" style={{ fontSize: '0.72rem' }}>
                          <i className="bi bi-qr-code-scan me-1"></i> QRIS Dinamis (Otomatis)
                        </span>
                        <p className="text-muted small mb-3" style={{ fontSize: '0.78rem' }}>
                          Buka aplikasi <b>GoPay, OVO, Dana, ShopeePay, BCA Mobile</b>, atau m-Banking Anda, lalu scan QR di atas.
                        </p>
                      </div>
                    </div>
                  ) : orderData.vaNumber ? (
                    /* INSTRUMEN: VIRTUAL ACCOUNT */
                    <div className="my-3">
                      <div className="border rounded-4 p-3 bg-light-subtle mb-3">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <span className="text-muted small fw-medium" style={{ fontSize: '0.75rem' }}>Bank Tujuan</span>
                          <span className="badge bg-primary text-white rounded-pill px-2.5 py-1">
                            {orderData.vaBank || 'VIRTUAL ACCOUNT'}
                          </span>
                        </div>
                        <div className="mb-2">
                          <span className="text-muted small d-block" style={{ fontSize: '0.72rem' }}>Nomor Virtual Account:</span>
                          <div className="d-flex justify-content-between align-items-center bg-white border rounded-3 p-2 mt-1">
                            <span className="fw-bold font-monospace text-dark fs-5">{orderData.vaNumber}</span>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary rounded-pill px-2.5 py-0.5"
                              style={{ fontSize: '0.75rem' }}
                              onClick={() => copyToClipboard(orderData.vaNumber, 'Nomor VA')}
                            >
                              <i className="bi bi-copy me-1"></i>Salin
                            </button>
                          </div>
                        </div>
                        <div>
                          <span className="text-muted small d-block" style={{ fontSize: '0.72rem' }}>Nama Pemilik Rekening:</span>
                          <span className="fw-semibold text-dark small">{orderData.customerName || storeName}</span>
                        </div>
                      </div>

                      <div className="alert alert-info border-0 rounded-3 p-2.5 mb-3" style={{ fontSize: '0.75rem' }}>
                        <i className="bi bi-info-circle me-1"></i>
                        Transfer tepat sesuai nominal tagihan agar sistem dapat memverifikasi otomatis dalam beberapa detik.
                      </div>
                    </div>
                  ) : (
                    /* Fallback jika instrumen belum siap */
                    <div className="text-center py-3">
                      <p className="text-muted small mb-3">
                        Silakan selesaikan pembayaran melalui tautan resmi Mayar berikut:
                      </p>
                      {orderData.paymentUrl && (
                        <a
                          href={orderData.paymentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-primary rounded-pill px-4 py-2 fw-semibold shadow-xs"
                        >
                          Buka Halaman Pembayaran <i className="bi bi-box-arrow-up-right ms-1"></i>
                        </a>
                      )}
                    </div>
                  )}

                  {/* Status Polling Indikator & Action */}
                  <div className="d-flex flex-column gap-2 mt-4 pt-2 border-top">
                    <div className="d-flex align-items-center justify-content-center gap-2 small text-muted mb-1" style={{ fontSize: '0.74rem' }}>
                      <span className="spinner-grow spinner-grow-sm text-success" role="status"></span>
                      <span>Menunggu pembayaran Anda...</span>
                    </div>

                    <div className="d-flex gap-2">
                      <button
                        type="button"
                        className="btn btn-outline-secondary rounded-pill flex-fill py-2 fw-medium"
                        style={{ fontSize: '0.82rem' }}
                        onClick={onClose}
                      >
                        Tutup Sementara
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary rounded-pill flex-fill py-2 fw-semibold shadow-xs d-flex align-items-center justify-content-center gap-1.5"
                        style={{ fontSize: '0.82rem' }}
                        onClick={handleManualCheck}
                        disabled={checkingStatus}
                      >
                        {checkingStatus ? (
                          <>
                            <span className="spinner-border spinner-border-sm" role="status"></span>
                            <span>Mengecek...</span>
                          </>
                        ) : (
                          <>
                            <i className="bi bi-arrow-repeat"></i>
                            <span>Cek Status Pembayaran</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* ======================================================== */
                /* TAMPILAN 3: KONFIRMASI PEMBELIAN & PILIH METODE BAYAR    */
                /* ======================================================== */
                <div>
                  {/* Ringkasan Paket */}
                  <div
                    className="card border-0 rounded-4 p-3 mb-3"
                    style={{
                      background: 'linear-gradient(135deg, #f0f4ff 0%, #e6efff 100%)',
                      border: '1px solid #dbeafe',
                    }}
                  >
                    <div className="d-flex justify-content-between align-items-center mb-1.5">
                      <div className="d-flex align-items-center gap-2">
                        <div
                          className="rounded-3 bg-primary text-white d-flex align-items-center justify-content-center shadow-xs"
                          style={{ width: '28px', height: '28px' }}
                        >
                          <i className="bi bi-star-fill" style={{ fontSize: '0.75rem' }}></i>
                        </div>
                        <span className="fw-bold text-dark fs-6">{plan.name}</span>
                      </div>
                      <span className="badge bg-primary text-white rounded-pill px-2.5 py-1 fw-semibold" style={{ fontSize: '0.72rem' }}>
                        1 Bulan
                      </span>
                    </div>
                    <div className="text-secondary small" style={{ fontSize: '0.78rem' }}>
                      Termasuk kuota transaksi, foto chat AI, produk tak terbatas, dan dukungan pelanggan.
                    </div>
                  </div>

                  {/* Pilihan Metode Bayar */}
                  <label className="form-label fw-bold text-dark small mb-2">Pilih Metode Pembayaran:</label>
                  {loadingMethods ? (
                    <div className="text-center py-3 text-muted small">
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Memuat metode pembayaran...
                    </div>
                  ) : (
                    <div
                      className="d-flex flex-column gap-2 mb-3 pe-1"
                      style={{
                        maxHeight: '260px',
                        overflowY: 'auto',
                        scrollbarWidth: 'thin',
                      }}
                    >
                      {methods.map((m) => {
                        const isSelected = selectedMethod === m.code;
                        const isQris = m.type === 'QRIS';
                        return (
                          <div
                            key={m.code}
                            onClick={() => setSelectedMethod(m.code)}
                            className="p-3 rounded-3 d-flex justify-content-between align-items-center cursor-pointer transition-all"
                            style={{
                              cursor: 'pointer',
                              border: isSelected ? '1.5px solid #0d6efd' : '1px solid #e2e8f0',
                              backgroundColor: isSelected ? '#f8faff' : '#ffffff',
                              boxShadow: isSelected ? '0 2px 8px rgba(13, 110, 253, 0.1)' : 'none',
                              transition: 'all 0.15s ease-in-out',
                            }}
                          >
                            <div className="d-flex align-items-center gap-2.5">
                              {/* Custom Radio Button */}
                              <div
                                className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                                style={{
                                  width: '18px',
                                  height: '18px',
                                  border: isSelected ? '5px solid #0d6efd' : '2px solid #cbd5e1',
                                  backgroundColor: '#fff',
                                  transition: 'border 0.15s ease',
                                }}
                              />

                              {/* Method Icon */}
                              <div
                                className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0 me-2"
                                style={{
                                  width: '34px',
                                  height: '34px',
                                  backgroundColor: isSelected ? '#dbeafe' : '#f1f5f9',
                                  color: isSelected ? '#0284c7' : '#64748b',
                                }}
                              >
                                <i className={`bi bi-${isQris ? 'qr-code-scan' : 'bank'}`} style={{ fontSize: isQris ? '0.95rem' : '0.9rem' }}></i>
                              </div>

                              {/* Text Info */}
                              <div className="ms-1">
                                <span className="fw-semibold d-block text-dark small" style={{ fontSize: '0.82rem', lineHeight: 1.25 }}>
                                  {m.name}
                                </span>
                                <span className="text-muted" style={{ fontSize: '0.7rem' }}>
                                  Biaya layanan: Rp {Number(m.serviceFee || 0).toLocaleString('id-ID')}
                                </span>
                              </div>
                            </div>

                            <span
                              className={`badge rounded-pill px-2 py-0.5 ${isSelected ? 'bg-primary-subtle text-primary border border-primary-subtle' : 'bg-light text-secondary border'
                                }`}
                              style={{ fontSize: '0.65rem' }}
                            >
                              {m.type}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Rincian Harga */}
                  <div className="rounded-3 p-3 mb-3 bg-light border border-light-subtle" style={{ fontSize: '0.82rem' }}>
                    <div className="d-flex justify-content-between text-muted mb-1.5">
                      <span>Harga Paket ({plan.name}):</span>
                      <span className="fw-medium text-dark">Rp {basePrice.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="d-flex justify-content-between text-muted mb-2">
                      <span>Biaya Layanan:</span>
                      <span className="fw-medium text-dark">Rp {serviceFee.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center fw-bold text-dark pt-2 border-top">
                      <span style={{ fontSize: '0.88rem' }}>Total Ditagihkan:</span>
                      <span className="text-primary fs-5" style={{ letterSpacing: '-0.3px' }}>
                        Rp {totalAmount.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>

                  {/* Tombol Aksi */}
                  <div className="d-flex gap-2.5">
                    <button
                      type="button"
                      className="btn btn-light rounded-pill flex-fill py-2.5 text-secondary fw-semibold border"
                      style={{ fontSize: '0.84rem' }}
                      onClick={onClose}
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary rounded-pill flex-fill py-2.5 fw-semibold shadow-xs d-flex align-items-center justify-content-center gap-2"
                      style={{ fontSize: '0.84rem' }}
                      onClick={handleCreateOrder}
                      disabled={submitting || loadingMethods}
                    >
                      {submitting ? (
                        <>
                          <span className="spinner-border spinner-border-sm" role="status"></span>
                          <span>Membuat Tagihan...</span>
                        </>
                      ) : (
                        <>
                          <span>Bayar Sekarang</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </>
  );
}

