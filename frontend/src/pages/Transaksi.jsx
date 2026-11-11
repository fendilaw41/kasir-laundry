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

      // Jika mouse wheel memutar vertikal (deltaY), alihkan ke geser horizontal jika elemen overflow
      if (e.deltaY !== 0 && el.scrollWidth > el.clientWidth) {
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

const Transaksi = () => {
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

  // Horizontal Scroll Ref untuk Layanan
  const productScrollRef = useHorizontalScroll();

  // State untuk Floating Bottom Sheet / Drawer Pembayaran (Default: Terbuka)
  const [showPaymentDrawer, setShowPaymentDrawer] = useState(true);
  const [isCompactPayment, setIsCompactPayment] = useState(true);
  const [orderDataPending, setOrderDataPending] = useState(null);
  const [isLunas, setIsLunas] = useState(true);
  const [nominalBayar, setNominalBayar] = useState('');
  const [drawerMetodeBayar, setDrawerMetodeBayar] = useState(metodeBayar || 'Cash');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State untuk Search Pelanggan
  const [pelangganSearchTerm, setPelangganSearchTerm] = useState('');

  // State untuk Modal Sukses Transaksi (Animasi Angka & Suara)
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successOrder, setSuccessOrder] = useState(null);
  const [animatedAmount, setAnimatedAmount] = useState(0);

  // State untuk Popup Diskon
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [tempDiscountType, setTempDiscountType] = useState(diskonTipe || 'Persentase');
  const [tempDiscountValue, setTempDiscountValue] = useState(diskonNilai || 0);

  // Sinkronkan drawerMetodeBayar dengan metodeBayar default
  useEffect(() => {
    if (metodeBayar) setDrawerMetodeBayar(metodeBayar);
  }, [metodeBayar]);

  // Ekstrak kategori unik dari daftar produk
  const categories = useMemo(() => {
    if (!Array.isArray(products)) return [];
    return Array.from(new Set(products.map((p) => p.category).filter(Boolean)));
  }, [products]);

  // Filter produk berdasarkan tab kategori yang dipilih
  const filteredProducts = useMemo(() => {
    if (!Array.isArray(products)) return [];
    if (selectedCategory === 'ALL') return products;
    return products.filter((p) => p.category?.toUpperCase() === selectedCategory.toUpperCase());
  }, [products, selectedCategory]);

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
  const getProductCode = (p) => {
    if (p.code && p.code.trim()) return p.code.trim().toUpperCase();
    const words = (p.name || '').split(' ').filter(Boolean);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0] + (words[2] ? words[2][0] : '')).toUpperCase().slice(0, 3);
    }
    return (p.name || 'SRV').slice(0, 3).toUpperCase();
  };

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

  // Buka modal diskon dengan sinkronisasi nilai sementara
  const handleOpenDiscountModal = () => {
    setTempDiscountType(diskonTipe);
    setTempDiscountValue(diskonNilai);
    setShowDiscountModal(true);
  };

  const handleApplyDiscount = () => {
    setDiskonTipe(tempDiscountType);
    setDiskonNilai(tempDiscountValue);
    setShowDiscountModal(false);
  };

  const handleResetDiscount = () => {
    setTempDiscountValue(0);
    setDiskonNilai(0);
    setShowDiscountModal(false);
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
        marginBottom: showPaymentDrawer ? (isCompactPayment ? '180px' : '380px') : '85px',
      }}
    >
      <div className="card-body p-3">

        {/* Section Header Layanan */}
        <div className="mb-2 px-1">
          <h5 className="fw-bold text-dark mb-0" style={{ fontSize: '1.05rem' }}>Layanan</h5>
          <small className="text-muted" style={{ fontSize: '0.72rem' }}>Ketuk kartu untuk memilih jenis cuci/setrika</small>
        </div>

        {/* Tab Kategori Pills (Scroll Horizontal sama seperti Inventory) */}
        <div className="d-flex overflow-auto pb-1 gap-2 mx-n1 px-1 no-scrollbar mb-2">
          {/* Tab Semua */}
          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3 py-1 fw-bold border-0 text-nowrap flex-shrink-0 transition-all ${selectedCategory === 'ALL' ? 'btn-primary text-white shadow-xs' : 'bg-light text-dark'}`}
            style={{
              fontSize: '0.78rem',
              minWidth: '85px',
              backgroundColor: selectedCategory === 'ALL' ? '#0134d4' : '#f1f5f9',
            }}
            onClick={() => setSelectedCategory('ALL')}
          >
            Semua
          </button>

          {/* Kategori-Kategori Produk */}
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`btn btn-sm rounded-pill px-3 py-1 fw-bold border-0 text-nowrap flex-shrink-0 text-uppercase transition-all ${selectedCategory.toUpperCase() === cat.toUpperCase() ? 'btn-primary text-white shadow-xs' : 'bg-light text-dark'}`}
              style={{
                fontSize: '0.78rem',
                minWidth: '120px',
                backgroundColor: selectedCategory.toUpperCase() === cat.toUpperCase() ? '#0134d4' : '#f1f5f9',
              }}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Card Layanan / Produk (2 Baris x 2 Kolom = Maksimal 4 Card terlihat, jika lebih geser kanan) */}
        <div className="mb-3">
          {(!products || products.length === 0) ? (
            <div className="p-3 text-center bg-light rounded-3 border text-muted small">
              Belum ada produk/layanan yang tersedia.
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-3 text-center bg-light rounded-3 border text-muted small">
              Tidak ada layanan untuk kategori ini.
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
                WebkitOverflowScrolling: 'touch',
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

        {/* Gunakan Inventori - Scroller Horizontal Lebih Ringkas & Kecil */}
        <div className="mb-2">
          <label className="form-label small fw-bold text-muted text-uppercase mb-1 px-1" style={{ fontSize: '0.68rem', letterSpacing: '0.3px' }}>
            Gunakan Inventori
          </label>
          <div className="d-flex overflow-auto pb-1 gap-2 mx-n1 px-1 inventory-scroller no-scrollbar">
            {inventory?.filter(inv => !(inv.status === 'pending' && inv.stok === 0)).map(inv => {
              const activeItem = selectedInventory.find(s => s.id === inv.id);
              const isActive = !!activeItem;
              const isOutOfStock = Number(inv.stok || 0) <= 0;
              return (
                <div
                  key={inv.id}
                  className={`flex-shrink-0 p-1 rounded-3 border d-flex flex-column align-items-center justify-content-center transition-all ${isActive
                    ? 'bg-outline-primary text-dark border-primary shadow-xs'
                    : isOutOfStock
                      ? 'bg-light text-muted border-dashed opacity-50'
                      : 'bg-white text-dark shadow-xs'
                    }`}
                  style={{ minWidth: '70px', height: '68px', borderRadius: '12px' }}
                >
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
                    <i className={`bi ${isActive ? 'bi-check-circle-fill text-primary' : 'bi-box-seam'} d-block mb-0`} style={{ fontSize: '0.9rem' }}></i>
                    <div className="fw-bold text-truncate" style={{ fontSize: '0.65rem', maxWidth: '62px' }}>{inv.nama}</div>
                    <small className={isOutOfStock ? 'text-danger fw-bold' : 'text-muted'} style={{ fontSize: '0.58rem' }}>
                      {isOutOfStock ? '0' : `Stok: ${inv.stok}`}
                    </small>
                  </div>
                  {isActive && (
                    <div className="d-flex align-items-center gap-1 bg-white rounded-pill px-1 py-0 shadow-xs mt-0 w-100 justify-content-center border" style={{ height: '18px' }}>
                      <button className="btn btn-sm btn-light rounded-circle p-0 d-flex align-items-center justify-content-center" style={{ width: '14px', height: '14px' }} onClick={(e) => { e.stopPropagation(); updateInventoryQty(inv.id, -1); }}>
                        <i className="bi bi-dash text-dark" style={{ fontSize: '0.6rem' }}></i>
                      </button>
                      <span className="fw-bold text-dark px-0" style={{ fontSize: '0.65rem', minWidth: '12px', textAlign: 'center' }}>{activeItem.quantity || 1}</span>
                      <button className="btn btn-sm btn-light rounded-circle p-0 d-flex align-items-center justify-content-center" style={{ width: '14px', height: '14px' }} onClick={(e) => { e.stopPropagation(); updateInventoryQty(inv.id, 1); }}>
                        <i className="bi bi-plus text-dark" style={{ fontSize: '0.6rem' }}></i>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Card Badges (Delivery, Estimasi, Prioritas, Diskon) - Bersih Tanpa Icon Menggunakan Select Native */}
        <div className="d-flex overflow-auto pb-1 gap-2 mx-n1 px-1 no-scrollbar mb-2">
          {/* Card Badge 1: Delivery */}
          <div className="flex-shrink-0 p-2 rounded-3 border bg-white shadow-xs" style={{ minWidth: '135px' }}>
            <label htmlFor="delivery-select" className="text-muted fw-bold text-uppercase d-block mb-0" style={{ fontSize: '0.62rem', letterSpacing: '0.3px' }}>
              Delivery
            </label>
            <select
              id="delivery-select"
              aria-label="Delivery"
              className="form-select form-select-sm border-0 p-0 fw-bold text-dark bg-transparent shadow-none"
              style={{ fontSize: '0.6rem', cursor: 'pointer', height: '24px' }}
              value={tipeLayanan}
              onChange={(e) => setTipeLayanan(e.target.value)}
            >
              <option value="Datang Langsung">Datang Langsung</option>
              <option value="Jemput/Antar">Antar Jemput</option>
            </select>
          </div>

          {/* Card Badge 2: Estimasi */}
          <div className="flex-shrink-0 p-2 rounded-3 border bg-white shadow-xs" style={{ minWidth: '115px' }}>
            <label htmlFor="estimasi-input" className="text-muted fw-bold text-uppercase d-block mb-0" style={{ fontSize: '0.62rem', letterSpacing: '0.3px' }}>
              Estimasi
            </label>
            <div className="d-flex align-items-center gap-1" style={{ height: '24px' }}>
              <input
                id="estimasi-input"
                aria-label="Estimasi (Hari)"
                type="number"
                className="form-control form-control-sm border-0 p-0 fw-bold text-dark"
                style={{
                  width: '32px',
                  fontSize: '0.82rem',
                  background: 'transparent',
                  boxShadow: 'none',
                  height: '24px',
                }}
                value={estimasi}
                onChange={(e) => setEstimasi(e.target.value)}
                onFocus={(e) => e.target.select()}
                min="0"
                required
              />
              <span className="fw-bold text-dark" style={{ fontSize: '0.78rem' }}>Hari</span>
            </div>
          </div>

          {/* Card Badge 3: Prioritas */}
          <div
            className={`flex-shrink-0 p-2 rounded-3 border shadow-xs transition-all ${isPriority === 'Ya' ? 'border-warning bg-warning-subtle' : 'bg-white'}`}
            style={{ minWidth: '115px' }}
          >
            <label htmlFor="prioritas-select" className="text-muted fw-bold text-uppercase d-block mb-0" style={{ fontSize: '0.62rem', letterSpacing: '0.3px' }}>
              Prioritas
            </label>
            <select
              id="prioritas-select"
              aria-label="Prioritas"
              className={`form-select form-select-sm border-0 p-0 fw-bold bg-transparent shadow-none ${isPriority === 'Ya' ? 'text-warning' : 'text-dark'}`}
              style={{ fontSize: '0.8rem', cursor: 'pointer', height: '24px' }}
              value={isPriority}
              onChange={(e) => setIsPriority(e.target.value)}
            >
              <option value="Tidak">Biasa</option>
              <option value="Ya">Prioritas</option>
            </select>
          </div>

          {/* Card Badge 4: Diskon (Klik Buka Popup Modal) */}
          <div
            className={`flex-shrink-0 p-2 rounded-3 border shadow-xs transition-all ${nilaiDiskon > 0 ? 'border-danger bg-danger-subtle' : 'bg-white'}`}
            style={{ minWidth: '135px', cursor: 'pointer' }}
            onClick={handleOpenDiscountModal}
          >
            <div className="d-flex justify-content-between align-items-center">
              <label className="text-muted fw-bold text-uppercase d-block mb-0" style={{ fontSize: '0.62rem', letterSpacing: '0.3px', cursor: 'pointer' }}>
                Diskon
              </label>
              <i className="bi bi-sliders text-muted" style={{ fontSize: '0.68rem' }}></i>
            </div>
            <div
              className={`fw-bold text-truncate ${nilaiDiskon > 0 ? 'text-danger' : 'text-dark'}`}
              style={{ fontSize: '0.8rem', height: '24px', display: 'flex', alignItems: 'center' }}
            >
              {nilaiDiskon > 0
                ? (diskonTipe === 'Persentase' ? `${diskonNilai}% (Rp ${nilaiDiskon.toLocaleString('id-ID')})` : `Rp ${parseInt(diskonNilai || 0).toLocaleString('id-ID')}`)
                : '0%'}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Bottom Drawer Pembayaran (Docked Bottom) */}
      {showPaymentDrawer ? (
        <div
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
              onClick={() => setIsCompactPayment(!isCompactPayment)}
              title={isCompactPayment ? 'Klik untuk perbesar' : 'Klik untuk perkecil'}
            ></div>

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
                  onClick={() => setIsCompactPayment(!isCompactPayment)}
                  title={isCompactPayment ? 'Perbesar tampilan drawer' : 'Perkecil tampilan drawer'}
                >
                  <i className={`bi ${isCompactPayment ? 'bi-arrows-angle-expand' : 'bi-arrows-angle-contract'}`} style={{ fontSize: isCompactPayment ? '0.75rem' : '0.85rem' }}></i>
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
          </div>
        </div>
      ) : (
        <div
          className="position-fixed bottom-0 start-50 translate-middle-x mb-5 text-center"
          style={{ zIndex: 1050, animation: 'fadeIn 0.2s ease-out' }}
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

      {/* Modal Popup Diskon (Pilihan Persentase atau Rupiah) */}
      {showDiscountModal && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 1075,
            animation: 'fadeIn 0.15s ease-out'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDiscountModal(false);
          }}
        >
          <div
            className="bg-white rounded-4 shadow-xl w-100 overflow-hidden"
            style={{
              maxWidth: '360px',
              animation: 'scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {/* Modal Header */}
            <div className="d-flex justify-content-between align-items-center px-3 py-2 border-bottom bg-light">
              <div className="d-flex align-items-center gap-2">
                <div
                  className="rounded-circle bg-danger-subtle text-danger d-flex align-items-center justify-content-center"
                  style={{ width: '30px', height: '30px' }}
                >
                  <i className="bi bi-percent" style={{ fontSize: '0.9rem' }}></i>
                </div>
                <h6 className="fw-bold mb-0 text-dark" style={{ fontSize: '0.9rem' }}>
                  Pengaturan Diskon
                </h6>
              </div>
              <button
                type="button"
                className="btn-close shadow-none"
                style={{ transform: 'scale(0.8)' }}
                onClick={() => setShowDiscountModal(false)}
                aria-label="Tutup"
              ></button>
            </div>

            {/* Modal Body */}
            <div className="p-3">
              {/* Segmented Control: % vs Rp */}
              <div className="d-flex bg-light p-1 rounded-3 border mb-3">
                <button
                  type="button"
                  className={`btn flex-fill rounded-2 py-1 fw-bold transition-all border-0 ${tempDiscountType === 'Persentase' ? 'btn-primary shadow-xs text-white' : 'btn-light text-muted bg-transparent'}`}
                  style={{ fontSize: '0.78rem', backgroundColor: tempDiscountType === 'Persentase' ? '#0134d4' : 'transparent' }}
                  onClick={() => setTempDiscountType('Persentase')}
                >
                  Persentase (%)
                </button>
                <button
                  type="button"
                  className={`btn flex-fill rounded-2 py-1 fw-bold transition-all border-0 ${tempDiscountType === 'Harga' ? 'btn-primary shadow-xs text-white' : 'btn-light text-muted bg-transparent'}`}
                  style={{ fontSize: '0.78rem', backgroundColor: tempDiscountType === 'Harga' ? '#0134d4' : 'transparent' }}
                  onClick={() => setTempDiscountType('Harga')}
                >
                  Nominal (Rp)
                </button>
              </div>

              {/* Input Nilai Diskon */}
              <label className="form-label text-muted fw-bold mb-1" style={{ fontSize: '0.72rem' }}>
                {tempDiscountType === 'Persentase' ? 'Persentase Potongan (%)' : 'Jumlah Potongan (Rp)'}
              </label>
              <div className="input-group input-group-sm mb-2 border rounded-3 overflow-hidden shadow-xs">
                <span className="input-group-text bg-white border-0 fw-bold text-muted">
                  {tempDiscountType === 'Persentase' ? '%' : 'Rp'}
                </span>
                <input
                  type="number"
                  className="form-control border-0 fw-bold py-2"
                  style={{ fontSize: '1rem' }}
                  placeholder="0"
                  value={tempDiscountValue}
                  onChange={(e) => setTempDiscountValue(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  min="0"
                  max={tempDiscountType === 'Persentase' ? 100 : subtotal}
                  autoFocus
                />
              </div>

              {/* Quick Presets */}
              <div className="d-flex gap-1 flex-wrap mb-3">
                {tempDiscountType === 'Persentase' ? (
                  [5, 10, 15, 20, 50].map((val) => (
                    <button
                      key={val}
                      type="button"
                      className={`btn btn-sm rounded-pill px-2 py-0 fw-bold ${Number(tempDiscountValue) === val ? 'btn-danger' : 'btn-light border'}`}
                      style={{ fontSize: '0.7rem' }}
                      onClick={() => setTempDiscountValue(val)}
                    >
                      {val}%
                    </button>
                  ))
                ) : (
                  [5000, 10000, 20000, 50000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      className={`btn btn-sm rounded-pill px-2 py-0 fw-bold ${Number(tempDiscountValue) === val ? 'btn-danger' : 'btn-light border'}`}
                      style={{ fontSize: '0.7rem' }}
                      onClick={() => setTempDiscountValue(val)}
                    >
                      {val / 1000}rb
                    </button>
                  ))
                )}
              </div>

              {/* Preview Potongan */}
              <div className="bg-light p-2 rounded-3 border mb-3 d-flex justify-content-between align-items-center">
                <span className="small text-muted" style={{ fontSize: '0.75rem' }}>Total Potongan:</span>
                <span className="fw-bold text-danger" style={{ fontSize: '0.88rem' }}>
                  - Rp {(tempDiscountType === 'Persentase'
                    ? (subtotal * ((Number(tempDiscountValue) || 0) / 100))
                    : (Number(tempDiscountValue) || 0)).toLocaleString('id-ID')}
                </span>
              </div>

              {/* Aksi Modal Diskon */}
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-light border flex-fill rounded-3 fw-bold py-2"
                  style={{ fontSize: '0.8rem' }}
                  onClick={handleResetDiscount}
                >
                  Hapus Diskon
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary flex-fill rounded-3 fw-bold py-2 shadow-xs text-white"
                  style={{ fontSize: '0.8rem', backgroundColor: '#0134d4', borderColor: '#0134d4' }}
                  onClick={handleApplyDiscount}
                >
                  Terapkan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Sukses Transaksi dengan Animasi Counter dan Suara */}
      {showSuccessModal && successOrder && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(5px)',
            zIndex: 1060,
            animation: 'fadeIn 0.25s ease-out'
          }}
        >
          <div
            className="bg-white rounded-4 shadow-lg p-3 text-center w-100"
            style={{
              maxWidth: '340px',
              animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <div
              className="rounded-circle mx-auto mb-2 d-flex align-items-center justify-content-center shadow-xs"
              style={{
                width: '48px',
                height: '48px',
                backgroundColor: '#dcfce7',
                color: '#16a34a',
              }}
            >
              <i className="bi bi-check-lg" style={{ fontSize: '1.75rem' }}></i>
            </div>

            <h5 className="fw-bold text-dark mb-0" style={{ fontSize: '1.05rem' }}>Transaksi Berhasil!</h5>
            <p className="text-muted small mb-2" style={{ fontSize: '0.72rem' }}>Pesanan telah berhasil dicatat & diproses.</p>

            <div className="bg-light p-2 rounded-3 mb-2 border">
              <small className="text-muted text-uppercase fw-bold d-block" style={{ fontSize: '0.65rem' }}>
                Total Transaksi
              </small>
              <h2 className="fw-bold text-primary mb-0 mt-0" style={{ fontSize: '1.45rem', color: '#0134d4' }}>
                Rp {animatedAmount.toLocaleString('id-ID')}
              </h2>
              {successOrder.isLunas ? (
                <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2 py-0 mt-1" style={{ fontSize: '0.68rem' }}>
                  <i className="bi bi-check-circle-fill me-1"></i> Lunas
                </span>
              ) : (
                <span className="badge bg-warning-subtle text-warning border border-warning-subtle rounded-pill px-2 py-0 mt-1" style={{ fontSize: '0.68rem' }}>
                  <i className="bi bi-clock-fill me-1"></i> Belum Lunas
                </span>
              )}
            </div>

            <div className="text-start bg-white p-2 rounded-3 border mb-2" style={{ fontSize: '0.75rem' }}>
              <div className="d-flex justify-content-between mb-0">
                <span className="text-muted">No. Nota:</span>
                <span className="fw-bold text-dark">{successOrder.invoiceId}</span>
              </div>
              <div className="d-flex justify-content-between mb-0">
                <span className="text-muted">Pelanggan:</span>
                <span className="fw-bold text-dark">{successOrder.pelangganNama}</span>
              </div>
              <div className="d-flex justify-content-between mb-0">
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

            <div className="d-grid gap-1">
              <button
                type="button"
                className="btn btn-outline-primary py-1 rounded-3 fw-bold"
                style={{ fontSize: '0.8rem' }}
                onClick={() => {
                  setShowSuccessModal(false);
                  navigate(`/order/${successOrder.id}`);
                }}
              >
                <i className="bi bi-receipt me-1"></i> Lihat Detail Order
              </button>
              <button
                type="button"
                className="btn btn-primary py-1 rounded-3 fw-bold shadow-xs text-white"
                style={{ fontSize: '0.8rem', backgroundColor: '#0134d4', borderColor: '#0134d4' }}
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
            className="bg-white rounded-4 shadow-xl w-100 overflow-hidden"
            style={{
              maxWidth: '380px',
              animation: 'scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <div className="d-flex justify-content-between align-items-center px-3 py-2 border-bottom bg-light">
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

            <div className="p-3">
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

                  <div className="overflow-y-auto" style={{ maxHeight: '220px' }}>
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
