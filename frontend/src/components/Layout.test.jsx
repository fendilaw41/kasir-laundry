import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useOutletContext } from 'react-router-dom';
import Layout from './Layout';
import React, { useEffect } from 'react';

// Komponen simulasi halaman chat yang memanfaatkan outlet context
const MockChatPage = ({ activeType, customTitle }) => {
  const { setChatHeaderState } = useOutletContext() || {};

  useEffect(() => {
    if (activeType === 'bot') {
      setChatHeaderState?.({
        type: 'bot',
        title: 'Asisten Order & Bot',
        subtitle: 'Otomasi Transaksi & Cek Nota',
        onBack: vi.fn(),
      });
    } else if (activeType === 'user') {
      const name = customTitle || 'Keenan Kasir';
      setChatHeaderState?.({
        type: 'chat',
        title: name,
        subtitle: 'Kasir Cabang',
        avatarLetter: name.charAt(0).toUpperCase(),
        onBack: vi.fn(),
      });
    } else {
      setChatHeaderState?.(null);
    }
  }, [activeType, customTitle, setChatHeaderState]);

  return <div data-testid="chat-page">Mock Chat Body</div>;
};

describe('Layout Chat Header Integration', () => {
  it('menampilkan title "Chat" dan tombol "+ Chat Baru" saat berada di inbox list', () => {
    render(
      <MemoryRouter initialEntries={['/chat']}>
        <Routes>
          <Route element={<Layout user={{ role: 'kasir' }} onLogout={vi.fn()} />}>
            <Route path="/chat" element={<MockChatPage activeType={null} />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Chat')).not.toBeNull();
    expect(screen.getByText('Chat Baru')).not.toBeNull();
  });

  it('menampilkan nama bot, avatar bot, tombol ⚡ mode cepat, dan menyembunyikan "Chat Baru" saat masuk ke bot', () => {
    render(
      <MemoryRouter initialEntries={['/chat']}>
        <Routes>
          <Route element={<Layout user={{ role: 'kasir' }} onLogout={vi.fn()} />}>
            <Route path="/chat" element={<MockChatPage activeType="bot" />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    // Header harus menampilkan nama bot dan subtitle
    expect(screen.getByText('Asisten Order & Bot')).not.toBeNull();
    expect(screen.getByText('Otomasi Transaksi & Cek Nota')).not.toBeNull();

    // Tombol "+ Chat Baru" harus hilang
    expect(screen.queryByText('Chat Baru')).toBeNull();

    // Tombol mode cepat (⚡) dan percakapan baru (+) harus ada
    expect(screen.getByTitle(/Mode Cepat/i)).not.toBeNull();
    expect(screen.getByTitle(/Percakapan Baru/i)).not.toBeNull();
  });

  it('menampilkan nama partner, avatar huruf, menyembunyikan "+ Chat Baru", dan tanpa tombol ⚡ saat chat member', () => {
    render(
      <MemoryRouter initialEntries={['/chat']}>
        <Routes>
          <Route element={<Layout user={{ role: 'kasir' }} onLogout={vi.fn()} />}>
            <Route path="/chat" element={<MockChatPage activeType="user" customTitle="Fendi Kasir" />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    // Nama partner tampil
    expect(screen.getByText('Fendi Kasir')).not.toBeNull();
    expect(screen.getByText('Kasir Cabang')).not.toBeNull();
    expect(screen.getByText('F')).not.toBeNull(); // Avatar huruf

    // "+ Chat Baru" hilang
    expect(screen.queryByText('Chat Baru')).toBeNull();

    // Tombol Mode Cepat bot tidak boleh tampil
    expect(screen.queryByTitle(/Mode Cepat/i)).toBeNull();
  });
});
