/**
 * Utilitas untuk mencetak langsung ke printer Bluetooth menggunakan Web Bluetooth API
 * Mengirimkan perintah ESC/POS biner
 */

export const printDirectBluetooth = async (order, pelanggan) => {
  if (!order) return;

  try {
    // 1. Request device Bluetooth (Filter untuk printer)
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }], // UUID standar printer thermal
      optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
    });

    // 2. Hubungkan ke GATT Server
    const server = await device.gatt.connect();
    
    // 3. Dapatkan service dan karakteristik untuk menulis data
    const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
    const characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');

    // 4. Siapkan perintah ESC/POS
    const encoder = new TextEncoder();
    
    // Helper untuk biner
    const ESC = 0x1B;
    const GS = 0x1D;
    const commands = {
      reset: [ESC, 0x40],
      center: [ESC, 0x61, 0x01],
      left: [ESC, 0x61, 0x00],
      boldOn: [ESC, 0x45, 0x01],
      boldOff: [ESC, 0x45, 0x00],
      newLine: [0x0A],
      cut: [GS, 0x56, 0x42, 0x00],
      feed: [ESC, 0x64, 0x05] // Feed 5 lines
    };


    const send = async (data) => {
      // Bluetooth MTU limit: Kirim dalam potongan jika data besar
      const chunkSize = 20;
      for (let i = 0; i < data.length; i += chunkSize) {
        await characteristic.writeValue(data.slice(i, i + chunkSize));
      }
    };

    // 5. Rakit Nota
    let fullContent = new Uint8Array([
      ...commands.reset,
      ...commands.center,
      ...commands.boldOn,
      ...encoder.encode("KEENAN LAUNDRY\n"),
      ...commands.boldOff,
      ...encoder.encode("Jl. Imam Bonjol 007\n"),
      ...encoder.encode("NGANJUK\n"),
      ...encoder.encode("Telp: 087853131099\n"),
      ...encoder.encode("--------------------------------\n"),
      ...commands.left,
      ...encoder.encode(`Tgl     : ${new Date(order.createdAt).toLocaleDateString('id-ID')} ${new Date(order.createdAt).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}\n`),
      ...encoder.encode(`Nota    : ${order.invoiceId}\n`),
      ...encoder.encode(`Customer: ${pelanggan?.nama || 'Umum'}\n`),
      ...encoder.encode("--------------------------------\n"),
      ...commands.boldOn,
      ...encoder.encode("BARANG                    TOTAL\n"),
      ...commands.boldOff,
      ...encoder.encode("--------------------------------\n"),
    ]);

    // Kirim header dulu
    await send(fullContent);

    // Kirim Item satu per satu
    for (const item of (order.items || [])) {
      const line1 = item.name.toUpperCase().substring(0, 32) + "\n";
      const detail = `  ${item.quantity} x ${item.price.toLocaleString()}`;
      const subtotal = (item.price * item.quantity).toLocaleString();
      const spaces = 32 - detail.length - subtotal.length;
      const line2 = detail + " ".repeat(Math.max(1, spaces)) + subtotal + "\n";
      await send(encoder.encode(line1 + line2));
    }

    // Kirim Footer
    const formatRow = (label, value) => {
      const spaces = 32 - label.length - value.length;
      return label + " ".repeat(Math.max(1, spaces)) + value + "\n";
    };

    let footerContent = new Uint8Array([
      ...encoder.encode("--------------------------------\n"),
      ...commands.boldOn,
      ...encoder.encode(formatRow("TOTAL", order.total.toLocaleString())),
      ...commands.boldOff,
      ...encoder.encode(formatRow("BAYAR", (order.bayar || 0).toLocaleString())),
      ...encoder.encode(formatRow("KEMBALI", (order.kembalian || 0).toLocaleString())),
      ...encoder.encode("--------------------------------\n"),
      ...commands.center,
      ...encoder.encode("Terima kasih atas kunjungan anda\n"),
      ...encoder.encode("kasirlaundry.my.id\n"),
      ...commands.feed,
      ...commands.cut
    ]);

    await send(footerContent);

    alert("Pencetakan selesai!");

  } catch (error) {
    console.error("Bluetooth Print Error: ", error);
    if (error.name === 'NotFoundError') {
       // User membatalkan pemilihan device
    } else {
       alert("Gagal terhubung ke printer. Pastikan Bluetooth aktif dan printer dalam mode pairing.");
    }
  }
};
