import * as PusherNamespace from 'pusher-js';

// Multi-stage constructor resolution for modern bundlers (Vite/Rolldown)
const Pusher = (typeof PusherNamespace === 'function') 
  ? PusherNamespace 
  : (PusherNamespace.default || PusherNamespace.Pusher || PusherNamespace);

let pusher = { subscribe: () => ({ bind: () => {}, unbind: () => {} }), unsubscribe: () => {} };

try {
  const key = import.meta.env.VITE_PUSHER_KEY;
  const cluster = import.meta.env.VITE_PUSHER_CLUSTER;
  
  if (key && Pusher && typeof Pusher === 'function') {
    pusher = new Pusher(key, {
      cluster: cluster || 'ap2',
      forceTLS: true
    });
    console.log("✓ Pusher connection initialized");
  } else {
    console.warn("⚠️ Pusher Key missing or constructor invalid. Real-time features disabled.");
  }
} catch (err) {
  console.error("❌ Pusher initialization failed:", err);
}

export const socket = {
  // Mock 'on' for compatibility
  on: (event, callback, channelName = 'mandi-global') => {
    try {
      const channel = pusher.subscribe(channelName);
      channel.bind(event, callback);
      return () => channel.unbind(event, callback);
    } catch (e) { return () => {}; }
  },
  
  subscribe: (channelName) => {
    try { return pusher.subscribe(channelName); }
    catch (e) { return { bind: () => {}, unbind: () => {} }; }
  },
  
  unsubscribe: (channelName) => {
    try { pusher.unsubscribe(channelName); }
    catch (e) {}
  },

  subscribeUser: (userId, event, callback) => {
    try {
      const channel = pusher.subscribe(`user-${userId.split('_')[0]}`);
      channel.bind(event, callback);
      return () => channel.unbind(event, callback);
    } catch (e) { return () => {}; }
  },

  emit: async (event, data) => {
    try {
      await fetch('/api/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: data.to || data.userToCall, event, data })
      });
    } catch (err) {
      console.error("Signal emit error:", err);
    }
  }
};
