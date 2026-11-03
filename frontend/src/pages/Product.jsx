import { useLiveQuery } from 'dexie-react-hooks';
import { getProductsQuery } from '../db/repositories/products';
import { addProductToCart } from '../db/repositories/cart';
import { useState, useMemo } from 'react';
import toast from 'react-hot-toast';

const Product = () => {
  const products = useLiveQuery(getProductsQuery);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // State untuk menyimpan jumlah qty sementara per produk
  const [quantities, setQuantities] = useState({});

  // Ambil daftar kategori unik dari data produk
  const categories = useMemo(() => {
    if (!products) return [];
    return Array.from(new Set(products.map((p) => p.category).filter(Boolean)));
  }, [products]);

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

      toast.success(`${qty}x ${product.name} ditambahkan`, {
        position: 'top-center',
        style: { borderRadius: '12px', background: '#1e293b', color: '#fff', fontSize: '13px' },
      });

      // Reset qty setelah tambah
      setQuantities((prev) => ({ ...prev, [product.id]: 1 }));
    } catch (err) {
      toast.error('Gagal menambahkan ke keranjang', err);
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

  return (
    <div className="product-page pb-5" style={{ backgroundColor: '#f8faff', minHeight: '100vh' }}>
      {/* Search & Category Header - Menyatu & Modern Shopee / Tokopedia Style */}
      <div
        className="sticky-top bg-white border-bottom shadow-xs px-3 pt-2 pb-2 mx-n3 mt-n3 mb-3"
        style={{ zIndex: 10 }}
      >
        {/* Search Input Bar */}
        <div className="position-relative">
          <i className="bi bi-search position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"></i>
          <input
            className="form-control rounded-pill ps-5 pe-5 py-2 border-0 bg-light shadow-none"
            type="text"
            placeholder="Cari nama layanan, kategori, atau kode..."
            style={{ fontSize: '0.85rem' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              type="button"
              className="btn btn-sm btn-link position-absolute top-50 end-0 translate-middle-y me-2 p-0 text-muted"
              onClick={() => setSearchTerm('')}
            >
              <i className="bi bi-x-circle-fill fs-6"></i>
            </button>
          )}
        </div>

        {/* Category Horizontal Filter Chips (Shopee / Tokped Style) */}
        {categories.length > 0 && (
          <div
            className="d-flex gap-2 overflow-x-auto pb-1 mt-2 no-scrollbar"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <style>{`
              .no-scrollbar::-webkit-scrollbar { display: none; }
            `}</style>
            <button
              type="button"
              className={`btn btn-sm rounded-pill px-3 py-1 fw-semibold flex-shrink-0 transition-all ${selectedCategory === 'ALL'
                ? 'btn-primary shadow-xs'
                : 'btn-outline-light bg-light text-secondary border-0'
                }`}
              style={{ fontSize: '0.75rem' }}
              onClick={() => setSelectedCategory('ALL')}
            >
              Semua
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`btn btn-sm rounded-pill px-3 py-1 fw-semibold flex-shrink-0 transition-all ${selectedCategory === cat
                  ? 'btn-primary shadow-xs'
                  : 'btn-outline-light bg-light text-secondary border-0'
                  }`}
                style={{ fontSize: '0.75rem' }}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid Produk Layanan */}
      {filteredProducts && filteredProducts.length > 0 ? (
        <div className="row g-2 g-sm-3 px-1">
          {filteredProducts.map((product) => {
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
                    {/* Category Pill (Shopee Official Badge Style) */}
                    <span
                      className="badge position-absolute top-0 start-0 m-2 rounded-pill px-2 py-1 shadow-xs fw-bold"
                      style={{
                        fontSize: '0.62rem',
                        backgroundColor: isSetrikaOnly ? '#ea580c' : isSetrika ? '#4f46e5' : '#16a34a',
                        color: '#fff',
                        letterSpacing: '0.2px',
                      }}
                    >
                      {product.category}
                    </span>

                    {/* Product Code Badge */}
                    {product.code && (
                      <span
                        className="badge bg-white text-dark border position-absolute top-0 end-0 m-2 rounded-pill px-2 py-1 shadow-xs fw-bold"
                        style={{ fontSize: '0.62rem' }}
                      >
                        {product.code}
                      </span>
                    )}

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
        </div>
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
