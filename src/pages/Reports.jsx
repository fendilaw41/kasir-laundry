import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';

const Reports = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isTodayOnly = searchParams.get('today') === 'true';

  const [searchTerm, setSearchTerm] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().substring(0, 7));
  const [showBalance, setShowBalance] = useState(false);

  // Query Data
  const data = useLiveQuery(async () => {
    let collection = db.orders.orderBy('createdAt').reverse();
    const allOrders = await collection.toArray();

    const today = new Date().toLocaleDateString('id-ID');

    return allOrders.filter(order => {
      const orderDate = new Date(order.createdAt);
      const orderDateStr = orderDate.toLocaleDateString('id-ID');
      const orderMonthStr = orderDate.toISOString().substring(0, 7);

      const matchesSearch = order.pelangganNama?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.invoiceId?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesDate = isTodayOnly ? orderDateStr === today : (filterMonth === 'All' || orderMonthStr === filterMonth);

      return matchesSearch && matchesDate;
    });
  }, [searchTerm, isTodayOnly, filterMonth]);

  // Grouping by Date for BCA style
  const groupedData = data?.reduce((acc, order) => {
    const date = new Date(order.createdAt);
    const day = date.getDate();
    const month = date.toLocaleString('id-ID', { month: 'short' });
    const year = date.getFullYear();
    const dateKey = `${day} ${month} ${year}`;
    const monthKey = date.toLocaleString('id-ID', { month: 'long' });

    if (!acc[monthKey]) acc[monthKey] = {};
    if (!acc[monthKey][dateKey]) acc[monthKey][dateKey] = [];

    acc[monthKey][dateKey].push(order);
    return acc;
  }, {});

  const handleDownload = () => {
    if (!data || data.length === 0) return alert('Tidak ada data untuk didownload');

    const headers = ['Tanggal', 'Invoice', 'Pelanggan', 'Layanan', 'Total', 'Status Bayar'];
    const rows = data.map(o => [
      new Date(o.createdAt).toLocaleString('id-ID'),
      o.invoiceId,
      o.pelangganNama || 'Umum',
      o.tipeLayanan,
      o.total,
      o.statusBayar
    ]);

    let content = headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `report-${isTodayOnly ? 'today' : filterMonth}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="reports-page pb-5" style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>

      <div className="px-3 pt-3">
        {/* Main Stats Card (Laundry Theme Style) */}
        <div className="card shadow-sm border-0 mb-4 overflow-hidden" style={{ borderRadius: '20px', background: 'linear-gradient(135deg, #0134d4 0%, #2855e1 100%)' }}>
          <div className="card-body p-4 text-white">
            <div className="d-flex justify-content-between align-items-start mb-3">
              <div>
                <small className="opacity-75 d-block mb-1">Total Omzet {isTodayOnly ? 'Hari Ini' : ''}</small>
                <h2 className="text-white fw-bold mb-0">
                  {showBalance ? `Rp ${data?.reduce((acc, o) => acc + o.total, 0).toLocaleString()}` : 'Rp ••••••••'}
                </h2>
              </div>
              <button 
                className="btn btn-sm btn-white bg-white bg-opacity-25 border-0 text-white rounded-circle shadow-none"
                onClick={() => setShowBalance(!showBalance)}
              >
                <i className={`bi ${showBalance ? 'bi-eye-slash-fill' : 'bi-eye-fill'} fs-5`}></i>
              </button>
            </div>
            
            {showBalance && (
              <div className="d-flex gap-3 pt-2 border-top border-white border-opacity-25">
                <div className="flex-fill">
                  <small className="opacity-75 d-block" style={{ fontSize: '0.65rem' }}>TOTAL DISKON</small>
                  <span className="fw-bold" style={{ fontSize: '0.9rem' }}>
                    Rp {data?.reduce((acc, o) => acc + (o.diskon || 0), 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex-fill border-start ps-3 border-white border-opacity-25">
                  <small className="opacity-75 d-block" style={{ fontSize: '0.65rem' }}>JUMLAH ORDER</small>
                  <span className="fw-bold" style={{ fontSize: '0.9rem' }}>{data?.length || 0} Trx</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="input-group input-group-sm bg-white border-0 shadow-sm rounded-pill px-3 align-items-center mb-4" style={{ height: '45px' }}>
          <i className="bi bi-search text-muted me-2"></i>
          <input
            type="text"
            className="form-control border-0 bg-transparent"
            placeholder="Cari transaksi..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {!isTodayOnly && (
            <i className="bi bi-sliders text-primary ms-3" style={{ cursor: 'pointer' }} onClick={() => setShowFilter(!showFilter)}></i>
          )}
          <i className="bi bi-download text-primary ms-3" style={{ cursor: 'pointer' }} onClick={() => handleDownload()}></i>
        </div>

        {showFilter && !isTodayOnly && (
          <div className="mb-4 p-3 bg-white rounded shadow-sm border-0" style={{ borderRadius: '15px' }}>
            <label className="small fw-bold text-muted mb-2">FILTER BULAN</label>
            <div className="d-flex gap-2">
              <input
                type="month"
                className="form-control border-light shadow-none"
                value={filterMonth === 'All' ? '' : filterMonth}
                onChange={(e) => setFilterMonth(e.target.value || 'All')}
              />
              <button className="btn btn-primary px-3" onClick={() => setFilterMonth('All')}>Semua</button>
            </div>
          </div>
        )}

        {/* Transaction List */}
        <h6 className="fw-bold mb-3 px-1">Riwayat Transaksi</h6>
        {groupedData && Object.keys(groupedData).length > 0 ? (
          Object.entries(groupedData).map(([month, dates]) => (
            <div key={month} className="month-group mb-4">
              <div className="text-muted small fw-bold mb-2 px-1 text-uppercase" style={{ letterSpacing: '1px' }}>{month}</div>
              {Object.entries(dates).map(([date, orders]) => (
                <div key={date} className="date-group mb-2">
                  {orders.map(order => (
                    <div
                      key={order.id}
                      className="card border-0 shadow-sm mb-3"
                      style={{ borderRadius: '20px', overflow: 'hidden' }}
                      onClick={() => navigate(`/order/${order.id}`)}
                    >
                      <div className="card-body p-3">
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <div className="d-flex align-items-center">
                            <div className={`rounded-circle d-flex align-items-center justify-content-center me-3 ${order.statusBayar === 'Lunas' ? 'bg-success-light text-success' : 'bg-warning-light text-warning'}`} style={{ width: '45px', height: '45px', flexShrink: 0 }}>
                              <i className={`bi ${order.statusBayar === 'Lunas' ? 'bi-check-lg' : 'bi-clock'} fs-4`}></i>
                            </div>
                            <div>
                              <div className="fw-bold text-dark mb-0" style={{ fontSize: '1rem', lineHeight: '1.2' }}>{order.pelangganNama || 'Umum'}</div>
                              <div className="text-muted small mt-1">
                                <span className="fw-medium text-primary">{order.invoiceId}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-end">
                            <div className="fw-bold text-primary" style={{ fontSize: '1.1rem' }}>Rp {order.total.toLocaleString()}</div>
                          </div>
                        </div>
                        
                        <div className="d-flex justify-content-between align-items-center pt-2 border-top border-light mt-2">
                          <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                            <i className="bi bi-calendar3 me-1"></i> {new Date(order.createdAt).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })} • {new Date(order.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <span className="badge rounded-pill bg-light text-primary border-0 px-3 py-2" style={{ fontSize: '0.65rem', fontWeight: '600' }}>
                            <i className="bi bi-tag-fill me-1"></i> {order.tipeLayanan}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))
        ) : (
          <div className="text-center py-5">
            <div className="bg-white d-inline-flex rounded-circle p-4 shadow-sm mb-3">
              <i className="bi bi-receipt-cutoff text-muted" style={{ fontSize: '2rem' }}></i>
            </div>
            <p className="text-muted">Tidak ada transaksi ditemukan</p>
          </div>
        )}
      </div>

      <style>{`
        .bg-success-light { background-color: #d1f7e0; }
        .bg-warning-light { background-color: #fff9c4; }
        .bg-primary-light { background-color: #e1f5fe; }
        .text-success { color: #00a854; }
        .text-warning { color: #fbc02d; }
        .text-primary { color: #2855e1; }
      `}</style>
    </div>
  );
};

export default Reports;
