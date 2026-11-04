import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getPelangganQuery, addPelanggan, updatePelanggan, deletePelanggan } from '../../db/repositories/pelanggan';
import { getInventoryQuery, updateInventoryStok, approveInventory, rejectInventory, addInventoryManual } from '../../db/repositories/inventory';
import { getOrdersQuery } from '../../db/repositories/orders';
import { updateDraftOrder } from '../../db/repositories/draftOrder';
import { pullOrdersFromBackend } from '../../services/syncService';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { TOAST_MESSAGES, CONFIRM_MESSAGES } from '../../constants/appConstants';

export const useHome = () => {
  const navigate = useNavigate();

  useEffect(() => {
    pullOrdersFromBackend().catch(err => console.warn('[Home] Auto pull orders error:', err));
  }, []);
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
    setConfirmModal({
      show: true,
      message: CONFIRM_MESSAGES.UPDATE_STOCK,
      onConfirm: async () => {
        try {
          await updateInventoryStok(item.id, delta);
          setConfirmModal({ show: false, message: '', onConfirm: null });
        } catch (e) {
          toast.error(TOAST_MESSAGES.ERROR);
        }
      }
    });
  };

  const handleApproveInventory = async (item) => {
    try {
      await approveInventory(item);
      toast.success(TOAST_MESSAGES.SUCCESS);
    } catch (error) {
      console.error(error);
      toast.error(TOAST_MESSAGES.ERROR);
    }
  };

  const handleRejectInventory = async (item) => {
    try {
      await rejectInventory(item);
      toast.success(TOAST_MESSAGES.SUCCESS);
    } catch (error) {
      console.error(error);
      toast.error(TOAST_MESSAGES.ERROR);
    }
  };

  // Ambil statistik singkat
  const stats = useLiveQuery(async () => {
    const allOrders = await getOrdersQuery();
    const now = new Date();
    const isSameDay = (dateA, dateB) => {
      if (!dateA || !dateB) return false;
      const a = new Date(dateA);
      const b = new Date(dateB);
      if (isNaN(a.getTime()) || isNaN(b.getTime())) return false;
      return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    };
    const todayOrders = allOrders.filter(o => isSameDay(o.createdAt, now));

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
      toast.success(TOAST_MESSAGES.SUCCESS);
      setNewPelanggan({ nama: '', hp: '', alamat: '' });
      setShowPelangganModal(false);
    } catch (error) {
      toast.error(TOAST_MESSAGES.ERROR);
    }
  };

  const handleDeletePelanggan = (pelanggan) => {
    setConfirmModal({
      show: true,
      message: CONFIRM_MESSAGES.DELETE_CUSTOMER,
      onConfirm: async () => {
        try {
          await deletePelanggan(pelanggan.id || pelanggan.uuid || pelanggan);
          toast.success(TOAST_MESSAGES.SUCCESS);
          setConfirmModal({ show: false, message: '', onConfirm: null });
        } catch (error) {
          toast.error(error.message || TOAST_MESSAGES.ERROR);
          setConfirmModal({ show: false, message: '', onConfirm: null });
        }
      }
    });
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
    stats, handleSelectPelanggan, handleAddPelanggan, handleDeletePelanggan,
    updatePelanggan, addInventoryManual
  };
};
