import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Link } from 'react-router-dom';

const Home = ({ user }) => {
  // Ambil statistik singkat
  const stats = useLiveQuery(async () => {
    const allOrders = await db.orders.toArray();
    const today = new Date().toLocaleDateString();
    const todayOrders = allOrders.filter(o => new Date(o.createdAt).toLocaleDateString() === today);

    const totalOmzet = todayOrders.reduce((acc, o) => acc + o.total, 0);
    const pendingOrders = allOrders.filter(o => o.status === 'Proses').length;

    return {
      totalOmzet,
      orderHariIni: todayOrders.length,
      pendingOrders
    };
  });

  return (
    <div className="home-wrapper pb-5">
      {/* Kartu Profil & Welcome */}
      <div className="card shadow-sm border-0 mb-4 overflow-hidden" style={{ borderRadius: '20px', background: 'linear-gradient(135deg, #0134d4 0%, #2855e1 100%)' }}>
        <div className="card-body p-4 text-white">
          <div className="d-flex align-items-center mb-3">
            <div className="avatar-wrapper me-3">
              <div className="bg-white rounded-circle d-flex align-items-center justify-content-center" style={{ width: '60px', height: '60px' }}>
                <i className="bi bi-person-fill text-primary fs-2"></i>
              </div>
            </div>
            <div>
              <small className="opacity-75 d-block">Selamat Datang,</small>
              <h4 className="fw-bold mb-0">{user.fullname}</h4>
              <small className="opacity-50">@{user.username}</small>
            </div>
          </div>
          <div className="row g-2 mt-2">
            <div className="col-6">
              <div className="bg-white bg-opacity-10 rounded p-2 text-center">
                <small className="d-block opacity-75">Status</small>
                <span className="fw-bold"><i className="bi bi-patch-check-fill me-1"></i> Aktif</span>
              </div>
            </div>
            <div className="col-6">
              <div className="bg-white bg-opacity-10 rounded p-2 text-center">
                <small className="d-block opacity-75">Shift</small>
                <span className="fw-bold">Pagi</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Statistik Ringkas */}
      <h6 className="fw-bold mb-3">Ringkasan Hari Ini</h6>
      <div className="row g-3 mb-4">
        <div className="col-6">
          <div className="card shadow-sm border-0 h-100" style={{ borderRadius: '15px' }}>
            <div className="card-body p-3 text-center">
              <div className="icon-circle bg-success-light text-success mb-2 mx-auto" style={{ width: '45px', height: '45px', backgroundColor: '#d1f7e0', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="bi bi-wallet2 fs-4"></i>
              </div>
              <small className="text-muted d-block">Omzet</small>
              <h6 className="fw-bold mb-0">Rp {stats?.totalOmzet.toLocaleString() || 0}</h6>
            </div>
          </div>
        </div>
        <div className="col-6">
          <div className="card shadow-sm border-0 h-100" style={{ borderRadius: '15px' }}>
            <div className="card-body p-3 text-center">
              <div className="icon-circle bg-primary-light text-primary mb-2 mx-auto" style={{ width: '45px', height: '45px', backgroundColor: '#e1f5fe', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="bi bi-bag-check fs-4"></i>
              </div>
              <small className="text-muted d-block">Order</small>
              <h6 className="fw-bold mb-0">{stats?.orderHariIni || 0} Selesai</h6>
            </div>
          </div>
        </div>
      </div>

      {/* Menu Cepat / Shortcut */}
      <h6 className="fw-bold mb-3">Menu Cepat</h6>
      <div className="row g-3 mb-4">
        <div className="col-3 text-center">
          <Link to="/cari" className="text-decoration-none">
            <div className="bg-white shadow-sm rounded-circle mx-auto mb-2 d-flex align-items-center justify-content-center" style={{ width: '55px', height: '55px' }}>
              <i className="bi bi-plus-lg fs-4 text-primary"></i>
            </div>
            <small className="text-dark fw-bold" style={{ fontSize: '0.7rem' }}>Baru</small>
          </Link>
        </div>
        <div className="col-3 text-center">
          <Link to="/orders" className="text-decoration-none">
            <div className="bg-white shadow-sm rounded-circle mx-auto mb-2 d-flex align-items-center justify-content-center" style={{ width: '55px', height: '55px' }}>
              <i className="bi bi-list-check fs-4 text-success"></i>
            </div>
            <small className="text-dark fw-bold" style={{ fontSize: '0.7rem' }}>Riwayat</small>
          </Link>
        </div>
        <div className="col-3 text-center">
          <div className="bg-white shadow-sm rounded-circle mx-auto mb-2 d-flex align-items-center justify-content-center" style={{ width: '55px', height: '55px' }}>
            <i className="bi bi-people fs-4 text-info"></i>
          </div>
          <small className="text-dark fw-bold" style={{ fontSize: '0.7rem' }}>Pelanggan</small>
        </div>
        <div className="col-3 text-center">
          <div className="bg-white shadow-sm rounded-circle mx-auto mb-2 d-flex align-items-center justify-content-center" style={{ width: '55px', height: '55px' }}>
            <i className="bi bi-graph-up fs-4 text-warning"></i>
          </div>
          <small className="text-dark fw-bold" style={{ fontSize: '0.7rem' }}>Laporan</small>
        </div>
      </div>

      {/* Order dalam Proses */}
      {stats?.pendingOrders > 0 && (
        <div className="alert alert-warning border-0 shadow-sm d-flex align-items-center" style={{ borderRadius: '12px' }}>
          <i className="bi bi-exclamation-triangle-fill fs-4 me-3"></i>
          <div>
            <h6 className="alert-heading mb-1 fw-bold">Ada {stats.pendingOrders} Order Tertunda</h6>
            <p className="small mb-0">Segera selesaikan pengerjaan laundry hari ini.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
