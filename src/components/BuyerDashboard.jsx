import { useStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Grid, List as ListIcon, MessageSquare, Map as MapIcon, Cloud, TrendingUp, Languages } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { getOptimizedImage } from '../utils/image';
import { SkeletonGrid } from './ListingSkeleton';
import { MapDiscovery } from './MapDiscovery';
import { translations } from '../utils/translations';

export function BuyerDashboard() {
  const { listings, fetchListings, isLoading, toggleInbox, unreadCount, currentUser, language, setLanguage } = useStore();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('list');
  const [displaySearch, setDisplaySearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showMap, setShowMap] = useState(false);
  const [mandiPrices, setMandiPrices] = useState([]);
  const [pricesLoading, setPricesLoading] = useState(true);
  const [weatherData, setWeatherData] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  const t = translations[language] || translations.en;

  useEffect(() => {
    fetchListings();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(displaySearch), 300);
    return () => clearTimeout(timer);
  }, [displaySearch]);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const res = await fetch(`/api/mandi/prices?state=${currentUser?.state || ''}&district=${currentUser?.district || ''}`);
        if (res.ok) {
          const data = await res.json();
          setMandiPrices(data);
        }
      } catch (err) {
        console.error("Mandi Price Fetch Error:", err);
      } finally {
        setPricesLoading(false);
      }
    };
    fetchPrices();
  }, [currentUser]);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await fetch(`/api/weather?city=${currentUser?.nearestCity || 'Amritsar'}`);
        if (res.ok) {
          const data = await res.json();
          setWeatherData(data);
        }
      } catch (err) {
        console.error("Weather Fetch Error:", err);
      } finally {
        setWeatherLoading(false);
      }
    };
    fetchWeather();
  }, [currentUser]);

  const getWeatherIcon = (condition) => {
    const cond = condition?.toLowerCase() || '';
    if (cond.includes('rain') || cond.includes('thunder')) return <CloudRain color="#38bdf8" size={24} />;
    if (cond.includes('cloud')) return <Cloud color="var(--text-muted)" size={24} />;
    return <Sun color="#f59e0b" size={24} />;
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const filteredListings = listings
    .filter(l => 
      l.status !== 'sold' && 
      l.sellerId !== currentUser?.id && (
        l.cropName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.sellerName.toLowerCase().includes(searchTerm.toLowerCase())
      )
    )
    .map(l => {
      if (currentUser?.location?.lat && l.location?.lat) {
        return {
          ...l,
          distance: calculateDistance(
            currentUser?.location?.lat, 
            currentUser?.location?.lng, 
            l.location?.lat, 
            l.location?.lng
          )
        };
      }
      return { ...l, distance: Infinity };
    })
    .sort((a, b) => a.distance - b.distance);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '28px', marginBottom: '8px' }}>{t.exploreCrops}</h2>
          <p style={{ color: 'var(--text-muted)' }}>{t.freshProduce}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select 
            value={language} 
            onChange={(e) => setLanguage(e.target.value)}
            style={{ background: 'var(--surface-light)', border: 'none', color: '#f8fafc', borderRadius: '12px', padding: '0 12px', fontSize: '13px' }}
          >
            <option value="en">English</option>
            <option value="hi">हिन्दी</option>
            <option value="pa">ਪੰਜਾਬੀ</option>
          </select>
          <button 
            onClick={toggleInbox} 
            style={{ position: 'relative', background: 'var(--surface-light)', border: 'none', color: 'var(--primary-color)', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: '0.2s' }}
          >
            <MessageSquare size={24} />
            {unreadCount > 0 && (
              <div style={{ position: 'absolute', top: '8px', right: '8px', background: 'var(--danger-color)', color: 'white', fontSize: '10px', fontWeight: 'bold', width: '16px', height: '16px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--surface-light)' }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Mandi Widget */}
      <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '16px', marginBottom: '8px', scrollbarWidth: 'none', msOverflowStyle: 'none' }} className="no-scrollbar">
        <div className="glass-panel" style={{ padding: '12px 16px', minWidth: '160px', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          {weatherLoading ? (
            <div style={{ width: '24px', height: '24px', background: 'var(--surface-light)', borderRadius: '50%' }} className="skeleton-pulse"></div>
          ) : (
            <div style={{ position: 'relative' }}>
              {getWeatherIcon(weatherData?.condition)}
              <div style={{ 
                position: 'absolute', top: -2, right: -2, width: '6px', height: '6px', 
                borderRadius: '50%', background: '#38bdf8', 
                boxShadow: '0 0 8px #38bdf8' 
              }} className="pulse-dot"></div>
            </div>
          )}
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.weather}</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
              {weatherLoading ? '...' : `${weatherData?.temp || 32}°C ${weatherData?.condition || 'Sunny'}`}
            </div>
          </div>
        </div>

        {pricesLoading ? (
          <div className="glass-panel" style={{ padding: '12px 16px', minWidth: '160px', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0, opacity: 0.7 }}>
            <TrendingUp color="var(--text-muted)" size={24} />
            <div style={{ width: '80px', height: '14px', background: 'var(--surface-light)', borderRadius: '4px' }} className="skeleton-pulse"></div>
          </div>
        ) : (
          mandiPrices.map((price, idx) => (
            <motion.div 
              key={idx}
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: idx * 0.1 }}
              className="glass-panel" 
              style={{ padding: '12px 16px', minWidth: '180px', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}
            >
              <div style={{ position: 'relative' }}>
                <TrendingUp color={price.trend === 'up' ? "#10b981" : (price.trend === 'down' ? "#ef4444" : "#f59e0b")} size={24} />
                <div style={{ 
                  position: 'absolute', top: -2, right: -2, width: '6px', height: '6px', 
                  borderRadius: '50%', background: '#10b981', 
                  boxShadow: '0 0 8px #10b981' 
                }} className="pulse-dot"></div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {t.mandiPrice} ({price.name})
                </div>
                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                  ₹{price.price?.toLocaleString('en-IN')}/{price.unit}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={20} color="var(--text-muted)" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            type="text" 
            className="input-base" 
            placeholder={t.searchPlaceholder}
            value={displaySearch}
            onChange={(e) => setDisplaySearch(e.target.value)}
            style={{ paddingLeft: '48px', borderRadius: '14px', background: 'var(--surface-light)' }}
          />
        </div>
        <div style={{ display: 'flex', background: 'var(--surface-light)', borderRadius: '14px', padding: '4px' }}>
          <button 
            className="btn-icon-circular" 
            onClick={() => setShowMap(!showMap)}
            style={{ width: '40px', height: '40px', background: showMap ? 'var(--primary-glow)' : 'transparent', borderRadius: '10px' }}
          >
            <MapIcon size={18} color={showMap ? '#10b981' : '#f8fafc'} />
          </button>
          <button 
            className="btn-icon-circular" 
            onClick={() => { setViewMode('grid'); setShowMap(false); }}
            style={{ width: '40px', height: '40px', background: !showMap && viewMode === 'grid' ? 'var(--bg-color)' : 'transparent', borderRadius: '10px' }}
          >
            <Grid size={18} color={!showMap && viewMode === 'grid' ? '#10b981' : '#f8fafc'} />
          </button>
          <button 
            className="btn-icon-circular" 
            onClick={() => { setViewMode('list'); setShowMap(false); }}
            style={{ width: '40px', height: '40px', background: !showMap && viewMode === 'list' ? 'var(--bg-color)' : 'transparent', borderRadius: '10px' }}
          >
            <ListIcon size={18} color={!showMap && viewMode === 'list' ? '#10b981' : '#f8fafc'} />
          </button>
        </div>
      </div>

      {showMap ? (
        <MapDiscovery listings={filteredListings} center={currentUser?.location} />
      ) : isLoading && listings.length === 0 ? (
        <SkeletonGrid />
      ) : (
        <AnimatePresence>
          {filteredListings.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ color: 'var(--text-muted)' }}>No crops found matching your search.</p>
            </motion.div>
          ) : (
            <motion.div 
              layout 
              style={{ 
                display: 'grid', 
                gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(140px, 1fr))' : '1fr', 
                gap: '12px' 
              }}
            >
              {filteredListings.map(listing => (
                <motion.div 
                  layout
                  key={listing.id} 
                  className="glass-panel"
                  onClick={() => navigate(`/buyer/listing/${listing.id}`)}
                  whileHover={{ y: -4, scale: 1.02 }}
                  style={{ 
                    overflow: 'hidden', cursor: 'pointer', 
                    display: 'flex',
                    flexDirection: viewMode === 'list' ? 'row' : 'column',
                    alignItems: viewMode === 'list' ? 'center' : 'stretch'
                  }}
                >
                  <div style={{ 
                    width: viewMode === 'list' ? '100px' : '100%', 
                    height: viewMode === 'list' ? '100px' : '120px',
                    flexShrink: 0
                  }}>
                    <img 
                      src={getOptimizedImage(listing.images[0], viewMode === 'list' ? 200 : 400)} 
                      alt={listing.cropName}
                      loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                  <div style={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {new Date(listing.timestamp).toLocaleDateString()}
                      </div>
                      {listing.distance !== Infinity && (
                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--primary-color)' }}>
                          {listing.distance < 1 ? '<1 km' : `${Math.round(listing.distance)} km`} away
                        </div>
                      )}
                    </div>
                    <h3 style={{ fontSize: '15px', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {listing.cropName} {listing.quantity && <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'normal' }}>({listing.quantity})</span>}
                    </h3>
                    <p className="text-gradient" style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                      {listing.price || 'Contact for price'}
                    </p>
                    
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '11px' }}>
                        <MapPin size={11} />
                        <span style={{ maxWidth: viewMode === 'grid' ? '100px' : '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {listing.nearestCity ? `${listing.nearestCity}, ${listing.district}, ${listing.state}` : listing.location.address}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </motion.div>
  );
}
