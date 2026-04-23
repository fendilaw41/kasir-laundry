import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useState } from 'react';
import toast from 'react-hot-toast';

const Product = () => {
  const products = useLiveQuery(() => db.products.toArray());
  const [searchTerm, setSearchTerm] = useState('');

  // State untuk menyimpan jumlah qty sementara per produk
  const [quantities, setQuantities] = useState({});

  const updateQty = (id, delta) => {
    setQuantities(prev => ({
      ...prev,
      [id]: Math.max(1, (prev[id] || 1) + delta)
    }));
  };

  const addToCart = async (product) => {
    const qty = quantities[product.id] || 1;
    const existing = await db.cart.where('productId').equals(product.id).first();

    if (existing) {
      await db.cart.update(existing.id, { quantity: existing.quantity + qty });
    } else {
      await db.cart.add({
        productId: product.id,
        quantity: qty,
        name: `${product.category} - ${product.name}`,
        price: product.price
      });
    }

    toast.success(`${qty}x ${product.name} ditambahkan`, {
      position: 'bottom-center',
      style: { borderRadius: '12px', background: '#333', color: '#fff', fontSize: '14px' }
    });

    // Reset qty setelah tambah
    setQuantities(prev => ({ ...prev, [product.id]: 1 }));
  };

  const filteredProducts = products?.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="product-page pb-5" style={{ backgroundColor: '#f8faff', minHeight: '100vh' }}>
      {/* Search Header */}
      <div className="search-wrapper mb-4 p-3 bg-white shadow-sm sticky-top">
        <h5 className="fw-bold mb-3 text-primary">Layanan Laundry</h5>
        <div className="position-relative">
          <i className="bi bi-search position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"></i>
          <input
            className="form-control ps-5 py-2 rounded-pill border-light bg-light"
            type="text"
            placeholder="Cari layanan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="row g-3 px-3">
        {filteredProducts?.map(product => (
          <div className="col-6" key={product.id}>
            <div className="card h-100 border-0 shadow-sm rounded-4 overflow-hidden bg-white">
              {/* Product Image/Icon Area */}
              <div className="p-3 bg-light m-2 rounded-4 text-center position-relative" style={{ height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="badge bg-warning position-absolute top-0 end-0 m-2" style={{ fontSize: '0.6rem' }}>{product.category}</span>
                <i className={`bi ${product.category.includes('SETRIKA') ? 'bi-fire' : 'bi-water'} text-primary opacity-25`} style={{ fontSize: '3.5rem' }}></i>
              </div>

              <div className="card-body p-3 pt-0">
                {/* Product Info */}
                <h6 className="fw-bold mb-1 text-dark text-truncate" style={{ fontSize: '0.9rem' }}>{product.name.split(' (')[0]}</h6>
                <div className="d-flex align-items-baseline gap-2 mb-3">
                  <span className="fw-bold text-primary" style={{ fontSize: '1rem' }}>
                    Rp {product.price.toLocaleString()}
                  </span>
                  <span className="text-danger text-decoration-line-through opacity-50" style={{ fontSize: '0.7rem' }}>
                    Rp {(product.price + 5000).toLocaleString()}
                  </span>
                </div>

                {/* Quantity Selector */}
                <div className="d-flex align-items-center justify-content-between bg-light rounded-pill p-1 mb-2">
                  <button
                    className="btn btn-sm btn-white rounded-circle shadow-sm border-0 d-flex align-items-center justify-content-center"
                    style={{ width: '28px', height: '28px', backgroundColor: '#fff' }}
                    onClick={() => updateQty(product.id, -1)}
                  >
                    <i className="bi bi-dash text-primary"></i>
                  </button>
                  <span className="fw-bold" style={{ fontSize: '0.9rem' }}>{quantities[product.id] || 1}</span>
                  <button
                    className="btn btn-sm btn-white rounded-circle shadow-sm border-0 d-flex align-items-center justify-content-center"
                    style={{ width: '28px', height: '28px', backgroundColor: '#fff' }}
                    onClick={() => updateQty(product.id, 1)}
                  >
                    <i className="bi bi-plus text-primary"></i>
                  </button>
                </div>

                {/* Add to Cart Button */}
                <button
                  className="btn btn-outline-primary btn-sm w-100 rounded-pill fw-bold py-2 d-flex align-items-center justify-content-center gap-2"
                  onClick={() => addToCart(product)}
                >
                  <i className="bi bi-cart-plus"></i>
                  <span>Add</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Product;
