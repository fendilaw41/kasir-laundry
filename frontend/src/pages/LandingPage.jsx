import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

/* ==========================================================================
   LANDING PAGE - tema terang (biru #0d5afd, ink #1f0757)
   Semua gaya ada di blok CSS di bawah (prefix .lp-) supaya tidak bentrok
   dengan Bootstrap. Navbar memakai position: fixed (bukan sticky)
   agar tetap bekerja walau html/body punya overflow-x tersembunyi.
   ========================================================================== */

const LP_CSS = `
html { scroll-behavior: smooth; scroll-padding-top: 84px; }

.lp-root {
  --lp-primary: #0d5afd;
  --lp-deep: #0134d4;
  --lp-ink: #1f0757;
  --lp-body: #5f5a86;
  --lp-line: #e4e8fb;
  --lp-soft: #f4f6ff;
  --lp-green: #12b76a;
  font-family: 'Poppins', system-ui, -apple-system, 'Segoe UI', sans-serif;
  color: var(--lp-ink);
  background: #ffffff;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
.lp-root *, .lp-root *::before, .lp-root *::after { box-sizing: border-box; }
.lp-root h1, .lp-root h2, .lp-root h3, .lp-root h4 { color: var(--lp-ink); font-family: inherit; margin: 0; }
.lp-root p { font-size: 1rem; color: var(--lp-body); line-height: 1.7; margin: 0; }
.lp-root a { text-decoration: none; }
.lp-root a:focus-visible, .lp-root button:focus-visible {
  outline: 3px solid rgba(13, 90, 253, .35); outline-offset: 2px; border-radius: 12px;
}
.lp-wrap { width: 100%; max-width: 1200px; margin: 0 auto; padding: 0 20px; }

/* ---------- Tombol ---------- */
.lp-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  height: 50px; padding: 0 26px; border-radius: 999px; border: 1px solid transparent;
  font-family: inherit; font-size: .95rem; font-weight: 600; line-height: 1; white-space: nowrap; cursor: pointer;
  transition: transform .2s ease, box-shadow .2s ease, background-color .2s ease, border-color .2s ease;
}
.lp-btn:hover { transform: translateY(-2px); }
.lp-btn-primary {
  color: #fff; background: linear-gradient(135deg, #0134d4 0%, #0d5afd 100%);
  box-shadow: 0 12px 26px -10px rgba(13, 90, 253, .75);
}
.lp-btn-primary:hover { color: #fff; box-shadow: 0 16px 30px -10px rgba(13, 90, 253, .85); }
.lp-btn-ghost { color: var(--lp-ink); background: #fff; border-color: var(--lp-line); box-shadow: 0 6px 18px -10px rgba(31, 7, 87, .25); }
.lp-btn-ghost:hover { color: var(--lp-primary); border-color: #c9d6ff; }
.lp-btn-light { color: var(--lp-deep); background: #fff; box-shadow: 0 14px 30px -12px rgba(0, 0, 0, .35); }
.lp-btn-light:hover { color: var(--lp-deep); }
.lp-btn-outline-light { color: #fff; background: rgba(255,255,255,.12); border-color: rgba(255,255,255,.45); }
.lp-btn-outline-light:hover { color: #fff; background: rgba(255,255,255,.2); }
.lp-btn-sm { height: 42px; padding: 0 20px; font-size: .86rem; }

/* ---------- Navbar ---------- */
.lp-nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 1030;
  background: rgba(255, 255, 255, .82);
  -webkit-backdrop-filter: saturate(180%) blur(14px); backdrop-filter: saturate(180%) blur(14px);
  border-bottom: 1px solid rgba(228, 232, 251, .9);
}
.lp-nav-in { display: flex; align-items: center; justify-content: space-between; height: 68px; }
.lp-brand { display: inline-flex; align-items: center; gap: 10px; color: var(--lp-ink); font-weight: 700; font-size: 1.12rem; letter-spacing: -.02em; }
.lp-brand:hover { color: var(--lp-ink); }
.lp-brand-mark {
  width: 40px; height: 40px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center;
  color: #fff; font-size: 1.1rem; background: linear-gradient(135deg, #0134d4 0%, #0d5afd 100%);
  box-shadow: 0 8px 18px -8px rgba(13, 90, 253, .8);
}
.lp-brand b { color: var(--lp-primary); font-weight: 700; }
.lp-nav-links { display: none; align-items: center; gap: 6px; }
.lp-nav-links a {
  padding: 8px 14px; border-radius: 999px; font-size: .9rem; font-weight: 500; color: var(--lp-body);
  transition: color .2s ease, background-color .2s ease;
}
.lp-nav-links a:hover { color: var(--lp-primary); background: var(--lp-soft); }
.lp-nav-cta { display: none; align-items: center; gap: 8px; }
.lp-burger {
  width: 44px; height: 44px; border-radius: 12px; border: 1px solid var(--lp-line); background: #fff; color: var(--lp-ink);
  display: inline-flex; align-items: center; justify-content: center; font-size: 1.3rem; cursor: pointer;
}
.lp-sheet { padding: 8px 0 18px; border-top: 1px solid var(--lp-line); animation: lp-drop .22s ease-out; }
.lp-sheet a.lp-sheet-link {
  display: flex; align-items: center; gap: 12px; padding: 13px 8px; color: var(--lp-ink); font-weight: 500; border-radius: 12px;
}
.lp-sheet a.lp-sheet-link i { color: var(--lp-primary); font-size: 1.1rem; }
.lp-sheet .lp-btn { width: 100%; margin-top: 8px; }
@media (min-width: 992px) {
  .lp-nav-links { display: flex; }
  .lp-nav-cta { display: flex; }
  .lp-burger { display: none; }
}

/* ---------- Hero ---------- */
.lp-hero {
  position: relative; overflow: hidden; padding: 124px 0 76px;
  background:
    radial-gradient(900px 480px at 88% -8%, #dbe6ff 0%, rgba(219, 230, 255, 0) 62%),
    radial-gradient(720px 440px at -6% 28%, #ebe5ff 0%, rgba(235, 229, 255, 0) 62%),
    linear-gradient(180deg, #f5f7ff 0%, #ffffff 100%);
}
.lp-hero::before {
  content: ''; position: absolute; inset: 0; pointer-events: none;
  background-image: radial-gradient(rgba(13, 90, 253, .16) 1px, transparent 1.2px);
  background-size: 24px 24px;
  -webkit-mask-image: linear-gradient(180deg, #000 0%, transparent 70%); mask-image: linear-gradient(180deg, #000 0%, transparent 70%);
}
.lp-hero-grid { position: relative; display: grid; grid-template-columns: 1fr; gap: 56px; align-items: center; }
.lp-hero-copy { text-align: center; }
.lp-badge {
  display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px 6px 6px; border-radius: 999px;
  background: #fff; border: 1px solid var(--lp-line); box-shadow: 0 8px 22px -12px rgba(13, 90, 253, .45);
  font-size: .78rem; font-weight: 600; color: var(--lp-ink);
}
.lp-badge i {
  width: 26px; height: 26px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #0134d4, #0d5afd); color: #fff; font-size: .8rem;
}
.lp-h1 {
  margin-top: 20px !important; font-size: clamp(2.15rem, 5.2vw, 3.75rem); font-weight: 800; line-height: 1.08; letter-spacing: -.028em;
}
.lp-grad {
  background: linear-gradient(100deg, #0134d4 0%, #0d5afd 48%, #6a5cff 100%);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent;
}
.lp-lead { margin-top: 20px !important; font-size: clamp(1rem, 1.5vw, 1.12rem) !important; max-width: 560px; margin-left: auto !important; margin-right: auto !important; }
.lp-lead strong { color: var(--lp-ink); font-weight: 600; }
.lp-cta { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin-top: 30px; }
.lp-trust { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px 22px; margin-top: 28px; }
.lp-trust span { display: inline-flex; align-items: center; gap: 8px; font-size: .86rem; font-weight: 500; color: var(--lp-body); }
.lp-trust i { color: var(--lp-green); font-size: 1rem; }

/* ---------- Mockup HP ---------- */
.lp-stage { position: relative; display: flex; justify-content: center; min-height: 600px; }
.lp-glow {
  position: absolute; top: 50%; left: 50%; width: 420px; height: 420px; transform: translate(-50%, -50%);
  background: radial-gradient(circle, rgba(13, 90, 253, .22) 0%, rgba(13, 90, 253, 0) 68%); filter: blur(30px);
}
.lp-phone {
  position: relative; z-index: 2; width: 288px; height: 590px; padding: 9px; border-radius: 46px;
  background: linear-gradient(160deg, #ffffff 0%, #e8edff 100%); border: 1px solid #d5ddfa;
  box-shadow: 0 50px 80px -30px rgba(31, 7, 87, .38), 0 18px 30px -18px rgba(13, 90, 253, .45), inset 0 0 0 1px rgba(255,255,255,.9);
  animation: lp-rise .8s cubic-bezier(.16, 1, .3, 1) both;
}
.lp-screen { position: relative; width: 100%; height: 100%; border-radius: 38px; overflow: hidden; background: #f1f2fb; }
.lp-notch { position: absolute; top: 9px; left: 50%; width: 78px; height: 22px; border-radius: 12px; background: #1f0757; transform: translateX(-50%); z-index: 3; }
.lp-app-top { display: flex; align-items: center; justify-content: space-between; padding: 40px 16px 10px; background: #fff; border-bottom: 1px solid #ebebeb; }
.lp-app-top b { font-size: 1.05rem; font-weight: 800; color: var(--lp-primary); letter-spacing: -.02em; }
.lp-app-bell { width: 30px; height: 30px; border-radius: 50%; border: 1px solid #e4e8fb; background: #f7f8ff; display: inline-flex; align-items: center; justify-content: center; color: var(--lp-primary); font-size: .8rem; position: relative; }
.lp-app-bell::after { content: ''; position: absolute; top: 5px; right: 6px; width: 7px; height: 7px; border-radius: 50%; background: #ef4444; border: 1.5px solid #f7f8ff; }
.lp-app-body { padding: 12px 12px 0; }
.lp-app-search { display: flex; gap: 6px; }
.lp-app-search > div { height: 30px; border-radius: 9px; border: 1px solid #dfe4f7; background: #fff; display: flex; align-items: center; gap: 6px; padding: 0 9px; font-size: .62rem; color: #8480ae; }
.lp-app-search > div:first-child { flex: 1; }
.lp-app-search > div:last-child { width: 78px; font-weight: 700; color: var(--lp-ink); justify-content: space-between; }
.lp-app-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
.lp-app-card { background: #fff; border: 1px solid #e4e8fb; border-radius: 13px; padding: 9px 9px 8px; display: flex; flex-direction: column; gap: 5px; }
.lp-app-card.on { border: 2px solid var(--lp-deep); padding: 8px 8px 7px; box-shadow: 0 6px 14px -8px rgba(1, 52, 212, .5); }
.lp-app-card .tag { align-self: flex-start; font-size: .46rem; font-weight: 800; letter-spacing: .3px; padding: 2px 6px; border-radius: 5px; }
.lp-app-card .nm { font-size: .66rem; font-weight: 700; color: var(--lp-ink); }
.lp-app-card .pr { font-size: .86rem; font-weight: 800; color: var(--lp-deep); }
.lp-app-card .st { display: flex; align-items: center; gap: 5px; font-size: .66rem; font-weight: 800; }
.lp-app-card .st i { width: 18px; height: 18px; border-radius: 50%; background: #f1f5f9; display: inline-flex; align-items: center; justify-content: center; font-size: .6rem; }
.lp-app-card .st i.pl { background: var(--lp-deep); color: #fff; }
.lp-app-card .hint { font-size: .55rem; color: #8480ae; }
.lp-app-dock {
  position: absolute; left: 10px; right: 10px; bottom: 10px; background: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0;
  box-shadow: 0 -8px 24px -6px rgba(15, 23, 42, .18); padding: 10px 12px 12px;
}
.lp-app-dock .grab { width: 32px; height: 4px; border-radius: 2px; background: #cbd5e1; margin: 0 auto 10px; }
.lp-app-dock .who { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.lp-app-dock .who-user { display: inline-flex; align-items: center; gap: 6px; font-size: .72rem; font-weight: 800; color: #0f172a; }
.lp-app-dock .who-user i { color: var(--lp-primary); font-size: .85rem; }
.lp-app-dock .who-badge { display: inline-flex; align-items: center; gap: 4px; font-size: .6rem; background: #dcfce7; color: #15803d; padding: 3px 8px; border-radius: 999px; font-weight: 800; }
.lp-app-dock .row { display: flex; gap: 8px; align-items: center; }
.lp-app-dock .b1 {
  flex: 1; height: 38px; border-radius: 19px; border: 1.5px solid var(--lp-primary); color: var(--lp-primary); background: #f8faff;
  display: flex; align-items: center; justify-content: center; gap: 6px; font-size: .68rem; font-weight: 800;
  letter-spacing: -.01em; white-space: nowrap;
}
.lp-app-dock .b2 {
  flex: 1.5; height: 38px; border-radius: 19px; background: linear-gradient(135deg, #0134d4, #0d5afd); color: #ffffff;
  display: flex; align-items: center; justify-content: center; gap: 6px; font-size: .7rem; font-weight: 800;
  letter-spacing: -.01em; white-space: nowrap; box-shadow: 0 4px 12px -2px rgba(1, 52, 212, .35);
}
.lp-app-dock .b2 i { font-size: .8rem; }

.lp-float {
  position: absolute; z-index: 3; display: none; align-items: center; gap: 10px; padding: 10px 16px 10px 10px; border-radius: 16px;
  background: rgba(255, 255, 255, .94); border: 1px solid var(--lp-line); backdrop-filter: blur(8px);
  box-shadow: 0 22px 40px -18px rgba(31, 7, 87, .35); font-size: .8rem; font-weight: 600; color: var(--lp-ink); white-space: nowrap;
  animation: lp-bob 5.5s ease-in-out infinite;
}
.lp-float i { width: 34px; height: 34px; border-radius: 11px; display: inline-flex; align-items: center; justify-content: center; font-size: 1rem; color: #fff; }
.lp-float small { display: block; font-size: .68rem; font-weight: 500; color: var(--lp-body); margin-top: 1px; }
.lp-float.f1 { top: 40px; right: -10px; animation-delay: -1s; }
.lp-float.f2 { bottom: 60px; left: 0; animation-delay: -3s; }
.lp-float.f3 { top: 230px; left: 0; animation-delay: -2s; }
.lp-orders {
  position: absolute; z-index: 1; display: none; right: -20px; bottom: 70px; width: 252px; padding: 14px; border-radius: 22px;
  background: #fff; border: 1px solid var(--lp-line); transform: rotate(4deg); box-shadow: 0 30px 50px -26px rgba(31, 7, 87, .35);
}
.lp-orders .o { padding: 10px 0; border-bottom: 1px dashed var(--lp-line); }
.lp-orders .o:last-child { border-bottom: 0; padding-bottom: 0; }
.lp-orders .o .t { display: flex; justify-content: space-between; font-size: .78rem; font-weight: 700; }
.lp-orders .o .t b { color: var(--lp-primary); font-weight: 700; }
.lp-orders .o .s { display: flex; justify-content: space-between; margin-top: 4px; font-size: .68rem; color: var(--lp-body); }
.lp-pill { padding: 2px 8px; border-radius: 999px; font-size: .62rem; font-weight: 700; }
@media (min-width: 640px) {
  .lp-float { display: inline-flex; }
  .lp-orders { display: block; }
  .lp-stage { min-width: 480px; }
}
@media (min-width: 992px) {
  .lp-hero { padding: 150px 0 96px; }
  .lp-hero-grid { grid-template-columns: 1.02fr .98fr; gap: 40px; }
  .lp-hero-copy { text-align: left; }
  .lp-stage { justify-content: flex-end; padding-right: 36px; }
  .lp-orders { right: -34px; bottom: 70px; }
  .lp-lead { margin-left: 0 !important; margin-right: 0 !important; }
  .lp-cta, .lp-trust { justify-content: flex-start; }
}
@media (max-width: 639px) {
  .lp-stage { min-height: 560px; }
  .lp-phone { transform: scale(.94); transform-origin: top center; }
}

/* ---------- Strip statistik ---------- */
.lp-strip { position: relative; z-index: 4; margin-top: -34px; }
.lp-strip-box {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 0; background: #fff; border: 1px solid var(--lp-line); border-radius: 24px;
  box-shadow: 0 28px 50px -30px rgba(31, 7, 87, .3); overflow: hidden;
}
.lp-strip-item { padding: 22px 20px; text-align: center; border-right: 1px solid var(--lp-line); border-bottom: 1px solid var(--lp-line); }
.lp-strip-item:nth-child(2n) { border-right: 0; }
.lp-strip-item:nth-last-child(-n+2) { border-bottom: 0; }
.lp-strip-item b { display: block; font-size: clamp(1.45rem, 3vw, 2rem); font-weight: 800; letter-spacing: -.03em; line-height: 1.1; }
.lp-strip-item span { display: block; margin-top: 6px; font-size: .82rem; color: var(--lp-body); font-weight: 500; }
@media (min-width: 768px) {
  .lp-strip-box { grid-template-columns: repeat(4, 1fr); }
  .lp-strip-item { border-bottom: 0 !important; border-right: 1px solid var(--lp-line) !important; }
  .lp-strip-item:last-child { border-right: 0 !important; }
}

/* ---------- Section umum ---------- */
.lp-sec { padding: 88px 0; }
.lp-sec-soft { background: linear-gradient(180deg, #f6f8ff 0%, #ffffff 100%); }
.lp-head { max-width: 680px; margin: 0 auto 52px; text-align: center; }
.lp-eyebrow {
  display: inline-block; padding: 6px 14px; border-radius: 999px; background: #e9f0ff; color: var(--lp-primary);
  font-size: .78rem; font-weight: 700; letter-spacing: .02em;
}
.lp-h2 { margin-top: 14px !important; font-size: clamp(1.7rem, 3.6vw, 2.6rem); font-weight: 800; line-height: 1.18; letter-spacing: -.02em; }
.lp-head p { margin-top: 14px; }

/* ---------- Bento fitur ---------- */
.lp-bento { display: grid; grid-template-columns: 1fr; gap: 16px; }
.lp-card {
  position: relative; overflow: hidden; padding: 28px; border-radius: 28px; border: 1px solid var(--lp-line); background: #fff;
  transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease; display: flex; flex-direction: column;
}
.lp-card:hover { transform: translateY(-4px); border-color: #c9d6ff; box-shadow: 0 26px 44px -28px rgba(13, 90, 253, .45); }
.lp-card h3 { margin-top: 18px !important; font-size: 1.14rem; font-weight: 700; letter-spacing: -.02em; line-height: 1.3; }
.lp-card p { margin-top: 8px; font-size: .93rem; line-height: 1.65; }
.lp-ico { width: 52px; height: 52px; border-radius: 16px; display: inline-flex; align-items: center; justify-content: center; color: #fff; font-size: 1.4rem; }
.lp-tint-blue { background: linear-gradient(160deg, #f2f6ff 0%, #e4edff 100%); }
.lp-tint-green { background: linear-gradient(160deg, #f1fcf6 0%, #dff7ea 100%); }
.lp-tint-violet { background: linear-gradient(160deg, #f6f4ff 0%, #e9e5ff 100%); }
.lp-tint-amber { background: linear-gradient(160deg, #fffaf0 0%, #fdefd0 100%); }
.lp-tint-pink { background: linear-gradient(160deg, #fff5fa 0%, #fde3ef 100%); }
.lp-tint-sky { background: linear-gradient(160deg, #f1faff 0%, #dcf1fd 100%); }
.lp-viz { margin-top: auto; padding-top: 22px; }
.lp-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.lp-chip { padding: 7px 14px; border-radius: 999px; font-size: .8rem; font-weight: 600; background: #fff; border: 1px solid var(--lp-line); color: var(--lp-body); }
.lp-chip.on { background: var(--lp-deep); border-color: var(--lp-deep); color: #fff; }
.lp-mini { margin-top: 12px; background: #fff; border: 1px solid var(--lp-line); border-radius: 16px; padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: .84rem; font-weight: 600; }
.lp-mini small { display: block; font-weight: 500; color: var(--lp-body); font-size: .72rem; }
.lp-mini .go { height: 36px; padding: 0 16px; border-radius: 999px; background: var(--lp-deep); color: #fff; display: inline-flex; align-items: center; font-size: .8rem; font-weight: 700; }
.lp-bubble { max-width: 270px; padding: 12px 14px; border-radius: 18px 18px 18px 6px; background: #fff; border: 1px solid #d3f0e0; font-size: .8rem; line-height: 1.5; color: var(--lp-ink); box-shadow: 0 10px 22px -16px rgba(18, 183, 106, .6); }
.lp-bubble small { display: block; margin-top: 4px; color: #12a05e; font-weight: 600; font-size: .72rem; }
.lp-receipt { width: 128px; padding: 12px 12px 18px; background: #fff; border: 1px solid var(--lp-line); border-radius: 10px 10px 4px 4px; transform: rotate(-3deg); box-shadow: 0 14px 26px -18px rgba(31, 7, 87, .5);
  -webkit-mask: conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) 50% / 12px 100%; mask: conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) 50% / 12px 100%; }
.lp-receipt i { display: block; height: 6px; border-radius: 3px; background: #e4e8fb; margin-bottom: 7px; }
.lp-receipt i.s { width: 60%; }
.lp-receipt i.d { height: 0; border-top: 1.5px dashed #cdd5f3; background: none; margin: 10px 0; }
.lp-track { display: flex; align-items: flex-start; justify-content: space-between; position: relative; gap: 4px; }
.lp-track::before { content: ''; position: absolute; top: 11px; left: 12%; right: 12%; height: 3px; border-radius: 2px; background: #f0dcab; }
.lp-track::after { content: ''; position: absolute; top: 11px; left: 12%; width: 50%; height: 3px; border-radius: 2px; background: #f1b10f; }
.lp-track div { position: relative; z-index: 1; flex: 1; text-align: center; font-size: .7rem; font-weight: 600; color: var(--lp-body); }
.lp-track div i { display: block; width: 25px; height: 25px; margin: 0 auto 8px; border-radius: 50%; background: #fff; border: 3px solid #f0dcab; }
.lp-track div.d i { background: #f1b10f; border-color: #f1b10f; }
.lp-track div.d { color: var(--lp-ink); }
.lp-stock { display: flex; flex-direction: column; gap: 10px; }
.lp-stock div { display: flex; align-items: center; gap: 10px; font-size: .76rem; font-weight: 600; }
.lp-stock em { font-style: normal; width: 62px; }
.lp-stock span { flex: 1; height: 8px; border-radius: 5px; background: #fbd9e8; overflow: hidden; }
.lp-stock span i { display: block; height: 100%; border-radius: 5px; background: linear-gradient(90deg, #ec4899, #db2777); }
.lp-stock b { width: 30px; text-align: right; font-weight: 700; }
.lp-sync { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.lp-sync span { display: inline-flex; align-items: center; gap: 7px; padding: 8px 14px; border-radius: 999px; font-size: .78rem; font-weight: 600; background: #fff; border: 1px solid var(--lp-line); }
.lp-sync span.ok { background: #e7f8ef; border-color: #c4ecd7; color: #0e8f55; }
.lp-sync i.bi-arrow-right { color: var(--lp-primary); }
@media (min-width: 768px) { .lp-bento { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 992px) {
  .lp-bento { grid-template-columns: repeat(3, 1fr); }
  .lp-span2 { grid-column: span 2; }
}

/* ---------- Cara kerja ---------- */
.lp-steps { position: relative; display: grid; grid-template-columns: 1fr; gap: 18px; }
.lp-step { position: relative; padding: 30px 26px 28px; border-radius: 28px; background: #fff; border: 1px solid var(--lp-line); text-align: left; box-shadow: 0 20px 40px -32px rgba(31, 7, 87, .35); }
.lp-step-n {
  width: 56px; height: 56px; border-radius: 18px; display: inline-flex; align-items: center; justify-content: center;
  font-size: 1.35rem; font-weight: 800; color: #fff; box-shadow: 0 12px 22px -10px rgba(13, 90, 253, .6);
}
.lp-step h3 { margin-top: 20px !important; font-size: 1.15rem; font-weight: 700; letter-spacing: -.02em; }
.lp-step p { margin-top: 8px; font-size: .93rem; }
@media (min-width: 992px) {
  .lp-steps { grid-template-columns: repeat(3, 1fr); gap: 24px; }
  .lp-steps::before { content: ''; position: absolute; top: 58px; left: 16%; right: 16%; border-top: 2px dashed #c9d6ff; z-index: 0; }
  .lp-step { z-index: 1; }
}

/* ---------- Keunggulan ---------- */
.lp-adv { display: grid; grid-template-columns: 1fr; gap: 44px; align-items: center; }
.lp-adv-list { display: flex; flex-direction: column; gap: 18px; margin-top: 28px; }
.lp-adv-item { display: flex; gap: 16px; align-items: flex-start; }
.lp-adv-item > i { flex: none; width: 44px; height: 44px; border-radius: 14px; background: #e9f0ff; color: var(--lp-primary); display: inline-flex; align-items: center; justify-content: center; font-size: 1.15rem; }
.lp-adv-item h4 { font-size: 1.02rem; font-weight: 700; letter-spacing: -.01em; }
.lp-adv-item p { margin-top: 3px; font-size: .9rem; line-height: 1.6; }
.lp-stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
.lp-stat { padding: 26px 20px; border-radius: 26px; text-align: center; border: 1px solid var(--lp-line); background: #fff; }
.lp-stat b { display: block; font-size: clamp(1.8rem, 4vw, 2.6rem); font-weight: 800; letter-spacing: -.04em; line-height: 1.05; }
.lp-stat span { display: block; margin-top: 8px; font-size: .82rem; font-weight: 500; color: var(--lp-body); }
.lp-stat.s1 { background: linear-gradient(145deg, #0134d4 0%, #0d5afd 100%); border: 0; box-shadow: 0 24px 40px -22px rgba(13, 90, 253, .8); }
.lp-stat.s1 b, .lp-stat.s1 span { color: #fff; }
.lp-stat.s1 span { opacity: .85; }
.lp-stat.s2 { background: #e9f0ff; border-color: #d4e1ff; }
.lp-stat.s2 b { color: var(--lp-deep); }
.lp-stat.s3 { background: #fff; }
.lp-stat.s3 b { color: var(--lp-primary); }
.lp-stat.s4 { background: #e7f8ef; border-color: #c4ecd7; }
.lp-stat.s4 b { color: #0e8f55; }
@media (min-width: 992px) {
  .lp-adv { grid-template-columns: 1fr 1fr; gap: 72px; }
  .lp-stats { gap: 18px; }
  .lp-stat.s2, .lp-stat.s4 { transform: translateY(24px); }
}

/* ---------- FAQ ---------- */
.lp-faq { max-width: 800px; margin: 0 auto; display: flex; flex-direction: column; gap: 12px; }
.lp-faq-item { border-radius: 20px; background: #fff; border: 1px solid var(--lp-line); transition: border-color .2s ease, box-shadow .2s ease; }
.lp-faq-item.open { border-color: #c9d6ff; box-shadow: 0 18px 36px -28px rgba(13, 90, 253, .6); }
.lp-faq-q {
  width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 20px 22px; background: transparent; border: 0;
  text-align: left; font-family: inherit; font-size: 1rem; font-weight: 600; color: var(--lp-ink); cursor: pointer; line-height: 1.45;
}
.lp-faq-q i {
  flex: none; width: 32px; height: 32px; border-radius: 50%; background: var(--lp-soft); color: var(--lp-primary);
  display: inline-flex; align-items: center; justify-content: center; transition: transform .25s ease, background-color .25s ease;
}
.lp-faq-item.open .lp-faq-q i { transform: rotate(45deg); background: var(--lp-primary); color: #fff; }
.lp-faq-a { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .3s ease; }
.lp-faq-item.open .lp-faq-a { grid-template-rows: 1fr; }
.lp-faq-a > div { overflow: hidden; }
.lp-faq-a p { padding: 0 22px 22px; font-size: .95rem; }

/* ---------- CTA ---------- */
.lp-cta-box {
  position: relative; overflow: hidden; border-radius: 36px; padding: 56px 24px; text-align: center; color: #fff;
  background: radial-gradient(520px 300px at 100% 0%, rgba(255,255,255,.22) 0%, rgba(255,255,255,0) 70%),
              radial-gradient(460px 280px at 0% 100%, rgba(120, 140, 255, .55) 0%, rgba(120, 140, 255, 0) 70%),
              linear-gradient(135deg, #0134d4 0%, #0d5afd 100%);
  box-shadow: 0 40px 70px -36px rgba(13, 90, 253, .8);
}
.lp-cta-box::before {
  content: ''; position: absolute; inset: 0; pointer-events: none; opacity: .5;
  background-image: radial-gradient(rgba(255,255,255,.25) 1px, transparent 1.2px); background-size: 22px 22px;
  -webkit-mask-image: linear-gradient(180deg, #000 0%, transparent 85%); mask-image: linear-gradient(180deg, #000 0%, transparent 85%);
}
.lp-cta-box > * { position: relative; }
.lp-cta-box .lp-eyebrow { background: rgba(255,255,255,.18); color: #fff; }
.lp-cta-box h2 { color: #fff; margin-top: 16px !important; font-size: clamp(1.7rem, 4vw, 2.7rem); font-weight: 800; line-height: 1.18; letter-spacing: -.02em; max-width: 720px; margin-left: auto !important; margin-right: auto !important; }
.lp-cta-box p { color: rgba(255,255,255,.88); max-width: 560px; margin: 16px auto 0; }
.lp-cta-box .lp-cta { margin-top: 30px; justify-content: center !important; }

/* ---------- Footer ---------- */
.lp-foot { padding: 56px 0 28px; background: #fff; border-top: 1px solid var(--lp-line); margin-top: 88px; }
.lp-foot-grid { display: grid; grid-template-columns: 1fr; gap: 32px; }
.lp-foot p.lp-foot-note { margin-top: 14px; max-width: 320px; font-size: .9rem; }
.lp-foot h4 { font-size: .82rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--lp-ink); }
.lp-foot ul { list-style: none; padding: 0; margin: 14px 0 0; display: flex; flex-direction: column; gap: 10px; }
.lp-foot ul li { list-style: none; }
.lp-foot ul a { font-size: .92rem; color: var(--lp-body); transition: color .2s ease; }
.lp-foot ul a:hover { color: var(--lp-primary); }
.lp-foot-bar { margin-top: 36px; padding-top: 22px; border-top: 1px solid var(--lp-line); font-size: .8rem; color: var(--lp-body); display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; }
@media (min-width: 768px) { .lp-foot-grid { grid-template-columns: 1.6fr 1fr 1fr; } }

/* ---------- Animasi ---------- */
@keyframes lp-rise { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: none; } }
@keyframes lp-drop { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
@keyframes lp-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-9px); } }
.lp-in { animation: lp-rise .7s cubic-bezier(.16, 1, .3, 1) both; }
.lp-in.d1 { animation-delay: .08s; } .lp-in.d2 { animation-delay: .16s; } .lp-in.d3 { animation-delay: .24s; } .lp-in.d4 { animation-delay: .32s; }
@media (prefers-reduced-motion: reduce) {
  .lp-root *, .lp-root *::before, .lp-root *::after { animation: none !important; transition: none !important; }
  html { scroll-behavior: auto; }
}
`;

const FAQS = [
  {
    q: 'Apakah bisa digunakan di laptop/PC dan HP sekaligus?',
    a: 'Ya, tentu saja! Aplikasi TokoPlus dapat diakses melalui browser laptop/PC, tablet, maupun smartphone. Tampilan akan otomatis menyesuaikan layar dengan nyaman.',
  },
  {
    q: 'Apakah kasir tetap bisa transaksi jika internet tiba-tiba mati?',
    a: 'Sangat bisa! Aplikasi didukung teknologi Offline-First. Transaksi penerimaan dan pencatatan kasir tetap berfungsi normal walau tanpa internet, dan data akan otomatis tersinkronisasi saat internet kembali aktif.',
  },
  {
    q: 'Printer apa saja yang didukung untuk cetak struk nota?',
    a: 'Mendukung semua printer thermal bluetooth ukuran standar 58mm dan 80mm, serta cetak dokumen invoice format A4 standar kantor.',
  },
  {
    q: 'Bagaimana pelanggan saya bisa mengecek status cucian mereka?',
    a: 'Setiap transaksi memiliki kode nota unik dengan tautan pelacakan publik (misal: /c/INV-123). Pelanggan cukup membuka link tersebut di HP mereka untuk melihat status cucian secara realtime tanpa perlu login.',
  },
  {
    q: 'Apakah ada masa percobaan gratis?',
    a: 'Ya! Tersedia paket Trial 30 Hari penuh gratis untuk mencoba semua fitur unggulan tanpa perlu kartu kredit.',
  },
];

const NAV_LINKS = [
  { href: '#fitur', label: 'Fitur Unggulan', icon: 'bi-stars' },
  { href: '#alur', label: 'Cara Kerja', icon: 'bi-arrow-repeat' },
  { href: '#keunggulan', label: 'Keunggulan', icon: 'bi-shield-check' },
  { href: '#faq', label: 'FAQ', icon: 'bi-question-circle' },
];

const LandingPage = ({ user }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState(0);

  useEffect(() => {
    // Tambahkan class di body saat landing page aktif agar padding app tidak mengganggu
    document.body.classList.add('landing-page-active');

    // Pastikan font Poppins (font tema Affan) tersedia walau halaman dibuka langsung
    if (!document.getElementById('lp-poppins')) {
      const link = document.createElement('link');
      link.id = 'lp-poppins';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap';
      document.head.appendChild(link);
    }

    return () => {
      document.body.classList.remove('landing-page-active');
    };
  }, []);

  const toggleFaq = (index) => setActiveFaq(activeFaq === index ? null : index);
  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <div className="lp-root landing-page-wrapper">
      <style>{LP_CSS}</style>

      {/* ======================= 1. NAVBAR ======================= */}
      <header className="lp-nav">
        <div className="lp-wrap">
          <div className="lp-nav-in">
            <Link to="/" className="lp-brand" aria-label="TokoPlus">
              <span className="lp-brand-mark"><i className="bi bi-shop"></i></span>
              <span>Toko<b>Plus</b></span>
            </Link>

            <nav className="lp-nav-links" aria-label="Menu utama">
              {NAV_LINKS.map((l) => (
                <a key={l.href} href={l.href}>{l.label}</a>
              ))}
            </nav>

            <div className="lp-nav-cta">
              {user ? (
                <Link to="/" className="lp-btn lp-btn-primary lp-btn-sm">
                  <i className="bi bi-speedometer2"></i> Masuk ke Dashboard
                </Link>
              ) : (
                <>
                  <Link to="/login" className="lp-btn lp-btn-ghost lp-btn-sm">Masuk</Link>
                  <Link to="/register" className="lp-btn lp-btn-primary lp-btn-sm">Coba Gratis 30 Hari</Link>
                </>
              )}
            </div>

            <button
              type="button"
              className="lp-burger"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Buka atau tutup menu"
              aria-expanded={mobileMenuOpen}
            >
              <i className={`bi ${mobileMenuOpen ? 'bi-x-lg' : 'bi-list'}`}></i>
            </button>
          </div>

          {mobileMenuOpen && (
            <div className="lp-sheet">
              {NAV_LINKS.map((l) => (
                <a key={l.href} href={l.href} className="lp-sheet-link" onClick={closeMenu}>
                  <i className={`bi ${l.icon}`}></i> {l.label}
                </a>
              ))}
              {user ? (
                <Link to="/" className="lp-btn lp-btn-primary" onClick={closeMenu}>Buka Dashboard</Link>
              ) : (
                <>
                  <Link to="/login" className="lp-btn lp-btn-ghost" onClick={closeMenu}>Masuk</Link>
                  <Link to="/register" className="lp-btn lp-btn-primary" onClick={closeMenu}>Daftar / Coba Gratis</Link>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ======================= 2. HERO ======================= */}
      <section className="lp-hero">
        <div className="lp-wrap">
          <div className="lp-hero-grid">
            <div className="lp-hero-copy">
              <span className="lp-badge lp-in">
                <i className="bi bi-lightning-charge-fill"></i>
                Aplikasi Kasir TokoPlus Cepat, Rapi &amp; Siap Pakai
              </span>

              <h1 className="lp-h1 lp-in d1">
                Kelola Usaha Laundry Jadi Lebih <span className="lp-grad">Cepat &amp; Anti-Ribet</span>
              </h1>

              <p className="lp-lead lp-in d2">
                Aplikasi kasir serba bisa untuk laundry kiloan, satuan, dan paket langganan. Otomatisasi nota via{' '}
                <strong>WhatsApp</strong>, cetak struk thermal bluetooth 58mm, dan pantau omzet usaha realtime, bahkan saat internet mati.
              </p>

              <div className="lp-cta lp-in d3">
                <Link to="/register" className="lp-btn lp-btn-primary">
                  Mulai Coba Gratis <i className="bi bi-arrow-right"></i>
                </Link>
                <Link to="/login" className="lp-btn lp-btn-ghost">
                  <i className="bi bi-box-arrow-in-right" style={{ color: '#0d5afd' }}></i> Masuk Akun Kasir
                </Link>
              </div>

              <div className="lp-trust lp-in d4">
                <span><i className="bi bi-check-circle-fill"></i> Trial 30 Hari Penuh</span>
                <span><i className="bi bi-check-circle-fill"></i> Support Offline-First</span>
                <span><i className="bi bi-check-circle-fill"></i> Siap Pakai di HP &amp; Laptop</span>
              </div>
            </div>

            {/* Mockup aplikasi */}
            <div className="lp-stage" aria-hidden="true">
              <div className="lp-glow"></div>

              <div className="lp-orders">
                <div className="o">
                  <div className="t"><span>Omzet Hari Ini</span><b>Rp 1.450.000</b></div>
                  <div className="s"><span>28 Transaksi</span><span className="lp-pill" style={{ background: '#e7f8ef', color: '#0e8f55' }}>Naik</span></div>
                </div>
                <div className="o">
                  <div className="t"><b>#TP-0824</b><span>Rp 35.000</span></div>
                  <div className="s"><span>Bu Sarah · 5.0 Kg</span><span className="lp-pill" style={{ background: '#e4edff', color: '#0134d4' }}>Proses Cuci</span></div>
                </div>
                <div className="o">
                  <div className="t"><b>#TP-0823</b><span>Rp 75.000</span></div>
                  <div className="s"><span>Bpk. Hendra · Bed Cover</span><span className="lp-pill" style={{ background: '#fdefd0', color: '#8a5a00' }}>Siap Diambil</span></div>
                </div>
              </div>

              <div className="lp-phone">
                <div className="lp-screen">
                  <span className="lp-notch"></span>
                  <div className="lp-app-top">
                    <b>Transaksi</b>
                    <span className="lp-app-bell"><i className="bi bi-bell"></i></span>
                  </div>
                  <div className="lp-app-body">
                    <div className="lp-app-search">
                      <div><i className="bi bi-search"></i> Cari nama atau kode...</div>
                      <div>Semua <i className="bi bi-chevron-down"></i></div>
                    </div>
                    <div className="lp-app-cards">
                      <div className="lp-app-card on">
                        <span className="tag" style={{ background: '#e0e7ff', color: '#3730a3' }}>CUCI SETRIKA</span>
                        <span className="nm">Kilat · 4 jam</span>
                        <span className="pr">Rp 14.000</span>
                        <span className="st"><i className="bi bi-dash"></i> 2 <i className="pl bi bi-plus"></i></span>
                      </div>
                      <div className="lp-app-card">
                        <span className="tag" style={{ background: '#dcfce7', color: '#166534' }}>CUCI LIPAT</span>
                        <span className="nm">Reguler · 3 hari</span>
                        <span className="pr">Rp 5.000</span>
                        <span className="hint">+ Ketuk untuk tambah</span>
                      </div>
                      <div className="lp-app-card">
                        <span className="tag" style={{ background: '#ffedd5', color: '#9a3412' }}>SETRIKA SAJA</span>
                        <span className="nm">Kilat · 4 jam</span>
                        <span className="pr">Rp 12.000</span>
                        <span className="hint">+ Ketuk untuk tambah</span>
                      </div>
                      <div className="lp-app-card">
                        <span className="tag" style={{ background: '#dcfce7', color: '#166534' }}>CUCI LIPAT</span>
                        <span className="nm">Express · 1 hari</span>
                        <span className="pr">Rp 7.000</span>
                        <span className="hint">+ Ketuk untuk tambah</span>
                      </div>
                    </div>
                  </div>
                  <div className="lp-app-dock">
                    <div className="grab"></div>
                    <div className="who">
                      <div className="who-user">
                        <i className="bi bi-person-circle"></i>
                        <span>Pelanggan Umum</span>
                      </div>
                      <span className="who-badge">
                        <i className="bi bi-check-circle-fill"></i> Lunas
                      </span>
                    </div>
                    <div className="row">
                      <div className="b1"><i className="bi bi-person-plus-fill"></i> Pelanggan</div>
                      <div className="b2"><i className="bi bi-wallet2"></i> <span>Bayar Rp 28.000</span></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lp-float f1">
                <i style={{ background: 'linear-gradient(135deg,#12b76a,#059669)' }}><span className="bi bi-check-lg"></span></i>
                <span>Nota WA Terkirim<small>Cepat &amp; otomatis</small></span>
              </div>
              <div className="lp-float f2">
                <i style={{ background: 'linear-gradient(135deg,#0134d4,#0d5afd)' }}><span className="bi bi-cloud-arrow-up"></span></i>
                <span>Sync Cloud &amp; Offline<small>Data selalu aman</small></span>
              </div>
              <div className="lp-float f3">
                <i style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}><span className="bi bi-printer"></span></i>
                <span>Cetak 58mm<small>Thermal bluetooth</small></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======================= STRIP STATISTIK ======================= */}
      <div className="lp-strip">
        <div className="lp-wrap">
          <div className="lp-strip-box">
            <div className="lp-strip-item"><b className="lp-grad">30 Hari</b><span>Trial gratis penuh</span></div>
            <div className="lp-strip-item"><b className="lp-grad">100%</b><span>Support mode offline</span></div>
            <div className="lp-strip-item"><b className="lp-grad">58mm</b><span>Thermal bluetooth ready</span></div>
            <div className="lp-strip-item"><b className="lp-grad">&lt; 1 Menit</b><span>Waktu buat transaksi</span></div>
          </div>
        </div>
      </div>

      {/* ======================= 3. FITUR (BENTO) ======================= */}
      <section id="fitur" className="lp-sec">
        <div className="lp-wrap">
          <div className="lp-head">
            <span className="lp-eyebrow">Fitur Lengkap</span>
            <h2 className="lp-h2">Semua Kebutuhan Kasir TokoPlus dalam 1 Aplikasi</h2>
            <p>
              Didesain khusus untuk operasional laundry modern agar pencatatan tidak berantakan, pelanggan terlayani cepat, dan keuangan selalu transparan.
            </p>
          </div>

          <div className="lp-bento">
            {/* 1 */}
            <article className="lp-card lp-tint-blue lp-span2">
              <span className="lp-ico" style={{ background: 'linear-gradient(135deg,#0134d4,#0d5afd)' }}><i className="bi bi-cart-plus-fill"></i></span>
              <h3>Kasir Kiloan &amp; Satuan Kilat</h3>
              <p>
                Catat transaksi kiloan dengan hitung berat desimal otomatis, satuan (bed cover, jas, sepatu), serta paket bulanan. Hanya butuh beberapa ketukan.
              </p>
              <div className="lp-viz">
                <div className="lp-chips">
                  <span className="lp-chip on">Kiloan</span>
                  <span className="lp-chip">Satuan</span>
                  <span className="lp-chip">Paket Bulanan</span>
                </div>
                <div className="lp-mini">
                  <span>Cuci Setrika Kilat × 2<small>Kilat (4 Jam)</small></span>
                  <span className="go">Bayar Rp 28.000</span>
                </div>
              </div>
            </article>

            {/* 2 */}
            <article className="lp-card lp-tint-green">
              <span className="lp-ico" style={{ background: 'linear-gradient(135deg,#12b76a,#059669)' }}><i className="bi bi-whatsapp"></i></span>
              <h3>Kirim Nota Otomatis ke WhatsApp</h3>
              <p>
                Hemat kertas struk! Kirim ringkasan nota pesanan langsung ke nomor WhatsApp pelanggan secara personal dan otomatis saat order dibuat.
              </p>
              <div className="lp-viz">
                <div className="lp-bubble">
                  Halo Bu Sarah, nota <b>#KL-0824</b> sebesar Rp 35.000 sudah kami proses.
                  <small><i className="bi bi-check2-all"></i> Terkirim</small>
                </div>
              </div>
            </article>

            {/* 3 */}
            <article className="lp-card lp-tint-violet">
              <span className="lp-ico" style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}><i className="bi bi-printer-fill"></i></span>
              <h3>Cetak Struk Thermal Bluetooth</h3>
              <p>
                Kompatibel dengan printer thermal bluetooth 58mm/80mm di HP maupun laptop, lengkap dengan QR Code tracking nota dan cetak format A4.
              </p>
              <div className="lp-viz">
                <div className="lp-receipt" aria-hidden="true">
                  <i></i><i className="s"></i><i className="d"></i><i></i><i></i><i className="s"></i>
                </div>
              </div>
            </article>

            {/* 4 */}
            <article className="lp-card lp-tint-amber lp-span2">
              <span className="lp-ico" style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}><i className="bi bi-search"></i></span>
              <h3>Tracking Status Pesanan Publik</h3>
              <p>
                Pelanggan dapat melacak sendiri status pengerjaan cucian (Dicuci, Dikeringkan, Disetrika, Siap Diambil) via tautan pelacakan online tanpa login.
              </p>
              <div className="lp-viz">
                <div className="lp-track" aria-hidden="true">
                  <div className="d"><i></i>Dicuci</div>
                  <div className="d"><i></i>Dikeringkan</div>
                  <div className="d"><i></i>Disetrika</div>
                  <div><i></i>Siap Diambil</div>
                </div>
              </div>
            </article>

            {/* 5 */}
            <article className="lp-card lp-tint-pink">
              <span className="lp-ico" style={{ background: 'linear-gradient(135deg,#ec4899,#db2777)' }}><i className="bi bi-box-seam"></i></span>
              <h3>Inventori &amp; Kontrol Stok</h3>
              <p>
                Kelola stok bahan habis pakai seperti deterjen, pelembut pakaian, dan plastik packing. Histori mutasi stok tercatat rapi setiap keluar-masuk.
              </p>
              <div className="lp-viz">
                <div className="lp-stock" aria-hidden="true">
                  <div><em>Plastik</em><span><i style={{ width: '88%' }}></i></span><b>104</b></div>
                  <div><em>Deterjen</em><span><i style={{ width: '34%' }}></i></span><b>8</b></div>
                  <div><em>Molto</em><span><i style={{ width: '22%' }}></i></span><b>5</b></div>
                </div>
              </div>
            </article>

            {/* 6 */}
            <article className="lp-card lp-tint-sky lp-span2">
              <span className="lp-ico" style={{ background: 'linear-gradient(135deg,#0284c7,#0369a1)' }}><i className="bi bi-wifi-off"></i></span>
              <h3>Offline-First Tanpa Khawatir</h3>
              <p>
                Koneksi internet tidak stabil di ruko? Tenang! Kasir tetap bisa input transaksi dan cetak nota. Begitu online, data otomatis tersinkronisasi ke server.
              </p>
              <div className="lp-viz">
                <div className="lp-sync" aria-hidden="true">
                  <span><i className="bi bi-wifi-off"></i> Internet mati</span>
                  <i className="bi bi-arrow-right"></i>
                  <span><i className="bi bi-receipt"></i> Transaksi tetap jalan</span>
                  <i className="bi bi-arrow-right"></i>
                  <span className="ok"><i className="bi bi-cloud-check-fill"></i> Tersinkron otomatis</span>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ======================= 4. CARA KERJA ======================= */}
      <section id="alur" className="lp-sec lp-sec-soft">
        <div className="lp-wrap">
          <div className="lp-head">
            <span className="lp-eyebrow">Alur Sangat Simpel</span>
            <h2 className="lp-h2">3 Langkah Mudah Mengoperasikan Kasir</h2>
            <p>Bahkan kasir baru pun bisa langsung menggunakan sistem ini dalam waktu 5 menit tanpa pelatihan rumit.</p>
          </div>

          <div className="lp-steps">
            <div className="lp-step">
              <span className="lp-step-n" style={{ background: 'linear-gradient(135deg,#0134d4,#0d5afd)' }}>1</span>
              <h3>Terima Cucian &amp; Timbang</h3>
              <p>Pilih pelanggan, masukkan kilogram cucian atau pilih item satuan. Total biaya langsung terhitung otomatis sesuai tarif toko.</p>
            </div>
            <div className="lp-step">
              <span className="lp-step-n" style={{ background: 'linear-gradient(135deg,#4f46e5,#6a5cff)' }}>2</span>
              <h3>Proses &amp; Kirim Nota WA</h3>
              <p>Simpan order, cetak nota thermal atau kirim link nota ke WhatsApp pelanggan. Pelanggan bisa memantau progres cuci kapan saja.</p>
            </div>
            <div className="lp-step">
              <span className="lp-step-n" style={{ background: 'linear-gradient(135deg,#12b76a,#059669)' }}>3</span>
              <h3>Ambil &amp; Catat Pembayaran</h3>
              <p>Saat pakaian selesai, beri tahu pelanggan. Terima pembayaran (Tunai / QRIS), dan transaksi tersimpan aman dalam laporan keuangan.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ======================= 5. KEUNGGULAN ======================= */}
      <section id="keunggulan" className="lp-sec">
        <div className="lp-wrap">
          <div className="lp-adv">
            <div>
              <span className="lp-eyebrow">Kenapa TokoPlus?</span>
              <h2 className="lp-h2">Teknologi Modern yang Ringan dan Fleksibel</h2>
              <p style={{ marginTop: 16 }}>
                Dibangun dengan teknologi <strong style={{ color: '#1f0757', fontWeight: 600 }}>Progressive Web App (PWA)</strong>, aplikasi ini tidak memerlukan instalasi file APK berat. Anda bisa memasang langsung di layar beranda HP Android, iPhone, tablet iPad, maupun desktop Windows dan Mac.
              </p>

              <div className="lp-adv-list">
                <div className="lp-adv-item">
                  <i className="bi bi-phone"></i>
                  <div>
                    <h4>Responsif di Semua Ukuran Layar</h4>
                    <p>Tampilan otomatis adaptif: layar desktop luas &amp; rapi, layar HP pas di satu genggaman.</p>
                  </div>
                </div>
                <div className="lp-adv-item">
                  <i className="bi bi-people"></i>
                  <div>
                    <h4>Manajemen Multi-Kasir</h4>
                    <p>Owner dapat menambah akun staf kasir dengan hak akses terkontrol agar keuangan toko tetap aman.</p>
                  </div>
                </div>
                <div className="lp-adv-item">
                  <i className="bi bi-graph-up-arrow"></i>
                  <div>
                    <h4>Laporan Omzet &amp; Keuangan Realtime</h4>
                    <p>Grafik omzet harian, mingguan, bulanan, serta rekap metode pembayaran tunai vs non-tunai.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lp-stats">
              <div className="lp-stat s1"><b>30</b><span>Hari Trial Gratis Penuh</span></div>
              <div className="lp-stat s2"><b>100%</b><span>Support Mode Offline</span></div>
              <div className="lp-stat s3"><b>58mm</b><span>Thermal Bluetooth Ready</span></div>
              <div className="lp-stat s4"><b>&lt; 1 Menit</b><span>Waktu Buat Transaksi</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* ======================= 6. FAQ ======================= */}
      <section id="faq" className="lp-sec lp-sec-soft">
        <div className="lp-wrap">
          <div className="lp-head">
            <span className="lp-eyebrow">Tanya Jawab</span>
            <h2 className="lp-h2">Pertanyaan yang Sering Diajukan</h2>
            <p>Punya pertanyaan seputar aplikasi kasir laundry? Berikut jawaban ringkasnya.</p>
          </div>

          <div className="lp-faq">
            {FAQS.map((faq, index) => {
              const isOpen = activeFaq === index;
              return (
                <div key={faq.q} className={`lp-faq-item ${isOpen ? 'open' : ''}`}>
                  <button
                    type="button"
                    className="lp-faq-q"
                    onClick={() => toggleFaq(index)}
                    aria-expanded={isOpen}
                  >
                    <span>{faq.q}</span>
                    <i className="bi bi-plus-lg"></i>
                  </button>
                  <div className="lp-faq-a">
                    <div><p>{faq.a}</p></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ======================= 7. CTA ======================= */}
      <section className="lp-sec" style={{ paddingBottom: 0 }}>
        <div className="lp-wrap">
          <div className="lp-cta-box">
            <span className="lp-eyebrow">Tingkatkan Kualitas Usaha Anda</span>
            <h2>Siap Membuat Toko Laundry Anda Lebih Profesional?</h2>
            <p>Daftar sekarang dan nikmati seluruh kemudahan aplikasi kasir laundry dengan trial gratis 30 hari tanpa biaya pendaftaran.</p>
            <div className="lp-cta">
              <Link to="/register" className="lp-btn lp-btn-light">Coba Gratis 30 Hari <i className="bi bi-arrow-right"></i></Link>
              <Link to="/login" className="lp-btn lp-btn-outline-light">Masuk Akun Kasir</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ======================= 8. FOOTER ======================= */}
      <footer className="lp-foot">
        <div className="lp-wrap">
          <div className="lp-foot-grid">
            <div>
              <Link to="/" className="lp-brand" aria-label="TokoPlus">
                <span className="lp-brand-mark"><i className="bi bi-shop"></i></span>
                <span>Toko<b>Plus</b></span>
              </Link>
              <p className="lp-foot-note">TokoPlus PWA POS System. Kasir cepat, nota WhatsApp, dan laporan keuangan dalam satu aplikasi.</p>
            </div>
            <div>
              <h4>Produk</h4>
              <ul>
                <li><a href="#fitur">Fitur</a></li>
                <li><a href="#alur">Cara Kerja</a></li>
                <li><a href="#keunggulan">Keunggulan</a></li>
                <li><a href="#faq">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4>Akun</h4>
              <ul>
                <li><Link to="/login">Masuk</Link></li>
                <li><Link to="/register">Daftar</Link></li>
              </ul>
            </div>
          </div>
          <div className="lp-foot-bar">
            <span>&copy; {new Date().getFullYear()} TokoPlus. All rights reserved.</span>
            <span>Dibuat untuk pemilik toko laundry di Indonesia</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
