import { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, X, RefreshCw, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function CameraCapture({ onCapture, onClose, facingMode = 'user' }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState('');
  const [currentFacingMode, setCurrentFacingMode] = useState(facingMode);
  const [capturing, setCapturing] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  // Attach stream to video element reliably (handles Android timing issues)
  const attachStream = useCallback((mediaStream) => {
    const video = videoRef.current;
    if (!video || !mediaStream) return;

    video.srcObject = mediaStream;

    // Listen for metadata to confirm dimensions are available
    const onLoadedMetadata = () => {
      setVideoReady(true);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
    video.addEventListener('loadedmetadata', onLoadedMetadata);

    // Explicitly call play() — required on Android Chrome even with autoPlay + muted
    video.play().catch((err) => {
      // AbortError is harmless (happens if component re-renders quickly)
      if (err.name !== 'AbortError') {
        console.error('Video play() failed:', err);
      }
    });
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setVideoReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: currentFacingMode,
          // Suggest reasonable resolution for mobile devices
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = mediaStream;
      attachStream(mediaStream);
      setError('');
    } catch (err) {
      console.error("Camera error:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Camera permission denied. Please allow camera access in your browser settings and reload.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No camera found on this device.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError('Camera is in use by another app. Please close other apps using the camera and try again.');
      } else if (err.name === 'OverconstrainedError') {
        // Fallback: retry without facingMode constraint (some devices don't support it)
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
          streamRef.current = fallbackStream;
          attachStream(fallbackStream);
          setError('');
        } catch (fallbackErr) {
          setError('Camera access failed. Please ensure camera permissions are enabled.');
        }
      } else {
        setError('Camera access denied or unavailable. Please enable permissions.');
      }
    }
  }, [currentFacingMode, stopCamera, attachStream]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const toggleCamera = () => {
    setCurrentFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const handleSnap = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      console.warn("Video or canvas ref not available");
      return;
    }

    // Wait briefly for dimensions if not immediately ready
    let width = video.videoWidth;
    let height = video.videoHeight;
    if (!width || !height) {
      // Give Android a moment to report dimensions
      await new Promise(resolve => setTimeout(resolve, 200));
      width = video.videoWidth;
      height = video.videoHeight;
    }

    if (!width || !height) {
      console.warn("Video dimensions not available yet");
      setError('Camera is still initializing. Please wait a moment and try again.');
      return;
    }
    
    setCapturing(true);

    // Set canvas dimensions to match actual video feed exactly
    canvas.width = width;
    canvas.height = height;
    
    const context = canvas.getContext('2d');
    
    // Mirror the canvas for selfies to feel natural
    if (currentFacingMode === 'user') {
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
    }
    
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Reset transform
    context.setTransform(1, 0, 0, 1, 0, 0);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    
    // Release camera immediately after capturing the pixels
    stopCamera();

    // Convert base64 to File object for the backend Multer pipeline
    canvas.toBlob((blob) => {
      if (!blob) {
        setCapturing(false);
        setError('Failed to capture image. Please try again.');
        return;
      }
      const file = new File([blob], `live_snap_${Date.now()}.jpg`, { type: 'image/jpeg' });
      onCapture(file, dataUrl);
      setCapturing(false);
    }, 'image/jpeg', 0.9);
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'var(--bg-main)',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header Bar */}
        <div style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.5)', zIndex: 10 }}>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
            <X size={28} />
          </button>
          <span style={{ fontWeight: 600, fontSize: '18px' }}>Live Capture</span>
          <button onClick={toggleCamera} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
            <RefreshCw size={24} />
          </button>
        </div>

        {/* Video Viewer */}
        <div style={{ flex: 1, position: 'relative', background: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {error ? (
            <div style={{ color: 'var(--danger-color)', textAlign: 'center', padding: '20px' }}>
              <p>{error}</p>
              <button 
                onClick={() => { setError(''); startCamera(); }}
                style={{ marginTop: '12px', padding: '8px 20px', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline
                muted
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover',
                  transform: currentFacingMode === 'user' ? 'scaleX(-1)' : 'none' 
                }} 
              />
              {/* Hidden canvas used solely for extraction */}
              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </>
          )}
        </div>

        {/* Action Bottom Bar */}
        <div style={{ padding: '40px', display: 'flex', justifyContent: 'center', background: 'rgba(0,0,0,0.8)' }}>
          <button 
            onClick={handleSnap}
            disabled={!!error || capturing || !videoReady}
            style={{
              width: '80px', height: '80px', borderRadius: '50%',
              background: 'white', border: '6px solid var(--primary-color)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: (error || capturing || !videoReady) ? 'not-allowed' : 'pointer',
              opacity: (error || capturing || !videoReady) ? 0.5 : 1, transition: 'transform 0.1s'
            }}
            onTouchStart={e => e.currentTarget.style.transform = 'scale(0.95)'}
            onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            {capturing ? (
              <Loader2 className="animate-spin" size={32} color="black" />
            ) : (
              <Camera size={32} color="black" />
            )}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
