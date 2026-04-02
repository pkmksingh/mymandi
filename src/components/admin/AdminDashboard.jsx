import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Users, ShoppingBag, Trash2, Ban, UserCheck, RefreshCw, LifeBuoy } from 'lucide-react';
import { socket } from '../../socket';

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [listings, setListings] = useState([]);
  const [supportTickets, setSupportTickets] = useState([]);
  const [stats, setStats] = useState({ pendingSupport: 0 });
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const navigate = useNavigate();

  const token = sessionStorage.getItem('adminToken');

  useEffect(() => {
    if (!token) {
      navigate('/admin');
      return;
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, token, navigate]);

  useEffect(() => {
    if (!token) return;
    const handler = () => {
      if (activeTab === 'support') {
         fetchData();
      } else {
         fetch(`/api/admin/stats`, {
           headers: { 'x-admin-key': token }
         }).then(r => r.json()).then(data => setStats(data)).catch(()=>{});
      }
    };
    const unsub = socket.on('support-ticket-updated', handler);
    return () => unsub();
  }, [activeTab, token]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const statsRes = await fetch(`/api/admin/stats`, {
        headers: { 'x-admin-key': token }
      });
      if (statsRes.status === 403) {
        sessionStorage.removeItem('adminToken');
        navigate('/admin');
        return;
      }
      if (statsRes.ok) {
        setStats(await statsRes.json());
      }

      let endpoint = '';
      if (activeTab === 'users') endpoint = '/api/admin/users';
      else if (activeTab === 'listings') endpoint = '/api/admin/listings';
      else if (activeTab === 'support') endpoint = '/api/admin/support';
      
      const res = await fetch(`${endpoint}`, {
        headers: { 'x-admin-key': token }
      });
      if (res.status === 403) {
        sessionStorage.removeItem('adminToken');
        navigate('/admin');
        return;
      }
      const data = await res.json();
      if (activeTab === 'users') setUsers(data);
      else if (activeTab === 'listings') setListings(data);
      else if (activeTab === 'support') setSupportTickets(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleBlockUser = async (id, currentStatus) => {
    if (!window.confirm(`Are you sure you want to ${currentStatus ? 'unblock' : 'block'} this user?`)) return;
    try {
      const res = await fetch(`/api/admin/users/${id}/block`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': token },
        body: JSON.stringify({ isBlocked: !currentStatus })
      });
      if (res.ok) {
        setUsers(users.map(u => u.id === id ? { ...u, isBlocked: currentStatus ? 0 : 1 } : u));
      }
    } catch (err) { console.error(err); }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm('CRITICAL WARING: Deleting a user will permanently wipe their profile and all active listings. Proceed?')) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-key': token }
      });
      if (res.ok) setUsers(users.filter(u => u.id !== id));
    } catch (err) { console.error(err); }
  };

  const handleDeleteListing = async (id) => {
    if (!window.confirm('Delete this listing permanently?')) return;
    try {
      const res = await fetch(`/api/admin/listings/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-key': token }
      });
      if (res.ok) setListings(listings.filter(l => l.id !== id));
    } catch (err) { console.error(err); }
  };

  const handleResolveTicket = async (id) => {
    try {
      const res = await fetch(`/api/admin/support/${id}/resolve`, {
        method: 'PATCH',
        headers: { 'x-admin-key': token }
      });
      if (res.ok) {
        setSupportTickets(supportTickets.map(t => t.id === id ? { ...t, isResolved: 1 } : t));
        setStats(prev => ({ ...prev, pendingSupport: Math.max(0, prev.pendingSupport - 1) }));
      }
    } catch (err) { console.error(err); }
  };

  const handleReplyTicket = async (id, reply) => {
    if (!reply || !reply.trim()) return;
    try {
      const res = await fetch(`/api/admin/support/${id}/reply`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': token },
        body: JSON.stringify({ reply })
      });
      if (res.ok) {
        setSupportTickets(supportTickets.map(t => t.id === id ? { ...t, adminReply: reply } : t));
        setReplyingTo(null);
        setReplyText('');
      } else {
        const errorData = await res.json();
        alert(`Failed to send reply: ${errorData.error || 'Server error'}`);
      }
    } catch (err) { 
      console.error(err);
      alert('Network error: Could not connect to support server.');
    }
  };

  if (!token) return null;

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#0a0a0a', color: '#fff', fontFamily: 'Inter, sans-serif' }}>
      
      {/* Sidebar */}
      <div style={{ width: '250px', background: '#111', borderRight: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #333', color: 'var(--primary-color)' }}>
          <h2>Meri Mandi Admin</h2>
        </div>
        
        <nav style={{ flex: 1, padding: '20px 0' }}>
          <button 
            style={{ 
              width: '100%', padding: '15px 20px', display: 'flex', alignItems: 'center', gap: '10px', 
              background: activeTab === 'users' ? '#222' : 'transparent', color: activeTab === 'users' ? '#fff' : '#888',
              border: 'none', textAlign: 'left', cursor: 'pointer', transition: '0.2s'
            }}
            onClick={() => setActiveTab('users')}
          >
            <Users size={18} /> User Profiles
          </button>
          <button 
            style={{ 
              width: '100%', padding: '15px 20px', display: 'flex', alignItems: 'center', gap: '10px', 
              background: activeTab === 'listings' ? '#222' : 'transparent', color: activeTab === 'listings' ? '#fff' : '#888',
              border: 'none', textAlign: 'left', cursor: 'pointer', transition: '0.2s'
            }}
            onClick={() => setActiveTab('listings')}
          >
            <ShoppingBag size={18} /> Crop Listings
          </button>
          <button 
            style={{ 
              width: '100%', padding: '15px 20px', display: 'flex', alignItems: 'center', gap: '10px', 
              background: activeTab === 'support' ? '#222' : 'transparent', color: activeTab === 'support' ? '#fff' : '#888',
              border: 'none', textAlign: 'left', cursor: 'pointer', transition: '0.2s'
            }}
            onClick={() => setActiveTab('support')}
          >
            <LifeBuoy size={18} /> Support Inbox
            {stats.pendingSupport > 0 && (
              <span style={{ marginLeft: 'auto', background: '#ff4d4d', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>
                {stats.pendingSupport}
              </span>
            )}
          </button>
        </nav>

        <div style={{ padding: '20px', borderTop: '1px solid #333' }}>
          <button 
            className="btn-secondary" 
            style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '8px' }}
            onClick={() => { sessionStorage.removeItem('adminToken'); navigate('/admin'); }}
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <h1 style={{ fontSize: '28px' }}>
            {activeTab === 'users' ? 'User Management' : activeTab === 'listings' ? 'Listings Moderation' : 'Support Inbox'}
          </h1>
          <button onClick={fetchData} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh Data
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px', color: '#666' }}>Loading data...</div>
        ) : (
          <div style={{ background: '#111', borderRadius: '12px', overflow: 'hidden', border: '1px solid #333' }}>
            
            {activeTab === 'users' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#1a1a1a', borderBottom: '1px solid #333' }}>
                    <th style={{ padding: '15px', color: '#888', fontWeight: '500' }}>User</th>
                    <th style={{ padding: '15px', color: '#888', fontWeight: '500' }}>Role</th>
                    <th style={{ padding: '15px', color: '#888', fontWeight: '500' }}>Contact</th>
                    <th style={{ padding: '15px', color: '#888', fontWeight: '500' }}>Status</th>
                    <th style={{ padding: '15px', color: '#888', fontWeight: '500', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center' }}>No users found.</td></tr> : users.map(user => (
                    <tr key={user.id} style={{ borderBottom: '1px solid #222' }}>
                      <td style={{ padding: '15px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <img src={`${user.selfiePath}`} alt="Selfie" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #444' }} />
                        <span style={{ fontWeight: '500' }}>{user.name}</span>
                      </td>
                      <td style={{ padding: '15px', textTransform: 'capitalize' }}>{user.role}</td>
                      <td style={{ padding: '15px', color: '#aaa' }}>{user.contact || 'N/A'}</td>
                      <td style={{ padding: '15px' }}>
                        {user.isBlocked ? 
                          <span style={{ display: 'inline-block', padding: '4px 8px', borderRadius: '4px', background: '#3a1313', color: '#ff4d4d', fontSize: '12px' }}>Blocked</span> : 
                          <span style={{ display: 'inline-block', padding: '4px 8px', borderRadius: '4px', background: '#133a18', color: '#4dff6a', fontSize: '12px' }}>Active</span>
                        }
                      </td>
                      <td style={{ padding: '15px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                          <button 
                            onClick={() => handleBlockUser(user.id, user.isBlocked)}
                            style={{ background: 'transparent', border: '1px solid #444', color: '#fff', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {user.isBlocked ? <><UserCheck size={14} /> Unblock</> : <><Ban size={14} color="#ffaa00" /> Block</>}
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(user.id)}
                            style={{ background: 'transparent', border: '1px solid #444', color: '#ff4d4d', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === 'listings' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#1a1a1a', borderBottom: '1px solid #333' }}>
                    <th style={{ padding: '15px', color: '#888', fontWeight: '500' }}>Crop Details</th>
                    <th style={{ padding: '15px', color: '#888', fontWeight: '500' }}>Seller</th>
                    <th style={{ padding: '15px', color: '#888', fontWeight: '500' }}>Location</th>
                    <th style={{ padding: '15px', color: '#888', fontWeight: '500' }}>Price Info</th>
                    <th style={{ padding: '15px', color: '#888', fontWeight: '500', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {listings.length === 0 ? <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center' }}>No listings found.</td></tr> : listings.map(listing => (
                    <tr key={listing.id} style={{ borderBottom: '1px solid #222' }}>
                      <td style={{ padding: '15px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                        {listing.images && listing.images.length > 0 ? (
                          <img src={`${listing.images[0]}`} alt="Crop" style={{ width: '50px', height: '50px', borderRadius: '8px', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '50px', height: '50px', borderRadius: '8px', background: '#333' }} />
                        )}
                        <div>
                          <div style={{ fontWeight: '500', fontSize: '15px', textTransform: 'capitalize' }}>{listing.cropName}</div>
                          <div style={{ color: '#888', fontSize: '13px' }}>Qty: {listing.quantity} • {listing.status === 'sold' ? <span style={{ color: '#ffaa00' }}>Sold</span> : <span style={{ color: '#4dff6a' }}>Live</span>}</div>
                        </div>
                      </td>
                      <td style={{ padding: '15px' }}>
                        <div style={{ textTransform: 'capitalize', fontWeight: '500' }}>{listing.sellerNameDisplay || listing.sellerName}</div>
                        <div style={{ fontSize: '13px', color: '#aaa', marginTop: '4px' }}>Phone: {listing.sellerContact || 'N/A'}</div>
                      </td>
                      <td style={{ padding: '15px', color: '#aaa', fontSize: '14px' }}>
                        {(() => {
                          try { const loc = JSON.parse(listing.location); return `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`; } catch { return listing.location; }
                        })()}
                      </td>
                      <td style={{ padding: '15px', fontWeight: '600', color: 'var(--primary-color)' }}>{listing.price ? `₹${listing.price}` : 'Offer'}</td>
                      <td style={{ padding: '15px', textAlign: 'right' }}>
                        <button 
                          onClick={() => handleDeleteListing(listing.id)}
                          style={{ background: 'transparent', border: '1px solid #444', color: '#ff4d4d', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
                          <Trash2 size={14} /> Remove Listing
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === 'support' && (
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {supportTickets.length === 0 ? <div style={{ textAlign: 'center', color: '#888', padding: '40px' }}>No support tickets found.</div> : supportTickets.map(ticket => (
                  <div key={ticket.id} style={{
                    background: ticket.isResolved ? '#0f1612' : '#1a1a1a', border: ticket.isResolved ? '1px solid #10b981' : '1px solid #333', 
                    borderRadius: '12px', padding: '20px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', opacity: ticket.isResolved ? 0.6 : 1
                  }}>
                    <div style={{ display: 'flex', gap: '16px' }}>
                      {ticket.selfiePath ? (
                        <img src={`${ticket.selfiePath}`} style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} alt="User" />
                      ) : (
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Users size={24} color="#666" />
                        </div>
                      )}
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {ticket.name || 'Guest Farmer'} <span style={{ fontSize: '11px', padding: '2px 6px', background: '#333', borderRadius: '4px', textTransform: 'capitalize' }}>{ticket.role || 'Unregistered'}</span>
                        </div>
                        <div style={{ color: '#888', fontSize: '13px', marginTop: '4px', marginBottom: '12px' }}>
                          Contact: {ticket.contact || 'N/A'} • {new Date(ticket.timestamp).toLocaleString()}
                        </div>
                        <div style={{ background: '#0a0a0a', padding: '12px', borderRadius: '8px', border: '1px solid #222', fontSize: '15px', lineHeight: '1.5', maxWidth: '600px' }}>
                          {ticket.message}
                          {ticket.adminReply && (
                            <div style={{ marginTop: '12px', padding: '10px', background: '#053f2c', borderLeft: '4px solid #10b981', color: '#fff', fontSize: '14px', borderRadius: '4px' }}>
                              <strong>Admin Reply: </strong> {ticket.adminReply}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                      {!ticket.isResolved && !ticket.adminReply && replyingTo !== ticket.id && (
                        <button onClick={() => { setReplyingTo(ticket.id); setReplyText(''); }} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '13px' }}>Reply to User</button>
                      )}
                      {!ticket.isResolved ? (
                         <button onClick={() => handleResolveTicket(ticket.id)} className="btn-primary" style={{ padding: '8px 16px', fontSize: '13px' }}>Mark Resolved</button>
                      ) : (
                         <div style={{ padding: '8px 16px', color: '#10b981', fontWeight: '500', fontSize: '14px' }}>Resolved ✓</div>
                      )}
                    </div>
                    
                    {replyingTo === ticket.id && (
                      <div style={{ flexBasis: '100%', marginTop: '16px', background: '#111', padding: '16px', borderRadius: '8px', border: '1px solid #333' }}>
                        <textarea 
                          autoFocus
                          value={replyText} 
                          onChange={e => setReplyText(e.target.value)} 
                          placeholder="Type your reply here..." 
                          style={{ width: '100%', height: '80px', background: '#222', border: '1px solid #444', color: '#fff', padding: '10px', borderRadius: '6px', marginBottom: '10px', resize: 'none' }}
                        />
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                          <button onClick={() => { setReplyingTo(null); setReplyText(''); }} className="btn-secondary" style={{ padding: '8px 16px' }}>Cancel</button>
                          <button onClick={() => handleReplyTicket(ticket.id, replyText)} className="btn-primary" style={{ padding: '8px 16px' }}>Send Reply</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
