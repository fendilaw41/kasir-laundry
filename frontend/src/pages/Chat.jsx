import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import {
  getChatConfig,
  fetchConversationsFromBackend,
  initChatSocket,
  disconnectChatSocket,
} from '../services/chatService';
import ChatInboxList from '../components/chat/ChatInboxList';
import ChatRoom from '../components/chat/ChatRoom';
import BotChatRoom from '../components/chat/BotChatRoom';
import NewChatModal from '../components/chat/NewChatModal';

const Chat = ({ user }) => {
  // selectedConversation: null (Inbox list) | 'bot' (Pinned Asisten Order) | Conversation Object
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [config, setConfig] = useState({ enableCrossStoreChat: false, storageDriver: 'local' });
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const { setChatHeaderState } = useOutletContext() || {};

  // Ambil data percakapan reaktif dari Dexie IndexedDB
  const localConversations = useLiveQuery(
    async () => {
      return await db.conversations.orderBy('updatedAt').reverse().toArray();
    },
    [],
  );

  const handleBackToInbox = useCallback(() => {
    setSelectedConversation(null);
    fetchConversationsFromBackend();
  }, []);

  // Update header utama di Layout sesuai percakapan aktif
  useEffect(() => {
    if (!selectedConversation) {
      setChatHeaderState?.(null);
    } else if (selectedConversation === 'bot') {
      setChatHeaderState?.({
        type: 'bot',
        title: 'Asisten Order & Bot',
        subtitle: 'Otomasi Transaksi & Cek Nota',
        onBack: handleBackToInbox,
      });
    } else {
      const isGroup = selectedConversation.type === 'GROUP' || selectedConversation.type === 'CROSS_STORE';
      const isCrossStore = selectedConversation.type === 'CROSS_STORE';
      setChatHeaderState?.({
        type: 'chat',
        title: selectedConversation.title || 'Obrolan',
        isGroup,
        isCrossStore,
        avatarLetter: selectedConversation.title?.charAt(0).toUpperCase() || 'U',
        onBack: handleBackToInbox,
      });
    }
  }, [selectedConversation, setChatHeaderState, handleBackToInbox]);

  // Bersihkan custom header saat meninggalkan halaman chat
  useEffect(() => {
    return () => {
      setChatHeaderState?.(null);
    };
  }, [setChatHeaderState]);

  useEffect(() => {
    // 1. Muat konfigurasi server
    getChatConfig().then(setConfig);

    // 2. Tarik daftar percakapan terbaru dari backend jika online
    fetchConversationsFromBackend();

    // 3. Inisialisasi WebSocket realtime
    initChatSocket({
      onNewMessage: (msg) => {
        console.log('[Chat] Realtime new message received:', msg);
      },
    });

    const handleOpenModal = () => setShowNewChatModal(true);
    window.addEventListener('openNewChatModal', handleOpenModal);

    return () => {
      disconnectChatSocket();
      window.removeEventListener('openNewChatModal', handleOpenModal);
    };
  }, []);

  const handleSelectConversation = (conv) => {
    setSelectedConversation(conv);
  };

  const handleConversationCreated = (newConv) => {
    setSelectedConversation(newConv);
  };

  const handleUpdateSubtitle = useCallback((subtitle) => {
    setChatHeaderState?.((prev) => {
      if (!prev || prev.subtitle === subtitle) return prev;
      return { ...prev, subtitle };
    });
  }, [setChatHeaderState]);

  return (
    <div
      className="bg-white"
      style={{
        position: 'fixed',
        top: '50px',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10,
      }}
    >
      <div
        className="card shadow-none border-0 rounded-0 d-flex flex-column mx-auto w-100 bg-transparent h-100 position-relative"
        style={{ maxWidth: '800px' }}
      >
        {/* TAMPILAN 1: PINNED ASISTEN ORDER BOT */}
        {selectedConversation === 'bot' && (
          <BotChatRoom user={user} onBack={handleBackToInbox} />
        )}

        {/* TAMPILAN 2: CHAT ROOM SESAMA MEMBER / GRUP */}
        {selectedConversation && selectedConversation !== 'bot' && (
          <ChatRoom
            conversation={selectedConversation}
            currentUser={user}
            onBack={handleBackToInbox}
            onUpdateSubtitle={handleUpdateSubtitle}
          />
        )}

        {/* TAMPILAN 3: INBOX LIST (DEFAULT WHATSAPP STYLE) */}
        {!selectedConversation && (
          <ChatInboxList
            conversations={localConversations || []}
            onSelectConversation={handleSelectConversation}
            onOpenNewChatModal={() => setShowNewChatModal(true)}
            enableCrossStore={config.enableCrossStoreChat}
            currentUser={user}
          />
        )}
      </div>

      {/* Modal Mulai Chat Baru / Buat Grup */}
      <NewChatModal
        show={showNewChatModal}
        onClose={() => setShowNewChatModal(false)}
        onConversationCreated={handleConversationCreated}
        currentUser={user}
        enableCrossStore={config.enableCrossStoreChat}
      />
    </div>
  );
};

export default Chat;
