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
  const [confirmModal, setConfirmModal] = useState({ open: false, planKey: null, planName: '' });

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
      const data = await getSubscriptionReport();
      setReport(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    syncPlansFromBackend().catch((err) => console.warn('Sync plans failed:', err));
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
      setConfirmModal({ open: false, planKey: null, planName: '' });
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
                className="alert border-0 rounded-4 shadow-xs py-2.5 px-3 mb-3 d-flex align-items-center gap-2.5"
                style={{ backgroundColor: '#e0f2fe', color: '#0369a1', fontSize: '0.82rem' }}
              >
                <i className="bi bi-info-circle-fill fs-5 text-primary flex-shrink-0"></i>
                <div>
                  <strong>Mode Tinjau Kasir:</strong> Anda sedang melihat rincian batas kuota paket toko. Perubahan atau upgrade paket hanya dapat diproses oleh akun <strong>Owner</strong>.
                </div>
              </div>
            )}

            {/* 1. KARTU HERO PAKET SAAT INI (WARNA SAMA DENGAN HOME) */}
            <div
              className="card border-0 shadow-sm rounded-4 mb-3.5 overflow-hidden text-white position-relative"
              style={{
                background: 'linear-gradient(135deg, #0134d4 0%, #2855e1 100%)',
                boxShadow: '0 8px 24px -4px rgba(1, 52, 212, 0.3)',
              }}
            >
              <div className="card-body p-3.5 p-sm-4 position-relative">
                <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                  <div>
                    <span
                      className="badge rounded-pill fw-semibold mb-2 d-inline-flex align-items-center gap-1"
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.22)',
                        backdropFilter: 'blur(8px)',
                        fontSize: '0.68rem',
                        padding: '4px 10px',
                        letterSpacing: '0.5px',
                      }}
                    >
                      <i className="bi bi-patch-check-fill text-warning"></i>
                      PAKET AKTIF SAAT INI
                    </span>
                    <h3 className="fw-bold text-white mb-0" style={{ letterSpacing: '-0.3px' }}>
                      {currentPlan.name}
                    </h3>

                  </div>

                  <div className="text-end">
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
                  </div>
                </div>

                {/* PERINGATAN KUOTA >= 80% */}
                {trx.isWarning && (
                  <div
                    className="p-2.5 rounded-3 mb-2 d-flex align-items-center justify-content-between"
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
                        className="btn btn-sm btn-warning text-dark fw-bold rounded-pill px-2.5 py-0.5 text-nowrap ms-2"
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
                    className="p-2.5 rounded-3 mb-2 d-flex align-items-center justify-content-between"
                    style={{
                      backgroundColor: 'rgba(239, 68, 68, 0.25)',
                      border: '1px solid rgba(239, 68, 68, 0.5)',
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
                        className="btn btn-sm btn-light text-danger fw-bold rounded-pill px-2.5 py-0.5 text-nowrap ms-2"
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
                    className="p-2.5 rounded-3 mb-0 d-flex align-items-center gap-2 small"
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
            <div className="d-flex justify-content-between align-items-center mb-3 mt-1 flex-wrap gap-2">
              <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2" style={{ fontSize: '0.92rem' }}>
                <span>Penggunaan Kuota Bulan Ini</span>
              </h6>
              {isOwner && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary rounded-pill px-3 py-1 shadow-xs fw-semibold"
                  style={{ fontSize: '0.75rem' }}
                  onClick={() => setTopupModalOpen(true)}
                >
                  Top-up Kuota
                </button>
              )}
            </div>

            <div className="row g-2.5 mb-4">
              {/* Kuota Transaksi */}
              <div className="col-6 col-md-3 mb-3">
                <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100">
                  <div className="d-flex justify-content-between align-items-center mb-1.5">
                    <span className="text-muted small fw-medium" style={{ fontSize: '0.75rem' }}>Transaksi</span>
                    <div
                      className="rounded-3 d-flex align-items-center justify-content-center"
                      style={{ width: '26px', height: '26px', backgroundColor: '#eff6ff', color: '#2563eb' }}
                    >
                      <i className="bi bi-receipt" style={{ fontSize: '0.8rem' }}></i>
                    </div>
                  </div>
                  <div className="fw-bold text-dark mb-1.5" style={{ fontSize: '1.25rem', letterSpacing: '-0.3px' }}>
                    {trx.used}{' '}
                    <span className="text-muted fw-normal" style={{ fontSize: '0.8rem' }}>
                      / {trx.limit === -1 ? '∞' : trx.totalLimit}
                    </span>
                  </div>
                  <div className="progress rounded-pill mb-1.5" style={{ height: '6px', backgroundColor: '#f1f5f9' }}>
                    <div
                      className="progress-bar rounded-pill"
                      style={{
                        width: `${trx.percentage}%`,
                        backgroundColor: getProgressColor(trx.percentage, trx.isExceeded),
                      }}
                    />
                  </div>
                  <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>
                    {trx.limit === -1 ? 'Unlimited (FUP)' : `${trx.remaining} sisa bulan ini`}
                  </span>
                </div>
              </div>

              {/* Kuota Master Produk / Layanan */}
              <div className="col-6 col-md-3 mb-3">
                <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100">
                  <div className="d-flex justify-content-between align-items-center mb-1.5">
                    <span className="text-muted small fw-medium" style={{ fontSize: '0.75rem' }}>Produk</span>
                    <div
                      className="rounded-3 d-flex align-items-center justify-content-center"
                      style={{ width: '26px', height: '26px', backgroundColor: '#ecfdf5', color: '#059669' }}
                    >
                      <i className="bi bi-tag-fill" style={{ fontSize: '0.8rem' }}></i>
                    </div>
                  </div>
                  <div className="fw-bold text-dark mb-1.5" style={{ fontSize: '1.25rem', letterSpacing: '-0.3px' }}>
                    {prods.used}{' '}
                    <span className="text-muted fw-normal" style={{ fontSize: '0.8rem' }}>
                      / {prods.limit === -1 ? '∞' : prods.limit}
                    </span>
                  </div>
                  <div className="progress rounded-pill mb-1.5" style={{ height: '6px', backgroundColor: '#f1f5f9' }}>
                    <div
                      className="progress-bar rounded-pill"
                      style={{
                        width: `${prods.limit === -1 ? 0 : prods.percentage}%`,
                        backgroundColor: getProgressColor(prods.percentage, prods.isExceeded),
                      }}
                    />
                  </div>
                  <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>
                    {prods.limit === -1 ? 'Unlimited produk' : `${prods.used} dari ${prods.limit} item aktif`}
                  </span>
                </div>
              </div>

              {/* Kuota Kasir / User */}
              <div className="col-6 col-md-3">
                <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100">
                  <div className="d-flex justify-content-between align-items-center mb-1.5">
                    <span className="text-muted small fw-medium" style={{ fontSize: '0.75rem' }}>Jumlah Kasir</span>
                    <div
                      className="rounded-3 d-flex align-items-center justify-content-center"
                      style={{ width: '26px', height: '26px', backgroundColor: '#fffbeb', color: '#d97706' }}
                    >
                      <i className="bi bi-people" style={{ fontSize: '0.8rem' }}></i>
                    </div>
                  </div>
                  <div className="fw-bold text-dark mb-1.5" style={{ fontSize: '1.25rem', letterSpacing: '-0.3px' }}>
                    {users.used}{' '}
                    <span className="text-muted fw-normal" style={{ fontSize: '0.8rem' }}>
                      / {users.limit}
                    </span>
                  </div>
                  <div className="progress rounded-pill mb-1.5" style={{ height: '6px', backgroundColor: '#f1f5f9' }}>
                    <div
                      className="progress-bar rounded-pill"
                      style={{
                        width: `${Math.min(100, (users.used / users.limit) * 100)}%`,
                        backgroundColor: users.isExceeded ? '#ef4444' : '#2563eb',
                      }}
                    />
                  </div>
                  <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>
                    {users.isExceeded ? 'Batas tercapai' : `Maks ${users.limit} pengguna`}
                  </span>
                </div>
              </div>

              {/* Kuota Stok Bahan */}
              <div className="col-6 col-md-3">
                <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100">
                  <div className="d-flex justify-content-between align-items-center mb-1.5">
                    <span className="text-muted small fw-medium" style={{ fontSize: '0.75rem' }}>Stok Bahan</span>
                    <div
                      className="rounded-3 d-flex align-items-center justify-content-center"
                      style={{ width: '26px', height: '26px', backgroundColor: '#ecfdf5', color: '#059669' }}
                    >
                      <i className="bi bi-box-seam" style={{ fontSize: '0.8rem' }}></i>
                    </div>
                  </div>
                  <div className="fw-bold text-dark mb-1.5" style={{ fontSize: '1.25rem', letterSpacing: '-0.3px' }}>
                    {inv.used}{' '}
                    <span className="text-muted fw-normal" style={{ fontSize: '0.8rem' }}>
                      / {inv.limit === -1 ? '∞' : inv.limit}
                    </span>
                  </div>
                  <div className="progress rounded-pill mb-1.5" style={{ height: '6px', backgroundColor: '#f1f5f9' }}>
                    <div
                      className="progress-bar rounded-pill"
                      style={{
                        width: `${inv.limit === 0 ? 100 : inv.limit === -1 ? 25 : Math.min(100, (inv.used / inv.limit) * 100)}%`,
                        backgroundColor: inv.limit === 0 ? '#94a3b8' : inv.isExceeded ? '#ef4444' : '#10b981',
                      }}
                    />
                  </div>
                  <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>
                    {inv.limit === 0 ? 'Terkunci di Trial' : inv.limit === -1 ? 'Unlimited item' : `${inv.remaining} item lagi`}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. TABEL MATRIKS LENGKAP */}
            <div className="d-flex justify-content-between align-items-center mb-2.5 mt-4">
              <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2" style={{ fontSize: '0.92rem' }}>
                <span>Paket</span>
              </h6>
            </div>

            <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white mb-4">
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #cbd5e1' }}>
                      <th
                        className="py-3 px-3 fw-bold"
                        style={{
                          position: 'sticky',
                          left: 0,
                          zIndex: 2,
                          minWidth: '150px',
                          width: '150px',
                          backgroundColor: '#e2e8f0',
                          color: '#0f172a',
                          borderRight: '1.5px solid #cbd5e1',
                          whiteSpace: 'nowrap',
                          verticalAlign: 'middle',
                        }}
                      >
                        <div className="d-flex align-items-center gap-1.5">
                          <i className="bi bi-grid-fill text-secondary" style={{ fontSize: '0.85rem' }}></i>
                          <span>Fitur</span>
                        </div>
                      </th>
                      {plans.map((p) => {
                        const isPop = p.isPopular;

                        return (
                          <th
                            key={p.key}
                            className="py-3 px-3 text-center position-relative"
                            style={{
                              minWidth: isPop ? '140px' : '115px',
                              whiteSpace: 'nowrap',
                              backgroundColor: isPop ? '#e0f2fe' : '#f1f5f9',
                              color: isPop ? '#0369a1' : '#0f172a',
                              borderRight: '1px solid #e2e8f0',
                              verticalAlign: 'middle',
                            }}
                          >
                            {isPop && (
                              <span
                                className="badge bg-primary text-white fw-bold rounded-pill mb-1 d-inline-block shadow-xs"
                                style={{ fontSize: '0.62rem', padding: '2px 8px' }}
                              >
                                Terpopuler ⭐
                              </span>
                            )}
                            <div className="fw-bold" style={{ fontSize: '0.88rem' }}>
                              {p.name}
                            </div>
                            <div
                              className="small mt-0.5"
                              style={{ fontSize: '0.72rem', color: isPop ? '#0284c7' : '#64748b', fontWeight: '500' }}
                            >
                              {p.priceLabel || (p.price === 0 ? 'Gratis' : `Rp ${p.price.toLocaleString('id-ID')}`)}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Transaksi/bulan */}
                    <tr>
                      <td className="px-3 py-2.5 fw-medium" style={{ position: 'sticky', left: 0, zIndex: 1, minWidth: '150px', width: '150px', backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                        Transaksi/bulan
                      </td>
                      {plans.map((p) => (
                        <td key={p.key} className={`text-center ${p.isPopular ? 'fw-bold bg-primary-subtle border-start border-end' : ''}`} style={{ whiteSpace: 'nowrap' }}>
                          {p.maxTransactions === -1 ? 'Unlimited*' : p.maxTransactions.toLocaleString('id-ID')}
                        </td>
                      ))}
                    </tr>

                    {/* Upload Produk */}
                    <tr>
                      <td className="px-3 py-2.5 fw-medium" style={{ position: 'sticky', left: 0, zIndex: 1, minWidth: '150px', width: '150px', backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                        Upload Produk
                      </td>
                      {plans.map((p) => (
                        <td key={p.key} className={`text-center ${p.isPopular ? 'fw-bold bg-primary-subtle border-start border-end' : ''}`} style={{ whiteSpace: 'nowrap' }}>
                          {p.maxProducts === -1 ? 'Unlimited' : `${p.maxProducts ?? 5} produk`}
                        </td>
                      ))}
                    </tr>

                    {/* Foto chat/bulan */}
                    <tr>
                      <td className="px-3 py-2.5 fw-medium" style={{ position: 'sticky', left: 0, zIndex: 1, minWidth: '150px', width: '150px', backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                        Foto chat/bulan
                      </td>
                      {plans.map((p) => (
                        <td key={p.key} className={`text-center ${p.isPopular ? 'fw-bold bg-primary-subtle border-start border-end' : ''}`} style={{ whiteSpace: 'nowrap' }}>
                          {p.maxChatPhotos === -1 ? 'Unlimited' : p.maxChatPhotos.toLocaleString('id-ID')}
                        </td>
                      ))}
                    </tr>

                    {/* Bot transaksi (chat) */}
                    <tr>
                      <td className="px-3 py-2.5 fw-medium" style={{ position: 'sticky', left: 0, zIndex: 1, minWidth: '150px', width: '150px', backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                        Bot transaksi (chat)
                      </td>
                      {plans.map((p) => (
                        <td key={p.key} className={`text-center ${p.isPopular ? 'fw-bold bg-primary-subtle border-start border-end' : ''}`} style={{ whiteSpace: 'nowrap' }}>
                          {p.botTransactions === 0 ? (
                            <span className="text-muted opacity-40"><i className="bi bi-x-circle-fill"></i></span>
                          ) : p.botTransactions === -1 ? (
                            'Unlimited'
                          ) : (
                            `${p.botTransactions}x`
                          )}
                        </td>
                      ))}
                    </tr>

                    {/* Nota ke WhatsApp */}
                    <tr>
                      <td className="px-3 py-2.5 fw-medium" style={{ position: 'sticky', left: 0, zIndex: 1, minWidth: '150px', width: '150px', backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                        Nota ke WhatsApp
                      </td>
                      {plans.map((p) => (
                        <td key={p.key} className={`text-center text-success ${p.isPopular ? 'bg-primary-subtle border-start border-end' : ''}`} style={{ whiteSpace: 'nowrap' }}>
                          <i className="bi bi-check-circle-fill"></i>
                        </td>
                      ))}
                    </tr>

                    {/* Cetak nota */}
                    <tr>
                      <td className="px-3 py-2.5 fw-medium" style={{ position: 'sticky', left: 0, zIndex: 1, minWidth: '150px', width: '150px', backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                        Cetak nota
                      </td>
                      {plans.map((p) => (
                        <td key={p.key} className={`text-center text-success ${p.isPopular ? 'bg-primary-subtle border-start border-end' : ''}`} style={{ whiteSpace: 'nowrap' }}>
                          <i className="bi bi-check-circle-fill"></i>
                        </td>
                      ))}
                    </tr>

                    {/* Invoice PDF */}
                    <tr>
                      <td className="px-3 py-2.5 fw-medium" style={{ position: 'sticky', left: 0, zIndex: 1, minWidth: '150px', width: '150px', backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                        Invoice PDF
                      </td>
                      {plans.map((p) => (
                        <td key={p.key} className={`text-center ${p.isPopular ? 'fw-bold bg-primary-subtle border-start border-end' : ''}`} style={{ whiteSpace: 'nowrap' }}>
                          {p.maxPdfInvoice === 0 ? (
                            <span className="text-muted opacity-40"><i className="bi bi-x-circle-fill"></i></span>
                          ) : p.maxPdfInvoice === -1 ? (
                            p.customPdfLogo ? 'Unlimited + logo' : 'Unlimited'
                          ) : (
                            `${p.maxPdfInvoice}/bln`
                          )}
                        </td>
                      ))}
                    </tr>

                    {/* Lacak order link */}
                    <tr>
                      <td className="px-3 py-2.5 fw-medium" style={{ position: 'sticky', left: 0, zIndex: 1, minWidth: '150px', width: '150px', backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                        Lacak order link
                      </td>
                      {plans.map((p) => (
                        <td key={p.key} className={`text-center ${p.isPopular ? 'bg-primary-subtle border-start border-end text-success fw-medium' : p.watermarkTracking ? 'text-muted' : 'text-success'}`} style={{ whiteSpace: 'nowrap' }}>
                          {p.customTrackingView ? '+ Tampilan custom' : p.watermarkTracking ? 'Ada watermark' : 'Tanpa watermark'}
                        </td>
                      ))}
                    </tr>

                    {/* Stok bahan */}
                    <tr>
                      <td className="px-3 py-2.5 fw-medium" style={{ position: 'sticky', left: 0, zIndex: 1, minWidth: '150px', width: '150px', backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                        Stok bahan
                      </td>
                      {plans.map((p) => (
                        <td key={p.key} className={`text-center ${p.isPopular ? 'fw-bold bg-primary-subtle border-start border-end' : ''}`} style={{ whiteSpace: 'nowrap' }}>
                          {p.maxStockItems === 0 ? (
                            <span className="text-muted opacity-40"><i className="bi bi-x-circle-fill"></i></span>
                          ) : p.maxStockItems === -1 ? (
                            'Unlimited'
                          ) : (
                            `${p.maxStockItems} item`
                          )}
                        </td>
                      ))}
                    </tr>

                    {/* Notifikasi stok menipis */}
                    <tr>
                      <td className="px-3 py-2.5 fw-medium" style={{ position: 'sticky', left: 0, zIndex: 1, minWidth: '150px', width: '150px', backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                        Notifikasi stok menipis
                      </td>
                      {plans.map((p) => (
                        <td key={p.key} className={`text-center ${p.isPopular ? 'bg-primary-subtle border-start border-end' : ''}`} style={{ whiteSpace: 'nowrap' }}>
                          {p.lowStockNotification ? (
                            <i className="bi bi-check-circle-fill text-success"></i>
                          ) : (
                            <span className="text-muted opacity-40"><i className="bi bi-x-circle-fill"></i></span>
                          )}
                        </td>
                      ))}
                    </tr>

                    {/* Jumlah outlet */}
                    <tr>
                      <td className="px-3 py-2.5 fw-medium" style={{ position: 'sticky', left: 0, zIndex: 1, minWidth: '150px', width: '150px', backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                        Jumlah outlet
                      </td>
                      {plans.map((p) => (
                        <td key={p.key} className={`text-center ${p.isPopular ? 'fw-bold bg-primary-subtle border-start border-end' : ''}`} style={{ whiteSpace: 'nowrap' }}>
                          {p.maxOutlets}
                        </td>
                      ))}
                    </tr>

                    {/* Jumlah kasir/user */}
                    <tr>
                      <td className="px-3 py-2.5 fw-medium" style={{ position: 'sticky', left: 0, zIndex: 1, minWidth: '150px', width: '150px', backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                        Jumlah kasir/user
                      </td>
                      {plans.map((p) => (
                        <td key={p.key} className={`text-center ${p.isPopular ? 'fw-bold bg-primary-subtle border-start border-end' : ''}`} style={{ whiteSpace: 'nowrap' }}>
                          {p.maxUsers}
                        </td>
                      ))}
                    </tr>

                    {/* Riwayat data */}
                    <tr>
                      <td className="px-3 py-2.5 fw-medium" style={{ position: 'sticky', left: 0, zIndex: 1, minWidth: '150px', width: '150px', backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                        Riwayat data
                      </td>
                      {plans.map((p) => (
                        <td key={p.key} className={`text-center ${p.isPopular ? 'fw-bold bg-primary-subtle border-start border-end' : ''}`} style={{ whiteSpace: 'nowrap' }}>
                          {p.dataHistoryMonths} bulan
                        </td>
                      ))}
                    </tr>

                    {/* Foto disimpan */}
                    <tr>
                      <td className="px-3 py-2.5 fw-medium" style={{ position: 'sticky', left: 0, zIndex: 1, minWidth: '150px', width: '150px', backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                        Foto disimpan
                      </td>
                      {plans.map((p) => (
                        <td key={p.key} className={`text-center ${p.isPopular ? 'fw-bold bg-primary-subtle border-start border-end' : ''}`} style={{ whiteSpace: 'nowrap' }}>
                          {p.photoRetentionDays} hari
                        </td>
                      ))}
                    </tr>

                    {/* Tipe Support */}
                    <tr>
                      <td className="px-3 py-2.5 fw-medium" style={{ position: 'sticky', left: 0, zIndex: 1, minWidth: '150px', width: '150px', backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                        Tipe Support
                      </td>
                      {plans.map((p) => (
                        <td key={p.key} className={`text-center ${p.isPopular ? 'fw-bold bg-primary-subtle border-start border-end' : ''}`} style={{ whiteSpace: 'nowrap' }}>
                          {p.supportType}
                        </td>
                      ))}
                    </tr>
                  </tbody>

                  <tfoot className="table-light border-top">
                    <tr>
                      <td className="px-3 py-3 fw-bold" style={{ position: 'sticky', left: 0, zIndex: 2, minWidth: '150px', width: '150px', backgroundColor: '#f8fafc', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                        Aksi Langganan
                      </td>
                      {plans.map((p) => {
                        const isCurrent = currentPlanKey === p.key;
                        return (
                          <td
                            key={p.key}
                            className={`text-center py-3 px-2 ${p.isPopular ? 'bg-primary-subtle border-start border-end' : ''}`}
                            style={{ minWidth: p.isPopular ? '135px' : '115px', whiteSpace: 'nowrap' }}
                          >
                            <button
                              type="button"
                              className={`btn btn-sm ${isCurrent ? 'btn-success' : 'btn-primary text-white'} rounded-pill px-3 py-1 fw-semibold text-nowrap shadow-xs`}
                              style={{ fontSize: '0.74rem' }}
                              disabled={isCurrent}
                              onClick={() =>
                                setConfirmModal({
                                  open: true,
                                  planKey: p.key,
                                  planName: `${p.name} ${p.priceLabel || ''}`,
                                })
                              }
                            >
                              {isCurrent ? 'Aktif' : 'Ajukan'}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* MODAL PENGAJUAN PAKET KE WA ADMIN */}
      {confirmModal.open && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1060 }} onClick={() => setConfirmModal({ open: false, planKey: null, planName: '' })}></div>
          <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1065 }}>
            <div className="modal-dialog modal-dialog-centered mx-auto px-3" style={{ maxWidth: '420px' }}>
              <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                <div className="modal-header border-bottom bg-light px-4 py-3">
                  <h6 className="modal-title fw-bold text-dark mb-0">Pengajuan Paket</h6>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setConfirmModal({ open: false, planKey: null, planName: '' })}
                  ></button>
                </div>
                <div className="modal-body p-4 text-center">
                  <p className="text-muted small mb-3 text-start" style={{ fontSize: '0.82rem' }}>
                    Silakan hubungi WhatsApp Admin untuk mengajukan paket. Berikut detail pengajuan Anda:
                  </p>

                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className="btn btn-light rounded-pill flex-fill py-2 text-muted fw-semibold"
                      style={{ fontSize: '0.82rem' }}
                      onClick={() => setConfirmModal({ open: false, planKey: null, planName: '' })}
                    >
                      Batal
                    </button>
                    <a
                      href={getUpgradeWhatsAppUrl(confirmModal.planKey, storeName)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-success rounded-pill flex-fill py-2 fw-semibold shadow-xs text-decoration-none text-white text-center"
                      style={{ fontSize: '0.82rem' }}
                      onClick={() => setConfirmModal({ open: false, planKey: null, planName: '' })}
                    >
                      Kirim WhatsApp
                    </a>
                  </div>
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
                <div className="modal-header border-bottom px-4 pt-3.5 pb-3 bg-light">
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
                          <span className="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill px-2 py-0.5 fw-bold" style={{ fontSize: '0.72rem' }}>
                            Rp 20.000
                          </span>
                        </div>
                        <small className="text-muted" style={{ fontSize: '0.72rem' }}>Pesan kuota ke WhatsApp admin</small>
                      </div>
                      <span className="badge bg-success rounded-pill px-2.5 py-1">Pesan via WA</span>
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
                          <span className="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill px-2 py-0.5 fw-bold" style={{ fontSize: '0.72rem' }}>
                            Rp 25.000
                          </span>
                        </div>
                        <small className="text-muted" style={{ fontSize: '0.72rem' }}>Pesan kuota ke WhatsApp admin</small>
                      </div>
                      <span className="badge bg-success rounded-pill px-2.5 py-1">Pesan via WA</span>
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
                          <span className="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill px-2 py-0.5 fw-bold" style={{ fontSize: '0.72rem' }}>
                            Rp 50.000
                          </span>
                        </div>
                        <small className="text-muted" style={{ fontSize: '0.72rem' }}>Pesan kuota ke WhatsApp admin</small>
                      </div>
                      <span className="badge bg-success rounded-pill px-2.5 py-1">Pesan via WA</span>
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
