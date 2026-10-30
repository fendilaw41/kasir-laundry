import { io } from 'socket.io-client';
import { db } from '../db';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
// Dapatkan base URL tanpa akhiran /api untuk koneksi WebSocket
const SOCKET_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, '');

let socket = null;
let isSyncing = false;

/**
 * Mengambil JWT Bearer Token dari penyimpanan browser
 */
export function getAuthToken() {
  return (
    sessionStorage.getItem('token') ||
    localStorage.getItem('auth_token') ||
    JSON.parse(sessionStorage.getItem('user') || '{}')?.token ||
    JSON.parse(localStorage.getItem('user') || '{}')?.token ||
    ''
  );
}

/**
 * Helper pembuat HTTP Headers dengan otorisasi Bearer Token
 */
function getAuthHeaders(customHeaders = {}) {
  const token = getAuthToken();
  const headers = { ...customHeaders };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Mengambil konfigurasi fitur chat dari server
 */
export async function getChatConfig() {
  try {
    const res = await fetch(`${API_BASE_URL}/chat/config`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Gagal mengambil konfigurasi chat.');
    const json = await res.json();
    return json.data || { enableCrossStoreChat: false, storageDriver: 'local' };
  } catch (error) {
    console.warn('[Chat] Gagal memuat konfigurasi dari backend, menggunakan default lokal:', error);
    return { enableCrossStoreChat: false, storageDriver: 'local' };
  }
}

/**
 * Mengambil daftar kontak untuk memulai percakapan baru
 */
export async function getChatContacts() {
  const res = await fetch(`${API_BASE_URL}/chat/contacts`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Gagal memuat daftar kontak.');
  const json = await res.json();
  return json.data || [];
}

/**
 * Mengambil daftar percakapan aktif dari backend dan memperbarui cache Dexie
 */
export async function fetchConversationsFromBackend() {
  try {
    const res = await fetch(`${API_BASE_URL}/chat/conversations`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Gagal memuat percakapan dari server.');
    const json = await res.json();
    const conversations = json.data || [];

    // Perbarui cache Dexie
    if (conversations.length > 0) {
      await db.conversations.bulkPut(conversations);
    }

    return conversations;
  } catch (error) {
    console.warn('[Chat] Menggunakan cache percakapan lokal dari Dexie:', error);
    return await db.conversations.orderBy('updatedAt').reverse().toArray();
  }
}

/**
 * Membuat percakapan baru (DIRECT, GROUP, atau CROSS_STORE)
 */
export async function createConversation(payload) {
  const res = await fetch(`${API_BASE_URL}/chat/conversations`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson.message || 'Gagal membuat percakapan.');
  }

  const json = await res.json();
  const created = json.data;

  // Simpan ke Dexie
  if (created) {
    await db.conversations.put(created);
  }

  return created;
}

/**
 * Mengambil riwayat pesan dari server atau Dexie
 */
export async function getMessages(conversationId) {
  try {
    if (navigator.onLine) {
      const res = await fetch(
        `${API_BASE_URL}/chat/conversations/${conversationId}/messages?limit=60&_t=${Date.now()}`,
        {
          headers: getAuthHeaders({ 'Cache-Control': 'no-cache, no-store' }),
          cache: 'no-store',
        },
      );
      if (res.ok) {
        const json = await res.json();
        const serverMessages = json.data || [];

        // Simpan dan perbarui pesan server ke Dexie (termasuk status READ terbaru dari DB)
        for (const msg of serverMessages) {
          const existing = (await db.messages.where('uuid').equals(msg.uuid).first()) ||
                           (await db.messages.get(msg.id));
          if (existing && existing.id !== msg.id) {
            await db.messages.delete(existing.id);
          }
          await db.messages.put({
            ...existing,
            ...msg,
            status: msg.status || 'SENT',
          });
        }
      }
    }
  } catch (error) {
    console.warn('[Chat] Mode offline: memuat pesan dari database lokal.');
  }

  // Ambil gabungan pesan dari Dexie yang terurut berdasarkan createdAt
  const localMessages = await db.messages
    .where('conversationId')
    .equals(conversationId)
    .sortBy('createdAt');

  return localMessages;
}

/**
 * Mengunggah file foto chat ke backend (Local / S3 MinIO)
 */
export async function uploadChatPhoto(fileOrBlob, conversationId) {
  const formData = new FormData();
  formData.append('file', fileOrBlob, 'chat_photo.jpg');
  formData.append('conversationId', conversationId);

  const res = await fetch(`${API_BASE_URL}/chat/upload`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson.message || 'Gagal mengunggah foto.');
  }

  const json = await res.json();
  return json.data;
}

/**
 * Mengirim pesan baru (Online langsung kirim, Offline simpan ke Dexie PENDING)
 */
export async function sendMessage({
  conversationId,
  content = '',
  type = 'TEXT',
  imageBlob = null,
  imageWidth = null,
  imageHeight = null,
  metadata = null,
  currentUser,
}) {
  const uuid = crypto.randomUUID();
  const now = new Date().toISOString();

  // Bentuk objek pesan lokal
  const localMessage = {
    id: `local-${uuid}`,
    uuid,
    conversationId,
    senderId: currentUser.uuid || currentUser.id || currentUser.userId,
    sender: {
      id: currentUser.uuid || currentUser.id || currentUser.userId,
      uuid: currentUser.uuid || currentUser.id || currentUser.userId,
      fullname: currentUser.fullname || currentUser.username || 'Saya',
      username: currentUser.username || 'saya',
      role: currentUser.role || 'kasir',
      storeId: currentUser.storeId,
    },
    content: content.trim() || null,
    type,
    imageBlob: imageBlob || null, // Sementara disimpan di Dexie jika offline
    imageUrl: null,
    imageWidth,
    imageHeight,
    fileSize: imageBlob ? imageBlob.size : null,
    status: 'PENDING',
    metadata,
    createdAt: now,
    updatedAt: now,
  };

  // 1. Simpan pesan ke IndexedDB lokal segera
  await db.messages.put(localMessage);

  // 2. Perbarui ringkasan pesan terakhir di percakapan Dexie
  await db.conversations.update(conversationId, {
    updatedAt: now,
    lastMessage: {
      content: localMessage.content,
      type: localMessage.type,
      createdAt: now,
      sender: { fullname: localMessage.sender.fullname },
    },
  }).catch(() => {});

  // 3. Jika online, segera lakukan pengiriman ke server
  if (navigator.onLine) {
    try {
      let finalImageUrl = null;

      // Jika ada lampiran foto, unggah ke server terlebih dahulu
      if (imageBlob) {
        const uploadResult = await uploadChatPhoto(imageBlob, conversationId);
        finalImageUrl = uploadResult.imageUrl;
      }

      const res = await fetch(`${API_BASE_URL}/chat/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          uuid,
          conversationId,
          content: localMessage.content,
          type: localMessage.type,
          imageUrl: finalImageUrl,
          imageWidth: localMessage.imageWidth,
          imageHeight: localMessage.imageHeight,
          fileSize: localMessage.fileSize,
          metadata: localMessage.metadata,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const serverMsg = json.data;

        // Sukses terkirim: perbarui entri di Dexie dengan ID resmi dari server
        if (serverMsg) {
          if (localMessage.id !== serverMsg.id) {
            await db.messages.delete(localMessage.id);
          }
          await db.messages.put({
            ...localMessage,
            ...serverMsg,
            status: serverMsg.status || 'SENT',
            imageUrl: serverMsg.imageUrl || finalImageUrl,
            imageBlob: null,
            updatedAt: serverMsg.updatedAt || now,
          });
        }

        // Trigger socket emit jika socket aktif
        if (socket?.connected) {
          socket.emit('send_message', {
            uuid,
            conversationId,
            content: localMessage.content,
            type: localMessage.type,
            imageUrl: finalImageUrl,
          });
        }

        return { ...serverMsg, status: 'SENT' };
      }
    } catch (err) {
      console.warn('[Chat] Gagal mengirim online, pesan tetap tersimpan di antrian PENDING:', err);
    }
  }

  return localMessage;
}

/**
 * Sinkronisasi pesan yang tertunda (status: PENDING) ke backend saat online
 */
export async function syncPendingMessages() {
  if (isSyncing || !navigator.onLine) return;
  isSyncing = true;

  try {
    const pendingMessages = await db.messages.where('status').equals('PENDING').toArray();
    if (pendingMessages.length === 0) {
      isSyncing = false;
      return;
    }

    console.log(`[Chat] Memulai sinkronisasi ${pendingMessages.length} pesan tertunda...`);

    for (const msg of pendingMessages) {
      try {
        let imageUrl = msg.imageUrl;

        // Jika ada imageBlob dan belum diunggah, unggah sekarang
        if (msg.imageBlob && !imageUrl) {
          const uploadResult = await uploadChatPhoto(msg.imageBlob, msg.conversationId);
          imageUrl = uploadResult.imageUrl;
        }

        const res = await fetch(
          `${API_BASE_URL}/chat/conversations/${msg.conversationId}/messages`,
          {
            method: 'POST',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
              uuid: msg.uuid,
              conversationId: msg.conversationId,
              content: msg.content,
              type: msg.type,
              imageUrl,
              imageWidth: msg.imageWidth,
              imageHeight: msg.imageHeight,
              fileSize: msg.fileSize,
              metadata: msg.metadata,
            }),
          },
        );

        if (res.ok) {
          const json = await res.json();
          const serverMsg = json.data;

          // Perbarui status menjadi SENT dan bersihkan imageBlob dari IndexedDB
          if (serverMsg) {
            if (msg.id !== serverMsg.id) {
              await db.messages.delete(msg.id);
            }
            await db.messages.put({
              ...msg,
              ...serverMsg,
              status: serverMsg.status || 'SENT',
              imageUrl: serverMsg.imageUrl || imageUrl,
              imageBlob: null, // Hapus binary dari memori lokal
              updatedAt: serverMsg.updatedAt,
            });
          }
        }
      } catch (uploadErr) {
        console.warn(`[Chat] Gagal sinkronisasi pesan ${msg.uuid}:`, uploadErr);
      }
    }

    // Beritahukan UI bahwa sinkronisasi selesai
    window.dispatchEvent(new CustomEvent('chatMessagesSynced'));
  } catch (error) {
    console.error('[Chat] Error pada proses syncPendingMessages:', error);
  } finally {
    isSyncing = false;
  }
}

/**
 * Menandai percakapan telah dibaca
 */
export async function markConversationAsRead(conversationId) {
  try {
    if (navigator.onLine) {
      await fetch(`${API_BASE_URL}/chat/conversations/${conversationId}/read`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (socket?.connected) {
        socket.emit('mark_read', { conversationId });
      }
    }

    // Reset unreadCount lokal di Dexie
    await db.conversations.update(conversationId, { unreadCount: 0 }).catch(() => {});
  } catch (err) {
    console.warn('[Chat] Gagal mark conversation as read:', err);
  }
}

/**
 * Inisialisasi Socket.io client untuk percakapan realtime
 */
export function initChatSocket({ onNewMessage, onMessageDelivered, onUserTyping }) {
  const token = getAuthToken();
  if (!token) return null;

  if (socket && socket.connected) {
    return socket;
  }

  socket = io(`${SOCKET_BASE_URL}/chat`, {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    console.log('[Chat] Socket connected:', socket.id);
    // Jalankan sinkronisasi pesan pending saat tersambung kembali
    syncPendingMessages();
  });

  socket.on('new_message', async (message) => {
    // Tambahkan atau perbarui pesan di Dexie
    await db.messages.put({
      ...message,
      status: 'SENT',
    });

    // Perbarui percakapan terakhir di Dexie
    await db.conversations.update(message.conversationId, {
      updatedAt: message.createdAt,
      lastMessage: {
        content: message.content,
        type: message.type,
        createdAt: message.createdAt,
        sender: { fullname: message.sender?.fullname },
      },
    }).catch(() => {});

    if (onNewMessage) {
      onNewMessage(message);
    }
    window.dispatchEvent(new CustomEvent('chatNewMessage', { detail: message }));
  });

  socket.on('message_delivered', async (ack) => {
    if (ack?.uuid) {
      const msg = await db.messages.where('uuid').equals(ack.uuid).first();
      if (msg) {
        await db.messages.update(msg.id, {
          status: 'SENT',
          id: ack.messageId || msg.id,
        });
      }
    }
    if (onMessageDelivered) {
      onMessageDelivered(ack);
    }
    window.dispatchEvent(new CustomEvent('chatMessageDelivered', { detail: ack }));
  });

  socket.on('conversation_read', async (data) => {
    if (data?.conversationId) {
      await db.messages
        .where('conversationId')
        .equals(data.conversationId)
        .modify((msg) => {
          if (msg.status !== 'PENDING') {
            msg.status = 'READ';
          }
        })
        .catch(() => {});
      window.dispatchEvent(new CustomEvent('chatMessagesRead', { detail: data }));
    }
  });

  socket.on('user_typing', (data) => {
    if (onUserTyping) {
      onUserTyping(data);
    }
  });

  return socket;
}

/**
 * Bergabung ke room percakapan di WebSocket
 */
export function joinConversationRoom(conversationId) {
  if (socket?.connected && conversationId) {
    socket.emit('join_conversation', { conversationId });
  }
}

/**
 * Keluar dari room percakapan di WebSocket
 */
export function leaveConversationRoom(conversationId) {
  if (socket?.connected && conversationId) {
    socket.emit('leave_conversation', { conversationId });
  }
}

/**
 * Mengirim event indikator mengetik
 */
export function emitTyping(conversationId, isTyping) {
  if (socket?.connected && conversationId) {
    socket.emit('typing', { conversationId, isTyping });
  }
}

/**
 * Menutup koneksi socket
 */
export function disconnectChatSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

