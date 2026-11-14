import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../db';

const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:3000/api';
const APP_URL = (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_APP_URL || import.meta.env?.VITE_PUBLIC_TRACKING_URL)) || (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '');

const PLAN_OPTIONS = [
  { key: 'TRIAL', name: 'Trial (Gratis 30 Hari)' },
  { key: 'STARTER', name: 'Starter (Rp 25.000 / bln)' },
  { key: 'BASIC', name: 'Basic (Rp 50.000 / bln - Terpopuler ⭐)' },
  { key: 'PRO', name: 'Pro (Rp 100.000 / bln)' },
  { key: 'BUSINESS', name: 'Bisnis / Enterprise (Rp 200.000 / bln)' },
];

const RegisterStore = () => {
  const navigate = useNavigate();

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('TRIAL');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [featureSubscriptionEnabled, setFeatureSubscriptionEnabled] = useState(true);
  const [showUpgradeBanner, setShowUpgradeBanner] = useState(true);

  // Status pengecekan store existing dengan owner
  const [isExistingOwnerStore, setIsExistingOwnerStore] = useState(false);
  const [isCheckingStore, setIsCheckingStore] = useState(false);
  const [existingStoreInfo, setExistingStoreInfo] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState(null);

  // Helper untuk format nomor telepon ke format WhatsApp internasional (62...)
  const formatWhatsAppNumber = (rawPhone) => {
    let clean = (rawPhone || '').replace(/\D/g, '');
    if (clean.startsWith('0')) {
      clean = '62' + clean.slice(1);
    } else if (clean.startsWith('8')) {
      clean = '62' + clean;
    }
    return clean;
  };

  // Helper pembuat pesan template WhatsApp ajakan registrasi owner
  const buildWhatsAppMessage = (storeCode, storeName, storeAddress, storeCity) => {
    const origin = (APP_URL || (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '')).replace(/\/+$/, '');
    const registerUrl = `${origin}/register?code=${encodeURIComponent(storeCode)}`;

    return `Halo *${storeName}*,\n\nToko Anda telah berhasil didaftarkan di sistem TokoPlus dengan detail:\n🏪 *Nama Toko*: ${storeName}\n🔑 *Kode Toko*: ${storeCode}\n📍 *Alamat*: ${storeAddress || '-'}${storeCity ? ` (${storeCity})` : ''}\n\nSilakan segera selesaikan pendaftaran akun Owner Anda melalui tautan resmi berikut:\n👉 ${registerUrl}\n\nSetelah mendaftar, Anda dapat langsung login dan mengelola kasir serta operasional laundry Anda.\n\nTerima kasih! 🙏`;
  };

  // Pengecekan otomatis apakah Kode Toko sudah terdaftar dan telah memiliki Owner
  useEffect(() => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode || cleanCode.length < 3) {
      setIsExistingOwnerStore(false);
      setExistingStoreInfo(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingStore(true);
      try {
        const response = await fetch(`${API_BASE_URL}/auth/store-info?code=${encodeURIComponent(cleanCode)}`);
        if (response.ok) {
          const result = await response.json();
          const info = result.data || result;
          if (info && (info.hasOwner || info.exists || info.id || info.code)) {
            setIsExistingOwnerStore(true);
            setExistingStoreInfo(info);
            setName(info.name || '');
            setAddress(info.address || '');
            setCity(info.city || '');
            setPhone(info.phone || '');
            setFeatureSubscriptionEnabled(info.featureSubscriptionEnabled ?? true);
            setShowUpgradeBanner(info.showUpgradeBanner ?? true);
            if (info.currentPlan) {
              setSelectedPlan(info.currentPlan.toUpperCase());
            }
            return;
          }
        }
        setIsExistingOwnerStore(false);
        setExistingStoreInfo(null);
      } catch (err) {
        setIsExistingOwnerStore(false);
        setExistingStoreInfo(null);
      } finally {
        setIsCheckingStore(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [code]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();
    const cleanAddress = address.trim();
    const cleanCity = city.trim();
    const cleanPhone = phone.trim();

    if (!cleanCode) {
      setError('Kode Toko wajib diisi.');
      setLoading(false);
      return;
    }

    if (!isExistingOwnerStore && !cleanName) {
      setError('Nama Laundry wajib diisi.');
      setLoading(false);
      return;
    }

    if (!isExistingOwnerStore && !cleanPhone) {
      setError('Nomor WhatsApp wajib diisi untuk mengirim undangan registrasi.');
      setLoading(false);
      return;
    }

    if (!password) {
      setError('Password otorisasi wajib diisi.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register-store`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: cleanCode,
          name: cleanName || existingStoreInfo?.name || cleanCode,
          address: cleanAddress || undefined,
          city: cleanCity || undefined,
          phone: cleanPhone || existingStoreInfo?.phone || '08000000000',
          password,
          featureSubscriptionEnabled,
          showUpgradeBanner,
          plan: selectedPlan || 'TRIAL',
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.message || 'Gagal memproses pendaftaran/perubahan paket store.');
      }

      // Skenario 1: Perpindahan / Update Paket Toko yang Sudah Ber-owner
      if (isExistingOwnerStore) {
        // Sinkronkan perubahan paket ke Dexie jika tersedia di lokal
        if (result.subscription) {
          try {
            const targetStoreId = result.subscription.storeId || existingStoreInfo?.id;
            if (db.storeSubscriptions && targetStoreId) {
              const existingSub = await db.storeSubscriptions.where('storeId').equals(targetStoreId).first();
              await db.storeSubscriptions.put({
                id: existingSub?.id || result.subscription.id || crypto.randomUUID(),
                ...result.subscription,
                storeId: targetStoreId,
                updatedAt: new Date(result.subscription.updatedAt || new Date()),
              });
            }
            const setting = await db.settings.get(1);
            if (setting?.storeId === targetStoreId || setting?.storeCode === cleanCode) {
              await db.settings.update(1, { cachedSubscription: result.subscription }).catch(() => { });
            }
          } catch (dexieErr) {
            console.warn('Gagal update Dexie setelah perubahan paket:', dexieErr);
          }
        }

        setSuccessData({
          isPlanUpdated: true,
          code: cleanCode,
          name: existingStoreInfo?.name || cleanName,
          plan: selectedPlan,
          featureSubscriptionEnabled,
          showUpgradeBanner,
          message: result.message || `Paket toko ${cleanCode} berhasil diperbarui ke ${selectedPlan}.`,
        });
        return;
      }

      // Skenario 2: Pendaftaran Toko Baru & Kirim Undangan WhatsApp
      const waNumber = formatWhatsAppNumber(cleanPhone);
      const waMessage = buildWhatsAppMessage(cleanCode, cleanName, cleanAddress, cleanCity);
      const waUrl = `https://api.whatsapp.com/send?phone=${waNumber}&text=${encodeURIComponent(waMessage)}`;

      setSuccessData({
        isPlanUpdated: false,
        code: cleanCode,
        name: cleanName,
        phone: cleanPhone,
        featureSubscriptionEnabled,
        showUpgradeBanner,
        waNumber,
        waUrl,
      });

      window.open(waUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan saat memproses store.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetForm = () => {
    setSuccessData(null);
    setCode('');
    setName('');
    setAddress('');
    setCity('');
    setPhone('');
    setPassword('');
    setSelectedPlan('TRIAL');
    setIsExistingOwnerStore(false);
    setExistingStoreInfo(null);
    setFeatureSubscriptionEnabled(true);
    setShowUpgradeBanner(true);
  };

  return (
    <div
      className="register-store-wrapper d-flex align-items-start align-items-sm-center justify-content-center w-100 py-4"
      style={{
        minHeight: '100vh',
        backgroundColor: '#f1f5f9',
      }}
    >
      <div className="container px-3" style={{ maxWidth: '500px' }}>
        <div
          className="card border-0 shadow-sm"
          style={{
            borderRadius: '20px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
          }}
        >
          <div className="card-body p-4">
            {/* Header Logo & Title */}
            <div className="text-center mb-3">
              <div
                className="mx-auto d-flex align-items-center justify-content-center shadow-sm"
                style={{
                  width: '64px',
                  height: '64px',
                  background: isExistingOwnerStore
                    ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
                    : 'linear-gradient(135deg, #0134d4 0%, #2855e1 100%)',
                  borderRadius: '18px',
                  marginBottom: '12px',
                  boxShadow: isExistingOwnerStore
                    ? '0 8px 16px -4px rgba(16, 185, 129, 0.35)'
                    : '0 8px 16px -4px rgba(1, 52, 212, 0.35)',
                }}
              >
                <i className={`bi ${isExistingOwnerStore ? 'bi-arrow-left-right text-white' : 'bi-shop-window text-white'} fs-2`}></i>
              </div>
              <h4
                className="fw-bold mb-1"
                style={{
                  letterSpacing: '0.3px',
                  color: isExistingOwnerStore ? '#059669' : '#0134d4',
                  fontSize: '1.25rem',
                }}
              >
                {isExistingOwnerStore ? 'PINDAH / PERBARUI PAKET' : 'DAFTAR STORE BARU'}
              </h4>
              <p className="text-muted small mb-0" style={{ fontSize: '12px' }}>
                {isExistingOwnerStore
                  ? 'Toko telah memiliki Owner. Pilih paket baru dan konfirmasi dengan password otorisasi.'
                  : 'Registrasi tenant toko laundry & kirim undangan pendaftaran Owner via WhatsApp'}
              </p>
            </div>

            {error && (
              <div className="alert alert-danger rounded-3 py-2 px-3 small mb-3" role="alert" style={{ fontSize: '12.5px' }}>
                <i className="bi bi-exclamation-circle-fill me-1.5"></i>
                {error}
              </div>
            )}

            {/* Modal / Alert Sukses */}
            {successData ? (
              <div className="text-center py-2">
                <div
                  className="mx-auto rounded-circle d-flex align-items-center justify-content-center mb-3"
                  style={{ width: '64px', height: '64px', backgroundColor: '#dcfce7', color: '#16a34a' }}
                >
                  <i className="bi bi-check-circle-fill fs-2"></i>
                </div>
                <h5 className="fw-bold text-dark mb-1">
                  {successData.isPlanUpdated ? 'Paket Toko Berhasil Dipindahkan!' : 'Store Berhasil Didaftarkan!'}
                </h5>
                <p className="text-muted small mb-3" style={{ fontSize: '13px' }}>
                  {successData.isPlanUpdated
                    ? `Paket langganan toko ${successData.name} telah berhasil diubah ke ${successData.plan}.`
                    : `Toko ${successData.name} (${successData.code}) telah tersimpan di database.`}
                </p>

                <div className="p-3 rounded-3 bg-light border mb-3 text-start small">
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Kode Toko:</span>
                    <span className="fw-bold text-primary">{successData.code}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Nama Toko:</span>
                    <span className="fw-bold text-dark">{successData.name}</span>
                  </div>
                  {successData.isPlanUpdated ? (
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-muted">Paket Langganan:</span>
                      <span className="badge bg-success-subtle text-success-emphasis border border-success-subtle px-2 py-0.5 fw-bold">
                        {successData.plan}
                      </span>
                    </div>
                  ) : (
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-muted">No. WhatsApp:</span>
                      <span className="fw-bold text-dark">{successData.phone}</span>
                    </div>
                  )}
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Fitur Subscription:</span>
                    <span className={`fw-bold ${successData.featureSubscriptionEnabled ? 'text-success' : 'text-secondary'}`}>
                      {successData.featureSubscriptionEnabled ? 'Aktif (Berlangganan)' : 'Nonaktif (Unlimited)'}
                    </span>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span className="text-muted">Banner Upgrade:</span>
                    <span className={`fw-bold ${successData.showUpgradeBanner ? 'text-warning' : 'text-muted'}`}>
                      {successData.showUpgradeBanner ? 'Tampil' : 'Nonaktif'}
                    </span>
                  </div>
                </div>

                <div className="d-grid gap-2 mb-3">
                  {successData.isPlanUpdated ? (
                    <button
                      type="button"
                      className="btn btn-primary fw-bold py-2.5 rounded-3 shadow-sm"
                      style={{ fontSize: '14px', backgroundColor: '#0134d4', borderColor: '#0134d4' }}
                      onClick={() => navigate('/login')}
                    >
                      Buka Halaman Login
                    </button>
                  ) : (
                    <>
                      <a
                        href={successData.waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-success fw-bold py-2.5 rounded-3 d-flex align-items-center justify-content-center gap-2 shadow-sm"
                        style={{ fontSize: '14px' }}
                      >
                        <i className="bi bi-whatsapp fs-5"></i>
                        Buka WhatsApp / Kirim Ulang
                      </a>

                      <button
                        type="button"
                        className="btn btn-primary fw-bold py-2.5 rounded-3 shadow-sm"
                        style={{ fontSize: '14px', backgroundColor: '#0134d4', borderColor: '#0134d4' }}
                        onClick={() => navigate(`/register?code=${successData.code}`)}
                      >
                        Lanjut Registrasi Akun Owner
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    className="btn btn-outline-secondary py-2 rounded-3 small"
                    onClick={handleResetForm}
                  >
                    Kelola / Daftarkan Store Lain
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                {/* Banner Peringatan jika Toko Sudah Memiliki Owner */}
                {isExistingOwnerStore && (
                  <div
                    className="alert alert-warning border-0 rounded-3 py-2 px-3 small mb-3 d-flex align-items-center gap-2"
                    style={{ backgroundColor: '#fef3c7', color: '#92400e', fontSize: '12px' }}
                  >
                    <i className="bi bi-shield-lock-fill fs-5 text-warning flex-shrink-0"></i>
                    <div>
                      <strong>Toko Sudah Memiliki Owner:</strong> Kolom identitas dinonaktifkan. Anda dapat memindahkan paket langganan dan memasukkan password otorisasi.
                    </div>
                  </div>
                )}

                {/* Kode Toko */}
                <div className="form-group mb-2.5">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <label className="form-label small fw-bold text-muted mb-0" style={{ fontSize: '12px' }}>
                      Kode Toko (Code) <span className="text-danger">*</span>
                    </label>
                    {isCheckingStore && (
                      <span className="text-muted small d-flex align-items-center gap-1" style={{ fontSize: '11px' }}>
                        <span className="spinner-border spinner-border-sm" style={{ width: '10px', height: '10px' }}></span>
                        Cek toko...
                      </span>
                    )}
                  </div>
                  <input
                    className="form-control fw-bold text-primary"
                    style={{
                      height: '42px',
                      backgroundColor: '#f8fafc',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: '10px',
                      fontSize: '14px',
                      padding: '8px 14px',
                    }}
                    type="text"
                    placeholder="Contoh: STORE02"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    required
                  />
                  <div className="form-text text-muted" style={{ fontSize: '11px' }}>
                    Kode unik identifikasi toko untuk login dan registrasi owner/kasir.
                  </div>
                </div>

                {/* DROPDOWN PILIHAN TIPE PAKET (Wajib aktif saat mode pindah plan atau toko memiliki owner) */}
                {isExistingOwnerStore && (
                  <div className="form-group mb-2.5">
                    <label className="form-label small fw-bold text-primary mb-1 d-flex align-items-center gap-1" style={{ fontSize: '12px' }}>
                      <i className="bi bi-gem-fill text-warning"></i>
                      Pilihan Tipe Paket Langganan <span className="text-danger">*</span>
                    </label>
                    <select
                      className="form-select fw-bold border-primary shadow-xs"
                      style={{
                        height: '42px',
                        backgroundColor: '#ffffff',
                        borderRadius: '10px',
                        fontSize: '14px',
                        padding: '8px 14px',
                        color: '#0134d4',
                      }}
                      value={selectedPlan}
                      onChange={(e) => setSelectedPlan(e.target.value)}
                    >
                      {PLAN_OPTIONS.map((opt) => (
                        <option key={opt.key} value={opt.key}>
                          {opt.name}
                        </option>
                      ))}
                    </select>
                    <div className="form-text text-muted" style={{ fontSize: '11px' }}>
                      Pilih paket baru untuk langsung memperbarui batas kuota dan fasilitas toko ini.
                    </div>
                  </div>
                )}

                {/* Nama Toko (Disabled jika toko sudah memiliki Owner) */}
                <div className="form-group mb-2.5">
                  <label className="form-label small fw-bold text-muted mb-1" style={{ fontSize: '12px' }}>
                    Nama Laundry / Toko {!isExistingOwnerStore && <span className="text-danger">*</span>}
                  </label>
                  <input
                    className="form-control"
                    style={{
                      height: '42px',
                      backgroundColor: isExistingOwnerStore ? '#f1f5f9' : '#f8fafc',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: '10px',
                      fontSize: '14px',
                      padding: '8px 14px',
                      cursor: isExistingOwnerStore ? 'not-allowed' : 'text',
                    }}
                    type="text"
                    placeholder="Contoh: Laundry Bersih"
                    value={name}
                    disabled={isExistingOwnerStore}
                    onChange={(e) => setName(e.target.value)}
                    required={!isExistingOwnerStore}
                  />
                </div>

                {/* Alamat Toko (Disabled jika toko sudah memiliki Owner) */}
                <div className="form-group mb-2.5">
                  <label className="form-label small fw-bold text-muted mb-1" style={{ fontSize: '12px' }}>
                    Alamat Lengkap
                  </label>
                  <input
                    className="form-control"
                    style={{
                      height: '42px',
                      backgroundColor: isExistingOwnerStore ? '#f1f5f9' : '#f8fafc',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: '10px',
                      fontSize: '14px',
                      padding: '8px 14px',
                      cursor: isExistingOwnerStore ? 'not-allowed' : 'text',
                    }}
                    type="text"
                    placeholder="Contoh: Jl. Ahmad Yani No. 45"
                    value={address}
                    disabled={isExistingOwnerStore}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>

                {/* Kota (Disabled jika toko sudah memiliki Owner) */}
                <div className="form-group mb-2.5">
                  <label className="form-label small fw-bold text-muted mb-1" style={{ fontSize: '12px' }}>
                    Kota
                  </label>
                  <input
                    className="form-control"
                    style={{
                      height: '42px',
                      backgroundColor: isExistingOwnerStore ? '#f1f5f9' : '#f8fafc',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: '10px',
                      fontSize: '14px',
                      padding: '8px 14px',
                      cursor: isExistingOwnerStore ? 'not-allowed' : 'text',
                    }}
                    type="text"
                    placeholder="Contoh: Karawang"
                    value={city}
                    disabled={isExistingOwnerStore}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>

                {/* Nomor HP / WhatsApp (Disabled jika toko sudah memiliki Owner) */}
                <div className="form-group mb-2.5">
                  <label className="form-label small fw-bold text-muted mb-1 d-flex align-items-center gap-1" style={{ fontSize: '12px' }}>
                    <i className="bi bi-whatsapp text-success"></i>
                    Nomor WhatsApp Owner {!isExistingOwnerStore && <span className="text-danger">*</span>}
                  </label>
                  <input
                    className="form-control"
                    style={{
                      height: '42px',
                      backgroundColor: isExistingOwnerStore ? '#f1f5f9' : '#f8fafc',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: '10px',
                      fontSize: '14px',
                      padding: '8px 14px',
                      cursor: isExistingOwnerStore ? 'not-allowed' : 'text',
                    }}
                    type="tel"
                    placeholder="Contoh: 081234567890"
                    value={phone}
                    disabled={isExistingOwnerStore}
                    onChange={(e) => setPhone(e.target.value)}
                    required={!isExistingOwnerStore}
                  />
                  <div className="form-text text-muted" style={{ fontSize: '11px' }}>
                    {isExistingOwnerStore
                      ? 'Nomor WhatsApp terdaftar milik Owner toko.'
                      : 'Saat submit, link ajakan registrasi owner akan otomatis diarahkan ke nomor ini.'}
                  </div>
                </div>

                {/* Dropdown Fitur Subscription */}
                <div className="form-group mb-2.5">
                  <label className="form-label small fw-bold text-muted mb-1 d-flex align-items-center gap-1" style={{ fontSize: '12px' }}>
                    <i className="bi bi-patch-check-fill text-primary"></i>
                    Fitur Subscription<span className="text-danger">*</span>
                  </label>
                  <select
                    className="form-select fw-bold"
                    style={{
                      height: '42px',
                      backgroundColor: '#f8fafc',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: '10px',
                      fontSize: '14px',
                      padding: '8px 14px',
                      color: featureSubscriptionEnabled ? '#0134d4' : '#64748b',
                    }}
                    value={featureSubscriptionEnabled ? 'true' : 'false'}
                    onChange={(e) => {
                      const isTrue = e.target.value === 'true';
                      setFeatureSubscriptionEnabled(isTrue);
                      setShowUpgradeBanner(isTrue);
                    }}
                  >
                    <option value="true">Aktif (Gunakan Tier Plan)</option>
                    <option value="false">Nonaktif (Unlimited Toko)</option>
                  </select>
                  <div className="form-text text-muted" style={{ fontSize: '11px' }}>
                    Jika aktif, kuota transaksi dan fitur berbayar akan dibatasi sesuai paket.
                  </div>
                </div>

                {/* Banner Upgrade Plan Otomatis */}
                <div className="form-group mb-2.5">
                  <div className="d-flex align-items-center justify-content-between p-3 rounded-3 border bg-light" style={{ borderColor: '#e2e8f0' }}>
                    <div>
                      <div className="fw-bold small text-dark d-flex align-items-center gap-1" style={{ fontSize: '12.5px' }}>
                        <i className={`bi ${showUpgradeBanner ? 'bi-megaphone-fill text-warning' : 'bi-megaphone text-muted'}`}></i>
                        Tampilkan Banner Upgrade Plan
                      </div>
                      <div className="text-muted mt-2" style={{ fontSize: '12px' }}>
                        {featureSubscriptionEnabled
                          ? (showUpgradeBanner ? 'Otomatis aktif bersamaan dengan fitur subscription' : 'Banner upgrade dinonaktifkan')
                          : 'Otomatis nonaktif karena fitur subscription dimatikan'}
                      </div>
                    </div>
                    <div className="form-check form-switch m-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        role="switch"
                        id="showUpgradeBannerSwitch"
                        checked={showUpgradeBanner}
                        disabled={!featureSubscriptionEnabled}
                        onChange={(e) => setShowUpgradeBanner(e.target.checked)}
                        style={{ cursor: featureSubscriptionEnabled ? 'pointer' : 'not-allowed', width: '2.5em', height: '1.3em' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Password Otorisasi (Selalu Dapat Di-input) */}
                <div className="form-group mb-3.5">
                  <label className="form-label small fw-bold text-muted mb-1" style={{ fontSize: '12px' }}>
                    Password Otorisasi <span className="text-danger">*</span>
                  </label>
                  <div className="input-group">
                    <input
                      className="form-control"
                      style={{
                        height: '42px',
                        backgroundColor: '#f8fafc',
                        border: '1.5px solid #cbd5e1',
                        borderTopLeftRadius: '10px',
                        borderBottomLeftRadius: '10px',
                        fontSize: '14px',
                        padding: '8px 14px',
                      }}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Masukkan password otorisasi"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      style={{
                        border: '1.5px solid #cbd5e1',
                        borderLeft: 'none',
                        borderTopRightRadius: '10px',
                        borderBottomRightRadius: '10px',
                        backgroundColor: '#f8fafc',
                      }}
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                    </button>
                  </div>
                  <div className="form-text text-muted" style={{ fontSize: '11px' }}>
                    Diperlukan password developer/admin untuk otorisasi perubahan ini.
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  className="btn btn-primary w-100 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2"
                  style={{
                    height: '46px',
                    borderRadius: '12px',
                    fontSize: '15px',
                    backgroundColor: isExistingOwnerStore ? '#059669' : '#0134d4',
                    borderColor: isExistingOwnerStore ? '#059669' : '#0134d4',
                    boxShadow: isExistingOwnerStore
                      ? '0 4px 12px rgba(5, 150, 105, 0.25)'
                      : '0 4px 12px rgba(1, 52, 212, 0.25)',
                  }}
                  type="submit"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status"></span>
                      <span>{isExistingOwnerStore ? 'Memperbarui Paket...' : 'Menyimpan Store...'}</span>
                    </>
                  ) : (
                    <>
                      <i className={`bi ${isExistingOwnerStore ? 'bi-arrow-left-right' : 'bi-send-check-fill'}`}></i>
                      <span>{isExistingOwnerStore ? 'Pindahkan / Perbarui Paket Toko' : 'Kirim Undangan'}</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterStore;
