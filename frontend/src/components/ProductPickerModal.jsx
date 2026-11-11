import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getProductsQuery } from '../db/repositories/products';
import { addProductToCart } from '../db/repositories/cart';
import toast from 'react-hot-toast';

const ProductPickerModal = ({ isOpen, onClose }) => {
  const products = useLiveQuery(getProductsQuery);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [quantities, setQuantities] = useState({});

  // Ekstrak kategori unik dari produk
  const categories = useMemo(() => {
    if (!Array.isArray(products)) return [];
    return Array.from(new Set(products.map((p) => p.category).filter(Boolean)));
  }, [products]);

  // Filter produk berdasarkan pencarian dan kategori
  const filteredProducts = useMemo(() => {
    if (!Array.isArray(products)) return [];
    const q = searchTerm.toLowerCase().trim();
    return products.filter((p) => {
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
  }, [products, searchTerm, selectedCategory]);

  const updateQty = (id, delta) => {
    setQuantities((prev) => ({
      ...prev,
      [id]: Math.max(1, (prev[id] || 1) + delta),
    }));
  };

  const handleAddToCart = async (product, e) => {
    if (e) e.stopPropagation();
    try {
      const qty = quantities[product.id] || 1;
      await addProductToCart(product, qty);
      toast.success(`${product.name?.split(' (')[0] || 'Layanan'} ditambahkan (${qty})`, {
        duration: 1200,
        position: 'bottom-center',
      });
      setQuantities((prev) => ({ ...prev, [product.id]: 1 }));
    } catch (err) {
      toast.error('Gagal menambahkan layanan');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
      style={{
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 1065,
        animation: 'fadeIn 0.15s ease-out',
        padding: '12px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-4 shadow-xl d-flex flex-column w-100 my-auto"
        style={{
          maxWidth: '560px',
          maxHeight: '88vh',
          animation: 'scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          overflow: 'hidden',
        }}
      >
        {/* Header Modal */}
        <div className="d-flex justify-content-between align-items-center px-3 py-2 border-bottom bg-light flex-shrink-0">
          <div className="d-flex align-items-center gap-2">
            <div
              className="rounded-circle bg-primary-subtle text-primary d-flex align-items-center justify-content-center"
              style={{ width: '30px', height: '30px' }}
            >
              <i className="bi bi-grid-fill" style={{ fontSize: '0.9rem' }}></i>
            </div>
            <div>
              <h6 className="fw-bold mb-0 text-dark" style={{ fontSize: '0.9rem' }}>
                Pilih Layanan / Produk
              </h6>
              <small className="text-muted" style={{ fontSize: '0.68rem' }}>
                Tersedia {products?.length || 0} layanan
              </small>
            </div>
          </div>
          <button
            type="button"
            className="btn-close shadow-none"
            style={{ transform: 'scale(0.8)' }}
            onClick={onClose}
            aria-label="Tutup"
          ></button>
        </div>

        {/* Search Bar & Category Chips */}
        <div className="px-3 pt-1 pb-1 bg-white border-bottom flex-shrink-0">
          {/* Search Input */}
          <div className="input-group input-group-sm mb-2 mt-2 shadow-xs rounded-3 overflow-hidden border">
            <span className="input-group-text bg-white border-0 text-muted ps-2">
              <i className="bi bi-search" style={{ fontSize: '0.75rem' }}></i>
            </span>
            <input
              type="text"
              className="form-control border-0 shadow-none ps-1 py-1"
              placeholder="Cari nama layanan, kode, atau kategori..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ fontSize: '0.8rem' }}
              autoFocus
            />
            {searchTerm && (
              <button
                type="button"
                className="btn btn-sm btn-link text-decoration-none text-muted pe-2"
                onClick={() => setSearchTerm('')}
                style={{ fontSize: '0.75rem' }}
              >
                <i className="bi bi-x-circle-fill"></i>
              </button>
            )}
          </div>

          {/* Category Chips Scrollable */}
          <div
            className="d-flex align-items-center gap-1 overflow-x-auto pb-1 no-scrollbar"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <style>{`
              .no-scrollbar::-webkit-scrollbar { display: none; }
              .custom-scroll {
                scrollbar-width: thin;
                scrollbar-color: #cbd5e1 #f8fafc;
              }
              .custom-scroll::-webkit-scrollbar {
                width: 6px;
              }
              .custom-scroll::-webkit-scrollbar-track {
                background: #f8fafc;
              }
              .custom-scroll::-webkit-scrollbar-thumb {
                background-color: #cbd5e1;
                border-radius: 4px;
              }
              .custom-scroll::-webkit-scrollbar-thumb:hover {
                background-color: #94a3b8;
              }
            `}</style>
            <button
              type="button"
              className={`btn btn-sm rounded-pill px-2 py-0 fw-semibold flex-shrink-0 transition-all text-nowrap border ${selectedCategory === 'ALL'
                ? 'btn-primary shadow-xs text-white'
                : 'btn-light bg-light text-muted'
                }`}
              style={{ fontSize: '0.68rem', lineHeight: '1.3' }}
              onClick={() => setSelectedCategory('ALL')}
            >
              Semua
            </button>
            {categories.map((cat) => {
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  className={`btn btn-sm rounded-pill px-2 py-0 fw-semibold flex-shrink-0 transition-all text-nowrap border ${isActive
                    ? 'btn-primary shadow-xs text-white'
                    : 'btn-light bg-light text-muted'
                    }`}
                  style={{ fontSize: '0.68rem', lineHeight: '1.3' }}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* List Daftar Layanan / Produk - Kecil, Rapi, Muat 12 Item Sekaligus & Bisa Scroll */}
        <div
          className="p-2 overflow-y-auto custom-scroll"
          style={{
            backgroundColor: '#f8fafc',
            maxHeight: 'calc(88vh - 170px)',
            overflowY: 'auto',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {filteredProducts && filteredProducts.length > 0 ? (
            <div className="d-flex flex-column gap-1">
              {filteredProducts.map((product) => {
                const isSetrikaOnly =
                  product.category?.includes('SETRIKA') &&
                  !product.category?.includes('CUCI');
                const isSetrika = product.category?.includes('SETRIKA');
                const qty = quantities[product.id] || 1;

                return (
                  <div
                    key={product.id}
                    className="p-1 px-2 bg-white rounded-3 border shadow-xs d-flex align-items-center justify-content-between gap-2 transition-all"
                    style={{ fontSize: '0.78rem' }}
                  >
                    {/* Kiri: Icon Kecil + Info Nama & Harga */}
                    <div className="d-flex align-items-center gap-2 overflow-hidden flex-grow-1">
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center shadow-xs flex-shrink-0"
                        style={{
                          width: '26px',
                          height: '26px',
                          backgroundColor: isSetrikaOnly
                            ? '#ffedd5'
                            : isSetrika
                              ? '#e0e7ff'
                              : '#dcfce7',
                          color: isSetrikaOnly
                            ? '#ea580c'
                            : isSetrika
                              ? '#4f46e5'
                              : '#16a34a',
                        }}
                      >
                        <i
                          className={`bi ${isSetrikaOnly
                            ? 'bi-fire'
                            : isSetrika
                              ? 'bi-stars'
                              : 'bi-water'
                            }`}
                          style={{ fontSize: '0.78rem' }}
                        ></i>
                      </div>

                      <div className="overflow-hidden">
                        <div className="d-flex align-items-center gap-1">
                          <span
                            className="fw-bold text-dark text-truncate"
                            style={{ fontSize: '0.78rem', maxWidth: '240px' }}
                            title={product.name}
                          >
                            {product.name}
                          </span>
                          {product.category && (
                            <span
                              className="badge rounded-pill px-1 py-0 fw-semibold text-truncate flex-shrink-0"
                              style={{
                                fontSize: '0.6rem',
                                backgroundColor: isSetrikaOnly
                                  ? '#fff7ed'
                                  : isSetrika
                                    ? '#eef2ff'
                                    : '#f0fdf4',
                                color: isSetrikaOnly
                                  ? '#c2410c'
                                  : isSetrika
                                    ? '#4338ca'
                                    : '#15803d',
                                border: `1px solid ${isSetrikaOnly
                                  ? '#fed7aa'
                                  : isSetrika
                                    ? '#c7d2fe'
                                    : '#bbf7d0'
                                  }`,
                              }}
                            >
                              {product.category}
                            </span>
                          )}
                        </div>
                        <div className="d-flex align-items-center gap-1">
                          <span
                            className="fw-bold text-primary"
                            style={{ fontSize: '0.78rem' }}
                          >
                            Rp {product.price?.toLocaleString('id-ID')}
                          </span>
                          {product.code && (
                            <span className="text-muted" style={{ fontSize: '0.65rem' }}>
                              • {product.code}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Kanan: Stepper Qty Ringkas & Tombol Pilih */}
                    <div className="d-flex align-items-center gap-1 flex-shrink-0">
                      <div
                        className="d-flex align-items-center bg-light rounded-pill px-1 border"
                        style={{ height: '24px' }}
                      >
                        <button
                          type="button"
                          className="btn btn-sm btn-white rounded-circle p-0 d-flex align-items-center justify-content-center border-0 shadow-xs"
                          style={{
                            width: '16px',
                            height: '16px',
                            backgroundColor: '#fff',
                          }}
                          onClick={() => updateQty(product.id, -1)}
                          aria-label="Kurangi"
                        >
                          <i
                            className="bi bi-dash fw-bold text-dark"
                            style={{ fontSize: '0.62rem' }}
                          ></i>
                        </button>
                        <span
                          className="fw-bold text-dark px-1"
                          style={{ fontSize: '0.7rem', minWidth: '16px', textAlign: 'center' }}
                        >
                          {qty}
                        </span>
                        <button
                          type="button"
                          className="btn btn-sm btn-white rounded-circle p-0 d-flex align-items-center justify-content-center border-0 shadow-xs"
                          style={{
                            width: '16px',
                            height: '16px',
                            backgroundColor: '#fff',
                          }}
                          onClick={() => updateQty(product.id, 1)}
                          aria-label="Tambah"
                        >
                          <i
                            className="bi bi-plus fw-bold text-dark"
                            style={{ fontSize: '0.62rem' }}
                          ></i>
                        </button>
                      </div>

                      <button
                        type="button"
                        className="btn btn-primary btn-sm rounded-pill fw-bold px-2 py-0 d-flex align-items-center justify-content-center shadow-xs"
                        style={{ fontSize: '0.68rem', height: '24px' }}
                        onClick={(e) => handleAddToCart(product, e)}
                      >
                        <i className="bi bi-plus me-0"></i>
                        <span>Pilih</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-5">
              <i
                className="bi bi-search text-muted mb-2 d-block"
                style={{ fontSize: '2rem' }}
              ></i>
              <h6 className="fw-bold text-dark mb-1" style={{ fontSize: '0.85rem' }}>
                Layanan tidak ditemukan
              </h6>
              <p className="text-muted small mb-2" style={{ fontSize: '0.72rem' }}>
                Coba gunakan kata kunci lain atau pilih Semua kategori.
              </p>
              <button
                type="button"
                className="btn btn-sm btn-outline-primary rounded-pill px-3 py-1"
                style={{ fontSize: '0.72rem' }}
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('ALL');
                }}
              >
                Reset Filter
              </button>
            </div>
          )}
        </div>

        {/* Footer Modal: Tombol Selesai */}
        <div className="d-flex justify-content-between align-items-center px-3 py-2 border-top bg-light flex-shrink-0">
          <small className="text-muted" style={{ fontSize: '0.72rem' }}>
            Klik <b>Pilih</b> untuk memasukkan ke keranjang kasir
          </small>
          <button
            type="button"
            className="btn btn-primary btn-sm rounded-pill px-3 py-1 fw-bold shadow-xs"
            style={{ fontSize: '0.78rem' }}
            onClick={onClose}
          >
            <i className="bi bi-check-lg me-1"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductPickerModal;
