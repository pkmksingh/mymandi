import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

export const useStore = create(
  persist(
    (set, get) => ({
      googleUser: null,
      deviceProfiles: [], 
      profilesLoaded: false,
      language: 'en',
      setLanguage: (lang) => set({ language: lang }),
      currentUser: null,
      listings: [], 
      unreadCount: 0,
      missedCalls: 0,
      activeChatUser: null,
      showInbox: false,
      showHelp: false,
      activeCall: null,
      isLoading: false,

      setGoogleUser: (user) => {
        set({ googleUser: user });
        if (user) {
          get().fetchProfiles(user.googleId);
        } else {
          set({ deviceProfiles: [], currentUser: null });
          set({ deviceProfiles: [], currentUser: null, profilesLoaded: false });
        }
      },

      fetchProfiles: async (googleId) => {
        try {
          const id = googleId || (get().googleUser?.googleId);
          if (!id) return;

          const res = await fetch(`/api/users/google/${id}`);
          if (res.ok) {
            const profiles = await res.json();
            set({ deviceProfiles: profiles, profilesLoaded: true });
          } else {
            set({ profilesLoaded: true });
          }
        } catch (err) {
          console.error(err);
          set({ profilesLoaded: true });
        }
      },

      login: (userRecord) => {
        set({ currentUser: userRecord });
      },

      logout: () => {
        set({ googleUser: null, currentUser: null, deviceProfiles: [], profilesLoaded: false });
      },

      // Messaging State
      startChat: (id, name, selfiePath) => set({ activeChatUser: { id, name, selfiePath }, showInbox: false, showHelp: false }),
      closeChat: () => set({ activeChatUser: null }),
      toggleInbox: () => set(state => ({ showInbox: !state.showInbox, showHelp: false, activeChatUser: null })),
      toggleHelp: () => set(state => ({ showHelp: !state.showHelp, showInbox: false, activeChatUser: null })),
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

      markChatAsRead: async (contactId) => {
        const user = get().currentUser;
        if (!user || !contactId) return;
        try {
          await fetch(`/api/messages/read/${contactId}/${user.id}`, { method: 'PATCH' });
          get().fetchUnreadCount();
        } catch (err) { console.error(err); }
      },

      markAsSold: async (id) => {
        const oldListings = get().listings;
        set(state => ({
          listings: state.listings.map(l => l.id === id ? { ...l, status: 'sold' } : l)
        }));

        try {
          const res = await fetch(`/api/listings/${id}/sold`, { method: 'PATCH' });
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.details || "Server error");
          }
        } catch (err) {
          console.error(err);
          set({ listings: oldListings });
          alert(`Failed to mark as sold: ${err.message}`);
        }
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

      startCall: (data, role = 'outgoing') => {
        if (role === 'incoming') {
          set({ activeCall: { ...data, status: 'ringing', role: 'incoming' } });
        } else {
          const user = get().currentUser;
          if (!user) return;
          set({
            activeCall: {
              callerId: user.id,
              callerName: user.name,
              callerSelfie: user.selfiePath,
              receiverId: data.id,
              receiverName: data.name,
              receiverSelfie: data.selfiePath,
              role: 'outgoing',
              status: 'ringing'
            }
          });
        }
      },

      acceptCall: () => set(state => ({
        activeCall: state.activeCall ? { ...state.activeCall, status: 'connected' } : null
      })),

      endCall: () => set({ activeCall: null })
    }),
    {
      name: 'mandi-storage',
      partialize: (state) => ({ 
        googleUser: state.googleUser,
        currentUser: state.currentUser,
        language: state.language
      }),
    }
  )
);
