import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getCartQuery, removeProductFromCart } from '../../db/repositories/cart';
import { getPelangganQuery, addPelanggan } from '../../db/repositories/pelanggan';
import { getInventoryQuery } from '../../db/repositories/inventory';
import { getDraftOrderQuery, updateDraftOrder } from '../../db/repositories/draftOrder';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export const useTransaksi = () => {
  const cartItems = useLiveQuery(getCartQuery);
  const daftarPelanggan = useLiveQuery(getPelangganQuery);
  const inventory = useLiveQuery(getInventoryQuery);
  const draftOrder = useLiveQuery(getDraftOrderQuery);
  
  const navigate = useNavigate();

  const selectedPelanggan = draftOrder?.pelanggan || null;
  const selectedInventory = draftOrder?.inventory || [];

  const setSelectedPelanggan = async (pelanggan) => {
    await updateDraftOrder({ pelanggan });
  };

  const [showModal, setShowModal] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newPelanggan, setNewPelanggan] = useState({ nama: '', hp: '', alamat: '' });

  // Munculkan modal otomatis jika pelanggan belum dipilih
  useEffect(() => {
    if (draftOrder !== undefined && !selectedPelanggan) {
      const timer = setTimeout(() => {
        setShowModal(true);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [selectedPelanggan, draftOrder]);

  // State untuk detail transaksi tambahan
  const [diskonTipe, setDiskonTipe] = useState('Persentase'); // Persentase atau Harga
  const [diskonNilai, setDiskonNilai] = useState(0);
  const [estimasi, setEstimasi] = useState(0);
  const [metodeBayar, setMetodeBayar] = useState('Cash');
  const [tipeLayanan, setTipeLayanan] = useState('Datang Langsung');
  const [isPriority, setIsPriority] = useState('Tidak');

  const subtotal = cartItems?.reduce((acc, item) => acc + (item.price * item.quantity), 0) || 0;

  // Kalkulasi Diskon
  const nilaiDiskon = diskonTipe === 'Persentase'
    ? (subtotal * ((Number(diskonNilai) || 0) / 100))
    : (Number(diskonNilai) || 0);

  const total = subtotal - nilaiDiskon;

  const handleCheckout = async () => {
    if (!cartItems || cartItems.length === 0) return;
    if (!selectedPelanggan) {
      setShowModal(true);
      return;
    }

    const user = JSON.parse(sessionStorage.getItem('user'));
    if (!user) {
      toast.error('Sesi tidak valid, silakan login ulang.');
      navigate('/login');
      return;
    }

    // Siapkan data untuk dikirim ke halaman pembayaran
    const orderData = {
      userId: user.id,
      pelangganId: selectedPelanggan.id,
      pelangganNama: selectedPelanggan.nama,
      items: cartItems,
      subtotal: subtotal,
      diskon: nilaiDiskon,
      total: total,
      metodeBayar,
      estimasi,
      tipeLayanan,
      isPriority: isPriority === 'Ya',
      inventoryUsed: selectedInventory // Kirim array inventory yang digunakan
    };

    navigate('/pembayaran', { state: { orderData } });
  };

  const removeItem = async (id) => {
    await removeProductFromCart(id);
  };

  const toggleInventory = async (inv) => {
    const prev = selectedInventory;
    const exists = prev.find(item => item.id === inv.id);
    let newInventory;
    if (exists) {
      newInventory = prev.filter(item => item.id !== inv.id);
    } else {
      newInventory = [...prev, { id: inv.id, nama: inv.nama, quantity: 1 }];
    }
    await updateDraftOrder({ inventory: newInventory });
  };

  const updateInventoryQty = async (invId, delta) => {
    const prev = selectedInventory;
    const existing = prev.find(item => item.id === invId);
    if (existing) {
      const newQty = (existing.quantity || 1) + delta;
      let newInventory;
      if (newQty <= 0) {
         newInventory = prev.filter(item => item.id !== invId);
      } else {
         newInventory = prev.map(item => item.id === invId ? { ...item, quantity: newQty } : item);
      }
      await updateDraftOrder({ inventory: newInventory });
    }
  };

  const handleAddPelanggan = async (e) => {
    e.preventDefault();
    try {
      const id = await addPelanggan(newPelanggan);
      const created = { id, ...newPelanggan };
      await setSelectedPelanggan(created);
      setIsAdding(false);
      setNewPelanggan({ nama: '', hp: '', alamat: '' });
      setShowModal(false);
    } catch (error) {
      toast.error(error.message);
    }
  };

  return {
    cartItems, daftarPelanggan, inventory, navigate,
    selectedPelanggan, setSelectedPelanggan,
    showModal, setShowModal,
    isAdding, setIsAdding,
    newPelanggan, setNewPelanggan,
    diskonTipe, setDiskonTipe,
    diskonNilai, setDiskonNilai,
    estimasi, setEstimasi,
    metodeBayar, setMetodeBayar,
    tipeLayanan, setTipeLayanan,
    isPriority, setIsPriority,
    selectedInventory,
    subtotal, nilaiDiskon, total,
    handleCheckout, removeItem, toggleInventory, updateInventoryQty, handleAddPelanggan
  };
};
