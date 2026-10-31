import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  auth, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User 
} from '../firebase';
import { syncUserProfile } from '../services/firestoreSync';

export type SyncStatus = 'synced' | 'saving' | 'offline' | 'error' | 'local';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  syncStatus: SyncStatus;
  setSyncStatus: (status: SyncStatus) => void;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  syncStatus: 'local',
  setSyncStatus: () => {},
  signInWithGoogle: async () => {},
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setSyncStatus('saving');
        try {
          await syncUserProfile(currentUser);
          setSyncStatus('synced');
        } catch (e) {
          console.error('Failed to sync user profile:', e);
          setSyncStatus('error');
        }
      } else {
        setSyncStatus('local');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      setSyncStatus('saving');
      const res = await signInWithPopup(auth, googleProvider);
      if (res.user) {
        await syncUserProfile(res.user);
        setSyncStatus('synced');
      }
    } catch (error) {
      console.error('Google Sign-In failed:', error);
      setSyncStatus('error');
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setSyncStatus('local');
    } catch (error) {
      console.error('Sign out failed:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        syncStatus,
        setSyncStatus,
        signInWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
