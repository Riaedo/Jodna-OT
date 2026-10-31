import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  auth, 
  googleProvider, 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult, 
  signOut, 
  onAuthStateChanged, 
  User,
  isMobileDevice
} from '../firebase';
import { syncUserProfile } from '../services/firestoreSync';

export type SyncStatus = 'synced' | 'saving' | 'offline' | 'error' | 'local';

export interface AuthErrorInfo {
  code: string;
  message: string;
  domain?: string;
  solution?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  syncStatus: SyncStatus;
  authError: AuthErrorInfo | null;
  setSyncStatus: (status: SyncStatus) => void;
  clearAuthError: () => void;
  signInWithGoogle: (method?: 'auto' | 'popup' | 'redirect') => Promise<void>;
  signInWithGoogleRedirect: () => Promise<void>;
  signInWithGooglePopup: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  syncStatus: 'local',
  authError: null,
  setSyncStatus: () => {},
  clearAuthError: () => {},
  signInWithGoogle: async () => {},
  signInWithGoogleRedirect: async () => {},
  signInWithGooglePopup: async () => {},
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local');
  const [authError, setAuthError] = useState<AuthErrorInfo | null>(null);

  const parseAuthError = (err: any): AuthErrorInfo => {
    const code = err?.code || 'auth/unknown-error';
    const currentDomain = typeof window !== 'undefined' ? window.location.hostname : '';
    let message = err?.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ';
    let solution = '';

    if (code === 'auth/unauthorized-domain') {
      message = `โดเมน "${currentDomain}" ยังไม่ได้ถูกเพิ่มใน Authorized Domains ของ Firebase`;
      solution = `กรุณาเพิ่มโดเมน "${currentDomain}" ใน Firebase Console -> Authentication -> Settings -> Authorized Domains`;
    } else if (code === 'auth/popup-closed-by-user') {
      message = 'หน้าต่าง Popup เข้าสู่ระบบถูกปิดลงก่อนทำรายการเสร็จ';
      solution = 'สามารถลองกดเข้าสู่ระบบอีกครั้ง หรือเลือกวิธี "เปลี่ยนหน้าเว็บ (Redirect)" เพื่อความเสถียรยิ่งขึ้น';
    } else if (code === 'auth/popup-blocked') {
      message = 'เบราว์เซอร์บล็อกหน้าต่าง Popup เข้าสู่ระบบ';
      solution = 'กรุณาอนุญาต Pop-up ในเบราว์เซอร์ หรือกดใช้วิธี "เปลี่ยนหน้าเว็บ (Redirect)"';
    } else if (code === 'auth/cancelled-popup-request') {
      message = 'มีคำขอเข้าสู่ระบบซ้ำซ้อนหรือถูกยกเลิก';
      solution = 'กรุณารอสักครู่แล้วลองใหม่อีกครั้ง';
    }

    return {
      code,
      message,
      domain: currentDomain,
      solution,
    };
  };

  useEffect(() => {
    // 1. Process result from redirect login on page mount
    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) {
          setSyncStatus('saving');
          try {
            await syncUserProfile(result.user);
            setSyncStatus('synced');
          } catch (e) {
            console.error('Failed to sync profile after redirect login:', e);
            setSyncStatus('error');
          }
        }
      })
      .catch((error) => {
        console.error('Redirect sign-in error:', error);
        setAuthError(parseAuthError(error));
        setSyncStatus('error');
      });

    // 2. Auth state observer
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setSyncStatus('saving');
        setAuthError(null);
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

  const clearAuthError = () => {
    setAuthError(null);
  };

  // Google Sign-In with Redirect (Best for Mobile & strict popup blockers)
  const signInWithGoogleRedirect = async () => {
    setAuthError(null);
    setSyncStatus('saving');
    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (error: any) {
      console.error('signInWithRedirect failed:', error);
      setAuthError(parseAuthError(error));
      setSyncStatus('error');
      throw error;
    }
  };

  // Google Sign-In with Popup (Desktop standard)
  const signInWithGooglePopup = async () => {
    setAuthError(null);
    setSyncStatus('saving');
    try {
      const res = await signInWithPopup(auth, googleProvider);
      if (res.user) {
        await syncUserProfile(res.user);
        setSyncStatus('synced');
      }
    } catch (error: any) {
      console.error('signInWithPopup failed:', error);
      const parsed = parseAuthError(error);
      setAuthError(parsed);
      setSyncStatus('error');
      throw error;
    }
  };

  // Smart Google Sign-In (Auto-detects Mobile vs PC, with automatic fallback)
  const signInWithGoogle = async (method: 'auto' | 'popup' | 'redirect' = 'auto') => {
    setAuthError(null);

    // If explicit redirect or mobile device, use redirect
    if (method === 'redirect' || (method === 'auto' && isMobileDevice())) {
      return signInWithGoogleRedirect();
    }

    // Otherwise try popup first on desktop
    try {
      await signInWithGooglePopup();
    } catch (popupErr: any) {
      // If popup was blocked or closed by policy/COOP, attempt redirect fallback
      if (
        popupErr?.code === 'auth/popup-blocked' || 
        popupErr?.code === 'auth/popup-closed-by-user' ||
        popupErr?.code === 'auth/cancelled-popup-request'
      ) {
        console.warn('Popup interrupted, falling back to redirect flow...');
        return signInWithGoogleRedirect();
      }
      throw popupErr;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setAuthError(null);
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
        authError,
        setSyncStatus,
        clearAuthError,
        signInWithGoogle,
        signInWithGoogleRedirect,
        signInWithGooglePopup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
