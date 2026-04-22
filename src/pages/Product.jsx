import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useState } from 'react';

const Product = () => {
  const products = useLiveQuery(() => db.products.toArray());
  const [searchTerm, setSearchTerm] = useState('');

  const addToCart = async (product) => {
    const existing = await db.cart.where('productId').equals(product.id).first();
    if (existing) {
      await db.cart.update(existing.id, { quantity: existing.quantity + 1 });
    } else {
      await db.cart.add({ productId: product.id, quantity: 1, name: product.name, price: product.price });
    }
    alert(`${product.name} ditambahkan`);
  };

  const filteredProducts = products?.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="product-page pb-5">

      <div className="search-form-wrapper mb-3">
        <div className="form-group mb-0">
          <input className="form-control" type="text" placeholder="Cari layanan..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      <div className="row g-2">
        {filteredProducts?.map(product => (
          <div className="col-6" key={product.id}>
            <div className="card product-card shadow-sm border-0 h-100">
              <div className="card-body p-3 text-center">
                <div className="bg-light rounded p-2 mb-2">
                  <i className="bi bi-tag text-primary fs-3"></i>
                </div>
                <h6 className="product-title small fw-bold mb-1">{product.name}</h6>
                <p className="sale-price small text-primary fw-bold mb-2">Rp {product.price.toLocaleString()}</p>
                <button className="btn btn-xs btn-primary w-100" onClick={() => addToCart(product)} style={{ fontSize: '0.7rem' }}>
                  <i className="bi bi-plus-lg me-1"></i> TAMBAH
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
