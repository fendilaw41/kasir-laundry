/**
 * Utilitas pemutar suara sukses transaksi menggunakan Web Audio API
 * Ringan, bekerja 100% offline, tanpa dependensi file eksternal
 */
export const playSuccessChime = () => {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    const playNote = (freq, start, duration, volume = 0.18) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + duration);
    };

    // Nada keberhasilan bertingkat (C5 -> E5 -> G5)
    playNote(523.25, now, 0.18, 0.15);        // C5
    playNote(659.25, now + 0.11, 0.18, 0.18); // E5
    playNote(783.99, now + 0.22, 0.45, 0.22); // G5
  } catch (err) {
    console.warn('[Audio] Tidak dapat memutar audio chime:', err);
  }
};

