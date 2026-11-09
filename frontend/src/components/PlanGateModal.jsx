import React from 'react';
import { useNavigate } from 'react-router-dom';
import { isSubscriptionEnabled } from '../services/subscriptionService';

/**
 * Helper untuk mengambil data user aktif dari browser storage
 */
const getActiveUser = () => {
  try {
    return JSON.parse(
      sessionStorage.getItem('user') ||
      localStorage.getItem('user') ||
      '{}'
    );
  } catch {
    return {};
  }
};

/**
 * Modal Popup Ringkas untuk Pembatasan Fitur / Kuota Paket (Plan Gate Modal)
 * Didesain kompak (max-width 360px) agar tidak sesak di layar HP,
 * ramah peran pengguna (Owner vs Kasir), dan terstandarisasi Clean Code.
 */
export default function PlanGateModal({ isOpen, onClose, type = 'TRANSACTION_LIMIT', customData = {}, user: propUser }) {
  const navigate = useNavigate();

  if (!isOpen || !isSubscriptionEnabled()) return null;

  const currentUser = propUser || getActiveUser();
  const isOwner = currentUser?.role === 'owner';

  const getModalConfig = () => {
    switch (type) {
      case 'STOCK_LOCKED':
        return {
          icon: 'bi-box-seam',
          iconColor: '#f59e0b',
          iconBg: '#fffbeb',
          title: 'Fitur Stok Terkunci',
          subtitle: 'Paket Trial (Gratis)',
          message: 'Fitur manajemen stok bahan (deterjen, gas, molto) tersedia mulai dari paket Starter (25rb/bln).',
          recommendation: 'Starter (5 item) atau Basic (20 item)',
          ctaText: isOwner ? 'Buka Halaman Plan' : 'Hubungi Owner Toko',
        };
      case 'STOCK_LIMIT':
        return {
          icon: 'bi-boxes',
          iconColor: '#ef4444',
          iconBg: '#fef2f2',
          title: 'Batas Item Stok Tercapai',
          subtitle: `Limit Paket ${customData.plan || ''}`,
          message: `Toko Anda telah mencapai batas maksimal (${customData.limit || 5} jenis item). Data lama tetap aman.`,
          recommendation: 'Upgrade ke Basic atau Pro',
          ctaText: isOwner ? 'Upgrade di Menu Plan' : 'Hubungi Owner Toko',
        };
      case 'PRODUCT_LIMIT':
        return {
          icon: 'bi-tag-fill',
          iconColor: '#059669',
          iconBg: '#ecfdf5',
          title: 'Batas Master Produk Tercapai',
          subtitle: `Limit Paket ${customData.plan || ''} (${customData.limit || 50} Produk)`,
          message: `Toko Anda telah mencapai batas kuota upload produk (${customData.limit || 50} produk). Data produk lama tetap aman dan bisa ditransaksikan.`,
          recommendation: 'Starter (150 produk) atau Basic (500 produk)',
          ctaText: isOwner ? 'Upgrade di Menu Plan' : 'Hubungi Owner Toko',
        };
      case 'TRANSACTION_LIMIT':
        return {
          icon: 'bi-receipt-cutoff',
          iconColor: '#ef4444',
          iconBg: '#fef2f2',
          title: 'Batas Transaksi Tercapai',
          subtitle: `Kuota ${customData.limit || 30} Order Habis`,
          message: 'Transaksi baru dibatasi bulan ini. Seluruh data lama dan nota tetap bisa dibuka dan dicetak.',
          recommendation: 'Top-up kuota atau upgrade paket',
          ctaText: isOwner ? 'Lihat Opsi di Halaman Plan' : 'Hubungi Owner Toko',
        };
      case 'USER_LIMIT':
        return {
          icon: 'bi-people-fill',
          iconColor: '#6366f1',
          iconBg: '#eef2ff',
          title: 'Batas Jumlah Akun/Kasir',
          subtitle: `Maksimal ${customData.limit || 1} Akun`,
          message: `Paket ${customData.plan || 'saat ini'} hanya mendukung ${customData.limit || 1} akun/kasir. Upgrade untuk menambah kasir baru.`,
          recommendation: 'Basic (3 kasir) atau Pro (5 kasir)',
          ctaText: isOwner ? 'Lihat Paket di Halaman Plan' : 'Hubungi Owner Toko',
        };
      case 'PHOTO_LIMIT':
        return {
          icon: 'bi-images',
          iconColor: '#ec4899',
          iconBg: '#fdf2f8',
          title: 'Batas Foto Chat Tercapai',
          subtitle: 'Kuota Foto Habis',
          message: 'Kirim foto chat bulan ini telah mencapai limit. Beli kuota tambahan atau upgrade paket.',
          recommendation: 'Top-up kuota foto atau upgrade',
          ctaText: isOwner ? 'Buka Halaman Plan' : 'Hubungi Owner Toko',
        };
      case 'PDF_LIMIT':
        return {
          icon: 'bi-file-earmark-pdf-fill',
          iconColor: '#dc2626',
          iconBg: '#fef2f2',
          title: 'Batas Cetak Nota PDF',
          subtitle: customData.plan === 'TRIAL' ? 'Paket Trial (Gratis)' : `Limit ${customData.limit || 20} Nota/Bulan`,
          message: customData.plan === 'TRIAL'
            ? 'Cetak dan unduh Nota PDF A4 terkunci pada paket Trial. Tersedia mulai dari paket Starter.'
            : `Kuota cetak nota PDF A4 (${customData.limit || 20} nota) bulan ini telah habis. Nota cetak thermal tetap dapat digunakan.`,
          recommendation: 'Starter (20 nota) atau Basic (100 nota)',
          ctaText: isOwner ? 'Buka Halaman Plan' : 'Hubungi Owner Toko',
        };
      default:
        return {
          icon: 'bi-gem',
          iconColor: '#2563eb',
          iconBg: '#eff6ff',
          title: 'Upgrade Paket Toko',
          subtitle: 'Fitur Terbatas',
          message: 'Tingkatkan paket toko untuk menikmati kuota lebih besar dan fitur bisnis lengkap.',
          recommendation: 'Basic 50rb/bln ⭐ (Paling Laris)',
          ctaText: isOwner ? 'Lihat Halaman Plan' : 'Hubungi Owner Toko',
        };
    }
  };

  const config = getModalConfig();

  const handleAction = () => {
    onClose();
    if (isOwner) {
      navigate('/plan');
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="modal-backdrop fade show"
        style={{
          backdropFilter: 'blur(4px)',
          backgroundColor: 'rgba(15, 23, 42, 0.45)',
          zIndex: 1080,
        }}
        onClick={onClose}
      />

      {/* Modal Dialog Kompak */}
      <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1085 }}>
        <div className="modal-dialog modal-dialog-centered mx-auto px-3" style={{ maxWidth: '360px', width: '100%' }}>
          <div
            className="modal-content border-0 shadow-lg bg-white text-center position-relative"
            style={{ borderRadius: '20px', padding: '24px 20px', overflow: 'hidden' }}
          >
            {/* Close button top right */}
            <button
              type="button"
              className="btn-close position-absolute top-0 end-0 m-3"
              style={{ fontSize: '0.75rem' }}
              onClick={onClose}
              aria-label="Close"
            />

            {/* Icon bulat ringkas */}
            <div
              className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-2 mt-1"
              style={{
                width: '54px',
                height: '54px',
                backgroundColor: config.iconBg,
                color: config.iconColor,
              }}
            >
              <i className={`bi ${config.icon}`} style={{ fontSize: '1.5rem' }}></i>
            </div>

            {/* Judul & Subtitle */}
            <h6 className="fw-bold text-dark mb-1" style={{ fontSize: '1rem', letterSpacing: '-0.2px' }}>
              {config.title}
            </h6>
            <div className="d-flex align-items-center justify-content-center gap-1.5 mb-2.5">
              <span className="badge bg-light text-secondary rounded-pill border px-2.5 py-1" style={{ fontSize: '0.68rem' }}>
                {config.subtitle}
              </span>
              {!isOwner && (
                <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill px-2.5 py-1" style={{ fontSize: '0.68rem' }}>
                  Akses Kasir
                </span>
              )}
            </div>

            {/* Pesan singkat */}
            <p className="text-muted small mb-2.5 px-1" style={{ fontSize: '0.82rem', lineHeight: '1.45' }}>
              {config.message}
            </p>

            {/* Catatan khusus jika role kasir */}
            {!isOwner && (
              <p className="text-secondary small mb-2.5 fst-italic px-1" style={{ fontSize: '0.72rem' }}>
                *Penggantian atau upgrade paket hanya dapat diproses oleh Owner toko.
              </p>
            )}

            {/* Box Rekomendasi Ringkas */}
            <div
              className="rounded-3 mb-3 text-start d-flex align-items-center gap-2"
              style={{
                backgroundColor: '#f8fafc',
                border: '1px dashed #cbd5e1',
                padding: '10px 14px',
              }}
            >
              <div style={{ fontSize: '0.75rem', lineHeight: '1.35' }}>
                <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Saran paket:</span>
                <strong className="text-dark">{config.recommendation}</strong>
              </div>
            </div>

            {/* Tombol Aksi */}
            <div className="d-flex flex-column gap-2">
              {isOwner ? (
                <button
                  type="button"
                  className="btn btn-primary rounded-pill py-2.5 px-3 fw-semibold shadow-xs d-flex align-items-center justify-content-center gap-2 w-100"
                  style={{ fontSize: '0.84rem' }}
                  onClick={handleAction}
                >
                  <span>{config.ctaText}</span>
                  <i className="bi bi-arrow-right"></i>
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary rounded-pill py-2.5 px-3 fw-semibold shadow-xs d-flex align-items-center justify-content-center gap-2 w-100"
                  style={{ fontSize: '0.84rem' }}
                  onClick={onClose}
                >
                  <i className="bi bi-check2"></i>
                  <span>Dimengerti</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

