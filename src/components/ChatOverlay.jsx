import { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { socket } from '../socket';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, User } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export function ChatOverlay() {
  const { activeChatUser, closeChat, currentUser, markChatAsRead } = useStore();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!activeChatUser || !currentUser) return;
    
    // Fetch History & Mark Read
    fetch(`/api/messages/history/${currentUser.id}/${activeChatUser.id}`)
      .then(res => res.json())
      .then(data => {
        setMessages(data);
        markChatAsRead(activeChatUser.id);
      })
      .catch(console.error);

    const handleReceiveMessage = (msg) => {
      if (msg.senderId === activeChatUser.id || msg.receiverId === activeChatUser.id) {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        // Auto-read if chat is open
        if (msg.senderId === activeChatUser.id) {
          markChatAsRead(activeChatUser.id);
        }
      }
    };

    const unsub = socket.subscribeUser(currentUser.id, 'receive-message', handleReceiveMessage);

    return () => {
      unsub();
    };
  }, [activeChatUser, currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !activeChatUser) return;

    const newMsg = {
      id: uuidv4(),
      senderId: currentUser.id,
      receiverId: activeChatUser.id,
      message: inputText.trim(),
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, newMsg]);
    setInputText('');

    try {
      await fetch(`/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-socket-id': socket.id },
        body: JSON.stringify(newMsg)
      });
    } catch(err) { console.error("Failed to send message", err); }
  };

  if (!activeChatUser) return null;

  return (
    <AnimatePresence>
      <div 
        style={{
          position: 'fixed', bottom: 0, right: 0, left: 0, top: 0,
          background: 'rgba(0,0,0,0.85)', zIndex: 9999,
          display: 'flex', justifyContent: 'center',
          backdropFilter: 'none' // Removed blur for maximum performance/opacity
        }}
        onClick={closeChat}
      >
        <motion.div 
          initial={{ opacity: 0, y: 100 }} 
          animate={{ opacity: 1, y: 0 }} 
          exit={{ opacity: 0, y: 100 }}
          transition={{ duration: 0.2 }}
          style={{
            width: '100%', maxWidth: '480px', height: '100%',
            background: '#0a0f0d', position: 'relative', // Solid opaque color
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 0 50px rgba(0,0,0,1)'
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Chat Header */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '16px', background: '#0f1612' }}>
            <button onClick={closeChat} style={{ background: '#1d2a23', border: 'none', color: 'var(--text-main)', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', background: '#1d2a23', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {activeChatUser.selfiePath ? (
                <img src={activeChatUser.selfiePath} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <User size={20} color="var(--text-muted)" />
              )}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px' }}>{activeChatUser.name}</h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--primary-color)' }}>Active Now</p>
            </div>
          </div>

          {/* Chat Transcript Log */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', background: '#0a0f0d' }}>
            {messages.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center' }}>
                Start your conversation! <br/>Messages are end-to-end direct.
              </div>
            ) : (
              messages.map(msg => {
                const isMe = msg.senderId === currentUser?.id;
                return (
                  <div key={msg.id} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                    <div style={{
                      background: isMe ? '#10b981' : '#1d2a23', // Solid colors, no gradients
                      padding: '12px 16px', borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      color: 'white', fontSize: '15px', lineHeight: 1.4, wordBreak: 'break-word',
                      border: 'none',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                    }}>
                      {msg.message}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', textAlign: isMe ? 'right' : 'left' }}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Dock */}
          <form onSubmit={sendMessage} style={{ padding: '16px', background: '#0f1612', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '10px' }}>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type your message..."
              style={{ flex: 1, background: '#1d2a23', border: '1px solid var(--border-color)', color: 'white', padding: '12px 16px', borderRadius: '24px', fontSize: '15px', outline: 'none' }}
            />
            <button type="submit" disabled={!inputText.trim()} style={{
              background: '#10b981', color: 'white', border: 'none',
              width: '46px', height: '46px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: inputText.trim() ? 'pointer' : 'not-allowed', opacity: inputText.trim() ? 1 : 0.5,
              transition: '0.2s'
            }}>
              <Send size={18} style={{ marginLeft: '4px' }} />
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
