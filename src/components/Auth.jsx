import { useState } from 'react';
import { useStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { Leaf, Store, User, Camera, Loader2, X, MapPin, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CameraCapture } from './CameraCapture';
import { INDIA_DATA } from '../data/india-data';

const INDIAN_STATES = Object.keys(INDIA_DATA);

export function Auth() {
  const { login, deviceId, initDevice, deviceProfiles, deviceProfilesLoaded } = useStore();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [nearestCity, setNearestCity] = useState('');
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [role, setRole] = useState('buyer');

  const [showStateList, setShowStateList] = useState(false);
  const [filteredStates, setFilteredStates] = useState(INDIAN_STATES);

  const [showDistrictList, setShowDistrictList] = useState(false);
  const [filteredDistricts, setFilteredDistricts] = useState([]);

  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  
  const [selfieFile, setSelfieFile] = useState(null);
  const [selfiePreview, setSelfiePreview] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Safely init device id after mount to avoid "Update during Render" crash
  useEffect(() => {
    if (!deviceId) {
      initDevice();
    }
  }, [deviceId, initDevice]);

  const removeImage = () => {
    setSelfieFile(null);
    setSelfiePreview(null);
  };

  const getLocation = () => {
    setLocating(true);
    setError('');
    
    if (!('geolocation' in navigator)) {
      setError('Geolocation is not supported by your browser.');
      setLocating(false);
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          address: `Precise GPS: ${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`
        });
        setLocating(false);
      },
      (err) => {
        console.error("Auth Location Error:", err);
        let msg = 'Failed to get precise GPS location.';
        if (err.code === 1) msg = 'Location permission denied. Please allow location access in your browser settings.';
        else if (err.code === 3) msg = 'Location request timed out. Please try again in an open area.';
        
        setError(msg);
        setLocating(false);
      },
      options
    );
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    // Validate Indian phone number format
    const phoneRegex = /^(?:\+?91[-\s]?)?[0]?(?:91)?[6789]\d{9}$/;
    if (!phoneRegex.test(contact)) {
      setError('Please enter a valid 10-digit Indian phone number.');
      return;
    }

    if (!selfieFile) {
      setError('A live selfie snapshot is strictly required to ensure network trust.');
      return;
    }

    if (!location) {
      setError('Please capture your primary GPS location.');
      return;
    }

    if (!nearestCity || !district || !state || !pincode) {
      setError('Please fill in all location details.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const { deviceId: currentDeviceId, deviceToken } = deviceId ? { deviceId, deviceToken: useStore.getState().deviceToken } : initDevice();

      const formData = new FormData();
      formData.append('id', currentDeviceId);
      formData.append('deviceToken', deviceToken);
      formData.append('name', name);
      formData.append('contact', contact);
      formData.append('role', role);
      formData.append('nearestCity', nearestCity);
      formData.append('district', district);
      formData.append('state', state);
      formData.append('pincode', pincode);
      formData.append('location', JSON.stringify(location));
      formData.append('selfie', selfieFile);

      const res = await fetch('/api/users', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to register identity.');
      }
      
      console.log('REGISTRATION SUCCESS:', data);
      console.log('NAVIGATING TO:', (role === 'buyer' ? '/buyer' : '/seller'));
      
      // Zustand handles our local user binding
      login(data);
      
      navigate(role === 'buyer' ? '/buyer' : '/seller');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProfileSelect = (profile) => {
    login(profile);
    navigate(profile.role === 'buyer' ? '/buyer' : '/seller');
  };

  const hasProfiles = deviceProfilesLoaded && deviceProfiles.length > 0;
  const isCreatingNew = !hasProfiles || isCreating;

  const hasBuyer = deviceProfiles.some(p => p.role === 'buyer');
  const hasSeller = deviceProfiles.some(p => p.role === 'seller');

  if (!deviceProfilesLoaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Loader2 className="animate-spin" size={32} color="var(--primary-color)" />
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100%', paddingBottom: '40px' }}
    >
      {showCamera && (
        <CameraCapture 
          facingMode="user"
          onClose={() => setShowCamera(false)}
          onCapture={(file, dataUrl) => {
            setSelfieFile(file);
            setSelfiePreview(dataUrl);
            setShowCamera(false);
            setError('');
          }}
        />
      )}
      
      <div style={{ textAlign: 'center', marginBottom: '30px', marginTop: '30px' }}>
        <div style={{
          width: '70px', height: '70px', borderRadius: '24px',
          background: 'linear-gradient(135deg, #10b981, #059669)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
          boxShadow: '0 10px 30px rgba(16, 185, 129, 0.3)'
        }}>
          <Leaf size={32} color="white" />
        </div>
        <h1 style={{ fontSize: '28px', marginBottom: '8px' }}>Welcome to Meri Mandi</h1>
        <p style={{ color: 'var(--text-muted)' }}>The smart way to buy and sell crops directly.</p>
      </div>

      {error && (
        <div style={{ width: '100%', background: 'var(--danger-glass)', color: 'var(--danger-color)', padding: '16px', borderRadius: '14px', marginBottom: '20px', textAlign: 'center' }}>
          {error}
        </div>
      )}

      {isCreatingNew ? (
        <form onSubmit={handleLogin} className="glass-panel" style={{ width: '100%', padding: '24px' }}>
          
          {hasProfiles && (
             <div style={{ marginBottom: '24px' }}>
               <button 
                type="button" 
                onClick={() => setIsCreating(false)} 
                className="btn-secondary" 
                style={{ width: '100%', padding: '12px' }}
               >
                 Cancel Creation
               </button>
             </div>
          )}

          {/* Selfie Upload UI */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
            <p style={{ display: 'block', marginBottom: '12px', fontWeight: 500 }}>Take a Live Selfie Profile</p>
            
            {selfiePreview ? (
              <div style={{ position: 'relative', width: '120px', height: '120px', borderRadius: '50%', overflow: 'hidden', boxShadow: '0 0 20px rgba(0,0,0,0.5)' }}>
                <img src={selfiePreview} alt="Selfie" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button 
                  type="button" 
                  onClick={removeImage}
                  style={{
                    position: 'absolute', top: 8, right: 8, background: 'rgba(239, 68, 68, 0.9)', 
                    border: 'none', color: 'white', borderRadius: '50%', width: '24px', height: '24px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div 
                onClick={() => setShowCamera(true)}
                style={{
                  width: '120px', height: '120px', borderRadius: '50%', 
                  border: '2px dashed var(--primary-color)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', background: 'var(--primary-glow)', gap: '8px'
                }}
              >
                <Camera size={28} color="white" />
                <span style={{ fontSize: '12px', fontWeight: 600 }}>Snap Live</span>
              </div>
            )}
            <p style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>We strictly ask for you to take a live photo over the network.</p>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Your Name</label>
            <input 
              type="text" 
              className="input-base" 
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Contact Number</label>
            <input 
              type="tel" 
              className="input-base" 
              placeholder="Enter your phone number"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          {/* New Location Fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div style={{ position: 'relative' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, fontSize: '14px' }}>State</label>
              <input 
                type="text" 
                className="input-base" 
                placeholder="State Name"
                value={state}
                onChange={(e) => {
                  const val = e.target.value;
                  setState(val);
                  setFilteredStates(INDIAN_STATES.filter(s => s.toLowerCase().includes(val.toLowerCase())));
                  setShowStateList(true);
                  setDistrict(''); // Reset district on state change
                }}
                onFocus={() => setShowStateList(true)}
                disabled={isSubmitting}
                required
              />
              <AnimatePresence>
                {showStateList && filteredStates.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 110,
                      background: 'var(--surface-light)', border: '1px solid var(--primary-color)',
                      borderRadius: '12px', marginTop: '4px', maxHeight: '200px', overflowY: 'auto',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.8)',
                      backdropFilter: 'blur(20px)'
                    }}
                  >
                    {filteredStates.map(s => (
                      <div 
                        key={s}
                        onClick={() => {
                          setState(s);
                          setShowStateList(false);
                          setError('');
                          setDistrict('');
                          setFilteredDistricts(INDIA_DATA[s] || []);
                        }}
                        style={{
                          padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-glow)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <span style={{ fontSize: '14px' }}>{s}</span>
                        {state === s && <Check size={14} color="var(--primary-color)" />}
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
              {showStateList && <div onClick={() => setShowStateList(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 105 }} />}
            </div>

            <div style={{ position: 'relative' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, fontSize: '14px' }}>District</label>
              <input 
                type="text" 
                className="input-base" 
                placeholder={state ? "District Name" : "Select State First"}
                value={district}
                onChange={(e) => {
                  const val = e.target.value;
                  setDistrict(val);
                  const ds = INDIA_DATA[state] || [];
                  setFilteredDistricts(ds.filter(d => d.toLowerCase().includes(val.toLowerCase())));
                  setShowDistrictList(true);
                }}
                onFocus={() => {
                  if (state) {
                    const ds = INDIA_DATA[state] || [];
                    setFilteredDistricts(ds.filter(d => d.toLowerCase().includes(district.toLowerCase())));
                    setShowDistrictList(true);
                  }
                }}
                disabled={isSubmitting || !state}
                required
              />
              <AnimatePresence>
                {showDistrictList && filteredDistricts.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 110,
                      background: 'var(--surface-light)', border: '1px solid var(--primary-color)',
                      borderRadius: '12px', marginTop: '4px', maxHeight: '200px', overflowY: 'auto',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.8)',
                      backdropFilter: 'blur(20px)'
                    }}
                  >
                    {filteredDistricts.map(d => (
                      <div 
                        key={d}
                        onClick={() => {
                          setDistrict(d);
                          setShowDistrictList(false);
                          setError('');
                        }}
                        style={{
                          padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-glow)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <span style={{ fontSize: '14px' }}>{d}</span>
                        {district === d && <Check size={14} color="var(--primary-color)" />}
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
              {showDistrictList && <div onClick={() => setShowDistrictList(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 105 }} />}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, fontSize: '14px' }}>Nearest City</label>
              <input 
                type="text" 
                className="input-base" 
                placeholder="Nearest City"
                value={nearestCity}
                onChange={(e) => setNearestCity(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, fontSize: '14px' }}>Pincode</label>
              <input 
                type="text" 
                className="input-base" 
                placeholder="Pincode"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Primary Location (GPS)</label>
            <div 
              onClick={isSubmitting ? null : getLocation}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px', background: 'var(--surface-light)', borderRadius: '14px',
                border: `1px solid ${location ? 'var(--primary-color)' : 'var(--border-color)'}`,
                cursor: isSubmitting ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                opacity: isSubmitting ? 0.5 : 1
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <MapPin size={24} color={location ? '#10b981' : '#94a3b8'} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 600, color: location ? '#10b981' : '#f8fafc' }}>
                    {location ? 'Precise Location Captured' : 'Get Primary Location (GPS)'}
                  </span>
                  {location && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{location.address}</span>}
                </div>
              </div>
              {locating && <Loader2 className="animate-spin" size={18} color="var(--text-muted)" />}
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '12px', fontWeight: 500 }}>Select Role</label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div 
                onClick={() => !isSubmitting && !hasBuyer && setRole('buyer')}
                style={{
                  flex: 1, padding: '16px', borderRadius: '16px',
                  border: `2px solid ${role === 'buyer' ? 'var(--primary-color)' : 'var(--border-color)'}`,
                  background: role === 'buyer' ? 'var(--primary-glow)' : 'transparent',
                  cursor: isSubmitting || hasBuyer ? 'not-allowed' : 'pointer', textAlign: 'center', transition: 'all 0.2s',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                  opacity: isSubmitting || hasBuyer ? 0.5 : 1
                }}
              >
                <User size={24} color={role === 'buyer' ? '#10b981' : '#f8fafc'} />
                <span style={{ fontWeight: 600, color: role === 'buyer' ? '#10b981' : '#f8fafc' }}>{hasBuyer ? 'Buyer (Owned)' : 'Buyer'}</span>
              </div>
              
              <div 
                onClick={() => !isSubmitting && !hasSeller && setRole('seller')}
                style={{
                  flex: 1, padding: '16px', borderRadius: '16px',
                  border: `2px solid ${role === 'seller' ? 'var(--primary-color)' : 'var(--border-color)'}`,
                  background: role === 'seller' ? 'var(--primary-glow)' : 'transparent',
                  cursor: isSubmitting || hasSeller ? 'not-allowed' : 'pointer', textAlign: 'center', transition: 'all 0.2s',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                  opacity: isSubmitting || hasSeller ? 0.5 : 1
                }}
              >
                <Store size={24} color={role === 'seller' ? '#10b981' : '#f8fafc'} />
                <span style={{ fontWeight: 600, color: role === 'seller' ? '#10b981' : '#f8fafc' }}>{hasSeller ? 'Seller (Owned)' : 'Seller'}</span>
              </div>
            </div>
          </div>

          <button type="submit" disabled={isSubmitting || (role === 'buyer' && hasBuyer) || (role === 'seller' && hasSeller)} className="btn-primary" style={{ width: '100%', padding: '16px' }}>
            {isSubmitting ? <><Loader2 className="animate-spin" size={20} /> Registering...</> : `Create ${role === 'buyer' ? 'Buyer' : 'Seller'} Profile`}
          </button>
        </form>
      ) : (
        <div style={{ width: '100%' }}>
          <h3 style={{ fontSize: '20px', marginBottom: '16px', textAlign: 'center' }}>Select Profile</h3>
          <div style={{ display: 'grid', gap: '16px', marginBottom: '24px' }}>
            {deviceProfiles.map(profile => (
              <div 
                key={profile.id}
                onClick={() => handleProfileSelect(profile)}
                className="glass-panel"
                style={{
                  padding: '20px', display: 'flex', alignItems: 'center', gap: '16px',
                  cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div style={{ width: '60px', height: '60px', borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--primary-color)' }}>
                  <img src={profile.selfiePath} alt="Selfie" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ fontSize: '18px', marginBottom: '4px' }}>{profile.name}</h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {profile.role === 'buyer' ? <User size={14} color="var(--primary-color)" /> : <Store size={14} color="var(--primary-color)" />}
                    <span style={{ fontSize: '14px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{profile.role}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {deviceProfiles.length < 2 && (
             <button 
               className="btn-secondary" 
               style={{ width: '100%', padding: '16px', borderStyle: 'dashed' }}
               onClick={() => {
                 setRole(hasBuyer ? 'seller' : 'buyer');
                 setIsCreating(true);
               }}
             >
               + Create {hasBuyer ? 'Seller' : 'Buyer'} Profile
             </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
