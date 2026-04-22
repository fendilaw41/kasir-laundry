import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useNavigate } from 'react-router-dom';

const Cari = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  const searchResults = useLiveQuery(async () => {
    if (searchTerm.length < 2) return [];

    const allOrders = await db.orders.toArray();
    return allOrders.filter(order =>
      order.pelangganNama?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.invoiceId?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  return (
    <div className="search-order-page">
      <h5 className="fw-bold mb-3">Cari Order</h5>

      <div className="search-form-wrapper mb-4">
        <div className="input-group shadow-sm rounded overflow-hidden">
          <span className="input-group-text bg-white border-0"><i className="bi bi-search text-muted"></i></span>
          <input
            className="form-control border-0 py-3"
            type="text"
            placeholder="Ketik Nama Pelanggan atau ID Invoice..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {searchTerm.length > 0 && searchTerm.length < 2 && <small className="text-muted mt-2 d-block text-center">Ketik minimal 2 karakter...</small>}
      </div>

      <div className="results">
        {searchResults?.map(order => (
          <div key={order.id} className="card shadow-sm border-0 mb-2" onClick={() => navigate(`/order/${order.id}`)} style={{ cursor: 'pointer' }}>
            <div className="card-body p-3 d-flex justify-content-between align-items-center">
              <div>
                <h6 className="mb-0 fw-bold">{order.pelangganNama}</h6>
                <small className="text-primary fw-bold">{order.invoiceId}/{order.id}</small>
              </div>
              <div className="text-end">
                <span className="badge bg-primary-light text-primary mb-1 d-block" style={{ backgroundColor: '#e1f5fe' }}>Rp {order.total.toLocaleString()}</span>
                <small className="text-muted" style={{ fontSize: '0.65rem' }}>{new Date(order.createdAt).toLocaleDateString()}</small>
              </div>
            </div>
          </div>
        ))}

        {searchTerm.length >= 2 && searchResults?.length === 0 && (
          <div className="text-center py-5">
            <i className="bi bi-search text-muted fs-1"></i>
            <p className="mt-2 text-muted">Order tidak ditemukan</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Cari;
