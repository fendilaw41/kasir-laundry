import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useState } from 'react';
import toast from 'react-hot-toast';

const Product = () => {
  const products = useLiveQuery(() => db.products.toArray());
  const [searchTerm, setSearchTerm] = useState('');

  const addToCart = async (product) => {
    const existing = await db.cart.where('productId').equals(product.id).first();
    if (existing) {
      await db.cart.update(existing.id, { quantity: existing.quantity + 1 });
    } else {
      await db.cart.add({ productId: product.id, quantity: 1, name: `${product.category} - ${product.name}`, price: product.price });
    }
    toast.success(`${product.name} ditambahkan`, {
      position: 'bottom-center',
      style: { borderRadius: '12px', background: '#333', color: '#fff', fontSize: '14px' }
    });
  };

  const filteredProducts = products?.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="product-page pb-5">
      {/* Search Header */}
      <div className="search-wrapper mb-4">
        <h5 className="fw-bold mb-3 px-1">Layanan Laundry</h5>
        <div className="position-relative">
          <i className="bi bi-search position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"></i>
          <input
            className="form-control ps-5 py-3 rounded-4 border-0 shadow-sm"
            type="text"
            placeholder="Cari layanan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="row g-3 px-1">
        {filteredProducts?.map(product => (
          <div className="col-6" key={product.id}>
            <div className="card h-100 border-0 shadow-sm rounded-4 overflow-hidden position-relative scale-on-click" onClick={() => addToCart(product)} style={{ cursor: 'pointer' }}>
              <div className="card-body p-3">
                {/* Category Badge */}
                <div className="mb-2">
                  <span className="badge rounded-pill bg-primary-light text-primary fw-bold" style={{ fontSize: '0.55rem', backgroundColor: '#e3f2fd' }}>
                    {product.category}
                  </span>
                </div>

                {/* Icon Laundry */}
                <div className="text-center mb-2 text-primary opacity-50">
                  <i className={`bi ${product.category.includes('SETRIKA') ? 'bi-fire' : 'bi-water'} fs-2`}></i>
                </div>

                {/* Product Info */}
                <div className="text-center">
                  <h6 className="fw-bold mb-1" style={{ fontSize: '0.85rem' }}>{product.name.split(' (')[0]}</h6>
                  <p className="text-muted mb-3" style={{ fontSize: '0.7rem' }}>{product.name.split(' (')[1]?.replace(')', '') || ''}</p>

                  <div className="border-0 rounded-3 py-2 px-1">
                    <span className="fw-bold text-primary" style={{ fontSize: '0.9rem' }}>
                      Rp {product.price.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .scale-on-click:active {
          transform: scale(0.96);
          transition: transform 0.1s ease;
        }
      `}</style>
    </div>
  );
};

export default Product;
