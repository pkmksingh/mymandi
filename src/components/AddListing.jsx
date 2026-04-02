import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { Camera, MapPin, X, Loader2, Check, Mic, MicOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CameraCapture } from './CameraCapture';
import { INDIA_DATA } from '../data/india-data';

const INDIAN_STATES = Object.keys(INDIA_DATA);

export function AddListing() {
  const { currentUser, language } = useStore();
  const navigate = useNavigate();

  const [cropName, setCropName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState([]);
  
  const [showCamera, setShowCamera] = useState(false);
  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);

  const [nearestCity, setNearestCity] = useState('');
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');

  const [showStateList, setShowStateList] = useState(false);
  const [filteredStates, setFilteredStates] = useState(INDIAN_STATES);
  const [showDistrictList, setShowDistrictList] = useState(false);
  const [filteredDistricts, setFilteredDistricts] = useState([]);

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const startVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = language === 'hi' ? 'hi-IN' : (language === 'pa' ? 'pa-IN' : 'en-IN');
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setCropName(transcript);
    };
    recognition.start();
  };

  const handleCapture = (file, dataUrl) => {
    if (imageFiles.length >= 5) {
      setError('You can only snap up to 5 photos.');
      setShowCamera(false);
      return;
    }
    setImageFiles(prev => [...prev, file]);
    setImagePreviewUrls(prev => [...prev, dataUrl]);
    setError('');
    setShowCamera(false);
  };

  const removeImage = (index) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviewUrls(prev => prev.filter((_, i) => i !== index));
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
        console.error("Location Error:", err);
        let msg = 'Failed to get precise location.';
        if (err.code === 1) msg = 'Location permission denied. Please allow location access in your browser settings.';
        else if (err.code === 3) msg = 'Location request timed out. Please try again in an open area.';
        
        setError(msg);
        
        // Fallback to a default if absolutely necessary, but notify the user
        setLocation({
          lat: 23.0225,
          lng: 72.5714,
          address: 'Approximate Network Location'
        });
        setLocating(false);
      },
      options
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (imageFiles.length < 2) {
      setError('Please snap at least 2 live photos of your crop.');
      return;
    }
    if (!location) {
      setError('Please provide your location.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('sellerId', currentUser.id);
      formData.append('sellerName', currentUser.name);
      formData.append('cropName', cropName);
      formData.append('quantity', quantity);
      formData.append('price', price);
      formData.append('location', JSON.stringify(location));
      formData.append('nearestCity', nearestCity);
      formData.append('district', district);
      formData.append('state', state);
      formData.append('pincode', pincode);
      
      imageFiles.forEach(file => {
        formData.append('images', file);
      });

      const res = await fetch('/api/listings', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to publish listing');
      }

      navigate('/seller');
    } catch (err) {
      console.error(err);
      setError(err.message || 'An error occurred during upload. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
      {showCamera && (
        <CameraCapture 
          facingMode="environment"
          onClose={() => setShowCamera(false)}
          onCapture={handleCapture}
        />
      )}
      
      <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>List Your Crop</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Take live photos directly from the app.</p>

      <AnimatePresence>
        {isListening && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={{
              position: 'fixed', top: '100px', left: '50%', transform: 'translateX(-50%)',
              background: 'var(--primary-color)', color: 'white', padding: '12px 24px',
              borderRadius: '30px', zIndex: 100, display: 'flex', alignItems: 'center', gap: '10px',
              boxShadow: '0 0 30px var(--primary-glow)'
            }}
          >
            <Mic className="animate-pulse" size={20} />
            <span style={{ fontWeight: 600 }}>Listening...</span>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div style={{ background: 'var(--danger-glass)', color: 'var(--danger-color)', padding: '16px', borderRadius: '14px', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Crop Name</label>
          <div style={{ position: 'relative' }}>
            <input 
              type="text" 
              className="input-base" 
              placeholder="e.g. Organic Tomatoes"
              value={cropName}
              onChange={(e) => setCropName(e.target.value)}
              required
              disabled={isSubmitting}
              style={{ paddingRight: '48px' }}
            />
            <button 
              type="button"
              onClick={startVoiceInput}
              style={{ 
                position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                background: isListening ? 'var(--danger-color)' : 'var(--surface-light)',
                border: 'none', borderRadius: '10px', width: '32px', height: '32px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
              }}
            >
              {isListening ? <Mic size={16} color="white" className="animate-pulse" /> : <Mic size={16} color="var(--primary-color)" />}
            </button>
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Available Quantity</label>
          <input 
            type="text" 
            className="input-base" 
            placeholder="e.g. 50 Quintal / 200 Kg"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
            disabled={isSubmitting}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Expected Price (Optional)</label>
          <input 
            type="text" 
            className="input-base" 
            placeholder="e.g. ₹2000 / Quintal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            disabled={isSubmitting}
          />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Live Photos (Min 2)</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '12px' }}>
            <AnimatePresence>
              {imagePreviewUrls.map((img, idx) => (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.8 }} 
                  animate={{ opacity: 1, scale: 1 }} 
                  exit={{ opacity: 0, scale: 0.8 }}
                  key={idx} 
                  style={{ position: 'relative', aspectRatio: '1', borderRadius: '12px', overflow: 'hidden' }}
                >
                  <img src={img} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button 
                    type="button" 
                    onClick={() => removeImage(idx)}
                    disabled={isSubmitting}
                    style={{
                      position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.5)', 
                      border: 'none', color: 'white', borderRadius: '50%', width: '24px', height: '24px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                    }}
                  >
                    <X size={14} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>

            {imageFiles.length < 5 && (
              <div 
                onClick={() => !isSubmitting && setShowCamera(true)}
                style={{
                  border: '2px dashed var(--border-color)', borderRadius: '12px', aspectRatio: '1',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer', background: 'var(--surface-light)', gap: '8px',
                  opacity: isSubmitting ? 0.5 : 1
                }}
              >
                <Camera size={24} color="var(--text-muted)" />
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Snap Feed</span>
              </div>
            )}
          </div>
        </div>

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
                setDistrict('');
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

        <div style={{ marginBottom: '32px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
            Location <span style={{ color: 'var(--danger-color)', fontSize: '13px' }}>(Required*)</span>
          </label>
          <div 
            onClick={isSubmitting ? null : getLocation}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px', background: 'var(--surface-light)', borderRadius: '14px',
              border: `1px solid ${location ? 'var(--primary-color)' : (error.includes('location') ? 'var(--danger-color)' : 'var(--border-color)')}`,
              cursor: isSubmitting ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
              opacity: isSubmitting ? 0.5 : 1,
              boxShadow: !location && error.includes('location') ? '0 0 0 2px var(--danger-glass)' : 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <MapPin size={24} color={location ? '#10b981' : (error.includes('location') ?'#ef4444' : '#94a3b8')} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 600, color: location ? '#10b981' : (error.includes('location') ? '#ef4444' : '#f8fafc') }}>
                  {location ? 'Precise Location Captured' : (locating ? 'Capturing GPS...' : 'Get Primary Location (GPS)')}
                </span>
                {location && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{location.address}</span>}
              </div>
            </div>
            {locating && <Loader2 className="animate-spin" size={18} color="var(--primary-color)" />}
          </div>
        </div>

        <button type="submit" disabled={isSubmitting} className="btn-primary" style={{ width: '100%', padding: '16px' }}>
          {isSubmitting ? <><Loader2 className="animate-spin" size={20} /> Publishing...</> : 'Publish Listing'}
        </button>
      </form>
    </motion.div>
  );
}
