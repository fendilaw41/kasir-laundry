import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createOrderFromCheckout, updateOrder } from '../db/repositories/orders';
import { clearDraftOrder } from '../db/repositories/draftOrder';
import { getStatusLunasByMetode } from '../utils/paymentStatus';
import toast from 'react-hot-toast';
import { TOAST_MESSAGES } from '../constants/appConstants';

const Pembayaran = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const orderData = location.state?.orderData;
  const isPaymentOnly = location.state?.isPaymentOnly;

  const [jumlahBayar, setJumlahBayar] = useState('');
  const [metodeBayar, setMetodeBayar] = useState(orderData?.metodeBayar || 'Tunai');
  const [amountError, setAmountError] = useState(false);

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
      toast.error(TOAST_MESSAGES.ERROR);
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
        <label className="form-label text-center d-block">Metode Pembayaran</label>
        <select
          className="form-select text-center"
          value={metodeBayar}
          onChange={(e) => setMetodeBayar(e.target.value)}
        >
          <option value="Tunai">Tunai</option>
          <option value="QRIS">QRIS</option>
          <option value="Transfer">Transfer</option>
          <option value="Deposit">Deposit</option>
        </select>
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
    </div>
  );
};

export default Pembayaran;
