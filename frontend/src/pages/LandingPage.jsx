import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { APP_NAME } from '../constants/appConstants';

/* ==========================================================================
   LANDING PAGE - Desain Bersih, Berkarakter & Anti-Slop
   - Palet warna berkarakter: Navy ink (#0f172a), Sapphire primary (#0256d2), Slate body (#475569)
   - Layout responsif ramah mobile & tablet, tanpa background grid klise
   - Aksesibilitas WCAG AA (kontras > 4.5:1, tap target >= 44px, keyboard navigable)
   ========================================================================== */

const LP_CSS = `
html { scroll-behavior: smooth; scroll-padding-top: 84px; }

.lp-root {
  --lp-primary: #0256d2;
  --lp-deep: #013bb5;
  --lp-ink: #0f172a;
  --lp-body: #475569;
  --lp-line: #e2e8f0;
  --lp-soft: #f8fafc;
  --lp-green: #16a34a;
  font-family: 'Poppins', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
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
  outline: 3px solid rgba(2, 86, 210, .45); outline-offset: 2px; border-radius: 10px;
}
.lp-wrap { width: 100%; max-width: 1180px; margin: 0 auto; padding: 0 20px; }

/* ---------- Tombol Responsif (Tap Target >= 44px) ---------- */
.lp-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  min-height: 48px; padding: 0 24px; border-radius: 12px; border: 1px solid transparent;
  font-family: inherit; font-size: .95rem; font-weight: 600; line-height: 1; white-space: nowrap; cursor: pointer;
  transition: transform .18s ease, box-shadow .18s ease, background-color .18s ease, border-color .18s ease;
}
.lp-btn:hover { transform: translateY(-1px); }
.lp-btn:active { transform: translateY(0); }
.lp-btn-primary {
  color: #fff; background: var(--lp-primary);
  box-shadow: 0 4px 14px -3px rgba(2, 86, 210, .45);
}
.lp-btn-primary:hover { color: #fff; background: var(--lp-deep); box-shadow: 0 6px 18px -3px rgba(2, 86, 210, .55); }
.lp-btn-ghost { color: var(--lp-ink); background: #fff; border-color: var(--lp-line); box-shadow: 0 1px 3px rgba(15, 23, 42, .06); }
.lp-btn-ghost:hover { color: var(--lp-primary); border-color: #cbd5e1; background: var(--lp-soft); }
.lp-btn-light { color: var(--lp-deep); background: #fff; box-shadow: 0 4px 16px -4px rgba(15, 23, 42, .2); font-weight: 700; }
.lp-btn-light:hover { color: var(--lp-primary); background: #f8fafc; }
.lp-btn-outline-light { color: #fff; background: rgba(255,255,255,.08); border-color: rgba(255,255,255,.35); }
.lp-btn-outline-light:hover { color: #fff; background: rgba(255,255,255,.16); border-color: rgba(255,255,255,.5); }
.lp-btn-sm { min-height: 44px; height: 44px; padding: 0 20px; font-size: .88rem; }

/* ---------- Navbar dengan Safe Area Inset ---------- */
.lp-nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 1030;
  padding-top: env(safe-area-inset-top, 0px);
  background: rgba(255, 255, 255, .95);
  -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--lp-line);
}
.lp-nav-in { display: flex; align-items: center; justify-content: space-between; height: 68px; }
.lp-brand { display: inline-flex; align-items: center; gap: 10px; color: var(--lp-ink); font-weight: 700; font-size: 1.15rem; letter-spacing: -.02em; }
.lp-brand:hover { color: var(--lp-ink); }
.lp-brand-mark {
  width: 40px; height: 40px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center;
  color: #fff; font-size: 1.15rem; background: var(--lp-primary);
}
.lp-brand b { color: var(--lp-primary); font-weight: 700; }
.lp-nav-links { display: none; align-items: center; gap: 4px; }
.lp-nav-links a {
  padding: 8px 14px; border-radius: 8px; font-size: .9rem; font-weight: 500; color: var(--lp-body);
  transition: color .18s ease, background-color .18s ease;
}
.lp-nav-links a:hover { color: var(--lp-primary); background: var(--lp-soft); }
.lp-nav-cta { display: none; align-items: center; gap: 10px; }
.lp-burger {
  min-width: 44px; min-height: 44px; border-radius: 10px; border: 1px solid var(--lp-line); background: #fff; color: var(--lp-ink);
  display: inline-flex; align-items: center; justify-content: center; font-size: 1.3rem; cursor: pointer;
}
.lp-sheet { padding: 12px 0 20px; border-top: 1px solid var(--lp-line); animation: lp-drop .2s ease-out; }
.lp-sheet a.lp-sheet-link {
  display: flex; align-items: center; gap: 12px; padding: 12px 10px; color: var(--lp-ink); font-weight: 500; border-radius: 8px;
}
.lp-sheet a.lp-sheet-link i { color: var(--lp-primary); font-size: 1.1rem; }
.lp-sheet .lp-btn { width: 100%; margin-top: 10px; }
@media (min-width: 992px) {
  .lp-nav-links { display: flex; }
  .lp-nav-cta { display: flex; }
  .lp-burger { display: none; }
}

/* ---------- Hero Section (Tanpa Grid Dot AI / Tanpa Rainbow Gradient) ---------- */
.lp-hero {
  position: relative; overflow: hidden; padding: 104px 0 52px;
  background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
}
.lp-hero-grid { position: relative; display: grid; grid-template-columns: 1fr; gap: 40px; align-items: center; }
.lp-hero-copy { text-align: center; }
.lp-badge {
  display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 8px;
  background: #f1f5f9; border: 1px solid #cbd5e1;
  font-size: .8rem; font-weight: 600; color: #1e293b;
}
.lp-badge i { color: var(--lp-primary); font-size: .95rem; }
.lp-h1 {
  margin-top: 18px !important; font-size: clamp(2.1rem, 4.8vw, 3.4rem); font-weight: 800; line-height: 1.15; letter-spacing: -.025em;
  color: var(--lp-ink);
}
.lp-h1-accent { color: var(--lp-primary); }
.lp-lead { margin-top: 16px !important; font-size: clamp(1rem, 1.4vw, 1.12rem) !important; max-width: 580px; margin-left: auto !important; margin-right: auto !important; color: var(--lp-body); }
.lp-lead strong { color: var(--lp-ink); font-weight: 600; }
.lp-cta { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin-top: 28px; }
.lp-trust { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px 20px; margin-top: 24px; }
.lp-trust span { display: inline-flex; align-items: center; gap: 7px; font-size: .86rem; font-weight: 500; color: var(--lp-body); }
.lp-trust i { color: var(--lp-green); font-size: 1rem; }

/* ---------- Mockup Layar HP (Reflow Fluida, Tanpa Scale Hack & Tanpa Glow Berlebih) ---------- */
.lp-stage { position: relative; display: flex; justify-content: center; align-items: center; width: 100%; min-height: 520px; }
.lp-phone {
  position: relative; z-index: 2; width: 100%; max-width: 292px; height: 570px; padding: 8px; border-radius: 36px;
  background: #0f172a; border: 3px solid #1e293b;
  box-shadow: 0 20px 40px -15px rgba(15, 23, 42, .25);
}
.lp-screen { position: relative; width: 100%; height: 100%; border-radius: 28px; overflow: hidden; background: #f8fafc; }
.lp-notch { position: absolute; top: 8px; left: 50%; width: 72px; height: 18px; border-radius: 10px; background: #0f172a; transform: translateX(-50%); z-index: 3; }
.lp-app-top { display: flex; align-items: center; justify-content: space-between; padding: 34px 14px 10px; background: #fff; border-bottom: 1px solid var(--lp-line); }
.lp-app-top b { font-size: 1rem; font-weight: 700; color: var(--lp-ink); }
.lp-app-bell { width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--lp-line); background: var(--lp-soft); display: inline-flex; align-items: center; justify-content: center; color: var(--lp-primary); font-size: .85rem; }
.lp-app-body { padding: 10px 10px 0; }
.lp-app-search { display: flex; gap: 6px; }
.lp-app-search > div { height: 32px; border-radius: 8px; border: 1px solid #cbd5e1; background: #fff; display: flex; align-items: center; gap: 6px; padding: 0 8px; font-size: .65rem; color: #475569; }
.lp-app-search > div:first-child { flex: 1; }
.lp-app-search > div:last-child { width: 76px; font-weight: 700; color: var(--lp-ink); justify-content: space-between; }
.lp-app-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 8px; }
.lp-app-card { background: #fff; border: 1px solid var(--lp-line); border-radius: 10px; padding: 8px; display: flex; flex-direction: column; gap: 4px; }
.lp-app-card.on { border: 2px solid var(--lp-primary); background: #f0f7ff; }
.lp-app-card .tag { align-self: flex-start; font-size: .52rem; font-weight: 700; padding: 2px 5px; border-radius: 4px; }
.lp-app-card .nm { font-size: .68rem; font-weight: 700; color: var(--lp-ink); }
.lp-app-card .pr { font-size: .85rem; font-weight: 800; color: var(--lp-primary); }
.lp-app-card .st { display: flex; align-items: center; gap: 4px; font-size: .68rem; font-weight: 700; }
.lp-app-card .st i { width: 18px; height: 18px; border-radius: 4px; background: #e2e8f0; display: inline-flex; align-items: center; justify-content: center; font-size: .6rem; }
.lp-app-card .st i.pl { background: var(--lp-primary); color: #fff; }
.lp-app-card .hint { font-size: .6rem; color: #475569; font-weight: 500; }
.lp-app-dock {
  position: absolute; left: 8px; right: 8px; bottom: 8px; z-index: 3; background: #ffffff; border-radius: 14px; border: 1px solid var(--lp-line);
  box-shadow: 0 -4px 16px rgba(15, 23, 42, .08); padding: 8px 10px;
}
.lp-app-dock .who { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.lp-app-dock .who-user { display: inline-flex; align-items: center; gap: 5px; font-size: .72rem; font-weight: 700; color: #0f172a; }
.lp-app-dock .who-badge { display: inline-flex; align-items: center; gap: 3px; font-size: .62rem; background: #dcfce7; color: #166534; padding: 2px 6px; border-radius: 6px; font-weight: 700; }
.lp-app-dock .row { display: flex; gap: 6px; align-items: center; }
.lp-app-dock .b1 {
  flex: 1; height: 36px; border-radius: 8px; border: 1px solid #cbd5e1; color: var(--lp-ink); background: #f8fafc;
  display: flex; align-items: center; justify-content: center; gap: 4px; font-size: .7rem; font-weight: 600;
}
.lp-app-dock .b2 {
  flex: 1.4; height: 36px; border-radius: 8px; background: var(--lp-primary); color: #ffffff;
  display: flex; align-items: center; justify-content: center; gap: 4px; font-size: .7rem; font-weight: 700;
}

.lp-float {
  position: absolute; z-index: 3; display: none; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 12px;
  background: #ffffff; border: 1px solid var(--lp-line);
  box-shadow: 0 10px 24px -8px rgba(15, 23, 42, .15); font-size: .82rem; font-weight: 600; color: var(--lp-ink); white-space: nowrap;
}
.lp-float i { width: 34px; height: 34px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; font-size: 1rem; color: #fff; }
.lp-float small { display: block; font-size: .7rem; font-weight: 500; color: var(--lp-body); margin-top: 1px; }
.lp-float.f1 { top: 30px; right: 0; }
.lp-float.f2 { bottom: 40px; left: 0; }
.lp-orders {
  position: absolute; z-index: 1; display: none; right: -12px; bottom: 80px; width: 248px; padding: 14px; border-radius: 16px;
  background: #fff; border: 1px solid var(--lp-line); box-shadow: 0 12px 28px -10px rgba(15, 23, 42, .15);
}
.lp-orders .o { padding: 8px 0; border-bottom: 1px solid var(--lp-line); }
.lp-orders .o:last-child { border-bottom: 0; padding-bottom: 0; }
.lp-orders .o .t { display: flex; justify-content: space-between; font-size: .78rem; font-weight: 700; }
.lp-orders .o .t b { color: var(--lp-primary); }
.lp-orders .o .s { display: flex; justify-content: space-between; margin-top: 3px; font-size: .7rem; color: var(--lp-body); }
.lp-pill { padding: 2px 7px; border-radius: 6px; font-size: .65rem; font-weight: 700; }

@media (min-width: 640px) {
  .lp-float { display: inline-flex; }
  .lp-orders { display: block; }
}
@media (min-width: 992px) {
  .lp-hero { padding: 132px 0 76px; }
  .lp-hero-grid { grid-template-columns: 1.05fr .95fr; gap: 40px; }
  .lp-hero-copy { text-align: left; }
  .lp-stage { justify-content: flex-end; padding-right: 20px; }
  .lp-lead { margin-left: 0 !important; margin-right: 0 !important; }
  .lp-cta, .lp-trust { justify-content: flex-start; }
}

/* ---------- Strip Statistik Terverifikasi & Jujur ---------- */
.lp-strip { position: relative; z-index: 4; margin-top: -24px; }
.lp-strip-box {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 0; background: #fff; border: 1px solid var(--lp-line); border-radius: 16px;
  box-shadow: 0 10px 25px -8px rgba(15, 23, 42, .08); overflow: hidden;
}
.lp-strip-item { padding: 20px 16px; text-align: center; border-right: 1px solid var(--lp-line); border-bottom: 1px solid var(--lp-line); }
.lp-strip-item:nth-child(2n) { border-right: 0; }
.lp-strip-item:nth-last-child(-n+2) { border-bottom: 0; }
.lp-strip-item b { display: block; font-size: clamp(1.35rem, 2.5vw, 1.85rem); font-weight: 800; letter-spacing: -.02em; line-height: 1.15; color: var(--lp-primary); }
.lp-strip-item span { display: block; margin-top: 6px; font-size: .84rem; color: var(--lp-body); font-weight: 500; }
@media (min-width: 768px) {
  .lp-strip-box { grid-template-columns: repeat(4, 1fr); }
  .lp-strip-item { border-bottom: 0 !important; border-right: 1px solid var(--lp-line) !important; }
  .lp-strip-item:last-child { border-right: 0 !important; }
}

/* ---------- Section Umum (Padding Proporsional di Layar Ponsel) ---------- */
.lp-sec { padding: 52px 0; }
@media (min-width: 768px) { .lp-sec { padding: 76px 0; } }
.lp-sec-soft { background: var(--lp-soft); border-top: 1px solid var(--lp-line); border-bottom: 1px solid var(--lp-line); }
.lp-head { max-width: 680px; margin: 0 auto 40px; text-align: center; }
.lp-eyebrow {
  display: inline-block; padding: 5px 12px; border-radius: 6px; background: #e0f2fe; color: #0369a1;
  font-size: .78rem; font-weight: 700; letter-spacing: .02em; text-transform: uppercase;
}
.lp-h2 { margin-top: 12px !important; font-size: clamp(1.65rem, 3.2vw, 2.3rem); font-weight: 800; line-height: 1.22; letter-spacing: -.02em; }
.lp-head p { margin-top: 12px; }

/* ---------- Fitur Cards (Palet Bersih, Terpadu & Terarah) ---------- */
.lp-bento { display: grid; grid-template-columns: 1fr; gap: 16px; }
.lp-card {
  position: relative; overflow: hidden; padding: 24px; border-radius: 16px; border: 1px solid var(--lp-line); background: #fff;
  transition: transform .18s ease, box-shadow .18s ease; display: flex; flex-direction: column;
}
.lp-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px -6px rgba(15, 23, 42, .1); border-color: #cbd5e1; }
.lp-card h3 { margin-top: 16px !important; font-size: 1.12rem; font-weight: 700; letter-spacing: -.01em; line-height: 1.35; }
.lp-card p { margin-top: 8px; font-size: .92rem; line-height: 1.6; }
.lp-ico { width: 46px; height: 46px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; font-size: 1.3rem; }
.lp-viz { margin-top: auto; padding-top: 20px; }
.lp-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.lp-chip { padding: 6px 12px; border-radius: 8px; font-size: .8rem; font-weight: 600; background: var(--lp-soft); border: 1px solid var(--lp-line); color: var(--lp-body); }
.lp-chip.on { background: var(--lp-primary); border-color: var(--lp-primary); color: #fff; }
.lp-mini { margin-top: 12px; background: var(--lp-soft); border: 1px solid var(--lp-line); border-radius: 10px; padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: .84rem; font-weight: 600; }
.lp-mini small { display: block; font-weight: 500; color: var(--lp-body); font-size: .72rem; }
.lp-mini .go { height: 34px; padding: 0 14px; border-radius: 8px; background: var(--lp-primary); color: #fff; display: inline-flex; align-items: center; font-size: .8rem; font-weight: 700; }
.lp-bubble { max-width: 280px; padding: 12px 14px; border-radius: 12px 12px 12px 4px; background: #f0fdf4; border: 1px solid #bbf7d0; font-size: .82rem; line-height: 1.5; color: #14532d; }
.lp-bubble small { display: block; margin-top: 4px; color: #16a34a; font-weight: 600; font-size: .74rem; }
.lp-track { display: flex; align-items: flex-start; justify-content: space-between; position: relative; gap: 4px; }
.lp-track::before { content: ''; position: absolute; top: 11px; left: 12%; right: 12%; height: 2px; background: #e2e8f0; }
.lp-track div { position: relative; z-index: 1; flex: 1; text-align: center; font-size: .72rem; font-weight: 600; color: var(--lp-body); }
.lp-track div i { display: block; width: 22px; height: 22px; margin: 0 auto 6px; border-radius: 50%; background: #fff; border: 2px solid #cbd5e1; }
.lp-track div.d i { background: var(--lp-primary); border-color: var(--lp-primary); }
.lp-track div.d { color: var(--lp-ink); font-weight: 700; }
.lp-stock { display: flex; flex-direction: column; gap: 8px; }
.lp-stock div { display: flex; align-items: center; gap: 8px; font-size: .78rem; font-weight: 600; }
.lp-stock em { font-style: normal; width: 64px; }
.lp-stock span { flex: 1; height: 8px; border-radius: 4px; background: #f1f5f9; overflow: hidden; }
.lp-stock span i { display: block; height: 100%; border-radius: 4px; background: var(--lp-primary); }
.lp-stock b { width: 32px; text-align: right; font-weight: 700; }
.lp-sync { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.lp-sync span { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 8px; font-size: .78rem; font-weight: 600; background: #fff; border: 1px solid var(--lp-line); }
.lp-sync span.ok { background: #dcfce7; border-color: #86efac; color: #166534; }

@media (min-width: 768px) { .lp-bento { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 992px) {
  .lp-bento { grid-template-columns: repeat(3, 1fr); }
  .lp-span2 { grid-column: span 2; }
}

/* ---------- Cara Kerja (Reflow Alami) ---------- */
.lp-steps { display: grid; grid-template-columns: 1fr; gap: 16px; }
.lp-step { padding: 24px; border-radius: 16px; background: #fff; border: 1px solid var(--lp-line); text-align: left; }
.lp-step-n {
  width: 44px; height: 44px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center;
  font-size: 1.15rem; font-weight: 800; color: #fff; background: var(--lp-primary);
}
.lp-step h3 { margin-top: 16px !important; font-size: 1.12rem; font-weight: 700; letter-spacing: -.01em; }
.lp-step p { margin-top: 8px; font-size: .92rem; }
@media (min-width: 992px) { .lp-steps { grid-template-columns: repeat(3, 1fr); gap: 20px; } }

/* ---------- Keunggulan ---------- */
.lp-adv { display: grid; grid-template-columns: 1fr; gap: 36px; align-items: center; }
.lp-adv-list { display: flex; flex-direction: column; gap: 16px; margin-top: 24px; }
.lp-adv-item { display: flex; gap: 14px; align-items: flex-start; }
.lp-adv-item > i { flex: none; width: 44px; height: 44px; border-radius: 10px; background: #f0f7ff; color: var(--lp-primary); display: inline-flex; align-items: center; justify-content: center; font-size: 1.2rem; }
.lp-adv-item h4 { font-size: 1rem; font-weight: 700; }
.lp-adv-item p { margin-top: 4px; font-size: .9rem; line-height: 1.6; }
.lp-stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.lp-stat { padding: 22px 18px; border-radius: 14px; text-align: center; border: 1px solid var(--lp-line); background: #fff; }
.lp-stat b { display: block; font-size: clamp(1.4rem, 3.2vw, 2.2rem); font-weight: 800; letter-spacing: -.03em; line-height: 1.1; color: var(--lp-primary); }
.lp-stat span { display: block; margin-top: 6px; font-size: .82rem; font-weight: 500; color: var(--lp-body); }
@media (min-width: 992px) {
  .lp-adv { grid-template-columns: 1.1fr .9fr; gap: 60px; }
}

/* ---------- FAQ (Aksesibel Keyboard & Screen Reader) ---------- */
.lp-faq { max-width: 780px; margin: 0 auto; display: flex; flex-direction: column; gap: 10px; }
.lp-faq-item { border-radius: 12px; background: #fff; border: 1px solid var(--lp-line); transition: border-color .18s ease; }
.lp-faq-item.open { border-color: #cbd5e1; box-shadow: 0 4px 12px -2px rgba(15, 23, 42, .05); }
.lp-faq-q {
  width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 18px 20px; background: transparent; border: 0;
  text-align: left; font-family: inherit; font-size: .98rem; font-weight: 600; color: var(--lp-ink); cursor: pointer; line-height: 1.45;
}
.lp-faq-q i {
  flex: none; width: 32px; height: 32px; border-radius: 8px; background: var(--lp-soft); color: var(--lp-primary);
  display: inline-flex; align-items: center; justify-content: center; transition: transform .2s ease;
}
.lp-faq-item.open .lp-faq-q i { transform: rotate(45deg); background: var(--lp-primary); color: #fff; }
.lp-faq-a { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .25s ease; }
.lp-faq-item.open .lp-faq-a { grid-template-rows: 1fr; }
.lp-faq-a > div { overflow: hidden; }
.lp-faq-a p { padding: 0 20px 20px; font-size: .94rem; }

/* ---------- Box CTA Terarah (Tanpa Mesh/Dot AI) ---------- */
.lp-cta-box {
  position: relative; overflow: hidden; border-radius: 20px; padding: 48px 24px; text-align: center; color: #fff;
  background: linear-gradient(135deg, #0f172a 0%, #0256d2 100%);
  box-shadow: 0 16px 36px -12px rgba(2, 86, 210, .35);
}
.lp-cta-box .lp-eyebrow { background: rgba(255,255,255,.15); color: #fff; }
.lp-cta-box h2 { color: #fff; margin-top: 14px !important; font-size: clamp(1.6rem, 3.5vw, 2.4rem); font-weight: 800; line-height: 1.2; letter-spacing: -.02em; max-width: 680px; margin-left: auto !important; margin-right: auto !important; }
.lp-cta-box p { color: rgba(255,255,255,.9); max-width: 540px; margin: 14px auto 0; }
.lp-cta-box .lp-cta { margin-top: 26px; justify-content: center !important; }

/* ---------- Footer Bersih & Semantik ---------- */
.lp-foot { padding: 48px 0 24px; background: #fff; border-top: 1px solid var(--lp-line); margin-top: 60px; }
.lp-foot-grid { display: grid; grid-template-columns: 1fr; gap: 32px; }
.lp-foot p.lp-foot-note { margin-top: 12px; max-width: 320px; font-size: .88rem; }
.lp-foot h4 { font-size: .82rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--lp-ink); }
.lp-foot ul { list-style: none; padding: 0; margin: 12px 0 0; display: flex; flex-direction: column; gap: 8px; }
.lp-foot ul li { list-style: none; }
.lp-foot ul a { font-size: .9rem; color: var(--lp-body); transition: color .18s ease; }
.lp-foot ul a:hover { color: var(--lp-primary); }
.lp-foot-bar { margin-top: 32px; padding-top: 20px; border-top: 1px solid var(--lp-line); font-size: .82rem; color: var(--lp-body); display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; }
@media (min-width: 768px) { .lp-foot-grid { grid-template-columns: 1.6fr 1fr 1fr; } }
`;

const FAQS = [
  {
    q: 'Apakah bisa digunakan di laptop/PC dan HP sekaligus?',
    a: `Ya, tentu saja! Aplikasi ${APP_NAME} dapat diakses melalui browser laptop/PC, tablet, maupun smartphone. Tampilan akan otomatis menyesuaikan layar dengan nyaman.`,
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
  { href: '#fitur', label: 'Fitur Kasir', icon: 'bi-grid-fill' },
  { href: '#alur', label: 'Cara Kerja', icon: 'bi-arrow-repeat' },
  { href: '#keunggulan', label: 'Keunggulan', icon: 'bi-shield-check' },
  { href: '#faq', label: 'FAQ', icon: 'bi-question-circle' },
];

const LandingPage = ({ user }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState(0);

  useEffect(() => {
    document.body.classList.add('landing-page-active');
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
            <Link to="/" className="lp-brand" aria-label={`${APP_NAME} Beranda`}>
              <span className="lp-brand-mark" aria-hidden="true"><i className="bi bi-shop"></i></span>
              <span>{APP_NAME}</span>
            </Link>

            <nav className="lp-nav-links" aria-label="Menu utama">
              {NAV_LINKS.map((l) => (
                <a key={l.href} href={l.href}>{l.label}</a>
              ))}
            </nav>

            <div className="lp-nav-cta">
              {user ? (
                <Link to="/" className="lp-btn lp-btn-primary lp-btn-sm">
                  <i className="bi bi-speedometer2" aria-hidden="true"></i> Masuk ke Dashboard
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
              aria-label="Menu navigasi"
              aria-expanded={mobileMenuOpen}
            >
              <i className={`bi ${mobileMenuOpen ? 'bi-x-lg' : 'bi-list'}`} aria-hidden="true"></i>
            </button>
          </div>

          {mobileMenuOpen && (
            <div className="lp-sheet">
              {NAV_LINKS.map((l) => (
                <a key={l.href} href={l.href} className="lp-sheet-link" onClick={closeMenu}>
                  <i className={`bi ${l.icon}`} aria-hidden="true"></i> {l.label}
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
              <span className="lp-badge">
                <i className="bi bi-shop" aria-hidden="true"></i>
                Sistem Kasir Laundry {APP_NAME}
              </span>

              <h1 className="lp-h1">
                Kelola Usaha Laundry Jadi Lebih <span className="lp-h1-accent">Cepat &amp; Anti-Ribet</span>
              </h1>

              <p className="lp-lead">
                Aplikasi kasir serba bisa untuk laundry kiloan, satuan, dan paket langganan. Otomatisasi nota via{' '}
                <strong>WhatsApp</strong>, cetak struk thermal bluetooth 58mm &amp; 80mm, serta pencatatan kasir yang tetap jalan walau internet padam.
              </p>

              <div className="lp-cta">
                <Link to="/register" className="lp-btn lp-btn-primary">
                  Coba Gratis Sekarang
                </Link>
                <Link to="/login" className="lp-btn lp-btn-ghost">
                  <i className="bi bi-box-arrow-in-right" style={{ color: 'var(--lp-primary)' }} aria-hidden="true"></i> Masuk Akun Kasir
                </Link>
              </div>

              <div className="lp-trust">
                <span><i className="bi bi-check-circle-fill" aria-hidden="true"></i> Trial 30 Hari Penuh</span>
                <span><i className="bi bi-check-circle-fill" aria-hidden="true"></i> Support Offline-First</span>
                <span><i className="bi bi-check-circle-fill" aria-hidden="true"></i> HP, Tablet &amp; Laptop</span>
              </div>
            </div>

            {/* Mockup aplikasi */}
            <div className="lp-stage" aria-hidden="true">
              <div className="lp-orders">
                <div className="o">
                  <div className="t"><span>Omzet Hari Ini</span><b>Rp 1.450.000</b></div>
                  <div className="s"><span>28 Transaksi</span><span className="lp-pill" style={{ background: '#dcfce7', color: '#166534' }}>Aktif</span></div>
                </div>
                <div className="o">
                  <div className="t"><b>#TP-0824</b><span>Rp 35.000</span></div>
                  <div className="s"><span>Bu Sarah · 5.0 Kg</span><span className="lp-pill" style={{ background: '#e0f2fe', color: '#0369a1' }}>Cuci</span></div>
                </div>
                <div className="o">
                  <div className="t"><b>#TP-0823</b><span>Rp 75.000</span></div>
                  <div className="s"><span>Bpk. Hendra · Bed Cover</span><span className="lp-pill" style={{ background: '#fef3c7', color: '#92400e' }}>Siap</span></div>
                </div>
              </div>

              <div className="lp-phone">
                <div className="lp-screen">
                  <span className="lp-notch"></span>
                  <div className="lp-app-top">
                    <b>Transaksi Kasir</b>
                    <span className="lp-app-bell"><i className="bi bi-bell" aria-hidden="true"></i></span>
                  </div>
                  <div className="lp-app-body">
                    <div className="lp-app-search">
                      <div><i className="bi bi-search" aria-hidden="true"></i> Cari nama atau kode...</div>
                      <div>Semua <i className="bi bi-chevron-down" aria-hidden="true"></i></div>
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
                        <span className="hint">+ Pilih item</span>
                      </div>
                      <div className="lp-app-card">
                        <span className="tag" style={{ background: '#ffedd5', color: '#9a3412' }}>SETRIKA SAJA</span>
                        <span className="nm">Kilat · 4 jam</span>
                        <span className="pr">Rp 12.000</span>
                        <span className="hint">+ Pilih item</span>
                      </div>
                      <div className="lp-app-card">
                        <span className="tag" style={{ background: '#fef3c7', color: '#92400e' }}>BED COVER</span>
                        <span className="nm">Jumbo · 2 hari</span>
                        <span className="pr">Rp 25.000</span>
                        <span className="hint">+ Pilih item</span>
                      </div>
                    </div>
                  </div>
                  <div className="lp-app-dock">
                    <div className="who">
                      <div className="who-user">
                        <i className="bi bi-person-circle" aria-hidden="true"></i>
                        <span>Pelanggan Umum</span>
                      </div>
                      <span className="who-badge">
                        <i className="bi bi-check-circle-fill" aria-hidden="true"></i> Lunas
                      </span>
                    </div>
                    <div className="row">
                      <div className="b1"><i className="bi bi-person-plus-fill" aria-hidden="true"></i> Pelanggan</div>
                      <div className="b2"><i className="bi bi-wallet2" aria-hidden="true"></i> <span>Bayar Rp 28.000</span></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lp-float f1">
                <i style={{ background: '#16a34a' }}><span className="bi bi-whatsapp" aria-hidden="true"></span></i>
                <span>Nota WA Terkirim<small>Otomatis &amp; instan</small></span>
              </div>
              <div className="lp-float f2">
                <i style={{ background: '#0256d2' }}><span className="bi bi-printer" aria-hidden="true"></span></i>
                <span>Thermal Bluetooth<small>Ukuran 58mm &amp; 80mm</small></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======================= STRIP STATISTIK ======================= */}
      <div className="lp-strip">
        <div className="lp-wrap">
          <div className="lp-strip-box">
            <div className="lp-strip-item"><b>30 Hari</b><span>Masa coba gratis</span></div>
            <div className="lp-strip-item"><b>Offline-First</b><span>Bisa transaksi tanpa sinyal</span></div>
            <div className="lp-strip-item"><b>58 &amp; 80 mm</b><span>Printer thermal bluetooth</span></div>
            <div className="lp-strip-item"><b>Otomatis</b><span>Kirim nota ke WhatsApp</span></div>
          </div>
        </div>
      </div>

      {/* ======================= 3. FITUR UTAMA ======================= */}
      <section id="fitur" className="lp-sec">
        <div className="lp-wrap">
          <div className="lp-head">
            <span className="lp-eyebrow">Fitur Kasir</span>
            <h2 className="lp-h2">Semua Kebutuhan Kasir {APP_NAME} dalam 1 Aplikasi</h2>
            <p>
              Didesain khusus untuk operasional laundry modern agar pencatatan tidak berantakan, kasir melayani dengan gesit, dan laporan keuangan selalu sinkron.
            </p>
          </div>

          <div className="lp-bento">
            {/* 1 */}
            <article className="lp-card lp-span2">
              <span className="lp-ico" style={{ background: '#e0f2fe', color: '#0369a1' }}><i className="bi bi-cart-plus-fill" aria-hidden="true"></i></span>
              <h3>Kasir Kiloan &amp; Satuan Kilat</h3>
              <p>
                Catat transaksi kiloan dengan hitung berat desimal otomatis, satuan (bed cover, jas, sepatu), serta paket langganan. Hanya butuh beberapa ketukan.
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
            <article className="lp-card">
              <span className="lp-ico" style={{ background: '#dcfce7', color: '#166534' }}><i className="bi bi-whatsapp" aria-hidden="true"></i></span>
              <h3>Kirim Nota Otomatis ke WhatsApp</h3>
              <p>
                Kirim ringkasan nota pesanan langsung ke nomor WhatsApp pelanggan secara personal dan instan saat order dibuat tanpa perlu simpan nomor kontak.
              </p>
              <div className="lp-viz">
                <div className="lp-bubble">
                  Halo Bu Sarah, nota <b>#KL-0824</b> sebesar Rp 35.000 sudah kami proses.
                  <small><i className="bi bi-check2-all" aria-hidden="true"></i> Terkirim otomatis</small>
                </div>
              </div>
            </article>

            {/* 3 */}
            <article className="lp-card">
              <span className="lp-ico" style={{ background: '#ede9fe', color: '#5b21b6' }}><i className="bi bi-printer-fill" aria-hidden="true"></i></span>
              <h3>Cetak Struk Thermal Bluetooth</h3>
              <p>
                Kompatibel dengan printer thermal bluetooth 58mm dan 80mm di HP maupun laptop, lengkap dengan QR Code tracking nota dan cetak format A4.
              </p>
            </article>

            {/* 4 */}
            <article className="lp-card lp-span2">
              <span className="lp-ico" style={{ background: '#fef3c7', color: '#92400e' }}><i className="bi bi-search" aria-hidden="true"></i></span>
              <h3>Tracking Status Pesanan Publik</h3>
              <p>
                Pelanggan dapat melacak sendiri status cucian (Dicuci, Dikeringkan, Disetrika, Siap Diambil) via tautan pelacakan online tanpa perlu login.
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
            <article className="lp-card">
              <span className="lp-ico" style={{ background: '#fee2e2', color: '#991b1b' }}><i className="bi bi-box-seam" aria-hidden="true"></i></span>
              <h3>Inventori &amp; Kontrol Stok</h3>
              <p>
                Kelola stok bahan habis pakai seperti deterjen, pelembut pakaian, dan plastik packing. Histori mutasi stok tercatat rapi setiap keluar-masuk.
              </p>
              <div className="lp-viz">
                <div className="lp-stock" aria-hidden="true">
                  <div><em>Plastik</em><span><i style={{ width: '85%' }}></i></span><b>104</b></div>
                  <div><em>Deterjen</em><span><i style={{ width: '40%' }}></i></span><b>8</b></div>
                  <div><em>Molto</em><span><i style={{ width: '25%' }}></i></span><b>5</b></div>
                </div>
              </div>
            </article>

            {/* 6 */}
            <article className="lp-card lp-span2">
              <span className="lp-ico" style={{ background: '#e0e7ff', color: '#3730a3' }}><i className="bi bi-wifi-off" aria-hidden="true"></i></span>
              <h3>Offline-First Tanpa Khawatir</h3>
              <p>
                Koneksi internet bermasalah di ruko? Kasir tetap bisa input transaksi dan cetak nota. Data tersimpan lokal di IndexedDB dan tersinkronisasi otomatis saat online kembali.
              </p>
              <div className="lp-viz">
                <div className="lp-sync" aria-hidden="true">
                  <span><i className="bi bi-wifi-off"></i> Offline</span>
                  <i className="bi bi-arrow-right"></i>
                  <span><i className="bi bi-receipt"></i> Transaksi lancar</span>
                  <i className="bi bi-arrow-right"></i>
                  <span className="ok"><i className="bi bi-cloud-check-fill"></i> Sinkron otomatis</span>
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
            <span className="lp-eyebrow">Alur Kerja</span>
            <h2 className="lp-h2">Operasional Kasir Praktis &amp; Efisien</h2>
            <p>Staf kasir baru dapat langsung melayani transaksi dalam hitungan menit tanpa pelatihan berbelit.</p>
          </div>

          <div className="lp-steps">
            <div className="lp-step">
              <span className="lp-step-n">1</span>
              <h3>Terima Cucian &amp; Timbang</h3>
              <p>Pilih pelanggan, masukkan kilogram cucian atau pilih item satuan. Total biaya langsung terhitung sesuai tarif toko.</p>
            </div>
            <div className="lp-step">
              <span className="lp-step-n">2</span>
              <h3>Proses &amp; Kirim Nota WA</h3>
              <p>Simpan order, cetak nota thermal atau kirim link nota ke WhatsApp. Pelanggan bisa memantau status cuci secara mandiri.</p>
            </div>
            <div className="lp-step">
              <span className="lp-step-n">3</span>
              <h3>Ambil &amp; Catat Pembayaran</h3>
              <p>Saat pakaian siap, beri tahu pelanggan. Catat pembayaran (Tunai / QRIS), dan transaksi tersimpan aman dalam pembukuan kas.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ======================= 5. KEUNGGULAN ======================= */}
      <section id="keunggulan" className="lp-sec">
        <div className="lp-wrap">
          <div className="lp-adv">
            <div>
              <span className="lp-eyebrow">Kenapa {APP_NAME}?</span>
              <h2 className="lp-h2">Aplikasi Kasir Berbasis Web yang Gesit &amp; Fleksibel</h2>
              <p style={{ marginTop: 14 }}>
                Didukung teknologi <strong style={{ color: 'var(--lp-ink)', fontWeight: 600 }}>Progressive Web App (PWA)</strong>, Anda tidak perlu mengunduh installer berat. Pasang langsung di layar utama smartphone Android, iPhone, tablet, maupun komputer kasir Windows dan Mac.
              </p>

              <div className="lp-adv-list">
                <div className="lp-adv-item">
                  <i className="bi bi-phone" aria-hidden="true"></i>
                  <div>
                    <h4>Responsif di HP, Tablet &amp; PC</h4>
                    <p>Tata letak otomatis menyesuaikan ukuran layar tanpa merusak kenyamanan navigasi.</p>
                  </div>
                </div>
                <div className="lp-adv-item">
                  <i className="bi bi-people" aria-hidden="true"></i>
                  <div>
                    <h4>Manajemen Multi-Kasir</h4>
                    <p>Owner dapat mengelola akun staf kasir dengan hak akses terkontrol agar keuangan toko tetap terlindungi.</p>
                  </div>
                </div>
                <div className="lp-adv-item">
                  <i className="bi bi-graph-up-arrow" aria-hidden="true"></i>
                  <div>
                    <h4>Laporan Omzet &amp; Keuangan Realtime</h4>
                    <p>Pantau omzet harian, mingguan, bulanan, serta rekap metode pembayaran tunai dan non-tunai secara transparan.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lp-stats">
              <div className="lp-stat"><b>30 Hari</b><span>Masa Trial Bebas Biaya</span></div>
              <div className="lp-stat"><b>PWA</b><span>Ringan &amp; Tanpa Unduh APK</span></div>
              <div className="lp-stat"><b>Thermal</b><span>Bluetooth 58mm &amp; 80mm</span></div>
              <div className="lp-stat"><b>Cloud</b><span>Auto Sync saat Online</span></div>
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
              const answerId = `faq-answer-${index}`;
              return (
                <div key={faq.q} className={`lp-faq-item ${isOpen ? 'open' : ''}`}>
                  <button
                    type="button"
                    className="lp-faq-q"
                    onClick={() => toggleFaq(index)}
                    aria-expanded={isOpen}
                    aria-controls={answerId}
                  >
                    <span>{faq.q}</span>
                    <i className="bi bi-plus-lg" aria-hidden="true"></i>
                  </button>
                  <div id={answerId} className="lp-faq-a" aria-hidden={!isOpen}>
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
            <span className="lp-eyebrow">Mulai Sekarang</span>
            <h2>Siap Membuat Toko Laundry Anda Lebih Profesional?</h2>
            <p>Daftar sekarang dan nikmati seluruh kemudahan aplikasi kasir laundry dengan masa coba 30 hari tanpa kewajiban kartu kredit.</p>
            <div className="lp-cta">
              <Link to="/register" className="lp-btn lp-btn-light">Coba Gratis 30 Hari</Link>
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
              <Link to="/" className="lp-brand" aria-label={`${APP_NAME} Beranda`}>
                <span className="lp-brand-mark" aria-hidden="true"><i className="bi bi-shop"></i></span>
                <span>{APP_NAME}</span>
              </Link>
              <p className="lp-foot-note">Sistem POS PWA Kasir Laundry. Transaksi cepat, nota WhatsApp, dan laporan keuangan dalam satu genggaman.</p>
            </div>
            <div>
              <h4>Navigasi</h4>
              <ul>
                <li><a href="#fitur">Fitur Kasir</a></li>
                <li><a href="#alur">Cara Kerja</a></li>
                <li><a href="#keunggulan">Keunggulan</a></li>
                <li><a href="#faq">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4>Akses Akun</h4>
              <ul>
                <li><Link to="/login">Masuk Akun Kasir</Link></li>
                <li><Link to="/register">Daftar Akun Baru</Link></li>
              </ul>
            </div>
          </div>
          <div className="lp-foot-bar">
            <span>&copy; {new Date().getFullYear()} {APP_NAME}. Hak cipta dilindungi.</span>
            <span>Dirancang untuk kemudahan pemilik toko laundry di Indonesia</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
