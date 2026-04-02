import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageSquare, User } from 'lucide-react';

export function InboxOverlay() {
  const { currentUser, showInbox, toggleInbox, startChat } = useStore();
  const [inbox, setInbox] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!showInbox || !currentUser) return;
    
    const fetchInbox = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/messages/inbox/${currentUser.id}`);
        const data = await res.json();
        setInbox(data || []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchInbox();
  }, [showInbox, currentUser]);

  if (!showInbox) return null;

  return (
    <AnimatePresence>
      <div 
        style={{
          position: 'fixed', bottom: 0, right: 0, left: 0, top: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 9998,
          display: 'flex', justifyContent: 'center'
        }}
        onClick={toggleInbox}
      >
        <motion.div 
          initial={{ opacity: 0, y: 50 }} 
          animate={{ opacity: 1, y: 0 }} 
          exit={{ opacity: 0, y: 50 }}
          style={{
            width: '100%', maxWidth: '480px', height: '80%', marginTop: 'auto',
            background: 'var(--bg-main)', borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
            position: 'relative', display: 'flex', flexDirection: 'column',
            boxShadow: '0 -10px 40px rgba(0,0,0,0.6)'
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <MessageSquare size={24} color="var(--primary-color)" />
              <h2 style={{ margin: 0, fontSize: '20px' }}>Your Messages</h2>
            </div>
            <button onClick={toggleInbox} style={{ background: 'var(--surface-light)', border: 'none', color: 'var(--text-main)', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            {loading ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading messages...</p>
            ) : inbox.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                <MessageSquare size={48} opacity={0.3} style={{ marginBottom: '16px' }} />
                <p>No messages yet.</p>
                <p style={{ fontSize: '14px' }}>Conversations with buyers or sellers will appear here.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {inbox.map(chat => (
                  <button 
                    key={chat.id} 
                    onClick={() => startChat(chat.contactId, chat.contactName, chat.contactSelfie)}
                    className="glass-panel"
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', 
                      border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer',
                      background: 'var(--surface-color)', transition: '0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-light)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-color)'}
                  >
                    <div style={{ width: '50px', height: '50px', borderRadius: '50%', overflow: 'hidden', background: 'var(--surface-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {chat.contactSelfie ? (
                        <img src={chat.contactSelfie} alt={chat.contactName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <User size={24} color="var(--text-muted)" />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{chat.contactName}</h4>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0 }}>
                          {new Date(chat.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: chat.senderId !== currentUser.id ? 500 : 400 }}>
                        {chat.senderId === currentUser.id ? 'You: ' : ''}{chat.message}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
