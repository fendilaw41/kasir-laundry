import { useLiveQuery } from 'dexie-react-hooks';
import { getProductsQuery } from '../db/repositories/products';
import { addProductToCart } from '../db/repositories/cart';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import toast from 'react-hot-toast';
import { TOAST_MESSAGES } from '../constants/appConstants';
import { ProductListSkeleton } from '../components/common/Skeleton';

const Product = () => {
  const products = useLiveQuery(getProductsQuery);
  const outletCtx = useOutletContext();
  const searchTerm = outletCtx?.productSearchTerm ?? '';
  const setSearchTerm = outletCtx?.setProductSearchTerm ?? (() => {});
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // State untuk menyimpan jumlah qty sementara per produk
  const [quantities, setQuantities] = useState({});

  // Ref & drag state untuk scrolling horizontal kategori (mouse drag & touch)
  const categoryScrollRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragScrollLeft, setDragScrollLeft] = useState(0);
  const hasMovedRef = useRef(false);

  const handleMouseDown = (e) => {
    if (!categoryScrollRef.current) return;
    setIsDragging(true);
    hasMovedRef.current = false;
    setDragStartX(e.pageX - categoryScrollRef.current.offsetLeft);
    setDragScrollLeft(categoryScrollRef.current.scrollLeft);
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !categoryScrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - categoryScrollRef.current.offsetLeft;
    const walk = (x - dragStartX) * 1.5;
    if (Math.abs(walk) > 4) {
      hasMovedRef.current = true;
    }
    categoryScrollRef.current.scrollLeft = dragScrollLeft - walk;
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  const handleWheel = (e) => {
    if (!categoryScrollRef.current) return;
    if (e.deltaY !== 0) {
      categoryScrollRef.current.scrollLeft += e.deltaY;
    }
  };

  // Ambil daftar kategori unik dari data produk
  const categories = useMemo(() => {
    if (!products) return [];
    return Array.from(new Set(products.map((p) => p.category).filter(Boolean)));
  }, [products]);

  const initialCategories = useMemo(() => categories.slice(0, 2), [categories]);
  const otherCategories = useMemo(() => categories.slice(2), [categories]);
  const isOtherSelected = otherCategories.includes(selectedCategory);

  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef(null);

  // Tutup dropdown jika klik di luar dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target)) {
        setIsCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const updateQty = (id, delta) => {
    setQuantities((prev) => ({
      ...prev,
      [id]: Math.max(1, (prev[id] || 1) + delta),
    }));
  };

  const addToCart = async (product) => {
    try {
      const qty = quantities[product.id] || 1;
      await addProductToCart(product, qty);

      toast.success(TOAST_MESSAGES.SUCCESS);

      // Reset qty setelah tambah
      setQuantities((prev) => ({ ...prev, [product.id]: 1 }));
    } catch (err) {
      toast.error(TOAST_MESSAGES.ERROR);
    }
  };

  const filteredProducts = products?.filter((p) => {
    const q = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !q ||
      p.name?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q) ||
      (p.code && p.code.toLowerCase().includes(q));

    const matchesCategory =
      selectedCategory === 'ALL' ||
      p.category?.toUpperCase() === selectedCategory.toUpperCase();

    return matchesSearch && matchesCategory;
  });

  // Pagination / Limit 10 data dengan tombol View More
  const [visibleCount, setVisibleCount] = useState(10);

  useEffect(() => {
    setVisibleCount(10);
  }, [searchTerm, selectedCategory]);

  const displayedProducts = useMemo(() => {
    if (!filteredProducts) return [];
    return filteredProducts.slice(0, visibleCount);
  }, [filteredProducts, visibleCount]);

  return (
    <div className="product-page pb-5" style={{ backgroundColor: '#f8faff', minHeight: '100vh' }}>
      {/* Category Filter Chips - Di Body & Tidak Menyambung Langsung dengan Header */}
      {categories.length > 0 && (
        <div className="pt-2 pb-1 mb-3">
          <div
            ref={categoryScrollRef}
            className="d-flex align-items-center gap-2 no-scrollbar position-relative"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-x',
              whiteSpace: 'nowrap',
              width: '100%',
              maxWidth: '100%',
              overflow: 'visible',
              cursor: isDragging ? 'grabbing' : 'grab',
              userSelect: 'none',
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            onWheel={handleWheel}
          >
            <style>{`
              .no-scrollbar::-webkit-scrollbar { display: none; }
            `}</style>
            <button
              type="button"
              className="btn btn-sm rounded-pill px-3 py-1.5 fw-semibold flex-shrink-0 transition-all text-nowrap d-inline-flex align-items-center justify-content-center"
              style={{
                fontSize: '0.6rem',
                backgroundColor: selectedCategory === 'ALL' ? '#0d5afd' : '#f8fafc',
                color: selectedCategory === 'ALL' ? '#ffffff' : '#334155',
                border: `1px solid ${selectedCategory === 'ALL' ? '#0d5afd' : '#e2e8f0'}`,
                boxShadow: selectedCategory === 'ALL' ? '0 2px 6px rgba(13, 90, 253, 0.25)' : 'none',
                touchAction: 'pan-x',
              }}
              onClick={(e) => {
                if (hasMovedRef.current) {
                  e.preventDefault();
                  return;
                }
                setSelectedCategory('ALL');
                setIsCategoryDropdownOpen(false);
              }}
            >
              Semua
            </button>

            {/* 2 Kategori awal */}
            {initialCategories.map((cat) => {
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  className="btn btn-sm rounded-pill px-3 py-1.5 fw-semibold flex-shrink-0 transition-all text-nowrap d-inline-flex align-items-center justify-content-center"
                  style={{
                    fontSize: '0.6rem',
                    backgroundColor: isActive ? '#0d5afd' : '#f8fafc',
                    color: isActive ? '#ffffff' : '#334155',
                    border: `1px solid ${isActive ? '#0d5afd' : '#e2e8f0'}`,
                    boxShadow: isActive ? '0 2px 6px rgba(13, 90, 253, 0.25)' : 'none',
                    touchAction: 'pan-x',
                  }}
                  onClick={(e) => {
                    if (hasMovedRef.current) {
                      e.preventDefault();
                      return;
                    }
                    setSelectedCategory(cat);
                    setIsCategoryDropdownOpen(false);
                  }}
                >
                  {cat}
                </button>
              );
            })}

            {/* Dropdown untuk kategori lainnya jika lebih dari 2 category */}
            {categories.length > 2 && (
              <div className="position-relative d-inline-block flex-shrink-0" ref={categoryDropdownRef}>
                <button
                  type="button"
                  className="btn btn-sm rounded-pill px-3 py-1.5 fw-semibold flex-shrink-0 transition-all text-nowrap d-inline-flex align-items-center justify-content-center"
                  style={{
                    fontSize: '0.6rem',
                    backgroundColor: isOtherSelected ? '#0d5afd' : '#f8fafc',
                    color: isOtherSelected ? '#ffffff' : '#334155',
                    border: `1px solid ${isOtherSelected ? '#0d5afd' : '#e2e8f0'}`,
                    boxShadow: isOtherSelected ? '0 2px 6px rgba(13, 90, 253, 0.25)' : 'none',
                    touchAction: 'pan-x',
                  }}
                  onClick={(e) => {
                    if (hasMovedRef.current) {
                      e.preventDefault();
                      return;
                    }
                    setIsCategoryDropdownOpen((prev) => !prev);
                  }}
                >
                  <span className="d-inline-flex align-items-center">
                    +{otherCategories.length}
                  </span>
                  <i
                    className={`bi bi-chevron-${isCategoryDropdownOpen ? 'up' : 'down'} ms-1`}
                    style={{ fontSize: '0.3rem' }}
                  ></i>
                </button>

                {isCategoryDropdownOpen && (
                  <div
                    className="dropdown-menu show shadow border-0 rounded-3 py-1 position-absolute mt-1"
                    style={{
                      top: '100%',
                      left: 0,
                      zIndex: 1050,
                      minWidth: '150px',
                      maxHeight: '220px',
                      overflowY: 'auto',
                      backgroundColor: '#ffffff',
                      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
                    }}
                  >
                    {otherCategories.map((cat) => {
                      const isCatActive = selectedCategory === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          className={`dropdown-item py-1.5 px-3 d-flex align-items-center justify-content-between text-nowrap ${isCatActive ? 'fw-bold text-primary bg-primary-subtle' : 'text-dark'
                            }`}
                          style={{ fontSize: '0.6rem' }}
                          onClick={() => {
                            setSelectedCategory(cat);
                            setIsCategoryDropdownOpen(false);
                          }}
                        >
                          <span>{cat}</span>
                          {isCatActive && (
                            <i className="bi bi-check2 text-primary ms-2 fs-6"></i>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Grid Produk Layanan */}
      {filteredProducts && filteredProducts.length > 0 ? (
        <div className="row g-2 g-sm-3 px-1">
          {displayedProducts.map((product) => {
            const isSetrikaOnly = product.category?.includes('SETRIKA') && !product.category?.includes('CUCI');
            const isSetrika = product.category?.includes('SETRIKA');

            return (
              <div className="col-6 col-md-4 col-lg-3" key={product.id}>
                <div
                  className="card h-100 border-0 rounded-4 overflow-hidden bg-white shadow-xs transition-all position-relative"
                  style={{
                    border: '1px solid #edf0f5',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                  }}
                >
                  {/* Thumbnail / Visual Area */}
                  <div
                    className="p-3 m-2 rounded-4 text-center position-relative d-flex align-items-center justify-content-center"
                    style={{
                      height: '115px',
                      background: isSetrikaOnly
                        ? 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)'
                        : isSetrika
                          ? 'linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%)'
                          : 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                    }}
                  >
                    {/* Category Pill & Product Code Header */}
                    <div
                      className="position-absolute top-0 start-0 end-0 p-2 d-flex align-items-center gap-1 overflow-x-auto no-scrollbar"
                      style={{
                        zIndex: 2,
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none',
                        WebkitOverflowScrolling: 'touch',
                        touchAction: 'pan-x',
                      }}
                    >
                      <span
                        className="badge rounded-pill px-2 py-0.5 shadow-xs fw-bold flex-shrink-0 text-nowrap"
                        style={{
                          fontSize: '0.62rem',
                          backgroundColor: isSetrikaOnly ? '#ea580c' : isSetrika ? '#4f46e5' : '#16a34a',
                          color: '#fff',
                          letterSpacing: '0.2px',
                        }}
                        title={product.category}
                      >
                        {product.category}
                      </span>

                      {product.code && (
                        <span
                          className="badge bg-white text-dark border rounded-pill px-1.5 py-0.5 shadow-xs fw-bold flex-shrink-0 text-nowrap ms-auto"
                          style={{ fontSize: '0.6rem' }}
                        >
                          {product.code}
                        </span>
                      )}
                    </div>

                    {/* Icon Graphic in Frosted Circle */}
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center shadow-xs"
                      style={{
                        width: '52px',
                        height: '52px',
                        backgroundColor: 'rgba(255, 255, 255, 0.88)',
                        backdropFilter: 'blur(4px)',
                      }}
                    >
                      <i
                        className={`bi ${isSetrikaOnly
                          ? 'bi-fire text-warning'
                          : isSetrika
                            ? 'bi-stars text-primary'
                            : 'bi-water text-success'
                          }`}
                        style={{ fontSize: '1.75rem' }}
                      ></i>
                    </div>
                  </div>

                  {/* Product Details Area */}
                  <div className="card-body p-3 pt-1 d-flex flex-column justify-content-between">
                    <div>
                      {/* Nama Layanan */}
                      <h6
                        className="fw-bold mb-1 text-dark text-truncate"
                        style={{ fontSize: '0.84rem', lineHeight: '1.3' }}
                        title={product.name}
                      >
                        {product.name?.split(' (')[0]}
                      </h6>

                      {/* Harga & Coretan Diskon (Shopee/Tokped Style) */}
                      <div className="d-flex align-items-baseline gap-2 mb-2">
                        <span className="fw-bolder text-primary" style={{ fontSize: '1rem' }}>
                          Rp {product.price?.toLocaleString('id-ID')}
                        </span>
                        <span
                          className="text-muted text-decoration-line-through"
                          style={{ fontSize: '0.68rem' }}
                        >
                          Rp {(product.price + 5000)?.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>

                    <div>
                      {/* Quantity Selector Stepper */}
                      <div className="d-flex align-items-center justify-content-between bg-light rounded-pill p-1 mb-2 border">
                        <button
                          type="button"
                          className="btn btn-sm btn-white rounded-circle shadow-xs border-0 d-flex align-items-center justify-content-center p-0"
                          style={{ width: '26px', height: '26px', backgroundColor: '#fff' }}
                          onClick={() => updateQty(product.id, -1)}
                        >
                          <i className="bi bi-dash fw-bold text-dark" style={{ fontSize: '0.85rem' }}></i>
                        </button>
                        <span className="fw-bold text-dark px-1" style={{ fontSize: '0.85rem' }}>
                          {quantities[product.id] || 1}
                        </span>
                        <button
                          type="button"
                          className="btn btn-sm btn-white rounded-circle shadow-xs border-0 d-flex align-items-center justify-content-center p-0"
                          style={{ width: '26px', height: '26px', backgroundColor: '#fff' }}
                          onClick={() => updateQty(product.id, 1)}
                        >
                          <i className="bi bi-plus fw-bold text-dark" style={{ fontSize: '0.85rem' }}></i>
                        </button>
                      </div>

                      {/* Add to Cart CTA Button */}
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm w-100 rounded-pill fw-bold py-2 d-flex align-items-center justify-content-center gap-1 shadow-xs"
                        style={{ fontSize: '0.8rem' }}
                        onClick={() => addToCart(product)}
                      >
                        <i className="bi bi-cart-plus-fill me-1"></i>
                        <span>+ Add</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Button View More (Jika data lebih dari 10) */}
          {filteredProducts && filteredProducts.length > visibleCount && (
            <div className="col-12 text-center mt-3 mb-2">
              <button
                type="button"
                className="btn btn-outline-primary rounded-pill px-4 py-2 fw-semibold shadow-xs d-inline-flex align-items-center gap-2"
                style={{ fontSize: '0.84rem' }}
                onClick={() => setVisibleCount((prev) => prev + 10)}
              >
                <span>View More</span>
                <span className="badge bg-primary text-white rounded-pill px-2 py-0.5" style={{ fontSize: '0.68rem' }}>
                  +{filteredProducts.length - visibleCount}
                </span>
                <i className="bi bi-chevron-down"></i>
              </button>
            </div>
          )}
        </div>
      ) : products === undefined ? (
        <ProductListSkeleton count={6} />
      ) : (
        /* Empty State (Shopee / Tokopedia Style) */
        <div className="text-center py-5 px-3">
          <div
            className="d-inline-flex p-3 rounded-circle mb-3 shadow-xs"
            style={{ backgroundColor: '#f1f5f9' }}
          >
            <i className="bi bi-search fs-1 text-muted"></i>
          </div>
          <h6 className="fw-bold text-dark mb-1">Layanan tidak ditemukan</h6>
          <p className="text-muted small mb-3">
            Coba gunakan kata kunci lain atau reset filter kategori.
          </p>
          <button
            type="button"
            className="btn btn-outline-primary btn-sm rounded-pill px-4 fw-semibold"
            onClick={() => {
              setSearchTerm('');
              setSelectedCategory('ALL');
            }}
          >
            Reset Pencarian
          </button>
        </div>
      )}
    </div>
  );
};

export default Product;
