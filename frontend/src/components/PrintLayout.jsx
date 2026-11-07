import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { getTrackingUrl, getShortDisplayUrl } from '../utils/tracking';
import { Barcode } from './common/Barcode';
import { QRCodeSVG } from './common/QRCodeSVG';
import {
  isFooterBarcode,
  isFooterLinkOrder,
  cleanReceiptFooterText,
  formatReceiptFooterText,
  getReceiptTrackingUrl,
} from '../utils/receiptFooter';

const PrintLayout = ({ order, pelanggan, printType }) => {
  const settings = useLiveQuery(() => db.settings.get(1));

  if (!order || !printType || !settings) return null;

  const trackingUrl = getTrackingUrl(order.invoiceId);
  const trackingDisplayUrl = getShortDisplayUrl(order.invoiceId);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(trackingUrl)}`;

  // Saklar terpisah:
  // - hasLinkOrder: Hanya untuk mengaktifkan link di Cetak Thermal
  // - hasBarcode: Hanya untuk mengaktifkan barcode di Cetak PDF/Invoice (A4)
  const hasBarcode = isFooterBarcode(settings.footerStruk);
  const hasLinkOrder = isFooterLinkOrder(settings.footerStruk);
  const cleanFooter = cleanReceiptFooterText(settings.footerStruk);
  const receiptTrackingUrl = getReceiptTrackingUrl(order.invoiceId);

  return (
    <div className="print-only-container">
      <style>{`
        @media screen {
          .print-only-container { display: none !important; }
        }
        @media print {
          @page { margin: 0; }
          body * { visibility: hidden; }
          .print-only-container, .print-only-container * { visibility: visible; }
          .print-only-container { 
            position: absolute !important; 
            left: 0 !important; 
            top: 0 !important; 
            width: 100% !important; 
            display: block !important;
            background: white !important;
            z-index: 9999;
          }
          /* Hide UI elements */
          nav, footer, .btn, .navbar, .order-detail-wrapper { display: none !important; }
        }
      `}</style>
      {/* 1. Nota Thermal (58mm) */}
      {printType === 'thermal' && (
        <div id="thermal-receipt" className="print-section" style={{ width: '58mm', padding: '2mm', color: '#000', backgroundColor: '#fff', fontFamily: 'monospace' }}>
          <div style={{ textAlign: 'center', marginBottom: '10px' }}>
            <h4 style={{ margin: '0', fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase' }}>{settings.namaLaundry}</h4>
            {settings.motto && <div style={{ fontSize: '10px', fontStyle: 'italic', marginBottom: '2px' }}>{settings.motto}</div>}
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
                <td>Total Item</td>
                <td style={{ textAlign: 'right' }}>{(order.subtotal || order.total).toLocaleString()}</td>
              </tr>
              {order.diskon > 0 && (
                <tr>
                  <td>Total Disc.</td>
                  <td style={{ textAlign: 'right' }}>- {order.diskon.toLocaleString()}</td>
                </tr>
              )}
              <tr>
                <td style={{ fontWeight: 'bold' }}>Total Belanja</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{order.total.toLocaleString()}</td>
              </tr>
              <tr>
                <td>Tunai</td>
                <td style={{ textAlign: 'right' }}>{(order.bayar || 0).toLocaleString()}</td>
              </tr>
              <tr>
                <td>Kembalian</td>
                <td style={{ textAlign: 'right' }}>{(order.kembalian || 0).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          <div style={{ borderTop: '1px dashed #000', margin: '5px 0' }}></div>

          <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '10px' }}>
            {settings.headerStruk && (
              <div style={{ whiteSpace: 'pre-line', marginBottom: '5px' }}>{settings.headerStruk}</div>
            )}
            {cleanFooter && (
              <div style={{ whiteSpace: 'pre-line', marginTop: '5px' }}>{cleanFooter}</div>
            )}

            {/* Print Thermal: HANYA pakai link saja jika LINK_ORDER aktif (tanpa barcode) */}
            {hasLinkOrder && (
              <div style={{ marginTop: '8px', borderTop: '1px dotted #000', paddingTop: '6px' }}>
                <div style={{ fontWeight: 'bold' }}>Cek Status Cucian:</div>
                <div style={{ wordBreak: 'break-all' }}>{receiptTrackingUrl}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Nota A4 / PDF */}
      {printType === 'a4' && (
        <div id="a4-receipt" className="print-section" style={{ width: '210mm', padding: '15mm', color: '#000', backgroundColor: '#fff', fontFamily: 'Arial, sans-serif' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '15px' }}>
            <div>
              <h2 style={{ margin: 0, color: '#0134d4' }}>{settings.namaLaundry}</h2>
              {settings.motto && <div style={{ fontSize: '13px', fontStyle: 'italic', color: '#555', marginBottom: '4px' }}>{settings.motto}</div>}
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

          <table style={{ width: '100%', marginTop: '30px', borderCollapse: 'collapse', borderRadius: '8px', overflow: 'hidden' }}>
            <thead>
              <tr style={{ backgroundColor: '#0134d4', color: '#fff', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                <th style={{ padding: '15px 12px', textAlign: 'left', border: '1px solid #0134d4', fontSize: '14px' }}>Layanan / Produk</th>
                <th style={{ padding: '15px 12px', textAlign: 'center', border: '1px solid #0134d4', width: '80px', fontSize: '14px' }}>Jumlah</th>
                <th style={{ padding: '15px 12px', textAlign: 'right', border: '1px solid #0134d4', width: '120px', fontSize: '14px' }}>Harga</th>
                <th style={{ padding: '15px 12px', textAlign: 'right', border: '1px solid #0134d4', width: '140px', fontSize: '14px' }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {order.items?.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ padding: '12px', border: '1px solid #eee', fontSize: '13px' }}>
                    <div style={{ fontWeight: 'bold', color: '#333' }}>{item.name}</div>
                  </td>
                  <td style={{ padding: '12px', border: '1px solid #eee', textAlign: 'center', fontSize: '13px' }}>{item.quantity}</td>
                  <td style={{ padding: '12px', border: '1px solid #eee', textAlign: 'right', fontSize: '13px' }}>Rp {item.price.toLocaleString()}</td>
                  <td style={{ padding: '12px', border: '1px solid #eee', textAlign: 'right', fontWeight: 'bold', fontSize: '13px', color: '#0134d4' }}>Rp {(item.price * item.quantity).toLocaleString()}</td>
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

          <div style={{ marginTop: '35px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontSize: '14px', maxWidth: '440px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Informasi Tambahan:</div>
                {cleanFooter && (
                  <div style={{ whiteSpace: 'pre-line', marginBottom: '10px' }}>{cleanFooter}</div>
                )}

                {/* Nota PDF (A4): QR Code Cek Status Pesanan */}
                <div style={{ marginTop: '14px', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', border: '1px solid #cbd5e1', padding: '10px 14px', borderRadius: '10px', backgroundColor: '#fff' }}>
                  <QRCodeSVG value={trackingUrl} size={90} />
                  <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#1e293b', marginTop: '6px', textAlign: 'center' }}>
                    Harap scan barcode untuk cek status
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'center', minWidth: '180px' }}>
                <div style={{ marginBottom: '60px' }}>Hormat Kami,</div>
                <div style={{ borderTop: '1px solid #000', width: '150px', margin: '0 auto' }}>{settings.namaLaundry}</div>
              </div>
            </div>
            <div style={{ textAlign: 'center', marginTop: '30px', color: '#999', fontSize: '12px' }}>
              {settings.headerStruk}
            </div>
          </div>
        </div>
      )}

      {/* 3. Label (Pcs) - Berisi label ringkas dan nama pelanggan */}
      {printType === 'label' && (
        <div id="label-receipt" className="print-section" style={{ width: '40mm', minHeight: '25mm', padding: '2mm', textAlign: 'center', border: '1px solid #ccc', backgroundColor: '#fff', boxSizing: 'border-box' }}>
          <div style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', lineHeight: '1.2' }}>
            {pelanggan?.nama || 'UMUM'}
          </div>
          <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#333', marginTop: '2px' }}>
            #{order.invoiceId}
          </div>
          <div style={{ fontSize: '9px', color: '#555', marginTop: '2px' }}>
            {order.items?.length ? `${order.items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0)} Pcs` : ''} {order.tipeLayanan ? `• ${order.tipeLayanan}` : ''}
          </div>
          <div style={{ fontSize: '8px', color: '#777', marginTop: '4px', borderTop: '1px dashed #ccc', paddingTop: '2px' }}>
            {settings.namaLaundry}
          </div>
        </div>
      )}

      {/* 4. Label Barcode - Barcode 1D (Code 128) untuk scanner kasir mencari kode transaksi */}
      {(printType === 'barcode' || printType === 'qr') && (
        <div id="label-receipt" className="print-section" style={{ width: '40mm', minHeight: '25mm', padding: '2mm', textAlign: 'center', border: '1px solid #ccc', backgroundColor: '#fff', boxSizing: 'border-box' }}>
          <div style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', lineHeight: '1.2' }}>
            {pelanggan?.nama || 'UMUM'}
          </div>
          <div style={{ margin: '2px 0' }}>
            <Barcode value={order.invoiceId} width={1.2} height={30} fontSize={9} displayValue={true} />
          </div>
          <div style={{ fontSize: '8px', color: '#777', marginTop: '1px' }}>
            {settings.namaLaundry}
          </div>
        </div>
      )}
    </div>
  );
};

export default PrintLayout;
