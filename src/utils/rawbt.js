export const printViaRawBT = (order, pelanggan) => {
  if (!order) return;

  // Header & Info Laundry
  let text = "";
  text += "      KEENAN LAUNDRY      \n"; // 26 chars
  text += "  Jl. Imam Bonjol 007    \n";
  text += "        NGANJUK          \n";
  text += "  Telp: 087853131099     \n";
  text += "--------------------------------\n"; // 32 chars (standard 58mm)

  // Info Transaksi
  text += `Tgl      : ${new Date(order.createdAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }).replace(/\./g, ':')}\n`;
  text += `No Nota  : ${order.invoiceId}\n`;
  text += `Customer : ${pelanggan?.nama || 'Umum'}\n`;
  text += `No. Telp : ${pelanggan?.hp || '-'}\n`;
  text += "--------------------------------\n";

  // Daftar Item
  text += "BARANG                    TOTAL \n";
  text += "--------------------------------\n";

  order.items?.forEach(item => {
    // Nama Item (kapital)
    text += `${item.name.toUpperCase()}\n`;
    // Detail: Qty x Harga (rata kiri) | Subtotal (rata kanan)
    const detail = `  ${item.quantity} x ${item.price.toLocaleString()}`;
    const subtotal = (item.price * item.quantity).toLocaleString();
    const spaces = 32 - detail.length - subtotal.length;
    text += detail + " ".repeat(Math.max(1, spaces)) + subtotal + "\n";
  });

  text += "--------------------------------\n";

  // Total
  const formatRow = (label, value) => {
    const spaces = 32 - label.length - value.length;
    return label + " ".repeat(Math.max(1, spaces)) + value + "\n";
  };

  text += formatRow("TOTAL", order.total.toLocaleString());
  text += formatRow("BAYAR", (order.bayar || 0).toLocaleString());
  text += formatRow("KEMBALI", (order.kembalian || 0).toLocaleString());

  // Footer
  text += "--------------------------------\n";
  text += "   Terima kasih atas kunjungan  \n";
  text += "              anda              \n";
  text += "   Kami menerima Cuci Karpet,   \n";
  text += "   Bedcover, Boneka, Satuan     \n";
  text += "      kasirlaundry.my.id        \n";
  text += "\n\n\n\n"; // Feed paper

  // Convert to Base64 (UTF-8 safe)
  try {
    const base64Data = btoa(unescape(encodeURIComponent(text)));
    window.location.href = `rawbt:text/plain;base64,${base64Data}`;
  } catch (e) {
    console.log(e);
    alert('Gagal mengirim data ke RawBT. Pastikan aplikasi RawBT terpasang di Android Anda.');
  }
};
