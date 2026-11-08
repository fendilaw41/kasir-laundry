import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Modal Popup Ringkas untuk Pembatasan Fitur / Kuota Paket (Plan Gate Modal)
 * Didesain kompak (max-width 360px) agar tidak sesak di layar HP,
 * memberikan info batasan dan opsi langsung menuju halaman /plan.
 */
export default function PlanGateModal({ isOpen, onClose, type = 'TRANSACTION_LIMIT', customData = {} }) {
  const navigate = useNavigate();

  if (!isOpen) return null;

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
          ctaText: 'Buka Halaman Plan',
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
          ctaText: 'Upgrade di Menu Plan',
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
          ctaText: 'Lihat Opsi di Halaman Plan',
        };
      case 'USER_LIMIT':
        return {
          icon: 'bi-people-fill',
          iconColor: '#6366f1',
          iconBg: '#eef2ff',
          title: 'Batas Jumlah Kasir',
          subtitle: `Maksimal ${customData.limit || 1} Pengguna`,
          message: `Paket ${customData.plan || 'saat ini'} hanya mendukung ${customData.limit || 1} akun kasir. Upgrade untuk menambah kasir baru.`,
          recommendation: 'Basic (3 kasir) atau Pro (5 kasir)',
          ctaText: 'Lihat Paket di Halaman Plan',
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
          ctaText: 'Buka Halaman Plan',
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
          ctaText: 'Lihat Halaman Plan',
        };
    }
  };

  const config = getModalConfig();

  const handleGoToPlan = () => {
    onClose();
    navigate('/plan');
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
        <div className="modal-dialog modal-dialog-centered mx-auto px-3" style={{ maxWidth: '350px' }}>
          <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden bg-white text-center p-3.5 position-relative">
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
              className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-2.5 mt-1"
              style={{
                width: '52px',
                height: '52px',
                backgroundColor: config.iconBg,
                color: config.iconColor,
              }}
            >
              <i className={`bi ${config.icon}`} style={{ fontSize: '1.5rem' }}></i>
            </div>

            {/* Judul & Subtitle */}
            <h6 className="fw-bold text-dark mb-0.5" style={{ fontSize: '0.98rem', letterSpacing: '-0.2px' }}>
              {config.title}
            </h6>
            <span className="badge bg-light text-secondary rounded-pill border px-2 py-0.5 mb-2" style={{ fontSize: '0.66rem' }}>
              {config.subtitle}
            </span>

            {/* Pesan singkat */}
            <p className="text-muted small mb-3 px-1" style={{ fontSize: '0.78rem', lineHeight: '1.5' }}>
              {config.message}
            </p>

            {/* Box Rekomendasi Ringkas */}
            <div
              className="p-2 rounded-3 mb-3 text-start d-flex align-items-center gap-2"
              style={{ backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1' }}
            >
              <i className="bi bi-star-fill text-warning" style={{ fontSize: '0.85rem' }}></i>
              <div style={{ fontSize: '0.72rem', lineHeight: '1.3' }}>
                <span className="text-muted d-block">Saran paket:</span>
                <strong className="text-dark">{config.recommendation}</strong>
              </div>
            </div>

            {/* Tombol Aksi */}
            <div className="d-flex flex-column gap-1.5">
              <button
                type="button"
                className="btn btn-primary rounded-pill py-2 fw-semibold shadow-xs d-flex align-items-center justify-content-center gap-1.5"
                style={{ fontSize: '0.8rem' }}
                onClick={handleGoToPlan}
              >
                <span>{config.ctaText}</span>
                <i className="bi bi-arrow-right"></i>
              </button>

              <button
                type="button"
                className="btn btn-light rounded-pill py-1.5 text-muted fw-medium border-0"
                style={{ fontSize: '0.75rem' }}
                onClick={onClose}
              >
                Nanti Saja
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

