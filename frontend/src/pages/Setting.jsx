import { useState, useEffect } from 'react';
import { useSearchParams, useParams, useNavigate, Link } from 'react-router-dom';
import { getSettingsQuery, updateSettings } from '../db/repositories/settings';
import { getKasirUsersQuery, addUser, updateUser, deleteUser as deleteUserRepo } from '../db/repositories/users';
import { getProductsQuery, addProduct, updateProduct, deleteProduct as deleteProductRepo } from '../db/repositories/products';
import { useLiveQuery } from 'dexie-react-hooks';
import toast from 'react-hot-toast';
import UbahPassword from './UbahPassword';
import { getSubscriptionReport, isTrialExpired, isSubscriptionEnabled } from '../services/subscriptionService';
import PlanGateModal from '../components/PlanGateModal';
import {
  TOAST_MESSAGES,
  CONFIRM_MESSAGES,
  PRODUCT_CATEGORIES,
  DEFAULT_CATEGORY,
  FALLBACK_CATEGORY,
  STATUS_TEXT,
  BUTTON_TEXT,
  BUTTON_TITLE,
  TAB_TITLE,
} from '../constants/settingConstants';
import { SettingSkeleton, ProductListSkeleton } from '../components/common/Skeleton';
import { Barcode } from '../components/common/Barcode';
import { db } from '../db';
import { promptPwaInstall } from '../utils/pwaHelper';
import {
  isFooterBarcode,
  isFooterLinkOrder,
  cleanReceiptFooterText,
  formatReceiptFooterText,
  getReceiptTrackingUrl,
} from '../utils/receiptFooter';

const Setting = ({ user, onLogout }) => {
  const settings = useLiveQuery(getSettingsQuery);
  const users = useLiveQuery(getKasirUsersQuery);
  const products = useLiveQuery(getProductsQuery);

  const { section } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const getInitialTab = () => {
    if (section) {
      const s = section.toLowerCase();
      if (['product', 'produk'].includes(s)) return 'product';
      if (['toko', 'umum'].includes(s)) return 'umum';
      if (s === 'struk') return 'struk';
      if (s === 'kasir') return 'kasir';
      if (s === 'password') return 'password';
    }
    const tabParam = searchParams.get('tab');
    if (tabParam && ['umum', 'struk', 'kasir', 'product', 'produk', 'toko', 'password'].includes(tabParam)) {
      if (tabParam === 'produk') return 'product';
      if (tabParam === 'toko') return 'umum';
      return tabParam;
    }
    return null; // Default: Menu List Pengaturan
  };

  // Tab aktif: null (List Pengaturan) | 'umum' (Informasi Toko) | 'struk' (Format Struk) | 'kasir' (Manajemen Kasir) | 'product' (Master Layanan) | 'password' (Ubah Password)
  const [activeTab, setActiveTab] = useState(getInitialTab);

  useEffect(() => {
    const nextTab = getInitialTab();
    setActiveTab(nextTab);
  }, [searchParams, section]);

  // Selalu reset scroll ke posisi paling atas saat berpindah sub-menu / tab pengaturan
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [activeTab]);

  const selectTab = (tabName) => {
    setActiveTab(tabName);
    if (tabName) {
      setSearchParams({ tab: tabName });
    } else {
      setSearchParams({});
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  const [isSaving, setIsSaving] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userLimitModal, setUserLimitModal] = useState({ open: false, limit: 1, plan: '' });
  const [productLimitModal, setProductLimitModal] = useState({ open: false, limit: 5, plan: '' });
  const [expiredModal, setExpiredModal] = useState({ open: false, type: 'SUBSCRIPTION_EXPIRED', plan: '', isTrial: false });
  const [showPassword, setShowPassword] = useState(false);

  const triggerExpiredModal = (sub) => {
    const isTrial = isTrialExpired(sub);
    setExpiredModal({
      open: true,
      type: isTrial ? 'TRIAL_EXPIRED' : 'SUBSCRIPTION_EXPIRED',
      plan: sub?.plan,
      isTrial,
    });
  };

  // State untuk Modal & Form Produk / Layanan
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productFormData, setProductFormData] = useState({
    name: '',
    category: DEFAULT_CATEGORY,
    code: '',
    price: '',
  });

  const [userFormData, setUserFormData] = useState({
    fullname: '',
    username: '',
    password: '',
    role: 'kasir',
  });

  const [isPwaInstalled, setIsPwaInstalled] = useState(false);
  const [showInstallPopup, setShowInstallPopup] = useState(false);
  const [installManualHelp, setInstallManualHelp] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  useEffect(() => {
    const checkInstalled = () => {
      const standalone = typeof window !== 'undefined' && (
        (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
        window.navigator?.standalone === true ||
        (typeof document !== 'undefined' && document.referrer?.includes('android-app://'))
      );
      const installed = standalone || localStorage.getItem('pwa_user_clicked_install') === 'true' || settings?.isAppInstalled === true;
      setIsPwaInstalled(Boolean(installed));
    };
    checkInstalled();

    const handleInstalled = () => {
      setIsPwaInstalled(true);
      localStorage.setItem('pwa_user_clicked_install', 'true');
      db.settings.update(1, { isAppInstalled: true }).catch(() => { });
    };

    window.addEventListener('pwa:installed', handleInstalled);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('pwa:installed', handleInstalled);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, [settings?.isAppInstalled]);

  const handleCloseInstallPopup = () => {
    setShowInstallPopup(false);
    setInstallManualHelp(false);
  };

  const handleInstallApp = async () => {
    try {
      await db.settings.update(1, { isAppInstalled: true, appInstalledAt: new Date() });
    } catch (e) {
      console.warn('[PWA] Gagal simpan status install ke Dexie:', e);
    }
    localStorage.setItem('pwa_user_clicked_install', 'true');
    localStorage.setItem('pwa_dismissed_forever', 'true');
    setIsPwaInstalled(true);

    try {
      const res = await promptPwaInstall();
      if (res?.outcome === 'accepted') {
        setInstallSuccess(true);
        setTimeout(() => {
          setShowInstallPopup(false);
          setInstallSuccess(false);
        }, 2000);
      } else {
        setInstallManualHelp(true);
      }
    } catch (err) {
      console.warn('[PWA] prompt error:', err);
      setInstallManualHelp(true);
    }
  };

  const [formData, setFormData] = useState({
    namaLaundry: '',
    motto: '',
    alamat: '',
    kota: '',
    telepon: '',
    jamBuka: '',
    menerimaCucian: true,
    isTokoTutup: false,
    headerStruk: '',
    footerStruk: '',
  });

  // Sinkronisasi data form dengan data lokal settings di Dexie
  useEffect(() => {
    if (settings) {
      setFormData({
        namaLaundry: settings.namaLaundry || '',
        motto: settings.motto || '',
        alamat: settings.alamat || '',
        kota: settings.kota || '',
        telepon: settings.telepon || '',
        jamBuka: settings.jamBuka || '',
        menerimaCucian: typeof settings.menerimaCucian === 'boolean' ? settings.menerimaCucian : true,
        isTokoTutup: typeof settings.isTokoTutup === 'boolean' ? settings.isTokoTutup : (settings.tokoTutup === true),
        headerStruk: settings.headerStruk || '',
        footerStruk: settings.footerStruk || '',
      });
    }
  }, [settings]);

  const handleSaveSettings = async (e) => {
    e?.preventDefault();
    // Kasir boleh mengedit format nota dan struk
    if (activeTab !== 'struk' && user?.role !== 'owner') {
      toast.error('Hanya owner yang dapat mengubah pengaturan ini.');
      return;
    }

    try {
      const sub = await getSubscriptionReport().catch(() => null);
      if (sub?.isExpired) {
        triggerExpiredModal(sub);
        return;
      }
    } catch (e) { }

    setIsSaving(true);
    try {
      await updateSettings(formData);
      toast.success(TOAST_MESSAGES.SUCCESS);
    } catch (err) {
      console.error(err);
      toast.error(TOAST_MESSAGES.ERROR);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUserSave = async (e) => {
    e.preventDefault();
    try {
      const sub = await getSubscriptionReport().catch(() => null);
      if (sub?.isExpired) {
        triggerExpiredModal(sub);
        return;
      }
      if (editingUser) {
        await updateUser(editingUser.id, userFormData);
        toast.success(TOAST_MESSAGES.SUCCESS);
      } else {
        await addUser(userFormData);
        toast.success(TOAST_MESSAGES.SUCCESS);
      }
      setShowUserModal(false);
      setEditingUser(null);
      setUserFormData({ fullname: '', username: '', password: '', role: 'kasir' });
    } catch (err) {
      toast.error(TOAST_MESSAGES.ERROR);
    }
  };

  const deleteUser = async (id) => {
    try {
      const sub = await getSubscriptionReport().catch(() => null);
      if (sub?.isExpired) {
        triggerExpiredModal(sub);
        return;
      }
    } catch (e) { }
    if (window.confirm(CONFIRM_MESSAGES.DELETE_USER)) {
      try {
        await deleteUserRepo(id);
        toast.success(TOAST_MESSAGES.SUCCESS);
      } catch (err) {
        toast.error(TOAST_MESSAGES.ERROR);
      }
    }
  };

  const openUserModal = async (selectedUser = null) => {
    try {
      const sub = await getSubscriptionReport().catch(() => null);
      if (sub?.isExpired) {
        triggerExpiredModal(sub);
        return;
      }
      if (!selectedUser && sub?.usage?.users?.isExceeded) {
        setUserLimitModal({ open: true, limit: sub.limits.maxUsers, plan: sub.plan });
        return;
      }
    } catch (e) { }
    if (selectedUser) {
      setEditingUser(selectedUser);
      setUserFormData({
        fullname: selectedUser.fullname || '',
        username: selectedUser.username || '',
        password: '',
        role: 'kasir',
      });
    } else {
      setEditingUser(null);
      setUserFormData({ fullname: '', username: '', password: '', role: 'kasir' });
    }
    setShowPassword(false);
    setShowUserModal(true);
  };

  const openProductModal = async (selectedProduct = null) => {
    try {
      const sub = await getSubscriptionReport().catch(() => null);
      if (sub?.isExpired) {
        triggerExpiredModal(sub);
        return;
      }
      if (!selectedProduct && sub && sub.isEnforced && sub.usage?.products?.isExceeded) {
        setProductLimitModal({ open: true, limit: sub.limits?.maxProducts ?? 5, plan: sub.plan });
        return;
      }
    } catch (e) { }
    if (selectedProduct) {
      setEditingProduct(selectedProduct);
      setProductFormData({
        name: selectedProduct.name || '',
        category: selectedProduct.category || DEFAULT_CATEGORY,
        code: selectedProduct.code || '',
        price: selectedProduct.price || '',
      });
    } else {
      setEditingProduct(null);
      setProductFormData({
        name: '',
        category: DEFAULT_CATEGORY,
        code: '',
        price: '',
      });
    }
    setShowProductModal(true);
  };

  const [deleteProductConfirm, setDeleteProductConfirm] = useState({ show: false, product: null });
  const [visibleProductCount, setVisibleProductCount] = useState(10);

  const confirmDeleteProduct = (product) => {
    setDeleteProductConfirm({ show: true, product });
  };

  const handleConfirmDeleteProduct = async () => {
    const p = deleteProductConfirm.product;
    setDeleteProductConfirm({ show: false, product: null });
    if (!p) return;
    try {
      const sub = await getSubscriptionReport().catch(() => null);
      if (sub?.isExpired) {
        triggerExpiredModal(sub);
        return;
      }
    } catch (e) { }

    try {
      await deleteProductRepo(p.id);
      toast.success(TOAST_MESSAGES.SUCCESS);
    } catch (err) {
      toast.error(TOAST_MESSAGES.ERROR);
    }
  };

  const handleProductSave = async (e) => {
    e.preventDefault();
    try {
      const sub = await getSubscriptionReport().catch(() => null);
      if (sub?.isExpired) {
        triggerExpiredModal(sub);
        return;
      }
      if (editingProduct) {
        await updateProduct(editingProduct.id, productFormData);
        toast.success(TOAST_MESSAGES.SUCCESS);
      } else {
        await addProduct(productFormData);
        toast.success(TOAST_MESSAGES.SUCCESS);
      }
      setShowProductModal(false);
      setEditingProduct(null);
      setProductFormData({ name: '', category: DEFAULT_CATEGORY, code: '', price: '' });
    } catch (err) {
      toast.error(TOAST_MESSAGES.ERROR);
    }
  };

  const deleteProduct = async (id) => {
    const p = products?.find(item => item.id === id);
    if (p) {
      confirmDeleteProduct(p);
    } else {
      confirmDeleteProduct({ id, name: 'Layanan' });
    }
  };

  if (!settings) {
    return <SettingSkeleton />;
  }

  const isOwner = user?.role === 'owner';

  return (
    <div className="setting-page pb-5" style={{ backgroundColor: '#f4f6fa', minHeight: '100vh' }}>
      <div className="container px-3 pt-3" style={{ maxWidth: '640px' }}>
        {/* ======================================================== */}
        {/* MENU LIST PENGATURAN (TAMPILAN UTAMA SEBELUM KLIK SUB-MENU) */}
        {/* ======================================================== */}
        {!activeTab && (
          <div>
            {/* PROFILE & STORE HEADER CARD */}
            <div className="card border-0 shadow-sm rounded-4 mb-3 bg-white overflow-hidden p-3" style={{ border: '1px solid #eef2f6' }}>
              <div className="d-flex align-items-center gap-3">
                <div
                  className="rounded-4 d-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0"
                  style={{
                    width: '52px',
                    height: '52px',
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    fontSize: '1.35rem',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.22)',
                  }}
                >
                  {settings.namaLaundry ? settings.namaLaundry.charAt(0).toUpperCase() : 'L'}
                </div>
                <div className="overflow-hidden flex-grow-1">
                  <div className="d-flex align-items-center justify-content-between gap-2 mb-1 flex-wrap">
                    <div className="d-flex align-items-center gap-2 overflow-hidden flex-wrap">
                      <h5 className="fw-bold text-dark text-truncate mb-0" style={{ fontSize: '1.05rem', letterSpacing: '-0.2px' }}>
                        {settings.namaLaundry || 'TokoPlus'}
                      </h5>
                      {settings.storeCode && (
                        <span
                          className="badge rounded-pill fw-semibold"
                          style={{
                            backgroundColor: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe',
                            fontSize: '0.68rem',
                            padding: '2px 8px',
                            letterSpacing: '0.3px',
                          }}
                        >
                          {settings.storeCode}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="d-flex align-items-center text-muted small text-truncate mb-1.5" style={{ fontSize: '0.78rem' }}>
                    <i className="bi bi-geo-alt-fill text-danger me-1 flex-shrink-0" style={{ fontSize: '0.75rem' }}></i>
                    <span className="text-truncate">{settings.alamat || 'Alamat toko belum diatur'}</span>
                  </div>
                  <div className="d-flex align-items-center gap-1.5 flex-wrap">
                    <span
                      className="badge rounded-pill fw-normal d-inline-flex align-items-center gap-1"
                      style={{
                        backgroundColor: '#f1f5f9',
                        color: '#475569',
                        border: '1px solid #e2e8f0',
                        fontSize: '0.68rem',
                        padding: '2.5px 8px',
                      }}
                    >
                      <i className="bi bi-person-fill text-muted" style={{ fontSize: '0.7rem' }}></i>
                      @{user?.username || 'user'}
                    </span>
                    <span
                      className="badge rounded-pill fw-medium d-inline-flex align-items-center gap-1"
                      style={{
                        backgroundColor: isOwner ? '#eff6ff' : '#f0fdf4',
                        color: isOwner ? '#2563eb' : '#16a34a',
                        border: `1px solid ${isOwner ? '#bfdbfe' : '#bbf7d0'}`,
                        fontSize: '0.68rem',
                        padding: '2.5px 8px',
                      }}
                    >
                      <i className={`bi bi-${isOwner ? 'shield-fill-check' : 'person-badge'}`} style={{ fontSize: '0.7rem' }}></i>
                      {isOwner ? 'Owner' : 'Kasir'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 1: PENGATURAN USAHA */}
            <div className="mb-3">
              <div className="text-muted small fw-bold px-1 mb-2 text-uppercase" style={{ fontSize: '0.72rem', letterSpacing: '0.5px' }}>
                Pengaturan Usaha
              </div>
              <div className="card border-0 shadow-sm rounded-4 bg-white overflow-hidden">
                <div className="list-group list-group-flush">
                  {/* PENGATURAN TOKO */}
                  <div
                    role="button"
                    className="list-group-item list-group-item-action p-3 d-flex align-items-center justify-content-between border-0 border-bottom"
                    onClick={() => selectTab('umum')}
                  >
                    <div className="d-flex align-items-center gap-3">
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center text-primary flex-shrink-0"
                        style={{ width: '40px', height: '40px', backgroundColor: '#eff6ff' }}
                      >
                        <i className="bi bi-shop fs-5"></i>
                      </div>
                      <div>
                        <h6 className="fw-bold mb-0.5 text-dark" style={{ fontSize: '0.9rem' }}>
                          Pengaturan Toko
                        </h6>
                        <small className="text-muted" style={{ fontSize: '0.74rem' }}>
                          Profil laundry, alamat, kontak WhatsApp
                        </small>
                      </div>
                    </div>
                    <i className="bi bi-chevron-right text-muted fs-6"></i>
                  </div>

                  {/* PRODUK & LAYANAN */}
                  <div
                    role="button"
                    className="list-group-item list-group-item-action p-3 d-flex align-items-center justify-content-between border-0 border-bottom"
                    onClick={() => selectTab('product')}
                  >
                    <div className="d-flex align-items-center gap-3">
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                        style={{ width: '40px', height: '40px', backgroundColor: '#f5f3ff', color: '#6366f1' }}
                      >
                        <i className="bi bi-grid-fill fs-5"></i>
                      </div>
                      <div>
                        <h6 className="fw-bold mb-0.5 text-dark" style={{ fontSize: '0.9rem' }}>
                          Layanan
                        </h6>
                        <small className="text-muted" style={{ fontSize: '0.74rem' }}>
                          Kelola layanan dan harga jual
                        </small>
                      </div>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      {products && products.length > 0 && (
                        <span className="badge bg-primary-subtle text-primary rounded-pill px-2.5 py-1" style={{ fontSize: '0.72rem' }}>
                          {products.length} Layanan
                        </span>
                      )}
                      <i className="bi bi-chevron-right text-muted fs-6"></i>
                    </div>
                  </div>

                  {/* FORMAT NOTA & STRUK */}
                  <div
                    role="button"
                    className="list-group-item list-group-item-action p-3 d-flex align-items-center justify-content-between border-0"
                    onClick={() => selectTab('struk')}
                  >
                    <div className="d-flex align-items-center gap-3">
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                        style={{ width: '40px', height: '40px', backgroundColor: '#ecfdf5', color: '#059669' }}
                      >
                        <i className="bi bi-receipt fs-5"></i>
                      </div>
                      <div>
                        <h6 className="fw-bold mb-0.5 text-dark" style={{ fontSize: '0.9rem' }}>
                          Format Nota & Struk
                        </h6>
                        <small className="text-muted" style={{ fontSize: '0.74rem' }}>
                          Header struk, footer, link tracking order
                        </small>
                      </div>
                    </div>
                    <i className="bi bi-chevron-right text-muted fs-6"></i>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 2: PENGGUNA & KEAMANAN */}
            <div className="mb-3">
              <div className="text-muted small fw-bold px-1 mb-2 text-uppercase" style={{ fontSize: '0.72rem', letterSpacing: '0.5px' }}>
                Pengguna & Keamanan
              </div>
              <div className="card border-0 shadow-sm rounded-4 bg-white overflow-hidden">
                <div className="list-group list-group-flush">
                  {/* MANAJEMEN KASIR (OWNER ONLY) */}
                  {isOwner && (
                    <div
                      role="button"
                      className="list-group-item list-group-item-action p-3 d-flex align-items-center justify-content-between border-0 border-bottom"
                      onClick={() => selectTab('kasir')}
                    >
                      <div className="d-flex align-items-center gap-3">
                        <div
                          className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                          style={{ width: '40px', height: '40px', backgroundColor: '#fffbeb', color: '#d97706' }}
                        >
                          <i className="bi bi-people-fill fs-5"></i>
                        </div>
                        <div>
                          <h6 className="fw-bold mb-0.5 text-dark" style={{ fontSize: '0.9rem' }}>
                            Manajemen Kasir
                          </h6>
                          <small className="text-muted" style={{ fontSize: '0.74rem' }}>
                            Daftar akun pegawai kasir & hak akses toko
                          </small>
                        </div>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        {users && users.length > 0 && (
                          <span className="badge bg-warning-subtle text-dark rounded-pill px-2.5 py-1" style={{ fontSize: '0.72rem' }}>
                            {users.length} Kasir
                          </span>
                        )}
                        <i className="bi bi-chevron-right text-muted fs-6"></i>
                      </div>
                    </div>
                  )}

                  {/* UBAH PASSWORD */}
                  <div
                    role="button"
                    className="list-group-item list-group-item-action p-3 d-flex align-items-center justify-content-between border-0"
                    onClick={() => selectTab('password')}
                  >
                    <div className="d-flex align-items-center gap-3">
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                        style={{ width: '40px', height: '40px', backgroundColor: '#f1f5f9', color: '#475569' }}
                      >
                        <i className="bi bi-shield-lock-fill fs-5"></i>
                      </div>
                      <div>
                        <h6 className="fw-bold mb-0.5 text-dark" style={{ fontSize: '0.9rem' }}>
                          Ubah Password
                        </h6>
                        <small className="text-muted" style={{ fontSize: '0.74rem' }}>
                          Ganti kata sandi login untuk keamanan akun
                        </small>
                      </div>
                    </div>
                    <i className="bi bi-chevron-right text-muted fs-6"></i>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 3: LANGGANAN & LOGOUT */}
            <div className="mb-4">
              <div className="text-muted small fw-bold px-1 mb-2 text-uppercase" style={{ fontSize: '0.72rem', letterSpacing: '0.5px' }}>
                Lainnya
              </div>
              <div className="card border-0 shadow-sm rounded-4 bg-white overflow-hidden">
                <div className="list-group list-group-flush">
                  {/* PLAN / PAKET (JIKA SUBSCRIPTION DIAKTIFKAN) */}
                  {isOwner && (
                    <div
                      role="button"
                      className="list-group-item list-group-item-action p-3 d-flex align-items-center justify-content-between border-0 border-bottom"
                      onClick={() => navigate('/plan')}
                    >
                      <div className="d-flex align-items-center gap-3">
                        <div
                          className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                          style={{ width: '40px', height: '40px', backgroundColor: '#fefce8', color: '#ca8a04' }}
                        >
                          <i className="bi bi-gem fs-5"></i>
                        </div>
                        <div>
                          <h6 className="fw-bold mb-0.5 text-dark" style={{ fontSize: '0.9rem' }}>
                            Paket Langganan
                          </h6>
                          <small className="text-muted" style={{ fontSize: '0.74rem' }}>
                            Status paket toko, kuota transaksi & upgrade
                          </small>
                        </div>
                      </div>
                      <i className="bi bi-chevron-right text-muted fs-6"></i>
                    </div>
                  )}

                  {/* RESET CACHE */}
                  <div
                    role="button"
                    className="list-group-item list-group-item-action p-3 d-flex align-items-center justify-content-between border-0 border-bottom"
                    onClick={() => navigate('/reset')}
                  >
                    <div className="d-flex align-items-center gap-3">
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                        style={{ width: '40px', height: '40px', backgroundColor: '#e0f2fe', color: '#0284c7' }}
                      >
                        <i className="bi bi-arrow-repeat fs-5"></i>
                      </div>
                      <div>
                        <h6 className="fw-bold mb-0.5 text-dark" style={{ fontSize: '0.9rem' }}>
                          Reset Cache
                        </h6>
                        <small className="text-muted" style={{ fontSize: '0.74rem' }}>
                          Bersihkan dan perbarui data offline
                        </small>
                      </div>
                    </div>
                    <i className="bi bi-chevron-right text-muted fs-6"></i>
                  </div>

                  {/* INSTALL APLIKASI */}
                  <div
                    role="button"
                    className="list-group-item list-group-item-action p-3 d-flex align-items-center justify-content-between border-0 border-top"
                    onClick={() => setShowInstallPopup(true)}
                  >
                    <div className="d-flex align-items-center gap-3">
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                        style={{ width: '40px', height: '40px', backgroundColor: '#eff6ff', color: '#0134d4' }}
                      >
                        <i className="bi bi-phone fs-5"></i>
                      </div>
                      <div>
                        <h6 className="fw-bold mb-0.5 text-dark" style={{ fontSize: '0.9rem' }}>
                          Install Aplikasi
                        </h6>
                        <small className="text-muted" style={{ fontSize: '0.74rem' }}>
                          Pasang aplikasi kasir di smartphone.
                        </small>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm rounded-pill px-2.5 py-1 fw-bold flex-shrink-0 d-flex align-items-center gap-1 shadow-xs"
                      style={{ fontSize: '11px', backgroundColor: '#0134d4', color: '#fff', border: 'none' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowInstallPopup(true);
                      }}
                    >
                      <i className="bi bi-phone"></i>
                      <span>Install</span>
                    </button>
                  </div>

                  {/* LOGOUT */}
                  <div
                    role="button"
                    className="list-group-item list-group-item-action p-3 d-flex align-items-center justify-content-between border-0"
                    onClick={() => setShowLogoutModal(true)}
                  >
                    <div className="d-flex align-items-center gap-3">
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                        style={{ width: '40px', height: '40px', backgroundColor: '#fef2f2', color: '#dc2626' }}
                      >
                        <i className="bi bi-box-arrow-right fs-5"></i>
                      </div>
                      <div>
                        <h6 className="fw-bold mb-0.5 text-danger" style={{ fontSize: '0.9rem' }}>
                          Keluar Akun
                        </h6>
                        <small className="text-muted" style={{ fontSize: '0.74rem' }}>
                          Akhiri sesi login pada perangkat ini
                        </small>
                      </div>
                    </div>
                    <i className="bi bi-chevron-right text-muted fs-6"></i>
                  </div>
                  {/* LOGOUT */}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* NOTIFIKASI KHUSUS JIKA BUKAN OWNER (Kecuali tab struk & product di mana kasir diperbolehkan edit) */}
        {activeTab && activeTab !== 'struk' && activeTab !== 'product' && !isOwner && (
          <div
            className="alert alert-warning border-0 rounded-4 py-2 px-3 small d-flex align-items-center gap-2 mb-3 shadow-sm"
            style={{ backgroundColor: '#fff9e6', color: '#8a6200', fontSize: '0.78rem' }}
          >
            <i className="bi bi-shield-lock-fill fs-6 text-warning"></i>
            <span>{STATUS_TEXT.READ_ONLY}</span>
          </div>
        )}

        {/* ======================================================== */}
        {/* BAGIAN 1: PENGATURAN UMUM (PROFIL TOKO & OPERASIONAL)     */}
        {/* ======================================================== */}
        {activeTab === 'umum' && (
          <form onSubmit={handleSaveSettings}>
            {/* CARD 1A: PROFIL TOKO */}
            <div className="card border-0 shadow-sm rounded-4 mb-3 bg-white overflow-hidden">
              <div className="px-3 pt-3 pb-2 border-bottom bg-white d-flex align-items-center gap-2">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center text-primary flex-shrink-0"
                  style={{ width: '32px', height: '32px', backgroundColor: '#eaf1ff' }}
                >
                  <i className="bi bi-shop fs-6"></i>
                </div>
                <div>
                  <h6 className="fw-bold mb-0 text-dark" style={{ fontSize: '0.9rem' }}>Profil Laundry</h6>
                  <small className="text-muted" style={{ fontSize: '0.72rem' }}>Identitas usaha laundry Anda</small>
                </div>
              </div>

              <div className="p-3 d-flex flex-column gap-3">
                {/* Nama Laundry */}
                <div>
                  <label className="text-muted small fw-semibold mb-1 d-block" style={{ fontSize: '0.74rem' }}>
                    NAMA LAUNDRY <span className="text-danger">*</span>
                  </label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-0 text-muted rounded-start-3">
                      <i className="bi bi-tag-fill"></i>
                    </span>
                    <input
                      type="text"
                      className="form-control bg-light border-0 py-2 rounded-end-3 text-dark fw-semibold"
                      style={{ fontSize: '0.88rem' }}
                      value={formData.namaLaundry}
                      onChange={(e) => setFormData({ ...formData, namaLaundry: e.target.value })}
                      placeholder="Contoh: Laundry Bersih"
                      required
                      disabled={!isOwner}
                    />
                  </div>
                </div>

                {/* Motto / Tagline */}
                <div>
                  <label className="text-muted small fw-semibold mb-1 d-block" style={{ fontSize: '0.74rem' }}>
                    MOTTO / SLOGAN
                  </label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-0 text-muted rounded-start-3">
                      <i className="bi bi-chat-quote-fill"></i>
                    </span>
                    <input
                      type="text"
                      className="form-control bg-light border-0 py-2 rounded-end-3 text-dark fw-semibold"
                      style={{ fontSize: '0.88rem' }}
                      value={formData.motto}
                      onChange={(e) => setFormData({ ...formData, motto: e.target.value })}
                      placeholder="Contoh: Solusi Cuci Bersih & Wangi"
                      disabled={!isOwner}
                    />
                  </div>
                </div>

                {/* Alamat Toko */}
                <div>
                  <label className="text-muted small fw-semibold mb-1 d-block" style={{ fontSize: '0.74rem' }}>
                    ALAMAT LENGKAP <span className="text-danger">*</span>
                  </label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-0 text-muted rounded-start-3 align-items-start pt-2">
                      <i className="bi bi-geo-alt-fill"></i>
                    </span>
                    <textarea
                      className="form-control bg-light border-0 py-2 rounded-end-3 text-dark fw-semibold"
                      style={{ fontSize: '0.88rem' }}
                      rows="2"
                      value={formData.alamat}
                      onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
                      placeholder="Contoh: Jl. Ahmad Yani No. 45"
                      required
                      disabled={!isOwner}
                    />
                  </div>
                </div>

                {/* Kota / Kabupaten */}
                <div>
                  <label className="text-muted small fw-semibold mb-1 d-block" style={{ fontSize: '0.74rem' }}>
                    KOTA / KABUPATEN <span className="text-danger">*</span>
                  </label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-0 text-muted rounded-start-3">
                      <i className="bi bi-building"></i>
                    </span>
                    <input
                      type="text"
                      className="form-control bg-light border-0 py-2 rounded-end-3 text-dark fw-semibold"
                      style={{ fontSize: '0.88rem' }}
                      value={formData.kota}
                      onChange={(e) => setFormData({ ...formData, kota: e.target.value })}
                      placeholder="Contoh: Karawang"
                      required
                      disabled={!isOwner}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 1B: KONTAK & JAM OPERASIONAL */}
            <div className="card border-0 shadow-sm rounded-4 mb-4 bg-white overflow-hidden">
              <div className="px-3 pt-3 pb-2 border-bottom bg-white d-flex align-items-center gap-2">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center text-success flex-shrink-0"
                  style={{ width: '32px', height: '32px', backgroundColor: '#e6f9ed' }}
                >
                  <i className="bi bi-telephone-fill fs-6"></i>
                </div>
                <div>
                  <h6 className="fw-bold mb-0 text-dark" style={{ fontSize: '0.9rem' }}>Kontak & Operasional</h6>
                  <small className="text-muted" style={{ fontSize: '0.72rem' }}>Saluran WhatsApp dan jam kerja</small>
                </div>
              </div>

              <div className="p-3 d-flex flex-column gap-3">
                <div className="row g-2">
                  {/* WhatsApp */}
                  <div className="col-12 col-sm-6">
                    <label className="text-muted small fw-semibold mb-1 d-block" style={{ fontSize: '0.74rem' }}>
                      NOMOR WHATSAPP <span className="text-danger">*</span>
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-light border-0 text-success rounded-start-3">
                        <i className="bi bi-whatsapp"></i>
                      </span>
                      <input
                        type="tel"
                        className="form-control bg-light border-0 py-2 rounded-end-3 text-dark fw-semibold"
                        style={{ fontSize: '0.88rem' }}
                        value={formData.telepon}
                        onChange={(e) => setFormData({ ...formData, telepon: e.target.value })}
                        placeholder="08123456789"
                        required
                        disabled={!isOwner}
                      />
                    </div>
                  </div>

                  {/* Jam Buka */}
                  <div className="col-12 col-sm-6">
                    <label className="text-muted small fw-semibold mb-1 d-block" style={{ fontSize: '0.74rem' }}>
                      JAM OPERASIONAL <span className="text-danger">*</span>
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-light border-0 text-muted rounded-start-3">
                        <i className="bi bi-clock-fill"></i>
                      </span>
                      <input
                        type="text"
                        className="form-control bg-light border-0 py-2 rounded-end-3 text-dark fw-semibold"
                        style={{ fontSize: '0.88rem' }}
                        value={formData.jamBuka}
                        onChange={(e) => setFormData({ ...formData, jamBuka: e.target.value })}
                        placeholder="08.00 - 17.00"
                        required
                        disabled={!isOwner}
                      />
                    </div>
                  </div>
                </div>

                {/* Switch Status Menerima Cucian (Shopee Mobile Style) */}
                <div
                  className="d-flex align-items-center justify-content-between p-3 rounded-3"
                  style={{ backgroundColor: '#f8fafc', border: '1px solid #edf2f7' }}
                >
                  <div className="pe-2">
                    <h6 className="mb-0 fw-bold text-dark" style={{ fontSize: '0.88rem' }}>Status Menerima Cucian</h6>
                    <small className="text-muted d-block" style={{ fontSize: '0.72rem' }}>
                      {formData.menerimaCucian ? STATUS_TEXT.STORE_OPEN : STATUS_TEXT.STORE_CLOSED}
                    </small>
                  </div>
                  <div className="form-check form-switch m-0 p-0 d-flex align-items-center">
                    <input
                      className="form-check-input ms-0"
                      type="checkbox"
                      role="switch"
                      checked={formData.menerimaCucian}
                      onChange={(e) => setFormData({ ...formData, menerimaCucian: e.target.checked })}
                      style={{ width: '46px', height: '24px', cursor: isOwner ? 'pointer' : 'default' }}
                      disabled={!isOwner}
                    />
                  </div>
                </div>

                {/* Switch Status Toko Tutup (Jika tutup transaksi kasir diblokir) */}
                <div
                  className="d-flex align-items-center justify-content-between p-3 rounded-3"
                  style={{
                    backgroundColor: formData.isTokoTutup ? '#fef2f2' : '#f8fafc',
                    border: formData.isTokoTutup ? '1px solid #fecaca' : '1px solid #edf2f7',
                  }}
                >
                  <div className="pe-2">
                    <div className="d-flex align-items-center gap-1.5 mb-0.5">
                      <h6 className="mb-0 fw-bold text-dark" style={{ fontSize: '0.88rem' }}>Toko Tutup</h6>
                      {formData.isTokoTutup ? (
                        <span className="badge bg-danger text-white rounded-pill px-2 py-0.5" style={{ fontSize: '0.65rem' }}>
                          🔴 Tutup
                        </span>
                      ) : (
                        <span className="badge bg-success-subtle text-success rounded-pill px-2 py-0.5" style={{ fontSize: '0.65rem' }}>
                          🟢 Buka
                        </span>
                      )}
                    </div>
                    <small className={formData.isTokoTutup ? 'text-danger fw-semibold d-block' : 'text-muted d-block'} style={{ fontSize: '0.72rem' }}>
                      {formData.isTokoTutup
                        ? 'Toko dalam keadaan tutup. Semua transaksi kasir diblokir.'
                        : 'Toko beroperasi normal. Transaksi kasir dapat dilakukan.'}
                    </small>
                  </div>
                  <div className="form-check form-switch m-0 p-0 d-flex align-items-center">
                    <input
                      className="form-check-input ms-0"
                      type="checkbox"
                      role="switch"
                      checked={Boolean(formData.isTokoTutup)}
                      onChange={(e) => setFormData({ ...formData, isTokoTutup: e.target.checked })}
                      style={{ width: '46px', height: '24px', cursor: isOwner ? 'pointer' : 'default' }}
                      disabled={!isOwner}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* STICKY BOTTOM ACTION BUTTON */}
            {isOwner && (
              <button
                type="submit"
                className="btn btn-outline-primary w-100 rounded-pill py-3 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2"
                disabled={isSaving}
                style={{ fontSize: '0.92rem' }}
              >
                {isSaving ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status"></span>
                    <span>{BUTTON_TEXT.SAVING}</span>
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-circle-fill fs-5"></i>
                    <span>{BUTTON_TEXT.SAVE}</span>
                  </>
                )}
              </button>
            )}

          </form>
        )}

        {/* ======================================================== */}
        {/* BAGIAN 2: PENGATURAN FORMAT STRUK / NOTA                  */}
        {/* ======================================================== */}
        {activeTab === 'struk' && (
          <form onSubmit={handleSaveSettings}>
            <div className="card border-0 shadow-sm rounded-4 mb-3 bg-white overflow-hidden">
              <div className="px-3 pt-3 pb-2 border-bottom bg-white d-flex align-items-center gap-2">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center text-primary flex-shrink-0"
                  style={{ width: '32px', height: '32px', backgroundColor: '#eaf1ff' }}
                >
                  <i className="bi bi-printer-fill fs-6"></i>
                </div>
                <div>
                  <h6 className="fw-bold mb-0 text-dark" style={{ fontSize: '0.9rem' }}>Pesan Pada Struk</h6>
                  <small className="text-muted" style={{ fontSize: '0.72rem' }}>Teks yang dicetak di atas dan bawah nota</small>
                </div>
              </div>

              <div className="p-3 d-flex flex-column gap-3">
                {/* Header Struk */}
                <div>
                  <label className="text-muted small fw-semibold mb-1 d-block" style={{ fontSize: '0.74rem' }}>
                    HEADER STRUK (PESAN ATAS)
                  </label>
                  <input
                    type="text"
                    className="form-control bg-light border-0 py-2 rounded-3 text-dark fw-semibold"
                    style={{ fontSize: '0.88rem' }}
                    value={formData.headerStruk}
                    onChange={(e) => setFormData({ ...formData, headerStruk: e.target.value })}
                    placeholder="Contoh: Terima kasih atas kunjungan anda"
                  />
                  <small className="text-muted d-block mt-1" style={{ fontSize: '0.7rem' }}>
                    Muncul tepat di bawah nama & alamat laundry pada struk thermal.
                  </small>
                </div>

                {/* Footer Struk */}
                <div>
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <label className="text-muted small fw-semibold mb-0" style={{ fontSize: '0.74rem' }}>
                      FOOTER STRUK (PESAN BAWAH)
                    </label>
                    <div className="d-flex gap-1">
                      <span className={`badge rounded-pill ${isFooterLinkOrder(formData.footerStruk) ? 'bg-success' : 'bg-light text-muted border'}`} style={{ fontSize: '0.65rem' }}>
                        Thermal: {isFooterLinkOrder(formData.footerStruk) ? 'Link ON' : 'Link OFF'}
                      </span>
                      <span className={`badge rounded-pill ${isFooterBarcode(formData.footerStruk) ? 'bg-primary' : 'bg-light text-muted border'}`} style={{ fontSize: '0.65rem' }}>
                        PDF: {isFooterBarcode(formData.footerStruk) ? 'Barcode ON' : 'Barcode OFF'}
                      </span>
                    </div>
                  </div>
                  <textarea
                    className="form-control bg-light border-0 py-2 rounded-3 text-dark fw-semibold"
                    style={{ fontSize: '0.88rem' }}
                    rows="3"
                    value={formData.footerStruk}
                    onChange={(e) => setFormData({ ...formData, footerStruk: e.target.value })}
                    placeholder="Gunakan LINK_ORDER untuk link thermal, atau INVOICE untuk barcode PDF/Invoice."
                  />
                  <div className="d-flex flex-wrap gap-2 mt-2">
                    <button
                      type="button"
                      className={`btn btn-sm rounded-pill py-1 px-3 d-flex align-items-center gap-1 shadow-none ${isFooterLinkOrder(formData.footerStruk) ? 'btn-success text-white' : 'btn-outline-success'
                        }`}
                      style={{ fontSize: '0.72rem' }}
                      onClick={() => {
                        const current = (formData.footerStruk || '').trim();
                        if (isFooterLinkOrder(current)) {
                          // Toggle off: hapus token LINK_ORDER
                          const updated = current
                            .replace(/\{?\[?LINK_ORDER\]?\}?/gi, '')
                            .replace(/^\s*[\r\n]/gm, '')
                            .trim();
                          setFormData({ ...formData, footerStruk: updated });
                        } else {
                          // Toggle on: tambahkan token LINK_ORDER
                          setFormData({
                            ...formData,
                            footerStruk: current ? `${current}\nLINK_ORDER` : 'LINK_ORDER',
                          });
                        }
                      }}
                      title="Klik untuk mengaktifkan/menonaktifkan link pada struk thermal"
                    >
                      <i className="bi bi-link-45deg"></i>
                      {isFooterLinkOrder(formData.footerStruk) ? '✓ LINK_ORDER (Thermal Link Aktif)' : '+ LINK_ORDER (Thermal Link)'}
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm rounded-pill py-1 px-3 d-flex align-items-center gap-1 shadow-none ${isFooterBarcode(formData.footerStruk) ? 'btn-primary text-white' : 'btn-outline-primary'
                        }`}
                      style={{ fontSize: '0.72rem' }}
                      onClick={() => {
                        const current = (formData.footerStruk || '').trim();
                        if (isFooterBarcode(current)) {
                          // Toggle off: hapus token INVOICE/BARCODE
                          const updated = current
                            .replace(/\{?\[?(?:INVOICE|BARCODE)\]?\}?/gi, '')
                            .replace(/^\s*[\r\n]/gm, '')
                            .trim();
                          setFormData({ ...formData, footerStruk: updated });
                        } else {
                          // Toggle on: tambahkan token INVOICE
                          setFormData({
                            ...formData,
                            footerStruk: current ? `${current}\nINVOICE` : 'INVOICE',
                          });
                        }
                      }}
                      title="Klik untuk mengaktifkan/menonaktifkan barcode pada nota PDF/A4"
                    >
                      <i className="bi bi-upc-scan"></i>
                      {isFooterBarcode(formData.footerStruk) ? '✓ INVOICE (Barcode PDF Aktif)' : '+ INVOICE (Barcode PDF)'}
                    </button>
                  </div>
                  <small className="text-muted d-block mt-2" style={{ fontSize: '0.7rem' }}>
                    <i className="bi bi-info-circle me-1"></i>
                    <strong>Pengaturan Terpisah:</strong>
                    Tulis <strong>LINK_ORDER</strong> hanya untuk mengaktifkan link <em>"Cek Status Cucian"</em> di struk thermal.
                    Tulis <strong>INVOICE</strong> hanya untuk mengaktifkan <em>Barcode</em> di nota PDF/Invoice (keduanya tidak digabung).
                  </small>
                </div>
              </div>
            </div>

            {/* LIVE PREVIEW MINI STRUK THERMAL */}
            <div className="card border-0 shadow-sm rounded-4 mb-4 bg-white overflow-hidden">
              <div className="px-3 py-2 bg-light border-bottom d-flex align-items-center justify-content-between">
                <small className="fw-bold text-muted" style={{ fontSize: '0.75rem' }}>
                  <i className="bi bi-eye me-1"></i> SIMULASI STRUK THERMAL (58MM)
                </small>
                <span className="badge bg-secondary-subtle text-secondary rounded-pill" style={{ fontSize: '0.65rem' }}>
                  Live Preview
                </span>
              </div>
              <div className="p-3 bg-light d-flex justify-content-center">
                <div
                  className="bg-white p-3 shadow-sm rounded-2 font-monospace text-dark text-center"
                  style={{
                    width: '240px',
                    fontSize: '11px',
                    lineHeight: '1.3',
                    border: '1px dashed #cbd5e1',
                  }}
                >
                  <div className="fw-bold text-uppercase">{formData.namaLaundry || 'NAMA LAUNDRY'}</div>
                  <div style={{ fontSize: '9px' }}>{formData.alamat || 'Alamat Toko'}</div>
                  <div style={{ fontSize: '9px' }}>WA: {formData.telepon || '08...'}</div>
                  {formData.headerStruk && (
                    <div className="my-1 border-top border-bottom py-1 text-muted" style={{ fontSize: '9px' }}>
                      {formData.headerStruk}
                    </div>
                  )}
                  <div className="my-1 text-start" style={{ borderBottom: '1px dashed #000', paddingBottom: '3px' }}>
                    <div>No : #8126-00001</div>
                    <div>Tgl: {new Date().toLocaleDateString('id-ID')}</div>
                  </div>
                  <div className="text-start my-1" style={{ borderBottom: '1px dashed #000', paddingBottom: '3px' }}>
                    <div className="d-flex justify-content-between">
                      <span>Cuci Komplit (3kg)</span>
                      <span>21.000</span>
                    </div>
                    <div className="d-flex justify-content-between fw-bold pt-1">
                      <span>TOTAL</span>
                      <span>21.000</span>
                    </div>
                  </div>
                  <div className="mt-2 text-muted" style={{ fontSize: '9px', whiteSpace: 'pre-wrap' }}>
                    {cleanReceiptFooterText(formData.footerStruk) || 'Terima kasih atas kepercayaan Anda'}
                    {/* Thermal: HANYA tampilkan link jika LINK_ORDER aktif (TIDAK ADA barcode) */}
                    {isFooterLinkOrder(formData.footerStruk) && (
                      <div className="mt-2 pt-1 text-center" style={{ borderTop: '1px dotted #000' }}>
                        <div className="fw-bold text-dark">Cek Status Cucian:</div>
                        <div style={{ wordBreak: 'break-all', color: '#0d5afd' }}>{getReceiptTrackingUrl('8126-00001')}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* STICKY BOTTOM ACTION BUTTON (Kasir & Owner Boleh Simpan Format Struk & Preferensi) */}
            <button
              type="submit"
              className="btn btn-outline-primary w-100 rounded-pill py-3 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2"
              disabled={isSaving}
              style={{ fontSize: '0.92rem' }}
            >
              {isSaving ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status"></span>
                  <span>{BUTTON_TEXT.SAVING}</span>
                </>
              ) : (
                <>
                  <i className="bi bi-check-circle-fill fs-5"></i>
                  <span>{BUTTON_TEXT.SAVE}</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* ======================================================== */}
        {/* BAGIAN 3: MANAJEMEN PEGAWAI KASIR                         */}
        {/* ======================================================== */}
        {activeTab === 'kasir' && isOwner && (
          <div>
            {/* ACTION HEADER */}
            <div className="d-flex justify-content-between align-items-center mb-3 px-1">
              <div>
                <h6 className="fw-bold mb-0 text-dark">Daftar Akun Kasir</h6>
                <small className="text-muted" style={{ fontSize: '0.74rem' }}>
                  Total {users?.length || 0} kasir terdaftar di toko ini
                </small>
              </div>
              <button
                type="button"
                className="btn btn-outline-primary btn-sm rounded-pill px-3 py-2 fw-semibold d-flex align-items-center gap-1 shadow-sm"
                onClick={() => openUserModal()}
                title={BUTTON_TITLE.ADD_USER}
                style={{ fontSize: '0.5rem' }}
              >
                <i className="bi bi-plus-lg" style={{ fontSize: '0.8rem' }}></i>
              </button>
            </div>

            {/* LIST KASIR (SHOPEE / MOBILE USER CARD) */}
            <div className="d-flex flex-column gap-2 mb-4">
              {!users || users.length === 0 ? (
                <div className="card border-0 shadow-sm rounded-4 p-5 text-center bg-white my-2">
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3"
                    style={{ width: '64px', height: '64px', backgroundColor: '#eaf1ff', color: '#0d5afd' }}
                  >
                    <i className="bi bi-people fs-2"></i>
                  </div>
                  <h6 className="fw-bold text-dark mb-1">Belum Ada Akun Kasir</h6>
                  <p className="text-muted small mb-3">
                    Tambahkan akun pegawai untuk melayani transaksi di kasir.
                  </p>
                  <div>
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm rounded-pill px-4"
                      onClick={() => openUserModal()}
                      title={BUTTON_TITLE.ADD_USER}
                    >
                      <i className="bi bi-plus-lg fs-4"></i>
                    </button>
                  </div>
                </div>
              ) : (
                users.map((u) => (
                  <div
                    key={u.id}
                    className="p-3 bg-white rounded-4 shadow-sm border d-flex align-items-center justify-content-between"
                    style={{ borderColor: '#f1f5f9' }}
                  >
                    <div className="d-flex align-items-center gap-3 overflow-hidden">
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold shadow-xs flex-shrink-0"
                        style={{
                          width: '42px',
                          height: '42px',
                          background: 'linear-gradient(135deg, #0d5afd 0%, #1e40af 100%)',
                          fontSize: '1.05rem',
                        }}
                      >
                        {u.fullname?.charAt(0).toUpperCase() || 'K'}
                      </div>
                      <div className="overflow-hidden">
                        <h6 className="mb-0 fw-bold text-dark text-truncate" style={{ fontSize: '0.9rem' }}>
                          {u.fullname}
                        </h6>
                        <small className="text-muted text-truncate d-block" style={{ fontSize: '0.74rem' }}>
                          <span className="fw-semibold">@{u.username}</span> •{' '}
                          <span className="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill px-2">
                            Kasir
                          </span>
                        </small>
                      </div>
                    </div>

                    <div className="d-flex align-items-center gap-1 flex-shrink-0 ms-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-light rounded-circle text-primary border shadow-xs d-flex align-items-center justify-content-center"
                        style={{ width: '34px', height: '34px' }}
                        onClick={() => openUserModal(u)}
                        title={BUTTON_TITLE.EDIT}
                      >
                        <i className="bi bi-pencil-fill" style={{ fontSize: '0.8rem' }}></i>
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-light rounded-circle text-danger border shadow-xs d-flex align-items-center justify-content-center"
                        style={{ width: '34px', height: '34px' }}
                        onClick={() => deleteUser(u.id)}
                        title={BUTTON_TITLE.DELETE}
                      >
                        <i className="bi bi-trash-fill" style={{ fontSize: '0.8rem' }}></i>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* BAGIAN 4: MASTER LAYANAN (OWNER & KASIR BISA KELOLA)      */}
        {/* ======================================================== */}
        {activeTab === 'product' && (
          <div>
            {/* ACTION HEADER */}
            <div className="d-flex justify-content-between align-items-center mb-3 px-1">
              <div>
                <h6 className="fw-bold mb-0 text-dark">Layanan</h6>
                <small className="text-muted" style={{ fontSize: '0.74rem' }}>
                  Total {products?.length || 0} layanan terdaftar di toko ini
                </small>
              </div>
              <button
                type="button"
                className="btn btn-outline-primary btn-sm rounded-pill px-3 py-2 fw-semibold d-flex align-items-center gap-1 shadow-sm"
                onClick={() => openProductModal()}
                title={BUTTON_TITLE.ADD_PRODUCT}
                style={{ fontSize: '0.8rem' }}
              >
                <i className="bi bi-plus-lg"></i>
              </button>
            </div>

            {/* LIST PRODUK (GAYA SIMPLE SEPERTI MANAJEMEN KASIR) */}
            <div className="d-flex flex-column gap-2 mb-4">
              {products === undefined ? (
                <ProductListSkeleton count={4} />
              ) : products.length === 0 ? (
                <div className="card border-0 shadow-sm rounded-4 p-5 text-center bg-white my-2">
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3"
                    style={{ width: '64px', height: '64px', backgroundColor: '#eaf1ff', color: '#0d5afd' }}
                  >
                    <i className="bi bi-tag fs-2"></i>
                  </div>
                  <h6 className="fw-bold text-dark mb-1">Belum Ada Layanan</h6>
                  <p className="text-muted small mb-3">
                    Tambahkan layanan laundry yang ditawarkan oleh toko Anda.
                  </p>
                  <div>
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm rounded-pill px-4"
                      onClick={() => openProductModal()}
                      title={BUTTON_TITLE.ADD_PRODUCT}
                    >
                      <i className="bi bi-plus-lg fs-4"></i>
                    </button>
                  </div>
                </div>
              ) : (
                products.slice(0, visibleProductCount).map((p) => {
                  const isSetrika = p.category?.includes('SETRIKA');
                  return (
                    <div
                      key={p.id}
                      className="p-3 bg-white rounded-4 shadow-sm border d-flex align-items-center justify-content-between gap-2"
                      style={{ borderColor: '#f1f5f9' }}
                    >
                      <div className="d-flex align-items-center gap-3 overflow-hidden flex-grow-1 min-w-0">
                        <div
                          className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold shadow-xs flex-shrink-0"
                          style={{
                            width: '42px',
                            height: '42px',
                            background: isSetrika
                              ? 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)'
                              : 'linear-gradient(135deg, #0d5afd 0%, #1e40af 100%)',
                            fontSize: '1rem',
                          }}
                        >
                          <i className={`bi ${isSetrika ? 'bi-fire' : 'bi-water'}`}></i>
                        </div>
                        <div className="overflow-hidden flex-grow-1 min-w-0">
                          <h6 className="mb-1 fw-bold text-dark text-truncate" style={{ fontSize: '0.7rem' }}>
                            {p.name}
                          </h6>
                          <div className="d-flex align-items-center gap-1.5 flex-wrap">
                            <span className="badge bg-primary-subtle text-dark border border-primary-subtle rounded-pill px-2 py-0.5" style={{ fontSize: '0.6rem' }}>
                              {p.category || FALLBACK_CATEGORY} ({p.code})
                            </span>
                            <span className="fw-bold text-primary ms-1" style={{ fontSize: '0.8rem' }}>
                              Rp {Number(p.price || 0).toLocaleString('id-ID')}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="d-flex align-items-center gap-1 flex-shrink-0 ms-1">
                        <button
                          type="button"
                          className="btn btn-sm btn-light rounded-circle text-primary border shadow-xs d-flex align-items-center justify-content-center"
                          style={{ width: '34px', height: '34px' }}
                          onClick={() => openProductModal(p)}
                          title={BUTTON_TITLE.EDIT}
                        >
                          <i className="bi bi-pencil-fill" style={{ fontSize: '0.8rem' }}></i>
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-light rounded-circle text-danger border shadow-xs d-flex align-items-center justify-content-center"
                          style={{ width: '34px', height: '34px' }}
                          onClick={() => confirmDeleteProduct(p)}
                          title={BUTTON_TITLE.DELETE}
                        >
                          <i className="bi bi-trash-fill" style={{ fontSize: '0.8rem' }}></i>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Button View More untuk Layanan jika data lebih dari 10 */}
              {products && products.length > visibleProductCount && (
                <div className="text-center my-3">
                  <button
                    type="button"
                    className="btn btn-outline-primary rounded-pill px-4 py-2 fw-semibold shadow-xs d-inline-flex align-items-center gap-2"
                    style={{ fontSize: '0.84rem' }}
                    onClick={() => setVisibleProductCount((prev) => prev + 10)}
                  >
                    <span>View More</span>
                    <span className="badge bg-primary text-white rounded-pill px-2 py-0.5" style={{ fontSize: '0.68rem' }}>
                      +{products.length - visibleProductCount}
                    </span>
                    <i className="bi bi-chevron-down"></i>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* BAGIAN 5: UBAH PASSWORD (SEMUA ROLE)                     */}
        {/* ======================================================== */}
        {activeTab === 'password' && (
          <UbahPassword user={user} isEmbedded={true} />
        )}

      </div>

      {/* ======================================================== */}
      {/* MODAL TAMBAH / EDIT PRODUK (SHOPEE MOBILE SHEET STYLE)     */}
      {/* ======================================================== */}
      {showProductModal && (
        <>
          <div
            className="modal-backdrop fade show"
            style={{ backdropFilter: 'blur(5px)', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}
            onClick={() => setShowProductModal(false)}
          ></div>
          <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1065 }}>
            <div className="modal-dialog modal-dialog-centered mx-auto" style={{ maxWidth: '420px' }}>
              <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                <div className="modal-header border-bottom px-4 py-3 bg-white">
                  <div className="d-flex align-items-center gap-2">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center text-primary"
                      style={{ width: '32px', height: '32px', backgroundColor: '#eaf1ff' }}
                    >
                      <i className={`bi ${editingProduct ? 'bi-pencil-square' : 'bi-plus-circle-fill'}`}></i>
                    </div>
                    <h6 className="fw-bold mb-0 text-dark">
                      {editingProduct ? 'Edit Layanan' : 'Tambah Layanan Baru'}
                    </h6>
                  </div>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowProductModal(false)}
                  ></button>
                </div>

                <form onSubmit={handleProductSave}>
                  <div className="modal-body p-4 d-flex flex-column gap-3">
                    {/* Nama Layanan */}
                    <div>
                      <label className="text-muted small fw-semibold mb-1 d-block" style={{ fontSize: '0.74rem' }}>
                        NAMA LAYANAN <span className="text-danger">*</span>
                      </label>
                      <div className="input-group">
                        <span className="input-group-text bg-light border-0 text-muted rounded-start-3">
                          <i className="bi bi-tag-fill"></i>
                        </span>
                        <input
                          type="text"
                          className="form-control bg-light border-0 py-2 rounded-end-3 text-dark fw-semibold"
                          style={{ fontSize: '0.88rem' }}
                          value={productFormData.name}
                          onChange={(e) => setProductFormData({ ...productFormData, name: e.target.value })}
                          placeholder="Contoh: Cuci Lipat Reguler (2-3 hari)"
                          required
                        />
                      </div>
                    </div>

                    {/* Kategori Layanan */}
                    <div>
                      <label className="text-muted small fw-semibold mb-1 d-block" style={{ fontSize: '0.74rem' }}>
                        KATEGORI LAYANAN <span className="text-danger">*</span>
                      </label>
                      <div className="input-group">
                        <span className="input-group-text bg-light border-0 text-muted rounded-start-3">
                          <i className="bi bi-grid-fill"></i>
                        </span>
                        <select
                          className="form-select bg-light border-0 py-2 rounded-end-3 text-dark fw-semibold"
                          style={{ fontSize: '0.88rem' }}
                          value={productFormData.category}
                          onChange={(e) => setProductFormData({ ...productFormData, category: e.target.value })}
                          required
                        >
                          <option value="" disabled>Pilih Kategori...</option>
                          {PRODUCT_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                          {productFormData.category && !PRODUCT_CATEGORIES.includes(productFormData.category) && (
                            <option value={productFormData.category}>{productFormData.category}</option>
                          )}
                        </select>
                      </div>
                    </div>

                    {/* Kode Layanan & Harga */}
                    <div className="row g-2">
                      <div className="col-5">
                        <label className="text-muted small fw-semibold mb-1 d-block" style={{ fontSize: '0.74rem' }}>
                          KODE (OPSIONAL)
                        </label>
                        <input
                          type="text"
                          className="form-control bg-light border-0 py-2 rounded-3 text-dark fw-semibold text-uppercase"
                          style={{ fontSize: '0.88rem' }}
                          value={productFormData.code}
                          onChange={(e) => setProductFormData({ ...productFormData, code: e.target.value })}
                          placeholder="CLR"
                        />
                      </div>
                      <div className="col-7">
                        <label className="text-muted small fw-semibold mb-1 d-block" style={{ fontSize: '0.74rem' }}>
                          HARGA (RP) <span className="text-danger">*</span>
                        </label>
                        <div className="input-group">
                          <span className="input-group-text bg-light border-0 text-muted rounded-start-3 small">
                            Rp
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="500"
                            className="form-control bg-light border-0 py-2 rounded-end-3 text-dark fw-bold"
                            style={{ fontSize: '0.88rem' }}
                            value={productFormData.price}
                            onChange={(e) => setProductFormData({ ...productFormData, price: e.target.value })}
                            placeholder="5000"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="modal-footer border-0 px-4 pb-4 pt-0">
                    <button
                      type="submit"
                      className="btn btn-outline-primary rounded-pill py-2 fw-bold shadow-sm"
                      style={{ fontSize: '0.88rem' }}
                    >
                      <i className="bi bi-check2-circle me-1"></i>
                      <span>{BUTTON_TEXT.SAVE}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ======================================================== */}
      {/* MODAL TAMBAH / EDIT KASIR (SHOPEE MOBILE SHEET STYLE)     */}
      {/* ======================================================== */}
      {showUserModal && (
        <>
          <div
            className="modal-backdrop fade show"
            style={{ backdropFilter: 'blur(5px)', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}
            onClick={() => setShowUserModal(false)}
          ></div>
          <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1065 }}>
            <div className="modal-dialog modal-dialog-centered mx-auto" style={{ maxWidth: '400px' }}>
              <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                <div className="modal-header border-bottom px-4 py-3 bg-white">
                  <div className="d-flex align-items-center gap-2">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center text-primary"
                      style={{ width: '32px', height: '32px', backgroundColor: '#eaf1ff' }}
                    >
                      <i className={`bi ${editingUser ? 'bi-pencil-square' : 'bi-person-plus-fill'}`}></i>
                    </div>
                    <h6 className="fw-bold mb-0 text-dark">
                      {editingUser ? 'Edit Akun Kasir' : 'Tambah Kasir Baru'}
                    </h6>
                  </div>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowUserModal(false)}
                  ></button>
                </div>

                <form onSubmit={handleUserSave}>
                  <div className="modal-body p-4 d-flex flex-column gap-3">
                    {/* Nama Lengkap */}
                    <div>
                      <label className="text-muted small fw-semibold mb-1 d-block" style={{ fontSize: '0.74rem' }}>
                        NAMA LENGKAP PEGAWAI <span className="text-danger">*</span>
                      </label>
                      <div className="input-group">
                        <span className="input-group-text bg-light border-0 text-muted rounded-start-3">
                          <i className="bi bi-person-fill"></i>
                        </span>
                        <input
                          type="text"
                          className="form-control bg-light border-0 py-2 rounded-end-3 text-dark fw-semibold"
                          style={{ fontSize: '0.88rem' }}
                          value={userFormData.fullname}
                          onChange={(e) => setUserFormData({ ...userFormData, fullname: e.target.value })}
                          placeholder="Contoh: Siti Rahmawati"
                          required
                        />
                      </div>
                    </div>

                    {/* Username */}
                    <div>
                      <label className="text-muted small fw-semibold mb-1 d-block" style={{ fontSize: '0.74rem' }}>
                        USERNAME LOGIN <span className="text-danger">*</span>
                      </label>
                      <div className="input-group">
                        <span className="input-group-text bg-light border-0 text-muted rounded-start-3">
                          <i className="bi bi-at"></i>
                        </span>
                        <input
                          type="text"
                          className="form-control bg-light border-0 py-2 rounded-end-3 text-dark fw-semibold"
                          style={{ fontSize: '0.88rem' }}
                          value={userFormData.username}
                          onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })}
                          placeholder="kasir1"
                          required
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <label className="text-muted small fw-semibold mb-1 d-block" style={{ fontSize: '0.74rem' }}>
                        PASSWORD {editingUser ? '(Opsional)' : <span className="text-danger">*</span>}
                      </label>
                      <div className="input-group">
                        <span className="input-group-text bg-light border-0 text-muted rounded-start-3">
                          <i className="bi bi-lock-fill"></i>
                        </span>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          className="form-control bg-light border-0 py-2 text-dark fw-semibold"
                          style={{ fontSize: '0.88rem' }}
                          value={userFormData.password}
                          onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                          placeholder={editingUser ? 'Kosongkan jika password tetap' : 'Minimal 4 karakter'}
                          required={!editingUser}
                        />
                        <button
                          type="button"
                          className="btn bg-light border-0 text-muted rounded-end-3 px-3"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          <i className={`bi ${showPassword ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`}></i>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="modal-footer border-0 px-4 pb-4 pt-0">
                    <button
                      type="submit"
                      className="btn btn-outline-primary w-100 rounded-pill py-2 fw-bold shadow-sm"
                      style={{ fontSize: '0.88rem' }}
                    >
                      <i className="bi bi-check2-circle me-1"></i>
                      <span>{BUTTON_TEXT.SAVE}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      )}
      {/* POPUP RINGKAS BATAS KASIR */}
      <PlanGateModal
        isOpen={userLimitModal.open}
        onClose={() => setUserLimitModal({ ...userLimitModal, open: false })}
        type="USER_LIMIT"
        customData={{ limit: userLimitModal.limit, plan: userLimitModal.plan }}
        user={user}
      />
      {/* POPUP RINGKAS BATAS PRODUK */}
      <PlanGateModal
        isOpen={productLimitModal.open}
        onClose={() => setProductLimitModal({ ...productLimitModal, open: false })}
        type="PRODUCT_LIMIT"
        customData={{ limit: productLimitModal.limit, plan: productLimitModal.plan }}
        user={user}
      />
      {/* POPUP RINGKAS EXPIRED (TRIAL / PAID) */}
      <PlanGateModal
        isOpen={expiredModal.open}
        onClose={() => setExpiredModal((prev) => ({ ...prev, open: false }))}
        type={expiredModal.type}
        customData={{ plan: expiredModal.plan, isTrial: expiredModal.isTrial }}
        user={user}
      />

      {/* Modal Konfirmasi Logout */}
      {showLogoutModal && (
        <>
          <div
            className="modal-backdrop fade show"
            style={{ backdropFilter: 'blur(5px)', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}
            onClick={() => setShowLogoutModal(false)}
          />
          <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1065 }}>
            <div className="modal-dialog modal-dialog-centered mx-auto" style={{ maxWidth: '340px' }}>
              <div className="modal-content border-0 shadow-lg rounded-4 p-4 text-center bg-white">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3"
                  style={{ width: '56px', height: '56px', backgroundColor: '#fef2f2', color: '#dc2626' }}
                >
                  <i className="bi bi-box-arrow-right fs-3"></i>
                </div>
                <h6 className="fw-bold mb-1 text-dark">Konfirmasi Keluar</h6>
                <p className="text-muted small mb-4">
                  Apakah Anda yakin ingin keluar dari akun kasir/toko ini?
                </p>
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-light rounded-pill flex-fill py-2.5 fw-semibold border text-secondary"
                    onClick={() => setShowLogoutModal(false)}
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger rounded-pill flex-fill py-2.5 fw-semibold shadow-xs"
                    onClick={() => {
                      setShowLogoutModal(false);
                      if (onLogout) onLogout();
                    }}
                  >
                    Ya, Keluar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal Konfirmasi Hapus Layanan Modern */}
      {deleteProductConfirm.show && (
        <>
          <div
            className="modal-backdrop fade show"
            style={{ backdropFilter: 'blur(5px)', backgroundColor: 'rgba(15, 23, 42, 0.55)', zIndex: 1075 }}
            onClick={() => setDeleteProductConfirm({ show: false, product: null })}
          ></div>
          <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1080 }}>
            <div className="modal-dialog modal-dialog-centered mx-auto" style={{ maxWidth: '340px' }}>
              <div className="modal-content border-0 shadow-lg text-center p-4" style={{ borderRadius: '24px' }}>
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3"
                  style={{ width: '56px', height: '56px', backgroundColor: '#fef2f2', color: '#dc2626' }}
                >
                  <i className="bi bi-trash3-fill fs-3"></i>
                </div>
                <h6 className="fw-bold text-dark mb-1">Hapus Layanan?</h6>
                <p className="text-muted small mb-4" style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>
                  Yakin ingin menghapus layanan <strong>&quot;{deleteProductConfirm.product?.name}&quot;</strong>? Layanan ini tidak akan muncul lagi di kasir.
                </p>
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-light rounded-pill flex-fill fw-bold py-2 border shadow-none"
                    style={{ fontSize: '0.85rem' }}
                    onClick={() => setDeleteProductConfirm({ show: false, product: null })}
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger rounded-pill flex-fill fw-bold py-2 shadow-sm d-flex align-items-center justify-content-center gap-1.5"
                    style={{ fontSize: '0.85rem' }}
                    onClick={handleConfirmDeleteProduct}
                  >
                    <i className="bi bi-trash-fill"></i>
                    <span>Hapus</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal / Sheet Edukasi PWA Install Khusus Android */}
      {showInstallPopup && (
        <>
          <div
            className="modal-backdrop fade show"
            style={{ backdropFilter: 'blur(5px)', backgroundColor: 'rgba(15, 23, 42, 0.55)', zIndex: 1070 }}
            onClick={handleCloseInstallPopup}
          ></div>
          <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1075 }}>
            <div className="modal-dialog modal-dialog-centered mx-auto" style={{ maxWidth: '360px' }}>
              <div className="modal-content border-0 shadow-lg text-center p-4" style={{ borderRadius: '24px' }}>
                {/* Icon Ponsel Modern */}
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3 shadow-sm"
                  style={{
                    width: '64px',
                    height: '64px',
                    background: 'linear-gradient(135deg, #0134d4 0%, #2855e1 100%)',
                    borderRadius: '20px',
                  }}
                >
                  <i className="bi bi-phone text-white fs-1"></i>
                </div>

                <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill px-3 py-1 mb-2 fw-semibold" style={{ fontSize: '11px' }}>
                  Aplikasi Siap Diinstall
                </span>

                <h5 className="fw-bold mb-1 text-dark" style={{ letterSpacing: '-0.3px' }}>
                  Install Aplikasi {settings?.namaLaundry || 'TokoPlus'}
                </h5>
                <p className="text-muted small mb-3" style={{ fontSize: '12px', lineHeight: '1.5' }}>
                  Pasang aplikasi kasir <strong>{settings?.namaLaundry || 'TokoPlus'}</strong> langsung di layar utama smartphone Android Anda untuk akses cepat &amp; fitur offline.
                </p>

                {/* Outlet Details Card */}
                {settings && (
                  <div className="bg-light p-3 rounded-3 mb-3 text-start small border">
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-muted">Nama App:</span>
                      <span className="fw-bold text-dark text-truncate ps-2">{settings.namaLaundry || 'TokoPlus'}</span>
                    </div>
                    {settings.storeCode && (
                      <div className="d-flex justify-content-between mb-1">
                        <span className="text-muted">Kode Toko:</span>
                        <span className="badge bg-secondary-subtle text-dark border px-2 py-0.5">{settings.storeCode}</span>
                      </div>
                    )}
                    {settings.alamat && (
                      <div className="d-flex justify-content-between">
                        <span className="text-muted">Alamat:</span>
                        <span className="text-dark text-truncate ps-2" style={{ maxWidth: '180px' }}>{settings.alamat}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Status Sukses Install */}
                {installSuccess ? (
                  <div className="alert alert-success py-2 px-3 rounded-3 small mb-2 d-flex align-items-center justify-content-center gap-2">
                    <i className="bi bi-check-circle-fill"></i>
                    <span>Aplikasi berhasil dipasang di perangkat!</span>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary btn-lg rounded-pill fw-bold w-100 shadow-sm mb-2 d-flex align-items-center justify-content-center gap-2"
                      style={{ fontSize: '14px', height: '46px', backgroundColor: '#0134d4', borderColor: '#0134d4' }}
                      onClick={handleInstallApp}
                    >
                      <i className="bi bi-download"></i>
                      <span>Install Aplikasi Sekarang</span>
                    </button>

                    {installManualHelp && (
                      <div className="alert alert-info py-2 px-3 text-start rounded-3 mb-2 small" style={{ fontSize: '11px', lineHeight: '1.4' }}>
                        <i className="bi bi-info-circle-fill me-1"></i>
                        Jika prompt tidak muncul otomatis:
                        <br />
                        Buka menu browser titik 3 (<strong>⋮</strong>) di pojok kanan atas, lalu pilih <strong>&quot;Tambahkan ke Layar Utama&quot;</strong> atau <strong>&quot;Install Aplikasi&quot;</strong>.
                      </div>
                    )}

                    <button
                      type="button"
                      className="btn btn-light rounded-pill py-2 w-100 text-muted fw-semibold"
                      style={{ fontSize: '13px' }}
                      onClick={handleCloseInstallPopup}
                    >
                      Nanti Saja
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Setting;
