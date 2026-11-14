import { useEffect } from 'react';
import { Link } from 'react-router-dom';

/* ==========================================================================
   AuthShell - kerangka tampilan bersama untuk halaman Login & Register.
   Letakkan di: src/components/auth/AuthShell.jsx
   - Desktop  : layar terbelah (panel brand biru di kiri, form di kanan)
   - Mobile   : header brand biru melengkung + kartu form yang "naik" menimpa header
   Semua gaya di-scope dengan prefix .au- agar tidak bentrok dengan Bootstrap/Affan.
   ========================================================================== */

export const AUTH_CSS = `
.au-root {
  --au-primary: #0d5afd; --au-deep: #0134d4; --au-ink: #1f0757; --au-body: #5f5a86;
  --au-line: #e1e6fa; --au-soft: #f4f6ff; --au-green: #12b76a; --au-red: #e5484d;
  position: fixed; inset: 0; z-index: 1050; overflow-y: auto; overflow-x: hidden;
  display: grid; grid-template-columns: 1fr; grid-auto-rows: max-content; align-content: start;
  background: linear-gradient(180deg, #eef2ff 0%, #f8f9ff 100%);
  font-family: 'Poppins', system-ui, -apple-system, 'Segoe UI', sans-serif; color: var(--au-ink);
  -webkit-font-smoothing: antialiased;
}
.au-root *, .au-root *::before, .au-root *::after { box-sizing: border-box; }
.au-root h1, .au-root h2, .au-root h3, .au-root h4, .au-root h5, .au-root h6 { color: var(--au-ink); font-family: inherit; margin: 0; }
.au-root p { margin: 0; color: var(--au-body); font-size: .9rem; line-height: 1.6; }
.au-root a { text-decoration: none; }
.au-root button { font-family: inherit; }

/* ---------- Panel brand (desktop) ---------- */
.au-side { display: none; }
.au-brand { display: inline-flex; align-items: center; gap: 10px; font-weight: 700; font-size: 1.2rem; letter-spacing: -.02em; color: #fff; }
.au-brand:hover { color: #fff; }
.au-brand-mark {
  width: 42px; height: 42px; border-radius: 13px; display: inline-flex; align-items: center; justify-content: center;
  background: #fff; color: var(--au-deep); font-size: 1.15rem; box-shadow: 0 10px 22px -10px rgba(0, 0, 0, .45);
}
.au-brand b { font-weight: 700; opacity: .85; }

/* ---------- Header brand (mobile) ---------- */
.au-band {
  position: relative; overflow: hidden; text-align: center; padding: 30px 20px 92px;
  background: radial-gradient(420px 220px at 100% 0%, rgba(255,255,255,.22) 0%, rgba(255,255,255,0) 70%),
              linear-gradient(135deg, #0134d4 0%, #0d5afd 100%);
  border-radius: 0 0 36px 36px;
}
.au-band::before {
  content: ''; position: absolute; inset: 0; pointer-events: none; opacity: .5;
  background-image: radial-gradient(rgba(255,255,255,.28) 1px, transparent 1.2px); background-size: 22px 22px;
  -webkit-mask-image: linear-gradient(180deg, #000, transparent 90%); mask-image: linear-gradient(180deg, #000, transparent 90%);
}
.au-band > * { position: relative; }
.au-band p { color: rgba(255,255,255,.85); font-size: .8rem; margin-top: 8px; }

/* ---------- Area form ---------- */
.au-main { display: flex; justify-content: center; align-items: flex-start; padding: 0 16px 36px; margin-top: -58px; position: relative; z-index: 2; }
.au-card {
  width: 100%; max-width: 460px; background: #fff; border: 1px solid var(--au-line); border-radius: 28px; padding: 26px 22px 22px;
  box-shadow: 0 30px 60px -34px rgba(31, 7, 87, .35), 0 8px 20px -14px rgba(13, 90, 253, .25);
  animation: au-rise .6s cubic-bezier(.16, 1, .3, 1) both;
}
@media (min-width: 992px) {
  .au-root { grid-template-columns: minmax(420px, 44%) 1fr; }
  .au-band { display: none; }
  .au-side {
    display: flex; flex-direction: column; justify-content: space-between; position: sticky; top: 0; height: 100vh; padding: 44px 48px; color: #fff; overflow: hidden;
    background: radial-gradient(520px 320px at 100% 0%, rgba(255,255,255,.2) 0%, rgba(255,255,255,0) 70%),
                radial-gradient(460px 300px at 0% 100%, rgba(120,140,255,.55) 0%, rgba(120,140,255,0) 70%),
                linear-gradient(150deg, #0134d4 0%, #0d5afd 100%);
  }
  .au-side::before {
    content: ''; position: absolute; inset: 0; pointer-events: none; opacity: .55;
    background-image: radial-gradient(rgba(255,255,255,.26) 1px, transparent 1.2px); background-size: 24px 24px;
    -webkit-mask-image: linear-gradient(180deg, #000, transparent 85%); mask-image: linear-gradient(180deg, #000, transparent 85%);
  }
  .au-side > * { position: relative; }
  .au-main { margin-top: 0; min-height: 100vh; align-items: center; padding: 40px 32px; }
  .au-card { padding: 34px 32px 26px; }
}
.au-side h2 { color: #fff; font-size: clamp(1.9rem, 2.8vw, 2.6rem); font-weight: 800; line-height: 1.15; letter-spacing: -.03em; max-width: 440px; }
.au-side .au-lead { color: rgba(255,255,255,.88); margin-top: 16px; font-size: 1rem; max-width: 420px; }
.au-feats { list-style: none; margin: 30px 0 0; padding: 0; display: flex; flex-direction: column; gap: 16px; }
.au-feats li { display: flex; align-items: center; gap: 14px; color: #fff; font-weight: 500; font-size: .95rem; }
.au-feats li i { flex: none; width: 40px; height: 40px; border-radius: 13px; display: inline-flex; align-items: center; justify-content: center; background: rgba(255,255,255,.18); border: 1px solid rgba(255,255,255,.3); font-size: 1.05rem; }
.au-glass {
  align-self: flex-start; display: flex; align-items: center; gap: 12px; padding: 14px 18px 14px 14px; border-radius: 20px;
  background: rgba(255,255,255,.16); border: 1px solid rgba(255,255,255,.35); backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px); animation: au-bob 6s ease-in-out infinite;
}
.au-glass i { width: 40px; height: 40px; border-radius: 13px; background: #fff; color: var(--au-green); display: inline-flex; align-items: center; justify-content: center; font-size: 1.2rem; }
.au-glass b { display: block; font-size: .9rem; font-weight: 700; color: #fff; }
.au-glass span { display: block; font-size: .75rem; color: rgba(255,255,255,.85); }

/* ---------- Kepala kartu ---------- */
.au-head { text-align: center; margin-bottom: 22px; }
.au-logo {
  width: 60px; height: 60px; margin: 0 auto 12px; border-radius: 18px; display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 1.7rem; font-weight: 800; background: linear-gradient(135deg, #0134d4 0%, #0d5afd 100%);
  box-shadow: 0 14px 26px -12px rgba(13, 90, 253, .8);
}
.au-title { font-size: 1.35rem; font-weight: 800; letter-spacing: -.02em; line-height: 1.25; }
.au-sub { margin-top: 6px !important; font-size: .84rem !important; }
.au-store-name { font-size: 1.15rem; font-weight: 800; letter-spacing: .02em; color: var(--au-deep); text-transform: uppercase; }

/* ---------- Form ---------- */
.au-sec { display: flex; align-items: center; gap: 10px; margin: 4px 0 14px; font-size: .72rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--au-primary); }
.au-sec::after { content: ''; flex: 1; height: 1px; background: var(--au-line); }
.au-field { margin-bottom: 16px; }
.au-label { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 7px; font-size: .78rem; font-weight: 600; color: var(--au-ink); }
.au-label .req { color: var(--au-red); margin-left: 2px; }
.au-label button, .au-label a.au-link { background: none; border: 0; padding: 0; font-size: .76rem; font-weight: 600; color: var(--au-primary); cursor: pointer; }
.au-ctl { position: relative; display: flex; align-items: stretch; }
.au-ctl > .au-ico { position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: #8a92b8; font-size: 1rem; pointer-events: none; }
.au-input {
  width: 100%; height: 48px; padding: 0 14px 0 44px; border-radius: 14px; border: 1.5px solid var(--au-line); background: #fafbff;
  font-family: inherit; font-size: .92rem; color: var(--au-ink); outline: none; transition: border-color .2s, box-shadow .2s, background-color .2s;
}
.au-input::placeholder { color: #a3a9c9; }
.au-input:hover { border-color: #cbd5fb; }
.au-input:focus { border-color: var(--au-primary); background: #fff; box-shadow: 0 0 0 4px rgba(13, 90, 253, .12); }
.au-input.noico { padding-left: 14px; }
.au-input.has-eye { padding-right: 52px; }
.au-input.code::placeholder { text-transform: none; letter-spacing: 0; font-weight: 400; font-size: .85rem; }
.au-input.code { font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--au-deep); }
.au-prefix { display: inline-flex; align-items: center; padding: 0 14px; border: 1.5px solid var(--au-line); border-right: 0; border-radius: 14px 0 0 14px; background: var(--au-soft); font-size: .86rem; font-weight: 700; color: var(--au-body); }
.au-ctl.with-prefix .au-input { padding-left: 14px; border-radius: 0 14px 14px 0; }
.au-eye { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); width: 38px; height: 38px; border: 0; border-radius: 11px; background: transparent; color: #8a92b8; font-size: 1.05rem; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
.au-eye:hover { background: var(--au-soft); color: var(--au-primary); }
.au-hint { margin-top: 6px !important; font-size: .72rem !important; color: #7d84ab !important; line-height: 1.5 !important; display: flex; gap: 6px; align-items: flex-start; }
.au-hint i { color: var(--au-primary); margin-top: 2px; }

.au-alert { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: 14px; margin-bottom: 16px; font-size: .82rem; line-height: 1.5; }
.au-alert i { flex: none; font-size: 1.05rem; margin-top: 1px; }
.au-alert.err { background: #fff1f2; border: 1px solid #ffd5d9; color: #b42318; }
.au-alert.info { background: #eef4ff; border: 1px solid #d4e1ff; color: #0134d4; }
.au-alert.info strong { color: var(--au-ink); font-weight: 600; }

.au-rules { margin: -4px 0 16px; padding: 12px 14px; border-radius: 14px; background: var(--au-soft); border: 1px solid var(--au-line); }
.au-rules-t { font-size: .72rem; font-weight: 600; color: var(--au-ink); margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
.au-bar { display: flex; gap: 4px; margin-bottom: 10px; }
.au-bar i { flex: 1; height: 5px; border-radius: 3px; background: #dde3fa; transition: background-color .25s; }
.au-bar i.on { background: var(--au-green); }
.au-rule-list { display: flex; flex-wrap: wrap; gap: 6px 14px; }
.au-rule { display: inline-flex; align-items: center; gap: 6px; font-size: .72rem; color: #7d84ab; font-weight: 500; }
.au-rule i { font-size: .85rem; }
.au-rule.ok { color: #0e8f55; font-weight: 600; }
.au-rule.bad { color: var(--au-red); font-weight: 600; }

/* ---------- Tombol ---------- */
.au-btn {
  width: 100%; height: 50px; display: inline-flex; align-items: center; justify-content: center; gap: 9px; border: 1px solid transparent; border-radius: 14px;
  font-size: .95rem; font-weight: 700; cursor: pointer; transition: transform .2s, box-shadow .2s, opacity .2s; text-decoration: none;
}
.au-btn:hover:not(:disabled) { transform: translateY(-2px); }
.au-btn:disabled { opacity: .7; cursor: not-allowed; }
.au-btn-primary { color: #fff; background: linear-gradient(135deg, #0134d4 0%, #0d5afd 100%); box-shadow: 0 14px 26px -12px rgba(13, 90, 253, .8); }
.au-btn-primary:hover { color: #fff; }
.au-btn-wa { color: #fff; background: linear-gradient(135deg, #12b76a 0%, #059669 100%); box-shadow: 0 14px 26px -14px rgba(18, 183, 106, .8); }
.au-btn-wa:hover { color: #fff; }
.au-btn-ghost { color: var(--au-ink); background: #fff; border-color: var(--au-line); }
.au-btn-ghost:hover { color: var(--au-primary); border-color: #c9d6ff; }
.au-btn-sm { height: 42px; font-size: .86rem; }
.au-spin { width: 16px; height: 16px; border-radius: 50%; border: 2.5px solid rgba(255,255,255,.4); border-top-color: #fff; animation: au-spin .7s linear infinite; display: inline-block; }
.au-foot { margin-top: 20px; text-align: center; font-size: .84rem; color: var(--au-body); }
.au-foot a { font-weight: 700; color: var(--au-primary); }
.au-back { display: block; margin: 16px auto 0; text-align: center; font-size: .78rem; color: #8a92b8; }
.au-back:hover { color: var(--au-primary); }

/* ---------- Kartu info toko ---------- */
.au-store { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 11px 12px 11px 14px; margin-bottom: 16px; border-radius: 16px; background: #eef4ff; border: 1px solid #d4e1ff; }
.au-store-l { display: flex; align-items: center; gap: 10px; min-width: 0; }
.au-store-l > i { flex: none; width: 34px; height: 34px; border-radius: 11px; background: #fff; color: var(--au-primary); display: inline-flex; align-items: center; justify-content: center; font-size: 1.05rem; }
.au-store-l b { display: block; font-size: .84rem; font-weight: 700; color: var(--au-deep); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.au-store-l small { display: block; font-size: .68rem; color: #6b74a6; }
.au-chip { flex: none; display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 13px; border: 0; border-radius: 999px; background: var(--au-deep); color: #fff; font-size: .74rem; font-weight: 700; cursor: pointer; font-family: inherit; }
.au-chip.static { cursor: default; letter-spacing: .04em; }

/* ---------- Sukses ---------- */
.au-ok-ico { width: 78px; height: 78px; margin: 0 auto 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: #e7f8ef; color: var(--au-green); font-size: 2.6rem; box-shadow: 0 0 0 10px #f1fcf6; animation: au-pop .5s cubic-bezier(.34, 1.56, .64, 1) both; }
.au-summary { margin: 18px 0; padding: 4px 16px; border-radius: 18px; background: var(--au-soft); border: 1px solid var(--au-line); text-align: left; }
.au-summary div { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 11px 0; border-bottom: 1px dashed var(--au-line); font-size: .84rem; }
.au-summary div:last-child { border-bottom: 0; }
.au-summary span { color: var(--au-body); }
.au-summary b { color: var(--au-ink); font-weight: 700; }
.au-summary b.code { padding: 4px 12px; border-radius: 999px; background: var(--au-deep); color: #fff; letter-spacing: .08em; }
.au-wa-box { display: flex; gap: 12px; align-items: flex-start; padding: 14px; border-radius: 16px; background: #f0fdf6; border: 1px solid #c4ecd7; text-align: left; margin-bottom: 16px; }
.au-wa-box > i { flex: none; width: 38px; height: 38px; border-radius: 12px; background: var(--au-green); color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 1.15rem; }
.au-wa-box b { display: block; font-size: .86rem; font-weight: 700; color: #0e7a49; }
.au-wa-box p { font-size: .78rem; margin-top: 2px; }
.au-stack { display: flex; flex-direction: column; gap: 10px; }

/* ---------- Pill install & modal ---------- */
.au-toast { position: fixed; bottom: 16px; left: 0; right: 0; z-index: 1060; display: flex; justify-content: center; padding: 0 16px; pointer-events: none; }
.au-toast-in { pointer-events: auto; display: flex; align-items: center; gap: 6px; padding: 5px 6px 5px 5px; border-radius: 999px; background: rgba(255,255,255,.95); backdrop-filter: blur(10px); border: 1px solid #d4e1ff; box-shadow: 0 14px 30px -12px rgba(1, 52, 212, .4); }
.au-toast-in .au-chip { height: 36px; }
.au-x { width: 32px; height: 32px; border: 0; border-radius: 50%; background: var(--au-soft); color: var(--au-body); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; font-size: .9rem; }
.au-x:hover { color: var(--au-primary); }
.au-overlay { position: fixed; inset: 0; z-index: 1080; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(31, 7, 87, .5); backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px); animation: au-fade .2s ease-out; }
.au-modal { position: relative; width: 100%; max-width: 400px; max-height: 92vh; overflow-y: auto; padding: 26px 22px 22px; border-radius: 28px; background: #fff; box-shadow: 0 40px 80px -30px rgba(0, 0, 0, .5); animation: au-rise .35s cubic-bezier(.16, 1, .3, 1) both; text-align: center; }
.au-modal .au-x { position: absolute; top: 14px; right: 14px; }
.au-modal .au-ico-lg { width: 66px; height: 66px; margin: 0 auto 14px; border-radius: 20px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 1.9rem; background: linear-gradient(135deg, #0134d4, #0d5afd); box-shadow: 0 16px 28px -14px rgba(13, 90, 253, .8); }
.au-badge { display: inline-block; padding: 5px 12px; border-radius: 999px; background: #e9f0ff; color: var(--au-primary); font-size: .7rem; font-weight: 700; margin-bottom: 10px; }
.au-modal h5 { font-size: 1.1rem; font-weight: 800; letter-spacing: -.02em; }
.au-modal p { font-size: .8rem; margin-top: 6px; }
.au-modal .au-field { text-align: left; }
.au-modal .au-stack { margin-top: 16px; }
.au-manual { margin-top: 12px; padding: 10px 12px; border-radius: 12px; background: #eef4ff; color: #1a3fa8; font-size: .74rem; line-height: 1.5; text-align: left; }
.au-m-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; text-align: left; }
.au-m-head .au-ico-sm { width: 38px; height: 38px; border-radius: 12px; background: linear-gradient(135deg, #0134d4, #0d5afd); color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 1rem; }
.au-m-head h5 { font-size: 1rem; }

@keyframes au-rise { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }
@keyframes au-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes au-pop { from { opacity: 0; transform: scale(.4); } to { opacity: 1; transform: none; } }
@keyframes au-spin { to { transform: rotate(360deg); } }
@keyframes au-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
@media (prefers-reduced-motion: reduce) { .au-root *, .au-root *::before, .au-root *::after { animation: none !important; transition: none !important; } }
`;

const FEATURES = [
  { icon: 'bi-whatsapp', text: 'Nota otomatis terkirim ke WhatsApp pelanggan' },
  { icon: 'bi-printer-fill', text: 'Cetak struk thermal bluetooth 58mm' },
  { icon: 'bi-cloud-check-fill', text: 'Offline-first, data tersinkron otomatis' },
];

const AuthShell = ({ children, overlays = null, headline = 'Kelola usaha laundry jadi lebih cepat & rapi.', lead = 'Satu aplikasi untuk kasir, nota WhatsApp, dan laporan keuangan toko Anda.' }) => {
  useEffect(() => {
    // Poppins = font tema Affan. Dipasang jika belum ada.
    if (!document.getElementById('lp-poppins')) {
      const link = document.createElement('link');
      link.id = 'lp-poppins';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  return (
    <div className="au-root">
      <style>{AUTH_CSS}</style>

      {/* Panel brand - desktop */}
      <aside className="au-side" aria-hidden="false">
        <Link to="/" className="au-brand">
          <span className="au-brand-mark"><i className="bi bi-shop"></i></span>
          <span>Toko<b>Plus</b></span>
        </Link>

        <div>
          <h2>{headline}</h2>
          <p className="au-lead">{lead}</p>
          <ul className="au-feats">
            {FEATURES.map((f) => (
              <li key={f.text}><i className={`bi ${f.icon}`}></i><span>{f.text}</span></li>
            ))}
          </ul>
        </div>

        <div className="au-glass">
          <i className="bi bi-gift-fill"></i>
          <div>
            <b>Trial 30 Hari Penuh</b>
            <span>Coba semua fitur tanpa kartu kredit</span>
          </div>
        </div>
      </aside>

      {/* Header brand - mobile */}
      <div className="au-band">
        <Link to="/" className="au-brand">
          <span className="au-brand-mark"><i className="bi bi-shop"></i></span>
          <span>Toko<b>Plus</b></span>
        </Link>
        <p>Kasir laundry cepat, rapi &amp; siap pakai</p>
      </div>

      <main className="au-main">
        <div className="au-card">{children}</div>
      </main>

      {overlays}
    </div>
  );
};

export default AuthShell;
