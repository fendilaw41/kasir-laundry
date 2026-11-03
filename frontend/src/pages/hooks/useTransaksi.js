import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getCartQuery, removeProductFromCart, updateCartItemQty } from '../../db/repositories/cart';
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

  // Auto-prune draft inventory jika stok barang sudah 0
  useEffect(() => {
    if (draftOrder?.inventory?.length && inventory?.length) {
      const invalidItems = draftOrder.inventory.filter((item) => {
        const inv = inventory.find(
          (i) => i.id === item.id || (item.uuid && i.uuid === item.uuid)
        );
        return inv && Number(inv.stok || 0) <= 0;
      });
      if (invalidItems.length > 0) {
        const cleaned = draftOrder.inventory.filter(
          (item) => !invalidItems.some((inv) => inv.id === item.id)
        );
        updateDraftOrder({ inventory: cleaned });
      }
    }
  }, [draftOrder?.inventory, inventory]);

  const handleCheckout = async () => {
    if (!cartItems || cartItems.length === 0) return;
    if (!selectedPelanggan) {
      setShowModal(true);
      return;
    }

    // Validasi ketersediaan stok inventori yang dipilih
    if (selectedInventory && selectedInventory.length > 0) {
      for (const item of selectedInventory) {
        const invData = inventory?.find(
          (i) => i.id === item.id || (item.uuid && i.uuid === item.uuid) || (item.nama && i.nama?.toLowerCase() === item.nama?.toLowerCase())
        );
        const availableStock = invData ? Number(invData.stok || 0) : 0;
        const requestedQty = Number(item.quantity || 1);
        if (availableStock <= 0) {
          toast.error(`Stok ${item.nama || 'inventori'} habis (0), tidak dapat digunakan!`);
          return;
        }
        if (requestedQty > availableStock) {
          toast.error(`Stok ${item.nama} tidak mencukupi (tersedia: ${availableStock})`);
          return;
        }
      }
    }

    const user = JSON.parse(sessionStorage.getItem('user'));
    if (!user) {
      toast.error('Sesi tidak valid, silakan login ulang.');
      navigate('/login');
      return;
    }

    // Siapkan data untuk dikirim ke halaman pembayaran
    const orderData = {
      userId: user.uuid || user.id,
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

  const updateItemQty = async (id, delta) => {
    await updateCartItemQty(id, delta);
  };

  const toggleInventory = async (inv) => {
    const prev = selectedInventory;
    const exists = prev.find(item => item.id === inv.id);
    let newInventory;
    if (exists) {
      newInventory = prev.filter(item => item.id !== inv.id);
    } else {
      if (Number(inv.stok || 0) <= 0) {
        toast.error(`Stok ${inv.nama} habis (0), tidak bisa dipilih!`);
        return;
      }
      newInventory = [...prev, { id: inv.id, nama: inv.nama, quantity: 1 }];
    }
    await updateDraftOrder({ inventory: newInventory });
  };

  const updateInventoryQty = async (invId, delta) => {
    const prev = selectedInventory;
    const existing = prev.find(item => item.id === invId);
    if (existing) {
      const invData = inventory?.find(i => i.id === invId);
      const currentStock = invData ? Number(invData.stok || 0) : 0;
      const newQty = (existing.quantity || 1) + delta;
      if (delta > 0 && newQty > currentStock) {
        toast.error(`Stok ${existing.nama || 'item'} tidak mencukupi (tersedia: ${currentStock})`);
        return;
      }
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
    handleCheckout, removeItem, updateItemQty, toggleInventory, updateInventoryQty, handleAddPelanggan
  };
};
