import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getChatLogQuery } from '../db/repositories/chatLog';
import { parseChatCommand } from '../utils/chatbot';

const Chat = ({ user }) => {
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef(null);

  // Ambil history chat dari db
  const messages = useLiveQuery(
    () => getChatLogQuery(),
    []
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const handleInsert = (e) => setInputValue(e.detail);
    window.addEventListener('insertChatTemplate', handleInsert);
    return () => window.removeEventListener('insertChatTemplate', handleInsert);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isProcessing) return;

    const messageText = inputValue;
    setInputValue('');
    setIsProcessing(true);

    try {
      await parseChatCommand(messageText, user);
    } catch (error) {
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      // Cap height at roughly 4 lines (e.g., 120px)
      textareaRef.current.style.height = Math.min(scrollHeight, 120) + 'px';
      textareaRef.current.style.overflowY = scrollHeight > 120 ? 'auto' : 'hidden';
    }
  }, [inputValue]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="bg-white" style={{ position: 'fixed', top: '60px', left: 0, right: 0, bottom: 0, zIndex: 10 }}>
      <div className="card shadow-none border-0 rounded-0 d-flex flex-column mx-auto w-100 bg-transparent h-100 position-relative" style={{ maxWidth: '800px' }}>
        
        <div className="card-body p-0 d-flex flex-column h-100" style={{ overflow: 'hidden' }}>
          <div className="chat-content-wrap px-4 pt-4 flex-grow-1" style={{ overflowY: 'auto' }}>
            {messages && messages.length === 0 && (
              <div className="my-2">
                <h2 className="text-primary mb-2" style={{ letterSpacing: '-0.5px', fontWeight: '500', fontSize: '28px' }}>
                  Hello, {user.fullname ? user.fullname.split(' ')[0] : (user.username || 'Pengguna')}
                </h2>
                <h2 className="text-secondary mb-3" style={{ letterSpacing: '-0.5px', fontWeight: '400', fontSize: '28px' }}>
                  How can I help you today?
                </h2>
                <p className="text-muted">Ketik perintah Anda di bawah atau gunakan <strong>Template Perintah</strong> di pojok kanan atas layar.</p>
              </div>
            )}
            
            {messages && messages.map((msg) => (
              <div key={msg.id} className={`d-flex mb-4 ${!msg.isBot ? 'justify-content-end' : 'justify-content-start'}`}>
                {/* {msg.isBot && (
                  <div className="me-3 mt-1 bg-white shadow-sm border rounded-circle d-flex align-items-center justify-content-center" style={{ width: '36px', height: '36px', flexShrink: 0 }}>
                    <i className="bi bi-stars text-primary" style={{ fontSize: '18px' }}></i>
                  </div>
                )} */}
                
                <div 
                  className={`p-3 shadow-sm ${!msg.isBot ? 'text-white' : 'text-dark'}`} 
                  style={{ 
                    maxWidth: !msg.isBot ? '85%' : '95%',
                    width: 'fit-content',
                    backgroundColor: !msg.isBot ? '#155dfc' : '#ffffff', 
                    border: '1px solid #eef0f2',
                    borderRadius: !msg.isBot ? '16px 16px 4px 16px' : '16px 16px 16px 4px'
                  }}
                >
                  <p className="mb-0" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '13px', color: !msg.isBot ? 'white' : 'grey' }}>{msg.pesan}</p>
                </div>
              </div>
            ))}
            {isProcessing && (
              <div className="d-flex mb-4 justify-content-start">
                <div className="me-3 mt-1 bg-white shadow-sm border rounded-circle d-flex align-items-center justify-content-center" style={{ width: '36px', height: '36px', flexShrink: 0 }}>
                  <i className="bi bi-stars text-primary" style={{ fontSize: '18px' }}></i>
                </div>
                <div className="p-3 shadow-sm bg-white" style={{ maxWidth: '85%', border: '1px solid #eef0f2', borderRadius: '16px 16px 16px 4px' }}>
                  <div className="typing d-flex gap-1 py-1">
                    <span className="spinner-grow spinner-grow-sm text-primary" role="status" style={{ width: '0.4rem', height: '0.4rem' }}></span>
                    <span className="spinner-grow spinner-grow-sm text-primary" role="status" style={{ width: '0.4rem', height: '0.4rem', animationDelay: '0.2s' }}></span>
                    <span className="spinner-grow spinner-grow-sm text-primary" role="status" style={{ width: '0.4rem', height: '0.4rem', animationDelay: '0.4s' }}></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="card-footer bg-white border-0 p-3 pt-2 pb-4 mt-auto w-100 z-3">
          <form onSubmit={handleSubmit} className="d-flex position-relative mx-auto align-items-end" style={{ maxWidth: '750px' }}>
            <textarea 
              ref={textareaRef}
              className="form-control form-control-lg border-0 shadow-sm w-100" 
              placeholder="Ketik perintah di sini..." 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isProcessing}
              style={{ 
                fontSize: '13px', 
                borderRadius: '24px', 
                padding: '16px 60px 16px 24px', 
                backgroundColor: '#f0f4f9',
                resize: 'none',
                minHeight: '56px',
                lineHeight: '1.5'
              }}
              rows={1}
            />
            <button 
              type="submit" 
              className="btn btn-link position-absolute end-0 text-primary p-0 me-3"
              style={{ textDecoration: 'none', bottom: '10px' }}
              disabled={isProcessing || !inputValue.trim()}
            >
              <i className="bi bi-send-fill fs-4"></i>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Chat;
