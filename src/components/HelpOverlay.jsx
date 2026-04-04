import { useState, useEffect } from 'react';
import { MessageSquare, X, Send } from 'lucide-react';
import { useStore } from '../store';
import { motion, AnimatePresence } from 'framer-motion';
import { socket } from '../socket';

export function HelpOverlay() {
  const { showHelp: isOpen, toggleHelp: setIsOpen, currentUser, deviceId } = useStore();
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = async () => {
    const id = currentUser ? currentUser.id.split('_')[0] : deviceId;
    if (!id) return;
    try {
      const res = await fetch(`/api/support/unread/${id}`);
      if (res.ok) setUnreadCount((await res.json()).count);
    } catch {}
  };

  const markAsRead = async () => {
    const id = currentUser ? currentUser.id.split('_')[0] : deviceId;
    if (!id) return;
    try {
      await fetch(`/api/support/read/${id}`, { method: 'PATCH' });
      setUnreadCount(0);
    } catch {}
  };

  useEffect(() => {
    if (isOpen) {
      if (currentUser || deviceId) {
        fetchHistory();
        markAsRead();
      }
    } else if (currentUser || deviceId) {
      fetchUnreadCount();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentUser, deviceId]);

  useEffect(() => {
    if (!currentUser && !deviceId) return;
    const handler = () => { 
      if (isOpen) {
        fetchHistory();
        markAsRead();
      } else {
        fetchUnreadCount();
      }
    };
    const unsub = socket.on('support-ticket-updated', handler);
    return () => unsub();
  }, [isOpen, currentUser, deviceId]);

  const fetchHistory = async () => {
    try {
      const id = currentUser ? currentUser.id.split('_')[0] : deviceId;
      if (!id) return;
      const res = await fetch(`/api/support/history/${id}`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const senderId = currentUser ? currentUser.id : deviceId;
    if (!message.trim() || !senderId) return;
    
    try {
      const res = await fetch(`/api/support`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderId, message })
      });
      if (res.ok) {
        setMessage('');
        fetchHistory();
      }
    } catch (err) {
      console.error(err);
    }
  };


  return (
    <>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            style={{
              position: 'fixed',
              bottom: '80px',
              right: '20px',
              width: 'calc(100vw - 40px)',
              maxWidth: '300px',
              background: 'var(--surface-color)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
              zIndex: 901,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            <div style={{ padding: '15px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-light)' }}>
              <h3 style={{ margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><MessageSquare size={16} color="var(--primary-color)" /> Support</h3>
              <button onClick={() => setIsOpen(false)} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            
            <div style={{ flex: 1, padding: '15px', height: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column-reverse', gap: '10px' }}>
              {history.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#666', fontSize: '13px', margin: 'auto' }}>No previous tickets.<br/>How can we help you today?</div>
              ) : (
                history.map(msg => (
                  <div key={msg.id} style={{
                    background: msg.isResolved ? '#112211' : '#222',
                    padding: '10px 12px',
                    borderRadius: '12px',
                    borderBottomRightRadius: '2px',
                    border: msg.isResolved ? '1px solid #10b981' : '1px solid #333'
                  }}>
                    <div style={{ fontSize: '14px', lineHeight: '1.4' }}>{msg.message}</div>
                    {msg.adminReply && (
                        <div style={{ fontSize: '13px', color: '#10b981', marginTop: '8px', padding: '8px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px' }}>
                          <strong>Admin:</strong> {msg.adminReply}
                        </div>
                    )}
                    <div style={{ fontSize: '10px', color: '#888', marginTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span style={{ color: msg.isResolved ? '#10b981' : '#ffaa00' }}>{msg.isResolved ? 'Resolved' : 'Pending'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '15px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: '8px', background: 'var(--surface-light)' }}>
              <input 
                type="text" 
                placeholder="Type your issue..." 
                value={message}
                onChange={e => setMessage(e.target.value)}
                style={{ flex: 1, padding: '10px 12px', borderRadius: '20px', border: '1px solid #333', background: '#111', color: 'white', outline: 'none' }}
                required
              />
              <button type="submit" style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary-color)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Send size={16} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
