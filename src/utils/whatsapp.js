export const formatWhatsAppMessage = (order, pelanggan) => {
  const phone = pelanggan?.hp || '';
  if (!phone) return null;

  const formattedPhone = phone.startsWith('0') ? '62' + phone.slice(1) : phone;
  const tgl = new Date(order.createdAt).toLocaleString('id-ID');
  const estDate = new Date(new Date(order.createdAt).getTime() + (order.estimasi * 86400000)).toLocaleDateString('id-ID');

  let itemsText = '';
  order.items.forEach(item => {
    itemsText += `${item.name} (Rp${item.price.toLocaleString()} x ${item.quantity})\nRp${(item.price * item.quantity).toLocaleString()}\n`;
  });

  const text = `*Keenan Laundry*
------------------------------
No Nota : #${order.invoiceId || 'KL'}
Tanggal : ${tgl}
Pembayaran : ${order.statusBayar?.toLowerCase()}
Status : ${order.status?.toLowerCase() || 'proses'}
Nama : ${pelanggan?.nama || 'Umum'} (${phone})
Est : ${order.estimasi} Hari ${estDate}
Note : ${order.catatan || '-'}
----------------------------
${itemsText}------------------------------
SubTotal : Rp${(order.subtotal || order.total).toLocaleString()}
${order.diskon > 0 ? `Diskon : -Rp${order.diskon.toLocaleString()}\n` : ''}Total : Rp${order.total.toLocaleString()}

Nota ${order.status?.toLowerCase() === 'selesai' ? 'selesai' : 'diproses'}

------------------------------
kasirlaundry.my.id
------------------------------
Cek status laundry anda dengan mengklik link :
https://kasirlaundry.my.id/status/${order.invoiceId}`;

  return {
    phone: formattedPhone,
    text: encodeURIComponent(text),
    url: `https://wa.me/${formattedPhone}?text=${encodeURIComponent(text)}`
  };
};
