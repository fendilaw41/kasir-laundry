import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useHome } from './hooks/useHome';
import { TOAST_MESSAGES, CONFIRM_MESSAGES, BUTTON_TEXT, BUTTON_TITLE } from '../constants/appConstants';
import { Skeleton, CustomerListSkeleton, InventoryListSkeleton } from '../components/common/Skeleton';
import { useLiveQuery } from 'dexie-react-hooks';
import { getSettingsQuery } from '../db/repositories/settings';
import { getSubscriptionReport, isSubscriptionEnabled, isUpgradeBannerEnabled, isTrialExpired } from '../services/subscriptionService';
import PlanGateModal from '../components/PlanGateModal';

const Home = ({ user }) => {
  const navigate = useNavigate();
  const [subReport, setSubReport] = useState(null);
  const [gateModal, setGateModal] = useState({ open: false, type: 'TRANSACTION_LIMIT', data: {} });
  useEffect(() => {
    getSubscriptionReport().then(setSubReport).catch(() => {});
  }, []);

  const settings = useLiveQuery(getSettingsQuery);
  const {
    showPelangganModal, setShowPelangganModal,
    showInventoryModal, setShowInventoryModal,
    showSearchOrderModal, setShowSearchOrderModal,
    searchOrderQuery, setSearchOrderQuery,
    searchOrderResults,
    showOmzet, setShowOmzet,
    confirmModal, setConfirmModal,
    editPelanggan, setEditPelanggan,
    newPelanggan, setNewPelanggan,
    inventory, pelangganList,
    searchPelanggan, setSearchPelanggan,
    searchInventory, setSearchInventory,
    inventoryTab, setInventoryTab,
    handleUpdateStok, handleApproveInventory, handleRejectInventory,
    stats, handleSelectPelanggan, handleAddPelanggan, handleDeletePelanggan,
    updatePelanggan, addInventoryManual
  } = useHome();

  return (
    <div className="home-wrapper pb-5">
      {/* Modal Konfirmasi Bawaan */}
      {confirmModal.show && (
        <>
          <div className="modal-backdrop fade show" style={{ backdropFilter: 'blur(5px)', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1075 }}></div>
          <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1080 }}>
            <div className="modal-dialog modal-dialog-centered mx-auto" style={{ maxWidth: '320px' }}>
              <div className="modal-content border-0 shadow-lg text-center p-4" style={{ borderRadius: '24px' }}>
                <h6 className="fw-bold mb-2">Konfirmasi</h6>
                <p className="text-muted small mb-4" style={{ whiteSpace: 'pre-wrap' }}>{confirmModal.message}</p>
                <div className="d-flex gap-2">
                  <button className="btn btn-outline-primary rounded-pill flex-fill fw-bold" onClick={() => setConfirmModal({ show: false, message: '', onConfirm: null })}>Batal</button>
                  <button className="btn btn-outline-primary rounded-pill flex-fill fw-bold" onClick={confirmModal.onConfirm}>Ya, Lanjutkan</button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Top Background Section (ShopeePay Style) */}
      <div style={{ background: 'linear-gradient(135deg, #0134d4 0%, #2855e1 100%)', padding: '24px 20px 65px 20px', borderBottomLeftRadius: '32px', borderBottomRightRadius: '32px' }}>
        {/* Header Compact */}
        <div className="d-flex justify-content-between align-items-center mb-0">
          <div
            className="d-flex align-items-center"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/setting?tab=umum')}
            title="Profil Laundry & Pengaturan"
          >
            <div className="bg-white text-primary rounded-circle d-flex align-items-center justify-content-center me-3 shadow-sm flex-shrink-0" style={{ width: '48px', height: '48px' }}>
              <i className="bi bi-person-fill fs-3"></i>
            </div>
            <div>
              <h5 className="fw-bold mb-0 text-white">{user.fullname} &nbsp;
                {
                  user.role === 'owner' ? <i className="bi bi-patch-check-fill me-1 align-items-center shadow-sm"></i>
                    : ''
                }
              </h5>
              <small className="text-white opacity-75 d-flex align-items-center gap-1">
                <span>@{user.username}</span>
              </small>
            </div>
          </div>

          {/* Nama Toko & Kode Toko Paling Kanan */}
          <div
            className="text-end text-white ps-2"
            style={{ cursor: 'pointer', maxWidth: '170px' }}
            onClick={() => navigate('/setting?tab=umum')}
            title="Profil Toko & Pengaturan"
          >
            <div className="fw-bold text-truncate" style={{ fontSize: '0.88rem', lineHeight: '1.2' }}>
              <i className="bi bi-shop me-1 text-white-50"></i>
              {settings?.namaLaundry || 'KASIR LAUNDRY'}
            </div>
            <div className="mt-1">
              <span
                className="badge rounded-pill px-2 py-0.5 fw-semibold font-monospace"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.22)',
                  backdropFilter: 'blur(4px)',
                  fontSize: '0.68rem',
                  letterSpacing: '0.5px',
                  color: '#ffffff'
                }}
              >
                {settings?.storeCode || user?.storeCode || 'STORE'}
              </span>
            </div>
          </div>
        </div>
      </div >

      {/* Overlapping Cards (Omzet & Status) */}
      < div style={{ marginTop: '-45px', position: 'relative', zIndex: 5 }}>
        <div className="row g-2 px-3">
          {/* Omzet Card */}
          <div className="col-6">
            <div className="card shadow-sm border-0 h-100 position-relative" style={{ borderRadius: '16px', background: '#fff' }}>
              <i
                className={`bi ${showOmzet ? 'bi-eye-slash' : 'bi-eye'} text-muted position-absolute`}
                style={{ top: '12px', right: '12px', cursor: 'pointer', fontSize: '1rem', zIndex: 10 }}
                onClick={() => setShowOmzet(!showOmzet)}
              ></i>
              <Link to="/reports?today=true" className="text-decoration-none text-dark h-100">
                <div className="card-body p-3">
                  <div className="d-flex align-items-center mb-1">
                    <i className="bi bi-wallet2 text-success me-2"></i>
                    <small className="text-muted fw-bold" style={{ fontSize: '0.7rem' }}>Omzet</small>
                  </div>
                  <h6 className="fw-bold mb-0 text-dark mt-2" style={{ letterSpacing: '-0.5px' }}>
                    {stats === undefined ? (
                      <Skeleton width="90px" height="18px" />
                    ) : showOmzet ? (
                      `Rp ${stats?.totalOmzet.toLocaleString() || 0}`
                    ) : (
                      'Rp ••••••'
                    )}
                  </h6>
                </div>
              </Link>
            </div>
          </div>
          {/* Status Order Card */}
          <div className="col-6">
            <div className="card shadow-sm border-0 h-100" style={{ borderRadius: '16px', background: '#fff' }}>
              <div className="card-body p-3">
                <div className="d-flex align-items-center mb-1">
                  <i className="bi bi-clipboard-data text-primary me-2"></i>
                  <small className="text-muted fw-bold" style={{ fontSize: '0.7rem' }}>Status</small>
                </div>
                <div className="d-flex justify-content-between mt-2">
                  <div className="text-center">
                    <h6 className="fw-bold mb-0 text-dark">
                      {stats === undefined ? <Skeleton width="24px" height="18px" /> : (stats?.pendingOrders || 0)}
                    </h6>
                    <small className="text-muted" style={{ fontSize: '0.65rem' }}>Proses</small>
                  </div>
                  <div className="text-center">
                    <h6 className="fw-bold mb-0 text-dark">
                      {stats === undefined ? <Skeleton width="24px" height="18px" /> : (stats?.readyToPickUp || 0)}
                    </h6>
                    <small className="text-muted" style={{ fontSize: '0.65rem' }}>Siap</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div >

      {/* Grid Menu Icons (White Area) */}
      < div className="card shadow-sm border-0 mt-4 mx-3" style={{ borderRadius: '20px', background: '#fff' }}>
        <div className="card-body p-4">
          <div className="row g-2 text-center align-items-start">

            {/* Proses */}
            <div className="col-3">
              <Link to="/orders?tab=Proses" className="text-decoration-none customer-card-clickable d-block">
                <div className="mx-auto text-primary rounded-1 d-flex align-items-center justify-content-center mb-2 shadow-sm flex-shrink-0" style={{ width: '45px', height: '45px', backgroundColor: '#fff', border: '1px solid #bbdefb' }}>
                  <i className="bi bi-bag-check fs-5"></i>
                </div>
                <span className="d-block text-nowrap" style={{ fontSize: '0.65rem', lineHeight: '1.2', color: '#4a4a4a', overflow: 'hidden', textOverflow: 'ellipsis' }}>Order<br />Proses</span>
              </Link>
            </div>

            {/* Siap Ambil */}
            <div className="col-3">
              <Link to="/orders?tab=Selesai" className="text-decoration-none customer-card-clickable d-block">
                <div className="mx-auto text-primary rounded-1 border-1 d-flex align-items-center justify-content-center mb-2 shadow-sm flex-shrink-0" style={{ width: '45px', height: '45px', backgroundColor: '#fff', border: '1px solid #bbdefb' }}>
                  <i className="bi bi-box-seam fs-5"></i>
                </div>
                <span className="d-block text-nowrap" style={{ fontSize: '0.65rem', lineHeight: '1.2', color: '#4a4a4a', overflow: 'hidden', textOverflow: 'ellipsis' }}>Siap<br />Ambil</span>
              </Link>
            </div>

            {/* Inventory */}
            <div className="col-3">
              <div
                className="text-decoration-none customer-card-clickable d-block"
                onClick={() => {
                  if (isSubscriptionEnabled() && subReport?.limits?.maxStockItems === 0) {
                    setGateModal({ open: true, type: 'STOCK_LOCKED', data: { plan: subReport?.plan } });
                    return;
                  }
                  setShowInventoryModal(true);
                }}
                style={{ cursor: 'pointer' }}
              >
                <div className="mx-auto text-primary rounded-1 d-flex align-items-center justify-content-center mb-2 shadow-sm flex-shrink-0" style={{ width: '45px', height: '45px', backgroundColor: '#fff', border: '1px solid #bbdefb' }}>
                  <i className="bi bi-archive fs-5"></i>
                </div>
                <span className="d-block text-nowrap" style={{ fontSize: '0.65rem', lineHeight: '1.2', color: '#4a4a4a', overflow: 'hidden', textOverflow: 'ellipsis' }}>Stok</span>
              </div>
            </div>

            {/* Pelanggan */}
            <div className="col-3">
              <div className="text-decoration-none customer-card-clickable d-block" onClick={() => setShowPelangganModal(true)} style={{ cursor: 'pointer' }}>
                <div className="mx-auto text-primary rounded-1 d-flex align-items-center justify-content-center mb-2 shadow-sm flex-shrink-0" style={{ width: '45px', height: '45px', backgroundColor: '#fff', border: '1px solid #bbdefb' }}>
                  <i className="bi bi-people fs-5"></i>
                </div>
                <span className="d-block text-nowrap" style={{ fontSize: '0.65rem', lineHeight: '1.2', color: '#4a4a4a', overflow: 'hidden', textOverflow: 'ellipsis' }}>Cust.</span>
              </div>
            </div>

            {/* Report */}
            <div className="col-3">
              <Link to="/reports" className="text-decoration-none customer-card-clickable d-block">
                <div className="mx-auto text-primary rounded-1 d-flex align-items-center justify-content-center mb-2 shadow-sm flex-shrink-0" style={{ width: '45px', height: '45px', backgroundColor: '#fff', border: '1px solid #bbdefb' }}>
                  <i className="bi bi-bar-chart-fill fs-5"></i>
                </div>
                <span className="d-block text-nowrap" style={{ fontSize: '0.65rem', lineHeight: '1.2', color: '#4a4a4a', overflow: 'hidden', textOverflow: 'ellipsis' }}>Laporan</span>
              </Link>
            </div>

            {/* Setting */}
            <div className="col-3">
              <Link to="/setting" className="text-decoration-none customer-card-clickable d-block">
                <div className="mx-auto text-primary rounded-1 d-flex align-items-center justify-content-center mb-2 shadow-sm flex-shrink-0" style={{ width: '45px', height: '45px', backgroundColor: '#fff', border: '1px solid #bbdefb' }}>
                  <i className="bi bi-gear-fill fs-5"></i>
                </div>
                <span className="d-block text-nowrap" style={{ fontSize: '0.65rem', lineHeight: '1.2', color: '#4a4a4a', overflow: 'hidden', textOverflow: 'ellipsis' }}>Setting</span>
              </Link>
            </div>

            {/* Layanan (Hanya Owner) */}
            {user?.role === 'owner' && (
              <div className="col-3">
                <Link to="/setting?tab=product" className="text-decoration-none customer-card-clickable d-block">
                  <div className="mx-auto text-primary rounded-1 d-flex align-items-center justify-content-center mb-2 shadow-sm flex-shrink-0" style={{ width: '45px', height: '45px', backgroundColor: '#fff', border: '1px solid #bbdefb' }}>
                    <i className="bi bi-grid fs-5"></i>
                  </div>
                  <span className="d-block text-nowrap" style={{ fontSize: '0.65rem', lineHeight: '1.2', color: '#4a4a4a', overflow: 'hidden', textOverflow: 'ellipsis' }}>Layanan</span>
                </Link>
              </div>
            )}

            {/* Plan / Paket (Hanya jika fitur langganan aktif & akun Owner) */}
            {isSubscriptionEnabled() && user?.role === 'owner' && (
              <div className="col-3">
                <Link to="/plan" className="text-decoration-none customer-card-clickable d-block">
                  <div className="mx-auto text-primary rounded-1 d-flex align-items-center justify-content-center mb-2 shadow-sm flex-shrink-0" style={{ width: '45px', height: '45px', backgroundColor: '#fff', border: '1px solid #bbdefb' }}>
                    <i className="bi bi-gem text-warning fs-5"></i>
                  </div>
                  <span className="d-block text-nowrap" style={{ fontSize: '0.65rem', lineHeight: '1.2', color: '#4a4a4a', overflow: 'hidden', textOverflow: 'ellipsis' }}>Plan</span>
                </Link>
              </div>
            )}

          </div>
        </div>
      </div >

            {/* Peringatan Kuota 80% */}
      {isUpgradeBannerEnabled() && subReport?.usage?.transactions?.isWarning && (
        <div
          className="alert alert-warning border-0 shadow-sm d-flex align-items-center justify-content-between mx-3 mt-3"
          style={{ borderRadius: '12px', cursor: 'pointer' }}
          onClick={() => navigate('/plan')}
        >
          <div className="d-flex align-items-center">
            <i className="bi bi-speedometer2 fs-4 me-3 text-warning"></i>
            <div>
              <h6 className="alert-heading mb-0 fw-bold">Kuota Transaksi Terpakai {subReport.usage.transactions.percentage}%</h6>
              <p className="small mb-0 opacity-85">
                Sisa kuota: {subReport.usage.transactions.remaining} transaksi. Klik untuk opsi top-up atau upgrade.
              </p>
            </div>
          </div>
          <span className="badge bg-warning text-dark rounded-pill px-2.5 py-1">Upgrade</span>
        </div>
      )}

      {/* Batas Kuota 100% Tercapai */}
      {isUpgradeBannerEnabled() && subReport?.usage?.transactions?.isExceeded && (
        <div
          className="alert alert-danger border-0 shadow-sm d-flex align-items-center justify-content-between mx-3 mt-3 text-white"
          style={{ borderRadius: '12px', cursor: 'pointer', backgroundColor: '#dc2626' }}
          onClick={() => navigate('/plan')}
        >
          <div className="d-flex align-items-center">
            <i className="bi bi-shield-fill-exclamation fs-4 me-3"></i>
            <div>
              <h6 className="alert-heading mb-0 fw-bold text-white">Batas Transaksi Tercapai (100%)</h6>
              <p className="small mb-0 opacity-90 text-white">
                Transaksi baru dibatasi. Data lama tetap aman. Klik untuk buka opsi top-up.
              </p>
            </div>
          </div>
          <span className="badge bg-white text-danger rounded-pill px-2.5 py-1">Top-up</span>
        </div>
      )}

      {/* Order dalam Proses Alert */}
      {
        stats?.pendingOrders > 0 && (
          <div className="alert alert-warning border-0 shadow-sm d-flex align-items-center mx-3 mt-3" style={{ borderRadius: '12px' }}>
            <i className="bi bi-exclamation-triangle-fill fs-4 me-3"></i>
            <div>
              <h6 className="alert-heading mb-1 fw-bold">Ada {stats.pendingOrders} Order Tertunda</h6>
              <p className="small mb-0">Segera selesaikan pengerjaan laundry hari ini.</p>
            </div>
          </div>
        )
      }

      {/* Inventory Pending Alert (Khusus Owner) */}
      {
        user?.role === 'owner' && inventory?.filter(i => i.status === 'pending').length > 0 && (
          <div
            className="alert alert-info border-0 shadow-sm d-flex align-items-center mx-3 mt-3"
            style={{ borderRadius: '12px', cursor: 'pointer', backgroundColor: '#e0f2fe', color: '#0369a1' }}
            onClick={() => {
              setInventoryTab('pending');
              setShowInventoryModal(true);
            }}
          >
            <i className="bi bi-box-seam fs-4 me-3 text-primary"></i>
            <div className="flex-grow-1">
              <h6 className="alert-heading mb-1 fw-bold text-primary">Ada {inventory.filter(i => i.status === 'pending').length} Pengajuan Stok</h6>
              <p className="small mb-0 opacity-85 text-dark">
                Pengajuan oleh kasir: <strong className="text-primary">{Array.from(new Set(inventory.filter(i => i.status === 'pending').map(i => i.createdBy || 'Kasir'))).join(', ')}</strong>. Klik untuk meninjau dan menyetujui.
              </p>
            </div>
          </div>
        )
      }

      {/* Modal Pelanggan (Search & Add) */}
      {
        showPelangganModal && (
          <>
            <div className="modal-backdrop fade show" style={{ backdropFilter: 'blur(15px)', backgroundColor: 'rgba(255,255,255,0.7)' }}></div>
            <div className="modal fade show d-block" tabIndex="-1">
              <div
                className="modal-dialog modal-dialog-centered modal-dialog-scrollable w-100 px-2 px-sm-3 my-2"
                style={{ maxWidth: '100%', width: '100%' }}
              >
                <div
                  className="modal-content border-0 shadow-lg w-100"
                  style={{ borderRadius: '24px', height: '92vh', width: '100%' }}
                >
                  <div className="modal-header border-0 pb-0 pt-4 px-4">
                    <div>
                      <h5 className="fw-bold mb-0 text-success">Data Pelanggan</h5>
                      <small className="text-muted">Manajemen pelanggan laundry anda</small>
                    </div>
                    <button type="button" className="btn-close" onClick={() => setShowPelangganModal(false)}></button>
                  </div>
                  <div className="modal-body p-3 p-sm-4">
                    {/* Form Tambah Baru (Collapsible) */}
                    <div className="mb-4">
                      <button className="btn btn-outline-primary w-100 rounded-pill fw-bold py-2 mb-3 shadow-sm" type="button" data-bs-toggle="collapse" data-bs-target="#collapseAddPelanggan" title={BUTTON_TITLE.ADD}>
                        <i className="bi bi-plus-lg"></i>
                      </button>
                      <div className="collapse" id="collapseAddPelanggan">
                        <div className="card card-body border-0 bg-light rounded-4 p-3 mb-3 shadow-inner">
                          <form onSubmit={(e) => {
                            if (isSubscriptionEnabled() && subReport?.isExpired) {
                              e.preventDefault();
                              setGateModal({
                                open: true,
                                type: isTrialExpired(subReport) ? 'TRIAL_EXPIRED' : 'SUBSCRIPTION_EXPIRED',
                                data: { plan: subReport?.plan, isTrial: isTrialExpired(subReport) },
                              });
                              return;
                            }
                            handleAddPelanggan(e);
                          }}>
                            <div className="mb-2">
                              <input type="text" className="form-control border-0 py-2 rounded-3" placeholder="Nama Lengkap" value={newPelanggan.nama} onChange={(e) => setNewPelanggan({ ...newPelanggan, nama: e.target.value })} required />
                            </div>
                            <div className="mb-2">
                              <input type="tel" className="form-control border-0 py-2 rounded-3" placeholder="No. WhatsApp" value={newPelanggan.hp} onChange={(e) => setNewPelanggan({ ...newPelanggan, hp: e.target.value })} required />
                            </div>
                            <div className="mb-3">
                              <textarea className="form-control border-0 py-2 rounded-3" placeholder="Alamat (Kota)" rows="2" value={newPelanggan.alamat} onChange={(e) => setNewPelanggan({ ...newPelanggan, alamat: e.target.value })}></textarea>
                            </div>
                            <button type="submit" className="btn btn-outline-primary w-100 rounded-pill fw-bold shadow-sm">{BUTTON_TEXT.SAVE}</button>
                          </form>
                        </div>
                      </div>
                    </div>

                    {/* Search Bar */}
                    <div className="position-relative mb-4">
                      <i className="bi bi-search position-absolute top-50 start-0 translate-middle-y ms-3 text-muted opacity-50"></i>
                      <input
                        type="text"
                        className="form-control ps-5 border-0 bg-light rounded-pill py-2"
                        placeholder="Cari nama atau no. whatsapp..."
                        value={searchPelanggan}
                        onChange={(e) => setSearchPelanggan(e.target.value)}
                      />
                    </div>

                    {/* List Pelanggan Terdaftar */}
                    <div className="pelanggan-list">
                      {pelangganList === undefined ? (
                        <CustomerListSkeleton count={4} />
                      ) : pelangganList.filter(p =>
                        p.nama.toLowerCase().includes(searchPelanggan.toLowerCase()) ||
                        p.hp.includes(searchPelanggan)
                      ).length === 0 ? (
                        <div className="text-center py-5">
                          <i className="bi bi-people text-muted opacity-25" style={{ fontSize: '3rem' }}></i>
                          <p className="text-muted small mt-2">Tidak ada pelanggan ditemukan</p>
                        </div>
                      ) : (
                        pelangganList?.filter(p =>
                          p.nama.toLowerCase().includes(searchPelanggan.toLowerCase()) ||
                          p.hp.includes(searchPelanggan)
                        ).sort((a, b) => b.id - a.id).map(p => (
                          <div
                            key={p.id}
                            className="card border-0 mb-3 rounded-4 shadow-sm customer-card-clickable"
                            style={{ background: '#fff', cursor: 'pointer', transition: 'all 0.2s ease' }}
                            onClick={() => handleSelectPelanggan(p)}
                          >
                            <div className="card-body p-3 d-flex align-items-center">
                              <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold text-white me-3"
                                style={{ width: '48px', height: '48px', background: 'linear-gradient(135deg, #0134d4 0%, #2855e1 100%)', fontSize: '1.2rem', boxShadow: '0 4px 10px rgba(1, 52, 212, 0.2)' }}>
                                {p.nama.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-grow-1 overflow-hidden" onClick={() => handleSelectPelanggan(p)}>
                                <h6 className="mb-0 fw-bold text-dark text-truncate">{p.nama}</h6>
                                <div className="text-muted d-flex align-items-center gap-1" style={{ fontSize: '0.75rem' }}>
                                  <i className="bi bi-whatsapp text-success flex-shrink-0"></i>
                                  <span className="text-truncate">{p.hp}</span>
                                </div>
                              </div>
                              <div className="ms-1 d-flex gap-1 flex-shrink-0">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-light rounded-circle shadow-sm d-flex align-items-center justify-content-center"
                                  style={{ width: '32px', height: '32px' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isSubscriptionEnabled() && subReport?.isExpired) {
                                      setGateModal({
                                        open: true,
                                        type: isTrialExpired(subReport) ? 'TRIAL_EXPIRED' : 'SUBSCRIPTION_EXPIRED',
                                        data: { plan: subReport?.plan, isTrial: isTrialExpired(subReport) },
                                      });
                                      return;
                                    }
                                    setEditPelanggan({ show: true, data: { ...p } });
                                  }}
                                  title={BUTTON_TITLE.EDIT}
                                >
                                  <i className="bi bi-pencil-fill text-primary"></i>
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-light rounded-circle shadow-sm d-flex align-items-center justify-content-center"
                                  style={{ width: '32px', height: '32px' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isSubscriptionEnabled() && subReport?.isExpired) {
                                      setGateModal({
                                        open: true,
                                        type: isTrialExpired(subReport) ? 'TRIAL_EXPIRED' : 'SUBSCRIPTION_EXPIRED',
                                        data: { plan: subReport?.plan, isTrial: isTrialExpired(subReport) },
                                      });
                                      return;
                                    }
                                    handleDeletePelanggan(p);
                                  }}
                                  title={BUTTON_TITLE.DELETE}
                                >
                                  <i className="bi bi-trash-fill text-danger"></i>
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-light rounded-circle shadow-sm d-flex align-items-center justify-content-center"
                                  style={{ width: '32px', height: '32px' }}
                                  onClick={(e) => { e.stopPropagation(); handleSelectPelanggan(p); }}
                                >
                                  <i className="bi bi-arrow-right text-success"></i>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )
      }

      {/* Modal Edit Pelanggan */}
      {
        editPelanggan.show && (
          <>
            <div className="modal-backdrop fade show" style={{ backdropFilter: 'blur(5px)', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1065 }}></div>
            <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1070 }}>
              <div
                className="modal-dialog modal-dialog-centered w-100 px-2 px-sm-3 my-2"
                style={{ maxWidth: '100%', width: '100%' }}
              >
                <div className="modal-content border-0 shadow-lg w-100" style={{ borderRadius: '24px', width: '100%' }}>
                  <div className="modal-header border-0 pb-0 pt-4 px-4">
                    <h5 className="fw-bold mb-0 text-primary">Edit Pelanggan</h5>
                    <button type="button" className="btn-close" onClick={() => setEditPelanggan({ show: false, data: { id: null, nama: '', hp: '', alamat: '' } })}></button>
                  </div>
                  <div className="modal-body p-4">
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      setConfirmModal({
                        show: true,
                        message: CONFIRM_MESSAGES.UPDATE_CUSTOMER,
                        onConfirm: async () => {
                          try {
                            await updatePelanggan(editPelanggan.data.id, {
                              nama: editPelanggan.data.nama,
                              hp: editPelanggan.data.hp,
                              alamat: editPelanggan.data.alamat
                            });
                            toast.success(TOAST_MESSAGES.SUCCESS);
                            setConfirmModal({ show: false, message: '', onConfirm: null });
                            setEditPelanggan({ show: false, data: { id: null, nama: '', hp: '', alamat: '' } });
                          } catch (e) {
                            toast.error(TOAST_MESSAGES.ERROR);
                          }
                        }
                      });
                    }}>
                      <div className="mb-3">
                        <label className="small fw-bold text-muted mb-1">Nama Lengkap</label>
                        <input type="text" className="form-control border-0 bg-light rounded-3 py-2" value={editPelanggan.data.nama} onChange={(e) => setEditPelanggan({ ...editPelanggan, data: { ...editPelanggan.data, nama: e.target.value } })} required />
                      </div>
                      <div className="mb-3">
                        <label className="small fw-bold text-muted mb-1">No. WhatsApp</label>
                        <input type="tel" className="form-control border-0 bg-light rounded-3 py-2" value={editPelanggan.data.hp} onChange={(e) => setEditPelanggan({ ...editPelanggan, data: { ...editPelanggan.data, hp: e.target.value } })} required />
                      </div>
                      <div className="mb-4">
                        <label className="small fw-bold text-muted mb-1">Alamat</label>
                        <textarea className="form-control border-0 bg-light rounded-3 py-2" rows="2" value={editPelanggan.data.alamat || ''} onChange={(e) => setEditPelanggan({ ...editPelanggan, data: { ...editPelanggan.data, alamat: e.target.value } })}></textarea>
                      </div>
                      <button type="submit" className="btn btn-outline-primary w-100 rounded-pill fw-bold shadow-sm py-2">{BUTTON_TEXT.SAVE}</button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </>
        )
      }

      {/* Modal Inventory (Stock Management) */}
      {
        showInventoryModal && (
          <>
            <div className="modal-backdrop fade show" style={{ backdropFilter: 'blur(15px)', backgroundColor: 'rgba(255,255,255,0.7)' }}></div>
            <div className="modal fade show d-block" tabIndex="-1">
              <div
                className="modal-dialog modal-dialog-centered modal-dialog-scrollable w-100 px-2 px-sm-3 my-2"
                style={{ maxWidth: '100%', width: '100%' }}
              >
                <div
                  className="modal-content border-0 shadow-lg w-100"
                  style={{ borderRadius: '24px', height: '92vh', width: '100%' }}
                >
                  <div className="modal-header border-0 pb-0 pt-4 px-4 d-flex align-items-center justify-content-between">
                    <div>
                      <h5 className="fw-bold mb-0 text-success">Inventaris Barang</h5>
                      <small className="text-muted">Atur stok kebutuhan laundry</small>
                    </div>
                    <button type="button" className="btn-close" onClick={() => setShowInventoryModal(false)}></button>
                  </div>
                  <div className="modal-body p-3 p-sm-4">
                    {/* Banner Shortcut ke Pergerakan Stok */}
                    <div
                      className="p-3 mb-3 rounded-4 d-flex align-items-center justify-content-between border shadow-xs"
                      style={{
                        background: 'linear-gradient(135deg, #f0f5ff 0%, #e0ebff 100%)',
                        borderColor: '#bcd2ff',
                        cursor: 'pointer'
                      }}
                      onClick={() => {
                        if (isSubscriptionEnabled() && subReport?.limits?.hasStockHistory === false) {
                          setGateModal({
                            open: true,
                            type: 'STOCK_HISTORY_LOCKED',
                            data: { plan: subReport?.plan || 'TRIAL' },
                          });
                          return;
                        }
                        setShowInventoryModal(false);
                        navigate('/pergerakan-stok');
                      }}
                    >
                      <div className="d-flex align-items-center gap-3">
                        <div
                          className="rounded-circle d-flex align-items-center justify-content-center text-white flex-shrink-0"
                          style={{ width: '40px', height: '40px', backgroundColor: '#0d5afd' }}
                        >
                          <i className="bi bi-clock-history fs-5"></i>
                        </div>
                        <div>
                          <h6 className="mb-0 fw-bold" style={{ color: '#0b40b3', fontSize: '0.9rem' }}>
                            Riwayat & Pergerakan Stok
                          </h6>
                          <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                            Pantau stok masuk & stok keluar
                          </small>
                        </div>
                      </div>
                      <i className="bi bi-chevron-right fs-5 text-primary"></i>
                    </div>
                    {/* Tambah Stok Baru Quick Form */}
                    <div className="bg-light p-3 rounded-4 mb-4">
                      <form onSubmit={async (e) => {
                        e.preventDefault();
                        const form = e.target;
                        const rawNama = form.nama.value;
                        const nama = rawNama ? rawNama.trim() : '';
                        const stok = parseInt(form.stok.value) || 0;
                        const isKasir = user?.role === 'kasir';

                        if (!nama) return;

                        const cleanNama = nama.toLowerCase();
                        const existingItem = inventory?.find(
                          (item) => !item.deletedAt && item.status !== 'rejected' && item.nama?.trim().toLowerCase() === cleanNama
                        );

                        if (isSubscriptionEnabled()) {
                          if (subReport?.isExpired) {
                            setGateModal({
                              open: true,
                              type: isTrialExpired(subReport) ? 'TRIAL_EXPIRED' : 'SUBSCRIPTION_EXPIRED',
                              data: { plan: subReport?.plan, isTrial: isTrialExpired(subReport) },
                            });
                            return;
                          }
                          if (subReport?.limits?.maxStockItems === 0) {
                            setGateModal({ open: true, type: 'STOCK_LOCKED', data: { plan: subReport?.plan } });
                            return;
                          }
                          // Limit stok bahan hanya membatasi jika menambah jenis item baru yang belum ada di daftar inventaris
                          if (!existingItem) {
                            const activeStockCount = inventory?.filter((item) => !item.deletedAt && item.status !== 'rejected').length || 0;
                            if (subReport?.limits?.maxStockItems !== -1 && activeStockCount >= subReport?.limits?.maxStockItems) {
                              setGateModal({ open: true, type: 'STOCK_LIMIT', data: { plan: subReport?.plan, limit: subReport?.limits?.maxStockItems } });
                              return;
                            }
                          }
                        }

                        setConfirmModal({
                          show: true,
                          message: CONFIRM_MESSAGES.UPDATE_STOCK,
                          onConfirm: async () => {
                            try {
                              await addInventoryManual(nama, stok, { isPending: isKasir, user });
                              form.reset();
                              toast.success(TOAST_MESSAGES.SUCCESS);
                              setConfirmModal({ show: false, message: '', onConfirm: null });
                            } catch (error) {
                              toast.error(TOAST_MESSAGES.ERROR);
                            }
                          }
                        });
                      }}>
                        <label className="small fw-bold text-muted mb-2 px-1">
                          {user?.role === 'kasir' ? 'Ajukan Tambah Stok Barang' : 'Tambah Stok'}
                        </label>
                        <div className="row g-2">
                          <div className="col-8">
                            <input type="text" name="nama" className="form-control border-0 py-2 rounded-3 shadow-sm" placeholder="Nama item..." required />
                          </div>
                          <div className="col-4">
                            <div className="input-group shadow-sm rounded-3 overflow-hidden">
                              <input type="number" name="stok" className="form-control border-0 py-2 px-2 text-center" placeholder="Qty" required />
                              <button className="btn btn-outline-primary border-0 px-2" type="submit" title={BUTTON_TITLE.ADD}>
                                <i className="bi bi-plus-lg"></i>
                              </button>
                            </div>
                          </div>
                        </div>
                      </form>
                    </div>

                    {/* Search Bar Inventory */}
                    <div className="position-relative mb-4">
                      <i className="bi bi-search position-absolute top-50 start-0 translate-middle-y ms-3 text-muted opacity-50"></i>
                      <input
                        type="text"
                        className="form-control ps-5 border-0 bg-light rounded-pill py-2"
                        placeholder="Cari item barang..."
                        value={searchInventory}
                        onChange={(e) => setSearchInventory(e.target.value)}
                      />
                    </div>

                    {/* Tab Inventory */}
                    <div className="d-flex bg-white rounded-pill p-1 shadow-sm mb-3">
                      <button
                        className={`btn flex-fill rounded-pill py-2 border-0 ${inventoryTab === 'selesai' ? 'btn-primary' : 'btn-light text-muted bg-transparent'}`}
                        onClick={() => setInventoryTab('selesai')}
                      >
                        Selesai
                      </button>
                      <button
                        className={`btn flex-fill rounded-pill py-2 border-0 ${inventoryTab === 'pending' ? 'btn-primary' : 'btn-light text-muted bg-transparent'}`}
                        onClick={() => setInventoryTab('pending')}
                      >
                        Pending
                      </button>
                    </div>

                    {/* Daftar Item Inventory */}
                    <div className="inventory-list">
                      {inventory === undefined ? (
                        <InventoryListSkeleton count={4} />
                      ) : inventory.filter(item => {
                        const matchSearch = item.nama.toLowerCase().includes(searchInventory.toLowerCase());
                        const matchTab = inventoryTab === 'pending' ? item.status === 'pending' : (item.status !== 'rejected' && !(item.status === 'pending' && item.stok === 0));
                        return matchSearch && matchTab;
                      }).map(item => (
                        <div key={item.id} className="card border-0 mb-3 rounded-4 shadow-sm overflow-hidden" style={{ background: '#fff' }}>
                          <div className="card-body p-3 d-flex justify-content-between align-items-center">
                            <div className="d-flex align-items-center">
                              <div className="rounded-4 bg-light d-flex align-items-center justify-content-center me-3" style={{ width: '45px', height: '45px' }}>
                                <i className={`bi ${item.nama.toLowerCase().includes('plastik') ? 'bi-box' : 'bi-archive'} text-success fs-4`}></i>
                              </div>
                              <div>
                                <div className="d-flex align-items-center mb-1">
                                  <h6 className="fw-bold mb-0 text-dark" style={{ maxWidth: '100%', fontSize: '13px', wordWrap: 'break-word' }}>{item.nama}</h6>
                                  <i
                                    className="bi bi-copy text-muted ms-2"
                                    style={{ cursor: 'pointer', fontSize: '0.8rem' }}
                                    onClick={() => {
                                      navigator.clipboard.writeText(item.nama);
                                      toast.success(TOAST_MESSAGES.SUCCESS);
                                    }}
                                    title="Copy nama stok"
                                  ></i>
                                </div>
                                <div className="d-flex flex-wrap gap-1 align-items-center">
                                  <span className={`badge rounded-pill ${item.stok < 5 ? 'bg-danger bg-opacity-10' : 'bg-success bg-opacity-10'}`} style={{ fontSize: '0.65rem' }}>
                                    Stok: {item.stok}
                                  </span>
                                  {item.status === 'pending' && (
                                    <>
                                      <span className="badge bg-warning text-dark rounded-pill" style={{ fontSize: '0.65rem' }}>
                                        +{item.qty} {item.unit || 'pcs'}
                                      </span>
                                      {user?.role === 'owner' && (
                                        <span
                                          className="badge rounded-pill d-inline-flex align-items-center gap-1"
                                          style={{
                                            backgroundColor: '#eef2ff',
                                            color: '#4338ca',
                                            fontSize: '0.65rem',
                                            fontWeight: '600',
                                            border: '1px solid #c7d2fe'
                                          }}
                                          title="Kasir yang mengajukan stok"
                                        >
                                          <i className="bi bi-person-fill"></i>
                                          <span>Kasir: {item.createdBy || 'Kasir'}</span>
                                        </span>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {inventoryTab === 'pending' ? (
                              user.role !== 'kasir' && (
                                <div className="d-flex gap-2">
                                  <button
                                    className="btn btn-sm btn-danger rounded-circle shadow-sm d-flex align-items-center justify-content-center"
                                    style={{ width: '32px', height: '32px' }}
                                    onClick={() => handleRejectInventory(item)}
                                    title="Tolak"
                                  >
                                    <i className="bi bi-x fs-6"></i>
                                  </button>
                                  <button
                                    className="btn btn-sm btn-success rounded-circle shadow-sm d-flex align-items-center justify-content-center"
                                    style={{ width: '32px', height: '32px' }}
                                    onClick={() => handleApproveInventory(item)}
                                    title="Setujui"
                                  >
                                    <i className="bi bi-check2 fs-6"></i>
                                  </button>
                                </div>
                              )
                            ) : (
                              user.role !== 'kasir' && (
                                <div className="d-flex align-items-center gap-2 bg-light rounded-pill p-1">
                                  <button
                                    className="btn btn-sm btn-white rounded-circle shadow-sm border-0 d-flex align-items-center justify-content-center"
                                    style={{ width: '28px', height: '28px', backgroundColor: '#fff' }}
                                    onClick={() => handleUpdateStok(item, -1)}
                                  >
                                    <i className="bi bi-dash text-dark"></i>
                                  </button>
                                  <span className="fw-bold text-dark px-1" style={{ fontSize: '0.9rem', minWidth: '20px', textAlign: 'center' }}>{item.stok}</span>
                                  <button
                                    className="btn btn-sm btn-white rounded-circle shadow-sm border-0 d-flex align-items-center justify-content-center"
                                    style={{ width: '28px', height: '28px', backgroundColor: '#fff' }}
                                    onClick={() => handleUpdateStok(item, 1)}
                                  >
                                    <i className="bi bi-plus text-dark"></i>
                                  </button>
                                </div>
                              )
                            )}
                          </div>
                          {/* Danger Indicator Line */}
                          {item.stok < 5 && <div style={{ height: '3px', backgroundColor: '#ff5252', width: '100%' }}></div>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )
      }

      {/* Plan Gate Modal untuk limitasi fitur stok */}
      <PlanGateModal
        isOpen={gateModal.open}
        onClose={() => setGateModal({ open: false, type: 'TRANSACTION_LIMIT', data: {} })}
        type={gateModal.type}
        customData={gateModal.data}
        user={user}
      />
    </div>
  );
};

export default Home;
