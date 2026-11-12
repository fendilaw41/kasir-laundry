import { useState, useEffect, useMemo, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTransaksi } from './hooks/useTransaksi';
import toast from 'react-hot-toast';
import { TOAST_MESSAGES, BUTTON_TEXT, BUTTON_TITLE } from '../constants/appConstants';
import { CustomerListSkeleton } from '../components/common/Skeleton';
import PlanGateModal from '../components/PlanGateModal';
import { createOrderFromCheckout, getOrderByIdQuery } from '../db/repositories/orders';
import { clearDraftOrder } from '../db/repositories/draftOrder';
import { getProductsQuery } from '../db/repositories/products';
import { addProductToCart } from '../db/repositories/cart';
import { playSuccessChime } from '../utils/soundHelper';
import { getStoredUser } from '../utils/authSession';
import {
  getShowPaymentDrawer,
  setShowPaymentDrawerPref,
  getIsMiniPayment,
  setIsMiniPayment as setIsMiniPaymentPref
} from '../utils/userPreferences';

// Tinggi menu bawah aplikasi (px). Tombol Bayar yang ditutup menempel tepat di atasnya.
const BOTTOM_MENU_HEIGHT = 58;
// Jarak form ke drawer pembayaran dirapatkan sebesar ini (px). Naikkan angkanya = makin rapat.
const DRAWER_GAP_TRIM = 156;
// Tinggi seragam semua field form (Delivery, Estimasi, Prioritas, Diskon)
const FORM_FIELD_HEIGHT = '40px';
const formFieldStyle = {
  fontSize: '0.82rem',
  height: FORM_FIELD_HEIGHT,
  minHeight: FORM_FIELD_HEIGHT,
  boxSizing: 'border-box',
};

// Custom Hook untuk Horizontal Scrolling yang Mulus (Touch, Mouse Drag, & Mouse Wheel)
const useHorizontalScroll = () => {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // 1. Mouse wheel & trackpad horizontal scrolling
    const onWheel = (e) => {
      // Izinkan native horizontal scrolling jika ada deltaX dominan (misal trackpad Mac swipe 2-jari)
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        return; // biarkan browser native scroll horizontal
      }

      // Roda mouse vertikal tetap menggulir halaman; baru dialihkan ke geser horizontal jika Shift ditekan
      if (e.shiftKey && e.deltaY !== 0 && el.scrollWidth > el.clientWidth) {
        e.preventDefault();
        el.scrollLeft += e.deltaY * 1.2;
      }
    };

    // 2. Mouse Drag to Scroll (Klik kiri tahan dan geser ke kanan/kiri)
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;
    let hasMoved = false;

    const onMouseDown = (e) => {
      if (e.button !== 0) return; // Hanya klik kiri
      // Jangan cegah interaksi form control
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      isDown = true;
      hasMoved = false;
      startX = e.clientX;
      scrollLeft = el.scrollLeft;
      el.style.cursor = 'grabbing';
      el.style.userSelect = 'none';
    };

    const onMouseLeave = () => {
      if (!isDown) return;
      isDown = false;
      el.style.cursor = 'grab';
      el.style.removeProperty('user-select');
    };

    const onMouseUp = () => {
      if (!isDown) return;
      isDown = false;
      el.style.cursor = 'grab';
      el.style.removeProperty('user-select');
    };

    const onMouseMove = (e) => {
      if (!isDown) return;
      const x = e.clientX;
      const walk = (x - startX);
      if (Math.abs(walk) > 3) {
        hasMoved = true;
        e.preventDefault();
      }
      el.scrollLeft = scrollLeft - walk;
    };

    // Cegah HTML5 native drag & drop pada elemen/gambar/teks agar mousemove tidak macet
    const onDragStart = (e) => {
      e.preventDefault();
    };

    // Cegah trigger click saat pengguna melakukan drag geser
    const onClickCapture = (e) => {
      if (hasMoved) {
        e.stopPropagation();
        e.preventDefault();
        hasMoved = false;
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('mousedown', onMouseDown);
    el.addEventListener('dragstart', onDragStart);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    el.addEventListener('mouseleave', onMouseLeave);
    el.addEventListener('click', onClickCapture, true);

    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('mousedown', onMouseDown);
      el.removeEventListener('dragstart', onDragStart);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      el.removeEventListener('mouseleave', onMouseLeave);
      el.removeEventListener('click', onClickCapture, true);
    };
  }, []);

  return ref;
};

const Transaksi = ({ user } = {}) => {
  const activeUser = user || getStoredUser();

  const {
    cartItems, daftarPelanggan, inventory, navigate,
    selectedPelanggan, setSelectedPelanggan,
    showModal, setShowModal,
    isAdding, setIsAdding,
    newPelanggan, setNewPelanggan,
    diskonTipe, setDiskonTipe,
    diskonNilai, setDiskonNilai,
    estimasi, setEstimasi,
    metodeBayar, setMetodeBayar,
    tipeLayanan, setTipeLayanan,
    isPriority, setIsPriority,
    selectedInventory,
    subtotal, nilaiDiskon, total,
    prepareOrderData, updateItemQty, toggleInventory, updateInventoryQty, handleAddPelanggan,
    resetTransaksi,
    gateModal, setGateModal,
  } = useTransaksi();

  // Query Daftar Produk untuk ditampilkan langsung di halaman Transaksi
  const products = useLiveQuery(getProductsQuery);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [productSearchTerm, setProductSearchTerm] = useState('');

  // Horizontal Scroll Ref untuk Layanan
  const productScrollRef = useHorizontalScroll();

  // State untuk Floating Bottom Sheet / Drawer Pembayaran (Disimpan ke localStorage)
  const [showPaymentDrawer, setShowPaymentDrawerState] = useState(() => getShowPaymentDrawer(activeUser));
  // Tampilan drawer pembayaran: true = PENDEK (seperti Order Detail), false = BESAR (lengkap) (Disimpan ke localStorage)
  const [isMiniPayment, setIsMiniPaymentState] = useState(() => getIsMiniPayment(activeUser));

  // Handler tersinkronisasi ke localStorage
  const setShowPaymentDrawer = (val) => {
    setShowPaymentDrawerState((prev) => {
      const nextVal = typeof val === 'function' ? val(prev) : val;
      setShowPaymentDrawerPref(nextVal, activeUser);
      return nextVal;
    });
  };

  const setIsMiniPayment = (val) => {
    setIsMiniPaymentState((prev) => {
      const nextVal = typeof val === 'function' ? val(prev) : val;
      setIsMiniPaymentPref(nextVal, activeUser);
      return nextVal;
    });
  };

  useEffect(() => {
    setShowPaymentDrawerState(getShowPaymentDrawer(activeUser));
    setIsMiniPaymentState(getIsMiniPayment(activeUser));
  }, [activeUser?.id, activeUser?.uuid, activeUser?.username]);

  const isCompactPayment = true; // ukuran layout versi besar (sudah rapi, tidak diubah)
  const [orderDataPending, setOrderDataPending] = useState(null);
  const [isLunas, setIsLunas] = useState(true);
  const [nominalBayar, setNominalBayar] = useState('');
  const [drawerMetodeBayar, setDrawerMetodeBayar] = useState(metodeBayar || 'Cash');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Ukur tinggi drawer pembayaran agar konten di belakangnya selalu punya ruang scroll yang pas
  const drawerRef = useRef(null);
  const lastDrawerHeightRef = useRef(0);
  const [drawerHeight, setDrawerHeight] = useState(0);

  // State untuk Search Pelanggan
  const [pelangganSearchTerm, setPelangganSearchTerm] = useState('');

  // State untuk Modal Sukses Transaksi (Animasi Angka & Suara)
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successOrder, setSuccessOrder] = useState(null);
  const [animatedAmount, setAnimatedAmount] = useState(0);

  // Sinkronkan drawerMetodeBayar dengan metodeBayar default
  useEffect(() => {
    if (metodeBayar) setDrawerMetodeBayar(metodeBayar);
  }, [metodeBayar]);

  useEffect(() => {
    const el = drawerRef.current;
    if (!showPaymentDrawer || !el) {
      setDrawerHeight(0);
      return undefined;
    }
    const update = () => {
      lastDrawerHeightRef.current = el.offsetHeight;
      setDrawerHeight(el.offsetHeight);
    };
    update();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [showPaymentDrawer, isMiniPayment]);

  // Ekstrak kategori unik dari daftar produk
  const categories = useMemo(() => {
    if (!Array.isArray(products)) return [];
    return Array.from(new Set(products.map((p) => p.category).filter(Boolean)));
  }, [products]);

  // Filter produk berdasarkan kategori yang dipilih + kata kunci pencarian (nama / kategori / kode)
  const filteredProducts = useMemo(() => {
    if (!Array.isArray(products)) return [];
    const q = productSearchTerm.trim().toLowerCase();
    return products.filter((p) => {
      const matchCategory = selectedCategory === 'ALL' || p.category?.toUpperCase() === selectedCategory.toUpperCase();
      if (!matchCategory) return false;
      if (!q) return true;
      return [p.name, p.category, getProductCode(p)].some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [products, selectedCategory, productSearchTerm]);

  // Mencocokkan item keranjang dengan produk
  const getCartItemForProduct = (p) => {
    if (!cartItems || !Array.isArray(cartItems)) return null;
    const fullName = `${p.category} - ${p.name}`;
    return cartItems.find((item) => {
      if (p.uuid && item.productId === p.uuid) return true;
      if (p.id && item.productId === p.id) return true;
      if (item.name === fullName || item.name === p.name) return true;
      return false;
    });
  };

  // Tambah produk ke keranjang
  const handleAddProduct = async (product, e) => {
    if (e) e.stopPropagation();
    try {
      await addProductToCart(product, 1);
    } catch {
      toast.error('Gagal menambahkan layanan');
    }
  };

  // Helper warna badge kategori
  const getCategoryBadgeStyle = (category = '') => {
    const cat = category.toUpperCase();
    if (cat.includes('SETRIKA') && cat.includes('CUCI')) {
      return { backgroundColor: '#e0e7ff', color: '#3730a3' };
    }
    if (cat.includes('SETRIKA')) {
      return { backgroundColor: '#ffedd5', color: '#9a3412' };
    }
    if (cat.includes('LIPAT')) {
      return { backgroundColor: '#dcfce7', color: '#166534' };
    }
    return { backgroundColor: '#f1f5f9', color: '#334155' };
  };

  // Helper kode singkat produk
  function getProductCode(p) {
    if (p.code && p.code.trim()) return p.code.trim().toUpperCase();
    const words = (p.name || '').split(' ').filter(Boolean);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0] + (words[2] ? words[2][0] : '')).toUpperCase().slice(0, 3);
    }
    return (p.name || 'SRV').slice(0, 3).toUpperCase();
  }

  // Helper memformat nama layanan & estimasi durasi terlama untuk pita miring di card
  const formatServiceDisplay = (rawName = '') => {
    if (!rawName) return { title: '', estimateText: '' };

    // 1. Rentang hari: misal "Reguler (2-3 hari)" -> title: "Reguler", estimateText: "3 hari"
    const rangeMatch = rawName.match(/(\d+)\s*[-–—]\s*(\d+)\s*(hari|hr)/i);
    if (rangeMatch) {
      const maxDay = Math.max(parseInt(rangeMatch[1], 10), parseInt(rangeMatch[2], 10));
      const title = rawName
        .replace(/\s*\(\s*\d+\s*[-–—]\s*\d+\s*(?:hari|hr)\s*\)/i, '')
        .replace(/\s*\d+\s*[-–—]\s*\d+\s*(?:hari|hr)/i, '')
        .trim();
      return {
        title: title || rawName,
        estimateText: `${maxDay} hari`,
      };
    }

    // 2. Hari tunggal: misal "Express (1 Hari)" -> title: "Express", estimateText: "1 hari"
    const singleDayMatch = rawName.match(/(\d+)\s*(hari|hr)/i);
    if (singleDayMatch) {
      const day = parseInt(singleDayMatch[1], 10);
      const title = rawName
        .replace(/\s*\(\s*\d+\s*(?:hari|hr)\s*\)/i, '')
        .replace(/\s*\d+\s*(?:hari|hr)/i, '')
        .trim();
      return {
        title: title || rawName,
        estimateText: `${day} hari`,
      };
    }

    // 3. Jam: misal "Kilat (4 Jam)" -> title: "Kilat", estimateText: "4 jam"
    const hourMatch = rawName.match(/(\d+)\s*(jam|jm)/i);
    if (hourMatch) {
      const hours = parseInt(hourMatch[1], 10);
      const title = rawName
        .replace(/\s*\(\s*\d+\s*(?:jam|jm)\s*\)/i, '')
        .replace(/\s*\d+\s*(?:jam|jm)/i, '')
        .trim();
      return {
        title: title || rawName,
        estimateText: `${hours} jam`,
      };
    }

    return { title: rawName, estimateText: '' };
  };

  // Kalkulasi nominal bayar & kembalian / sisa tagihan di drawer
  const parsedNominal = nominalBayar.trim() === '' ? null : parseInt(nominalBayar, 10);
  const effectiveBayar = parsedNominal !== null ? parsedNominal : (isLunas ? total : 0);
  const kembalian = isLunas ? Math.max(0, effectiveBayar - total) : 0;
  const sisaTagihan = !isLunas ? Math.max(0, total - effectiveBayar) : 0;

  // Tombol Cepat Nominal
  const handleQuickNominal = (val) => {
    if (val === 'pas') {
      setNominalBayar(total.toString());
    } else {
      setNominalBayar(val.toString());
    }
  };

  // Proses Selesaikan Pembayaran
  const handleConfirmPayment = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      let currentOrderData = orderDataPending;
      if (!currentOrderData) {
        currentOrderData = await prepareOrderData();
        if (!currentOrderData) {
          setIsSubmitting(false);
          return;
        }
      }

      const finalBayar = parsedNominal !== null ? parsedNominal : (isLunas ? total : 0);
      const finalKembalian = isLunas ? Math.max(0, finalBayar - total) : 0;

      const newId = await createOrderFromCheckout({
        orderData: {
          ...currentOrderData,
          metodeBayar: drawerMetodeBayar,
        },
        bayarNum: finalBayar,
        kembalian: finalKembalian,
        isLunas
      });

      await clearDraftOrder();
      if (resetTransaksi) await resetTransaksi();

      const saved = await getOrderByIdQuery(newId);

      setShowPaymentDrawer(false);
      playSuccessChime();

      setSuccessOrder({
        id: newId,
        invoiceId: saved?.invoiceId || `INV-${newId}`,
        pelangganNama: currentOrderData.pelangganNama || 'Pelanggan Umum',
        total: total,
        bayar: finalBayar,
        kembalian: finalKembalian,
        metodeBayar: drawerMetodeBayar,
        isLunas: isLunas && finalBayar >= total
      });
      setShowSuccessModal(true);
    } catch (err) {
      toast.error(err?.message || TOAST_MESSAGES.ERROR);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Animasi Counter Angka Berjalan saat Modal Sukses Terbuka
  useEffect(() => {
    if (!showSuccessModal || !successOrder) return;

    const target = successOrder.total || 0;
    setAnimatedAmount(0);

    const duration = 1200;
    const startTime = performance.now();

    let animationFrameId;
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentVal = Math.floor(easeOut * target);

      setAnimatedAmount(currentVal);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        setAnimatedAmount(target);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [showSuccessModal, successOrder]);

  return (
    <div
      className="card shadow-sm border-0 mx-auto"
      style={{
        borderRadius: '20px',
        maxWidth: '580px',
        marginBottom: showPaymentDrawer ? '0px' : `${BOTTOM_MENU_HEIGHT + 56}px`,
      }}
    >
      <div className="card-body p-3">

        {/* Search Produk + Filter Kategori (sejajar dalam satu baris) */}
        <div className="d-flex gap-2 mb-2">
          <div className="input-group input-group-sm border rounded-3 overflow-hidden flex-grow-1 bg-white" style={{ minWidth: 0 }}>
            <span className="input-group-text bg-white border-0 text-muted ps-2 pe-1">
              <i className="bi bi-search" style={{ fontSize: '0.8rem' }}></i>
            </span>
            <input
              type="text"
              aria-label="Cari layanan"
              className="form-control border-0 shadow-none ps-1"
              style={{ fontSize: '0.82rem', minWidth: 0 }}
              placeholder="Cari nama atau kode..."
              value={productSearchTerm}
              onChange={(e) => setProductSearchTerm(e.target.value)}
            />
            {productSearchTerm && (
              <button
                type="button"
                className="btn btn-sm btn-link text-decoration-none text-muted pe-2"
                onClick={() => setProductSearchTerm('')}
                aria-label="Hapus pencarian"
              >
                <i className="bi bi-x-circle-fill"></i>
              </button>
            )}
          </div>
          <select
            aria-label="Filter kategori"
            className="form-select form-select-sm rounded-3 flex-shrink-0 fw-bold"
            style={{ width: '128px', fontSize: '0.78rem' }}
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="ALL">Semua</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Card Layanan / Produk (2 Baris x 2 Kolom, geser kanan jika lebih dari 4; geser atas/bawah tetap scroll halaman) */}
        <div className="mb-3">
          {(!products || products.length === 0) ? (
            <div className="p-3 text-center bg-light rounded-3 border text-muted small">
              Belum ada produk/layanan yang tersedia.
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-3 text-center bg-light rounded-3 border text-muted small">
              Tidak ada layanan yang cocok dengan pencarian/kategori ini.
            </div>
          ) : (
            <div
              ref={productScrollRef}
              className="no-scrollbar w-100"
              style={{
                display: 'grid',
                gridTemplateRows: 'repeat(2, 1fr)',
                gridAutoFlow: 'column',
                gridAutoColumns: 'calc(50% - 6px)',
                gap: '10px',
                overflowX: 'auto',
                overflowY: 'hidden',
                WebkitOverflowScrolling: 'touch',
                // pan-x + pan-y: geser kanan untuk produk, geser atas/bawah tetap menggulir halaman
                touchAction: 'pan-x pan-y',
                cursor: 'grab',
                paddingBottom: '4px',
              }}
            >
              {filteredProducts.map((p) => {
                const cartItem = getCartItemForProduct(p);
                const isInCart = !!cartItem;
                const badgeStyle = getCategoryBadgeStyle(p.category);
                const code = getProductCode(p);

                return (
                  <div
                    key={p.id || p.uuid}
                    className="p-3 rounded-4 d-flex flex-column justify-content-between transition-all"
                    style={{
                      backgroundColor: '#ffffff',
                      border: isInCart ? '2px solid #0134d4' : '1px solid #e2e8f0',
                      borderRadius: '16px',
                      cursor: isInCart ? 'default' : 'pointer',
                      minHeight: '128px',
                      boxShadow: isInCart ? '0 4px 12px rgba(1, 52, 212, 0.08)' : '0 2px 4px rgba(0,0,0,0.02)',
                    }}
                    onClick={() => {
                      if (!isInCart) handleAddProduct(p);
                    }}
                  >
                    {/* Top Row: Category Badge & Code */}
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span
                        className="fw-bold text-uppercase px-2 py-0 rounded-2"
                        style={{
                          fontSize: '0.5rem',
                          letterSpacing: '0.3px',
                          ...badgeStyle,
                        }}
                      >
                        {p.category || 'LAYANAN'}
                      </span>
                      <span className="fw-bold text-muted small" style={{ fontSize: '0.7rem' }}>
                        {code}
                      </span>
                    </div>

                    {/* Middle: Service Name & Price */}
                    <div>
                      {(() => {
                        const display = formatServiceDisplay(p.name);
                        return (
                          <div className="d-flex align-items-center justify-content-between gap-1 mb-1" title={p.name}>
                            <div className="fw-bold text-dark text-truncate" style={{ fontSize: '0.7rem' }}>
                              {display.title}
                            </div>
                            {display.estimateText && (
                              <span
                                className="fst-italic text-nowrap flex-shrink-0"
                                style={{
                                  fontSize: '0.66rem',
                                  fontStyle: 'italic',
                                  backgroundColor: '#f1f5f9',
                                  color: '#475569',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '4px',
                                  padding: '1px 5px',
                                  letterSpacing: '0.2px',
                                }}
                              >
                                {display.estimateText}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                      <div className="fw-bold" style={{ fontSize: '0.96rem', color: '#0134d4' }}>
                        Rp {p.price?.toLocaleString('id-ID')}
                      </div>
                    </div>

                    {/* Bottom: Stepper jika ada di Cart atau Spacer */}
                    {isInCart ? (
                      <div className="d-flex align-items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="btn btn-sm btn-light border-0 rounded-circle p-0 d-flex align-items-center justify-content-center shadow-xs"
                          style={{ width: '28px', height: '28px', backgroundColor: '#f1f5f9', color: '#1e293b' }}
                          onClick={() => updateItemQty(cartItem.id, -1)}
                          title="Kurangi kuantitas"
                        >
                          <i className="bi bi-dash fw-bold" style={{ fontSize: '0.85rem' }}></i>
                        </button>
                        <span className="fw-bold text-dark px-1" style={{ fontSize: '0.88rem', minWidth: '16px', textAlign: 'center' }}>
                          {cartItem.quantity}
                        </span>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary rounded-circle p-0 d-flex align-items-center justify-content-center shadow-xs"
                          style={{ width: '28px', height: '28px', backgroundColor: '#0134d4', borderColor: '#0134d4' }}
                          onClick={() => updateItemQty(cartItem.id, 1)}
                          title="Tambah kuantitas"
                        >
                          <i className="bi bi-plus fw-bold text-white" style={{ fontSize: '0.85rem' }}></i>
                        </button>
                      </div>
                    ) : (
                      <div style={{ height: '28px' }} className="d-flex align-items-center mt-2">
                        <small className="text-muted" style={{ fontSize: '0.68rem' }}>
                          + Ketuk untuk tambah
                        </small>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Gunakan Inventori - hanya geser kanan (tanpa scroll atas/bawah), kartu cukup tinggi agar stepper tidak tenggelam */}
        <div className="mb-3">
          <label className="form-label small fw-bold text-muted text-uppercase mb-1 px-1" style={{ fontSize: '0.68rem', letterSpacing: '0.3px' }}>
            Gunakan Inventori
          </label>
          <div
            className="d-flex gap-2 mx-n1 px-1 no-scrollbar inventory-scroller"
            style={{
              overflowX: 'auto',
              overflowY: 'hidden',
              touchAction: 'pan-x pan-y',
              WebkitOverflowScrolling: 'touch',
              paddingTop: '2px',
              paddingBottom: '4px',
            }}
          >
            {inventory?.filter(inv => !(inv.status === 'pending' && inv.stok === 0)).map(inv => {
              const activeItem = selectedInventory.find(s => s.id === inv.id);
              const isActive = !!activeItem;
              const isOutOfStock = Number(inv.stok || 0) <= 0;
              return (
                <div
                  key={inv.id}
                  className={`position-relative flex-shrink-0 border d-flex flex-column align-items-center justify-content-center transition-all ${isOutOfStock && !isActive ? 'border-dashed opacity-50' : ''}`}
                  style={{
                    width: '88px',
                    height: '102px',
                    borderRadius: '14px',
                    padding: '8px 6px',
                    backgroundColor: isActive ? '#eef3ff' : '#ffffff',
                    borderColor: isActive ? '#0134d4' : '#e2e8f0',
                    borderWidth: isActive ? '2px' : '1px',
                    boxShadow: isActive ? '0 4px 12px rgba(1, 52, 212, 0.10)' : '0 1px 3px rgba(0,0,0,0.03)',
                  }}
                >
                  {/* Badge ceklis: di pojok kanan atas dengan jarak dari tepi */}
                  {isActive && (
                    <span
                      className="position-absolute d-flex align-items-center justify-content-center rounded-circle"
                      style={{ top: '6px', right: '6px', width: '18px', height: '18px', backgroundColor: '#0134d4', color: '#ffffff' }}
                    >
                      <i className="bi bi-check-lg" style={{ fontSize: '0.7rem', lineHeight: 1 }}></i>
                    </span>
                  )}

                  <div
                    className="text-center w-100"
                    onClick={() => {
                      if (isOutOfStock && !isActive) {
                        toast.error(TOAST_MESSAGES.ERROR);
                        return;
                      }
                      toggleInventory(inv);
                    }}
                    style={{ cursor: isOutOfStock && !isActive ? 'not-allowed' : 'pointer' }}
                  >
                    <i className="bi bi-box-seam d-block text-muted" style={{ fontSize: '1rem', lineHeight: 1, marginBottom: '4px' }}></i>
                    <div className="fw-bold text-dark text-truncate mx-auto" style={{ fontSize: '0.74rem', maxWidth: '72px' }}>{inv.nama}</div>
                    <small className={isOutOfStock ? 'text-danger fw-bold' : 'text-muted'} style={{ fontSize: '0.64rem' }}>
                      {isOutOfStock ? 'Habis' : `Stok: ${inv.stok}`}
                    </small>
                  </div>

                  {isActive && (
                    <div
                      className="d-flex align-items-center justify-content-center bg-white rounded-pill border"
                      style={{ marginTop: '6px', height: '26px', gap: '4px', padding: '0 4px' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="btn btn-sm btn-light rounded-circle p-0 d-flex align-items-center justify-content-center"
                        style={{ width: '20px', height: '20px' }}
                        onClick={() => updateInventoryQty(inv.id, -1)}
                        aria-label="Kurangi"
                      >
                        <i className="bi bi-dash text-dark" style={{ fontSize: '0.8rem' }}></i>
                      </button>
                      <span className="fw-bold text-dark" style={{ fontSize: '0.78rem', minWidth: '16px', textAlign: 'center' }}>
                        {activeItem.quantity || 1}
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm btn-light rounded-circle p-0 d-flex align-items-center justify-content-center"
                        style={{ width: '20px', height: '20px' }}
                        onClick={() => updateInventoryQty(inv.id, 1)}
                        aria-label="Tambah"
                      >
                        <i className="bi bi-plus text-dark" style={{ fontSize: '0.8rem' }}></i>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Form Order: Delivery, Estimasi, Prioritas, Diskon (2 baris x 2 kolom, tinggi input seragam) */}
        <div className="row g-2 mb-2">
          <div className="col-6">
            <label htmlFor="delivery-select" className="form-label fw-bold text-muted d-block mb-1" style={{ fontSize: '0.72rem', lineHeight: '16px' }}>
              Delivery
            </label>
            <select
              id="delivery-select"
              className="form-select"
              style={formFieldStyle}
              value={tipeLayanan}
              onChange={(e) => setTipeLayanan(e.target.value)}
            >
              <option value="Datang Langsung">Datang Langsung</option>
              <option value="Jemput/Antar">Antar Jemput</option>
            </select>
          </div>

          <div className="col-6">
            <label htmlFor="estimasi-input" className="form-label fw-bold text-muted d-block mb-1" style={{ fontSize: '0.72rem', lineHeight: '16px' }}>
              Estimasi (Hari)
            </label>
            <input
              id="estimasi-input"
              type="number"
              className="form-control"
              style={formFieldStyle}
              value={estimasi}
              onChange={(e) => setEstimasi(e.target.value)}
              onFocus={(e) => e.target.select()}
              min="0"
              required
            />
          </div>

          <div className="col-6">
            <label htmlFor="prioritas-select" className="form-label fw-bold text-muted d-block mb-1" style={{ fontSize: '0.72rem', lineHeight: '16px' }}>
              Prioritas
            </label>
            <select
              id="prioritas-select"
              className="form-select"
              style={formFieldStyle}
              value={isPriority}
              onChange={(e) => setIsPriority(e.target.value)}
            >
              <option value="Tidak">Biasa</option>
              <option value="Ya">Prioritas</option>
            </select>
          </div>

          <div className="col-6">
            {/* Label Diskon + total potongan di sebelahnya */}
            <div className="d-flex justify-content-between align-items-baseline gap-1 mb-1" style={{ lineHeight: '16px' }}>
              <label htmlFor="diskon-input" className="form-label fw-bold text-muted mb-0" style={{ fontSize: '0.72rem', lineHeight: '16px' }}>
                Diskon
              </label>
              {nilaiDiskon > 0 && (
                <span className="text-danger fw-bold text-truncate" style={{ fontSize: '0.72rem', lineHeight: '16px' }}>
                  - Rp {nilaiDiskon.toLocaleString('id-ID')}
                </span>
              )}
            </div>
            <div
              className="d-flex align-items-stretch border rounded bg-white overflow-hidden"
              style={{ height: FORM_FIELD_HEIGHT, minHeight: FORM_FIELD_HEIGHT, boxSizing: 'border-box' }}
            >
              <select
                aria-label="Jenis diskon"
                className="form-select rounded-0 flex-shrink-0"
                style={{
                  width: '72px',
                  height: '100%',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  backgroundColor: '#f8f9fa',
                  boxShadow: 'none',
                  borderStyle: 'solid',
                  borderColor: '#dee2e6',
                  borderWidth: '0 1px 0 0',
                }}
                value={diskonTipe}
                onChange={(e) => setDiskonTipe(e.target.value)}
              >
                <option value="Persentase">%</option>
                <option value="Harga">Rp</option>
              </select>
              <input
                id="diskon-input"
                type="number"
                className="form-control rounded-0 flex-grow-1"
                style={{ height: '100%', fontSize: '0.82rem', fontWeight: 700, minWidth: 0, border: 0, boxShadow: 'none' }}
                value={diskonNilai}
                onChange={(e) => setDiskonNilai(e.target.value)}
                onFocus={(e) => e.target.select()}
                min="0"
                max={diskonTipe === 'Persentase' ? 100 : subtotal}
              />
            </div>
          </div>
        </div>

        {/* Spacer setinggi drawer pembayaran (dikurangi DRAWER_GAP_TRIM agar rapat) supaya form paling bawah tetap bisa di-scroll sampai terlihat */}
        {showPaymentDrawer && <div aria-hidden="true" style={{ height: `${Math.max(0, drawerHeight - DRAWER_GAP_TRIM)}px` }}></div>}
      </div>

      {/* Floating Bottom Drawer Pembayaran (Docked Bottom) */}
      {showPaymentDrawer ? (
        <div
          ref={drawerRef}
          className="position-fixed bottom-0 start-50 translate-middle-x w-100 px-2 pb-0"
          style={{
            maxWidth: isCompactPayment ? '540px' : '580px',
            zIndex: 1055,
            animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            pointerEvents: 'none'
          }}
        >
          <div
            className="bg-white w-100 shadow-lg border"
            style={{
              borderRadius: isCompactPayment ? '22px' : '26px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: isCompactPayment ? '10px 14px 14px' : '20px 20px 24px',
              boxShadow: '0 -10px 35px rgba(0,0,0,0.18)',
              pointerEvents: 'auto',
              transition: 'all 0.22s ease-out'
            }}
          >
            {/* Grabber indicator */}
            <div
              className="mx-auto"
              style={{
                width: isCompactPayment ? '36px' : '45px',
                height: isCompactPayment ? '4px' : '5px',
                backgroundColor: '#cbd5e1',
                borderRadius: '10px',
                marginBottom: isCompactPayment ? '6px' : '12px',
                cursor: 'pointer'
              }}
              onClick={() => setIsMiniPayment(!isMiniPayment)}
              title={isMiniPayment ? 'Klik untuk perbesar' : 'Klik untuk perkecil'}
            ></div>

            {isMiniPayment ? (
              <>
                {/* ===== Versi PENDEK (mirip Order Detail): pelanggan + status di atas, 3 tombol aksi di bawah ===== */}
                <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
                  <div
                    className="d-flex align-items-center gap-2 flex-grow-1 overflow-hidden"
                    style={{ cursor: 'pointer', minWidth: 0 }}
                    onClick={() => {
                      setIsAdding(false);
                      setShowModal(true);
                    }}
                    title="Klik untuk memilih / mengganti pelanggan"
                  >
                    <span className="fw-bold text-dark text-truncate" style={{ fontSize: '0.9rem' }}>
                      {selectedPelanggan?.nama || 'Pelanggan Umum'}
                    </span>
                    <span
                      className={`badge rounded-pill flex-shrink-0 ${isLunas ? 'bg-success text-white' : 'bg-warning text-dark'}`}
                      style={{ fontSize: '0.7rem', padding: '5px 10px' }}
                    >
                      {isLunas ? 'Lunas' : 'Belum Lunas'}
                    </span>
                  </div>

                  <div className="d-flex align-items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      className="btn btn-sm btn-light rounded-circle p-1 d-flex align-items-center justify-content-center text-muted"
                      style={{ width: '32px', height: '32px' }}
                      onClick={() => setIsMiniPayment(false)}
                      title="Perbesar tampilan pembayaran"
                      aria-label="Perbesar tampilan pembayaran"
                    >
                      <i className="bi bi-arrows-angle-expand" style={{ fontSize: '0.8rem' }}></i>
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-light rounded-circle p-1 d-flex align-items-center justify-content-center text-muted"
                      style={{ width: '32px', height: '32px' }}
                      onClick={() => !isSubmitting && setShowPaymentDrawer(false)}
                      disabled={isSubmitting}
                      title="Tutup Pembayaran"
                      aria-label="Tutup Pembayaran"
                    >
                      <i className="bi bi-x-lg" style={{ fontSize: '0.8rem' }}></i>
                    </button>
                  </div>
                </div>

                <div className="d-flex align-items-stretch gap-2">
                  {/* Pilih / Tambah Pelanggan */}
                  <button
                    type="button"
                    className="btn btn-outline-primary rounded-pill fw-bold d-flex align-items-center justify-content-center gap-1 px-2"
                    style={{ flex: '1 1 0', minWidth: 0, minHeight: '46px', fontSize: '0.7rem' }}
                    onClick={() => {
                      setIsAdding(false);
                      setShowModal(true);
                    }}
                    title="Pilih / Tambah Pelanggan"
                  >
                    <i className="bi bi-person-plus-fill"></i> Pelanggan
                  </button>

                  {/* Bayar: total + metode bayar tampil di tombol */}
                  <button
                    type="button"
                    className="btn btn-primary rounded-pill fw-bold d-flex align-items-center justify-content-center gap-2 px-2"
                    style={{ flex: '1.45 1 0', minWidth: 0, minHeight: '46px', backgroundColor: '#0134d4', borderColor: '#0134d4' }}
                    onClick={handleConfirmPayment}
                    disabled={isSubmitting || !cartItems || cartItems.length === 0}
                  >
                    {isSubmitting ? (
                      <>
                        <span className="spinner-border spinner-border-sm" role="status"></span>
                        <span style={{ fontSize: '0.8rem' }}>Memproses...</span>
                      </>
                    ) : (
                      <>
                        <i className="bi bi-wallet2 fs-6"></i>
                        <span className="d-flex flex-column text-start" style={{ lineHeight: 1.15, minWidth: 0 }}>
                          <span style={{ fontSize: '0.84rem' }}>
                            {isLunas ? 'Bayar' : (effectiveBayar > 0 ? 'Bayar DP' : 'Simpan')}
                          </span>
                          <span className="text-truncate" style={{ fontSize: '0.64rem', fontWeight: 600, opacity: 0.9 }}>
                            Rp {total.toLocaleString('id-ID')} · {drawerMetodeBayar}
                          </span>
                        </span>
                      </>
                    )}
                  </button>

                  {/* Status pembayaran: ketuk untuk ganti Lunas / Belum Lunas */}
                  <button
                    type="button"
                    className={`btn rounded-pill fw-bold d-flex align-items-center justify-content-center gap-1 px-2 ${isLunas ? 'btn-outline-success' : 'btn-outline-warning text-dark'}`}
                    style={{ flex: '1 1 0', minWidth: 0, minHeight: '46px', fontSize: '0.8rem' }}
                    onClick={() => setIsLunas(!isLunas)}
                    title="Ketuk untuk mengganti status Lunas / Belum Lunas"
                  >
                    <i className={`bi ${isLunas ? 'bi-check-circle' : 'bi-clock-history'}`}></i>
                    <span className="text-truncate">{isLunas ? 'Lunas' : 'Belum'}</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Header Drawer: Icon & Nama Pelanggan Terpilih di Kiri, Aksi Drawer di Kanan */}
                <div className={`d-flex justify-content-between align-items-center ${isCompactPayment ? 'mb-2' : 'mb-3'}`}>
                  {/* Info Pelanggan Terpilih (Pengganti Teks Pembayaran Kasir) */}
                  <div
                    className="d-flex align-items-center gap-2 flex-grow-1 overflow-hidden me-2"
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      setIsAdding(false);
                      setShowModal(true);
                    }}
                    title="Klik untuk memilih / mengganti pelanggan"
                  >
                    <div
                      className="rounded-circle bg-light d-flex align-items-center justify-content-center text-primary flex-shrink-0 border"
                      style={{ width: isCompactPayment ? '28px' : '32px', height: isCompactPayment ? '28px' : '32px' }}
                    >
                      <i className="bi bi-person-fill" style={{ fontSize: isCompactPayment ? '0.85rem' : '0.95rem' }}></i>
                    </div>
                    <div className="overflow-hidden">
                      <div className="fw-bold text-dark text-truncate" style={{ fontSize: isCompactPayment ? '0.82rem' : '0.9rem' }}>
                        {selectedPelanggan?.nama || 'Pelanggan Umum'}
                      </div>
                      {selectedPelanggan?.noHp && !isCompactPayment && (
                        <div className="text-muted small text-truncate" style={{ fontSize: '0.68rem', lineHeight: 1.1 }}>
                          {selectedPelanggan.noHp}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="d-flex align-items-center gap-1 flex-shrink-0">
                    {/* Tombol Person Plus untuk Memilih / Tambah Pelanggan */}
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary rounded-circle p-0 d-flex align-items-center justify-content-center shadow-xs"
                      style={{ width: isCompactPayment ? '28px' : '32px', height: isCompactPayment ? '28px' : '32px' }}
                      onClick={() => {
                        setIsAdding(false);
                        setShowModal(true);
                      }}
                      title="Pilih / Tambah Pelanggan"
                    >
                      <i className="bi bi-person-plus-fill" style={{ fontSize: isCompactPayment ? '0.8rem' : '0.9rem' }}></i>
                    </button>
                    {/* Tombol Toggle Perbesar / Perkecil */}
                    <button
                      type="button"
                      className="btn btn-sm btn-light rounded-circle p-1 d-flex align-items-center justify-content-center text-muted"
                      style={{ width: isCompactPayment ? '28px' : '32px', height: isCompactPayment ? '28px' : '32px' }}
                      onClick={() => setIsMiniPayment(true)}
                      title="Perkecil tampilan drawer"
                    >
                      <i className="bi bi-arrows-angle-contract" style={{ fontSize: '0.75rem' }}></i>
                    </button>
                    {/* Tombol Tutup Drawer */}
                    <button
                      type="button"
                      className="btn btn-sm btn-light rounded-circle p-1 d-flex align-items-center justify-content-center text-muted"
                      style={{ width: isCompactPayment ? '28px' : '32px', height: isCompactPayment ? '28px' : '32px' }}
                      onClick={() => !isSubmitting && setShowPaymentDrawer(false)}
                      disabled={isSubmitting}
                      title="Tutup Pembayaran"
                      aria-label="Tutup Pembayaran"
                    >
                      <i className="bi bi-x-lg" style={{ fontSize: isCompactPayment ? '0.75rem' : '0.85rem' }}></i>
                    </button>
                  </div>
                </div>

                {/* Total Tagihan Banner Sesuai Mockup (Biru Solid / Gradient dengan Teks Putih Tebal) */}
                <div
                  className={`rounded-4 mb-2 d-flex justify-content-between align-items-center ${isCompactPayment ? 'px-3 py-2' : 'p-3'}`}
                  style={{
                    backgroundColor: '#0134d4',
                    color: '#ffffff',
                    borderRadius: '16px',
                  }}
                >
                  <div className="fw-bold text-uppercase" style={{ fontSize: isCompactPayment ? '0.78rem' : '0.85rem', letterSpacing: '0.5px' }}>
                    TOTAL TAGIHAN
                  </div>
                  <div className="fw-bold mb-0 text-white" style={{ fontSize: isCompactPayment ? '1.25rem' : '1.75rem' }}>
                    Rp {total.toLocaleString('id-ID')}
                  </div>
                </div>

                {/* Status Pembayaran Toggle: Lunas vs Belum Lunas */}
                <div className={isCompactPayment ? 'mb-1' : 'mb-3'}>
                  {!isCompactPayment && (
                    <label className="form-label small fw-bold text-muted text-uppercase">Status Pembayaran</label>
                  )}
                  <div className={`d-flex ${isCompactPayment ? 'p-0 rounded-3' : 'p-1 rounded-4'} bg-light border`}>
                    <button
                      type="button"
                      className={`btn flex-fill ${isCompactPayment ? 'rounded-2 py-1' : 'rounded-3 py-2'} fw-bold transition-all border-0 ${isLunas ? 'btn-success shadow-sm text-white' : 'btn-light text-muted bg-transparent'}`}
                      style={{ fontSize: isCompactPayment ? '0.72rem' : '0.85rem' }}
                      onClick={() => setIsLunas(true)}
                    >
                      <i className="bi bi-check-circle-fill me-1"></i> Lunas
                    </button>
                    <button
                      type="button"
                      className={`btn flex-fill ${isCompactPayment ? 'rounded-2 py-1' : 'rounded-3 py-2'} fw-bold transition-all border-0 ${!isLunas ? 'btn-warning shadow-sm text-dark' : 'btn-light text-muted bg-transparent'}`}
                      style={{ fontSize: isCompactPayment ? '0.72rem' : '0.85rem' }}
                      onClick={() => setIsLunas(false)}
                    >
                      <i className="bi bi-clock-history me-1"></i> Belum Lunas
                    </button>
                  </div>
                </div>

                {/* Pilihan Metode Bayar */}
                <div className={isCompactPayment ? 'mb-1' : 'mb-3'}>
                  {!isCompactPayment && (
                    <label className="form-label small fw-bold text-muted text-uppercase">Metode Pembayaran</label>
                  )}
                  <div className="row g-1">
                    {[
                      { key: 'Cash', label: 'Cash', icon: 'bi-cash-stack' },
                      { key: 'QRIS', label: 'QRIS', icon: 'bi-qr-code' },
                      { key: 'Transfer', label: 'Transfer', icon: 'bi-bank' },
                      // { key: 'Deposit', label: 'Deposit', icon: 'bi-wallet2' },
                    ].map((item) => (
                      <div key={item.key} className={isCompactPayment ? 'col-4' : 'col-4 col-sm-3'}>
                        <button
                          type="button"
                          className={`btn w-100 ${isCompactPayment ? 'py-1 px-1 rounded-2' : 'py-2 rounded-3'} border d-flex flex-column align-items-center justify-content-center transition-all ${drawerMetodeBayar === item.key ? 'border-primary bg-primary-subtle text-primary fw-bold shadow-xs' : 'bg-white text-dark'}`}
                          onClick={() => setDrawerMetodeBayar(item.key)}
                          style={{ fontSize: isCompactPayment ? '0.68rem' : '0.8rem' }}
                        >
                          <i className={`bi ${item.icon} ${isCompactPayment ? 'fs-6' : 'fs-5 mb-1'}`}></i>
                          <span className="text-truncate">{item.label}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pilihan Nominal Cepat */}
                <div className={isCompactPayment ? 'mb-1' : 'mb-3'}>
                  <div className={`d-flex justify-content-between align-items-center ${isCompactPayment ? 'mb-0' : 'mb-1'}`}>
                    <label
                      className={isCompactPayment ? 'small fw-bold text-muted text-uppercase mb-0' : 'form-label small fw-bold text-muted text-uppercase mb-0'}
                      style={{ fontSize: isCompactPayment ? '0.5rem' : '0.75rem' }}
                    >
                      {isLunas ? 'Pilihan Uang Diterima' : 'Nominal Uang Muka (DP)'}
                    </label>
                  </div>
                  <div className="d-flex align-items-center gap-1 overflow-x-auto no-scrollbar py-1">
                    <button
                      type="button"
                      className={`btn btn-sm ${nominalBayar === total.toString() ? 'btn-primary text-white' : 'btn-outline-primary'} fw-bold py-0 px-2 rounded-2 text-nowrap`}
                      style={{ fontSize: '0.68rem', height: '26px', lineHeight: '24px' }}
                      onClick={() => handleQuickNominal('pas')}
                    >
                      Uang Pas
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${nominalBayar === '20000' ? 'btn-primary text-white' : 'btn-outline-secondary'} fw-bold py-0 px-2 rounded-2 text-nowrap`}
                      style={{ fontSize: '0.68rem', height: '26px', lineHeight: '24px' }}
                      onClick={() => handleQuickNominal(20000)}
                    >
                      20rb
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${nominalBayar === '50000' ? 'btn-primary text-white' : 'btn-outline-secondary'} fw-bold py-0 px-2 rounded-2 text-nowrap`}
                      style={{ fontSize: '0.68rem', height: '26px', lineHeight: '24px' }}
                      onClick={() => handleQuickNominal(50000)}
                    >
                      50rb
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${nominalBayar === '100000' ? 'btn-primary text-white' : 'btn-outline-secondary'} fw-bold py-0 px-2 rounded-2 text-nowrap`}
                      style={{ fontSize: '0.68rem', height: '26px', lineHeight: '24px' }}
                      onClick={() => handleQuickNominal(100000)}
                    >
                      100rb
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${nominalBayar === '200000' ? 'btn-primary text-white' : 'btn-outline-secondary'} fw-bold py-0 px-2 rounded-2 text-nowrap`}
                      style={{ fontSize: '0.68rem', height: '26px', lineHeight: '24px' }}
                      onClick={() => handleQuickNominal(200000)}
                    >
                      200rb
                    </button>
                    {total > 100000 && (
                      <button
                        type="button"
                        className={`btn btn-sm ${nominalBayar === String(Math.ceil(total / 50000) * 50000) ? 'btn-primary text-white' : 'btn-outline-secondary'} fw-bold py-0 px-2 rounded-2 text-nowrap`}
                        style={{ fontSize: '0.68rem', height: '26px', lineHeight: '24px' }}
                        onClick={() => handleQuickNominal(Math.ceil(total / 50000) * 50000)}
                      >
                        {(Math.ceil(total / 50000) * 50).toLocaleString()}rb
                      </button>
                    )}
                  </div>
                </div>

                {/* Input Nominal Pembayaran (Rp di Kiri) Tepat di Atas Kembalian */}
                <div className={isCompactPayment ? 'mb-2' : 'mb-3'}>
                  <div className={`input-group ${isCompactPayment ? 'input-group-sm rounded-3' : 'input-group-lg rounded-4 shadow-sm'} overflow-hidden border bg-white`}>
                    <span
                      className="input-group-text bg-white border-0 text-muted fw-bold ps-2 pe-1"
                      style={{ fontSize: isCompactPayment ? '0.78rem' : '0.95rem' }}
                    >
                      Rp
                    </span>
                    <input
                      id="nominal-bayar-input"
                      aria-label="Nominal Uang Diterima"
                      type="number"
                      className="form-control border-0 px-1 fw-bold text-dark"
                      style={{
                        fontSize: isCompactPayment ? '0.85rem' : '1.1rem',
                        height: isCompactPayment ? '32px' : '42px',
                        boxShadow: 'none',
                      }}
                      placeholder={isLunas ? `Uang Pas (${total.toLocaleString('id-ID')})` : '0 (Belum Bayar)'}
                      value={nominalBayar}
                      onChange={(e) => setNominalBayar(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      min="0"
                    />
                    {nominalBayar && (
                      <button
                        type="button"
                        className="btn btn-sm btn-link text-decoration-none text-muted p-0 pe-2 d-flex align-items-center"
                        onClick={() => setNominalBayar('')}
                        title="Hapus nominal"
                      >
                        <i className="bi bi-x-circle-fill text-secondary" style={{ fontSize: isCompactPayment ? '0.8rem' : '0.95rem' }}></i>
                      </button>
                    )}
                  </div>
                </div>

                {/* Rincian Kembalian / Sisa Tagihan */}
                {isCompactPayment ? (
                  <div className="bg-light px-2 py-1 rounded-3 mb-2 border d-flex justify-content-between align-items-center">
                    <span className="small text-muted" style={{ fontSize: '0.75rem' }}>
                      {isLunas ? 'Kembalian:' : 'Sisa Tagihan:'}
                    </span>
                    <span className={`fw-bold ${isLunas ? 'text-success' : 'text-danger'}`} style={{ fontSize: '0.85rem' }}>
                      Rp {(isLunas ? kembalian : sisaTagihan).toLocaleString('id-ID')}
                    </span>
                  </div>
                ) : (
                  <div className="bg-light p-3 rounded-4 mb-4 border">
                    <div className="d-flex justify-content-between mb-1">
                      <span className="small text-muted">Total Tagihan:</span>
                      <span className="small fw-bold">Rp {total.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                      <span className="small text-muted">Diterima:</span>
                      <span className="small fw-bold text-primary">Rp {effectiveBayar.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="border-top pt-2 d-flex justify-content-between align-items-center">
                      {isLunas ? (
                        <>
                          <span className="fw-bold text-dark">Kembalian:</span>
                          <span className="fw-bold fs-5 text-success">
                            Rp {kembalian.toLocaleString('id-ID')}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="fw-bold text-dark">Sisa Tagihan:</span>
                          <span className="fw-bold fs-5 text-danger">
                            Rp {sisaTagihan.toLocaleString('id-ID')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Tombol Konfirmasi Selesai Pembayaran */}
                <button
                  type="button"
                  className={`btn btn-primary w-100 ${isCompactPayment ? 'py-2 rounded-3' : 'py-3 rounded-4 fs-5 shadow'} fw-bold`}
                  style={{ fontSize: isCompactPayment ? '0.88rem' : '1.1rem', backgroundColor: '#0134d4', borderColor: '#0134d4' }}
                  onClick={handleConfirmPayment}
                  disabled={isSubmitting || !cartItems || cartItems.length === 0}
                >
                  {isSubmitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      Memproses...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check2-circle me-1"></i>
                      {isLunas
                        ? `Bayar`
                        : (effectiveBayar > 0
                          ? `Bayar DP`
                          : 'Simpan')}
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      ) : !showSuccessModal && (
        <div
          className="position-fixed start-50 translate-middle-x text-center"
          style={{ bottom: `${BOTTOM_MENU_HEIGHT + 4}px`, zIndex: 1050, animation: 'fadeIn 0.2s ease-out' }}
        >
          <button
            type="button"
            className="btn btn-primary shadow-lg rounded-pill px-4 py-2 fw-bold d-inline-flex align-items-center gap-2 border-2 border-white"
            onClick={() => setShowPaymentDrawer(true)}
            style={{ fontSize: '0.9rem', backgroundColor: '#0134d4', borderColor: '#0134d4' }}
          >
            <i className="bi bi-wallet2 fs-6"></i>
            <span>Bayar</span>
          </button>
        </div>
      )}

      {/* Sukses Transaksi: floating bottom sheet menggantikan drawer pembayaran (tinggi sama, tanpa backdrop/blur) */}
      {showSuccessModal && successOrder && (
        <div
          className="position-fixed bottom-0 start-50 translate-middle-x w-100 px-2 pb-0"
          style={{
            maxWidth: '540px',
            zIndex: 1060,
            animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            pointerEvents: 'none',
          }}
        >
          <div
            className="bg-white w-100 shadow-lg border d-flex flex-column"
            style={{
              borderRadius: '22px',
              minHeight: `${Math.max(lastDrawerHeightRef.current, 320)}px`,
              padding: '10px 14px 14px',
              boxShadow: '0 -10px 35px rgba(0,0,0,0.18)',
              pointerEvents: 'auto',
            }}
          >
            {/* Grabber (sama dengan drawer pembayaran) */}
            <div
              className="mx-auto"
              style={{ width: '36px', height: '4px', backgroundColor: '#cbd5e1', borderRadius: '10px', marginBottom: '6px' }}
            ></div>

            <div className="text-center">
              <div
                className="rounded-circle mx-auto mb-1 d-flex align-items-center justify-content-center"
                style={{ width: '48px', height: '48px', backgroundColor: '#dcfce7', color: '#16a34a' }}
              >
                <i className="bi bi-check-lg" style={{ fontSize: '1.75rem' }}></i>
              </div>
              <h5 className="fw-bold text-dark mb-0" style={{ fontSize: '1.05rem' }}>Transaksi Berhasil!</h5>
              <p className="text-muted mb-2" style={{ fontSize: '0.72rem' }}>Pesanan telah berhasil dicatat & diproses.</p>
            </div>

            <div
              className="px-3 py-2 mb-2 d-flex justify-content-between align-items-center"
              style={{ backgroundColor: '#0134d4', color: '#ffffff', borderRadius: '16px' }}
            >
              <div>
                <div className="fw-bold text-uppercase" style={{ fontSize: '0.7rem', letterSpacing: '0.5px', opacity: 0.85 }}>
                  Total Transaksi
                </div>
                {successOrder.isLunas ? (
                  <span className="badge rounded-pill px-2 py-2 mt-1" style={{ fontSize: '0.66rem', backgroundColor: '#dcfce7', color: '#166534' }}>
                    <i className="bi bi-check-circle-fill me-1"></i> Lunas
                  </span>
                ) : (
                  <span className="badge rounded-pill px-2 py-2 mt-1" style={{ fontSize: '0.66rem', backgroundColor: '#fef3c7', color: '#92400e' }}>
                    <i className="bi bi-clock-fill me-1"></i> Belum Lunas
                  </span>
                )}
              </div>
              <div className="fw-bold text-white" style={{ fontSize: '1.45rem' }}>
                Rp {animatedAmount.toLocaleString('id-ID')}
              </div>
            </div>

            <div className="text-start bg-light px-2 py-1 rounded-3 border mb-2" style={{ fontSize: '0.75rem' }}>
              <div className="d-flex justify-content-between">
                <span className="text-muted">No. Nota:</span>
                <span className="fw-bold text-dark">{successOrder.invoiceId}</span>
              </div>
              <div className="d-flex justify-content-between">
                <span className="text-muted">Pelanggan:</span>
                <span className="fw-bold text-dark">{successOrder.pelangganNama}</span>
              </div>
              <div className="d-flex justify-content-between">
                <span className="text-muted">Metode Bayar:</span>
                <span className="fw-bold text-dark">{successOrder.metodeBayar}</span>
              </div>
              {successOrder.kembalian > 0 && (
                <div className="d-flex justify-content-between border-top pt-1 mt-1">
                  <span className="text-muted fw-bold">Kembalian:</span>
                  <span className="fw-bold text-success">Rp {successOrder.kembalian.toLocaleString('id-ID')}</span>
                </div>
              )}
            </div>

            <div className="d-grid gap-2 mt-auto">
              <button
                type="button"
                className="btn btn-outline-primary py-2 rounded-3 fw-bold"
                style={{ fontSize: '0.85rem' }}
                onClick={() => {
                  setShowSuccessModal(false);
                  navigate(`/order/${successOrder.id}`);
                }}
              >
                <i className="bi bi-receipt me-1"></i> Lihat Detail Order
              </button>
              <button
                type="button"
                className="btn btn-primary py-2 rounded-3 fw-bold text-white"
                style={{ fontSize: '0.88rem', backgroundColor: '#0134d4', borderColor: '#0134d4' }}
                onClick={() => {
                  setShowSuccessModal(false);
                  setSuccessOrder(null);
                  setShowPaymentDrawer(true);
                }}
              >
                <i className="bi bi-plus-circle me-1"></i> Transaksi Baru
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pilih Pelanggan */}
      {showModal && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 1070,
            animation: 'fadeIn 0.15s ease-out'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowModal(false);
              setIsAdding(false);
              setPelangganSearchTerm('');
            }
          }}
        >
          <div
            className="bg-white rounded-4 shadow-xl w-100 overflow-hidden d-flex flex-column"
            style={{
              maxWidth: '380px',
              maxHeight: '85vh',
              borderRadius: '14px',
              animation: 'scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <div className="d-flex justify-content-between align-items-center px-3 py-2 border-bottom bg-light flex-shrink-0">
              <div className="d-flex align-items-center gap-2">
                <div
                  className="rounded-circle bg-primary-subtle text-primary d-flex align-items-center justify-content-center"
                  style={{ width: '30px', height: '30px' }}
                >
                  <i className={`bi ${isAdding ? 'bi-person-plus-fill' : 'bi-people-fill'}`} style={{ fontSize: '0.9rem' }}></i>
                </div>
                <h6 className="fw-bold mb-0 text-dark" style={{ fontSize: '0.9rem' }}>
                  {isAdding ? 'Tambah Pelanggan Baru' : 'Pilih Pelanggan'}
                </h6>
              </div>
              <button
                type="button"
                className="btn-close shadow-none"
                style={{ transform: 'scale(0.8)' }}
                onClick={() => {
                  setShowModal(false);
                  setIsAdding(false);
                  setPelangganSearchTerm('');
                }}
                aria-label="Tutup"
              ></button>
            </div>

            <div
              className="p-3 d-flex flex-column"
              style={{
                flex: '1 1 auto',
                minHeight: 0,
                overflowY: isAdding ? 'auto' : 'hidden',
                overscrollBehavior: 'contain',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {isAdding ? (
                <form onSubmit={handleAddPelanggan}>
                  <div className="mb-2">
                    <label className="form-label text-muted fw-bold mb-1" style={{ fontSize: '0.72rem' }}>Nama Pelanggan</label>
                    <input
                      className="form-control form-control-sm rounded-3 border py-1"
                      style={{ fontSize: '0.82rem' }}
                      placeholder="Nama lengkap"
                      value={newPelanggan.nama}
                      onChange={e => setNewPelanggan({ ...newPelanggan, nama: e.target.value })}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="mb-2">
                    <label className="form-label text-muted fw-bold mb-1" style={{ fontSize: '0.72rem' }}>Nomor WhatsApp / HP</label>
                    <input
                      className="form-control form-control-sm rounded-3 border py-1"
                      style={{ fontSize: '0.82rem' }}
                      placeholder="Contoh: 08123456789"
                      value={newPelanggan.hp}
                      onChange={e => setNewPelanggan({ ...newPelanggan, hp: e.target.value })}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label text-muted fw-bold mb-1" style={{ fontSize: '0.72rem' }}>Alamat (Opsional)</label>
                    <textarea
                      className="form-control form-control-sm rounded-3 border"
                      style={{ fontSize: '0.82rem' }}
                      rows="2"
                      placeholder="Alamat pelanggan"
                      value={newPelanggan.alamat}
                      onChange={e => setNewPelanggan({ ...newPelanggan, alamat: e.target.value })}
                    ></textarea>
                  </div>
                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-light border flex-fill rounded-3 fw-bold py-1"
                      style={{ fontSize: '0.8rem' }}
                      onClick={() => setIsAdding(false)}
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="btn btn-sm btn-primary flex-fill rounded-3 fw-bold py-1 shadow-xs text-white"
                      style={{ fontSize: '0.8rem', backgroundColor: '#0134d4', borderColor: '#0134d4' }}
                    >
                      {BUTTON_TEXT.SAVE}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  {/* Bagian atas (tetap): tombol tambah, search, Pelanggan Umum */}
                  <div className="flex-shrink-0">
                    <div className="d-flex gap-2 mb-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary rounded-3 w-100 fw-bold py-1 d-flex align-items-center justify-content-center gap-1 shadow-xs"
                        style={{ fontSize: '0.78rem' }}
                        onClick={() => setIsAdding(true)}
                        title={BUTTON_TITLE.ADD}
                      >
                        <i className="bi bi-person-plus-fill"></i>
                        <span>Tambah Pelanggan Baru</span>
                      </button>
                    </div>

                    <div className="input-group input-group-sm mb-2 border rounded-3 overflow-hidden shadow-xs">
                      <span className="input-group-text bg-white border-0 text-muted ps-2">
                        <i className="bi bi-search" style={{ fontSize: '0.75rem' }}></i>
                      </span>
                      <input
                        type="text"
                        className="form-control border-0 shadow-none ps-1 py-1"
                        style={{ fontSize: '0.8rem' }}
                        placeholder="Cari nama atau no. HP..."
                        value={pelangganSearchTerm}
                        onChange={(e) => setPelangganSearchTerm(e.target.value)}
                      />
                      {pelangganSearchTerm && (
                        <button
                          type="button"
                          className="btn btn-sm btn-link text-decoration-none text-muted pe-2"
                          onClick={() => setPelangganSearchTerm('')}
                        >
                          <i className="bi bi-x-circle-fill"></i>
                        </button>
                      )}
                    </div>

                    <div
                      className="p-2 rounded-3 border mb-2 d-flex justify-content-between align-items-center transition-all bg-light"
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        setSelectedPelanggan(null);
                        setShowModal(false);
                        setPelangganSearchTerm('');
                      }}
                    >
                      <div className="d-flex align-items-center gap-2">
                        <div
                          className="rounded-circle bg-secondary-subtle text-secondary d-flex align-items-center justify-content-center"
                          style={{ width: '28px', height: '28px' }}
                        >
                          <i className="bi bi-person-dash" style={{ fontSize: '0.8rem' }}></i>
                        </div>
                        <div>
                          <div className="fw-bold text-dark" style={{ fontSize: '0.8rem' }}>Pelanggan Umum</div>
                          <small className="text-muted" style={{ fontSize: '0.68rem' }}>Pelanggan tanpa data kontak (Default)</small>
                        </div>
                      </div>
                      <span className="badge bg-secondary-subtle text-secondary rounded-pill px-2 py-0" style={{ fontSize: '0.65rem' }}>
                        Pilih
                      </span>
                    </div>

                  </div>

                  {/* Daftar pelanggan: area ini yang scroll ke bawah */}
                  <div
                    className="flex-grow-1"
                    style={{
                      minHeight: 0,
                      overflowY: 'auto',
                      overscrollBehavior: 'contain',
                      WebkitOverflowScrolling: 'touch',
                      touchAction: 'pan-y',
                    }}
                  >
                    {daftarPelanggan === undefined ? (
                      <CustomerListSkeleton count={3} />
                    ) : (daftarPelanggan || []).length === 0 ? (
                      <p className="text-center text-muted py-3 small mb-0">Belum ada data pelanggan</p>
                    ) : (
                      <div className="d-grid gap-1">
                        {(daftarPelanggan || [])
                          .filter(p => {
                            if (!pelangganSearchTerm) return true;
                            const q = pelangganSearchTerm.toLowerCase();
                            return (p.nama && p.nama.toLowerCase().includes(q)) || (p.hp && p.hp.toLowerCase().includes(q));
                          })
                          .map(p => (
                            <div
                              key={p.id}
                              className="p-2 rounded-3 border d-flex justify-content-between align-items-center transition-all bg-white"
                              style={{ cursor: 'pointer' }}
                              onClick={() => {
                                setSelectedPelanggan(p);
                                setShowModal(false);
                                setPelangganSearchTerm('');
                              }}
                            >
                              <div className="d-flex align-items-center gap-2">
                                <div
                                  className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold"
                                  style={{ width: '28px', height: '28px', fontSize: '0.72rem' }}
                                >
                                  {p.nama ? p.nama.charAt(0).toUpperCase() : 'P'}
                                </div>
                                <div>
                                  <div className="fw-bold text-dark text-truncate" style={{ fontSize: '0.8rem', maxWidth: '190px' }}>
                                    {p.nama}
                                  </div>
                                  <small className="text-muted" style={{ fontSize: '0.68rem' }}>
                                    {p.hp || '-'}
                                  </small>
                                </div>
                              </div>
                              <span className="badge bg-primary-subtle text-primary rounded-pill px-2 py-0" style={{ fontSize: '0.65rem' }}>
                                Pilih
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Plan Gate Modal */}
      <PlanGateModal
        isOpen={gateModal?.open}
        onClose={() => setGateModal({ open: false, type: 'TRANSACTION_LIMIT', data: {} })}
        type={gateModal?.type || 'TRANSACTION_LIMIT'}
        customData={gateModal?.data || {}}
      />
    </div>
  );
};

export default Transaksi;
