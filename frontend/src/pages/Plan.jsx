import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useLiveQuery } from 'dexie-react-hooks';
import { getSettingsQuery } from '../db/repositories/settings';
import { getPlansQuery, syncPlansFromBackend, DEFAULT_PLANS } from '../db/repositories/plans';
import {
  PLAN_CONFIGS,
  getSubscriptionReport,
  applyPlan,
  getUpgradeWhatsAppUrl,
  getTopupWhatsAppUrl,
  topupQuota,
} from '../services/subscriptionService';

export default function Plan({ user }) {
  const settings = useLiveQuery(getSettingsQuery);
  const rawPlans = useLiveQuery(getPlansQuery, [], []);
  const plans = rawPlans && rawPlans.length > 0 ? rawPlans : DEFAULT_PLANS;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [report, setReport] = useState(null);
  const [topupModalOpen, setTopupModalOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedPaymentPlan, setSelectedPaymentPlan] = useState(null);

  const isOwner = user?.role === 'owner';
  const adminWa = report?.whatsappBillingNumber || '6281234567890';
  const storeName = settings?.namaLaundry || 'Toko Saya';

  const formatWhatsAppDisplay = (rawNumber) => {
    const clean = String(rawNumber || '').replace(/\D/g, '');
    if (clean.startsWith('62') && clean.length >= 10) {
      return `+62 ${clean.slice(2, 5)}-${clean.slice(5, 9)}-${clean.slice(9)}`;
    }
    return rawNumber || '-';
  };

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const data = await getSubscriptionReport({ force: true });
      setReport(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    syncPlansFromBackend(true).catch((err) => console.warn('Sync plans failed:', err));
  }, []);

  const handleApplyPlan = async (planKey) => {
    if (!isOwner) {
      toast.error('Hanya akun Owner yang dapat mengubah paket langganan.');
      return;
    }

    setSubmitting(true);
    try {
      await applyPlan(planKey);
      const targetPlan = plans.find((p) => p.key === planKey);
      toast.success(`Paket berhasil diubah ke ${targetPlan?.name || planKey}! Fitur dan batas kuota langsung aktif.`);
      setSelectedPaymentPlan(null);
      await fetchStatus();
    } catch (err) {
      toast.error(err.message || 'Gagal mengubah paket');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInstantTopup = async (type, amount) => {
    if (!isOwner) return;
    setSubmitting(true);
    try {
      await topupQuota(type, amount);
      toast.success(`Berhasil top-up ${amount} ${type === 'TRANSACTIONS' ? 'transaksi' : 'foto'}!`);
      setTopupModalOpen(false);
      await fetchStatus();
    } catch (err) {
      toast.error(err.message || 'Gagal top-up kuota');
    } finally {
      setSubmitting(false);
    }
  };

  const currentPlanKey = report?.plan || 'TRIAL';
  const currentPlan = plans.find((p) => p.key === currentPlanKey) || DEFAULT_PLANS.find((p) => p.key === currentPlanKey) || DEFAULT_PLANS[0];
  const usage = report?.usage || {};
  const trx = usage.transactions || {};
  const photos = usage.photos || {};
  const users = usage.users || {};
  const inv = usage.inventory || {};
  const prods = usage.products || {
    used: 0,
    limit: currentPlan.maxProducts ?? 50,
    remaining: currentPlan.maxProducts === -1 ? 999999 : Math.max(0, (currentPlan.maxProducts ?? 50) - 0),
    percentage: 0,
    isExceeded: false,
  };

  const getProgressColor = (percentage, isExceeded) => {
    if (isExceeded || percentage >= 100) return '#ef4444';
    if (percentage >= 80) return '#f59e0b';
    return '#10b981';
  };

  return (
    <div className="plan-page pb-5" style={{ backgroundColor: '#f4f6fa', minHeight: '100vh' }}>
      <div className="container px-3 pt-3" style={{ maxWidth: '780px' }}>
        {loading ? (
          <div className="card border-0 shadow-sm rounded-4 p-5 text-center bg-white my-3">
            <div className="spinner-border text-primary mx-auto mb-2" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="text-muted small mb-0">Memuat status paket & penggunaan...</p>
          </div>
        ) : (
          <>
            {/* NOTIFIKASI KHUSUS JIKA LOGGED IN SEBAGAI KASIR */}
            {!isOwner && (
              <div
                className="alert border-0 rounded-4 shadow-xs py-2 px-3 mb-3 d-flex align-items-center gap-2"
                style={{ backgroundColor: '#e0f2fe', color: '#0369a1', fontSize: '0.82rem' }}
              >
                <i className="bi bi-shield-lock-fill fs-5 text-primary flex-shrink-0"></i>
                <div>
                  <strong>Mode Kasir:</strong> Hanya akun Owner yang dapat mengubah atau upgrade paket toko.
                </div>
              </div>
            )}

            {/* 1. KARTU HERO PAKET SAAT INI (WARNA SAMA DENGAN HOME) */}
            <div
              className="card border-0 shadow-sm rounded-4 mb-3 overflow-hidden text-white position-relative"
              style={{
                background: 'linear-gradient(135deg, #0134d4 0%, #2855e1 100%)',
                boxShadow: '0 8px 24px -4px rgba(1, 52, 212, 0.3)',
              }}
            >
              <div className="card-body p-3 p-sm-4 position-relative">
                <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                  <div>
                    <span
                      className="badge rounded-pill fw-semibold mb-2 d-inline-flex align-items-center gap-1"
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.22)',
                        backdropFilter: 'blur(8px)',
                        fontSize: '0.68rem',
                        padding: '4px 10px',
                        letterSpacing: '0px',
                      }}
                    >
                      <i className="bi bi-patch-check-fill text-warning"></i>
                      PAKET AKTIF SAAT INI
                    </span>
                    <h3 className="fw-bold text-white mb-0" style={{ letterSpacing: '-0.3px' }}>
                      {currentPlan.name}
                    </h3>

                  </div>

                  <div className="text-end d-flex flex-column align-items-end">
                    <span
                      className="badge rounded-pill fw-medium d-inline-flex align-items-center gap-1"
                      style={{
                        backgroundColor: report?.status === 'ACTIVE' ? '#10b981' : '#ef4444',
                        fontSize: '0.7rem',
                        padding: '4px 8px',
                      }}
                    >
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: '#fff',
                        }}
                      />
                      {report?.status === 'ACTIVE' ? 'Aktif' : 'Expired'}
                    </span>

                    {/* TOMBOL ICON MAHKOTA UNTUK UPGRADE PLAN DI BAWAH TULISAN AKTIF */}
                    <button
                      type="button"
                      className="btn btn-warning rounded-pill px-2 py-1 fw-bold text-dark d-inline-flex align-items-center gap-1 shadow-sm border-0 mt-2"
                      style={{ fontSize: '0.74rem' }}
                      onClick={() => setShowUpgradeModal(true)}
                      title="Upgrade Plan"
                    >
                      <i className="bi bi-gem text-dark" style={{ fontSize: '0.85rem' }}></i>
                      <span>Upgrade</span>
                    </button>
                  </div>
                </div>

                {/* PERINGATAN KUOTA >= 80% */}
                {trx.isWarning && (
                  <div
                    className="p-2 rounded-3 mb-2 d-flex align-items-center justify-content-between"
                    style={{
                      backgroundColor: 'rgba(245, 158, 11, 0.25)',
                      border: '1px solid rgba(245, 158, 11, 0.4)',
                    }}
                  >
                    <div className="small text-white d-flex align-items-center gap-2">
                      <i className="bi bi-exclamation-triangle-fill text-warning fs-5"></i>
                      <span>
                        <strong>Kuota Menipis!</strong> Transaksi telah mencapai {trx.percentage}%.
                      </span>
                    </div>
                    {isOwner && (
                      <button
                        type="button"
                        className="btn btn-sm btn-warning text-dark fw-bold rounded-pill px-2 py-2 text-nowrap ms-2"
                        style={{ fontSize: '0.72rem' }}
                        onClick={() => setTopupModalOpen(true)}
                      >
                        Top-up
                      </button>
                    )}
                  </div>
                )}

                {/* PERINGATAN KUOTA 100% */}
                {trx.isExceeded && (
                  <div
                    className="p-2 rounded-3 mb-2 d-flex align-items-center justify-content-between"
                    style={{
                      backgroundColor: 'rgba(239, 68, 68, 0.25)',
                      border: '1px solid rgba(239, 68, 68, 0)',
                    }}
                  >
                    <div className="small text-white d-flex align-items-center gap-2">
                      <i className="bi bi-shield-fill-x text-white fs-5"></i>
                      <span>
                        <strong>Batas Tercapai!</strong> Transaksi baru terkunci. Data lama tetap aman.
                      </span>
                    </div>
                    {isOwner && (
                      <button
                        type="button"
                        className="btn btn-sm btn-light text-danger fw-bold rounded-pill px-2 py-2 text-nowrap ms-2"
                        style={{ fontSize: '0.72rem' }}
                        onClick={() => setTopupModalOpen(true)}
                      >
                        Beli Top-up
                      </button>
                    )}
                  </div>
                )}

                {/* PERINGATAN FOTO KADALUARSA 7 HARI */}
                {photos.expiringSoonCount > 0 && (
                  <div
                    className="p-2 rounded-3 mb-0 d-flex align-items-center gap-2 small"
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.15)',
                      border: '1px solid rgba(255, 255, 255, 0.25)',
                    }}
                  >
                    <i className="bi bi-info-circle-fill text-info fs-6"></i>
                    <div className="text-white-50" style={{ fontSize: '0.74rem' }}>
                      Ada <strong className="text-white">{photos.expiringSoonCount} foto chat</strong> yang akan dibersihkan dalam 7 hari sesuai retensi ({photos.retentionDays} hari).
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 2. PENGGUNAAN KUOTA BULAN INI (2x2 GRID LEGA) */}
            <div className="d-flex justify-content-between align-items-center mb-3 mt-3 flex-wrap gap-2">
              <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2" style={{ fontSize: '0.92rem' }}>
                <span>Penggunaan Kuota Bulan Ini</span>
              </h6>
              {/* {isOwner && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary rounded-pill px-3 py-1 shadow-xs fw-semibold"
                  style={{ fontSize: '0.75rem' }}
                  onClick={() => setTopupModalOpen(true)}
                >
                  Top-up Kuota
                </button>
              )} */}
            </div>

            <div className="row g-2 mb-4">
              {/* Kuota Transaksi */}
              <div className="col-6 col-md-3">
                <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100 d-flex flex-column justify-content-between">
                  <div>
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="text-muted small fw-medium" style={{ fontSize: '0.75rem' }}>Transaksi</span>
                      <div
                        className="rounded-3 d-flex align-items-center justify-content-center"
                        style={{ width: '26px', height: '26px', backgroundColor: '#eff6ff', color: '#2563eb' }}
                      >
                        <i className="bi bi-receipt" style={{ fontSize: '0.8rem' }}></i>
                      </div>
                    </div>
                    <div className="fw-bold text-dark mb-1" style={{ fontSize: '1.25rem', letterSpacing: '-0.3px' }}>
                      {trx.used}{' '}
                      <span className="text-muted fw-normal" style={{ fontSize: '0.8rem' }}>
                        / {trx.limit === -1 ? '∞' : trx.totalLimit}
                      </span>
                    </div>
                    <div className="progress rounded-pill mb-1" style={{ height: '6px', backgroundColor: '#f1f5f9' }}>
                      <div
                        className="progress-bar rounded-pill"
                        style={{
                          width: `${trx.percentage}%`,
                          backgroundColor: getProgressColor(trx.percentage, trx.isExceeded),
                        }}
                      />
                    </div>
                  </div>
                  <div className="d-flex align-items-center mt-1" style={{ minHeight: '28px' }}>
                    <span className="text-muted" style={{ fontSize: '0.7rem', lineHeight: '1.25' }}>
                      {trx.limit === -1 ? 'Unlimited (FUP)' : `${trx.remaining} sisa bulan ini`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Kuota Master Produk / Layanan */}
              <div className="col-6 col-md-3">
                <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100 d-flex flex-column justify-content-between">
                  <div>
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="text-muted small fw-medium" style={{ fontSize: '0.75rem' }}>Produk</span>
                      <div
                        className="rounded-3 d-flex align-items-center justify-content-center"
                        style={{ width: '26px', height: '26px', backgroundColor: '#ecfdf5', color: '#059669' }}
                      >
                        <i className="bi bi-tag-fill" style={{ fontSize: '0.8rem' }}></i>
                      </div>
                    </div>
                    <div className="fw-bold text-dark mb-1" style={{ fontSize: '1.25rem', letterSpacing: '-0.3px' }}>
                      {prods.used}{' '}
                      <span className="text-muted fw-normal" style={{ fontSize: '0.8rem' }}>
                        / {prods.limit === -1 ? '∞' : prods.limit}
                      </span>
                    </div>
                    <div className="progress rounded-pill mb-1" style={{ height: '6px', backgroundColor: '#f1f5f9' }}>
                      <div
                        className="progress-bar rounded-pill"
                        style={{
                          width: `${prods.limit === -1 ? 0 : prods.percentage}%`,
                          backgroundColor: getProgressColor(prods.percentage, prods.isExceeded),
                        }}
                      />
                    </div>
                  </div>
                  <div className="d-flex align-items-center mt-1" style={{ minHeight: '28px' }}>
                    <span className="text-muted" style={{ fontSize: '0.7rem', lineHeight: '1.25' }}>
                      {prods.limit === -1 ? 'Unlimited produk' : `${prods.used} dari ${prods.limit} item aktif`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Kuota Kasir / User */}
              <div className="col-6 col-md-3">
                <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100 d-flex flex-column justify-content-between">
                  <div>
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="text-muted small fw-medium" style={{ fontSize: '0.75rem' }}>Jumlah Kasir</span>
                      <div
                        className="rounded-3 d-flex align-items-center justify-content-center"
                        style={{ width: '26px', height: '26px', backgroundColor: '#fffbeb', color: '#d97706' }}
                      >
                        <i className="bi bi-people" style={{ fontSize: '0.8rem' }}></i>
                      </div>
                    </div>
                    <div className="fw-bold text-dark mb-1" style={{ fontSize: '1.25rem', letterSpacing: '-0.3px' }}>
                      {users.used}{' '}
                      <span className="text-muted fw-normal" style={{ fontSize: '0.8rem' }}>
                        / {users.limit === -1 ? '∞' : users.limit}
                      </span>
                    </div>
                    <div className="progress rounded-pill mb-1" style={{ height: '6px', backgroundColor: '#f1f5f9' }}>
                      <div
                        className="progress-bar rounded-pill"
                        style={{
                          width: `${users.limit === -1 ? 0 : Math.min(100, (users.used / users.limit) * 100)}%`,
                          backgroundColor: users.isExceeded ? '#ef4444' : '#2563eb',
                        }}
                      />
                    </div>
                  </div>
                  <div className="d-flex align-items-center mt-1" style={{ minHeight: '28px' }}>
                    <span className="text-muted" style={{ fontSize: '0.7rem', lineHeight: '1.25' }}>
                      {users.limit === -1 ? 'Tak terbatas' : users.isExceeded ? 'Batas tercapai' : `Maks ${users.limit} pengguna`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Kuota Stok Bahan */}
              <div className="col-6 col-md-3">
                <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100 d-flex flex-column justify-content-between">
                  <div>
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="text-muted small fw-medium" style={{ fontSize: '0.75rem' }}>Stok Bahan</span>
                      <div
                        className="rounded-3 d-flex align-items-center justify-content-center"
                        style={{ width: '26px', height: '26px', backgroundColor: '#ecfdf5', color: '#059669' }}
                      >
                        <i className="bi bi-box-seam" style={{ fontSize: '0.8rem' }}></i>
                      </div>
                    </div>
                    <div className="fw-bold text-dark mb-1" style={{ fontSize: '1.25rem', letterSpacing: '-0.3px' }}>
                      {inv.used}{' '}
                      <span className="text-muted fw-normal" style={{ fontSize: '0.8rem' }}>
                        / {inv.limit === -1 ? '∞' : inv.limit}
                      </span>
                    </div>
                    <div className="progress rounded-pill mb-1" style={{ height: '6px', backgroundColor: '#f1f5f9' }}>
                      <div
                        className="progress-bar rounded-pill"
                        style={{
                          width: `${inv.limit === 0 ? 100 : inv.limit === -1 ? 25 : Math.min(100, (inv.used / inv.limit) * 100)}%`,
                          backgroundColor: inv.limit === 0 ? '#94a3b8' : inv.isExceeded ? '#ef4444' : '#10b981',
                        }}
                      />
                    </div>
                  </div>
                  <div className="d-flex align-items-center mt-1" style={{ minHeight: '28px' }}>
                    <span className="text-muted" style={{ fontSize: '0.7rem', lineHeight: '1.25' }}>
                      {inv.limit === 0
                        ? 'Terkunci di Trial'
                        : inv.limit === -1
                          ? 'Unlimited item'
                          : inv.remaining <= 0 || inv.isExceeded
                            ? 'Batas tercapai'
                            : `${inv.remaining} item lagi`}
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </>
        )}
      </div>

      {/* POPUP FULLSCREEN PILIHAN PAKET (RESPONSIVE MOBILE, COMPACT, SCROLL KE BAWAH) */}
      {showUpgradeModal && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex flex-column"
          style={{
            zIndex: 1060,
            backgroundColor: '#f4f6fa',
            overflowY: 'auto',
          }}
        >
          {/* HEADER MODAL */}
          <div
            className="sticky-top bg-white border-bottom px-3 py-2 d-flex align-items-center justify-content-between shadow-xs"
            style={{ zIndex: 10 }}
          >
            <div className="d-flex align-items-center gap-2">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center text-warning flex-shrink-0"
                style={{ width: '34px', height: '34px', backgroundColor: '#fef3c7' }}
              >
                <i className="bi bi-gem fs-6"></i>
              </div>
              <div>
                <h6 className="fw-bold mb-0 text-dark" style={{ fontSize: '0.95rem' }}>
                  Pilihan Paket Upgrade
                </h6>
                <small className="text-muted" style={{ fontSize: '0.72rem' }}>
                  Pilih paket yang sesuai kebutuhan toko Anda
                </small>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-light rounded-circle border shadow-xs d-flex align-items-center justify-content-center p-0 flex-shrink-0"
              style={{ width: '32px', height: '32px', backgroundColor: '#fff' }}
              onClick={() => setShowUpgradeModal(false)}
              aria-label="Tutup"
              title="Tutup"
            >
              <i className="bi bi-x-lg text-dark" style={{ fontSize: '0.8rem' }}></i>
            </button>
          </div>

          {/* DAFTAR PAKET: RESPONSIVE MOBILE & BISA SCROLL KE BAWAH */}
          <div className="container px-3 py-3" style={{ maxWidth: '640px' }}>
            <div className="d-flex align-items-center justify-content-between mb-2 px-1">
              <span className="text-muted small fw-medium" style={{ fontSize: '0.75rem' }}>
                Daftar Paket Langganan
              </span>
              <span className="badge bg-white text-muted border rounded-pill px-2 py-2" style={{ fontSize: '0.68rem' }}>
                {plans.length} Paket Tersedia
              </span>
            </div>

            <div className="d-flex flex-column gap-2 pb-4">
              {plans.map((p) => {
                const isCurrent = currentPlanKey === p.key;
                const isPop = p.isPopular;

                return (
                  <div
                    key={p.key}
                    className="card rounded-3 shadow-xs border bg-white overflow-hidden transition-all"
                    style={{
                      borderColor: isPop ? '#3b82f6' : isCurrent ? '#10b981' : '#e2e8f0',
                      borderWidth: isPop || isCurrent ? '1px' : '1px',
                    }}
                  >
                    {isPop && (
                      <div
                        className="bg-primary text-white text-center py-2 fw-bold"
                        style={{ fontSize: '0.65rem', letterSpacing: '0.4px' }}
                      >
                        ⭐ PALING POPULER & DIREKOMENDASIKAN
                      </div>
                    )}

                    <div className="p-3">
                      {/* BARIS NAMA & HARGA */}
                      <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
                        <div>
                          <div className="d-flex align-items-center gap-1">
                            <h6 className="fw-bold text-dark mb-0" style={{ fontSize: '0.96rem' }}>
                              {p.name}
                            </h6>
                            {isCurrent && (
                              <span
                                className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2 py-2.2"
                                style={{ fontSize: '0.65rem' }}
                              >
                                Aktif
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-end">
                          <span className="fw-bold text-dark" style={{ fontSize: '1.15rem' }}>
                            {p.price === 0 ? 'Gratis' : `Rp ${p.price.toLocaleString('id-ID')}`}
                          </span>
                          {p.price > 0 && (
                            <span className="text-muted small ms-1" style={{ fontSize: '0.72rem' }}>
                              /bln
                            </span>
                          )}
                        </div>
                      </div>

                      {/* FITUR-FITUR RINGKAS DALAM 2 KOLOM */}
                      <div className="rounded-2 p-2 mb-2" style={{ backgroundColor: '#f8fafc', fontSize: '0.74rem' }}>
                        <div className="row g-1 text-muted">
                          <div className="col-6 d-flex align-items-center gap-1 text-truncate">
                            <i className="bi bi-check-circle-fill text-success flex-shrink-0" style={{ fontSize: '0.72rem' }}></i>
                            <span className="text-truncate">
                              <strong>{p.maxTransactions === -1 ? 'Unlimited' : p.maxTransactions.toLocaleString('id-ID')}</strong> Trx/bln
                            </span>
                          </div>
                          <div className="col-6 d-flex align-items-center gap-1 text-truncate">
                            <i className="bi bi-check-circle-fill text-success flex-shrink-0" style={{ fontSize: '0.72rem' }}></i>
                            <span className="text-truncate">
                              <strong>{p.maxProducts === -1 ? 'Unlimited' : p.maxProducts}</strong> Produk
                            </span>
                          </div>
                          <div className="col-6 d-flex align-items-center gap-1 text-truncate">
                            <i className="bi bi-check-circle-fill text-success flex-shrink-0" style={{ fontSize: '0.72rem' }}></i>
                            <span className="text-truncate">
                              <strong>{p.maxUsers === -1 ? 'Unlimited' : p.maxUsers}</strong> Kasir
                            </span>
                          </div>
                          <div className="col-6 d-flex align-items-center gap-1 text-truncate">
                            <i
                              className={`bi bi-${p.maxStockItems === 0 ? 'x-circle text-muted' : 'check-circle-fill text-success'} flex-shrink-0`}
                              style={{ fontSize: '0.72rem' }}
                            ></i>
                            <span className="text-truncate">
                              {p.maxStockItems === 0
                                ? 'Tanpa Stok'
                                : p.maxStockItems === -1
                                  ? 'Stok Unlimited'
                                  : `${p.maxStockItems} Stok Bahan`}
                            </span>
                          </div>
                          <div className="col-6 d-flex align-items-center gap-1 text-truncate">
                            <i className="bi bi-check-circle-fill text-success flex-shrink-0" style={{ fontSize: '0.72rem' }}></i>
                            <span className="text-truncate">
                              <strong>{p.maxChatPhotos === -1 ? 'Unlimited' : p.maxChatPhotos}</strong> Foto Chat
                            </span>
                          </div>
                          <div className="col-6 d-flex align-items-center gap-1 text-truncate">
                            <i className="bi bi-check-circle-fill text-success flex-shrink-0" style={{ fontSize: '0.72rem' }}></i>
                            <span className="text-truncate">Nota WA & Cetak</span>
                          </div>
                        </div>
                      </div>

                      {/* TOMBOL AKSI AJUKAN */}
                      {isCurrent ? (
                        <button
                          type="button"
                          className="btn btn-light rounded-pill w-100 py-1 fw-semibold text-muted border shadow-none"
                          style={{ fontSize: '0.8rem' }}
                          disabled
                        >
                          <i className="bi bi-check2 me-1"></i> Paket Sedang Aktif
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={`btn ${isPop ? 'btn-primary text-white' : 'btn-outline-primary'} rounded-pill w-100 py-1 fw-bold shadow-xs d-flex align-items-center justify-content-center gap-1`}
                          style={{ fontSize: '0.82rem' }}
                          onClick={() => {
                            setSelectedPaymentPlan(p);
                          }}
                        >
                          <span>Ajukan Paket</span>
                          <i className="bi bi-arrow-right" style={{ fontSize: '0.78rem' }}></i>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL AJUKAN PAKET: INFO PEMBAYARAN BCA & KIRIM WA */}
      {selectedPaymentPlan && (
        <>
          <div
            className="modal-backdrop fade show"
            style={{ zIndex: 1070 }}
            onClick={() => setSelectedPaymentPlan(null)}
          ></div>
          <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1075 }}>
            <div className="modal-dialog modal-dialog-centered mx-auto px-3 my-2" style={{ maxWidth: '420px' }}>
              <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                <div className="modal-header border-bottom bg-light px-3 py-2">
                  <div className="d-flex align-items-center gap-2">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center text-primary"
                      style={{ width: '30px', height: '30px', backgroundColor: '#e0f2fe' }}
                    >
                      <i className="bi bi-gem fs-6"></i>
                    </div>
                    <h6 className="modal-title fw-bold text-dark mb-0" style={{ fontSize: '0.92rem' }}>
                      Ajukan Upgrade Paket
                    </h6>
                  </div>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setSelectedPaymentPlan(null)}
                  ></button>
                </div>

                <div className="modal-body p-3">
                  {/* RINGKASAN PAKET YANG DIPILIH */}
                  <div className="p-2 rounded-3 bg-light border mb-2 d-flex align-items-center justify-content-between">
                    <div>
                      <small className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Paket yang Diajukan:</small>
                      <strong className="text-dark" style={{ fontSize: '0.92rem' }}>{selectedPaymentPlan.name}</strong>
                    </div>
                    <div className="text-end">
                      <small className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Biaya Langganan:</small>
                      <strong className="text-primary" style={{ fontSize: '1rem' }}>
                        {selectedPaymentPlan.price === 0
                          ? 'Gratis'
                          : `Rp ${selectedPaymentPlan.price.toLocaleString('id-ID')}`}
                      </strong>
                    </div>
                  </div>

                  {/* KARTU PETUNJUK TRANSFER BCA */}
                  <div
                    className="p-3 rounded-3 mb-2 border text-start"
                    style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }}
                  >
                    <div className="d-flex align-items-center justify-content-between mb-1">
                      <span className="badge rounded-pill px-2 py-2 fw-bold text-white" style={{ backgroundColor: '#00529c', fontSize: '0.68rem' }}>
                        BANK BCA
                      </span>
                      <span className="text-success small fw-medium" style={{ fontSize: '0.72rem' }}>
                        <i className="bi bi-shield-check me-1"></i>Rekening Resmi
                      </span>
                    </div>

                    <div className="mb-1">
                      <div className="text-muted small" style={{ fontSize: '0.7rem' }}>Nomor Rekening BCA:</div>
                      <div className="d-flex align-items-center justify-content-between gap-2 mt-0">
                        <span className="fw-bolder fs-4 text-dark font-monospace" style={{ letterSpacing: '0px' }}>
                          7425485709
                        </span>
                        <button
                          type="button"
                          className="btn btn-sm btn-white border rounded-pill px-2 py-2 text-primary fw-semibold shadow-xs bg-white"
                          style={{ fontSize: '0.72rem' }}
                          onClick={() => {
                            navigator.clipboard.writeText('7425485709');
                            toast.success('Nomor rekening BCA disalin!');
                          }}
                        >
                          <i className="bi bi-copy me-1"></i>Salin
                        </button>
                      </div>
                    </div>

                    <div className="small text-muted" style={{ fontSize: '0.75rem' }}>
                      Atas Nama: <strong className="text-dark">Muhamad Efendy Ray</strong>
                    </div>
                  </div>

                  <p className="text-muted small mb-2 text-start" style={{ fontSize: '0.74rem', lineHeight: '1.35' }}>
                    Setelah transfer, silakan konfirmasi via WhatsApp dengan menyertakan bukti transfer.
                  </p>

                  {/* TOMBOL KONFIRMASI WA 087853131099 */}
                  <button
                    type="button"
                    className="btn btn-success rounded-pill w-100 py-2 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-1 mb-2"
                    style={{ fontSize: '0.84rem' }}
                    onClick={() => {
                      const priceText = selectedPaymentPlan.price === 0
                        ? 'Gratis'
                        : `Rp ${selectedPaymentPlan.price.toLocaleString('id-ID')}`;
                      const message =
                        `Halo Admin TokoPlus,\n\n` +
                        `Saya ingin mengajukan upgrade paket:\n` +
                        `• Nama Toko: ${storeName}\n` +
                        `• Username: @${user?.username || 'owner'}\n` +
                        `• Paket Dipilih: ${selectedPaymentPlan.name} (${priceText})\n` +
                        `• Rekening Pembayaran: BCA 7425485709 a/n Muhamad Efendy Ray\n\n` +
                        `Mohon bantuannya untuk diproses aktivasi. Terima kasih!`;
                      const waUrl = `https://wa.me/6287853131099?text=${encodeURIComponent(message)}`;
                      window.open(waUrl, '_blank');
                    }}
                  >
                    <i className="bi bi-whatsapp fs-5"></i>
                    <span>&nbsp; Kirim Pengajuan</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-light rounded-pill w-100 py-1 text-muted fw-semibold small"
                    style={{ fontSize: '0.78rem' }}
                    onClick={() => setSelectedPaymentPlan(null)}
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* MODAL TOP-UP KUOTA */}
      {topupModalOpen && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1060 }} onClick={() => setTopupModalOpen(false)}></div>
          <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1065 }}>
            <div className="modal-dialog modal-dialog-centered mx-auto px-3" style={{ maxWidth: '420px' }}>
              <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                <div className="modal-header border-bottom px-4 pt-3 pb-3 bg-light">
                  <h6 className="modal-title fw-bold text-dark d-flex align-items-center gap-2 mb-0">
                    <span>Top-up Kuota Tambahan</span>
                  </h6>
                  <button type="button" className="btn-close" onClick={() => setTopupModalOpen(false)}></button>
                </div>
                <div className="modal-body p-4">
                  <p className="small text-muted mb-3" style={{ fontSize: '0.78rem' }}>
                    Pilih kuota tambahan yang ingin langsung ditambahkan ke toko Anda:
                  </p>

                  <div className="d-flex flex-column gap-2 mb-3">
                    <div
                      className="p-3 rounded-3 text-start d-flex justify-content-between align-items-center border transition-all"
                      style={{ backgroundColor: '#f8fafc', cursor: 'pointer' }}
                      onClick={() => {
                        window.open(getTopupWhatsAppUrl('TRANSACTIONS', 50, storeName, 'Rp 20.000'), '_blank');
                        setTopupModalOpen(false);
                      }}
                    >
                      <div>
                        <div className="d-flex align-items-center gap-2">
                          <span className="fw-bold text-dark" style={{ fontSize: '0.85rem' }}>+50 Kuota Transaksi</span>
                          <span className="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill px-2 py-2 fw-bold" style={{ fontSize: '0.72rem' }}>
                            Rp 20.000
                          </span>
                        </div>
                        <small className="text-muted" style={{ fontSize: '0.72rem' }}>Pesan kuota ke WhatsApp admin</small>
                      </div>
                      <span className="badge bg-success rounded-pill px-2 py-1">Pesan via WA</span>
                    </div>

                    <div
                      className="p-3 rounded-3 text-start d-flex justify-content-between align-items-center border transition-all"
                      style={{ backgroundColor: '#f8fafc', cursor: 'pointer' }}
                      onClick={() => {
                        window.open(getTopupWhatsAppUrl('TRANSACTIONS', 100, storeName, 'Rp 25.000'), '_blank');
                        setTopupModalOpen(false);
                      }}
                    >
                      <div>
                        <div className="d-flex align-items-center gap-2">
                          <span className="fw-bold text-dark" style={{ fontSize: '0.85rem' }}>+100 Kuota Transaksi</span>
                          <span className="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill px-2 py-2 fw-bold" style={{ fontSize: '0.72rem' }}>
                            Rp 25.000
                          </span>
                        </div>
                        <small className="text-muted" style={{ fontSize: '0.72rem' }}>Pesan kuota ke WhatsApp admin</small>
                      </div>
                      <span className="badge bg-success rounded-pill px-2 py-1">Pesan via WA</span>
                    </div>

                    <div
                      className="p-3 rounded-3 text-start d-flex justify-content-between align-items-center border transition-all"
                      style={{ backgroundColor: '#f8fafc', cursor: 'pointer' }}
                      onClick={() => {
                        window.open(getTopupWhatsAppUrl('PHOTOS', 200, storeName, 'Rp 50.000'), '_blank');
                        setTopupModalOpen(false);
                      }}
                    >
                      <div>
                        <div className="d-flex align-items-center gap-2">
                          <span className="fw-bold text-dark" style={{ fontSize: '0.85rem' }}>+200 Foto Chat</span>
                          <span className="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill px-2 py-2 fw-bold" style={{ fontSize: '0.72rem' }}>
                            Rp 50.000
                          </span>
                        </div>
                        <small className="text-muted" style={{ fontSize: '0.72rem' }}>Pesan kuota ke WhatsApp admin</small>
                      </div>
                      <span className="badge bg-success rounded-pill px-2 py-1">Pesan via WA</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
