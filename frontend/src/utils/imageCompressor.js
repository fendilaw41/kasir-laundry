/**
 * Kompresi gambar sisi klien menggunakan HTML5 Canvas
 * Mengurangi resolusi foto kamera berukuran besar sebelum disimpan di IndexedDB / diunggah
 * 
 * @param {File | Blob} file - Berkas gambar asli
 * @param {Object} options
 * @param {number} options.maxWidth - Maksimum lebar (default: 1280px)
 * @param {number} options.maxHeight - Maksimum tinggi (default: 1280px)
 * @param {number} options.quality - Kualitas kompresi JPEG 0 - 1 (default: 0.82)
 * @returns {Promise<{ blob: Blob, width: number, height: number, size: number }>}
 */
export async function compressImage(file, options = {}) {
  const {
    maxWidth = 1280,
    maxHeight = 1280,
    quality = 0.82,
  } = options;

  return new Promise((resolve, reject) => {
    // Jika bukan gambar, kembalikan berkas asli
    if (!file.type.startsWith('image/')) {
      return resolve({
        blob: file,
        width: 0,
        height: 0,
        size: file.size,
      });
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca berkas gambar.'));
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Gagal memuat elemen gambar.'));
      img.onload = () => {
        let { width, height } = img;

        // Hitung skala rasio gambar
        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve({
            blob: file,
            width: img.width,
            height: img.height,
            size: file.size,
          });
        }

        // Gambar ulang dengan ukuran baru
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return resolve({
                blob: file,
                width,
                height,
                size: file.size,
              });
            }

            resolve({
              blob,
              width,
              height,
              size: blob.size,
            });
          },
          'image/jpeg',
          quality,
        );
      };

      img.src = event.target.result;
    };

    reader.readAsDataURL(file);
  });
}

