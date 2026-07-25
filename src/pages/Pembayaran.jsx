import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createOrderFromCheckout } from '../db/repositories/orders';
import { clearDraftOrder } from '../db/repositories/draftOrder';
import toast from 'react-hot-toast';

const Pembayaran = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const orderData = location.state?.orderData;

  const [jumlahBayar, setJumlahBayar] = useState('');
  const [metodeBayar, setMetodeBayar] = useState(orderData?.metodeBayar || 'Tunai');

  if (!orderData) {
    return (
      <div className="text-center py-5">
        <p>Data transaksi tidak ditemukan.</p>
        <button className="btn btn-primary" onClick={() => navigate('/transaksi')}>Kembali</button>
      </div>
    );
  }

  const total = orderData.total;
  const bayarNum = parseInt(jumlahBayar || 0);
  const kembalian = bayarNum - total;

  const handleBayar = async (isLunas) => {
    try {
      const newId = await createOrderFromCheckout({
        orderData,
        bayarNum,
        kembalian,
        isLunas
      });

      await clearDraftOrder();
      toast.success(`Transaksi berhasil dibuat`, {
        style: {
          borderRadius: '10px',
          background: '#333',
          color: '#fff',
        },
      });
      navigate(`/order/${newId}`);
    } catch (error) {
      toast.error('Gagal membuat transaksi: ' + error.message);
    }
  };

  const setNominal = (val) => {
    if (val === 'pas') {
      setJumlahBayar(total.toString());
    } else {
      setJumlahBayar(val.toString());
    }
  };

  return (
    <div className="pembayaran-wrapper py-4">
      <div className="text-center mb-4">
        <h4 className="fw-bold">Subtotal : Rp {total.toLocaleString()}</h4>
      </div>

      <div className="mb-4">
        <label className="form-label text-center d-block">Jumlah yang dibayarkan</label>
        <input
          type="number"
          className="form-control form-control-lg text-center border-warning"
          style={{ fontSize: '2rem', fontWeight: 'bold' }}
          value={jumlahBayar}
          onChange={(e) => setJumlahBayar(e.target.value)}
          placeholder="0"
        />
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
        <button className="btn btn-primary btn-lg py-3 fw-bold" onClick={() => handleBayar(true)}>
          Bayar Sekarang
        </button>
        <button className="btn btn-danger btn-lg py-3 fw-bold" onClick={() => handleBayar(false)}>
          Bayar Nanti
        </button>
        <button className="btn btn-outline-secondary btn-lg py-3" onClick={() => navigate('/transaksi')}>
          Kembali
        </button>
      </div>
    </div>
  );
};

export default Pembayaran;
