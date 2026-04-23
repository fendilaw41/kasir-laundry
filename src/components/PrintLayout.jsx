import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';

const PrintLayout = ({ order, pelanggan, printType }) => {
  const settings = useLiveQuery(() => db.settings.get(1));

  if (!order || !printType || !settings) return null;

  const qrUrl = `https://chart.googleapis.com/chart?chs=150x150&cht=qr&chl=${encodeURIComponent(`https://kasirlaundry.my.id/status/${order.invoiceId}`)}`;

  return (
    <>
      {/* 1. Nota Thermal (58mm) */}
      {printType === 'thermal' && (
        <div id="thermal-receipt" className="print-section" style={{ width: '58mm', padding: '2mm', color: '#000', backgroundColor: '#fff', fontFamily: 'monospace' }}>
          <div style={{ textAlign: 'center', marginBottom: '10px' }}>
            <h4 style={{ margin: '0', fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase' }}>{settings.namaLaundry}</h4>
            <div style={{ fontSize: '10px' }}>{settings.alamat}</div>
            <div style={{ fontSize: '10px' }}>{settings.kota}</div>
            <div style={{ fontSize: '10px' }}>Operasional: {settings.jamBuka}</div>
            <div style={{ fontSize: '10px' }}>No. WA: {settings.telepon}</div>
          </div>

          <div style={{ borderTop: '1px dashed #000', margin: '5px 0' }}></div>

          <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ width: '35%' }}>Tgl</td>
                <td>: {new Date(order.createdAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }).replace(/\./g, ':')}</td>
              </tr>
              <tr>
                <td>No Nota</td>
                <td>: {order.invoiceId}</td>
              </tr>
              <tr>
                <td>Customer</td>
                <td>: {pelanggan?.nama || 'Umum'}</td>
              </tr>
              <tr>
                <td>No. Telp</td>
                <td>: {pelanggan?.hp || '-'}</td>
              </tr>
            </tbody>
          </table>

          <div style={{ borderTop: '1px dashed #000', margin: '5px 0' }}></div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 'bold' }}>
            <span>BARANG</span>
            <span>TOTAL</span>
          </div>

          <div style={{ borderTop: '1px dashed #000', margin: '5px 0' }}></div>

          {order.items?.map((item, idx) => (
            <div key={idx} style={{ fontSize: '10px', marginBottom: '5px' }}>
              <div style={{ textTransform: 'uppercase' }}>{item.name}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ paddingLeft: '10px' }}>{item.quantity} x {item.price.toLocaleString()}</span>
                <span>{(item.price * item.quantity).toLocaleString()}</span>
              </div>
            </div>
          ))}

          <div style={{ borderTop: '1px dashed #000', margin: '5px 0' }}></div>

          <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td>SUBTOTAL</td>
                <td style={{ textAlign: 'right' }}>{(order.subtotal || order.total).toLocaleString()}</td>
              </tr>
              {order.diskon > 0 && (
                <tr>
                  <td>DISKON</td>
                  <td style={{ textAlign: 'right' }}>- {order.diskon.toLocaleString()}</td>
                </tr>
              )}
              <tr>
                <td style={{ fontWeight: 'bold' }}>TOTAL AKHIR</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{order.total.toLocaleString()}</td>
              </tr>
              <tr>
                <td>BAYAR</td>
                <td style={{ textAlign: 'right' }}>{(order.bayar || 0).toLocaleString()}</td>
              </tr>
              <tr>
                <td>KEMBALI</td>
                <td style={{ textAlign: 'right' }}>{(order.kembalian || 0).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          <div style={{ borderTop: '1px dashed #000', margin: '5px 0' }}></div>

          <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '10px', whiteSpace: 'pre-line' }}>
            <div>{settings.headerStruk}</div>
            <div style={{ marginTop: '5px' }}>{settings.footerStruk}</div>
          </div>
        </div>
      )}

      {/* 2. Nota A4 / PDF */}
      {printType === 'a4' && (
        <div id="a4-receipt" className="print-section" style={{ width: '210mm', padding: '15mm', color: '#000', backgroundColor: '#fff', fontFamily: 'Arial, sans-serif' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '15px' }}>
            <div>
              <h2 style={{ margin: 0, color: '#0134d4' }}>{settings.namaLaundry}</h2>
              <div style={{ fontSize: '14px', marginTop: '5px' }}>
                <div>{settings.alamat}, {settings.kota}</div>
                <div>Operasional: {settings.jamBuka}</div>
                <div>No. WA: {settings.telepon}</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <h1 style={{ margin: 0, fontSize: '32px', color: '#ddd' }}>INVOICE</h1>
              <div style={{ fontWeight: 'bold', fontSize: '18px' }}>#{order.invoiceId}</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '5px' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase' }}>Pelanggan</div>
              <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{pelanggan?.nama || 'Umum'}</div>
              <div style={{ fontSize: '14px' }}>{pelanggan?.hp || '-'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase' }}>Tanggal Transaksi</div>
              <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{new Date(order.createdAt).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}</div>
            </div>
          </div>

          <table style={{ width: '100%', marginTop: '30px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#0134d4', color: '#fff' }}>
                <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #0134d4' }}>Layanan / Produk</th>
                <th style={{ padding: '12px', textAlign: 'center', border: '1px solid #0134d4', width: '100px' }}>Jumlah</th>
                <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #0134d4', width: '150px' }}>Harga</th>
                <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #0134d4', width: '150px' }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {order.items?.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                    <div style={{ fontWeight: 'bold' }}>{item.name}</div>
                  </td>
                  <td style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'center' }}>{item.quantity}</td>
                  <td style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'right' }}>Rp {item.price.toLocaleString()}</td>
                  <td style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'right', fontWeight: 'bold' }}>Rp {(item.price * item.quantity).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
            <table style={{ width: '300px', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '8px', fontSize: '14px' }}>Subtotal</td>
                  <td style={{ padding: '8px', textAlign: 'right', fontSize: '14px' }}>Rp {(order.subtotal || order.total).toLocaleString()}</td>
                </tr>
                {order.diskon > 0 && (
                  <tr>
                    <td style={{ padding: '8px', fontSize: '14px', color: 'red' }}>Diskon</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontSize: '14px', color: 'red' }}>- Rp {order.diskon.toLocaleString()}</td>
                  </tr>
                )}
                <tr>
                  <td style={{ padding: '8px', fontSize: '16px', fontWeight: 'bold' }}>Total Akhir</td>
                  <td style={{ padding: '8px', textAlign: 'right', fontSize: '20px', fontWeight: 'bold', color: '#0134d4' }}>Rp {order.total.toLocaleString()}</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px' }}>Dibayar</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>Rp {(order.bayar || 0).toLocaleString()}</td>
                </tr>
                <tr style={{ borderTop: '2px solid #eee' }}>
                  <td style={{ padding: '8px', fontWeight: 'bold' }}>Kembalian</td>
                  <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>Rp {(order.kembalian || 0).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '50px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '14px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Informasi Tambahan:</div>
                <div style={{ whiteSpace: 'pre-line' }}>{settings.footerStruk}</div>
              </div>
              <div style={{ textAlign: 'center', minWidth: '200px' }}>
                <div style={{ marginBottom: '60px' }}>Hormat Kami,</div>
                <div style={{ borderTop: '1px solid #000', width: '150px', margin: '0 auto' }}>{settings.namaLaundry}</div>
              </div>
            </div>
            <div style={{ textAlign: 'center', marginTop: '40px', color: '#999', fontSize: '12px' }}>
              {settings.headerStruk}
            </div>
          </div>
        </div>
      )}

      {/* 3. Label & QR Code */}
      {(printType === 'label' || printType === 'qr') && (
        <div id="label-receipt" className="print-section">
          <div style={{ fontSize: '12px', fontWeight: 'bold' }}>{pelanggan?.nama || 'UMUM'}</div>
          <div style={{ fontSize: '10px' }}>#{order.invoiceId}</div>
          {printType === 'qr' && (
            <img src={qrUrl} alt="QR" style={{ width: '80px', height: '80px', marginTop: '5px' }} />
          )}
          <div style={{ fontSize: '9px', marginTop: '2px' }}>{settings.namaLaundry}</div>
        </div>
      )}
    </>
  );
};

export default PrintLayout;
