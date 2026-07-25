import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getPelangganQuery, addPelanggan, updatePelanggan } from '../../db/repositories/pelanggan';
import { getInventoryQuery, updateInventoryStok, approveInventory, rejectInventory, addInventoryManual } from '../../db/repositories/inventory';
import { getOrdersQuery } from '../../db/repositories/orders';
import { updateDraftOrder } from '../../db/repositories/draftOrder';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export const useHome = () => {
  const navigate = useNavigate();
  const [showPelangganModal, setShowPelangganModal] = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [showOmzet, setShowOmzet] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ show: false, message: '', onConfirm: null });
  const [editPelanggan, setEditPelanggan] = useState({ show: false, data: { id: null, nama: '', hp: '', alamat: '' } });

  // State Form Pelanggan
  const [newPelanggan, setNewPelanggan] = useState({ nama: '', hp: '', alamat: '' });

  // Ambil data inventory
  const inventory = useLiveQuery(getInventoryQuery);
  const pelangganList = useLiveQuery(getPelangganQuery);

  const [searchPelanggan, setSearchPelanggan] = useState('');
  const [searchInventory, setSearchInventory] = useState('');
  const [inventoryTab, setInventoryTab] = useState('selesai');

  // Update Stok Inventory
  const handleUpdateStok = async (item, delta) => {
    const actionText = delta > 0 ? `tambah ${delta}` : `kurangi ${Math.abs(delta)}`;
    setConfirmModal({
      show: true,
      message: `Apakah Anda yakin ingin ${actionText} stok ${item.nama}?`,
      onConfirm: async () => {
        try {
          await updateInventoryStok(item.id, delta);
          setConfirmModal({ show: false, message: '', onConfirm: null });
        } catch (e) {
          toast.error(e.message);
        }
      }
    });
  };

  const handleApproveInventory = async (item) => {
    try {
      await approveInventory(item);
      toast.success(`${item.nama} berhasil disetujui`);
    } catch (error) {
      console.error(error);
      toast.error('Gagal menyetujui');
    }
  };

  const handleRejectInventory = async (item) => {
    try {
      await rejectInventory(item);
      toast.success(`${item.nama} ditolak`);
    } catch (error) {
      console.error(error);
      toast.error('Gagal menolak');
    }
  };

  // Ambil statistik singkat
  const stats = useLiveQuery(async () => {
    const allOrders = await getOrdersQuery();
    const today = new Date().toLocaleDateString();
    const todayOrders = allOrders.filter(o => new Date(o.createdAt).toLocaleDateString() === today);

    const totalOmzet = todayOrders.reduce((acc, o) => acc + o.total, 0);
    const pendingOrders = allOrders.filter(o => o.status === 'Proses').length;
    const readyToPickUp = allOrders.filter(o => o.status === 'Selesai').length;

    return {
      totalOmzet,
      orderHariIni: todayOrders.length,
      pendingOrders,
      readyToPickUp
    }
  });

  const handleSelectPelanggan = async (pelanggan) => {
    await updateDraftOrder({ pelanggan });
    setShowPelangganModal(false);
    navigate('/transaksi');
  };

  const handleAddPelanggan = async (e) => {
    e.preventDefault();
    try {
      await addPelanggan(newPelanggan);
      toast.success('Pelanggan berhasil ditambahkan');
      setNewPelanggan({ nama: '', hp: '', alamat: '' });
      setShowPelangganModal(false);
    } catch (error) {
      toast.error(error.message);
    }
  };

  return {
    showPelangganModal, setShowPelangganModal,
    showInventoryModal, setShowInventoryModal,
    showOmzet, setShowOmzet,
    confirmModal, setConfirmModal,
    editPelanggan, setEditPelanggan,
    newPelanggan, setNewPelanggan,
    inventory, pelangganList,
    searchPelanggan, setSearchPelanggan,
    searchInventory, setSearchInventory,
    inventoryTab, setInventoryTab,
    handleUpdateStok, handleApproveInventory, handleRejectInventory,
    stats, handleSelectPelanggan, handleAddPelanggan,
    updatePelanggan, addInventoryManual
  };
};
