import React, { useMemo } from 'react';
import qrcode from '../../utils/qrcode-generator';

export const QRCodeSVG = ({
  value,
  size = 90,
  level = 'M',
  className = '',
  style = {},
}) => {
  const svgHtml = useMemo(() => {
    if (!value) return '';
    try {
      const qr = qrcode(0, level);
      qr.addData(String(value));
      qr.make();
      // createSvgTag(cellSize, margin)
      return qr.createSvgTag(3, 0);
    } catch (e) {
      console.warn('[QRCodeSVG] Gagal generate QR code:', e);
      return '';
    }
  }, [value, level]);

  if (!svgHtml) return null;

  return (
    <div
      className={`qrcode-svg-container ${className}`}
      style={{
        display: 'inline-block',
        width: `${size}px`,
        height: `${size}px`,
        ...style,
      }}
      dangerouslySetInnerHTML={{
        __html: svgHtml.replace(
          /<svg([^>]*)width="[^"]*" height="[^"]*"/,
          `<svg$1width="100%" height="100%"`
        ),
      }}
    />
  );
};

export default QRCodeSVG;

