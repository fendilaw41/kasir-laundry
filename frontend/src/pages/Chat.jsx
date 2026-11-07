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

  const currentUserId = String(user?.uuid || user?.id || user?.userId || '');
  const currentUsername = (user?.username || '').toLowerCase().trim();

  const isUserMember = useCallback((conv) => {
    if (!conv?.members || !Array.isArray(conv.members)) return true;
    return conv.members.some((m) => {
      const memberUserId = String(m.userId || m.user?.id || m.user?.uuid || '');
      const memberUsername = (m.user?.username || '').toLowerCase().trim();
      return (
        (memberUserId && memberUserId === currentUserId) ||
        (currentUsername && memberUsername === currentUsername)
      );
    });
  }, [currentUserId, currentUsername]);

  const filteredLocalConversations = (localConversations || []).filter((conv) => {
    if (user?.role === 'kasir') {
      return isUserMember(conv);
    }
    return true;
  });

  const handleBackToInbox = useCallback(() => {
    setSelectedConversation(null);
    fetchConversationsFromBackend();
  }, []);

  // Update header utama di Layout sesuai percakapan aktif
  useEffect(() => {
    if (!selectedConversation) {
      setChatHeaderState?.(prev => (prev === null ? prev : null));
    } else if (selectedConversation === 'bot') {
      setChatHeaderState?.(prev => {
        if (prev?.type === 'bot') return prev;
        return {
          type: 'bot',
          title: 'Asisten Order & Bot',
          subtitle: 'Otomasi Transaksi & Cek Nota',
          onBack: handleBackToInbox,
        };
      });
    } else {
      const isGroup = selectedConversation.type === 'GROUP' || selectedConversation.type === 'CROSS_STORE';
      const isCrossStore = selectedConversation.type === 'CROSS_STORE';

      // Temukan data lawan bicara untuk direct chat
      const otherMember = selectedConversation.members?.find((m) => {
        const mUserId = String(m.userId || m.user?.id || m.user?.uuid || '');
        const mUsername = (m.user?.username || '').toLowerCase().trim();
        return (mUserId && mUserId !== currentUserId) || (mUsername && mUsername !== currentUsername);
      });

      const otherUser =
        selectedConversation.targetUser ||
        selectedConversation.otherUser ||
        otherMember?.user;

      const otherName =
        otherUser?.fullname ||
        otherUser?.username ||
        otherMember?.fullname ||
        otherMember?.username;

      // Untuk DIRECT chat, nama lawan bicara harus selalu ditampilkan (jangan pernah tampil 'Obrolan')
      let title = selectedConversation.title;
      if (!isGroup) {
        title = otherName || (title && title !== 'Obrolan' && title !== 'Percakapan' ? title : '') || otherMember?.user?.fullname || 'Obrolan';
      } else {
        title = title || 'Grup Obrolan';
      }

      const isOwner = Boolean(
        selectedConversation.isOwner ||
        otherUser?.role?.toLowerCase() === 'owner' ||
        otherMember?.user?.role?.toLowerCase() === 'owner' ||
        (!isGroup && selectedConversation.members?.some(m => m.user?.role?.toLowerCase() === 'owner' && String(m.userId || m.user?.id) !== currentUserId))
      );

      const avatarLetter = (title && title !== 'Obrolan' ? title : (otherName || 'U')).charAt(0).toUpperCase() || 'U';

      // Subtitle: tampilkan role & cabang toko (misal: "kasir • Laundry 03")
      let subtitle = selectedConversation.subtitle;
      if (!subtitle) {
        if (isCrossStore) {
          subtitle = 'Obrolan Lintas Cabang';
        } else if (isGroup) {
          subtitle = `${selectedConversation.members?.length || 0} Anggota`;
        } else if (otherUser) {
          const roleLabel = otherUser.role ? (otherUser.role.toLowerCase() === 'owner' ? 'Owner' : 'Kasir') : '';
          const storeLabel = otherUser.store?.name || '';
          subtitle = [roleLabel, storeLabel].filter(Boolean).join(' • ');
        }
      }

      setChatHeaderState?.(prev => {
        // Cegah re-render berulang jika nilai header tidak berubah
        if (
          prev &&
          prev.type === 'chat' &&
          prev.title === title &&
          prev.subtitle === subtitle &&
          prev.isGroup === isGroup &&
          prev.isCrossStore === isCrossStore &&
          prev.isOwner === isOwner &&
          prev.avatarLetter === avatarLetter
        ) {
          return prev;
        }

        return {
          type: 'chat',
          title,
          subtitle,
          isGroup,
          isCrossStore,
          isOwner,
          avatarLetter,
          onBack: handleBackToInbox,
        };
      });
    }
  }, [selectedConversation, setChatHeaderState, handleBackToInbox, currentUserId, currentUsername]);

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
            conversations={filteredLocalConversations}
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
