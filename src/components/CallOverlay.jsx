import { useStore } from '../store';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { socket } from '../socket';

export function CallOverlay() {
  const { activeCall, endCall, currentUser, incrementMissedCalls } = useStore();
  
  const [micMuted, setMicMuted] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);
  
  const [stream, setStream] = useState(null);
  const [callAccepted, setCallAccepted] = useState(false);
  const [videoActive, setVideoActive] = useState(false);
  const [incomingVideoRequest, setIncomingVideoRequest] = useState(false);
  const [isRequestingVideo, setIsRequestingVideo] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const connectionRef = useRef(null);
  
  const leaveCall = () => {
    if (connectionRef.current) {
      connectionRef.current.close();
    }
    
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      localVideoRef.current.srcObject.getTracks().forEach(track => track.stop());
      localVideoRef.current.srcObject = null;
    }
    
    if (activeCall) {
      const peerId = activeCall.callerId === currentUser?.id ? activeCall.receiverId : activeCall.callerId;
      socket.emit('call-ended', { to: peerId });
    }

    setStream(null);
    setCallAccepted(false);
    setVideoActive(false);
    endCall();
  };

  useEffect(() => {
    if (!currentUser) return;

    const unsubs = [
      socket.subscribeUser(currentUser.id, 'incoming-call', (data) => {
        useStore.setState({
          activeCall: {
            callerId: data.from,
            callerName: data.callerName,
            callerSelfie: data.callerSelfie,
            receiverId: currentUser?.id,
            receiverName: currentUser?.name,
            receiverSelfie: currentUser?.selfiePath,
            status: 'ringing',
            signalData: data.signal
          }
        });

        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Incoming Call ☎️", { 
            body: `${data.callerName} is calling you on Meri Mandi!`,
            icon: data.callerSelfie || '/upiqr.jpeg'
          });
        }
      }),

      socket.subscribeUser(currentUser.id, 'call-ended', () => {
        leaveCall();
      }),

      socket.subscribeUser(currentUser.id, 'missed-call', () => {
        incrementMissedCalls();
        leaveCall();
      }),

      socket.subscribeUser(currentUser.id, 'video-requested', () => {
        setIncomingVideoRequest(true);
      }),

      socket.subscribeUser(currentUser.id, 'video-accepted', () => {
        setIsRequestingVideo(false);
        enableVideoTrack();
      }),

      socket.subscribeUser(currentUser.id, 'video-rejected', () => {
        setIsRequestingVideo(false);
        alert("Video call request was declined.");
      })
    ];

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [currentUser]);

  useEffect(() => {
    let timeoutId;
    if (activeCall && activeCall.status === 'ringing') {
      timeoutId = setTimeout(() => {
        const peerId = activeCall.callerId === currentUser?.id ? activeCall.receiverId : activeCall.callerId;
        if (activeCall.receiverId === currentUser?.id) {
          incrementMissedCalls();
        }
        socket.emit('missed-call', { to: peerId });
        leaveCall();
      }, 60000); 
    }
    return () => clearTimeout(timeoutId);
  }, [activeCall]);

  useEffect(() => {
    if (activeCall && !stream && !callAccepted && activeCall.callerId === currentUser?.id) {
      navigator.mediaDevices.getUserMedia({ video: false, audio: true }).then((currentStream) => {
        setStream(currentStream);
        if (localVideoRef.current) localVideoRef.current.srcObject = currentStream;
        
        const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        
        currentStream.getTracks().forEach(track => peer.addTrack(track, currentStream));
        
        peer.ontrack = (event) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = event.streams[0];
          }
        };

        peer.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('ice-candidate', { candidate: event.candidate, to: activeCall.receiverId });
          }
        };

        const unsubIce = socket.subscribeUser(currentUser.id, 'ice-candidate', (data) => {
          if (data.candidate) { 
            peer.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(e => console.error("ICE error:", e));
          }
        });

        const unsubAccepted = socket.subscribeUser(currentUser.id, 'call-accepted', (signal) => {
          setCallAccepted(true);
          useStore.setState({ activeCall: { ...activeCall, status: 'connected' } });
          peer.setRemoteDescription(new RTCSessionDescription(signal.signal));
        });

        peer.oniceconnectionstatechange = () => console.log("ICE state (Caller):", peer.iceConnectionState);

        peer.createOffer().then(offer => {
          peer.setLocalDescription(offer);
          socket.emit('incoming-call', {
            userToCall: activeCall.receiverId,
            signal: offer,
            from: currentUser.id,
            callerName: currentUser.name,
            callerSelfie: currentUser.selfiePath
          });
        });

        connectionRef.current = { 
          peer,
          close: () => {
            peer.close();
            unsubAccepted();
            unsubIce();
          }
        };
      }).catch(err => {
        console.error("Failed to get media", err);
        alert("Camera and Mic permissions are required for calling");
        endCall();
      });
    }
  }, [activeCall, stream, currentUser, callAccepted]);


  const answerCall = () => {
    if (!activeCall || !activeCall.signalData) return;

    setCallAccepted(true);
    useStore.setState({ activeCall: { ...activeCall, status: 'connected' } });

    navigator.mediaDevices.getUserMedia({ video: false, audio: true }).then((currentStream) => {
      setStream(currentStream);
      if (localVideoRef.current) localVideoRef.current.srcObject = currentStream;

      const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      
      currentStream.getTracks().forEach(track => peer.addTrack(track, currentStream));
      
      peer.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0];
        }
      };

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice-candidate', { candidate: event.candidate, to: activeCall.callerId });
        }
      };

      const unsubIce = socket.subscribeUser(currentUser.id, 'ice-candidate', (data) => {
        if (data.candidate && peer.remoteDescription) {
          peer.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(e => console.error("ICE error:", e));
        }
      });

      peer.oniceconnectionstatechange = () => console.log("ICE state (Receiver):", peer.iceConnectionState);

      peer.setRemoteDescription(new RTCSessionDescription(activeCall.signalData)).then(() => {
        peer.createAnswer().then(answer => {
          peer.setLocalDescription(answer);
          socket.emit('call-accepted', { signal: answer, to: activeCall.callerId });
        });
      });

      connectionRef.current = {
        peer,
        close: () => {
          peer.close();
          unsubIce();
        }
      };
    });
  };

  const toggleMic = () => {
    if (stream) {
      stream.getAudioTracks()[0].enabled = micMuted;
      setMicMuted(!micMuted);
    }
  };

  const requestVideo = () => {
    const peerId = activeCall.callerId === currentUser?.id ? activeCall.receiverId : activeCall.callerId;
    setIsRequestingVideo(true);
    socket.emit('video-requested', { to: peerId, from: currentUser.id });
  };

  const acceptVideo = () => {
    const peerId = activeCall.callerId === currentUser?.id ? activeCall.receiverId : activeCall.callerId;
    setIncomingVideoRequest(false);
    socket.emit('video-accepted', { to: peerId });
    enableVideoTrack();
  };

  const rejectVideo = () => {
    const peerId = activeCall.callerId === currentUser?.id ? activeCall.receiverId : activeCall.callerId;
    setIncomingVideoRequest(false);
    socket.emit('video-rejected', { to: peerId });
  };

  const enableVideoTrack = async () => {
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      const videoTrack = videoStream.getVideoTracks()[0];
      
      if (stream) {
        stream.addTrack(videoTrack);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      }

      if (connectionRef.current) {
        const peer = connectionRef.current.peer || connectionRef.current;
        if (peer && typeof peer.getSenders === 'function') {
          const senders = peer.getSenders();
          const videoSender = senders.find(s => s.track && s.track.kind === 'video');
          if (videoSender) {
            videoSender.replaceTrack(videoTrack);
          } else {
            peer.addTrack(videoTrack, stream);
          }
        }
      }
      setVideoActive(true);
      setVideoMuted(false);
    } catch (err) {
      console.error("Failed to start video", err);
    }
  };

  const toggleVideo = () => {
    if (!videoActive) {
      requestVideo();
      return;
    }
    if (stream && stream.getVideoTracks().length > 0) {
      const track = stream.getVideoTracks()[0];
      track.enabled = videoMuted;
      setVideoMuted(!videoMuted);
    }
  };

  if (!activeCall) return null;

  const isRinging = activeCall.status === 'ringing';
  const isIncoming = activeCall.receiverId === currentUser?.id && isRinging;
  const isOutgoing = activeCall.callerId === currentUser?.id;
  const peerSelfie = isOutgoing ? activeCall.receiverSelfie : activeCall.callerSelfie;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }} 
        animate={{ opacity: 1, scale: 1 }} 
        exit={{ opacity: 0, scale: 0.9 }}
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(6, 9, 7, 0.95)',
          backdropFilter: 'blur(20px)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}
      >
        <div style={{ textAlign: 'center', width: '100%', maxWidth: '400px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          
          <div style={{
            position: 'relative',
            width: callAccepted ? '100%' : '140px', 
            height: callAccepted ? '60vh' : '140px',
            borderRadius: callAccepted ? '24px' : '50%',
            overflow: 'hidden',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '48px', fontWeight: 700,
            transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: callAccepted ? '0 20px 50px rgba(0,0,0,0.5)' : '0 0 50px var(--primary-glow)',
            animation: isRinging ? 'pulse-ring 2s infinite' : 'none'
          }}>
            <video 
              playsInline 
              ref={remoteVideoRef} 
              autoPlay 
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: videoActive ? 'block' : 'none' }} 
            />
            <audio ref={remoteAudioRef} autoPlay style={{ display: 'none' }} />
            
            {!videoActive && (peerSelfie ? (
              <img src={peerSelfie} alt="Peer Selfie" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              isOutgoing ? activeCall.receiverName?.charAt(0) : activeCall.callerName?.charAt(0)
            ))}

            {videoActive && (
              <div style={{
                position: 'absolute', bottom: 16, right: 16,
                width: '100px', height: '150px', borderRadius: '12px',
                overflow: 'hidden', border: '2px solid white',
                background: '#000'
              }}>
                <video playsInline ref={localVideoRef} autoPlay muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}
          </div>
          
          <AnimatePresence>
            {incomingVideoRequest && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: 'var(--primary-glow)', padding: '16px 24px', borderRadius: '16px', 
                  marginTop: '20px', border: '1px solid var(--primary-color)', textAlign: 'center'
                }}
              >
                <p style={{ fontWeight: 600, marginBottom: '12px' }}>Requesting Video Call...</p>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={rejectVideo} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '14px' }}>Decline</button>
                  <button onClick={acceptVideo} className="btn-primary" style={{ padding: '8px 16px', fontSize: '14px' }}>Accept Video</button>
                </div>
              </motion.div>
            )}
            
            {isRequestingVideo && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: 'var(--surface-color)', padding: '12px 20px', borderRadius: '12px', 
                  marginTop: '20px', border: '1px solid var(--border-color)', fontSize: '14px'
                }}
              >
                Waiting for video call acceptance...
              </motion.div>
            )}
          </AnimatePresence>
          
          <h2 style={{ fontSize: '32px', marginBottom: '8px', marginTop: '24px' }}>
            {isOutgoing ? activeCall.receiverName : activeCall.callerName}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '18px' }}>
            {isRinging ? (isIncoming ? 'Incoming Call...' : 'Ringing...') : 'Connected Securely'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '24px', alignItems: 'center', marginTop: 'auto', marginBottom: '40px' }}>
          {(!isRinging || callAccepted) && (
            <>
              <button 
                className="btn-icon-circular" 
                onClick={toggleMic}
                style={{ width: '56px', height: '56px', background: micMuted ? 'var(--danger-color)' : 'var(--surface-color)', color: 'white' }}
              >
                {micMuted ? <MicOff size={24} /> : <Mic size={24} />}
              </button>
              <button 
                className="btn-icon-circular btn-call-reject" 
                onClick={leaveCall}
                style={{ width: '72px', height: '72px' }}
              >
                <PhoneOff size={32} />
              </button>
              <button 
                className="btn-icon-circular" 
                onClick={toggleVideo}
                disabled={isRequestingVideo || incomingVideoRequest}
                style={{ 
                  width: '56px', height: '56px', 
                  background: !videoActive ? 'var(--surface-color)' : (videoMuted ? 'var(--danger-color)' : 'var(--primary-color)'), 
                  color: 'white',
                  animation: !videoActive ? 'pulse-ring 2s infinite' : 'none'
                }}
              >
                {videoMuted ? <VideoOff size={24} /> : <Video size={24} />}
              </button>
            </>
          )}

          {isIncoming && isRinging && (
            <div style={{ display: 'flex', gap: '40px' }}>
              <button 
                className="btn-icon-circular btn-call-reject" 
                onClick={leaveCall}
                style={{ width: '72px', height: '72px' }}
              >
                <PhoneOff size={32} />
              </button>
              <button 
                className="btn-icon-circular btn-call-accept" 
                onClick={answerCall}
                style={{ width: '72px', height: '72px' }}
              >
                <Phone size={32} />
              </button>
            </div>
          )}

          {isOutgoing && isRinging && !callAccepted && (
            <button 
              className="btn-icon-circular btn-call-reject" 
              onClick={leaveCall}
              style={{ width: '72px', height: '72px' }}
            >
              <PhoneOff size={32} />
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
