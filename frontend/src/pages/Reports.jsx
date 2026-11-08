import { useLiveQuery } from 'dexie-react-hooks';
import { getOrdersSortedByDateQuery } from '../db/repositories/orders';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { pullOrdersFromBackend } from '../services/syncService';
import { isStatusLunas } from '../utils/paymentStatus';
import { useState, useEffect, useMemo } from 'react';
import { Skeleton, TransactionListSkeleton } from '../components/common/Skeleton';

const isSameDay = (dateA, dateB) => {
  if (!dateA || !dateB) return false;
  const a = new Date(dateA);
  const b = new Date(dateB);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};

export const getAllowedMonths = (role) => {
  const isRoleKasir = role?.toLowerCase() === 'kasir';
  // Role kasir hanya boleh lihat data sebulan terakhir (1 bulan)
  // Role owner maksimal 3 bulan terakhir (3 bulan)
  const count = isRoleKasir ? 1 : 3;
  const months = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const value = `${year}-${month}`;
    const label = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    months.push({
      value,
      label: i === 0 ? `${label} (Bulan Ini)` : label,
    });
  }
  return months;
};

const Reports = ({ user }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const isTodayOnly = searchParams.get('today') === 'true';

  const currentUserRole = (
    user?.role ||
    (() => {
      try {
        return JSON.parse(
          sessionStorage.getItem('user') ||
          (typeof localStorage !== 'undefined' ? localStorage.getItem('user') : null) ||
          '{}'
        )?.role;
      } catch {
        return null;
      }
    })() ||
    'kasir'
  ).toLowerCase();

  const isOwner = currentUserRole === 'owner';
  const isKasir = currentUserRole === 'kasir';

  const allowedMonths = useMemo(() => getAllowedMonths(currentUserRole), [currentUserRole]);
  const allowedMonthValues = useMemo(() => allowedMonths.map(m => m.value), [allowedMonths]);

  const [searchTerm, setSearchTerm] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [filterMonth, setFilterMonth] = useState('All');
  const [filterBayar, setFilterBayar] = useState('Semua');
  const [showBalance, setShowBalance] = useState(false);

  useEffect(() => {
    if (filterMonth !== 'All' && !allowedMonthValues.includes(filterMonth)) {
      setFilterMonth('All');
    }
  }, [filterMonth, allowedMonthValues]);

  useEffect(() => {
    if (navigator.onLine) {
      pullOrdersFromBackend(true).catch(err => console.warn('[Reports] Auto pull error:', err));
    }
  }, []);

  // Query Data
  const data = useLiveQuery(async () => {
    const allOrders = await getOrdersSortedByDateQuery();
    const now = new Date();

    // Batas waktu: role kasir hanya boleh lihat data sebulan terakhir saja (30 hari)
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    oneMonthAgo.setHours(0, 0, 0, 0);

    // Batas waktu: role owner maksimal 3 bulan terakhir (awal bulan ke-3 terakhir)
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);

    return allOrders.filter(order => {
      const orderDate = new Date(order.createdAt);
      if (isNaN(orderDate.getTime())) return false;

      // 1. Role kasir hanya boleh lihat data sebulan terakhir saja
      if (isKasir) {
        if (orderDate < oneMonthAgo) {
          return false;
        }
      } else {
        // Owner hanya boleh lihat data maksimal 3 bulan terakhir saja
        if (orderDate < threeMonthsAgo) {
          return false;
        }
      }

      // 2. Filter Search
      const matchesSearch = !searchTerm ||
        order.pelangganNama?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.invoiceId?.toLowerCase().includes(searchTerm.toLowerCase());

      // 3. Filter Tanggal / Periode
      let matchesDate = false;
      if (isTodayOnly) {
        matchesDate = isSameDay(order.createdAt, now);
      } else {
        const orderMonthStr = orderDate.toISOString().substring(0, 7);
        if (filterMonth === 'All') {
          matchesDate = true;
        } else {
          matchesDate = allowedMonthValues.includes(filterMonth) && orderMonthStr === filterMonth;
        }
      }

      // 4. Filter Status Bayar
      const matchesStatus = filterBayar === 'Semua' || (filterBayar === 'Lunas' ? isStatusLunas(order.statusBayar) : !isStatusLunas(order.statusBayar));

      return matchesSearch && matchesDate && matchesStatus;
    });
  }, [searchTerm, isTodayOnly, filterMonth, filterBayar, isKasir, allowedMonthValues]);

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

    const headers = ['Tanggal', 'Invoice', 'Pelanggan', 'Layanan', 'Total', 'Status Bayar', 'Metode Bayar'];
    const rows = data.map(o => [
      new Date(o.createdAt).toLocaleString('id-ID'),
      o.invoiceId,
      o.pelangganNama || 'Umum',
      o.tipeLayanan,
      o.total,
      o.statusBayar,
      o.metodeBayar || '-'
    ]);

    let content = headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const downloadSuffix = isTodayOnly ? 'today' : filterMonth === 'All' ? (isKasir ? '1-bulan' : '3-bulan') : filterMonth;
    link.setAttribute('download', `report-${downloadSuffix}.csv`);
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
                <small className="opacity-75 d-block mb-1">Total Omzet {isTodayOnly ? 'Hari Ini' : 'Periode Ini'}</small>
                {data === undefined ? (
                  <div className="py-1">
                    <Skeleton
                      width="180px"
                      height="32px"
                      borderRadius="8px"
                      style={{
                        background: 'linear-gradient(90deg, rgba(255,255,255,0.18) 25%, rgba(255,255,255,0.38) 37%, rgba(255,255,255,0.18) 63%)',
                        backgroundSize: '200% 100%'
                      }}
                    />
                  </div>
                ) : (
                  <h2 className="text-white fw-bold mb-0">
                    {showBalance ? `Rp ${(data?.reduce((acc, o) => acc + (Number(o?.total) || 0), 0) || 0).toLocaleString('id-ID')}` : 'Rp ••••••••'}
                  </h2>
                )}
              </div>
              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-white bg-white bg-opacity-25 border-0 text-white rounded-circle shadow-none d-flex align-items-center justify-content-center"
                  style={{ width: '36px', height: '36px' }}
                  onClick={() => setShowBalance(!showBalance)}
                  title={showBalance ? 'Sembunyikan nominal' : 'Tampilkan nominal'}
                >
                  <i className={`bi ${showBalance ? 'bi-eye-slash-fill' : 'bi-eye-fill'} fs-5`}></i>
                </button>
              </div>
            </div>

            {showBalance && (
              <div className="d-flex gap-3 pt-2 border-top border-white border-opacity-25">
                <div className="flex-fill">
                  <small className="opacity-75 d-block" style={{ fontSize: '0.65rem' }}>TOTAL DISKON</small>
                  {data === undefined ? (
                    <Skeleton
                      width="80px"
                      height="16px"
                      borderRadius="4px"
                      className="mt-1"
                      style={{
                        background: 'linear-gradient(90deg, rgba(255,255,255,0.18) 25%, rgba(255,255,255,0.38) 37%, rgba(255,255,255,0.18) 63%)',
                        backgroundSize: '200% 100%'
                      }}
                    />
                  ) : (
                    <span className="fw-bold" style={{ fontSize: '0.9rem' }}>
                      Rp {(data?.reduce((acc, o) => acc + (Number(o?.diskon) || 0), 0) || 0).toLocaleString('id-ID')}
                    </span>
                  )}
                </div>
                <div className="flex-fill border-start ps-3 border-white border-opacity-25">
                  <small className="opacity-75 d-block" style={{ fontSize: '0.65rem' }}>JUMLAH ORDER</small>
                  {data === undefined ? (
                    <Skeleton
                      width="75px"
                      height="16px"
                      borderRadius="4px"
                      className="mt-1"
                      style={{
                        background: 'linear-gradient(90deg, rgba(255,255,255,0.18) 25%, rgba(255,255,255,0.38) 37%, rgba(255,255,255,0.18) 63%)',
                        backgroundSize: '200% 100%'
                      }}
                    />
                  ) : (
                    <span className="fw-bold" style={{ fontSize: '0.9rem' }}>{data?.length || 0} transaksi</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Periode Switcher Pills */}
        <div className="d-flex align-items-center justify-content-between mb-3 px-1">
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className={`btn btn-sm rounded-pill px-3 py-1 fw-semibold transition-all shadow-xs ${
                isTodayOnly ? 'btn-primary text-white shadow-sm' : 'btn-light bg-white text-muted border'
              }`}
              style={{ fontSize: '0.78rem' }}
              onClick={() => {
                setSearchParams({ today: 'true' });
                setShowFilter(false);
              }}
            >
              <i className="bi bi-calendar-check me-1"></i>
              Hari Ini
            </button>
            <button
              type="button"
              className={`btn btn-sm rounded-pill px-3 py-1 fw-semibold transition-all shadow-xs ${
                !isTodayOnly ? 'btn-primary text-white shadow-sm' : 'btn-light bg-white text-muted border'
              }`}
              style={{ fontSize: '0.78rem' }}
              onClick={() => setSearchParams({})}
            >
              <i className="bi bi-calendar3 me-1"></i>
              Semua Periode
            </button>
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
            <i
              className="bi bi-sliders text-primary ms-3"
              style={{ cursor: 'pointer' }}
              title="Filter Bulan & Periode"
              aria-label="Filter Bulan & Periode"
              onClick={() => setShowFilter(!showFilter)}
            ></i>
          )}
          <i className="bi bi-download text-primary ms-3" style={{ cursor: 'pointer' }} onClick={() => handleDownload()} title="Download CSV"></i>
        </div>

        {/* Minimal Status Tabs */}
        <div className="mb-4">
          <div className="d-flex border-bottom" style={{ borderColor: '#eee !important' }}>
            {['Semua', 'Lunas', 'Belum'].map((status) => (
              <div
                key={status}
                className={`pb-2 px-3 fw-bold text-uppercase cursor-pointer ${filterBayar === status ? 'text-primary border-bottom border-2 border-primary' : 'text-muted'}`}
                onClick={() => setFilterBayar(status)}
                style={{
                  fontSize: '0.75rem',
                  letterSpacing: '0.5px',
                  cursor: 'pointer',
                  marginBottom: '-1px',
                  transition: 'all 0.2s'
                }}
              >
                {status === 'Belum' ? 'BELUM' : status}
              </div>
            ))}
          </div>
        </div>

        {showFilter && !isTodayOnly && (
          <div className="mb-4 p-3 bg-white rounded shadow-sm border-0" style={{ borderRadius: '15px' }}>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <label className="small fw-bold text-muted mb-0">FILTER BULAN</label>
              <span className="badge bg-light text-secondary border-0" style={{ fontSize: '0.7rem' }}>
                {isKasir ? 'Maksimal 1 Bulan Terakhir' : 'Maksimal 3 Bulan Terakhir'}
              </span>
            </div>
            <div className="d-flex gap-2 align-items-center">
              <select
                className="form-select border-light shadow-none fw-medium"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                style={{ borderRadius: '10px' }}
                aria-label="Pilih Bulan"
              >
                <option value="All">
                  {isKasir ? 'Semua (1 Bulan Terakhir)' : 'Semua (3 Bulan Terakhir)'}
                </option>
                {allowedMonths.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={`btn btn-sm px-3 py-2 fw-semibold ${filterMonth === 'All' ? 'btn-primary text-white' : 'btn-outline-primary'}`}
                style={{ borderRadius: '10px', whiteSpace: 'nowrap' }}
                onClick={() => setFilterMonth('All')}
              >
                Semua
              </button>
            </div>
          </div>
        )}

        {/* Transaction List */}
        <div className="d-flex justify-content-between align-items-center mb-3 px-1">
          <h6 className="fw-bold mb-0">Riwayat Transaksi</h6>
          <span className="badge bg-primary-light text-primary rounded-pill px-3 py-2" style={{ fontSize: '0.7rem', backgroundColor: '#eef2ff' }}>
            {data === undefined ? <Skeleton width="45px" height="12px" /> : `${data?.length || 0} Data`}
          </span>
        </div>
        {data === undefined ? (
          <TransactionListSkeleton count={4} />
        ) : groupedData && Object.keys(groupedData).length > 0 ? (
          Object.entries(groupedData).map(([month, dates]) => (
            <div key={month} className="month-group mb-4">
              <div className="text-muted small fw-bold mb-2 px-1 text-uppercase" style={{ letterSpacing: '1px' }}>{month}</div>
              {Object.entries(dates).map(([date, orders]) => (
                <div key={date} className="date-group mb-2">
                  {orders.map(order => (
                    <div
                      key={order.id}
                      className="card border-0 shadow-sm mb-3 position-relative"
                      style={{ borderRadius: '20px', overflow: 'hidden' }}
                      onClick={() => navigate(`/order/${order.id}`)}
                    >
                      {/* Label Pojok Kiri */}
                      <div
                        className={`position-absolute top-0 start-0 px-3 py-1 fw-bold text-white shadow-sm ${isStatusLunas(order.statusBayar) ? 'bg-success' : 'bg-warning text-dark'}`}
                        style={{ borderBottomRightRadius: '15px', fontSize: '0.6rem', zIndex: 1, letterSpacing: '0.5px' }}
                      >
                        {order.statusBayar?.toUpperCase() || 'BELUM BAYAR'}
                      </div>

                      <div className="card-body p-3 pt-4">
                        <div className="d-flex align-items-center mb-2 mt-1">
                          <div className={`rounded-circle d-flex align-items-center justify-content-center me-3`}
                            style={{
                              width: '45px',
                              height: '45px',
                              flexShrink: 0,
                              backgroundColor: order.status === 'Selesai' ? '#d1f7e0' : order.status === 'Ambil' ? '#e9ecef' : '#e0e7ff',
                              color: order.status === 'Selesai' ? '#198754' : order.status === 'Ambil' ? '#212529' : '#0d6efd'
                            }}
                          >
                            <i className={`bi ${order.status === 'Selesai' ? 'bi-check-lg' : order.status === 'Ambil' ? 'bi-box-seam' : 'bi-gear-wide-connected'} fs-4`}></i>
                          </div>
                          <div className="flex-grow-1 min-width-0">
                            <div className="fw-bold text-dark mb-0 text-truncate" style={{ fontSize: '1rem', lineHeight: '1.2' }}>{order.pelangganNama || 'Umum'}</div>
                            <div className="d-flex align-items-center gap-2 mt-1">
                              <span className="fw-medium text-primary small">{order.invoiceId}</span>
                            </div>
                          </div>
                          <div className="ms-auto text-end ps-2">
                            <div className="fw-bold text-primary" style={{ fontSize: '1.1rem', whiteSpace: 'nowrap' }}>Rp {order.total.toLocaleString()}</div>
                          </div>
                        </div>

                        <div className="d-flex justify-content-between align-items-center pt-2 border-top border-light mt-2">
                          <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                            <i className="bi bi-calendar3 me-1"></i> {new Date(order.createdAt).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })} • {new Date(order.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div>
                            <span className="badge rounded-pill bg-light text-primary border-0 px-2 py-1 me-1 mb-1" style={{ fontSize: '0.65rem', fontWeight: '600' }}>
                              <i className="bi bi-tag-fill me-1"></i> {order.tipeLayanan}
                            </span>
                            {order.metodeBayar && (
                              <span className="badge rounded-pill bg-light text-success border-0 px-2 py-1 mb-1" style={{ fontSize: '0.65rem', fontWeight: '600' }}>
                                <i className="bi bi-wallet2 me-1"></i> {order.metodeBayar}
                              </span>
                            )}
                          </div>
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
