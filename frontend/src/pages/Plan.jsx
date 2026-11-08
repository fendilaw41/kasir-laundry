import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useLiveQuery } from 'dexie-react-hooks';
import { getSettingsQuery } from '../db/repositories/settings';
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
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [report, setReport] = useState(null);
  const [topupModalOpen, setTopupModalOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ open: false, planKey: null, planName: '' });

  const isOwner = user?.role === 'owner';

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
  }, []);

  const handleApplyPlan = async (planKey) => {
    if (!isOwner) {
      toast.error('Hanya akun Owner yang dapat mengubah paket langganan.');
      return;
    }

    setSubmitting(true);
    try {
      await applyPlan(planKey);
      toast.success(`Paket berhasil diubah ke ${PLAN_CONFIGS[planKey]?.name || planKey}! Fitur dan batas kuota langsung aktif.`);
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
  const currentPlan = PLAN_CONFIGS[currentPlanKey] || PLAN_CONFIGS.TRIAL;
  const usage = report?.usage || {};
  const trx = usage.transactions || {};
  const photos = usage.photos || {};
  const users = usage.users || {};
  const inv = usage.inventory || {};

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
                    <p className="text-white-50 small mb-0 mt-1 d-flex align-items-center gap-1.5" style={{ fontSize: '0.78rem' }}>
                      <i className="bi bi-calendar3"></i>
                      <span>
                        Siklus Bulanan s/d{' '}
                        <strong className="text-white">
                          {report?.currentPeriodEnd
                            ? new Date(report.currentPeriodEnd).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                              })
                            : '-'}
                        </strong>
                      </span>
                    </p>
                  </div>

                  <div className="text-end">
                    <div className="fs-5 fw-bold text-warning mb-1" style={{ letterSpacing: '-0.2px' }}>
                      {currentPlan.priceLabel}
                    </div>
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
              <div className="col-6 col-md-3">
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

              {/* Kuota Foto Chat */}
              <div className="col-6 col-md-3">
                <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100">
                  <div className="d-flex justify-content-between align-items-center mb-1.5">
                    <span className="text-muted small fw-medium" style={{ fontSize: '0.75rem' }}>Foto Chat</span>
                    <div
                      className="rounded-3 d-flex align-items-center justify-content-center"
                      style={{ width: '26px', height: '26px', backgroundColor: '#f5f3ff', color: '#7c3aed' }}
                    >
                      <i className="bi bi-images" style={{ fontSize: '0.8rem' }}></i>
                    </div>
                  </div>
                  <div className="fw-bold text-dark mb-1.5" style={{ fontSize: '1.25rem', letterSpacing: '-0.3px' }}>
                    {photos.used}{' '}
                    <span className="text-muted fw-normal" style={{ fontSize: '0.8rem' }}>
                      / {photos.totalLimit}
                    </span>
                  </div>
                  <div className="progress rounded-pill mb-1.5" style={{ height: '6px', backgroundColor: '#f1f5f9' }}>
                    <div
                      className="progress-bar rounded-pill"
                      style={{
                        width: `${photos.percentage}%`,
                        backgroundColor: getProgressColor(photos.percentage, photos.isExceeded),
                      }}
                    />
                  </div>
                  <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>
                    Retensi {photos.retentionDays} hari
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
                  <thead className="table-light border-bottom">
                    <tr>
                      <th className="py-3 px-3 text-dark fw-bold" style={{ position: 'sticky', left: 0, zIndex: 2, minWidth: '150px', width: '150px', backgroundColor: '#f8fafc', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                        Fitur
                      </th>
                      <th className="py-3 px-3 text-center text-dark fw-bold" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}>
                        Trial (Gratis)
                        <div className="small fw-normal text-muted" style={{ fontSize: '0.7rem' }}>Rp 0</div>
                      </th>
                      <th className="py-3 px-3 text-center text-dark fw-bold" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}>
                        Starter
                        <div className="small fw-normal text-muted" style={{ fontSize: '0.7rem' }}>25rb/bln</div>
                      </th>
                      <th className="py-3 px-3 text-center fw-bold bg-primary-subtle text-primary border-start border-end" style={{ minWidth: '135px', width: '135px', whiteSpace: 'nowrap' }}>
                        Basic ⭐
                        <div className="small fw-semibold text-primary" style={{ fontSize: '0.7rem' }}>50rb/bln (Laris)</div>
                      </th>
                      <th className="py-3 px-3 text-center text-dark fw-bold" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}>
                        Pro
                        <div className="small fw-normal text-muted" style={{ fontSize: '0.7rem' }}>100rb/bln</div>
                      </th>
                      <th className="py-3 px-3 text-center text-dark fw-bold" style={{ minWidth: '145px', width: '145px', whiteSpace: 'nowrap' }}>
                        Business
                        <div className="small fw-normal text-muted" style={{ fontSize: '0.7rem' }}>200rb/bln</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-3 py-2.5 fw-medium" style={{ position: 'sticky', left: 0, zIndex: 1, minWidth: '150px', width: '150px', backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                        Transaksi/bulan
                      </td>
                      <td className="text-center" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}>30</td>
                      <td className="text-center" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}>150</td>
                      <td className="text-center fw-bold bg-primary-subtle border-start border-end" style={{ minWidth: '135px', width: '135px', whiteSpace: 'nowrap' }}>400</td>
                      <td className="text-center" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}>1.000</td>
                      <td className="text-center" style={{ minWidth: '145px', width: '145px', whiteSpace: 'nowrap' }}>Unlimited* (3.000)</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 fw-medium" style={{ position: 'sticky', left: 0, zIndex: 1, minWidth: '150px', width: '150px', backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                        Foto chat/bulan
                      </td>
                      <td className="text-center" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}>30</td>
                      <td className="text-center" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}>300</td>
                      <td className="text-center fw-bold bg-primary-subtle border-start border-end" style={{ minWidth: '135px', width: '135px', whiteSpace: 'nowrap' }}>800</td>
                      <td className="text-center" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}>2.000</td>
                      <td className="text-center" style={{ minWidth: '145px', width: '145px', whiteSpace: 'nowrap' }}>5.000</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 fw-medium" style={{ position: 'sticky', left: 0, zIndex: 1, minWidth: '150px', width: '150px', backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                        Bot transaksi (chat)
                      </td>
                      <td className="text-center" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}>10x</td>
                      <td className="text-center text-muted opacity-40" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}><i className="bi bi-x-circle-fill"></i></td>
                      <td className="text-center fw-bold bg-primary-subtle border-start border-end" style={{ minWidth: '135px', width: '135px', whiteSpace: 'nowrap' }}>200x</td>
                      <td className="text-center" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}>1.000x</td>
                      <td className="text-center" style={{ minWidth: '145px', width: '145px', whiteSpace: 'nowrap' }}>Unlimited</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 fw-medium" style={{ position: 'sticky', left: 0, zIndex: 1, minWidth: '150px', width: '150px', backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                        Nota ke WhatsApp
                      </td>
                      <td className="text-center text-success" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}><i className="bi bi-check-circle-fill"></i></td>
                      <td className="text-center text-success" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}><i className="bi bi-check-circle-fill"></i></td>
                      <td className="text-center text-success bg-primary-subtle border-start border-end" style={{ minWidth: '135px', width: '135px', whiteSpace: 'nowrap' }}><i className="bi bi-check-circle-fill"></i></td>
                      <td className="text-center text-success" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}><i className="bi bi-check-circle-fill"></i></td>
                      <td className="text-center text-success" style={{ minWidth: '145px', width: '145px', whiteSpace: 'nowrap' }}><i className="bi bi-check-circle-fill"></i></td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 fw-medium" style={{ position: 'sticky', left: 0, zIndex: 1, minWidth: '150px', width: '150px', backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                        Cetak nota
                      </td>
                      <td className="text-center text-success" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}><i className="bi bi-check-circle-fill"></i></td>
                      <td className="text-center text-success" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}><i className="bi bi-check-circle-fill"></i></td>
                      <td className="text-center text-success bg-primary-subtle border-start border-end" style={{ minWidth: '135px', width: '135px', whiteSpace: 'nowrap' }}><i className="bi bi-check-circle-fill"></i></td>
                      <td className="text-center text-success" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}><i className="bi bi-check-circle-fill"></i></td>
                      <td className="text-center text-success" style={{ minWidth: '145px', width: '145px', whiteSpace: 'nowrap' }}><i className="bi bi-check-circle-fill"></i></td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 fw-medium" style={{ position: 'sticky', left: 0, zIndex: 1, minWidth: '150px', width: '150px', backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                        Invoice PDF
                      </td>
                      <td className="text-center text-muted opacity-40" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}><i className="bi bi-x-circle-fill"></i></td>
                      <td className="text-center" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}>20/bln</td>
                      <td className="text-center fw-bold bg-primary-subtle border-start border-end" style={{ minWidth: '135px', width: '135px', whiteSpace: 'nowrap' }}>100/bln</td>
                      <td className="text-center" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}>Unlimited</td>
                      <td className="text-center" style={{ minWidth: '145px', width: '145px', whiteSpace: 'nowrap' }}>Unlimited + logo</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 fw-medium" style={{ position: 'sticky', left: 0, zIndex: 1, minWidth: '150px', width: '150px', backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                        Lacak order link
                      </td>
                      <td className="text-center text-muted" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}>Ada watermark</td>
                      <td className="text-center text-muted" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}>Ada watermark</td>
                      <td className="text-center text-success fw-medium bg-primary-subtle border-start border-end" style={{ minWidth: '135px', width: '135px', whiteSpace: 'nowrap' }}>Tanpa watermark</td>
                      <td className="text-center text-success" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}>Tanpa watermark</td>
                      <td className="text-center text-success" style={{ minWidth: '145px', width: '145px', whiteSpace: 'nowrap' }}>+ Tampilan custom</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 fw-medium" style={{ position: 'sticky', left: 0, zIndex: 1, minWidth: '150px', width: '150px', backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                        Stok bahan
                      </td>
                      <td className="text-center text-muted opacity-40" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}><i className="bi bi-x-circle-fill"></i></td>
                      <td className="text-center" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}>5 item</td>
                      <td className="text-center fw-bold bg-primary-subtle border-start border-end" style={{ minWidth: '135px', width: '135px', whiteSpace: 'nowrap' }}>20 item</td>
                      <td className="text-center" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}>50 item</td>
                      <td className="text-center" style={{ minWidth: '145px', width: '145px', whiteSpace: 'nowrap' }}>Unlimited</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 fw-medium" style={{ position: 'sticky', left: 0, zIndex: 1, minWidth: '150px', width: '150px', backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                        Notifikasi stok menipis
                      </td>
                      <td className="text-center text-muted opacity-40" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}><i className="bi bi-x-circle-fill"></i></td>
                      <td className="text-center text-muted opacity-40" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}><i className="bi bi-x-circle-fill"></i></td>
                      <td className="text-center text-success bg-primary-subtle border-start border-end" style={{ minWidth: '135px', width: '135px', whiteSpace: 'nowrap' }}><i className="bi bi-check-circle-fill"></i></td>
                      <td className="text-center text-success" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}><i className="bi bi-check-circle-fill"></i></td>
                      <td className="text-center text-success" style={{ minWidth: '145px', width: '145px', whiteSpace: 'nowrap' }}><i className="bi bi-check-circle-fill"></i></td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 fw-medium" style={{ position: 'sticky', left: 0, zIndex: 1, minWidth: '150px', width: '150px', backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                        Jumlah outlet
                      </td>
                      <td className="text-center" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}>1</td>
                      <td className="text-center" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}>1</td>
                      <td className="text-center fw-bold bg-primary-subtle border-start border-end" style={{ minWidth: '135px', width: '135px', whiteSpace: 'nowrap' }}>1</td>
                      <td className="text-center" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}>2</td>
                      <td className="text-center" style={{ minWidth: '145px', width: '145px', whiteSpace: 'nowrap' }}>5</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 fw-medium" style={{ position: 'sticky', left: 0, zIndex: 1, minWidth: '150px', width: '150px', backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                        Jumlah kasir/user
                      </td>
                      <td className="text-center" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}>1</td>
                      <td className="text-center" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}>2</td>
                      <td className="text-center fw-bold bg-primary-subtle border-start border-end" style={{ minWidth: '135px', width: '135px', whiteSpace: 'nowrap' }}>3</td>
                      <td className="text-center" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}>5</td>
                      <td className="text-center" style={{ minWidth: '145px', width: '145px', whiteSpace: 'nowrap' }}>15</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 fw-medium" style={{ position: 'sticky', left: 0, zIndex: 1, minWidth: '150px', width: '150px', backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                        Riwayat data
                      </td>
                      <td className="text-center" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}>1 bulan</td>
                      <td className="text-center" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}>3 bulan</td>
                      <td className="text-center fw-bold bg-primary-subtle border-start border-end" style={{ minWidth: '135px', width: '135px', whiteSpace: 'nowrap' }}>6 bulan</td>
                      <td className="text-center" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}>12 bulan</td>
                      <td className="text-center" style={{ minWidth: '145px', width: '145px', whiteSpace: 'nowrap' }}>24 bulan</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 fw-medium" style={{ position: 'sticky', left: 0, zIndex: 1, minWidth: '150px', width: '150px', backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                        Foto disimpan
                      </td>
                      <td className="text-center" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}>30 hari</td>
                      <td className="text-center" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}>60 hari</td>
                      <td className="text-center fw-bold bg-primary-subtle border-start border-end" style={{ minWidth: '135px', width: '135px', whiteSpace: 'nowrap' }}>90 hari</td>
                      <td className="text-center" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}>180 hari</td>
                      <td className="text-center" style={{ minWidth: '145px', width: '145px', whiteSpace: 'nowrap' }}>365 hari</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 fw-medium" style={{ position: 'sticky', left: 0, zIndex: 1, minWidth: '150px', width: '150px', backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                        Tipe Support
                      </td>
                      <td className="text-center" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}>Panduan</td>
                      <td className="text-center" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}>Komunitas</td>
                      <td className="text-center fw-bold bg-primary-subtle border-start border-end" style={{ minWidth: '135px', width: '135px', whiteSpace: 'nowrap' }}>Chat</td>
                      <td className="text-center" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}>Prioritas</td>
                      <td className="text-center" style={{ minWidth: '145px', width: '145px', whiteSpace: 'nowrap' }}>Prioritas + Onboard</td>
                    </tr>
                  </tbody>
                  <tfoot className="table-light border-top">
                    <tr>
                      <td className="px-3 py-3 fw-bold" style={{ position: 'sticky', left: 0, zIndex: 2, minWidth: '150px', width: '150px', backgroundColor: '#f8fafc', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                        Aksi Langganan
                      </td>
                      {/* TRIAL */}
                      <td className="text-center py-3 px-2" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary text-white rounded-pill px-3 py-1 fw-semibold text-nowrap shadow-xs"
                          style={{ fontSize: '0.74rem' }}
                          onClick={() => setConfirmModal({ open: true, planKey: 'TRIAL', planName: 'Trial (Gratis)' })}
                        >
                          Terapkan
                        </button>
                      </td>
                      {/* STARTER */}
                      <td className="text-center py-3 px-2" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary text-white rounded-pill px-3 py-1 fw-semibold text-nowrap shadow-xs"
                          style={{ fontSize: '0.74rem' }}
                          onClick={() => setConfirmModal({ open: true, planKey: 'STARTER', planName: 'Starter 25rb' })}
                        >
                          Terapkan
                        </button>
                      </td>
                      {/* BASIC */}
                      <td className="text-center py-3 px-2 bg-primary-subtle border-start border-end" style={{ minWidth: '135px', width: '135px', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary text-white rounded-pill px-3 py-1 fw-semibold text-nowrap shadow-xs"
                          style={{ fontSize: '0.74rem' }}
                          onClick={() => setConfirmModal({ open: true, planKey: 'BASIC', planName: 'Basic 50rb ⭐' })}
                        >
                          Terapkan
                        </button>
                      </td>
                      {/* PRO */}
                      <td className="text-center py-3 px-2" style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary text-white rounded-pill px-3 py-1 fw-semibold text-nowrap shadow-xs"
                          style={{ fontSize: '0.74rem' }}
                          onClick={() => setConfirmModal({ open: true, planKey: 'PRO', planName: 'Pro 100rb' })}
                        >
                          Terapkan
                        </button>
                      </td>
                      {/* BUSINESS */}
                      <td className="text-center py-3 px-2" style={{ minWidth: '145px', width: '145px', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary text-white rounded-pill px-3 py-1 fw-semibold text-nowrap shadow-xs"
                          style={{ fontSize: '0.74rem' }}
                          onClick={() => setConfirmModal({ open: true, planKey: 'BUSINESS', planName: 'Business 200rb' })}
                        >
                          Terapkan
                        </button>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* MODAL KONFIRMASI PENERAPAN PAKET LANGSUNG */}
      {confirmModal.open && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1060 }} onClick={() => setConfirmModal({ open: false, planKey: null, planName: '' })}></div>
          <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1065 }}>
            <div className="modal-dialog modal-dialog-centered mx-auto px-3" style={{ maxWidth: '400px' }}>
              <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                <div className="modal-body p-4 text-center">
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3 text-primary"
                    style={{ width: '56px', height: '56px', backgroundColor: '#eff6ff' }}
                  >
                    <i className="bi bi-patch-check fs-2"></i>
                  </div>
                  <h6 className="fw-bold text-dark mb-1">Terapkan {confirmModal.planName}?</h6>
                  <p className="text-muted small mb-4" style={{ fontSize: '0.8rem' }}>
                    Sistem akan langsung menerapkan kuota transaksi, foto chat, batas kasir, dan fitur sesuai spesifikasi paket ini pada toko Anda.
                  </p>

                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className="btn btn-light rounded-pill flex-fill py-2 text-muted fw-semibold"
                      style={{ fontSize: '0.8rem' }}
                      disabled={submitting}
                      onClick={() => setConfirmModal({ open: false, planKey: null, planName: '' })}
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary rounded-pill flex-fill py-2 fw-semibold shadow-xs"
                      style={{ fontSize: '0.8rem' }}
                      disabled={submitting}
                      onClick={() => handleApplyPlan(confirmModal.planKey)}
                    >
                      {submitting ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                          <span>Menerapkan...</span>
                        </>
                      ) : (
                        'Ya, Terapkan Sekarang'
                      )}
                    </button>
                  </div>

                  <div className="mt-3 pt-2 border-top">
                    <a
                      href={getUpgradeWhatsAppUrl(confirmModal.planKey, settings?.namaLaundry)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-decoration-none small text-muted d-inline-flex align-items-center gap-1"
                      style={{ fontSize: '0.72rem' }}
                    >
                      <i className="bi bi-whatsapp text-success"></i>
                      <span>Ingin konfirmasi pembayaran via WhatsApp? Klik di sini</span>
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
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center bg-warning text-dark"
                      style={{ width: '28px', height: '28px' }}
                    >
                      <i className="bi bi-lightning-charge-fill" style={{ fontSize: '0.85rem' }}></i>
                    </div>
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
                      style={{ backgroundColor: '#f8fafc', cursor: submitting ? 'not-allowed' : 'pointer' }}
                      onClick={() => !submitting && handleInstantTopup('TRANSACTIONS', 50)}
                    >
                      <div>
                        <div className="fw-bold text-dark" style={{ fontSize: '0.85rem' }}>+50 Kuota Transaksi</div>
                        <small className="text-muted" style={{ fontSize: '0.72rem' }}>Klik untuk langsung terapkan ke toko</small>
                      </div>
                      <span className="badge bg-primary rounded-pill px-2.5 py-1">Terapkan</span>
                    </div>

                    <div
                      className="p-3 rounded-3 text-start d-flex justify-content-between align-items-center border transition-all"
                      style={{ backgroundColor: '#f8fafc', cursor: submitting ? 'not-allowed' : 'pointer' }}
                      onClick={() => !submitting && handleInstantTopup('TRANSACTIONS', 150)}
                    >
                      <div>
                        <div className="fw-bold text-dark" style={{ fontSize: '0.85rem' }}>+150 Kuota Transaksi</div>
                        <small className="text-muted" style={{ fontSize: '0.72rem' }}>Klik untuk langsung terapkan ke toko</small>
                      </div>
                      <span className="badge bg-primary rounded-pill px-2.5 py-1">Terapkan</span>
                    </div>

                    <div
                      className="p-3 rounded-3 text-start d-flex justify-content-between align-items-center border transition-all"
                      style={{ backgroundColor: '#f8fafc', cursor: submitting ? 'not-allowed' : 'pointer' }}
                      onClick={() => !submitting && handleInstantTopup('PHOTOS', 200)}
                    >
                      <div>
                        <div className="fw-bold text-dark" style={{ fontSize: '0.85rem' }}>+200 Foto Chat</div>
                        <small className="text-muted" style={{ fontSize: '0.72rem' }}>Klik untuk langsung terapkan ke toko</small>
                      </div>
                      <span className="badge bg-primary rounded-pill px-2.5 py-1">Terapkan</span>
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-top bg-light px-4 py-2.5">
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary rounded-pill px-3.5"
                    style={{ fontSize: '0.78rem' }}
                    onClick={() => setTopupModalOpen(false)}
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
