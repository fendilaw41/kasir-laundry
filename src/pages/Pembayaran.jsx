import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { db } from '../db';

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
    // Ambil order terakhir untuk menentukan nomor urut
    const lastOrder = await db.orders.orderBy('id').last();
    const nextNumber = lastOrder ? (lastOrder.id + 1) : 1;
    const invoiceId = `KL${nextNumber.toString().padStart(5, '0')}`;

    const id = await db.orders.add({
      ...orderData,
      invoiceId,
      bayar: bayarNum,
      kembalian: kembalian > 0 ? kembalian : 0,
      statusBayar: isLunas ? (bayarNum >= total ? 'Lunas' : 'DP') : 'Belum Bayar',
      status: 'Proses',
      createdAt: new Date()
    });

    // Kurangi stok jika ada inventory yang dipilih
    if (orderData.selectedInvId) {
      const item = await db.inventory.get(parseInt(orderData.selectedInvId));
      if (item && item.stok > 0) {
        await db.inventory.update(item.id, { stok: item.stok - 1 });
      }
    }

    await db.cart.clear();
    alert('Transaksi berhasil disimpan!');
    navigate(`/order/${id}`);
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

      <div className="text-center mb-4">
        <small className="text-muted italic">
          *Pembayaran nominal lebih kecil dari total invoice akan otomatis menjadi DP*
        </small>
      </div>

      <div className="d-grid gap-3 mb-5">
        <button className="btn btn-primary btn-lg py-3 fw-bold" onClick={() => handleBayar(true)}>
          Bayar Sekarang
        </button>
        <button className="btn btn-primary btn-lg py-3 fw-bold" onClick={() => handleBayar(false)}>
          Bayar Nanti
        </button>
        <button className="btn btn-outline-secondary btn-lg py-3" onClick={() => navigate('/transaksi')}>
          Kembali
        </button>
      </div>

      <div className="row g-2">
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
    </div>
  );
};

export default Pembayaran;
