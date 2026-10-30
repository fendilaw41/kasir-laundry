import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * PageLoader component
 * Menggunakan gaya template preloader (#preloader) dan .circle-spinner dari Affan PWA theme.
 * Menampilkan loading setiap kali berpindah halaman dengan jeda waktu minimal
 * agar transisi halaman tidak terasa terlalu cepat atau berkedip instan.
 */
const PageLoader = ({ minDuration = 400 }) => {
  const location = useLocation();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';
  const [loading, setLoading] = useState(!isAuthPage);
  const [fading, setFading] = useState(false);
  const prevPathRef = useRef(location.pathname);
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isAuthPage) {
      setLoading(false);
      setFading(false);
      return;
    }

    // Pada perpindahan halaman berikutnya (bukan initial mount)
    if (!isInitialMount.current) {
      if (prevPathRef.current !== location.pathname) {
        prevPathRef.current = location.pathname;
        setLoading(true);
        setFading(false);
      } else {
        return;
      }
    } else {
      isInitialMount.current = false;
    }

    // Timer untuk menahan tampilan loading agar perpindahan tidak terlalu cepat
    let fadeTimer;
    const holdTimer = setTimeout(() => {
      setFading(true);
      fadeTimer = setTimeout(() => {
        setLoading(false);
        setFading(false);
      }, 250); // durasi fade-out CSS
    }, minDuration);

    return () => {
      clearTimeout(holdTimer);
      if (fadeTimer) clearTimeout(fadeTimer);
    };
  }, [location.pathname, minDuration, isAuthPage]);

  // Safety timeout agar preloader tidak pernah macet
  useEffect(() => {
    if (loading && !isAuthPage) {
      const safetyTimer = setTimeout(() => {
        setLoading(false);
        setFading(false);
      }, minDuration + 500);
      return () => clearTimeout(safetyTimer);
    }
  }, [loading, isAuthPage, minDuration]);

  if (!loading || isAuthPage) return null;

  return (
    <div
      id="preloader"
      style={{
        transition: 'opacity 0.25s ease-out, visibility 0.25s ease-out',
        opacity: fading ? 0 : 1,
        visibility: fading && !loading ? 'hidden' : 'visible',
        pointerEvents: loading && !fading ? 'auto' : 'none',
      }}
    >
      <div className="circle-spinner">
        <div className="circle"></div>
      </div>
    </div>
  );
};

export default PageLoader;
