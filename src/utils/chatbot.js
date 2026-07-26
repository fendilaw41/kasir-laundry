import { db } from '../db';
import Fuse from 'fuse.js';

// Cari yang paling mirip dari list menggunakan Fuse.js
function findBestMatch(input, items, keys, threshold = 0.4) {
  const fuseKeys = Array.isArray(keys) ? keys : [keys];
  const fuse = new Fuse(items, {
    keys: fuseKeys,
    includeScore: true,
    threshold: threshold // 0.0 is exact match, 1.0 is mismatch. Lower is stricter.
  });
  const result = fuse.search(input);
  if (result.length > 0) {
    return result[0].item;
  }
  return null;
}

// Generate unique invoice ID (e.g. KL00001)
const generateInvoiceId = async () => {
  const setting = await db.settings.get(1);
  const namaLaundry = setting?.namaLaundry || 'INVOICE';
  
  // Ambil inisial nama laundry (contoh: "KEENAN LAUNDRY" -> "KL")
  const words = namaLaundry.trim().split(' ').filter(Boolean);
  const initials = words.length > 1 
      ? words[0].charAt(0).toUpperCase() + words[1].charAt(0).toUpperCase()
      : words[0].substring(0, 2).toUpperCase();
  
  const lastOrder = await db.orders.orderBy('id').last();
  const nextNumber = lastOrder ? (lastOrder.id + 1) : 1;
  
  return `${initials}${nextNumber.toString().padStart(5, '0')}`;
};

// Format tanggal friendly
function formatFriendlyDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  const today = new Date();
  const isToday = date.getDate() === today.getDate() && 
                  date.getMonth() === today.getMonth() && 
                  date.getFullYear() === today.getFullYear();
  const time = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Hari ini jam ${time}`;
  return `${date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} jam ${time}`;
}

export async function parseChatCommand(message, user) {
  const msg = message.trim().toLowerCase();
  let intent = 'unknown';
  let payload = null;
  let responseText = '';
  let status = 'failed';

  try {
    // 1. Cek intent: Transaksi -> "trx <layanan> <berat>kg [<nama>] [<statusBayar>]"
    const editTrxMatch = msg.match(/^edit\s+trx(?:\s+terakhir)?\s+(\d+(?:\.\d+)?)\s*kg$/);
    
    if (msg === 'trx') {
      intent = 'help_trx';
      responseText = 'Panduan perintah Transaksi (Bisa Multi Layanan):\nKetik: trx <layanan1> <berat1>kg, <layanan2> <berat2>kg [info tambahan]\n\nContoh:\n- trx CLR 5kg, CLE 2kg agus lunas besok AJ\n- trx karpet 3kg budi DP 2hari DL';
      status = 'success';
    }
    else if (msg === 'tambah') {
      intent = 'help_tambah';
      responseText = 'Panduan perintah Tambah Inventory:\nKetik: tambah <barang> <qty><unit>[, ...]\n\nContoh:\n- tambah plastik 100pcs\n- tambah molto 5botol, deterjen 10kg';
      status = 'success';
    }
    else if (msg === 'cek') {
      intent = 'help_cek';
      responseText = 'Daftar perintah Cek:\n- cek order proses\n- cek order selesai\n- cek order diambil\n- cek pelanggan <nama pelanggan>\n- cek inventory\n- cek inventory molto\n- cek layanan';
      status = 'success';
    }
    else if (msg.startsWith('cek ')) {
      intent = 'cek_data';
      if (msg.startsWith('cek order ')) {
        let statusFilter = msg.substring(10).trim().toLowerCase();
        if (statusFilter === 'diambil') statusFilter = 'ambil';
        
        const orders = await db.orders.toArray();
        const filteredOrders = orders.filter(o => o.status.toLowerCase() === statusFilter);
        
        if (filteredOrders.length === 0) {
          responseText = `Tidak ada order dengan status "${statusFilter}".`;
        } else {
          const sorted = filteredOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
          responseText = `Ditemukan ${filteredOrders.length} order "${statusFilter}". Menampilkan maks 5 terbaru:\n` + 
            sorted.map(o => `- ${o.invoiceId} (${o.pelangganNama} ${formatFriendlyDate(o.createdAt)}) ${o.catatan ? '['+o.catatan+'] ' : ''}`).join('\n');
        }
        status = 'success';
      }
      else if (msg.startsWith('cek pelanggan ')) {
        const query = msg.substring(14).trim().toLowerCase();
        const pelanggans = await db.pelanggan.toArray();
        const filtered = pelanggans.filter(p => p.nama.toLowerCase().includes(query) || p.hp.includes(query));
        
        if (filtered.length === 0) {
          responseText = `Pelanggan "${query}" tidak ditemukan.`;
        } else {
          const sorted = filtered.reverse().slice(0, 5);
          const orders = await db.orders.toArray();
          
          let resultText = `Ditemukan ${filtered.length} pelanggan. Menampilkan maks 5 terbaru:\n`;
          for (const p of sorted) {
            const userOrders = orders.filter(o => o.pelangganId === p.id || o.pelangganNama.toLowerCase() === p.nama.toLowerCase());
            if (userOrders.length === 0) {
              resultText += `- ${p.nama}: Belum ada orderan\n`;
            } else {
              const lastOrder = userOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
              const itemsStr = lastOrder.items ? lastOrder.items.map(i => `${i.name} ${i.quantity}kg`).join(', ') : 'Order Kosong';
              resultText += `- ${p.nama} ${formatFriendlyDate(lastOrder.createdAt)}: ${itemsStr}\n`;
            }
          }
          responseText = resultText.trim();
        }
        status = 'success';
      }
      else if (msg === 'cek layanan') {
        const products = await db.products.toArray();
        if (products.length === 0) {
          responseText = 'Belum ada layanan yang tersedia.';
        } else {
          responseText = 'Daftar Layanan Tersedia:\n' + products.map(p => `- ${p.name}: Rp${p.price.toLocaleString('id-ID')} (${p.code || '-'})`).join('\n');
        }
        status = 'success';
      }
      else if (msg.startsWith('cek inventory')) {
        const query = msg.substring(13).trim().toLowerCase();
        const invs = await db.inventory.filter(i => i.status !== 'pending' && i.status !== 'rejected').toArray();
        
        let filtered = invs;
        if (query) {
          filtered = invs.filter(i => i.nama.toLowerCase().includes(query));
        }
        
        if (filtered.length === 0) {
          responseText = query ? `Inventory "${query}" tidak ditemukan.` : 'Inventory kosong.';
        } else {
          const sorted = filtered.slice(0, 5);
          responseText = `Ditemukan ${filtered.length} inventory. Menampilkan maks 5:\n` + 
            sorted.map(i => `- ${i.nama}: ${i.stok || 0} ${i.unit || 'pcs'}`).join('\n');
        }
        status = 'success';
      }
      else {
        responseText = 'Perintah "cek" tidak dikenali. Ketik "cek" untuk panduan.';
        status = 'failed';
      }
    }
    else if (msg.startsWith('trx ') && msg !== 'trx') {
      intent = 'trx';
      const body = msg.substring(4).trim();
      const parts = body.split(',');
      
      const parsedItems = [];
      let extraInfo = '';
      let formatValid = true;
      let errorMsg = '';
      
      for (let i = 0; i < parts.length; i++) {
        let part = parts[i].trim();
        if (i === parts.length - 1) {
            const match = part.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*kg(?:\s+(.+))?$/i);
            if (match) {
                parsedItems.push({ layanan: match[1].trim(), berat: parseFloat(match[2]) });
                if (match[3]) extraInfo = match[3].trim();
            } else {
                formatValid = false;
                errorMsg = `Format salah pada bagian: "${part}". Gunakan format: layanan beratkg`;
                break;
            }
        } else {
            const match = part.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*kg$/i);
            if (match) {
                parsedItems.push({ layanan: match[1].trim(), berat: parseFloat(match[2]) });
            } else {
                formatValid = false;
                errorMsg = `Format salah pada bagian: "${part}". Gunakan format: layanan beratkg`;
                break;
            }
        }
      }
      
      if (!formatValid) {
        responseText = errorMsg;
      } else {
        const products = await db.products.toArray();
        const validOrderItems = [];
        let totalAll = 0;
        let notFound = null;
        
        for (const pi of parsedItems) {
            if (pi.berat <= 0) {
                notFound = `Berat untuk "${pi.layanan}" harus > 0 kg.`;
                break;
            }
            const matchedProduct = findBestMatch(pi.layanan, products, ['code', 'name'], 0.4);
            if (matchedProduct) {
                const subtotalItem = matchedProduct.price * pi.berat;
                totalAll += subtotalItem;
                validOrderItems.push({ 
                    category: matchedProduct.category, 
                    name: matchedProduct.name, 
                    price: matchedProduct.price, 
                    quantity: pi.berat 
                });
            } else {
                notFound = `Layanan "${pi.layanan}" tidak ditemukan.`;
                break;
            }
        }
        
        if (notFound) {
            responseText = notFound;
        } else {
          const invoiceId = await generateInvoiceId();
          let pelangganNama = 'Via Chat';
          let statusBayar = 'Belum Lunas';
          let estimasi = 0;
          let tipeLayanan = 'Datang Langsung';
          
          if (extraInfo) {
            // Ekstrak tipe layanan (DL/AJ)
            extraInfo = extraInfo.replace(/\b(dl|aj)\b/i, (match) => {
                tipeLayanan = match.toUpperCase() === 'AJ' ? 'Jemput/Antar' : 'Datang Langsung';
                return '';
            });
            
            // Ekstrak estimasi (besok, besok lusa, X hari, Xhari)
            extraInfo = extraInfo.replace(/\b(besok lusa|besok|\d+\s*hari)\b/i, (match) => {
                const estStr = match.toLowerCase().replace(/\s+/g, '');
                if (estStr === 'besok') estimasi = 1;
                else if (estStr === 'besoklusa') estimasi = 2;
                else estimasi = parseInt(estStr) || 0;
                return '';
            });
            
            // Ekstrak status bayar
            extraInfo = extraInfo.replace(/\b(lunas|dp|belum bayar|belum lunas)\b/i, (match) => {
                const s = match.toLowerCase().replace(/\s+/g, ' ');
                if (s === 'lunas') statusBayar = 'Lunas';
                else if (s === 'dp') statusBayar = 'DP';
                else statusBayar = 'Belum Lunas';
                return '';
            });
            
            extraInfo = extraInfo.replace(/\s+/g, ' ').trim();
            if (extraInfo) pelangganNama = extraInfo;
          }
          
          if (!pelangganNama) pelangganNama = 'Via Chat';
          
          let hp = '-';
          const phoneMatch = pelangganNama.match(/^([a-z\s]+)-(\d+)$/i);
          if (phoneMatch) {
              pelangganNama = phoneMatch[1].trim();
              hp = phoneMatch[2].trim();
          }
          
          let pelangganId = null;
          if (pelangganNama !== 'Via Chat') {
              let existingPelanggan = await db.pelanggan.where('nama').equalsIgnoreCase(pelangganNama).first();
              if (!existingPelanggan && hp !== '-') {
                  const pList = await db.pelanggan.toArray();
                  existingPelanggan = pList.find(p => p.hp === hp);
              }
              if (existingPelanggan) {
                  pelangganId = existingPelanggan.id;
                  pelangganNama = existingPelanggan.nama;
              } else {
                  pelangganId = await db.pelanggan.add({ nama: pelangganNama, hp: hp, alamat: '-' });
              }
          }
          
          const orderData = {
            invoiceId,
            userId: user.id,
            pelangganNama: pelangganNama,
            items: validOrderItems,
            tipeLayanan: tipeLayanan,
            estimasi: estimasi,
            subtotal: totalAll,
            total: totalAll,
            diskon: 0,
            createdAt: new Date().toISOString(),
            status: 'Proses',
            statusBayar: statusBayar,
            bayar: statusBayar === 'Lunas' ? totalAll : 0,
            kembalian: 0
          };
          if (pelangganId) orderData.pelangganId = pelangganId;
          
          await db.orders.add(orderData);
          
          const itemsResponseStr = validOrderItems.map(i => `${i.category} ${i.name} ${i.quantity}kg`).join(', ');
          responseText = `Transaksi "${itemsResponseStr}" = Rp${totalAll.toLocaleString('id-ID')} berhasil dibuat dengan invoice ${invoiceId}.`;
          status = 'success';
          payload = { items: validOrderItems, total: totalAll, invoiceId };
        }
      }
    }
    // 2. Cek intent: Tambah Inventory -> "tambah <barang> <qty><unit>[, ...]"
    else if (msg.startsWith('tambah ')) {
      intent = 'tambah_inventory';
      const itemsString = msg.substring(7); // buang kata "tambah "
      const items = itemsString.split(',');
      const addedItems = [];
      const failedItems = [];
      
      const existingInventory = await db.inventory.toArray();
      
      for (const item of items) {
        let itemStr = item.trim();
        if (itemStr.startsWith('tambah ')) {
            itemStr = itemStr.substring(7).trim(); // handle jika nulis "tambah A, tambah B"
        }
        
        const itemMatch = itemStr.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*([a-z]+)$/i);
        
        if (itemMatch) {
          const namaBarang = itemMatch[1].trim();
          const qty = parseFloat(itemMatch[2]);
          const unit = itemMatch[3].trim().toLowerCase();
          
          if (qty > 0) {
            let finalName = namaBarang;
            const matchedInv = findBestMatch(namaBarang, existingInventory, ['nama'], 0.3);
            if (matchedInv) {
                finalName = matchedInv.nama;
                await db.inventory.update(matchedInv.id, {
                  qty: (matchedInv.qty || 0) + qty,
                  unit: unit,
                  status: 'pending',
                  createdBy: user.fullname || user.username
                });
            } else {
              await db.inventory.add({
                nama: finalName,
                qty: qty,
                unit: unit,
                status: 'pending',
                createdBy: user.fullname || user.username,
                createdAt: new Date().toISOString(),
                stok: 0
              });
            }
            addedItems.push(`${finalName} ${qty}${unit}`);
          } else {
            failedItems.push(`Qty untuk "${namaBarang}" harus > 0`);
          }
        } else {
          failedItems.push(`Format salah untuk "${itemStr}". Contoh: deterjen 10kg`);
        }
      }
      
      if (addedItems.length > 0) {
        responseText = `Diajukan: ${addedItems.join(', ')}. Menunggu approval owner. Cek di menu Inventory pending`;
        status = 'success';
      }
      if (failedItems.length > 0) {
        responseText += `\nBeberapa item gagal diproses: ${failedItems.join(' | ')}`;
        if (addedItems.length === 0) status = 'failed';
      }
      
      payload = { addedItems, failedItems };
    }
    // 3. Cek intent: Approve Semua Inventory -> "acc semua inventory"
    else if (msg === 'acc semua stok') {
      intent = 'approve_all';
      if (user.role === 'owner') {
        const pendingItems = await db.inventory.filter(i => i.status === 'pending').toArray();
        if (pendingItems.length === 0) {
          responseText = 'Tidak ada inventory yang menunggu approval.';
          status = 'success';
        } else {
          await db.transaction('rw', db.inventory, async () => {
            for (const item of pendingItems) {
              await db.inventory.update(item.id, {
                status: 'approved',
                stok: (item.stok || 0) + item.qty
              });
            }
          });
          responseText = `${pendingItems.length} item inventory di-approve dan stok berhasil ditambahkan.`;
          status = 'success';
          payload = { approvedCount: pendingItems.length };
        }
      } else {
        responseText = 'Akses ditolak. Hanya owner yang dapat menyetujui penambahan inventory.';
      }
    }
    // 4. Cek intent: Partial Approve Inventory -> "acc <barang>"
    else if (msg.startsWith('acc ')) {
      intent = 'partial_approve_inventory';
      if (user.role === 'owner') {
        const itemName = msg.substring(4).trim();
        const pendingItems = await db.inventory.filter(i => i.status === 'pending').toArray();
        
        if (pendingItems.length === 0) {
          responseText = 'Tidak ada inventory yang menunggu approval.';
        } else {
          const matchedItem = findBestMatch(itemName, pendingItems, ['nama'], 0.4);
          if (matchedItem) {
            await db.inventory.update(matchedItem.id, {
              status: 'approved',
              stok: (matchedItem.stok || 0) + matchedItem.qty
            });
            responseText = `Inventory "${matchedItem.nama}" berhasil di-approve.`;
            status = 'success';
            payload = { approvedItem: matchedItem };
          } else {
            const pendingNames = pendingItems.map(i => i.nama).join(', ');
            responseText = `Item "${itemName}" tidak ditemukan di daftar pending. Yang sedang pending: ${pendingNames}.`;
          }
        }
      } else {
        responseText = 'Akses ditolak. Hanya owner yang dapat menyetujui penambahan inventory.';
      }
    }
    // 5. Cek intent: Reject Semua Stok -> "tolak semua"
    else if (msg === 'tolak semua stok') {
      intent = 'reject_all';
      if (user.role === 'owner') {
        const pendingItems = await db.inventory.filter(i => i.status === 'pending').toArray();
        if (pendingItems.length === 0) {
          responseText = 'Tidak ada inventory yang menunggu approval.';
          status = 'success';
        } else {
          await db.transaction('rw', db.inventory, async () => {
            for (const item of pendingItems) {
              await db.inventory.update(item.id, {
                status: 'rejected'
              });
            }
          });
          responseText = `${pendingItems.length} item inventory yang diajukan telah ditolak.`;
          status = 'success';
          payload = { rejectedCount: pendingItems.length };
        }
      } else {
        responseText = 'Akses ditolak. Hanya owner yang dapat menolak penambahan inventory.';
      }
    }
    // 6. Cek intent: Reject Inventory -> "tolak <barang>"
    else if (msg.startsWith('tolak ')) {
      intent = 'reject_inventory';
      if (user.role === 'owner') {
        const itemName = msg.substring(6).trim();
        const pendingItems = await db.inventory.filter(i => i.status === 'pending').toArray();
        
        if (pendingItems.length === 0) {
          responseText = 'Tidak ada inventory yang menunggu approval.';
        } else {
          const matchedItem = findBestMatch(itemName, pendingItems, ['nama'], 0.4);
          if (matchedItem) {
            await db.inventory.update(matchedItem.id, {
              status: 'rejected'
            });
            responseText = `Pengajuan inventory "${matchedItem.nama}" ditolak.`;
            status = 'success';
            payload = { rejectedItem: matchedItem };
          } else {
            const pendingNames = pendingItems.map(i => i.nama).join(', ');
            responseText = `Item "${itemName}" tidak ditemukan di daftar pending. Yang sedang pending: ${pendingNames}.`;
          }
        }
      } else {
        responseText = 'Akses ditolak. Hanya owner yang dapat menolak penambahan inventory.';
      }
    }
    // 7. Cek intent: Hapus Stok Baru -> "hapus stok <barang>"
    else if (msg.startsWith('hapus stok ')) {
      intent = 'hapus_inventory';
      if (user.role === 'owner') {
        const itemName = msg.substring(11).trim();
        const inventories = await db.inventory.toArray();
        const matchedInv = findBestMatch(itemName, inventories, ['nama'], 0.4);
        
        if (matchedInv) {
          // Cek apakah item sudah digunakan di transaksi
          const orders = await db.orders.toArray();
          const isUsed = orders.some(o => 
            o.inventoryUsed && o.inventoryUsed.some(inv => inv.nama === matchedInv.nama || inv.id === matchedInv.id)
          );
          
          if (isUsed) {
            responseText = `Gagal menghapus: Stok "${matchedInv.nama}" tidak boleh dihapus karena sudah pernah digunakan pada transaksi.`;
          } else {
            await db.inventory.delete(matchedInv.id);
            responseText = `Stok "${matchedInv.nama}" berhasil dihapus dari sistem.`;
            status = 'success';
            payload = { deletedItem: matchedInv };
          }
        } else {
          responseText = `Item "${itemName}" tidak ditemukan di daftar stok.`;
        }
      } else {
        responseText = 'Akses ditolak. Hanya owner yang dapat menghapus stok.';
      }
    }
    // 6. Cek intent: Undo Transaksi Terakhir -> "undo trx terakhir"
    else if (msg.match(/^undo\s+trx(?:\s+terakhir)?$/)) {
      intent = 'undo_trx';
      const allUserOrders = await db.orders.filter(o => o.userId === user.id).toArray();
      const lastOrder = allUserOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
      
      if (lastOrder) {
        if (lastOrder.status === 'Proses') {
          await db.orders.update(lastOrder.id, { status: 'Dibatalkan' });
          responseText = `Transaksi terakhir dengan invoice ${lastOrder.invoiceId} berhasil dibatalkan.`;
          status = 'success';
          payload = { undoneOrder: lastOrder };
        } else {
          responseText = `Transaksi terakhir (${lastOrder.invoiceId}) tidak bisa dibatalkan karena sudah dalam status ${lastOrder.status}.`;
        }
      } else {
        responseText = 'Anda belum memiliki transaksi yang bisa dibatalkan.';
      }
    }
    // 7. Cek intent: Edit Transaksi Terakhir -> "edit trx terakhir <berat>kg"
    else if (editTrxMatch) {
      intent = 'edit_trx';
      const newBerat = parseFloat(editTrxMatch[1]);
      
      if (newBerat <= 0) {
        responseText = 'Berat cucian harus lebih dari 0 kg.';
      } else {
        const allUserOrders = await db.orders.filter(o => o.userId === user.id).toArray();
        const lastOrder = allUserOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
        
        if (lastOrder && lastOrder.items && lastOrder.items.length > 0) {
          const layananName = lastOrder.items[0].name;
          
          const products = await db.products.toArray();
          const matchedProduct = findBestMatch(layananName, products, ['code', 'name'], 0.4);
          
          if (matchedProduct) {
            const newTotal = matchedProduct.price * newBerat;
            
            const updatedItems = [...lastOrder.items];
            updatedItems[0] = { ...updatedItems[0], quantity: newBerat };
            
            await db.orders.update(lastOrder.id, {
              items: updatedItems,
              subtotal: newTotal,
              total: newTotal
            });
            responseText = `Transaksi ${lastOrder.invoiceId} berhasil diubah menjadi ${newBerat}kg. Total baru: Rp${newTotal.toLocaleString('id-ID')}.`;
            status = 'success';
            payload = { updatedOrder: lastOrder, newBerat, newTotal };
          } else {
            responseText = `Gagal mengedit transaksi: layanan "${layananName}" tidak ditemukan.`;
          }
        } else {
          responseText = 'Anda belum memiliki transaksi yang bisa diedit.';
        }
      }
    }
    // 8. Cek intent: Tambah Pelanggan -> "Nama-NomorHP"
    else if (msg.match(/^([a-z\s]+)-(\d+)$/i)) {
      intent = 'tambah_pelanggan';
      const addPelangganMatch = msg.match(/^([a-z\s]+)-(\d+)$/i);
      const nama = addPelangganMatch[1].trim();
      const hp = addPelangganMatch[2].trim();
      
      const existing = await db.pelanggan.filter(p => p.nama.toLowerCase() === nama.toLowerCase() || p.hp === hp).first();
      
      if (existing) {
        responseText = `Pelanggan dengan nama "${nama}" atau nomor HP "${hp}" sudah terdaftar sebelumnya.`;
      } else {
        await db.pelanggan.add({ nama, hp, alamat: '-' });
        responseText = `Pelanggan "${nama}" dengan No. HP ${hp} berhasil didaftarkan.`;
        status = 'success';
        payload = { nama, hp };
      }
    }
    // 9. Intent tidak dikenali
    else {
      responseText = 'Maaf, perintah tidak dikenali.\n\nKetik kata kunci berikut untuk panduan:\n• trx (Panduan Transaksi)\n• tambah (Panduan Tambah Inventory)\n• cek (Panduan Pencarian Data)\n\nPerintah Lainnya:\n• acc semua stok / tolak semua stok\n• undo trx terakhir\n• edit trx terakhir 4kg\n• hapus stok <nama>';
    }
    
  } catch (err) {
    console.error('Chatbot error:', err);
    responseText = 'Terjadi kesalahan sistem saat memproses perintah Anda.';
  }

  // Simpan log pesan user ke database
  await db.chatLog.add({
    pesan: message,
    intent,
    payload,
    status,
    userId: user.id,
    timestamp: new Date().toISOString(),
    isBot: false
  });
  
  // Simpan log response bot ke database
  await db.chatLog.add({
    pesan: responseText,
    intent,
    payload,
    status,
    userId: 'bot',
    timestamp: new Date().toISOString(),
    isBot: true
  });

  return {
    responseText,
    status
  };
}
