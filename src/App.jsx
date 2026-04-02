import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useStore } from './store';
import { Auth } from './components/Auth';
import { ProtectedRoute } from './components/ProtectedRoute';
import { KeyRound, Heart, X } from 'lucide-react';
import { useEffect, useState, lazy, Suspense } from 'react';
import { socket } from './socket';
import { useLocation } from 'react-router-dom';

// Lazy load heavy dashboard and overlay components
const BuyerDashboard = lazy(() => import('./components/BuyerDashboard').then(m => ({ default: m.BuyerDashboard })));
const SellerDashboard = lazy(() => import('./components/SellerDashboard').then(m => ({ default: m.SellerDashboard })));
const AddListing = lazy(() => import('./components/AddListing').then(m => ({ default: m.AddListing })));
const ListingDetails = lazy(() => import('./components/ListingDetails').then(m => ({ default: m.ListingDetails })));
const CallOverlay = lazy(() => import('./components/CallOverlay').then(m => ({ default: m.CallOverlay })));
const HelpOverlay = lazy(() => import('./components/HelpOverlay').then(m => ({ default: m.HelpOverlay })));
const ChatOverlay = lazy(() => import('./components/ChatOverlay').then(m => ({ default: m.ChatOverlay })));
const InboxOverlay = lazy(() => import('./components/InboxOverlay').then(m => ({ default: m.InboxOverlay })));
const AdminLogin = lazy(() => import('./components/admin/AdminLogin').then(m => ({ default: m.AdminLogin })));
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));

const LoadingFallback = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100px', color: 'var(--text-muted)' }}>
    <div className="loading-dots">Loading...</div>
  </div>
);

export default function App() {
  const { currentUser, initDevice, logout } = useStore();
  const [showQR, setShowQR] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission();
    }

    const { deviceId } = initDevice();
    
    // Global Channel Listeners
    const unsubUpdate = socket.on('listing-updated', (data) => {
      if (data.forceRefresh) {
        useStore.getState().fetchListings();
      } else {
        useStore.getState().updateListingStatus(data.id, data.status);
      }
    });

    const unsubEdit = socket.on('listing-edited', (data) => {
      useStore.getState().editListingDetails(data.id, { cropName: data.cropName, quantity: data.quantity, price: data.price });
    });

    // User-specific Channel Listeners
    let unsubMessage = () => {};
    if (currentUser) {
      unsubMessage = socket.subscribeUser(currentUser.id, 'receive-message', (data) => {
        const state = useStore.getState();
        if (!state.activeChatUser || state.activeChatUser.id !== data.senderId) {
          state.fetchUnreadCount();
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("New Message - Meri Mandi", { 
              body: data.message,
              icon: '/upiqr.jpeg'
            });
          }
        }
      });
    }

    return () => {
      unsubUpdate();
      unsubEdit();
      unsubMessage();
    }
  }, [initDevice, currentUser]);

  useEffect(() => {
    if (currentUser) {
      useStore.getState().fetchUnreadCount();
    }
  }, [currentUser]);

  const handleSwitchProfile = () => {
    logout();
    navigate('/');
  };

  return (
    <div className={isAdminRoute ? "admin-container" : "app-container"}>
      <Suspense fallback={<LoadingFallback />}>
        {isAdminRoute ? (
          <Routes>
            <Route path="/admin" element={<AdminLogin />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
          </Routes>
        ) : (
          <>
            <header style={{ 
              padding: '15px 20px', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              borderBottom: '1px solid var(--border-color)',
              backdropFilter: 'blur(10px)',
              position: 'sticky',
              top: 0,
              zIndex: 10
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 className="text-gradient" onClick={() => navigate('/')} style={{ cursor: 'pointer', margin: 0, fontSize: '20px' }}>🌾 Meri Mandi</h2>
                <button 
                  onClick={() => setShowQR(true)}
                  style={{ background: 'linear-gradient(135deg, #ec4899, #be185d)', color: 'white', border: 'none', borderRadius: '12px', padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: 600, marginLeft: '8px' }}
                >
                  <Heart size={12} fill="white" /> Support
                </button>
                <button 
                  onClick={() => useStore.getState().toggleHelp()}
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', borderRadius: '12px', padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: 600, marginLeft: '8px' }}
                >
                   Help
                </button>
              </div>
              {currentUser && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'capitalize', display: 'none', '@media (min-width: 480px)': { display: 'inline' } }}>
                    {currentUser.name}
                  </span>
                  <button 
                    onClick={handleSwitchProfile}
                    className="btn-secondary" 
                    style={{ fontSize: '11px', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <KeyRound size={13} /> Switch Profile
                  </button>
                </div>
              )}
            </header>

            <main style={{ flex: 1, padding: '15px', overflowY: 'auto' }}>
              <Routes>
                <Route path="/" element={
                  !currentUser ? <Auth /> : (
                    currentUser.role === 'buyer' ? <Navigate to="/buyer" /> : <Navigate to="/seller" />
                  )
                } />
                
                <Route path="/buyer" element={
                  <ProtectedRoute requiredRole="buyer">
                    <BuyerDashboard />
                  </ProtectedRoute>
                } />
                <Route path="/buyer/listing/:id" element={
                  <ProtectedRoute requiredRole="buyer">
                    <ListingDetails />
                  </ProtectedRoute>
                } />
                
                <Route path="/seller" element={
                  <ProtectedRoute requiredRole="seller">
                    <SellerDashboard />
                  </ProtectedRoute>
                } />
                <Route path="/seller/add" element={
                  <ProtectedRoute requiredRole="seller">
                    <AddListing />
                  </ProtectedRoute>
                } />
              </Routes>
            </main>

            <CallOverlay />
            <HelpOverlay />
            
            {showQR && (
              <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
                background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
              }}>
                <div className="glass-panel" style={{ position: 'relative', width: '100%', maxWidth: '350px', padding: '30px', textAlign: 'center' }}>
                  <button 
                    onClick={() => setShowQR(false)} 
                    style={{ position: 'absolute', top: '15px', right: '15px', background: 'var(--danger-glass)', border: 'none', color: 'var(--danger-color)', width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  >
                    <X size={16} />
                  </button>
                  <Heart size={40} color="#ec4899" fill="#ec4899" style={{ marginBottom: '16px' }} />
                  <h3 style={{ fontSize: '20px', marginBottom: '8px' }}>Support Meri Mandi</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>Scan to keep Meri Mandi free for farmers!</p>
                  <div style={{ background: 'white', padding: '10px', borderRadius: '16px', display: 'inline-block' }}>
                    <img src="/upiqr.jpeg" alt="UPI QR Code" style={{ width: '200px', height: '200px', objectFit: 'contain', display: 'block' }} />
                  </div>
                </div>
              </div>
            )}
            <InboxOverlay />
            <ChatOverlay />
          </>
        )}
      </Suspense>
    </div>
  );
}
