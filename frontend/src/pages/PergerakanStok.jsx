import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { getInventoryEventsQuery, getInventoryQuery } from '../db/repositories/inventory';
import { getInventoryEventsFromDB } from '../services/syncService';
import PlanGateModal from '../components/PlanGateModal';
import { isSubscriptionEnabled, getSubscriptionReport } from '../services/subscriptionService';

// Helper format tanggal lokal YYYY-MM-DD sesuai zona waktu browser pengguna (WIB)
const getLocalDateStr = (dateVal) => {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/* Gaya halaman Riwayat Stok (prefix .sh-). Kelas seperti g-2.5 / p-1.5 / gap-1.5 tidak ada di Bootstrap 5. */
const SH_CSS = `
.sh-root { background: #f4f7fc; min-height: 100vh; padding: 22px 12px 90px; }
.sh-in { max-width: 680px; margin: 0 auto; }
.sh-sum { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
.sh-tile { display: flex; align-items: center; gap: 10px; padding: 11px 12px; border-radius: 16px; background: #fff; border: 1px solid #e8ebfa; min-width: 0; }
.sh-tile .ic { width: 36px; height: 36px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; font-size: 1.05rem; flex: none; }
.sh-tile.in .ic { background: #d9f6e6; color: #0e8f55; }
.sh-tile.out .ic { background: #e5edff; color: #0d5afd; }
.sh-tile small { display: block; font-size: .66rem; font-weight: 600; color: #8480ae; line-height: 1.2; }
.sh-tile b { display: block; font-size: 1.2rem; line-height: 1.15; letter-spacing: -.3px; color: #1f0757; }
.sh-tile.in b { color: #0e8f55; }
.sh-tile em { display: block; font-style: normal; font-size: .64rem; color: #8480ae; margin-top: 1px; }
.sh-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; padding: 3px; margin-bottom: 8px; background: #fff; border: 1px solid #e8ebfa; border-radius: 13px; }
.sh-tab { height: 32px; border: 0; border-radius: 10px; background: transparent; color: #8480ae; font-size: .74rem; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 5px; cursor: pointer; }
.sh-tab.on { background: #0d5afd; color: #fff; box-shadow: 0 6px 12px -6px rgba(13, 90, 253, .7); }
.sh-tab.on.in { background: #12b76a; box-shadow: 0 6px 12px -6px rgba(18, 183, 106, .7); }
.sh-row2 { display: flex; gap: 6px; margin-bottom: 6px; }
.sh-sbox { flex: 1; min-width: 0; position: relative; }
.sh-sbox > i { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); font-size: .8rem; color: #8480ae; pointer-events: none; }
.sh-sin, .sh-sel, .sh-din { height: 36px; border: 1px solid #e1e6fa; border-radius: 12px; background: #fff; font-size: .76rem; color: #1f0757; outline: none; }
.sh-sin { width: 100%; padding: 0 28px 0 32px; }
.sh-sin:focus, .sh-sel:focus, .sh-din:focus { border-color: #0d5afd; box-shadow: 0 0 0 3px rgba(13, 90, 253, .12); }
.sh-sclr { position: absolute; right: 3px; top: 50%; transform: translateY(-50%); width: 28px; height: 28px; border: 0; background: none; color: #a3a9c9; font-size: .7rem; }
.sh-sel { flex: 0 0 42%; min-width: 0; padding: 0 24px 0 10px; font-weight: 600; text-overflow: ellipsis; appearance: none; -webkit-appearance: none; background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none' stroke='%238480ae' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M1 1l4 4 4-4'/%3E%3C/svg%3E") no-repeat right 9px center; }
.sh-dates { display: flex; align-items: center; gap: 6px; margin-bottom: 12px; }
.sh-chips { display: flex; gap: 5px; flex: none; }
.sh-chip { height: 32px; padding: 0 12px; border-radius: 999px; border: 1px solid #e1e6fa; background: #fff; color: #5f5a86; font-size: .72rem; font-weight: 600; cursor: pointer; }
.sh-chip.on { background: #1f0757; border-color: #1f0757; color: #fff; }
.sh-din { flex: 1; min-width: 0; height: 32px; padding: 0 8px; font-weight: 600; }
.sh-ref { width: 32px; height: 32px; flex: none; border-radius: 50%; border: 1px solid #e1e6fa; background: #fff; color: #0d5afd; display: inline-flex; align-items: center; justify-content: center; font-size: .85rem; }
.sh-ref:disabled { opacity: .6; }
.sh-grp { margin-bottom: 14px; }
.sh-gh { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 0 4px 6px; }
.sh-gh h6 { margin: 0; font-size: .78rem; font-weight: 700; color: #1f0757; }
.sh-gh h6 span { font-weight: 500; color: #8480ae; }
.sh-net { display: flex; gap: 5px; flex: none; }
.sh-net span { font-size: .64rem; font-weight: 700; padding: 3px 8px; border-radius: 999px; }
.sh-net .i { background: #d9f6e6; color: #0e8f55; }
.sh-net .o { background: #e5edff; color: #0134d4; }
.sh-card { background: #fff; border: 1px solid #e8ebfa; border-radius: 16px; overflow: hidden; }
.sh-item + .sh-item { border-top: 1px solid #f0f2fc; }
.sh-line { display: flex; align-items: center; gap: 10px; padding: 10px 12px; width: 100%; border: 0; background: none; text-align: left; }
button.sh-line { cursor: pointer; }
.sh-ic { width: 34px; height: 34px; border-radius: 11px; display: inline-flex; align-items: center; justify-content: center; font-size: .95rem; flex: none; }
.sh-ic.in { background: #d9f6e6; color: #0e8f55; }
.sh-ic.out { background: #e5edff; color: #0d5afd; }
.sh-mid { flex: 1; min-width: 0; }
.sh-name { display: block; font-size: .84rem; font-weight: 700; color: #1f0757; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sh-sub { display: flex; align-items: center; gap: 6px; font-size: .68rem; color: #8480ae; margin-top: 1px; white-space: nowrap; overflow: hidden; }
.sh-sub a { color: #0d5afd; font-weight: 700; text-decoration: none; cursor: pointer; overflow: hidden; text-overflow: ellipsis; }
.sh-qty { font-size: 1rem; font-weight: 800; letter-spacing: -.3px; flex: none; }
.sh-qty.in { color: #0e8f55; }
.sh-qty.out { color: #1f0757; }
.sh-chev { color: #a3a9c9; font-size: .7rem; flex: none; }
.sh-notas { padding: 0 12px 10px 56px; display: flex; flex-direction: column; gap: 4px; }
.sh-nota { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 10px; border-radius: 9px; background: #f6f8ff; font-size: .7rem; color: #5f5a86; }
.sh-nota a { color: #0d5afd; font-weight: 700; cursor: pointer; text-decoration: none; }
.sh-nota .r { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
.sh-nota b { color: #1f0757; }
.sh-empty { text-align: center; padding: 38px 16px; background: #fff; border: 1px solid #e8ebfa; border-radius: 16px; color: #8480ae; }
.sh-empty i { display: block; font-size: 1.9rem; color: #0d5afd; opacity: .45; margin-bottom: 4px; }
.sh-empty b { display: block; color: #1f0757; font-size: .86rem; margin-bottom: 2px; }
.sh-empty p { margin: 0; font-size: .74rem; }
`;

export default function PergerakanStok({ user }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'in' | 'out'
  const [selectedItem, setSelectedItem] = useState('ALL');

  // Helper tanggal hari ini & kemarin
  const todayStr = useMemo(() => getLocalDateStr(new Date()), []);
  const yesterdayStr = useMemo(() => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    return getLocalDateStr(y);
  }, []);

  // Filter default: Hari Ini (bukan Semua) agar riwayat harian langsung fokus
  const [filterDate, setFilterDate] = useState(() => getLocalDateStr(new Date()));
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDetails, setExpandedDetails] = useState({});

  const toggleDetail = (key) => {
    setExpandedDetails((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const [dbEvents, setDbEvents] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [subReport, setSubReport] = useState(null);
  const [gateModalOpen, setGateModalOpen] = useState(false);

  // Ambil data subscription untuk verifikasi hak akses riwayat stok
  useEffect(() => {
    if (isSubscriptionEnabled()) {
      getSubscriptionReport()
        .then((res) => {
          setSubReport(res);
          if (res?.limits?.hasStockHistory === false) {
            setGateModalOpen(true);
          }
        })
        .catch(() => { });
    }
  }, []);

  // Ambil langsung data pergerakan stok dari DB tabel inventoryEvent
  const fetchFromDB = async () => {
    setIsRefreshing(true);
    try {
      const data = await getInventoryEventsFromDB();
      if (Array.isArray(data)) {
        setDbEvents(data);
      }
    } catch (err) {
      console.warn('[PergerakanStok] Gagal load dari DB:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFromDB();
  }, []);

  const rawEvents = useLiveQuery(getInventoryEventsQuery, []);
  const inventoryList = useLiveQuery(getInventoryQuery, []);

  // Gabungkan event lokal Dexie (rawEvents) dan backend DB (dbEvents)
  // Dexie memiliki live query real-time dan backfill dari orders lokal
  const activeEvents = useMemo(() => {
    const map = new Map();
    // 1. Masukkan events dari backend DB (jika ada)
    if (Array.isArray(dbEvents)) {
      dbEvents.forEach((e) => {
        const key = e.uuid || e.id || `${e.invoiceId}_${e.inventoryId || e.inventoryName}`;
        map.set(key, e);
      });
    }
    // 2. Masukkan / perbarui dengan events lokal dari Dexie (realtime & offline)
    if (Array.isArray(rawEvents)) {
      rawEvents.forEach((e) => {
        const key = e.uuid || e.id || `${e.invoiceId}_${e.inventoryId || e.inventoryName}`;
        map.set(key, e);
      });
    }
    const combined = Array.from(map.values());
    return combined.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [rawEvents, dbEvents]);

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
    if (activeEvents) {
      activeEvents.forEach((e) => {
        const name = e.inventoryName || inventoryMap[e.inventoryId];
        if (name) names.add(name);
      });
    }
    return Array.from(names).sort();
  }, [inventoryList, activeEvents, inventoryMap]);

  // Filter events berdasarkan Tab, Tanggal, Item, dan Search Query
  const filteredEvents = useMemo(() => {
    if (!activeEvents) return [];

    return activeEvents.filter((event) => {
      // 1. Filter Tab
      if (activeTab === 'in' && event.type !== 'ADD') return false;
      if (activeTab === 'out' && event.type !== 'SUBTRACT') return false;

      // 2. Filter Tanggal (berdasarkan tanggal lokal kalender)
      if (filterDate) {
        const eventDateStr = getLocalDateStr(event.createdAt);
        if (eventDateStr !== filterDate) return false;
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
  }, [activeEvents, activeTab, filterDate, selectedItem, searchQuery, inventoryMap]);

  // Hitung akumulasi total Stock In dan Stock Out sesuai filter tanggal & pencarian aktif
  const totals = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    let inCount = 0;
    let outCount = 0;

    // Filter berdasarkan filterDate, selectedItem, dan searchQuery (tanpa activeTab agar kedua kartu selalu update)
    const baseEvents = (activeEvents || []).filter((event) => {
      if (filterDate) {
        const eventDateStr = getLocalDateStr(event.createdAt);
        if (eventDateStr !== filterDate) return false;
      }
      const itemName = (event.inventoryName || inventoryMap[event.inventoryId] || '').toLowerCase();
      if (selectedItem !== 'ALL') {
        if (itemName !== selectedItem.toLowerCase()) return false;
      }
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

    baseEvents.forEach((e) => {
      const qty = Number(e.qty) || 0;
      if (e.type === 'ADD') {
        totalIn += qty;
        inCount += 1;
      } else if (e.type === 'SUBTRACT') {
        totalOut += qty;
        outCount += 1;
      }
    });

    return { totalIn, totalOut, inCount, outCount };
  }, [activeEvents, filterDate, selectedItem, searchQuery, inventoryMap]);

  // Grouping data event berdasarkan tanggal lokal (YYYY-MM-DD) dan ringkas per item
  const groupedEvents = useMemo(() => {
    const groups = {};

    filteredEvents.forEach((event) => {
      const d = event.createdAt ? new Date(event.createdAt) : new Date();
      // Format key: YYYY-MM-DD lokal
      const dateKey = !isNaN(d.getTime()) ? getLocalDateStr(d) : 'UNKNOWN';

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

  const itemLabel = (n) => `${n.toLocaleString('id-ID')}`;
  const isTodayKey = filterDate === todayStr;
  const isYesterdayKey = filterDate === yesterdayStr;

  return (
    <div className="sh-root">
      <style>{SH_CSS}</style>
      <div className="sh-in">

        {/* Ringkasan (ikut filter tanggal / barang / cari) */}
        <div className="sh-sum">
          <div className="sh-tile in">
            <span className="ic"><i className="bi bi-box-arrow-in-down"></i></span>
            <div>
              <small>Stok Masuk</small>
              <b>+{itemLabel(totals.totalIn)}</b>
              <em>{totals.inCount}x penambahan</em>
            </div>
          </div>
          <div className="sh-tile out">
            <span className="ic"><i className="bi bi-box-arrow-up"></i></span>
            <div>
              <small>Stok Keluar</small>
              <b>−{itemLabel(totals.totalOut)}</b>
              <em>{totals.outCount}x pemakaian</em>
            </div>
          </div>
        </div>

        {/* Tab */}
        <div className="sh-tabs" role="tablist">
          {[
            ['all', 'Semua', null],
            ['in', 'Masuk', 'bi-arrow-down-left'],
            ['out', 'Keluar', 'bi-arrow-up-right'],
          ].map(([key, label, icon]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={activeTab === key}
              className={`sh-tab ${activeTab === key ? 'on' : ''} ${key === 'in' ? 'in' : ''}`}
              onClick={() => setActiveTab(key)}
            >
              {icon && <i className={`bi ${icon}`}></i>}
              {label}
            </button>
          ))}
        </div>

        {/* Cari + pilih barang */}
        <div className="sh-row2">
          <div className="sh-sbox">
            <i className="bi bi-search"></i>
            <input
              type="search"
              className="sh-sin"
              placeholder="Cari nota / barang"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Cari nota atau barang"
            />
            {searchQuery && (
              <button type="button" className="sh-sclr" onClick={() => setSearchQuery('')} aria-label="Hapus pencarian">
                <i className="bi bi-x-lg"></i>
              </button>
            )}
          </div>
          <select className="sh-sel" value={selectedItem} onChange={(e) => setSelectedItem(e.target.value)} aria-label="Filter barang">
            <option value="ALL">Semua barang</option>
            {uniqueItemNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        {/* Tanggal */}
        <div className="sh-dates">
          <div className="sh-chips">
            <button type="button" className={`sh-chip ${isTodayKey ? 'on' : ''}`} onClick={() => setFilterDate(todayStr)}>Hari ini</button>
            <button type="button" className={`sh-chip ${isYesterdayKey ? 'on' : ''}`} onClick={() => setFilterDate(yesterdayStr)}>Kemarin</button>
            <button type="button" className={`sh-chip ${!filterDate ? 'on' : ''}`} onClick={() => setFilterDate('')}>Semua</button>
          </div>
          <input
            type="date"
            className="sh-din"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            aria-label="Pilih tanggal"
          />
          <button type="button" className="sh-ref" onClick={fetchFromDB} disabled={isRefreshing} title="Muat ulang" aria-label="Muat ulang">
            <i className={`bi bi-arrow-clockwise ${isRefreshing ? 'spin' : ''}`}></i>
          </button>
        </div>

        {/* Daftar per tanggal */}
        {groupedEvents.length === 0 ? (
          <div className="sh-empty">
            <i className="bi bi-inbox"></i>
            <b>Belum ada pergerakan stok</b>
            <p>Coba ganti tanggal atau pilih &quot;Semua&quot;.</p>
          </div>
        ) : (
          groupedEvents.map((group) => {
            if (group.summaries.length === 0) return null;
            const heading = formatDateHeading(group.dateObj).split(' • ');
            return (
              <div key={group.dateKey} className="sh-grp">
                <div className="sh-gh">
                  <h6>
                    {heading[0]}
                    {heading[1] && <span> · {heading[1]}</span>}
                  </h6>
                  <div className="sh-net">
                    {group.totalIn > 0 && <span className="i">+{group.totalIn}</span>}
                    {group.totalOut > 0 && <span className="o">−{group.totalOut}</span>}
                  </div>
                </div>

                <div className="sh-card">
                  {group.summaries.map((summary) => {
                    const isAdd = summary.type === 'ADD';
                    const dir = isAdd ? 'in' : 'out';
                    const isExpanded = Boolean(expandedDetails[summary.key]);
                    const multi = summary.items.length > 1;
                    const count = isAdd ? summary.addCount : summary.useCount;
                    const single = !multi ? summary.items[0] : null;

                    const body = (
                      <>
                        <span className={`sh-ic ${dir}`}>
                          <i className={`bi ${isAdd ? 'bi-box-arrow-in-down' : 'bi-box-arrow-up'}`}></i>
                        </span>
                        <span className="sh-mid">
                          <span className="sh-name">{summary.itemName}</span>
                          <span className="sh-sub">
                            <span>{isAdd ? `${count}x ditambah` : `${count}x dipakai`}</span>
                            {summary.lastTime && <span>· {summary.lastTime}</span>}
                            {single?.invoiceId && (
                              <a
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/order/${encodeURIComponent(single.invoiceId)}`);
                                }}
                                title={`Buka detail order #${single.invoiceId}`}
                              >
                                · #{single.invoiceId}
                              </a>
                            )}
                          </span>
                        </span>
                        <span className={`sh-qty ${dir}`}>{isAdd ? `+${summary.totalQty}` : `−${summary.totalQty}`}</span>
                        {multi && <i className={`bi bi-chevron-${isExpanded ? 'up' : 'down'} sh-chev`}></i>}
                      </>
                    );

                    return (
                      <div key={summary.key} className="sh-item">
                        {multi ? (
                          <button type="button" className="sh-line" onClick={() => toggleDetail(summary.key)} aria-expanded={isExpanded}>
                            {body}
                          </button>
                        ) : (
                          <div className="sh-line">{body}</div>
                        )}

                        {isExpanded && multi && (
                          <div className="sh-notas">
                            {summary.items.map((it, itIdx) => (
                              <div key={itIdx} className="sh-nota">
                                {it.invoiceId ? (
                                  <a onClick={() => navigate(`/order/${encodeURIComponent(it.invoiceId)}`)} title={`Buka detail order #${it.invoiceId}`}>
                                    #{it.invoiceId}
                                  </a>
                                ) : (
                                  <span>{it.note || (isAdd ? 'Persetujuan Stok' : 'Pemakaian')}</span>
                                )}
                                <span className="r">
                                  <span>{it.timeStr}</span>
                                  <b>{isAdd ? `+${it.qty}` : `−${it.qty}`}</b>
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Plan Gate Modal jika paket belum mendukung fitur riwayat stok */}
      <PlanGateModal
        isOpen={gateModalOpen}
        onClose={() => setGateModalOpen(false)}
        type="STOCK_HISTORY_LOCKED"
        customData={{ plan: subReport?.plan || 'TRIAL' }}
        user={user}
      />
    </div>
  );
}