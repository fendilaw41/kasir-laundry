import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { getInventoryEventsQuery, getInventoryQuery } from '../db/repositories/inventory';

export default function PergerakanStok({ user }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'in' | 'out'
  const [selectedItem, setSelectedItem] = useState('ALL');
  const [filterDate, setFilterDate] = useState(''); // '' (Semua) | 'YYYY-MM-DD'
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDetails, setExpandedDetails] = useState({});

  const toggleDetail = (key) => {
    setExpandedDetails((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const rawEvents = useLiveQuery(getInventoryEventsQuery, []);
  const inventoryList = useLiveQuery(getInventoryQuery, []);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const yesterdayStr = useMemo(() => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    return y.toISOString().split('T')[0];
  }, []);

  // Format jam helper (misal: 14:25 WIB)
  const formatTimeOnly = (dateVal) => {
    if (!dateVal) return '';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(/\./g, ':') + ' WIB';
  };

  // Map inventoryId ke nama barang jika di event belum ada inventoryName
  const inventoryMap = useMemo(() => {
    const map = {};
    if (inventoryList) {
      inventoryList.forEach((item) => {
        if (item.id) map[item.id] = item.nama;
        if (item.uuid) map[item.uuid] = item.nama;
      });
    }
    return map;
  }, [inventoryList]);

  // Daftar nama unik barang untuk filter dropdown
  const uniqueItemNames = useMemo(() => {
    const names = new Set();
    if (inventoryList) {
      inventoryList.forEach((i) => i.nama && names.add(i.nama));
    }
    if (rawEvents) {
      rawEvents.forEach((e) => {
        const name = e.inventoryName || inventoryMap[e.inventoryId];
        if (name) names.add(name);
      });
    }
    return Array.from(names).sort();
  }, [inventoryList, rawEvents, inventoryMap]);

  // Filter events berdasarkan Tab, Tanggal, Item, dan Search Query
  const filteredEvents = useMemo(() => {
    if (!rawEvents) return [];

    return rawEvents.filter((event) => {
      // 1. Filter Tab
      if (activeTab === 'in' && event.type !== 'ADD') return false;
      if (activeTab === 'out' && event.type !== 'SUBTRACT') return false;

      // 2. Filter Tanggal
      if (filterDate) {
        const d = event.createdAt ? new Date(event.createdAt) : null;
        if (d && !isNaN(d.getTime())) {
          const key = d.toISOString().split('T')[0];
          if (key !== filterDate) return false;
        }
      }

      const itemName = (event.inventoryName || inventoryMap[event.inventoryId] || '').toLowerCase();

      // 3. Filter Item Dropdown
      if (selectedItem !== 'ALL') {
        if (itemName !== selectedItem.toLowerCase()) return false;
      }

      // 4. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const note = (event.note || '').toLowerCase();
        const invoice = (event.invoiceId || '').toLowerCase();
        const creator = (event.createdBy || '').toLowerCase();
        if (!itemName.includes(q) && !note.includes(q) && !invoice.includes(q) && !creator.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [rawEvents, activeTab, filterDate, selectedItem, searchQuery, inventoryMap]);

  // Hitung akumulasi total Stock In dan Stock Out dari semua event toko
  const totals = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    let inCount = 0;
    let outCount = 0;
    if (rawEvents) {
      rawEvents.forEach((e) => {
        const qty = Number(e.qty) || 0;
        if (e.type === 'ADD') {
          totalIn += qty;
          inCount += 1;
        } else if (e.type === 'SUBTRACT') {
          totalOut += qty;
          outCount += 1;
        }
      });
    }
    return { totalIn, totalOut, inCount, outCount };
  }, [rawEvents]);

  // Grouping data event berdasarkan tanggal (YYYY-MM-DD) dan ringkas per item
  const groupedEvents = useMemo(() => {
    const groups = {};

    filteredEvents.forEach((event) => {
      const d = event.createdAt ? new Date(event.createdAt) : new Date();
      // Format key: YYYY-MM-DD
      const dateKey = !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : 'UNKNOWN';

      if (!groups[dateKey]) {
        groups[dateKey] = {
          dateObj: !isNaN(d.getTime()) ? d : new Date(),
          events: [],
          totalIn: 0,
          totalOut: 0,
          inCount: 0,
          outCount: 0,
        };
      }

      groups[dateKey].events.push(event);
      const qty = Number(event.qty) || 0;
      if (event.type === 'ADD') {
        groups[dateKey].totalIn += qty;
        groups[dateKey].inCount += 1;
      } else {
        groups[dateKey].totalOut += qty;
        groups[dateKey].outCount += 1;
      }
    });

    // Urutkan grup tanggal dari yang paling baru
    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map((key) => {
        const group = groups[key];

        // Ringkasan per item pada tanggal ini:
        const outByItem = {};
        const inByItem = {};

        group.events.forEach((event) => {
          const itemName = event.inventoryName || inventoryMap[event.inventoryId] || 'Barang Laundry';
          const qty = Number(event.qty) || 0;
          const timeStr = formatTimeOnly(event.createdAt);

          if (event.type === 'SUBTRACT') {
            if (!outByItem[itemName]) {
              outByItem[itemName] = {
                key: `${key}-out-${itemName}`,
                itemName,
                type: 'SUBTRACT',
                totalQty: 0,
                useCount: 0,
                invoices: [],
                lastTime: timeStr,
                items: [],
              };
            }
            outByItem[itemName].totalQty += qty;
            outByItem[itemName].useCount += 1;
            if (timeStr) outByItem[itemName].lastTime = timeStr;
            if (event.invoiceId && !outByItem[itemName].invoices.includes(event.invoiceId)) {
              outByItem[itemName].invoices.push(event.invoiceId);
            }
            outByItem[itemName].items.push({
              qty,
              invoiceId: event.invoiceId,
              timeStr: timeStr || 'Hari ini',
              note: event.note,
            });
          } else {
            // Event ADD (Stock In)
            if (!inByItem[itemName]) {
              inByItem[itemName] = {
                key: `${key}-in-${itemName}`,
                itemName,
                type: 'ADD',
                totalQty: 0,
                addCount: 0,
                lastTime: timeStr,
                items: [],
              };
            }
            inByItem[itemName].totalQty += qty;
            inByItem[itemName].addCount += 1;
            if (timeStr) inByItem[itemName].lastTime = timeStr;
            inByItem[itemName].items.push({
              qty,
              timeStr: timeStr || 'Hari ini',
              note: event.note,
            });
          }
        });

        const outList = Object.values(outByItem);
        const inList = Object.values(inByItem);

        let activeSummaries = [];
        if (activeTab === 'in') {
          activeSummaries = inList;
        } else if (activeTab === 'out') {
          activeSummaries = outList;
        } else {
          activeSummaries = [...inList, ...outList];
        }

        return {
          dateKey: key,
          dateObj: group.dateObj,
          totalIn: group.totalIn,
          totalOut: group.totalOut,
          inCount: group.inCount,
          outCount: group.outCount,
          summaries: activeSummaries,
        };
      });
  }, [filteredEvents, activeTab, inventoryMap]);

  // Format label tanggal ramah pengguna
  const formatDateHeading = (dateObj) => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const isToday =
      dateObj.getDate() === today.getDate() &&
      dateObj.getMonth() === today.getMonth() &&
      dateObj.getFullYear() === today.getFullYear();

    const isYesterday =
      dateObj.getDate() === yesterday.getDate() &&
      dateObj.getMonth() === yesterday.getMonth() &&
      dateObj.getFullYear() === yesterday.getFullYear();

    const formattedDate = dateObj.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    if (isToday) return `Hari Ini • ${formattedDate}`;
    if (isYesterday) return `Kemarin • ${formattedDate}`;
    return formattedDate;
  };

  return (
    <div style={{ backgroundColor: '#f4f7fc', minHeight: '100vh', paddingBottom: '80px' }}>
      <div className="container px-3 pt-3" style={{ maxWidth: '680px' }}>
        
        {/* SUMMARY CARDS (BIRU & PUTIH THEME) */}
        <div className="row g-2.5 mb-3">
          {/* Card Stock In */}
          <div className="col-6">
            <div
              className="card border-0 rounded-4 shadow-sm p-3 h-100 position-relative overflow-hidden"
              style={{
                backgroundColor: '#ffffff',
                borderLeft: '4px solid #10b981',
              }}
            >
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-muted fw-semibold small" style={{ fontSize: '0.75rem' }}>
                  Stok Masuk (In)
                </span>
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center text-success"
                  style={{ width: '32px', height: '32px', backgroundColor: '#ecfdf5' }}
                >
                  <i className="bi bi-box-arrow-in-down fs-5"></i>
                </div>
              </div>
              <h4 className="fw-bold text-success mb-0">+{totals.totalIn.toLocaleString()}</h4>
              <small className="text-muted" style={{ fontSize: '0.7rem' }}>
                {totals.inCount}x Penambahan
              </small>
            </div>
          </div>

          {/* Card Stock Out */}
          <div className="col-6">
            <div
              className="card border-0 rounded-4 shadow-sm p-3 h-100 position-relative overflow-hidden"
              style={{
                backgroundColor: '#ffffff',
                borderLeft: '4px solid #0d5afd',
              }}
            >
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-muted fw-semibold small" style={{ fontSize: '0.75rem' }}>
                  Stok Keluar (Out)
                </span>
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center text-primary"
                  style={{ width: '32px', height: '32px', backgroundColor: '#eff6ff' }}
                >
                  <i className="bi bi-box-arrow-up fs-5"></i>
                </div>
              </div>
              <h4 className="fw-bold text-primary mb-0">{totals.outCount}x Digunakan</h4>
              <small className="text-muted" style={{ fontSize: '0.7rem' }}>
                Total -{totals.totalOut.toLocaleString()} Item
              </small>
            </div>
          </div>
        </div>

        {/* TABS (SEMUA / STOCK IN / STOCK OUT) */}
        <div className="card border-0 shadow-sm rounded-4 mb-3 bg-white p-1.5">
          <div className="d-flex gap-1">
            <button
              type="button"
              className={`btn flex-fill rounded-pill py-2 border-0 fw-bold transition-all ${
                activeTab === 'all'
                  ? 'btn-primary shadow-xs'
                  : 'btn-light text-muted bg-transparent'
              }`}
              style={{ fontSize: '0.78rem' }}
              onClick={() => setActiveTab('all')}
            >
              Semua
            </button>
            <button
              type="button"
              className={`btn flex-fill rounded-pill py-2 border-0 fw-bold transition-all ${
                activeTab === 'in'
                  ? 'btn-success text-white shadow-xs'
                  : 'btn-light text-muted bg-transparent'
              }`}
              style={{ fontSize: '0.78rem' }}
              onClick={() => setActiveTab('in')}
            >
              <i className="bi bi-arrow-down-left me-1"></i>
              Stock In
            </button>
            <button
              type="button"
              className={`btn flex-fill rounded-pill py-2 border-0 fw-bold transition-all ${
                activeTab === 'out'
                  ? 'btn-primary shadow-xs'
                  : 'btn-light text-muted bg-transparent'
              }`}
              style={{ fontSize: '0.78rem' }}
              onClick={() => setActiveTab('out')}
            >
              <i className="bi bi-arrow-up-right me-1"></i>
              Stock Out
            </button>
          </div>
        </div>

        {/* FILTER BAR (TANGGAL, ITEM BARANG, PENCARIAN) */}
        <div className="card border-0 shadow-sm rounded-4 mb-3 bg-white p-3">
          {/* Baris 1: Filter Tanggal */}
          <div className="mb-2 pb-2 border-bottom">
            <div className="d-flex align-items-center justify-content-between mb-1.5">
              <label className="form-label small fw-bold text-muted mb-0" style={{ fontSize: '0.7rem' }}>
                <i className="bi bi-calendar3 me-1 text-primary"></i>Filter Tanggal:
              </label>
              {filterDate && (
                <button
                  type="button"
                  className="btn btn-sm btn-link p-0 text-decoration-none text-primary fw-semibold"
                  style={{ fontSize: '0.7rem' }}
                  onClick={() => setFilterDate('')}
                >
                  Tampilkan Semua Tanggal
                </button>
              )}
            </div>
            <div className="d-flex align-items-center gap-1.5 flex-wrap">
              <button
                type="button"
                className={`btn btn-sm rounded-pill px-3 py-1 fw-semibold transition-all ${!filterDate ? 'btn-primary text-white shadow-xs' : 'btn-light text-muted'}`}
                style={{ fontSize: '0.72rem' }}
                onClick={() => setFilterDate('')}
              >
                Semua
              </button>
              <button
                type="button"
                className={`btn btn-sm rounded-pill px-3 py-1 fw-semibold transition-all ${filterDate === todayStr ? 'btn-primary text-white shadow-xs' : 'btn-light text-muted'}`}
                style={{ fontSize: '0.72rem' }}
                onClick={() => setFilterDate(todayStr)}
              >
                Hari Ini
              </button>
              <button
                type="button"
                className={`btn btn-sm rounded-pill px-3 py-1 fw-semibold transition-all ${filterDate === yesterdayStr ? 'btn-primary text-white shadow-xs' : 'btn-light text-muted'}`}
                style={{ fontSize: '0.72rem' }}
                onClick={() => setFilterDate(yesterdayStr)}
              >
                Kemarin
              </button>
              <input
                type="date"
                className="form-control form-control-sm border-0 bg-light rounded-pill px-2.5 py-1 text-dark fw-medium"
                style={{ fontSize: '0.72rem', flex: 1, minWidth: '130px' }}
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
            </div>
          </div>

          {/* Baris 2: Filter Item Barang & Pencarian */}
          <div className="row g-2">
            <div className="col-6">
              <label className="form-label small fw-bold text-muted mb-1" style={{ fontSize: '0.68rem' }}>
                Filter Item Barang:
              </label>
              <select
                className="form-select form-select-sm rounded-3 border-0 bg-light fw-medium"
                style={{ fontSize: '0.78rem', padding: '7px 10px' }}
                value={selectedItem}
                onChange={(e) => setSelectedItem(e.target.value)}
              >
                <option value="ALL">Semua Barang ({uniqueItemNames.length})</option>
                {uniqueItemNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6">
              <label className="form-label small fw-bold text-muted mb-1" style={{ fontSize: '0.68rem' }}>
                Cari Nota / Item:
              </label>
              <div className="position-relative">
                <input
                  type="text"
                  className="form-control form-control-sm rounded-3 border-0 bg-light"
                  style={{ fontSize: '0.78rem', padding: '7px 10px', paddingRight: '28px' }}
                  placeholder="Ketik nota..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="btn btn-sm btn-link text-muted position-absolute top-50 end-0 translate-middle-y text-decoration-none p-1 pe-2"
                    onClick={() => setSearchQuery('')}
                  >
                    <i className="bi bi-x-circle-fill" style={{ fontSize: '0.75rem' }}></i>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* DAFTAR MUTASI DENGAN GROUPING TANGGAL & SUMMARY ITEM BERSIH */}
        {groupedEvents.length === 0 ? (
          <div className="card border-0 shadow-sm rounded-4 p-5 text-center bg-white my-3">
            <div
              className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3"
              style={{ width: '60px', height: '60px', backgroundColor: '#eff6ff', color: '#0d5afd' }}
            >
              <i className="bi bi-inbox fs-2"></i>
            </div>
            <h6 className="fw-bold text-dark mb-1">Belum Ada Riwayat Pergerakan</h6>
            <p className="text-muted small mb-0 px-2" style={{ fontSize: '0.75rem' }}>
              Tidak ada data pergerakan stok untuk filter yang dipilih.
            </p>
          </div>
        ) : (
          groupedEvents.map((group) => {
            if (group.summaries.length === 0) return null;

            return (
              <div key={group.dateKey} className="mb-3">
                {/* TANGGAL GROUP HEADER */}
                <div className="d-flex align-items-center justify-content-between mb-2 px-1">
                  <div className="d-flex align-items-center gap-1.5">
                    <i className="bi bi-calendar3 text-primary" style={{ fontSize: '0.82rem' }}></i>
                    <span className="fw-bold text-dark" style={{ fontSize: '0.82rem' }}>
                      {formatDateHeading(group.dateObj)}
                    </span>
                  </div>
                  <div className="d-flex align-items-center gap-1">
                    {group.totalIn > 0 && (
                      <span
                        className="badge rounded-pill fw-semibold"
                        style={{ backgroundColor: '#ecfdf5', color: '#059669', fontSize: '0.65rem' }}
                      >
                        +{group.totalIn} In ({group.inCount}x)
                      </span>
                    )}
                    {group.totalOut > 0 && (
                      <span
                        className="badge rounded-pill fw-semibold"
                        style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', fontSize: '0.65rem' }}
                      >
                        -{group.totalOut} Out ({group.outCount}x)
                      </span>
                    )}
                  </div>
                </div>

                {/* LIST RINGKASAN ITEM PER TANGGAL (BERSIH, RAPI, TANPA TEKS BERLEBIHAN) */}
                <div className="d-flex flex-column gap-2">
                  {group.summaries.map((summary) => {
                    const isAdd = summary.type === 'ADD';
                    const isExpanded = Boolean(expandedDetails[summary.key]);

                    return (
                      <div
                        key={summary.key}
                        className="card border-0 rounded-4 shadow-sm bg-white overflow-hidden"
                        style={{
                          borderLeft: isAdd ? '4px solid #10b981' : '4px solid #0d5afd',
                          transition: 'box-shadow 0.15s ease',
                        }}
                      >
                        <div className="card-body p-3">
                          <div className="d-flex align-items-center justify-content-between gap-2">
                            <div className="d-flex align-items-center gap-2.5">
                              {/* ICON BULAT */}
                              <div
                                className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                                style={{
                                  width: '38px',
                                  height: '38px',
                                  backgroundColor: isAdd ? '#ecfdf5' : '#eff6ff',
                                  color: isAdd ? '#059669' : '#0d5afd',
                                }}
                              >
                                <i className={`bi ${isAdd ? 'bi-box-arrow-in-down' : 'bi-box-arrow-up'} fs-5`}></i>
                              </div>

                              {/* NAMA BARANG, BADGE & JAM */}
                              <div>
                                <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                                  <h6 className="fw-bold text-dark mb-0" style={{ fontSize: '0.92rem' }}>
                                    {summary.itemName}
                                  </h6>
                                  <span
                                    className="badge rounded-pill px-2.5 py-0.5 fw-bold"
                                    style={{
                                      backgroundColor: isAdd ? '#d1fae5' : '#dbeafe',
                                      color: isAdd ? '#047857' : '#1e40af',
                                      fontSize: '0.68rem',
                                    }}
                                  >
                                    {isAdd ? `${summary.addCount}x Ditambah` : `${summary.useCount}x Digunakan`}
                                  </span>
                                </div>

                                {/* JAM TRANSAKSI SAJA (BERSIH & LAPANG) */}
                                {summary.lastTime && (
                                  <div className="d-flex align-items-center gap-1 text-muted" style={{ fontSize: '0.74rem' }}>
                                    <i className="bi bi-clock" style={{ fontSize: '0.7rem' }}></i>
                                    <span>{summary.lastTime}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* TOTAL QTY */}
                            <div className="text-end flex-shrink-0">
                               <span
                                className={`fw-bold d-block ${isAdd ? 'text-success' : 'text-primary'}`}
                                style={{ fontSize: '1.1rem', letterSpacing: '-0.3px' }}
                              >
                                {isAdd ? `+${summary.totalQty}` : `-${summary.totalQty}`}
                              </span>
                              {summary.items.length > 1 && (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-link p-0 text-decoration-none text-muted fw-semibold d-inline-flex align-items-center gap-1"
                                  style={{ fontSize: '0.68rem' }}
                                  onClick={() => toggleDetail(summary.key)}
                                >
                                  <span>{isExpanded ? 'Tutup' : `${summary.items.length} Nota`}</span>
                                  <i className={`bi bi-chevron-${isExpanded ? 'up' : 'down'}`} style={{ fontSize: '0.6rem' }}></i>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* ACCORDION COLLAPSE: DAFTAR NOTA (OPSIONAL JIKA USER KLIK) */}
                          {isExpanded && summary.items.length > 1 && (
                            <div className="mt-2.5 pt-2 border-top">
                              <div className="bg-light rounded-3 p-2 d-flex flex-column gap-1">
                                {summary.items.map((it, itIdx) => (
                                  <div
                                    key={itIdx}
                                    className="d-flex align-items-center justify-content-between py-1 px-2 bg-white rounded-2 shadow-xs"
                                    style={{ fontSize: '0.72rem' }}
                                  >
                                    <div className="d-flex align-items-center gap-2">
                                      <span className="badge bg-light text-muted border px-1.5 py-0.5">
                                        #{itIdx + 1}
                                      </span>
                                      {it.invoiceId ? (
                                        <span
                                          className="fw-bold text-primary cursor-pointer text-decoration-underline"
                                          onClick={() => navigate(`/orders?tab=Proses`)}
                                          title="Buka Data Order"
                                        >
                                          #{it.invoiceId}
                                        </span>
                                      ) : (
                                        <span className="text-muted">{it.note || (isAdd ? 'Persetujuan Stok' : 'Pemakaian')}</span>
                                      )}
                                    </div>
                                    <div className="d-flex align-items-center gap-2">
                                      <span className="text-muted" style={{ fontSize: '0.68rem' }}>
                                        {it.timeStr}
                                      </span>
                                      <span className={`fw-bold ${isAdd ? 'text-success' : 'text-primary'}`}>
                                        {isAdd ? `+${it.qty}` : `-${it.qty}`}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
