import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

/**
 * Barcode 1D (Code 128) Component
 * Render via SVG murni sehingga tajam untuk cetak thermal (58mm) maupun A4
 * dan 100% bekerja secara offline tanpa koneksi internet.
 */
export const Barcode = ({
  value,
  format = 'CODE128',
  width = 1.4,
  height = 42,
  displayValue = true,
  fontSize = 10,
  font = 'monospace',
  margin = 2,
  style = {},
  className = '',
}) => {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;
    try {
      JsBarcode(svgRef.current, String(value).trim(), {
        format,
        width,
        height,
        displayValue,
        fontSize,
        font,
        margin,
        background: '#ffffff',
        lineColor: '#000000',
        flat: true,
      });
    } catch (err) {
      console.warn('[Barcode] Gagal render barcode:', err);
    }
  }, [value, format, width, height, displayValue, fontSize, font, margin]);

  if (!value) return null;

  return (
    <div className={`barcode-container ${className}`} style={{ textAlign: 'center', margin: '4px 0', ...style }}>
      <svg ref={svgRef} style={{ maxWidth: '100%', height: 'auto', display: 'inline-block' }} />
    </div>
  );
};

export default Barcode;

