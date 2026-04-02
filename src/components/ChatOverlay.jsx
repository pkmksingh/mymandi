import { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { socket } from '../socket';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, User } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export function ChatOverlay() {
  const { activeChatUser, closeChat, currentUser } = useStore();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!activeChatUser || !currentUser) return;
    
    // Fetch History
    fetch(`/api/messages/history/${currentUser.id}/${activeChatUser.id}`)
      .then(res => res.json())
      .then(data => {
        setMessages(data);
        return fetch(`/api/messages/read/${activeChatUser.id}/${currentUser.id}`, { method: 'PATCH' });
      })
      .then(() => useStore.getState().fetchUnreadCount())
      .catch(console.error);

    const handleReceiveMessage = (msg) => {
      // Only append if it belongs to this conversation
      if (msg.senderId === activeChatUser.id || msg.receiverId === activeChatUser.id) {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
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

    // Optimistically update UI
    setMessages(prev => [...prev, newMsg]);
    setInputText('');

    // Message will be live replayed by backend pusher trigger after POST

    // Save strictly to database
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
          background: 'rgba(0,0,0,0.5)', zIndex: 9999,
          display: 'flex', justifyContent: 'center'
        }}
        onClick={closeChat} // Close if clicking backdrop
      >
        <motion.div 
          initial={{ opacity: 0, y: 100 }} 
          animate={{ opacity: 1, y: 0 }} 
          exit={{ opacity: 0, y: 100 }}
          transition={{ duration: 0.2 }}
          style={{
            width: '100%', maxWidth: '480px', height: '100%',
            background: 'var(--surface-color)', position: 'relative',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 0 50px rgba(0,0,0,0.8)'
          }}
          onClick={e => e.stopPropagation()} // Prevent closing when clicking inside
        >
          {/* Chat Header */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-color)' }}>
            <button onClick={closeChat} style={{ background: 'var(--surface-light)', border: 'none', color: 'var(--text-main)', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', background: 'var(--surface-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                      background: isMe ? 'linear-gradient(135deg, #10b981, #059669)' : 'var(--surface-light)',
                      padding: '12px 16px', borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      color: 'white', fontSize: '15px', lineHeight: 1.4, wordBreak: 'break-word',
                      border: isMe ? 'none' : '1px solid var(--border-color)'
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
          <form onSubmit={sendMessage} style={{ padding: '16px', background: 'var(--bg-color)', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '10px' }}>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type your message..."
              style={{ flex: 1, background: 'var(--surface-light)', border: '1px solid var(--border-color)', color: 'white', padding: '12px 16px', borderRadius: '24px', fontSize: '15px', outline: 'none' }}
            />
            <button type="submit" disabled={!inputText.trim()} style={{
              background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none',
              width: '46px', height: '46px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: inputText.trim() ? 'pointer' : 'not-allowed', opacity: inputText.trim() ? 1 : 0.5,
              transition: '0.2s', boxShadow: inputText.trim() ? '0 4px 15px rgba(16, 185, 129, 0.4)' : 'none'
            }}>
              <Send size={18} style={{ marginLeft: '4px' }} /> {/* Slight offset makes pencil/plane look centered */}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
