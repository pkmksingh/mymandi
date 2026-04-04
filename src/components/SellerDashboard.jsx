import { useStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, MapPin, Search, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { getOptimizedImage } from '../utils/image';
import { SkeletonGrid } from './ListingSkeleton';

export function SellerDashboard() {
  const { listings, fetchListings, currentUser, isLoading, toggleInbox, unreadCount, missedCalls, resetMissedCalls, markAsSold } = useStore();
  const navigate = useNavigate();

  const handleMessageClick = () => {
    resetMissedCalls();
    toggleInbox();
  };

  useEffect(() => {
    fetchListings();
  }, []);

  const [editingListing, setEditingListing] = useState(null);
  const [editForm, setEditForm] = useState({ cropName: '', quantity: '', price: '' });

  const myListings = listings.filter(l => l.sellerId === currentUser?.id && l.status !== 'sold');

  const handleMarkSold = (e, id) => {
    e.stopPropagation();
    markAsSold(id);
  };

  const startEditing = (e, listing) => {
    e.stopPropagation();
    setEditingListing(listing);
    setEditForm({ cropName: listing.cropName, quantity: listing.quantity || '', price: listing.price || '' });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await fetch(`/api/listings/${editingListing.id}/edit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });
      setEditingListing(null);
    } catch (err) {
      console.error("Failed to edit", err);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '24px', marginBottom: '4px' }}>My Listings</h2>
          <p style={{ color: 'var(--text-muted)' }}>Manage your crops and produce.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
        <button 
          onClick={handleMessageClick} 
          style={{ position: 'relative', background: 'var(--surface-light)', border: 'none', color: 'var(--primary-color)', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: '0.2s' }}
          title="Messages Inbox"
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <MessageSquare size={24} />
          {unreadCount > 0 && (
            <div style={{ position: 'absolute', top: '-4px', right: '-4px', background: 'var(--danger-color)', color: 'white', fontSize: '10px', fontWeight: 'bold', width: '18px', height: '18px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--surface-light)', zIndex: 2 }}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </div>
          )}
        </button>
        {missedCalls > 0 && (
          <div 
            style={{ 
              position: 'absolute', top: '-4px', left: '-4px', 
              background: '#ef4444', color: 'white', fontSize: '10px', fontWeight: 'bold', 
              minWidth: '18px', height: '18px', padding: '0 4px', borderRadius: '10px', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              border: '2px solid var(--surface-light)', zIndex: 1,
              boxShadow: '0 0 10px rgba(239, 68, 68, 0.4)'
            }}
            title={`${missedCalls} Missed Calls`}
          >
            {missedCalls}
          </div>
        )}
      </div>
      <button 
        className="btn-primary" 
        onClick={() => navigate('/seller/add')}
        style={{ padding: '12px 20px', fontSize: '14px', borderRadius: '12px' }}
      >
        <PlusCircle size={18} /> Add New
      </button>
  </div>

  {isLoading && myListings.length === 0 ? (
    <SkeletonGrid />
  ) : myListings.length === 0 ? (
    <div className="glass-panel" style={{ textAlign: 'center', padding: '40px 20px', marginTop: '40px' }}>
      <div style={{
        width: '60px', height: '60px', borderRadius: '50%', background: 'var(--surface-light)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'
      }}>
        <Search size={28} color="var(--text-muted)" />
      </div>
      <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>No Listings Yet</h3>
      <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>List your first crop to connect with buyers.</p>
    </div>
  ) : (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
      {myListings.map(listing => {
        const isSold = listing.status === 'sold';
        return (
          <motion.div 
            key={listing.id} 
            className="glass-panel"
            whileHover={{ y: -4, scale: 1.02 }}
            style={{ overflow: 'hidden', cursor: 'pointer', display: 'flex', flexDirection: 'column', opacity: isSold ? 0.6 : 1 }}
          >
            <div style={{ width: '100%', height: '120px', position: 'relative', flexShrink: 0 }}>
              <img 
                src={getOptimizedImage(listing.images[0], 200, 200)} 
                alt={listing.cropName}
                style={{ width: '100%', height: '100%', objectFit: 'cover', filter: isSold ? 'grayscale(100%)' : 'none' }}
              />
                  {isSold && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700 }}>
                      SOLD
                    </div>
                  )}
                </div>
                <div style={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ fontSize: '15px', marginBottom: '4px', textDecoration: isSold ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {listing.cropName} {listing.quantity && <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'normal', textDecoration: 'none' }}>({listing.quantity})</span>}
                  </h3>
                  <p className="text-gradient" style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px' }}>
                    {listing.price || 'Contact for price'}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '11px', marginTop: 'auto', marginBottom: '8px' }}>
                    <MapPin size={11} style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {listing.nearestCity ? `${listing.nearestCity}, ${listing.district}, ${listing.state}` : 'Location based'}
                    </span>
                  </div>
                </div>
                {!isSold && (
                  <div style={{ padding: '0 12px 12px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button 
                      onClick={(e) => startEditing(e, listing)}
                      className="btn-secondary"
                      style={{ fontSize: '11px', padding: '6px 8px', flex: 1 }}
                    >
                      Edit
                    </button>
                    <button 
                      onClick={(e) => handleMarkSold(e, listing.id)}
                      className="btn-secondary"
                      style={{ fontSize: '11px', padding: '6px 8px', flex: 1, borderColor: 'var(--danger-color)', color: 'var(--danger-color)' }}
                    >
                      Mark Sold
                    </button>
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      )}

      {editingListing && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass-panel"
            style={{ width: '100%', maxWidth: '400px', padding: '24px' }}
          >
            <h3 style={{ fontSize: '20px', marginBottom: '20px' }}>Edit Listing</h3>
            <form onSubmit={handleEditSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Crop Name</label>
                <input 
                  type="text" 
                  className="input-base" 
                  value={editForm.cropName}
                  onChange={e => setEditForm(prev => ({ ...prev, cropName: e.target.value }))}
                  required
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Available Quantity</label>
                <input 
                  type="text" 
                  className="input-base" 
                  value={editForm.quantity}
                  onChange={e => setEditForm(prev => ({ ...prev, quantity: e.target.value }))}
                  required
                />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Expected Price (Optional)</label>
                <input 
                  type="text" 
                  className="input-base" 
                  value={editForm.price}
                  onChange={e => setEditForm(prev => ({ ...prev, price: e.target.value }))}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setEditingListing(null)}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>Save</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
