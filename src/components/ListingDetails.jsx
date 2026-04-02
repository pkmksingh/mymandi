import { useStore } from '../store';
import { useParams, useNavigate } from 'react-router-dom';
import { Phone, MessageSquare, MapPin, ChevronLeft, Calendar, Share2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { translations } from '../utils/translations';

export function ListingDetails() {
  const { id } = useParams();
  const { listings, fetchListings, isLoading, startCall, currentUser, startChat, language } = useStore();
  const navigate = useNavigate();
  const t = translations[language] || translations.en;

  useEffect(() => {
    if (listings.length === 0) {
      fetchListings();
    }
  }, [listings.length, fetchListings]);

  const listing = listings.find(l => l.id === id);

  useEffect(() => {
    if (listing?.status === 'sold' && currentUser?.role === 'buyer') {
      navigate('/buyer'); // Kicks them out if someone bought it while they were looking
    }
  }, [listing, navigate, currentUser]);

  if (isLoading) return <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>;
  if (!listing) return <div style={{ padding: '20px', textAlign: 'center' }}>Listing not found.</div>;

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
      {/* Back Button */}
      <button 
        onClick={() => navigate(-1)} 
        style={{ 
          background: 'var(--surface-light)', border: 'none', color: 'var(--text-main)', 
          padding: '8px', borderRadius: '50%', marginBottom: '16px', display: 'flex', 
          alignItems: 'center', justifyContent: 'center', cursor: 'pointer' 
        }}
      >
        <ChevronLeft size={24} />
      </button>

      {/* Image Carousel (Simplified) */}
      <div style={{ display: 'flex', overflowX: 'auto', gap: '16px', scrollSnapType: 'x mandatory', marginBottom: '24px' }}>
        {listing.images.map((img, idx) => (
          <div key={idx} style={{ minWidth: '100%', scrollSnapAlign: 'center', borderRadius: '16px', overflow: 'hidden', aspectRatio: '4/3' }}>
            <img src={img} alt={`Crop ${idx}`} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        ))}
      </div>

      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', marginBottom: '8px' }}>
          {listing.cropName} {listing.quantity && <span style={{ fontSize: '18px', color: 'var(--text-muted)', fontWeight: 'normal' }}>({listing.quantity})</span>}
        </h1>
        <p className="text-gradient" style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px' }}>
          {listing.price || 'Contact for price'}
        </p>

        <div className="glass-panel" style={{ padding: '20px', display: 'grid', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--surface-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MapPin size={20} color="var(--primary-color)" />
            </div>
            <div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Location</p>
              <p style={{ fontWeight: 500 }}>
                {listing.nearestCity ? `${listing.nearestCity}, ${listing.district}, ${listing.state}` : listing.location.address}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--surface-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar size={20} color="var(--primary-color)" />
            </div>
            <div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Listed On</p>
              <p style={{ fontWeight: 500 }}>{new Date(listing.timestamp).toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Seller Info</h3>
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'var(--surface-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {listing.sellerSelfie ? (
                <img src={listing.sellerSelfie} alt={listing.sellerName} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '20px', fontWeight: 600 }}>{listing.sellerName.charAt(0)}</span>
              )}
            </div>
            <div>
              <h4 style={{ fontSize: '18px', marginBottom: '4px' }}>{listing.sellerName}</h4>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Meri Mandi Seller</p>
            </div>
          </div>
          <button 
            className="btn-secondary"
            onClick={() => {
              const text = `Check out this crop on Meri Mandi:\n*${listing.cropName}*\nQuantity: ${listing.quantity}\nPrice: ${listing.price}\nLocation: ${listing.nearestCity}\n\nDownload app to buy!`;
              window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
            }}
            style={{ padding: '10px 16px', background: '#25D366', color: 'white', border: 'none', gap: '8px', fontSize: '13px' }}
          >
            <Share2 size={16} /> {t.shareOnWhatsapp}
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div 
        className="fixed-bottom" 
        style={{ display: 'flex', gap: '16px' }}
      >
        <button 
          className="btn-secondary" 
          onClick={() => startChat(listing.sellerId, listing.sellerNameDisplay || listing.sellerName, listing.sellerSelfie)}
          style={{ flex: 1, padding: '16px' }}
        >
          <MessageSquare size={20} style={{ marginRight: '8px' }} />
          Message
        </button>
        <button 
          className="btn-primary" 
          onClick={() => startCall(listing.sellerId, listing.sellerName, listing.sellerSelfie)}
          style={{ flex: 1, padding: '16px' }}
        >
          <Phone size={20} style={{ marginRight: '8px' }} />
          Call Now
        </button>
      </div>
    </motion.div>
  );
}
