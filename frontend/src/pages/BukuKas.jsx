import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import toast from 'react-hot-toast';
import { getOrdersSortedByDateQuery } from '../db/repositories/orders';
import { getCashEntriesQuery, addCashEntry, updateCashEntry, deleteCashEntry } from '../db/repositories/cashEntries';
import { getInventoryQuery, addInventoryManual } from '../db/repositories/inventory';
import { isStatusLunas } from '../utils/paymentStatus';

/* ============================================================
   ADAPTOR UANG MASUK DARI ORDER  (sesuaikan bagian ini dengan data Anda)
   - Lunas  : dicatat sebesar total order
   - DP     : dicatat sebesar uang muka (kolom dp / dpAmount / uangMuka)
   - Tanggal: order.paidAt (jika ada) -> updatedAt -> createdAt
   Catatan: jika pelunasan DP nanti disimpan sebagai kejadian pembayaran terpisah, cukup ganti fungsi ini
   agar mengembalikan satu entri per pembayaran (tanggal = tanggal bayar), bagian lain tidak perlu diubah.
   ============================================================ */
const parseMethod = (s = '') => {
    const t = String(s).toLowerCase();
    if (/qris/.test(t)) return 'qris';
    if (/transfer|tf|bank/.test(t)) return 'transfer';
    return 'tunai';
};

const orderToEntries = (order) => {
    if (order.status === 'Dibatalkan') return [];
    const when = order.paidAt || order.updatedAt || order.createdAt;
    const s = String(order.statusBayar || '').toLowerCase();
    let amount = 0;
    if (isStatusLunas(order.statusBayar)) amount = Number(order.total) || 0;
    else if (s === 'dp') amount = Number(order.dp ?? order.dpAmount ?? order.uangMuka ?? order.bayar ?? 0) || 0;
    if (amount <= 0 || !when) return [];
    return [
        {
            uuid: `order-${order.id}`,
            source: 'ORDER',
            orderId: order.id,
            type: 'IN',
            category: 'order',
            amount,
            method: parseMethod(order.metodeBayar || order.statusBayar),
            title: order.invoiceId,
            note: order.pelangganNama || 'Umum',
            createdAt: when,
        },
    ];
};

/* ---------- Konstanta ---------- */
const METHODS = [
    { key: 'tunai', label: 'Tunai', icon: 'bi-cash-coin' },
    { key: 'qris', label: 'QRIS', icon: 'bi-qr-code' },
    { key: 'transfer', label: 'Transfer', icon: 'bi-bank' },
];
const CATS = {
    OUT: [
        { key: 'bahan', label: 'Deterjen & bahan', short: 'Bahan', icon: 'bi-droplet-half' },
        { key: 'kemasan', label: 'Plastik & kemasan', short: 'Kemasan', icon: 'bi-bag' },
        { key: 'gaji', label: 'Gaji', icon: 'bi-person-workspace' },
        { key: 'listrik', label: 'Listrik & air', short: 'Listrik/Air', icon: 'bi-lightning-charge' },
        { key: 'sewa', label: 'Sewa', icon: 'bi-house-door' },
        { key: 'lain', label: 'Lain-lain', icon: 'bi-three-dots' },
    ],
    IN: [
        { key: 'modal', label: 'Tambah modal', short: 'Modal', icon: 'bi-piggy-bank' },
        { key: 'setoran', label: 'Setoran', icon: 'bi-box-arrow-in-down' },
        { key: 'lain', label: 'Lain-lain', icon: 'bi-three-dots' },
    ],
};
const ORDER_CAT = { key: 'order', label: 'Order', icon: 'bi-bag-check' };
const catMeta = (e) => (e.source === 'ORDER' ? ORDER_CAT : CATS[e.type]?.find((c) => c.key === e.category) || { label: 'Lain-lain', icon: 'bi-three-dots' });
const methodLabel = (k) => METHODS.find((m) => m.key === k)?.label || 'Tunai';

const rp = (n) => `Rp ${Math.abs(Number(n) || 0).toLocaleString('id-ID')}`;
const localDate = (v) => {
    const d = v ? new Date(v) : new Date();
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const timeOf = (v) => {
    const d = new Date(v);
    return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).replace('.', ':');
};
const dayHeading = (key) => {
    const [y, m, d] = key.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const now = new Date();
    const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = Math.round((t0 - dt) / 86400000);
    const base = dt.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' });
    if (diff === 0) return ['Hari ini', base];
    if (diff === 1) return ['Kemarin', base];
    return [base, ''];
};
const periodRange = (period) => {
    const now = new Date();
    const to = localDate(now);
    if (period === 'hari') return [to, to];
    if (period === 'minggu') {
        const s = new Date(now);
        s.setDate(s.getDate() - 6);
        return [localDate(s), to];
    }
    return [localDate(new Date(now.getFullYear(), now.getMonth(), 1)), to];
};

const KB_CSS = `
.kb-wrap { padding: 22px 12px 150px; max-width: 680px; margin: 0 auto; }
.kb-wrap.emb { padding: 0 0 150px; max-width: none; }
.kb-eye { position: absolute; right: 14px; top: 12px; z-index: 2; width: 34px; height: 34px; border: 0; border-radius: 50%; background: rgba(255, 255, 255, .25); color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 1.05rem; }
.kb-periods { display: flex; gap: 6px; margin-bottom: 10px; }
.kb-chip { height: 32px; padding: 0 14px; border-radius: 999px; border: 1px solid #e1e6fa; background: #fff; color: #5f5a86; font-size: .74rem; font-weight: 600; cursor: pointer; }
.kb-chip.on { background: #1f0757; border-color: #1f0757; color: #fff; }
.kb-hero { position: relative; overflow: hidden; border-radius: 20px; padding: 16px 16px 14px; color: #fff; margin-bottom: 10px; background: linear-gradient(135deg, #0d5afd 0%, #0134d4 100%); box-shadow: 0 18px 30px -18px rgba(13, 90, 253, .8); }
.kb-hero::after { content: ''; position: absolute; right: -40px; top: -50px; width: 150px; height: 150px; border-radius: 50%; background: rgba(255, 255, 255, .1); }
.kb-hero small { display: block; font-size: .7rem; font-weight: 600; opacity: .85; }
.kb-hero .big { display: block; font-size: 1.7rem; font-weight: 700; letter-spacing: -.5px; line-height: 1.2; }
.kb-hero .big.neg { color: #ffd2d4; }
.kb-io { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; position: relative; z-index: 1; }
.kb-io div { background: rgba(255, 255, 255, .16); border-radius: 13px; padding: 8px 10px; }
.kb-io b { display: block; font-size: .92rem; }
.kb-io span { font-size: .66rem; opacity: .9; display: inline-flex; align-items: center; gap: 4px; }
.kb-sub { margin-top: 10px; font-size: .68rem; opacity: .9; position: relative; z-index: 1; display: flex; gap: 12px; flex-wrap: wrap; }
.kb-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; padding: 3px; margin-bottom: 10px; background: #fff; border: 1px solid #e8ebfa; border-radius: 13px; }
.kb-tab { height: 32px; border: 0; border-radius: 10px; background: transparent; color: #8480ae; font-size: .74rem; font-weight: 700; cursor: pointer; }
.kb-tab.on { background: #0d5afd; color: #fff; box-shadow: 0 6px 12px -6px rgba(13, 90, 253, .7); }
.kb-tab.on.in { background: #12b76a; box-shadow: 0 6px 12px -6px rgba(18, 183, 106, .7); }
.kb-tab.on.out { background: #ef4444; box-shadow: 0 6px 12px -6px rgba(239, 68, 68, .7); }
.kb-gh { display: flex; align-items: center; justify-content: space-between; padding: 4px 4px 6px; }
.kb-gh h6 { margin: 0; font-size: .78rem; font-weight: 700; color: #1f0757; }
.kb-gh h6 span { font-weight: 500; color: #8480ae; }
.kb-gh em { font-style: normal; font-size: .68rem; font-weight: 700; color: #5f5a86; }
.kb-card { background: #fff; border: 1px solid #e8ebfa; border-radius: 16px; overflow: hidden; margin-bottom: 12px; }
.kb-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; width: 100%; border: 0; background: none; text-align: left; }
.kb-row + .kb-row { border-top: 1px solid #f0f2fc; }
button.kb-row { cursor: pointer; }
.kb-ic { width: 36px; height: 36px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; font-size: 1rem; flex: none; }
.kb-ic.in { background: #d9f6e6; color: #0e8f55; }
.kb-ic.out { background: #fee8e9; color: #e5484d; }
.kb-mid { flex: 1; min-width: 0; }
.kb-t { display: block; font-size: .84rem; font-weight: 700; color: #1f0757; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kb-s { display: block; font-size: .67rem; color: #8480ae; margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kb-amt { font-size: .92rem; font-weight: 800; flex: none; letter-spacing: -.2px; }
.kb-amt.in { color: #0e8f55; }
.kb-amt.out { color: #e5484d; }
.kb-empty { text-align: center; padding: 38px 16px; background: #fff; border: 1px solid #e8ebfa; border-radius: 16px; color: #8480ae; }
.kb-empty i { display: block; font-size: 1.9rem; color: #0d5afd; opacity: .45; margin-bottom: 4px; }
.kb-empty b { display: block; color: #1f0757; font-size: .86rem; margin-bottom: 2px; }
.kb-empty p { margin: 0; font-size: .74rem; }
.kb-fab { position: fixed; right: 16px; bottom: 78px; z-index: 1040; height: 52px; padding: 0 20px 0 16px; border: 0; border-radius: 999px; background: #0d5afd; color: #fff; font-size: .86rem; font-weight: 700; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 16px 28px -10px rgba(13, 90, 253, .8); }
.kb-fab i { font-size: 1.3rem; }
.kb-dock { position: fixed; left: 50%; bottom: 0; transform: translateX(-50%); width: 100%; max-width: 540px; padding: 0 8px; z-index: 1055; pointer-events: none; animation: kb-rise .25s cubic-bezier(.16, 1, .3, 1); }
.kb-panel { pointer-events: auto; background: #fff; border: 1px solid #e8ebfa; border-radius: 22px 22px 0 0; max-height: 56vh; overflow-y: auto; padding: 10px 14px 14px; box-shadow: 0 -10px 35px rgba(0, 0, 0, .18); }
.kb-grab { width: 36px; height: 4px; border-radius: 10px; background: #cbd5e1; margin: 0 auto 6px; cursor: pointer; }
.kb-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
.kb-hb { display: flex; gap: 6px; flex: none; }
.kb-who { display: flex; align-items: center; gap: 8px; min-width: 0; }
.kb-who .av { width: 30px; height: 30px; border-radius: 50%; background: #f1f2fb; border: 1px solid #e8ebfa; color: #0d5afd; display: inline-flex; align-items: center; justify-content: center; font-size: .9rem; flex: none; }
.kb-who b { font-size: .88rem; color: #1f0757; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kb-circ { width: 30px; height: 30px; border-radius: 50%; border: 0; background: #f1f2fb; color: #8480ae; display: inline-flex; align-items: center; justify-content: center; font-size: .8rem; flex: none; }
.kb-banner { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 6px 14px; margin-bottom: 6px; border-radius: 14px; background: #0134d4; color: #fff; }
.kb-banner > span { font-size: .7rem; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; flex: none; }
.kb-banner .amt { display: flex; align-items: center; justify-content: flex-end; gap: 6px; min-width: 0; flex: 1; }
.kb-banner .amt i { font-style: normal; font-size: .9rem; font-weight: 700; opacity: .8; }
.kb-banner input { width: 100%; min-width: 0; max-width: 190px; border: 0; outline: 0; background: none; color: #fff; font-size: 1.3rem; font-weight: 700; text-align: right; padding: 0; }
.kb-banner input::placeholder { color: rgba(255, 255, 255, .5); }
.kb-banner .clr { border: 0; background: none; color: rgba(255, 255, 255, .7); font-size: .85rem; padding: 0; align-self: center; }
.kb-seg { display: grid; grid-template-columns: 1fr 1fr; padding: 2px; margin-bottom: 2px; background: #f1f2fb; border: 1px solid #e8ebfa; border-radius: 12px; }
.kb-seg button { height: 30px; border: 0; border-radius: 10px; background: transparent; color: #8480ae; font-size: .74rem; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 5px; }
.kb-seg button.on.in { background: #2fcb4f; color: #fff; box-shadow: 0 4px 10px -4px rgba(47, 203, 79, .8); }
.kb-seg button.on.out { background: #ef4444; color: #fff; box-shadow: 0 4px 10px -4px rgba(239, 68, 68, .8); }
.kb-sec { display: flex; align-items: center; gap: 8px; margin: 8px 0 4px; font-size: .58rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #8480ae; }
.kb-sec::after { content: ''; flex: 1; height: 1px; background: #e8ebfa; }
.kb-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; }
.kb-opt { min-width: 0; height: 30px; padding: 0 6px; border-radius: 9px; border: 1px solid #e8ebfa; background: #fff; color: #1f0757; font-size: .68rem; display: inline-flex; align-items: center; justify-content: center; gap: 5px; }
.kb-opt i { font-size: .85rem; flex: none; }
.kb-opt span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kb-opt.on { border-color: #0d5afd; background: #e5edff; color: #0d5afd; font-weight: 700; }
.kb-grid.meth .kb-opt { background: #f8faff; }
.kb-grid.meth .kb-opt.on { background: #0d5afd; border-color: #0d5afd; color: #fff; }
.kb-qrow { display: flex; align-items: center; gap: 5px; overflow-x: auto; padding: 8px 0 6px; scrollbar-width: none; }
.kb-qrow::-webkit-scrollbar { display: none; }
.kb-q { flex: none; height: 26px; padding: 0 10px; border-radius: 8px; border: 1px solid #8480ae; background: #fff; color: #8480ae; font-size: .68rem; font-weight: 700; white-space: nowrap; }
.kb-q.on { border-color: #0d5afd; color: #0d5afd; }
.kb-field { display: flex; align-items: center; gap: 4px; height: 40px; padding: 0 10px; margin: 0; border: 1px solid #e8ebfa; border-radius: 10px; background: #fff; }
.kb-field > span { font-size: .8rem; font-weight: 700; color: #8480ae; }
.kb-field input { flex: 1; min-width: 0; border: 0; outline: none; background: none; font-size: 1rem; font-weight: 700; color: #1f0757; }
.kb-field button { border: 0; background: none; color: #a3a9c9; font-size: .85rem; padding: 0 2px; }
.kb-two { display: flex; gap: 6px; margin-bottom: 6px; }
.kb-mini { display: flex; gap: 8px; align-items: stretch; margin-top: 8px; }
.kb-mini .kb-field { flex: 1; min-width: 0; }
.kb-mini .kb-save { flex: 0 0 auto; padding: 0 18px; }
.kb-hint { margin-top: 6px; font-size: .64rem; color: #8480ae; text-align: center; }
.kb-in { flex: 1.5; min-width: 0; height: 34px; padding: 0 10px; border: 1px solid #e8ebfa; border-radius: 10px; font-size: .76rem; color: #1f0757; background: #fff; outline: none; }
.kb-in.d { flex: 1; padding: 0 6px; }
.kb-in:focus { border-color: #0d5afd; }
.kb-info { display: flex; align-items: center; justify-content: space-between; padding: 4px 10px; margin-bottom: 6px; border: 1px solid #e8ebfa; border-radius: 10px; background: #f1f2fb; font-size: .75rem; color: #8480ae; }
.kb-info b { font-size: .85rem; }
.kb-info b.pos { color: #2fcb4f; }
.kb-info b.neg { color: #ef4444; }
.kb-act { display: flex; gap: 8px; }
.kb-save { flex: 1; height: 40px; border: 0; border-radius: 12px; background: #0134d4; color: #fff; font-size: .9rem; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
.kb-save:disabled { background: #5b7de6; }
.kb-save.two { height: 46px; gap: 8px; }
.kb-save.two .t { display: flex; flex-direction: column; text-align: left; line-height: 1.15; }
.kb-save.two .t small { font-size: .62rem; font-weight: 600; opacity: .9; }
.kb-del { height: 46px; padding: 0 16px; border-radius: 12px; border: 1px solid #f3c3c5; background: #fff5f5; color: #e5484d; font-size: .8rem; font-weight: 700; }
@keyframes kb-rise { from { opacity: 0; transform: translate(-50%, 16px); } to { opacity: 1; transform: translate(-50%, 0); } }
@keyframes kb-slide { from { transform: translateY(40px); opacity: 0; } to { transform: none; opacity: 1; } }
`;

/**
 * Mencari stok inventori aktif yang namanya mirip dengan input teks catatan kas
 */
export const findMatchingInventoryItems = (inputNote = '', activeItems = []) => {
    if (!inputNote || !Array.isArray(activeItems) || activeItems.length === 0) return [];
    const cleanInput = inputNote.toLowerCase().trim();
    if (!cleanInput) return [];

    const stopWords = new Set([
        'beli', 'membeli', 'pembelian', 'belanja', 'tambah', 'stok', 'stock',
        'dan', 'ke', 'di', 'untuk', 'buat', 'dari', 'yang', 'pada', 'oleh',
        'rp', 'harga', 'ongkir', 'biaya', 'uang', 'kas'
    ]);

    const tokens = cleanInput
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length >= 3 && !stopWords.has(t));

    if (tokens.length === 0 && cleanInput.length >= 3) {
        tokens.push(cleanInput);
    }
    if (tokens.length === 0) return [];

    return activeItems.filter((item) => {
        if (!item || !item.nama) return false;
        // Hanya stok yang aktif dan belum dihapus
        if (item.deletedAt || item.isActive === false) return false;

        const itemNama = item.nama.toLowerCase().trim();

        // 1. Direct containment (misal input "deterjen", nama "Deterjen 500ml")
        if (itemNama.includes(cleanInput) || cleanInput.includes(itemNama)) {
            return true;
        }

        // 2. Token match
        const itemTokens = itemNama
            .replace(/[^a-zA-Z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter((t) => t.length >= 3);

        for (const token of tokens) {
            if (itemNama.includes(token)) return true;
            for (const it of itemTokens) {
                if (it.includes(token) || token.includes(it)) return true;
            }
        }
        return false;
    });
};

// Props opsional (dipakai saat ditanam di halaman Reports):
//   embedded        : tanpa padding atas/maks-lebar sendiri
//   hidden / onToggleHidden : sembunyikan nominal di kartu ringkasan (dibagi dengan tab Penjualan)
export default function BukuKas({ user, embedded = false, hidden, onToggleHidden }) {
    const navigate = useNavigate();
    const role = user?.role || JSON.parse(sessionStorage.getItem('user') || '{}')?.role;
    const isOwner = role === 'owner';
    const username = user?.username || JSON.parse(sessionStorage.getItem('user') || '{}')?.username || '';

    const [ownHidden, setOwnHidden] = useState(false);
    const isHidden = hidden !== undefined ? hidden : ownHidden;
    const toggleHidden = onToggleHidden || (() => setOwnHidden((v) => !v));
    const mask = (txt) => (isHidden ? 'Rp ••••••' : txt);

    const [period, setPeriod] = useState('hari'); // hari | minggu | bulan
    const [tab, setTab] = useState('all'); // all | IN | OUT

    // Sheet tambah / ubah
    const [sheet, setSheet] = useState(null); // null | { mode: 'add' | 'edit', entry? }
    const [fType, setFType] = useState('OUT');
    const [fAmount, setFAmount] = useState('');
    const [fCat, setFCat] = useState('bahan');
    const [fMethod, setFMethod] = useState('tunai');
    const [fNote, setFNote] = useState('');
    const [fDate, setFDate] = useState(localDate(new Date()));
    const [confirmDel, setConfirmDel] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isMini, setIsMini] = useState(false);

    const manual = useLiveQuery(getCashEntriesQuery, []);
    const orders = useLiveQuery(getOrdersSortedByDateQuery, []);
    const inventory = useLiveQuery(getInventoryQuery, []);

    const activeInventory = useMemo(() => {
        if (!Array.isArray(inventory)) return [];
        return inventory.filter((item) => !item.deletedAt && item.isActive !== false);
    }, [inventory]);

    // State untuk popup auto-update stock saat simpan kas pengeluaran
    const [stockPrompt, setStockPrompt] = useState(null); // null | { open: true, note, matchedItems: [], selectedId, qty: 1 }
    const [updatingStock, setUpdatingStock] = useState(false);

    const [from, to] = periodRange(period);

    // Gabungkan: entri manual + uang masuk dari order, lalu saring sesuai periode
    const entries = useMemo(() => {
        const m = (manual || []).map((e) => ({ ...e, date: e.date || localDate(e.createdAt) }));
        const o = (orders || []).flatMap(orderToEntries).map((e) => ({ ...e, date: localDate(e.createdAt) }));
        return [...m, ...o]
            .filter((e) => e.date >= from && e.date <= to)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }, [manual, orders, from, to]);

    const totals = useMemo(() => {
        let masuk = 0;
        let keluar = 0;
        let tunai = 0;
        entries.forEach((e) => {
            const a = Number(e.amount) || 0;
            const sign = e.type === 'IN' ? 1 : -1;
            if (e.type === 'IN') masuk += a;
            else keluar += a;
            if ((e.method || 'tunai') === 'tunai') tunai += sign * a;
        });
        const saldo = masuk - keluar;
        return { masuk, keluar, saldo, tunai, nonTunai: saldo - tunai };
    }, [entries]);

    const groups = useMemo(() => {
        const map = {};
        entries
            .filter((e) => tab === 'all' || e.type === tab)
            .forEach((e) => {
                (map[e.date] ||= { key: e.date, rows: [], net: 0 }).rows.push(e);
                map[e.date].net += (e.type === 'IN' ? 1 : -1) * (Number(e.amount) || 0);
            });
        return Object.values(map).sort((a, b) => b.key.localeCompare(a.key));
    }, [entries, tab]);

    /* ---------- Sheet ---------- */
    const openAdd = (type = 'OUT') => {
        setFType(type);
        setFAmount('');
        setFCat(CATS[type][0].key);
        setFMethod('tunai');
        setFNote('');
        setFDate(localDate(new Date()));
        setConfirmDel(false);
        setIsMini(false);
        setSheet({ mode: 'add' });
    };
    const openEdit = (e) => {
        setFType(e.type);
        setFAmount(String(e.amount));
        setFCat(e.category);
        setFMethod(e.method || 'tunai');
        setFNote(e.note || '');
        setFDate(e.date);
        setConfirmDel(false);
        setIsMini(false);
        setSheet({ mode: 'edit', entry: e });
    };
    const closeSheet = () => setSheet(null);
    const switchType = (t) => {
        setFType(t);
        setFCat(CATS[t][0].key);
    };

    useEffect(() => {
        if (!sheet) return undefined;
        const onKey = (e) => e.key === 'Escape' && closeSheet();
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [sheet]);

    const amountNum = Number(String(fAmount).replace(/\D/g, '')) || 0;
    const signed = (t, a) => (t === 'IN' ? a : -a);
    const saldoSetelah = totals.saldo + signed(fType, amountNum) - (sheet?.mode === 'edit' ? signed(sheet.entry.type, Number(sheet.entry.amount) || 0) : 0);
    const quickVals = fType === 'IN' ? [50000, 100000, 500000, 1000000] : [10000, 25000, 50000, 100000];

    const handleSave = async () => {
        if (amountNum <= 0 || saving) return;
        setSaving(true);
        try {
            // Jam ikut tanggal pilihan agar urutan di hari itu tetap wajar
            const base = new Date();
            const [y, m, d] = fDate.split('-').map(Number);
            const when = new Date(y, m - 1, d, base.getHours(), base.getMinutes(), base.getSeconds()).toISOString();
            const cleanNote = fNote.trim();
            const payload = { type: fType, amount: amountNum, category: fCat, method: fMethod, note: cleanNote, date: fDate };
            if (sheet.mode === 'edit') {
                await updateCashEntry(sheet.entry.uuid, payload);
            } else {
                await addCashEntry({ ...payload, createdAt: when, createdBy: username });
            }
            toast.success(fType === 'IN' ? 'Uang masuk tercatat' : 'Pengeluaran tercatat');
            closeSheet();

            // Cek apakah ada kemiripan nama pengeluaran dengan stok aktif
            if (sheet.mode !== 'edit' && fType === 'OUT' && cleanNote) {
                const matches = findMatchingInventoryItems(cleanNote, activeInventory);
                if (matches.length > 0) {
                    setStockPrompt({
                        open: true,
                        note: cleanNote,
                        matchedItems: matches,
                        selectedId: matches[0].id || matches[0].uuid,
                        qty: 1,
                    });
                }
            }
        } catch (err) {
            toast.error(err?.message || 'Gagal menyimpan');
        } finally {
            setSaving(false);
        }
    };

    const handleConfirmStockUpdate = async () => {
        if (!stockPrompt || updatingStock) return;
        const targetItem = stockPrompt.matchedItems.find(
            (i) => String(i.id || i.uuid) === String(stockPrompt.selectedId)
        ) || stockPrompt.matchedItems[0];

        if (!targetItem) {
            setStockPrompt(null);
            return;
        }

        const qtyToAdd = Math.max(1, Number(stockPrompt.qty) || 1);
        setUpdatingStock(true);
        try {
            await addInventoryManual(targetItem.nama, qtyToAdd, {
                isPending: !isOwner,
                user: { username, role }
            });
            if (isOwner) {
                toast.success(`Stok "${targetItem.nama}" berhasil ditambah (+${qtyToAdd} ${targetItem.unit || 'pcs'})`);
            } else {
                toast.success(`Pengajuan stok "${targetItem.nama}" (+${qtyToAdd}) berhasil dikirim ke Owner`);
            }
            setStockPrompt(null);
        } catch (err) {
            toast.error(err?.message || 'Gagal mengupdate stok');
        } finally {
            setUpdatingStock(false);
        }
    };

    const handleDelete = async () => {
        if (!confirmDel) {
            setConfirmDel(true);
            return;
        }
        try {
            await deleteCashEntry(sheet.entry.uuid);
            toast.success('Catatan dihapus');
            closeSheet();
        } catch (err) {
            toast.error(err?.message || 'Gagal menghapus');
        }
    };

    const loading = manual === undefined || orders === undefined;

    return (
        <div className={`kb-wrap ${embedded ? 'emb' : ''}`}>
            <style>{KB_CSS}</style>

            {/* Periode */}
            <div className="kb-periods">
                {[['hari', 'Hari ini'], ['minggu', '7 hari'], ['bulan', 'Bulan ini']].map(([k, l]) => (
                    <button key={k} type="button" className={`kb-chip ${period === k ? 'on' : ''}`} onClick={() => setPeriod(k)}>{l}</button>
                ))}
            </div>

            {/* Ringkasan */}
            <div className="kb-hero">
                <button type="button" className="kb-eye" onClick={toggleHidden} title={isHidden ? 'Tampilkan nominal' : 'Sembunyikan nominal'} aria-label={isHidden ? 'Tampilkan nominal' : 'Sembunyikan nominal'}>
                    <i className={`bi ${isHidden ? 'bi-eye-fill' : 'bi-eye-slash-fill'}`}></i>
                </button>
                <small>Saldo kas</small>
                <span className={`big ${!isHidden && totals.saldo < 0 ? 'neg' : ''}`}>{isHidden ? mask() : `${totals.saldo < 0 ? '−' : ''}${rp(totals.saldo)}`}</span>
                <div className="kb-io">
                    <div><span><i className="bi bi-arrow-down-left"></i> Masuk</span><b>{isHidden ? mask() : rp(totals.masuk)}</b></div>
                    <div><span><i className="bi bi-arrow-up-right"></i> Keluar</span><b>{isHidden ? mask() : rp(totals.keluar)}</b></div>
                </div>
                <div className="kb-sub">
                    <span><i className="bi bi-cash-coin"></i> Tunai di laci {isHidden ? '••••' : `${totals.tunai < 0 ? '−' : ''}${rp(totals.tunai)}`}</span>
                    <span><i className="bi bi-phone"></i> Non-tunai {isHidden ? '••••' : `${totals.nonTunai < 0 ? '−' : ''}${rp(totals.nonTunai)}`}</span>
                </div>
            </div>

            {/* Tab */}
            <div className="kb-tabs" role="tablist">
                {[['all', 'Semua', ''], ['IN', 'Masuk', 'in'], ['OUT', 'Keluar', 'out']].map(([k, l, c]) => (
                    <button key={k} type="button" role="tab" aria-selected={tab === k} className={`kb-tab ${tab === k ? 'on' : ''} ${c}`} onClick={() => setTab(k)}>{l}</button>
                ))}
            </div>

            {/* Daftar */}
            {loading ? null : groups.length === 0 ? (
                <div className="kb-empty">
                    <i className="bi bi-wallet2"></i>
                    <b>Belum ada catatan kas</b>
                    <p>Ketuk tombol + untuk mencatat pengeluaran atau uang masuk.</p>
                </div>
            ) : (
                groups.map((g) => {
                    const [h1, h2] = dayHeading(g.key);
                    return (
                        <div key={g.key}>
                            <div className="kb-gh">
                                <h6>{h1}{h2 && <span> · {h2}</span>}</h6>
                                <em>{g.net < 0 ? '−' : g.net > 0 ? '+' : ''}{rp(g.net)}</em>
                            </div>
                            <div className="kb-card">
                                {g.rows.map((e) => {
                                    const meta = catMeta(e);
                                    const dir = e.type === 'IN' ? 'in' : 'out';
                                    const isOrder = e.source === 'ORDER';
                                    const title = isOrder ? `Order ${e.title}` : meta.label;
                                    const sub = [methodLabel(e.method), timeOf(e.createdAt), e.note].filter(Boolean).join(' · ');
                                    const canOpen = isOrder || isOwner;
                                    const inner = (
                                        <>
                                            <span className={`kb-ic ${dir}`}><i className={`bi ${meta.icon}`}></i></span>
                                            <span className="kb-mid">
                                                <span className="kb-t">{title}</span>
                                                <span className="kb-s">{sub}</span>
                                            </span>
                                            <span className={`kb-amt ${dir}`}>{e.type === 'IN' ? '+' : '−'}{rp(e.amount)}</span>
                                        </>
                                    );
                                    return canOpen ? (
                                        <button
                                            key={e.uuid}
                                            type="button"
                                            className="kb-row"
                                            onClick={() => (isOrder ? navigate(`/order/${e.orderId}`) : openEdit(e))}
                                        >
                                            {inner}
                                        </button>
                                    ) : (
                                        <div key={e.uuid} className="kb-row">{inner}</div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })
            )}

            {/* Tombol tambah */}
            {!sheet && (
                <button type="button" className="kb-fab" onClick={() => openAdd('OUT')} aria-label="Catat kas">
                    <i className="bi bi-plus-lg"></i> Catat
                </button>
            )}

            {/* Panel catat kas: menempel di bawah (gaya sama dengan floating Bayar di Transaksi); pegangan / tombol ⤢ untuk mini */}
            {sheet && (
                <div className="kb-dock">
                    <div className="kb-panel" role="dialog" aria-label={sheet.mode === 'edit' ? 'Ubah catatan kas' : 'Catat kas'}>
                        <div
                            className="kb-grab"
                            onClick={() => setIsMini((v) => !v)}
                            title={isMini ? 'Ketuk untuk perbesar' : 'Ketuk untuk perkecil'}
                        ></div>

                        <div className="kb-head">
                            <div className="kb-who">
                                <span className="av"><i className="bi bi-journal-text"></i></span>
                                <b>{sheet.mode === 'edit' ? 'Ubah Catatan Kas' : 'Catat Kas'}</b>
                            </div>
                            <div className="kb-hb">
                                <button type="button" className="kb-circ" onClick={() => setIsMini((v) => !v)} aria-label={isMini ? 'Perbesar' : 'Perkecil'} title={isMini ? 'Perbesar' : 'Perkecil'}>
                                    <i className={`bi ${isMini ? 'bi-arrows-angle-expand' : 'bi-arrows-angle-contract'}`}></i>
                                </button>
                                <button type="button" className="kb-circ" onClick={closeSheet} aria-label="Tutup" title="Tutup">
                                    <i className="bi bi-x-lg"></i>
                                </button>
                            </div>
                        </div>

                        <div className="kb-seg">
                            <button type="button" className={fType === 'OUT' ? 'on out' : ''} onClick={() => switchType('OUT')}>
                                <i className="bi bi-arrow-up-right"></i> Uang Keluar
                            </button>
                            <button type="button" className={fType === 'IN' ? 'on in' : ''} onClick={() => switchType('IN')}>
                                <i className="bi bi-arrow-down-left"></i> Uang Masuk
                            </button>
                        </div>

                        {isMini ? (
                            <>
                                {/* Versi PENDEK: nominal + Simpan; kategori & metode tetap pilihan terakhir */}
                                <div className="kb-mini">
                                    <div className="kb-field">
                                        <span>Rp</span>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            placeholder="0"
                                            aria-label="Nominal"
                                            value={amountNum ? amountNum.toLocaleString('id-ID') : ''}
                                            onChange={(e) => setFAmount(e.target.value)}
                                            onFocus={(e) => e.target.select()}
                                        />
                                    </div>
                                    <button type="button" className="kb-save" disabled={amountNum <= 0 || saving} onClick={handleSave}>
                                        <i className="bi bi-check2-circle"></i> Simpan
                                    </button>
                                </div>
                                <div className="kb-hint">
                                    {(CATS[fType].find((c) => c.key === fCat)?.short || CATS[fType].find((c) => c.key === fCat)?.label)} · {methodLabel(fMethod)} · ketuk ⤢ untuk mengubah
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="kb-banner" style={{ marginTop: 8 }}>
                                    <span>Nominal</span>
                                    <div className="amt">
                                        <i>Rp</i>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            autoFocus
                                            placeholder="0"
                                            aria-label="Nominal"
                                            value={amountNum ? amountNum.toLocaleString('id-ID') : ''}
                                            onChange={(e) => setFAmount(e.target.value)}
                                            onFocus={(e) => e.target.select()}
                                        />
                                        {amountNum > 0 && (
                                            <button type="button" className="clr" onClick={() => setFAmount('')} aria-label="Hapus nominal"><i className="bi bi-x-circle-fill"></i></button>
                                        )}
                                    </div>
                                </div>
                                <div className="kb-qrow" style={{ paddingTop: 0 }}>
                                    {quickVals.map((n) => (
                                        <button key={n} type="button" className="kb-q" onClick={() => setFAmount(String(amountNum + n))}>
                                            +{n >= 1000000 ? `${n / 1000000}jt` : `${n / 1000}rb`}
                                        </button>
                                    ))}
                                </div>

                                <div className="kb-sec">Kategori</div>
                                <div className="kb-grid">
                                    {CATS[fType].map((c) => (
                                        <button key={c.key} type="button" className={`kb-opt ${fCat === c.key ? 'on' : ''}`} onClick={() => setFCat(c.key)}>
                                            <i className={`bi ${c.icon}`}></i>
                                            <span>{c.short || c.label}</span>
                                        </button>
                                    ))}
                                </div>

                                <div className="kb-sec">{fType === 'IN' ? 'Diterima lewat' : 'Dibayar lewat'}</div>
                                <div className="kb-grid meth">
                                    {METHODS.map((m) => (
                                        <button key={m.key} type="button" className={`kb-opt ${fMethod === m.key ? 'on' : ''}`} onClick={() => setFMethod(m.key)}>
                                            <i className={`bi ${m.icon}`}></i>
                                            <span>{m.label}</span>
                                        </button>
                                    ))}
                                </div>

                                <div className="kb-two" style={{ marginTop: 8 }}>
                                    <input className="kb-in" placeholder="Catatan / nama barang (contoh: Deterjen)" value={fNote} onChange={(e) => setFNote(e.target.value)} maxLength={120} />
                                    <input className="kb-in d" type="date" value={fDate} max={localDate(new Date())} onChange={(e) => setFDate(e.target.value)} aria-label="Tanggal" />
                                </div>

                                <div className="kb-act">
                                    {sheet.mode === 'edit' && (
                                        <button type="button" className="kb-del" onClick={handleDelete}>{confirmDel ? 'Yakin hapus?' : 'Hapus'}</button>
                                    )}
                                    <button type="button" className="kb-save two" disabled={amountNum <= 0 || saving} onClick={handleSave}>
                                        <i className="bi bi-check2-circle"></i>
                                        <span className="t">
                                            <span>{sheet.mode === 'edit' ? 'Simpan perubahan' : 'Simpan'}</span>
                                            <small>Saldo jadi {saldoSetelah < 0 ? '−' : ''}{rp(saldoSetelah)}</small>
                                        </span>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
            {/* Popup Dialog Update Stok Otomatis saat Pengeluaran Kas Mirip Stok Aktif */}
            {stockPrompt && stockPrompt.open && (
                <div className="kb-dock" style={{ zIndex: 1060, pointerEvents: 'auto' }}>
                    <div className="kb-panel" role="dialog" aria-label="Update Stok Barang">
                        <div className="kb-head" style={{ marginBottom: 8 }}>
                            <div className="kb-who">
                                <span className="av" style={{ background: '#e0f2fe', color: '#0284c7' }}>
                                    <i className="bi bi-box-seam"></i>
                                </span>
                                <div>
                                    <b style={{ fontSize: '0.92rem' }}>Update Stok Barang?</b>
                                    <small style={{ display: 'block', fontSize: '0.68rem', color: '#64748b' }}>
                                        Ditemukan stok aktif yang cocok dengan pengeluaran
                                    </small>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="kb-circ"
                                onClick={() => setStockPrompt(null)}
                                aria-label="Tutup popup update stok"
                            >
                                <i className="bi bi-x-lg"></i>
                            </button>
                        </div>

                        <div style={{ background: '#f8fafc', borderRadius: 12, padding: '8px 12px', marginBottom: 12, border: '1px solid #e2e8f0', fontSize: '0.76rem', color: '#334155' }}>
                            Catatan pengeluaran: <b style={{ color: '#0f172a' }}>"{stockPrompt.note}"</b>
                        </div>

                        <div className="kb-sec" style={{ marginTop: 4, marginBottom: 8 }}>Pilih Stok Aktif yang Ingin Diupdate</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                            {stockPrompt.matchedItems.map((item) => {
                                const isSelected = String(item.id || item.uuid) === String(stockPrompt.selectedId);
                                return (
                                    <div
                                        key={item.id || item.uuid}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => setStockPrompt({ ...stockPrompt, selectedId: item.id || item.uuid })}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                setStockPrompt({ ...stockPrompt, selectedId: item.id || item.uuid });
                                            }
                                        }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '10px 12px',
                                            borderRadius: 12,
                                            border: `1.5px solid ${isSelected ? '#0d5afd' : '#e2e8f0'}`,
                                            background: isSelected ? '#eff6ff' : '#ffffff',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease',
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <i className={`bi ${isSelected ? 'bi-check-circle-fill text-primary' : 'bi-circle text-muted'}`} style={{ fontSize: '1.1rem' }}></i>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: '0.84rem', color: isSelected ? '#0d5afd' : '#1e293b' }}>
                                                    {item.nama}
                                                </div>
                                                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                                    Sisa stok: <b>{item.stok ?? 0} {item.unit || 'pcs'}</b>
                                                </div>
                                            </div>
                                        </div>
                                        <span className="badge rounded-pill" style={{ background: isSelected ? '#dbeafe' : '#f1f5f9', color: isSelected ? '#1d4ed8' : '#64748b', fontSize: '0.68rem', padding: '4px 8px' }}>
                                            Aktif
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="kb-sec" style={{ marginBottom: 8 }}>Jumlah yang Ditambahkan</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                            <button
                                type="button"
                                style={{ width: 38, height: 38, borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                onClick={() => setStockPrompt({ ...stockPrompt, qty: Math.max(1, (Number(stockPrompt.qty) || 1) - 1) })}
                                aria-label="Kurangi jumlah"
                            >
                                <i className="bi bi-dash"></i>
                            </button>
                            <input
                                type="number"
                                min="1"
                                style={{ flex: 1, height: 38, textAlign: 'center', fontWeight: 700, fontSize: '1rem', border: '1.5px solid #cbd5e1', borderRadius: 10, outline: 'none' }}
                                value={stockPrompt.qty}
                                onChange={(e) => setStockPrompt({ ...stockPrompt, qty: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                                aria-label="Jumlah stok"
                            />
                            <button
                                type="button"
                                style={{ width: 38, height: 38, borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                onClick={() => setStockPrompt({ ...stockPrompt, qty: (Number(stockPrompt.qty) || 1) + 1 })}
                                aria-label="Tambah jumlah"
                            >
                                <i className="bi bi-plus"></i>
                            </button>
                        </div>

                        <div style={{ display: 'flex', gap: 8 }}>
                            <button
                                type="button"
                                style={{ flex: 1, height: 42, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontWeight: 700, fontSize: '0.82rem' }}
                                onClick={() => setStockPrompt(null)}
                            >
                                Tidak, Lewati
                            </button>
                            <button
                                type="button"
                                style={{ flex: 1.5, height: 42, borderRadius: 12, border: 'none', background: '#0d5afd', color: '#fff', fontWeight: 700, fontSize: '0.86rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                                disabled={updatingStock}
                                onClick={handleConfirmStockUpdate}
                            >
                                <i className="bi bi-plus-circle"></i> Tambah Stok (+{stockPrompt.qty})
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
