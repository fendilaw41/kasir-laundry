const fs = require('fs');
const path = 'frontend/src/pages/Plan.jsx';
let content = fs.readFileSync(path, 'utf8');

// Replace table section with styled, non-overlapping table and uniform buttons
const tableStartMarker = '<div className="card border-0 shadow-sm rounded-4 overflow-hidden mb-4 bg-white">';
const tableEndMarker = '</tfoot>\r\n                </table>\r\n              </div>';
const tableEndMarkerLF = '</tfoot>\n                </table>\n              </div>';

const startIndex = content.indexOf(tableStartMarker);
let endIndex = content.indexOf(tableEndMarker);
let endMarkerLength = tableEndMarker.length;
if (endIndex === -1) {
  endIndex = content.indexOf(tableEndMarkerLF);
  endMarkerLength = tableEndMarkerLF.length;
}

if (startIndex === -1 || endIndex === -1) {
  console.error('Could not find table markers in Plan.jsx', { startIndex, endIndex });
  process.exit(1);
}

const stickyHead = `style={{ position: 'sticky', left: 0, zIndex: 2, minWidth: '150px', width: '150px', backgroundColor: '#f8fafc', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}`;
const stickyBody = `style={{ position: 'sticky', left: 0, zIndex: 1, minWidth: '150px', width: '150px', backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}`;
const stickyFoot = `style={{ position: 'sticky', left: 0, zIndex: 2, minWidth: '150px', width: '150px', backgroundColor: '#f8fafc', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}`;

const colTrial = `style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}`;
const colStarter = `style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}`;
const colBasic = `style={{ minWidth: '135px', width: '135px', whiteSpace: 'nowrap' }}`;
const colPro = `style={{ minWidth: '115px', width: '115px', whiteSpace: 'nowrap' }}`;
const colBusiness = `style={{ minWidth: '145px', width: '145px', whiteSpace: 'nowrap' }}`;

const newTableHtml = `<div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white mb-4">
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.8rem' }}>
                  <thead className="table-light border-bottom">
                    <tr>
                      <th className="py-3 px-3 text-dark fw-bold" ${stickyHead}>
                        Fitur
                      </th>
                      <th className="py-3 px-3 text-center text-dark fw-bold" ${colTrial}>
                        Trial (Gratis)
                        <div className="small fw-normal text-muted" style={{ fontSize: '0.7rem' }}>Rp 0</div>
                      </th>
                      <th className="py-3 px-3 text-center text-dark fw-bold" ${colStarter}>
                        Starter
                        <div className="small fw-normal text-muted" style={{ fontSize: '0.7rem' }}>25rb/bln</div>
                      </th>
                      <th className="py-3 px-3 text-center fw-bold bg-primary-subtle text-primary border-start border-end" ${colBasic}>
                        Basic ⭐
                        <div className="small fw-semibold text-primary" style={{ fontSize: '0.7rem' }}>50rb/bln (Laris)</div>
                      </th>
                      <th className="py-3 px-3 text-center text-dark fw-bold" ${colPro}>
                        Pro
                        <div className="small fw-normal text-muted" style={{ fontSize: '0.7rem' }}>100rb/bln</div>
                      </th>
                      <th className="py-3 px-3 text-center text-dark fw-bold" ${colBusiness}>
                        Business
                        <div className="small fw-normal text-muted" style={{ fontSize: '0.7rem' }}>200rb/bln</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-3 py-2.5 fw-medium" ${stickyBody}>
                        Transaksi/bulan
                      </td>
                      <td className="text-center" ${colTrial}>30</td>
                      <td className="text-center" ${colStarter}>150</td>
                      <td className="text-center fw-bold bg-primary-subtle border-start border-end" ${colBasic}>400</td>
                      <td className="text-center" ${colPro}>1.000</td>
                      <td className="text-center" ${colBusiness}>Unlimited* (3.000)</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 fw-medium" ${stickyBody}>
                        Foto chat/bulan
                      </td>
                      <td className="text-center" ${colTrial}>30</td>
                      <td className="text-center" ${colStarter}>300</td>
                      <td className="text-center fw-bold bg-primary-subtle border-start border-end" ${colBasic}>800</td>
                      <td className="text-center" ${colPro}>2.000</td>
                      <td className="text-center" ${colBusiness}>5.000</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 fw-medium" ${stickyBody}>
                        Chat dg pelanggan
                      </td>
                      <td className="text-center text-success" ${colTrial}><i className="bi bi-check-circle-fill"></i></td>
                      <td className="text-center text-success" ${colStarter}><i className="bi bi-check-circle-fill"></i></td>
                      <td className="text-center text-success bg-primary-subtle border-start border-end" ${colBasic}><i className="bi bi-check-circle-fill"></i></td>
                      <td className="text-center text-success" ${colPro}><i className="bi bi-check-circle-fill"></i></td>
                      <td className="text-center text-success" ${colBusiness}><i className="bi bi-check-circle-fill"></i></td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 fw-medium" ${stickyBody}>
                        Bot transaksi (chat)
                      </td>
                      <td className="text-center" ${colTrial}>10x</td>
                      <td className="text-center text-muted opacity-40" ${colStarter}><i className="bi bi-x-circle-fill"></i></td>
                      <td className="text-center fw-bold bg-primary-subtle border-start border-end" ${colBasic}>200x</td>
                      <td className="text-center" ${colPro}>1.000x</td>
                      <td className="text-center" ${colBusiness}>Unlimited</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 fw-medium" ${stickyBody}>
                        Nota ke WhatsApp
                      </td>
                      <td className="text-center text-success" ${colTrial}><i className="bi bi-check-circle-fill"></i></td>
                      <td className="text-center text-success" ${colStarter}><i className="bi bi-check-circle-fill"></i></td>
                      <td className="text-center text-success bg-primary-subtle border-start border-end" ${colBasic}><i className="bi bi-check-circle-fill"></i></td>
                      <td className="text-center text-success" ${colPro}><i className="bi bi-check-circle-fill"></i></td>
                      <td className="text-center text-success" ${colBusiness}><i className="bi bi-check-circle-fill"></i></td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 fw-medium" ${stickyBody}>
                        Cetak nota
                      </td>
                      <td className="text-center text-success" ${colTrial}><i className="bi bi-check-circle-fill"></i></td>
                      <td className="text-center text-success" ${colStarter}><i className="bi bi-check-circle-fill"></i></td>
                      <td className="text-center text-success bg-primary-subtle border-start border-end" ${colBasic}><i className="bi bi-check-circle-fill"></i></td>
                      <td className="text-center text-success" ${colPro}><i className="bi bi-check-circle-fill"></i></td>
                      <td className="text-center text-success" ${colBusiness}><i className="bi bi-check-circle-fill"></i></td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 fw-medium" ${stickyBody}>
                        Invoice PDF
                      </td>
                      <td className="text-center text-muted opacity-40" ${colTrial}><i className="bi bi-x-circle-fill"></i></td>
                      <td className="text-center" ${colStarter}>20/bln</td>
                      <td className="text-center fw-bold bg-primary-subtle border-start border-end" ${colBasic}>100/bln</td>
                      <td className="text-center" ${colPro}>Unlimited</td>
                      <td className="text-center" ${colBusiness}>Unlimited + logo</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 fw-medium" ${stickyBody}>
                        Lacak order link
                      </td>
                      <td className="text-center text-muted" ${colTrial}>Ada watermark</td>
                      <td className="text-center text-muted" ${colStarter}>Ada watermark</td>
                      <td className="text-center text-success fw-medium bg-primary-subtle border-start border-end" ${colBasic}>Tanpa watermark</td>
                      <td className="text-center text-success" ${colPro}>Tanpa watermark</td>
                      <td className="text-center text-success" ${colBusiness}>+ Tampilan custom</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 fw-medium" ${stickyBody}>
                        Stok bahan
                      </td>
                      <td className="text-center text-muted opacity-40" ${colTrial}><i className="bi bi-x-circle-fill"></i></td>
                      <td className="text-center" ${colStarter}>5 item</td>
                      <td className="text-center fw-bold bg-primary-subtle border-start border-end" ${colBasic}>20 item</td>
                      <td className="text-center" ${colPro}>50 item</td>
                      <td className="text-center" ${colBusiness}>Unlimited</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 fw-medium" ${stickyBody}>
                        Notifikasi stok menipis
                      </td>
                      <td className="text-center text-muted opacity-40" ${colTrial}><i className="bi bi-x-circle-fill"></i></td>
                      <td className="text-center text-muted opacity-40" ${colStarter}><i className="bi bi-x-circle-fill"></i></td>
                      <td className="text-center text-success bg-primary-subtle border-start border-end" ${colBasic}><i className="bi bi-check-circle-fill"></i></td>
                      <td className="text-center text-success" ${colPro}><i className="bi bi-check-circle-fill"></i></td>
                      <td className="text-center text-success" ${colBusiness}><i className="bi bi-check-circle-fill"></i></td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 fw-medium" ${stickyBody}>
                        Jumlah outlet
                      </td>
                      <td className="text-center" ${colTrial}>1</td>
                      <td className="text-center" ${colStarter}>1</td>
                      <td className="text-center fw-bold bg-primary-subtle border-start border-end" ${colBasic}>1</td>
                      <td className="text-center" ${colPro}>2</td>
                      <td className="text-center" ${colBusiness}>5</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 fw-medium" ${stickyBody}>
                        Jumlah kasir/user
                      </td>
                      <td className="text-center" ${colTrial}>1</td>
                      <td className="text-center" ${colStarter}>2</td>
                      <td className="text-center fw-bold bg-primary-subtle border-start border-end" ${colBasic}>3</td>
                      <td className="text-center" ${colPro}>5</td>
                      <td className="text-center" ${colBusiness}>15</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 fw-medium" ${stickyBody}>
                        Riwayat data
                      </td>
                      <td className="text-center" ${colTrial}>1 bulan</td>
                      <td className="text-center" ${colStarter}>3 bulan</td>
                      <td className="text-center fw-bold bg-primary-subtle border-start border-end" ${colBasic}>6 bulan</td>
                      <td className="text-center" ${colPro}>12 bulan</td>
                      <td className="text-center" ${colBusiness}>24 bulan</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 fw-medium" ${stickyBody}>
                        Foto disimpan
                      </td>
                      <td className="text-center" ${colTrial}>30 hari</td>
                      <td className="text-center" ${colStarter}>60 hari</td>
                      <td className="text-center fw-bold bg-primary-subtle border-start border-end" ${colBasic}>90 hari</td>
                      <td className="text-center" ${colPro}>180 hari</td>
                      <td className="text-center" ${colBusiness}>365 hari</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 fw-medium" ${stickyBody}>
                        Tipe Support
                      </td>
                      <td className="text-center" ${colTrial}>Panduan</td>
                      <td className="text-center" ${colStarter}>Komunitas</td>
                      <td className="text-center fw-bold bg-primary-subtle border-start border-end" ${colBasic}>Chat</td>
                      <td className="text-center" ${colPro}>Prioritas</td>
                      <td className="text-center" ${colBusiness}>Prioritas + Onboard</td>
                    </tr>
                  </tbody>
                  <tfoot className="table-light border-top">
                    <tr>
                      <td className="px-3 py-3 fw-bold" ${stickyFoot}>
                        Aksi Langganan
                      </td>
                      {/* TRIAL */}
                      <td className="text-center py-3 px-2" ${colTrial}>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary text-white rounded-pill px-3 py-1 fw-semibold text-nowrap shadow-xs"
                          style={{ fontSize: '0.74rem' }}
                          onClick={() => setConfirmModal({ open: true, planKey: 'TRIAL', planName: 'Trial (Gratis)' })}
                        >
                          Terapkan
                        </button>
                      </td>
                      {/* STARTER */}
                      <td className="text-center py-3 px-2" ${colStarter}>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary text-white rounded-pill px-3 py-1 fw-semibold text-nowrap shadow-xs"
                          style={{ fontSize: '0.74rem' }}
                          onClick={() => setConfirmModal({ open: true, planKey: 'STARTER', planName: 'Starter 25rb' })}
                        >
                          Terapkan
                        </button>
                      </td>
                      {/* BASIC */}
                      <td className="text-center py-3 px-2 bg-primary-subtle border-start border-end" ${colBasic}>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary text-white rounded-pill px-3 py-1 fw-semibold text-nowrap shadow-xs"
                          style={{ fontSize: '0.74rem' }}
                          onClick={() => setConfirmModal({ open: true, planKey: 'BASIC', planName: 'Basic 50rb ⭐' })}
                        >
                          Terapkan
                        </button>
                      </td>
                      {/* PRO */}
                      <td className="text-center py-3 px-2" ${colPro}>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary text-white rounded-pill px-3 py-1 fw-semibold text-nowrap shadow-xs"
                          style={{ fontSize: '0.74rem' }}
                          onClick={() => setConfirmModal({ open: true, planKey: 'PRO', planName: 'Pro 100rb' })}
                        >
                          Terapkan
                        </button>
                      </td>
                      {/* BUSINESS */}
                      <td className="text-center py-3 px-2" ${colBusiness}>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary text-white rounded-pill px-3 py-1 fw-semibold text-nowrap shadow-xs"
                          style={{ fontSize: '0.74rem' }}
                          onClick={() => setConfirmModal({ open: true, planKey: 'BUSINESS', planName: 'Business 200rb' })}
                        >
                          Terapkan
                        </button>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>`;

content = content.slice(0, startIndex) + newTableHtml + content.slice(endIndex + endMarkerLength);
fs.writeFileSync(path, content, 'utf8');
console.log('Successfully updated Plan.jsx table and action buttons!');
