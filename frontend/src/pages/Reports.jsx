import { useLiveQuery } from 'dexie-react-hooks';
import { getOrdersSortedByDateQuery } from '../db/repositories/orders';
import { getCashEntriesQuery } from '../db/repositories/cashEntries';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { pullOrdersFromBackend } from '../services/syncService';
import { isStatusLunas } from '../utils/paymentStatus';
import { useState, useEffect, useMemo } from 'react';
import { Skeleton, TransactionListSkeleton } from '../components/common/Skeleton';
import BukuKas from './BukuKas';

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

// Bulan lokal "YYYY-MM" (toISOString memakai UTC sehingga order dini hari WIB tanggal 1 bisa salah bulan)
const ymLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const ymdLocal = (d) => `${ymLocal(d)}-${String(d.getDate()).padStart(2, '0')}`;

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

/* Gaya halaman Laporan (prefix .rp-) */
const RP_CSS = `
.rp-wrap { padding: 22px 12px 100px; max-width: 680px; margin: 0 auto; }
.rp-views { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; padding: 3px; margin-bottom: 10px; background: #fff; border: 1px solid #e8ebfa; border-radius: 14px; }
.rp-view { height: 34px; border: 0; border-radius: 11px; background: transparent; color: #8480ae; font-size: .78rem; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; }
.rp-view.on { background: #0d5afd; color: #fff; box-shadow: 0 6px 12px -6px rgba(13, 90, 253, .7); }
.rp-hero { position: relative; overflow: hidden; border-radius: 20px; padding: 16px 16px 14px; color: #fff; margin-bottom: 10px; background: linear-gradient(135deg, #0d5afd 0%, #0134d4 100%); box-shadow: 0 18px 30px -18px rgba(13, 90, 253, .8); }
.rp-hero::after { content: ''; position: absolute; right: -40px; top: -50px; width: 150px; height: 150px; border-radius: 50%; background: rgba(255, 255, 255, .1); }
.rp-hero small { display: block; font-size: .7rem; font-weight: 600; opacity: .85; }
.rp-hero .big { display: block; font-size: 1.7rem; font-weight: 700; letter-spacing: -.5px; line-height: 1.25; }
.rp-eye { position: absolute; right: 14px; top: 12px; z-index: 2; width: 34px; height: 34px; border: 0; border-radius: 50%; background: rgba(255, 255, 255, .25); color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 1.05rem; }
.rp-stats { display: grid; gap: 8px; margin-top: 12px; position: relative; z-index: 1; }
.rp-stats div { background: rgba(255, 255, 255, .16); border-radius: 13px; padding: 8px 10px; min-width: 0; }
.rp-stats span { display: block; font-size: .62rem; font-weight: 600; opacity: .9; letter-spacing: .03em; text-transform: uppercase; }
.rp-stats b { display: block; font-size: .88rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rp-bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.rp-pills { display: flex; gap: 6px; }
.rp-pill { height: 32px; padding: 0 13px; border-radius: 999px; border: 1px solid #e1e6fa; background: #fff; color: #5f5a86; font-size: .74rem; font-weight: 600; display: inline-flex; align-items: center; gap: 5px; cursor: pointer; }
.rp-pill.on { background: #1f0757; border-color: #1f0757; color: #fff; }
.rp-ico { display: flex; gap: 6px; }
.rp-sq { width: 32px; height: 32px; border-radius: 50%; border: 1px solid #e1e6fa; background: #fff; color: #0d5afd; display: inline-flex; align-items: center; justify-content: center; font-size: .85rem; cursor: pointer; }
.rp-sq.on { background: #e5edff; border-color: #0d5afd; }
.rp-search { position: relative; margin-bottom: 8px; }
.rp-search i.s { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: .8rem; color: #8480ae; pointer-events: none; }
.rp-search input { width: 100%; height: 38px; padding: 0 30px 0 34px; border: 1px solid #e1e6fa; border-radius: 12px; background: #fff; font-size: .78rem; color: #1f0757; outline: none; }
.rp-search input:focus { border-color: #0d5afd; box-shadow: 0 0 0 3px rgba(13, 90, 253, .12); }
.rp-search button { position: absolute; right: 4px; top: 50%; transform: translateY(-50%); width: 28px; height: 28px; border: 0; background: none; color: #a3a9c9; font-size: .7rem; }
.rp-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; padding: 3px; margin-bottom: 10px; background: #fff; border: 1px solid #e8ebfa; border-radius: 13px; }
.rp-tab { height: 30px; border: 0; border-radius: 10px; background: transparent; color: #8480ae; font-size: .68rem; font-weight: 700; letter-spacing: .03em; text-transform: uppercase; cursor: pointer; }
.rp-tab.on { background: #0d5afd; color: #fff; box-shadow: 0 6px 12px -6px rgba(13, 90, 253, .7); }
.rp-act { display: flex; margin: -2px 0 8px; }
.rp-ach { display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 5px 0 10px; border-radius: 999px; background: #e8efff; color: #0134d4; font-size: .68rem; font-weight: 600; border: 0; }
.rp-ach i { width: 16px; height: 16px; border-radius: 50%; background: rgba(13, 90, 253, .15); display: inline-flex; align-items: center; justify-content: center; font-size: .55rem; }
.rp-lh { display: flex; align-items: center; justify-content: space-between; margin: 4px 2px 8px; }
.rp-lh h6 { margin: 0; font-size: .9rem; font-weight: 700; color: #1f0757; }
.rp-cnt { font-size: .68rem; font-weight: 700; color: #0d5afd; background: #eef2ff; border-radius: 999px; padding: 4px 11px; }
.rp-month { margin: 12px 4px 2px; font-size: .68rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #8480ae; }
.rp-dh { display: flex; align-items: center; justify-content: space-between; padding: 6px 4px 5px; font-size: .72rem; color: #5f5a86; }
.rp-dh b { color: #1f0757; }
.rp-card { background: #fff; border: 1px solid #e8ebfa; border-radius: 16px; overflow: hidden; margin-bottom: 4px; }
.rp-row { display: block; width: 100%; padding: 9px 12px 10px; border: 0; background: none; text-align: left; cursor: pointer; }
.rp-row + .rp-row { border-top: 1px solid #f0f2fc; }
.rp-r1 { display: flex; align-items: center; gap: 10px; }
.rp-ic { width: 36px; height: 36px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; font-size: 1rem; flex: none; }
.rp-ic.proses { background: #e5edff; color: #0d5afd; }
.rp-ic.selesai { background: #d9f6e6; color: #0e8f55; }
.rp-ic.ambil { background: #eceff5; color: #3b4256; }
.rp-ic.batal { background: #fee8e9; color: #e5484d; }
.rp-mid { flex: 1; min-width: 0; }
.rp-name { display: block; font-size: .86rem; font-weight: 700; color: #1f0757; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rp-inv { display: block; font-size: .68rem; color: #0d5afd; font-weight: 600; }
.rp-total { font-size: .95rem; font-weight: 800; color: #0d5afd; white-space: nowrap; flex: none; }
.rp-r2 { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 6px; padding-left: 46px; }
.rp-meta { display: flex; align-items: center; gap: 5px; min-width: 0; font-size: .64rem; color: #8480ae; white-space: nowrap; overflow: hidden; }
.rp-meta i { font-size: .62rem; }
.rp-tag { padding: 1px 7px; border-radius: 999px; background: #f1f2fb; color: #5f5a86; font-weight: 600; }
.rp-pay { flex: none; height: 20px; padding: 0 8px; border-radius: 999px; font-size: .62rem; font-weight: 700; display: inline-flex; align-items: center; }
.rp-pay.ok { background: #d9f6e6; color: #0e8f55; }
.rp-pay.wait { background: #fff1cf; color: #a76a00; }
.rp-empty { text-align: center; padding: 38px 16px; background: #fff; border: 1px solid #e8ebfa; border-radius: 16px; color: #8480ae; }
.rp-empty i { display: block; font-size: 1.9rem; color: #0d5afd; opacity: .45; margin-bottom: 4px; }
.rp-empty p { margin: 0; font-size: .8rem; }
.rp-more { display: flex; gap: 6px; margin: 8px 0 4px; }
.rp-mbtn { flex: 1; height: 34px; border-radius: 12px; border: 1px dashed #b9c8fe; background: #f5f8ff; color: #0d5afd; font-size: .72rem; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; }
.rp-mbtn.sub { flex: 0 0 auto; padding: 0 12px; border-style: solid; border-color: #e1e6fa; background: #fff; color: #8480ae; }
.rp-dock { position: fixed; left: 50%; bottom: 0; transform: translateX(-50%); width: 100%; max-width: 540px; padding: 0 8px; z-index: 1055; pointer-events: none; animation: rp-rise .25s cubic-bezier(.16, 1, .3, 1); }
.rp-panel { pointer-events: auto; background: #fff; border: 1px solid #e8ebfa; border-radius: 22px 22px 0 0; max-height: 90vh; overflow-y: auto; padding: 10px 14px 14px; box-shadow: 0 -10px 35px rgba(0, 0, 0, .18); }
.rp-grab { width: 36px; height: 4px; border-radius: 10px; background: #cbd5e1; margin: 0 auto 8px; }
.rp-ph { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.rp-ph b { font-size: .9rem; color: #1f0757; }
.rp-ph em { font-style: normal; font-size: .64rem; font-weight: 600; color: #8480ae; background: #f1f2fb; border-radius: 999px; padding: 3px 9px; margin-left: 8px; }
.rp-circ { width: 30px; height: 30px; border-radius: 50%; border: 0; background: #f1f2fb; color: #8480ae; display: inline-flex; align-items: center; justify-content: center; font-size: .8rem; }
.rp-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.rp-chip { height: 34px; padding: 0 13px; border-radius: 999px; border: 1px solid #e1e6fa; background: #fff; color: #1f0757; font-size: .74rem; font-weight: 600; cursor: pointer; }
.rp-chip.on { background: #0d5afd; border-color: #0d5afd; color: #fff; }
.rp-cta { width: 100%; height: 42px; margin-top: 14px; border: 0; border-radius: 12px; background: #0134d4; color: #fff; font-size: .88rem; font-weight: 700; }
@keyframes rp-rise { from { opacity: 0; transform: translate(-50%, 16px); } to { opacity: 1; transform: translate(-50%, 0); } }
`;

const csvCell = (v) => {
  const t = String(v ?? '');
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

const Reports = ({ user }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const isTodayOnly = searchParams.get('today') === 'true';
  const view = searchParams.get('view') === 'kas' ? 'kas' : 'jual';
  const setView = (v) => {
    const next = new URLSearchParams(searchParams);
    if (v === 'kas') next.set('view', 'kas');
    else next.delete('view');
    setSearchParams(next, { replace: true });
  };

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
  const REPORTS_PAGE_SIZE = 20;
  const [visibleCount, setVisibleCount] = useState(REPORTS_PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(REPORTS_PAGE_SIZE);
  }, [searchTerm, isTodayOnly, filterMonth, filterBayar]);

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

  // Pengeluaran manual (Buku Kas) pada periode yang sama, hanya untuk owner
  const cashEntries = useLiveQuery(getCashEntriesQuery, []);

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
        const orderMonthStr = ymLocal(orderDate);
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

  const pengeluaran = useMemo(() => {
    if (!isOwner || !cashEntries) return null;
    const today = ymdLocal(new Date());
    const oldest = `${allowedMonthValues[allowedMonthValues.length - 1]}-01`;
    return cashEntries
      .filter((e) => e.type === 'OUT')
      .filter((e) => {
        const d = e.date || ymdLocal(new Date(e.createdAt));
        if (isTodayOnly) return d === today;
        if (filterMonth === 'All') return d >= oldest;
        return d.startsWith(filterMonth);
      })
      .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  }, [cashEntries, isOwner, isTodayOnly, filterMonth, allowedMonthValues]);

  const visibleData = useMemo(() => {
    if (!data) return undefined;
    return data.slice(0, visibleCount);
  }, [data, visibleCount]);

  const remainingReportsCount = data ? Math.max(0, data.length - visibleCount) : 0;

  // Grouping bulan -> tanggal (dibatasi sesuai visibleData agar render ringan)
  const groupedData = visibleData?.reduce((acc, order) => {
    const date = new Date(order.createdAt);
    const month = date.toLocaleString('id-ID', { month: 'long' });
    const dateKey = date.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
    if (!acc[month]) acc[month] = {};
    if (!acc[month][dateKey]) acc[month][dateKey] = [];
    acc[month][dateKey].push(order);
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

    let content = headers.join(',') + '\n' + rows.map(r => r.map(csvCell).join(',')).join('\n');
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

  const rp = (n) => (showBalance ? `Rp ${Number(n || 0).toLocaleString('id-ID')}` : 'Rp ••••••');
  const totalOmzet = data ? data.reduce((acc, o) => acc + (Number(o?.total) || 0), 0) : 0;
  const totalDiskon = data ? data.reduce((acc, o) => acc + (Number(o?.diskon) || 0), 0) : 0;
  const activeMonthLabel = allowedMonths.find((m) => m.value === filterMonth)?.label?.replace(' (Bulan Ini)', '');
  const statIsThree = isOwner && pengeluaran !== null;

  const statusIcon = (status) => {
    if (status === 'Selesai') return { cls: 'selesai', icon: 'bi-check-lg' };
    if (status === 'Ambil') return { cls: 'ambil', icon: 'bi-box-seam' };
    if (status === 'Dibatalkan') return { cls: 'batal', icon: 'bi-x-lg' };
    return { cls: 'proses', icon: 'bi-gear-wide-connected' };
  };

  return (
    <div className="reports-page rp-wrap">
      <style>{RP_CSS}</style>

      {/* Pilih tampilan: Penjualan (omzet per order) atau Kas (uang masuk & keluar) */}
      <div className="rp-views" role="tablist">
        <button type="button" role="tab" aria-selected={view === 'jual'} className={`rp-view ${view === 'jual' ? 'on' : ''}`} onClick={() => setView('jual')}>
          <i className="bi bi-receipt"></i> Penjualan
        </button>
        <button type="button" role="tab" aria-selected={view === 'kas'} className={`rp-view ${view === 'kas' ? 'on' : ''}`} onClick={() => setView('kas')}>
          <i className="bi bi-wallet2"></i> Kas
        </button>
      </div>

      {view === 'kas' ? (
        <BukuKas user={user} embedded hidden={!showBalance} onToggleHidden={() => setShowBalance((v) => !v)} />
      ) : (
        <>
          {/* Kartu omzet */}
          <div className="rp-hero">
            <button
              type="button"
              className="rp-eye"
              onClick={() => setShowBalance(!showBalance)}
              title={showBalance ? 'Sembunyikan nominal' : 'Tampilkan nominal'}
              aria-label={showBalance ? 'Sembunyikan nominal' : 'Tampilkan nominal'}
            >
              <i className={`bi ${showBalance ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`}></i>
            </button>
            <small>Total Omzet {isTodayOnly ? 'Hari Ini' : (activeMonthLabel || 'Periode Ini')}</small>
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
              <span className="big">{rp(totalOmzet)}</span>
            )}

            {showBalance && data !== undefined && (
              <div className="rp-stats" style={{ gridTemplateColumns: `repeat(${statIsThree ? 3 : 2}, 1fr)` }}>
                <div><span>Order</span><b>{data.length} transaksi</b></div>
                <div><span>Diskon</span><b>Rp {totalDiskon.toLocaleString('id-ID')}</b></div>
                {statIsThree && <div><span>Pengeluaran</span><b>Rp {pengeluaran.toLocaleString('id-ID')}</b></div>}
              </div>
            )}
          </div>

          {/* Periode + aksi */}
          <div className="rp-bar">
            <div className="rp-pills">
              <button
                type="button"
                className={`rp-pill ${isTodayOnly ? 'on' : ''}`}
                onClick={() => {
                  setSearchParams({ today: 'true' });
                  setShowFilter(false);
                }}
              >
                <i className="bi bi-calendar-check"></i> Hari ini
              </button>
              <button
                type="button"
                className={`rp-pill ${!isTodayOnly ? 'on' : ''}`}
                onClick={() => setSearchParams({})}
              >
                <i className="bi bi-calendar3"></i> Semua periode
              </button>
            </div>
            <div className="rp-ico">
              {!isTodayOnly && (
                <button
                  type="button"
                  className={`rp-sq ${filterMonth !== 'All' ? 'on' : ''}`}
                  onClick={() => setShowFilter(true)}
                  title="Filter Bulan & Periode"
                  aria-label="Filter Bulan & Periode"
                >
                  <i className="bi bi-sliders"></i>
                </button>
              )}
              <button type="button" className="rp-sq" onClick={handleDownload} title="Download CSV" aria-label="Download CSV">
                <i className="bi bi-download"></i>
              </button>
            </div>
          </div>

          {/* Cari */}
          <div className="rp-search">
            <i className="bi bi-search s"></i>
            <input
              type="search"
              placeholder="Cari nama / no. order"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Cari transaksi"
            />
            {searchTerm && (
              <button type="button" onClick={() => setSearchTerm('')} aria-label="Hapus pencarian"><i className="bi bi-x-lg"></i></button>
            )}
          </div>

          {/* Status bayar */}
          <div className="rp-tabs" role="tablist">
            {['Semua', 'Lunas', 'Belum'].map((status) => (
              <button
                key={status}
                type="button"
                role="tab"
                aria-selected={filterBayar === status}
                className={`rp-tab ${filterBayar === status ? 'on' : ''}`}
                onClick={() => setFilterBayar(status)}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Filter aktif */}
          {!isTodayOnly && filterMonth !== 'All' && (
            <div className="rp-act">
              <button type="button" className="rp-ach" onClick={() => setFilterMonth('All')}>
                {activeMonthLabel}
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
          )}

          {/* Riwayat */}
          <div className="rp-lh">
            <h6>Riwayat Transaksi</h6>
            <span className="rp-cnt">
              {data === undefined ? <Skeleton width="45px" height="12px" /> : `${data.length} Data`}
            </span>
          </div>

          {data === undefined ? (
            <TransactionListSkeleton count={4} />
          ) : groupedData && Object.keys(groupedData).length > 0 ? (
            Object.entries(groupedData).map(([month, dates]) => (
              <div key={month}>
                <div className="rp-month">{month}</div>
                {Object.entries(dates).map(([date, orders]) => (
                  <div key={date}>
                    <div className="rp-dh">
                      <b>{date}</b>
                      <span>{orders.length} order · {rp(orders.reduce((a, o) => a + (Number(o.total) || 0), 0))}</span>
                    </div>
                    <div className="rp-card">
                      {orders.map((order) => {
                        const st = statusIcon(order.status);
                        const lunas = isStatusLunas(order.statusBayar);
                        return (
                          <button key={order.id} type="button" className="rp-row" onClick={() => navigate(`/order/${order.id}`)}>
                            <div className="rp-r1">
                              <span className={`rp-ic ${st.cls}`}><i className={`bi ${st.icon}`}></i></span>
                              <span className="rp-mid">
                                <span className="rp-name">{order.pelangganNama || 'Umum'}</span>
                                <span className="rp-inv">{order.invoiceId}</span>
                              </span>
                              <span className="rp-total">Rp {(Number(order.total) || 0).toLocaleString('id-ID')}</span>
                            </div>
                            <div className="rp-r2">
                              <span className="rp-meta">
                                <i className="bi bi-clock"></i>
                                {new Date(order.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                {order.tipeLayanan && <span className="rp-tag">{order.tipeLayanan}</span>}
                                {order.metodeBayar && <span className="rp-tag">{order.metodeBayar}</span>}
                              </span>
                              <span className={`rp-pay ${lunas ? 'ok' : 'wait'}`}>{lunas ? 'Lunas' : (String(order.statusBayar || '').toLowerCase() === 'dp' ? 'DP' : 'Belum bayar')}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))
          ) : (
            <div className="rp-empty">
              <i className="bi bi-receipt-cutoff"></i>
              <p>Tidak ada transaksi ditemukan</p>
            </div>
          )}

          {/* Show More / Ringkas */}
          {data && data.length > REPORTS_PAGE_SIZE && (
            <div className="rp-more">
              {remainingReportsCount > 0 && (
                <button type="button" className="rp-mbtn" onClick={() => setVisibleCount((prev) => prev + REPORTS_PAGE_SIZE)}>
                  <i className="bi bi-chevron-down"></i>
                  <span>{remainingReportsCount} transaksi lagi</span>
                </button>
              )}
              {visibleCount > REPORTS_PAGE_SIZE && (
                <button type="button" className="rp-mbtn sub" onClick={() => setVisibleCount(REPORTS_PAGE_SIZE)}>
                  <i className="bi bi-chevron-up"></i>
                  <span>Ringkas</span>
                </button>
              )}
            </div>
          )}

          {/* Panel filter bulan (gaya sama dengan floating Bayar / Catat Kas) */}
          {showFilter && !isTodayOnly && (
            <div className="rp-dock">
              <div className="rp-panel" role="dialog">
                <div className="rp-grab"></div>
                <div className="rp-ph">
                  <span><b>Filter Bulan</b><em>{isKasir ? 'Maksimal 1 Bulan Terakhir' : 'Maksimal 3 Bulan Terakhir'}</em></span>
                  <button type="button" className="rp-circ" onClick={() => setShowFilter(false)} aria-label="Tutup"><i className="bi bi-x-lg"></i></button>
                </div>
                <div className="rp-chips" aria-label="Pilih Bulan">
                  <button type="button" className={`rp-chip ${filterMonth === 'All' ? 'on' : ''}`} onClick={() => setFilterMonth('All')}>
                    {isKasir ? 'Semua (1 Bulan Terakhir)' : 'Semua (3 Bulan Terakhir)'}
                  </button>
                  {allowedMonths.map((m) => (
                    <button key={m.value} type="button" className={`rp-chip ${filterMonth === m.value ? 'on' : ''}`} onClick={() => setFilterMonth(m.value)}>
                      {m.label}
                    </button>
                  ))}
                </div>
                <button type="button" className="rp-cta" onClick={() => setShowFilter(false)}>
                  Lihat {data ? data.length : 0} transaksi
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Reports;