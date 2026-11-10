import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createOrderFromCheckout, updateOrder } from '../db/repositories/orders';
import { clearDraftOrder } from '../db/repositories/draftOrder';
import { getSubscriptionReport } from '../services/subscriptionService';
import PlanGateModal from '../components/PlanGateModal';
import { getStatusLunasByMetode } from '../utils/paymentStatus';
import { validateAuthSession } from '../utils/authSession';
import toast from 'react-hot-toast';
import { TOAST_MESSAGES } from '../constants/appConstants';

const Pembayaran = ({ user }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const orderData = location.state?.orderData;
  const isPaymentOnly = location.state?.isPaymentOnly;

  const [jumlahBayar, setJumlahBayar] = useState('');
  const [metodeBayar, setMetodeBayar] = useState(
    orderData?.metodeBayar ? (orderData.metodeBayar.toLowerCase() === 'tunai' ? 'Cash' : orderData.metodeBayar) : 'Cash'
  );
  const [amountError, setAmountError] = useState(false);
  const [gateModalOpen, setGateModalOpen] = useState(false);
  const [gateModalLimit, setGateModalLimit] = useState(30);

  if (!orderData) {
    return (
      <div className="text-center py-5">
        <p>Data transaksi tidak ditemukan.</p>
        <button className="btn btn-outline-primary" onClick={() => navigate('/transaksi')}>Kembali</button>
      </div>
    );
  }

  const total = orderData.total;
  const currentSisa = isPaymentOnly ? (total - (orderData.bayar || 0)) : total;
  const bayarNum = parseInt(jumlahBayar || 0, 10);
  const kembalian = bayarNum - currentSisa;

  const handleBayar = async (isLunas) => {
    if (!validateAuthSession()) {
      navigate('/login');
      return;
    }

    // Validasi: Ketika klik pembayaran lunas, kolom amount wajib diisi (> 0)
    if (isLunas && (!jumlahBayar || jumlahBayar.toString().trim() === '' || bayarNum <= 0)) {
      setAmountError(true);
      toast.error(TOAST_MESSAGES.ERROR);
      return;
    }
    setAmountError(false);

    try {
      const resolvedStatusLunas = getStatusLunasByMetode(metodeBayar);

      if (isPaymentOnly) {
        const currentBayar = orderData.bayar || 0;
        const newBayar = currentBayar + bayarNum;
        const isFullyPaid = newBayar >= total;

        // Jika nominal kurang dari tagihan statusnya pembayaran DP
        const newStatusBayar = isLunas
          ? (isFullyPaid ? resolvedStatusLunas : 'DP')
          : (isFullyPaid ? resolvedStatusLunas : (newBayar > 0 ? 'DP' : (orderData.statusBayar || 'Belum Lunas')));

        await updateOrder(orderData.id, {
          statusBayar: newStatusBayar,
          metodeBayar,
          bayar: isFullyPaid ? Math.max(total, newBayar) : newBayar,
          kembalian: isFullyPaid ? Math.max(0, newBayar - total) : 0
        });
        toast.success(TOAST_MESSAGES.SUCCESS);
        navigate(`/order/${orderData.id}`);
      } else {
        try {
          const sub = await getSubscriptionReport();
          if (sub?.isEnforced && sub?.usage?.transactions?.isExceeded) {
            setGateModalLimit(sub.usage.transactions.totalLimit);
            setGateModalOpen(true);
            return;
          }
        } catch (e) {}

        const isFullyPaid = bayarNum >= total;
        const newId = await createOrderFromCheckout({
          orderData: {
            ...orderData,
            metodeBayar,
          },
          bayarNum,
          kembalian: isFullyPaid ? Math.max(0, bayarNum - total) : 0,
          isLunas
        });

        await clearDraftOrder();
        toast.success(TOAST_MESSAGES.SUCCESS);
        navigate(`/order/${newId}`);
      }
    } catch (error) {
      toast.error(error?.message || TOAST_MESSAGES.ERROR);
    }
  };

  const setNominal = (val) => {
    if (val === 'pas') {
      setJumlahBayar(currentSisa.toString());
    } else {
      setJumlahBayar(val.toString());
    }
  };

  return (
    <div className="pembayaran-wrapper py-4">
      <div className="text-center mb-4">
        <h4 className="fw-bold">{isPaymentOnly ? 'Sisa Tagihan' : 'Subtotal'} : Rp {currentSisa.toLocaleString()}</h4>
      </div>

      <div className="mb-4">
        <label className="form-label text-center d-block">Jumlah yang dibayarkan</label>
        <input
          type="number"
          className={`form-control form-control-lg text-center ${amountError ? 'is-invalid border-danger' : 'border-warning'}`}
          style={{ fontSize: '2rem', fontWeight: 'bold' }}
          value={jumlahBayar}
          onChange={(e) => {
            setJumlahBayar(e.target.value);
            if (amountError) setAmountError(false);
          }}
          placeholder="0"
        />
        {amountError && (
          <div className="text-danger small text-center mt-1">
            Kolom amount wajib diisi
          </div>
        )}
      </div>

      <div className="mb-4">
        <label className="form-label text-center d-block fw-semibold mb-2" style={{ fontSize: '0.9rem', color: '#64748b' }}>
          Metode Pembayaran
        </label>
        <div className="row g-2">
          {[
            { key: 'Cash', label: 'Cash', icon: 'bi-cash-stack' },
            { key: 'QRIS', label: 'QRIS', icon: 'bi-qr-code' },
            { key: 'Transfer', label: 'Transfer', icon: 'bi-bank' },
          ].map((item) => {
            const isSelected = (metodeBayar || '').toLowerCase() === item.key.toLowerCase();
            return (
              <div className="col-4" key={item.key}>
                <button
                  type="button"
                  className={`btn w-100 py-2 rounded-3 fw-bold d-flex flex-column align-items-center justify-content-center transition-all ${
                    isSelected
                      ? 'btn-primary text-white shadow-sm'
                      : 'btn-outline-primary bg-white text-primary'
                  }`}
                  style={{
                    height: '56px',
                    borderWidth: isSelected ? '2px' : '1.5px',
                    fontSize: '0.86rem',
                  }}
                  onClick={() => setMetodeBayar(item.key)}
                >
                  <i className={`bi ${item.icon} mb-1`} style={{ fontSize: '1.1rem' }}></i>
                  <span>{item.label}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="row g-2 mb-3">
        <div className="col-6">
          <button className="btn btn-outline-primary w-100 py-3" onClick={() => setNominal('pas')}>Uang Pas</button>
        </div>
        <div className="col-6">
          <button className="btn btn-outline-primary w-100 py-3" onClick={() => setNominal(10000)}>IDR10,000</button>
        </div>
        <div className="col-6">
          <button className="btn btn-outline-primary w-100 py-3" onClick={() => setNominal(20000)}>IDR20,000</button>
        </div>
        <div className="col-6">
          <button className="btn btn-outline-primary w-100 py-3" onClick={() => setNominal(50000)}>IDR50,000</button>
        </div>
        <div className="col-12">
          <button className="btn btn-outline-primary w-100 py-3" onClick={() => setNominal(100000)}>IDR100,000</button>
        </div>
      </div>

      <div className="d-grid gap-3 mb-5">
        <button className="btn btn-outline-primary btn-lg py-3 fw-bold" onClick={() => handleBayar(true)}>
          <i className="bi bi-wallet2 me-2"></i> Bayar Lunas
        </button>
        <button className="btn btn-outline-primary btn-lg py-3 fw-bold" onClick={() => handleBayar(false)}>
          Bayar Nanti
        </button>
        <button className="btn btn-outline-secondary btn-lg py-3" onClick={() => isPaymentOnly ? navigate(`/order/${orderData.id}`) : navigate('/transaksi')}>
          Kembali
        </button>
      </div>
      {/* POPUP RINGKAS BATAS TRANSAKSI */}
      <PlanGateModal
        isOpen={gateModalOpen}
        onClose={() => setGateModalOpen(false)}
        type="TRANSACTION_LIMIT"
        customData={{ limit: gateModalLimit }}
        user={user}
      />
    </div>
  );
};

export default Pembayaran;
