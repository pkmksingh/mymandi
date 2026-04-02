import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

export const useStore = create(
  persist(
    (set, get) => ({
      deviceId: null,
      deviceToken: null,
      currentUser: null,
      deviceProfiles: [],
      deviceProfilesLoaded: false,
      users: [],
      listings: [], // Now fetched from backend
      messages: [],
      activeCall: null,
      missedCalls: 0,
      isLoading: false,

      initDevice: () => {
        let id = get().deviceId;
        let token = get().deviceToken;
        if (!id) {
          id = uuidv4();
          token = uuidv4(); // Unique secret for this device
          set({ deviceId: id, deviceToken: token });
        }
        get().fetchDeviceProfiles(id, token);
        return { deviceId: id, deviceToken: token };
      },

      fetchDeviceProfiles: async (deviceId, deviceToken) => {
        try {
          const id = deviceId || get().deviceId;
          const token = deviceToken || get().deviceToken;
          
          if (!id) return;

          const res = await fetch(`/api/users/device/${id}`, {
            headers: { 'x-device-token': token || '' }
          });
          
          if (res.ok) {
            const profiles = await res.json();
            set({ deviceProfiles: profiles, deviceProfilesLoaded: true });
          } else {
            set({ deviceProfilesLoaded: true });
          }
        } catch (err) {
          console.error(err);
          set({ deviceProfilesLoaded: true });
        }
      },

      login: (userRecord) => {
        set({ currentUser: userRecord });
        get().fetchDeviceProfiles(get().deviceId, get().deviceToken);
      },

      logout: () => {
        set({ currentUser: null });
        if (get().deviceId) get().fetchDeviceProfiles(get().deviceId, get().deviceToken);
      },

      // Messaging State
      unreadCount: 0,
      activeChatUser: null,
      showInbox: false,
      startChat: (id, name, selfiePath) => set({ activeChatUser: { id, name, selfiePath }, showInbox: false }),
      closeChat: () => set({ activeChatUser: null }),
      toggleInbox: () => set(state => ({ showInbox: !state.showInbox })),
      setUnreadCount: (count) => set({ unreadCount: count }),
      incrementMissedCalls: () => set(state => ({ missedCalls: state.missedCalls + 1 })),
      resetMissedCalls: () => set({ missedCalls: 0 }),
      fetchUnreadCount: async () => {
        const user = get().currentUser;
        if (!user) return;
        try {
          const res = await fetch(`/api/messages/unread-count/${user.id}`);
          if (res.ok) {
            const data = await res.json();
            set({ unreadCount: data.count });
          }
        } catch (err) { console.error(err); }
      },

      fetchListings: async () => {
        set({ isLoading: true });
        try {
          const res = await fetch('/api/listings');
          if (res.ok) {
            const data = await res.json();
            set({ listings: data });
          }
        } catch (error) {
          console.error("Failed to fetch listings:", error);
        } finally {
          set({ isLoading: false });
        }
      },

      updateListingStatus: (id, status) => {
        set(state => ({
          listings: state.listings.map(l => l.id === id ? { ...l, status } : l)
        }));
      },

      editListingDetails: (id, updates) => {
        set(state => ({
          listings: state.listings.map(l => l.id === id ? { ...l, ...updates } : l)
        }));
      },

      startCall: (receiverId, receiverName, receiverSelfie) => {
        set({
          activeCall: {
            callerId: get().currentUser.id,
            callerName: get().currentUser.name,
            callerSelfie: get().currentUser.selfiePath,
            receiverId,
            receiverName,
            receiverSelfie,
            status: 'ringing'
          }
        });
      },

      endCall: () => set({ activeCall: null })
    }),
    {
      name: 'mandi-storage',
      partialize: (state) => ({ 
        deviceId: state.deviceId, 
        deviceToken: state.deviceToken,
        currentUser: state.currentUser
      }),
    }
  )
);
