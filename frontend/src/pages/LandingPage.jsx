import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const LandingPage = ({ user }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState(null);

  useEffect(() => {
    document.body.classList.add('landing-page-active');
    return () => {
      document.body.classList.remove('landing-page-active');
    };
  }, []);

  const toggleFaq = (index) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  const faqs = [
    {
      q: 'Apakah TokoPlus bisa digunakan di laptop/PC dan HP sekaligus?',
      a: 'Ya, TokoPlus dapat diakses bersamaan melalui browser laptop, komputer PC, tablet, maupun smartphone. Tampilan otomatis menyesuaikan layar dengan nyaman tanpa perlu instalasi rumit.',
    },
    {
      q: 'Apakah kasir tetap bisa mencatat transaksi jika internet mati?',
      a: 'Tentu bisa. TokoPlus dilengkapi teknologi Offline-First. Saat koneksi internet terputus, kasir tetap bisa melayani pelanggan dan mencatat transaksi secara normal. Data akan otomatis tersinkronisasi ke server saat koneksi kembali aktif.',
    },
    {
      q: 'Printer apa saja yang didukung untuk mencetak struk nota?',
      a: 'Mendukung semua printer thermal bluetooth ukuran standar 58mm dan 80mm yang umum di pasaran, serta opsi cetak dokumen nota format A4.',
    },
    {
      q: 'Bagaimana pelanggan mengecek status cucian atau pesanan mereka?',
      a: 'Setiap transaksi memiliki tautan nota unik (contoh: /c/INV-001). Pelanggan cukup membuka tautan tersebut dari smartphone mereka untuk memantau status pesanan secara realtime tanpa perlu login.',
    },
    {
      q: 'Apakah ada masa percobaan gratis?',
      a: 'Ya! Tersedia paket Trial 30 Hari gratis penuh untuk mencoba semua fitur unggulan TokoPlus tanpa perlu kartu kredit.',
    },
  ];

  return (
    <div className="landing-page-wrapper bg-white text-dark">
      {/* ==========================================================================
          1. TOP NAVBAR
          ========================================================================== */}
      <header
        className="sticky-top bg-white border-bottom"
        style={{ zIndex: 1020, borderColor: '#e2e8f0' }}
      >
        <div className="container" style={{ maxWidth: '1200px' }}>
          <div className="d-flex align-items-center justify-content-between py-3">
            {/* Logo Brand: TokoPlus */}
            <Link to="/" className="d-flex align-items-center text-decoration-none gap-2">
              <div
                className="d-inline-flex align-items-center justify-content-center rounded-3 text-white shadow-xs"
                style={{
                  width: '38px',
                  height: '38px',
                  backgroundColor: '#0134d4',
                }}
              >
                <i className="bi bi-shop fs-5"></i>
              </div>
              <div className="d-flex flex-column">
                <span className="fw-bold fs-5 lh-1" style={{ letterSpacing: '-0.3px', color: '#0f172a' }}>
                  Toko<span style={{ color: '#0134d4' }}>Plus</span>
                </span>
                <span className="text-muted small mt-1" style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.4px' }}>
                  KASIR LAUNDRY & TOKO
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="d-none d-md-flex align-items-center gap-4">
              <a href="#fitur" className="text-secondary text-decoration-none fw-medium small hover-primary">
                Fitur
              </a>
              <a href="#alur" className="text-secondary text-decoration-none fw-medium small hover-primary">
                Cara Kerja
              </a>
              <a href="#keunggulan" className="text-secondary text-decoration-none fw-medium small hover-primary">
                Keunggulan
              </a>
              <a href="#faq" className="text-secondary text-decoration-none fw-medium small hover-primary">
                FAQ
              </a>
            </nav>

            {/* Action Buttons: Keduanya mengarah ke /login */}
            <div className="d-none d-md-flex align-items-center gap-2">
              {user ? (
                <Link to="/" className="btn btn-primary rounded-pill px-4 py-2 fw-semibold small shadow-xs">
                  <i className="bi bi-speedometer2 me-2"></i> Buka Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="btn btn-outline-primary rounded-pill px-3 py-2 fw-semibold small"
                    style={{ borderColor: '#0134d4', color: '#0134d4' }}
                  >
                    Masuk
                  </Link>
                  <Link
                    to="/register"
                    className="btn btn-primary rounded-pill px-4 py-2 fw-semibold small shadow-xs text-white"
                    style={{ backgroundColor: '#0134d4', borderColor: '#0134d4' }}
                  >
                    Coba Gratis 30 Hari
                  </Link>
                </>
              )}
            </div>

            {/* Mobile Menu Toggle Button */}
            <button
              type="button"
              className="btn btn-light d-md-none border-0 p-2 text-dark"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Buka menu"
            >
              <i className={`bi ${mobileMenuOpen ? 'bi-x-lg' : 'bi-list'} fs-4`}></i>
            </button>
          </div>

          {/* Mobile Collapsible Navigation Menu */}
          {mobileMenuOpen && (
            <div className="d-md-none py-3 border-top animate-fade-in" style={{ borderColor: '#e2e8f0' }}>
              <div className="d-flex flex-column gap-2 mb-3">
                <a
                  href="#fitur"
                  className="text-dark text-decoration-none py-2 fw-medium small"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <i className="bi bi-grid me-2 text-primary"></i> Fitur
                </a>
                <a
                  href="#alur"
                  className="text-dark text-decoration-none py-2 fw-medium small"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <i className="bi bi-arrow-repeat me-2 text-primary"></i> Cara Kerja
                </a>
                <a
                  href="#keunggulan"
                  className="text-dark text-decoration-none py-2 fw-medium small"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <i className="bi bi-shield-check me-2 text-primary"></i> Keunggulan
                </a>
                <a
                  href="#faq"
                  className="text-dark text-decoration-none py-2 fw-medium small"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <i className="bi bi-question-circle me-2 text-primary"></i> FAQ
                </a>
              </div>
              <div className="d-flex flex-column gap-2 pt-3 border-top" style={{ borderColor: '#e2e8f0' }}>
                {user ? (
                  <Link to="/" className="btn btn-primary w-100 rounded-pill py-2 fw-semibold small text-white">
                    Buka Dashboard
                  </Link>
                ) : (
                  <>
                    <Link to="/login" className="btn btn-outline-primary w-100 rounded-pill py-2 fw-semibold small">
                      Masuk
                    </Link>
                    <Link to="/login" className="btn btn-primary w-100 rounded-pill py-2 fw-semibold small text-white">
                      Coba Gratis 30 Hari
                    </Link>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ==========================================================================
          2. HERO SECTION
          ========================================================================== */}
      <section
        className="position-relative overflow-hidden py-5 py-lg-6"
        style={{
          backgroundColor: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <div className="container" style={{ maxWidth: '1200px' }}>
          <div className="row align-items-center g-4 g-lg-5">
            {/* Sisi Kiri: Headline & CTA */}
            <div className="col-12 col-lg-6 text-center text-lg-start">
              {/* Badge Affan */}
              <div
                className="d-inline-flex align-items-center gap-2 rounded-pill px-3 py-1 mb-3"
                style={{
                  backgroundColor: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  color: '#1d4ed8',
                }}
              >
                <i className="bi bi-check-circle-fill text-primary" style={{ fontSize: '0.85rem' }}></i>
                <span className="fw-semibold small" style={{ fontSize: '0.8rem' }}>
                  Aplikasi Kasir Laundry & Toko Modern
                </span>
              </div>

              {/* Headline */}
              <h1
                className="fw-bold mb-3 display-5"
                style={{
                  color: '#0f172a',
                  letterSpacing: '-0.8px',
                  lineHeight: 1.2,
                }}
              >
                Kelola Usaha Laundry Jadi Lebih{' '}
                <span style={{ color: '#0134d4' }}>
                  Cepat & Rapi
                </span>
              </h1>

              {/* Subheadline */}
              <p className="lead mb-4 pe-lg-3" style={{ color: '#475569', fontSize: '1.05rem', lineHeight: 1.65 }}>
                TokoPlus mempermudah pencatatan order laundry kiloan dan satuan, pengiriman nota otomatis ke <strong>WhatsApp</strong> pelanggan, cetak struk thermal bluetooth 58mm, dan laporan keuangan realtime — siap pakai di laptop maupun handphone.
              </p>

              {/* Tombol CTA (Login & Register keduanya mengarah ke /login) */}
              <div className="d-flex flex-column flex-sm-row justify-content-center justify-content-lg-start gap-3 mb-4">
                <Link
                  to="/login"
                  className="btn btn-primary btn-lg rounded-pill px-4 py-3 fw-bold shadow-xs d-flex align-items-center justify-content-center gap-2 text-white"
                  style={{ backgroundColor: '#0134d4', borderColor: '#0134d4' }}
                >
                  <span>Mulai Coba Gratis</span>
                  <i className="bi bi-arrow-right"></i>
                </Link>
                <Link
                  to="/login"
                  className="btn btn-outline-secondary btn-lg rounded-pill px-4 py-3 fw-semibold d-flex align-items-center justify-content-center gap-2 bg-white"
                  style={{ borderColor: '#cbd5e1', color: '#1e293b' }}
                >
                  <i className="bi bi-box-arrow-in-right text-primary"></i>
                  <span>Masuk Akun Kasir</span>
                </Link>
              </div>

              {/* Trust Signals */}
              <div className="d-flex flex-wrap justify-content-center justify-content-lg-start gap-4 small" style={{ color: '#64748b' }}>
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-shield-check text-success fs-6"></i>
                  <span>Trial 30 Hari Gratis</span>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-wifi-off text-primary fs-6"></i>
                  <span>Support Offline-First</span>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-laptop text-primary fs-6"></i>
                  <span>Laptop & Smartphone</span>
                </div>
              </div>
            </div>

            {/* Sisi Kanan: Live POS Mockup Card */}
            <div className="col-12 col-lg-6">
              <div className="position-relative mx-auto" style={{ maxWidth: '480px' }}>
                {/* Main Card Mockup */}
                <div
                  className="card border shadow-sm rounded-4 overflow-hidden position-relative bg-white"
                  style={{ borderColor: '#e2e8f0' }}
                >
                  {/* Card Header */}
                  <div
                    className="px-4 py-3 text-white d-flex align-items-center justify-content-between"
                    style={{ backgroundColor: '#0134d4' }}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <div
                        className="rounded-circle bg-white text-primary d-flex align-items-center justify-content-center"
                        style={{ width: '32px', height: '32px' }}
                      >
                        <i className="bi bi-shop fs-6"></i>
                      </div>
                      <div>
                        <div className="fw-bold small lh-1">Laundry Berkah Bersih</div>
                        <span className="badge bg-white text-primary rounded-pill px-2 py-1 mt-1 fw-semibold" style={{ fontSize: '9px' }}>
                          Kasir Aktif
                        </span>
                      </div>
                    </div>
                    <span className="badge bg-white text-dark rounded-pill px-3 py-1 small fw-semibold">
                      Hari Ini
                    </span>
                  </div>

                  {/* Card Body */}
                  <div className="p-4 bg-light">
                    {/* Ringkasan Omzet */}
                    <div className="row g-2 mb-3">
                      <div className="col-6">
                        <div className="bg-white p-3 rounded-3 border" style={{ borderColor: '#e2e8f0' }}>
                          <div className="text-muted small" style={{ fontSize: '11px' }}>Omzet Hari Ini</div>
                          <div className="fw-bold fs-6" style={{ color: '#0134d4' }}>Rp 1.450.000</div>
                        </div>
                      </div>
                      <div className="col-6">
                        <div className="bg-white p-3 rounded-3 border" style={{ borderColor: '#e2e8f0' }}>
                          <div className="text-muted small" style={{ fontSize: '11px' }}>Total Transaksi</div>
                          <div className="fw-bold text-dark fs-6">28 Order</div>
                        </div>
                      </div>
                    </div>

                    {/* Order Item 1 */}
                    <div className="bg-white p-3 rounded-3 border mb-2" style={{ borderColor: '#e2e8f0' }}>
                      <div className="d-flex justify-content-between align-items-start mb-1">
                        <div>
                          <span className="fw-bold small" style={{ color: '#0134d4' }}>#TP-0824</span>
                          <span className="badge bg-primary-subtle text-primary ms-2" style={{ fontSize: '9px' }}>
                            Proses Cuci
                          </span>
                        </div>
                        <span className="fw-bold text-dark small">Rp 35.000</span>
                      </div>
                      <div className="d-flex justify-content-between align-items-center small text-muted" style={{ fontSize: '12px' }}>
                        <span><i className="bi bi-person me-1"></i> Bu Sarah (5.0 Kg Cuci Komplit)</span>
                        <span className="badge bg-success-subtle text-success border border-success" style={{ fontSize: '9px' }}>Lunas</span>
                      </div>
                    </div>

                    {/* Order Item 2 */}
                    <div className="bg-white p-3 rounded-3 border mb-3" style={{ borderColor: '#e2e8f0' }}>
                      <div className="d-flex justify-content-between align-items-start mb-1">
                        <div>
                          <span className="fw-bold small" style={{ color: '#0134d4' }}>#TP-0823</span>
                          <span className="badge bg-warning-subtle text-warning-emphasis ms-2" style={{ fontSize: '9px' }}>
                            Siap Diambil
                          </span>
                        </div>
                        <span className="fw-bold text-dark small">Rp 75.000</span>
                      </div>
                      <div className="d-flex justify-content-between align-items-center small text-muted" style={{ fontSize: '12px' }}>
                        <span><i className="bi bi-person me-1"></i> Bpk. Hendra (Bed Cover)</span>
                        <span className="badge bg-success-subtle text-success border border-success" style={{ fontSize: '9px' }}>Lunas</span>
                      </div>
                    </div>

                    {/* Action Preview */}
                    <div className="d-flex gap-2">
                      <button type="button" className="btn btn-outline-success btn-sm w-100 rounded-pill d-flex align-items-center justify-content-center gap-2 py-2">
                        <i className="bi bi-whatsapp"></i>
                        <span className="small fw-semibold">Nota WhatsApp</span>
                      </button>
                      <button type="button" className="btn btn-primary btn-sm w-100 rounded-pill d-flex align-items-center justify-content-center gap-2 py-2 text-white" style={{ backgroundColor: '#0134d4', borderColor: '#0134d4' }}>
                        <i className="bi bi-printer"></i>
                        <span className="small fw-semibold">Cetak Struk</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Floating Info 1 */}
                <div
                  className="position-absolute bg-white rounded-pill px-3 py-2 shadow-sm border d-none d-sm-flex align-items-center gap-2"
                  style={{
                    bottom: '-16px',
                    left: '-16px',
                    zIndex: 2,
                    fontSize: '12px',
                    fontWeight: 600,
                    borderColor: '#e2e8f0',
                  }}
                >
                  <span className="rounded-circle bg-success text-white d-flex align-items-center justify-content-center" style={{ width: '22px', height: '22px' }}>
                    <i className="bi bi-check-lg"></i>
                  </span>
                  <span style={{ color: '#0f172a' }}>Nota WA Terkirim Otomatis</span>
                </div>

                {/* Floating Info 2 */}
                <div
                  className="position-absolute bg-white rounded-pill px-3 py-2 shadow-sm border d-none d-sm-flex align-items-center gap-2"
                  style={{
                    top: '-16px',
                    right: '-16px',
                    zIndex: 2,
                    fontSize: '12px',
                    fontWeight: 600,
                    borderColor: '#e2e8f0',
                  }}
                >
                  <span className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center" style={{ width: '22px', height: '22px' }}>
                    <i className="bi bi-cloud-check"></i>
                  </span>
                  <span style={{ color: '#0f172a' }}>Sync Cloud Otomatis</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==========================================================================
          3. CORE FEATURES GRID
          ========================================================================== */}
      <section id="fitur" className="py-5 py-lg-6 bg-white">
        <div className="container" style={{ maxWidth: '1200px' }}>
          <div className="text-center mb-5">
            <span
              className="badge rounded-pill px-3 py-1 mb-2 fw-semibold"
              style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}
            >
              Fitur Lengkap
            </span>
            <h2 className="fw-bold mb-2" style={{ color: '#0f172a', letterSpacing: '-0.5px' }}>
              Semua Kebutuhan Kasir Laundry dalam 1 Aplikasi
            </h2>
            <p className="mx-auto" style={{ color: '#475569', maxWidth: '640px', lineHeight: 1.6 }}>
              Didesain khusus untuk operasional toko laundry agar pencatatan tidak berantakan, pelanggan terlayani cepat, dan keuangan selalu transparan.
            </p>
          </div>

          <div className="row g-4">
            {/* Fitur 1 */}
            <div className="col-12 col-md-6 col-lg-4">
              <div
                className="card h-100 border rounded-4 p-4 hover-lift transition-all"
                style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}
              >
                <div
                  className="rounded-3 d-inline-flex align-items-center justify-content-center mb-3 text-white"
                  style={{ width: '48px', height: '48px', backgroundColor: '#0134d4' }}
                >
                  <i className="bi bi-cart-check fs-4"></i>
                </div>
                <h5 className="fw-bold text-dark mb-2">Kasir Kiloan & Satuan Kilat</h5>
                <p className="small mb-0" style={{ color: '#475569', lineHeight: 1.6 }}>
                  Catat transaksi kiloan dengan hitung berat desimal otomatis, satuan (bed cover, jas, selimut), serta paket bulanan hanya dalam beberapa sentuhan.
                </p>
              </div>
            </div>

            {/* Fitur 2 */}
            <div className="col-12 col-md-6 col-lg-4">
              <div
                className="card h-100 border rounded-4 p-4 hover-lift transition-all"
                style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}
              >
                <div
                  className="rounded-3 d-inline-flex align-items-center justify-content-center mb-3 text-white"
                  style={{ width: '48px', height: '48px', backgroundColor: '#10b981' }}
                >
                  <i className="bi bi-whatsapp fs-4"></i>
                </div>
                <h5 className="fw-bold text-dark mb-2">Kirim Nota Otomatis ke WhatsApp</h5>
                <p className="small mb-0" style={{ color: '#475569', lineHeight: 1.6 }}>
                  Hemat biaya kertas struk! Kirim ringkasan nota pesanan langsung ke nomor WhatsApp pelanggan secara personal dan otomatis saat order dibuat.
                </p>
              </div>
            </div>

            {/* Fitur 3 */}
            <div className="col-12 col-md-6 col-lg-4">
              <div
                className="card h-100 border rounded-4 p-4 hover-lift transition-all"
                style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}
              >
                <div
                  className="rounded-3 d-inline-flex align-items-center justify-content-center mb-3 text-white"
                  style={{ width: '48px', height: '48px', backgroundColor: '#4f46e5' }}
                >
                  <i className="bi bi-printer fs-4"></i>
                </div>
                <h5 className="fw-bold text-dark mb-2">Cetak Struk Thermal Bluetooth</h5>
                <p className="small mb-0" style={{ color: '#475569', lineHeight: 1.6 }}>
                  Kompatibel dengan printer thermal bluetooth 58mm dan 80mm di HP maupun laptop, lengkap dengan QR Code tracking nota dan cetak invoice format A4.
                </p>
              </div>
            </div>

            {/* Fitur 4 */}
            <div className="col-12 col-md-6 col-lg-4">
              <div
                className="card h-100 border rounded-4 p-4 hover-lift transition-all"
                style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}
              >
                <div
                  className="rounded-3 d-inline-flex align-items-center justify-content-center mb-3 text-white"
                  style={{ width: '48px', height: '48px', backgroundColor: '#d97706' }}
                >
                  <i className="bi bi-search fs-4"></i>
                </div>
                <h5 className="fw-bold text-dark mb-2">Tracking Status Pesanan Publik</h5>
                <p className="small mb-0" style={{ color: '#475569', lineHeight: 1.6 }}>
                  Pelanggan dapat melacak sendiri progres pengerjaan cucian (Dicuci, Dikeringkan, Disetrika, Selesai) via tautan pelacakan online tanpa perlu login.
                </p>
              </div>
            </div>

            {/* Fitur 5 */}
            <div className="col-12 col-md-6 col-lg-4">
              <div
                className="card h-100 border rounded-4 p-4 hover-lift transition-all"
                style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}
              >
                <div
                  className="rounded-3 d-inline-flex align-items-center justify-content-center mb-3 text-white"
                  style={{ width: '48px', height: '48px', backgroundColor: '#db2777' }}
                >
                  <i className="bi bi-boxes fs-4"></i>
                </div>
                <h5 className="fw-bold text-dark mb-2">Inventori & Kontrol Stok</h5>
                <p className="small mb-0" style={{ color: '#475569', lineHeight: 1.6 }}>
                  Kelola stok bahan habis pakai seperti deterjen, pelembut pakaian, dan plastik packing. Histori mutasi stok tercatat rapi setiap keluar-masuk.
                </p>
              </div>
            </div>

            {/* Fitur 6 */}
            <div className="col-12 col-md-6 col-lg-4">
              <div
                className="card h-100 border rounded-4 p-4 hover-lift transition-all"
                style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}
              >
                <div
                  className="rounded-3 d-inline-flex align-items-center justify-content-center mb-3 text-white"
                  style={{ width: '48px', height: '48px', backgroundColor: '#0284c7' }}
                >
                  <i className="bi bi-wifi-off fs-4"></i>
                </div>
                <h5 className="fw-bold text-dark mb-2">Offline-First Tanpa Khawatir</h5>
                <p className="small mb-0" style={{ color: '#475569', lineHeight: 1.6 }}>
                  Koneksi internet bermasalah? Kasir tetap bisa input transaksi dan cetak nota. Begitu koneksi online, data otomatis tersinkronisasi ke server.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==========================================================================
          4. HOW IT WORKS (Cara Kerja 3 Langkah)
          ========================================================================== */}
      <section id="alur" className="py-5 py-lg-6" style={{ backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
        <div className="container" style={{ maxWidth: '1200px' }}>
          <div className="text-center mb-5">
            <span
              className="badge rounded-pill px-3 py-1 mb-2 fw-semibold"
              style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}
            >
              Alur Sangat Simpel
            </span>
            <h2 className="fw-bold mb-2" style={{ color: '#0f172a', letterSpacing: '-0.5px' }}>
              3 Langkah Mudah Mengoperasikan Kasir
            </h2>
            <p className="mx-auto" style={{ color: '#475569', maxWidth: '580px', lineHeight: 1.6 }}>
              Bahkan kasir baru pun bisa langsung mengoperasikan sistem ini dalam waktu 5 menit tanpa pelatihan rumit.
            </p>
          </div>

          <div className="row g-4">
            <div className="col-12 col-md-4">
              <div className="card border bg-white rounded-4 p-4 text-center h-100" style={{ borderColor: '#e2e8f0' }}>
                <div
                  className="rounded-circle text-white fw-bold d-inline-flex align-items-center justify-content-center mx-auto mb-3"
                  style={{ width: '56px', height: '56px', backgroundColor: '#0134d4', fontSize: '20px' }}
                >
                  1
                </div>
                <h5 className="fw-bold text-dark mb-2">Terima Cucian & Timbang</h5>
                <p className="small mb-0" style={{ color: '#475569', lineHeight: 1.6 }}>
                  Pilih pelanggan, masukkan kilogram cucian atau pilih item satuan. Total biaya langsung terhitung otomatis sesuai tarif toko.
                </p>
              </div>
            </div>

            <div className="col-12 col-md-4">
              <div className="card border bg-white rounded-4 p-4 text-center h-100" style={{ borderColor: '#e2e8f0' }}>
                <div
                  className="rounded-circle text-white fw-bold d-inline-flex align-items-center justify-content-center mx-auto mb-3"
                  style={{ width: '56px', height: '56px', backgroundColor: '#0134d4', fontSize: '20px' }}
                >
                  2
                </div>
                <h5 className="fw-bold text-dark mb-2">Proses & Kirim Nota WA</h5>
                <p className="small mb-0" style={{ color: '#475569', lineHeight: 1.6 }}>
                  Simpan order, cetak nota thermal atau kirim link nota ke WhatsApp pelanggan. Pelanggan bisa memantau progres cuci kapan saja.
                </p>
              </div>
            </div>

            <div className="col-12 col-md-4">
              <div className="card border bg-white rounded-4 p-4 text-center h-100" style={{ borderColor: '#e2e8f0' }}>
                <div
                  className="rounded-circle text-white fw-bold d-inline-flex align-items-center justify-content-center mx-auto mb-3"
                  style={{ width: '56px', height: '56px', backgroundColor: '#10b981', fontSize: '20px' }}
                >
                  3
                </div>
                <h5 className="fw-bold text-dark mb-2">Ambil & Catat Pembayaran</h5>
                <p className="small mb-0" style={{ color: '#475569', lineHeight: 1.6 }}>
                  Saat pakaian selesai, beri tahu pelanggan. Terima pembayaran (Tunai / QRIS), dan transaksi tersimpan aman dalam laporan keuangan.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==========================================================================
          5. ADVANTAGES & STATS
          ========================================================================== */}
      <section id="keunggulan" className="py-5 py-lg-6 bg-white">
        <div className="container" style={{ maxWidth: '1200px' }}>
          <div className="row align-items-center g-4 g-lg-5">
            <div className="col-12 col-lg-6">
              <span
                className="badge rounded-pill px-3 py-1 mb-2 fw-semibold"
                style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}
              >
                Kenapa TokoPlus?
              </span>
              <h2 className="fw-bold mb-3" style={{ color: '#0f172a', letterSpacing: '-0.5px' }}>
                Teknologi Kasir Modern yang Ringan dan Fleksibel
              </h2>
              <p className="mb-4" style={{ color: '#475569', lineHeight: 1.7 }}>
                Dibangun dengan teknologi <strong>Progressive Web App (PWA)</strong>, aplikasi ini sangat ringan tanpa instalasi file APK berat. Anda bisa memasang langsung di layar beranda smartphone Android, iPhone, tablet, maupun komputer desktop.
              </p>

              <div className="d-flex flex-column gap-3">
                <div className="d-flex align-items-start gap-3">
                  <div
                    className="rounded-circle text-primary p-2 d-flex align-items-center justify-content-center flex-shrink-0"
                    style={{ width: '40px', height: '40px', backgroundColor: '#eff6ff' }}
                  >
                    <i className="bi bi-phone fs-5"></i>
                  </div>
                  <div>
                    <h6 className="fw-bold text-dark mb-1">Responsif di Semua Ukuran Layar</h6>
                    <p className="small mb-0" style={{ color: '#475569' }}>
                      Tampilan otomatis adaptif: layar desktop luas dan terstruktur, layar HP pas dan mudah digunakan.
                    </p>
                  </div>
                </div>

                <div className="d-flex align-items-start gap-3">
                  <div
                    className="rounded-circle text-primary p-2 d-flex align-items-center justify-content-center flex-shrink-0"
                    style={{ width: '40px', height: '40px', backgroundColor: '#eff6ff' }}
                  >
                    <i className="bi bi-people fs-5"></i>
                  </div>
                  <div>
                    <h6 className="fw-bold text-dark mb-1">Manajemen Multi-Kasir</h6>
                    <p className="small mb-0" style={{ color: '#475569' }}>
                      Owner dapat menambah akun staf kasir dengan hak akses terkontrol agar keuangan toko tetap aman.
                    </p>
                  </div>
                </div>

                <div className="d-flex align-items-start gap-3">
                  <div
                    className="rounded-circle text-primary p-2 d-flex align-items-center justify-content-center flex-shrink-0"
                    style={{ width: '40px', height: '40px', backgroundColor: '#eff6ff' }}
                  >
                    <i className="bi bi-graph-up fs-5"></i>
                  </div>
                  <div>
                    <h6 className="fw-bold text-dark mb-1">Laporan Keuangan Realtime</h6>
                    <p className="small mb-0" style={{ color: '#475569' }}>
                      Rekap omzet harian, mingguan, bulanan, serta perbandingan metode pembayaran tunai dan non-tunai.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-12 col-lg-6">
              {/* Stats Card Grid */}
              <div className="row g-3">
                <div className="col-6">
                  <div
                    className="card border p-4 rounded-4 text-center bg-white shadow-xs h-100 hover-lift"
                    style={{ borderColor: '#e2e8f0' }}
                  >
                    <div
                      className="rounded-circle d-inline-flex align-items-center justify-content-center mx-auto mb-2 text-primary"
                      style={{ width: '40px', height: '40px', backgroundColor: '#eff6ff' }}
                    >
                      <i className="bi bi-calendar-check fs-6"></i>
                    </div>
                    <h2 className="fw-bold display-5 mb-1" style={{ color: '#0134d4' }}>30</h2>
                    <p className="small mb-0" style={{ color: '#64748b' }}>Hari Trial Gratis Penuh</p>
                  </div>
                </div>
                <div className="col-6">
                  <div
                    className="card border p-4 rounded-4 text-center bg-white shadow-xs h-100 hover-lift"
                    style={{ borderColor: '#e2e8f0' }}
                  >
                    <div
                      className="rounded-circle d-inline-flex align-items-center justify-content-center mx-auto mb-2 text-primary"
                      style={{ width: '40px', height: '40px', backgroundColor: '#eff6ff' }}
                    >
                      <i className="bi bi-wifi-off fs-6"></i>
                    </div>
                    <h2 className="fw-bold display-5 mb-1" style={{ color: '#0134d4' }}>100%</h2>
                    <p className="small mb-0" style={{ color: '#64748b' }}>Support Mode Offline</p>
                  </div>
                </div>
                <div className="col-6">
                  <div
                    className="card border p-4 rounded-4 text-center bg-white shadow-xs h-100 hover-lift"
                    style={{ borderColor: '#e2e8f0' }}
                  >
                    <div
                      className="rounded-circle d-inline-flex align-items-center justify-content-center mx-auto mb-2 text-primary"
                      style={{ width: '40px', height: '40px', backgroundColor: '#eff6ff' }}
                    >
                      <i className="bi bi-printer fs-6"></i>
                    </div>
                    <h2 className="fw-bold display-5 mb-1" style={{ color: '#0134d4' }}>58mm</h2>
                    <p className="small mb-0" style={{ color: '#64748b' }}>Thermal Bluetooth Ready</p>
                  </div>
                </div>
                <div className="col-6">
                  <div
                    className="card border p-4 rounded-4 text-center bg-white shadow-xs h-100 hover-lift"
                    style={{ borderColor: '#e2e8f0' }}
                  >
                    <div
                      className="rounded-circle d-inline-flex align-items-center justify-content-center mx-auto mb-2 text-success"
                      style={{ width: '40px', height: '40px', backgroundColor: '#ecfdf5' }}
                    >
                      <i className="bi bi-clock-history fs-6"></i>
                    </div>
                    <h2 className="fw-bold display-5 mb-1" style={{ color: '#10b981' }}>&lt; 1 Menit</h2>
                    <p className="small mb-0" style={{ color: '#64748b' }}>Waktu Buat Transaksi</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==========================================================================
          6. FAQ SECTION
          ========================================================================== */}
      <section id="faq" className="py-5 py-lg-6" style={{ backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
        <div className="container" style={{ maxWidth: '800px' }}>
          <div className="text-center mb-5">
            <span
              className="badge rounded-pill px-3 py-1 mb-2 fw-semibold"
              style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}
            >
              Tanya Jawab
            </span>
            <h2 className="fw-bold mb-2" style={{ color: '#0f172a', letterSpacing: '-0.5px' }}>
              Pertanyaan yang Sering Diajukan
            </h2>
            <p style={{ color: '#475569' }}>
              Punya pertanyaan seputar aplikasi TokoPlus? Berikut jawaban ringkasnya.
            </p>
          </div>

          <div className="d-flex flex-column gap-2">
            {faqs.map((faq, index) => {
              const isOpen = activeFaq === index;
              return (
                <div
                  key={index}
                  className="card border rounded-3 overflow-hidden bg-white"
                  style={{ borderColor: '#e2e8f0' }}
                >
                  <button
                    type="button"
                    className="w-100 text-start px-4 py-3 border-0 bg-transparent d-flex align-items-center justify-content-between fw-semibold"
                    style={{ fontSize: '0.96rem', color: '#0f172a' }}
                    onClick={() => toggleFaq(index)}
                  >
                    <span>{faq.q}</span>
                    <i className={`bi ${isOpen ? 'bi-chevron-up text-primary' : 'bi-chevron-down text-muted'} ms-2`}></i>
                  </button>
                  {isOpen && (
                    <div
                      className="px-4 pb-3 pt-2 small border-top"
                      style={{ color: '#475569', lineHeight: 1.65, backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}
                    >
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ==========================================================================
          7. BOTTOM CTA SECTION
          ========================================================================== */}
      <section className="py-5 py-lg-6 bg-white">
        <div className="container" style={{ maxWidth: '1200px' }}>
          <div
            className="rounded-4 p-4 p-md-5 text-white text-center position-relative overflow-hidden shadow-xs"
            style={{
              backgroundColor: '#0134d4',
            }}
          >
            <div className="position-relative" style={{ maxWidth: '680px', margin: '0 auto' }}>
              <span className="badge bg-white text-primary rounded-pill px-3 py-1 mb-3 fw-semibold small">
                TokoPlus POS System
              </span>
              <h2 className="fw-bold display-6 mb-3 text-white" style={{ color: '#ffffff' }}>
                Siap Membuat Toko Laundry Anda Lebih Profesional?
              </h2>
              <p className="lead fs-6 mb-4 text-white opacity-90" style={{ lineHeight: 1.6, color: '#ffffff' }}>
                Daftar sekarang dan nikmati seluruh kemudahan TokoPlus dengan trial gratis 30 hari tanpa biaya pendaftaran.
              </p>

              {/* Login & Register keduanya mengarah ke /login */}
              <div className="d-flex flex-column flex-sm-row justify-content-center gap-3">
                <Link
                  to="/register"
                  className="btn btn-light btn-lg rounded-pill px-4 py-3 fw-bold text-primary shadow-xs"
                >
                  Coba Gratis 30 Hari
                </Link>
                <Link
                  to="/login"
                  className="btn btn-outline-light btn-lg rounded-pill px-4 py-3 fw-semibold"
                  style={{ borderWidth: '1.5px' }}
                >
                  Masuk Akun Kasir
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==========================================================================
          8. FOOTER
          ========================================================================== */}
      <footer className="py-4 border-top" style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}>
        <div className="container" style={{ maxWidth: '1200px' }}>
          <div className="d-flex flex-column flex-md-row align-items-center justify-content-between gap-3 text-center text-md-start">
            <div className="d-flex align-items-center gap-2">
              <div
                className="rounded-3 d-flex align-items-center justify-content-center text-white"
                style={{ width: '28px', height: '28px', backgroundColor: '#0134d4', fontSize: '13px' }}
              >
                <i className="bi bi-shop"></i>
              </div>
              <span className="fw-bold text-dark small">TokoPlus POS System</span>
            </div>

            <div className="d-flex align-items-center gap-4 small">
              <a href="#fitur" className="text-secondary text-decoration-none hover-primary">
                Fitur
              </a>
              <a href="#alur" className="text-secondary text-decoration-none hover-primary">
                Cara Kerja
              </a>
              <a href="#keunggulan" className="text-secondary text-decoration-none hover-primary">
                Keunggulan
              </a>
              <Link to="/login" className="text-secondary text-decoration-none hover-primary">
                Masuk
              </Link>
              <Link to="/login" className="text-secondary text-decoration-none hover-primary">
                Daftar
              </Link>
            </div>

            <div className="text-muted small" style={{ fontSize: '11px' }}>
              &copy; {new Date().getFullYear()} TokoPlus. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
