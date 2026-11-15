import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
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

type BeforeLogoutCallback = (uid: string | null) => void;

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
  registerBeforeLogout: (cb: BeforeLogoutCallback) => () => void;
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
  registerBeforeLogout: () => () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local');
  const [authError, setAuthError] = useState<AuthErrorInfo | null>(null);

  // Monotonic sequence counter to invalidate stale async auth operations across logout / account switch
  const authSeqRef = useRef(0);
  const beforeLogoutCallbacksRef = useRef<Set<BeforeLogoutCallback>>(new Set());

  const registerBeforeLogout = useCallback((cb: BeforeLogoutCallback) => {
    beforeLogoutCallbacksRef.current.add(cb);
    return () => {
      beforeLogoutCallbacksRef.current.delete(cb);
    };
  }, []);

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
    let isMounted = true;

    // 1. Process result from redirect login on page mount
    const redirectSeq = authSeqRef.current;
    getRedirectResult(auth)
      .then(async (result) => {
        if (!isMounted) return;
        if (result?.user) {
          const targetUid = result.user.uid;
          if (auth.currentUser?.uid !== targetUid || authSeqRef.current !== redirectSeq) {
            return;
          }
          setSyncStatus(typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'saving');
          try {
            await syncUserProfile(result.user);
            if (!isMounted || auth.currentUser?.uid !== targetUid || authSeqRef.current !== redirectSeq) {
              return;
            }
            setSyncStatus(typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'synced');
          } catch (e) {
            console.error('Failed to sync profile after redirect login:', e);
            if (!isMounted || auth.currentUser?.uid !== targetUid || authSeqRef.current !== redirectSeq) {
              return;
            }
            setSyncStatus(typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'error');
          }
        }
      })
      .catch((error) => {
        if (!isMounted) return;
        console.error('Redirect sign-in error:', error);
        setAuthError(parseAuthError(error));
        setSyncStatus('error');
      });

    // 2. Auth state observer
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!isMounted) return;
      const seq = ++authSeqRef.current;
      setUser(currentUser);

      if (currentUser) {
        const targetUid = currentUser.uid;
        const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
        setSyncStatus(isOffline ? 'offline' : 'saving');
        setAuthError(null);
        try {
          if (!isOffline) {
            await syncUserProfile(currentUser);
          }
          if (!isMounted || authSeqRef.current !== seq || auth.currentUser?.uid !== targetUid) {
            return;
          }
          setSyncStatus(typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'synced');
        } catch (e) {
          console.error('Failed to sync user profile:', e);
          if (!isMounted || authSeqRef.current !== seq || auth.currentUser?.uid !== targetUid) {
            return;
          }
          setSyncStatus(typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'error');
        }
      } else {
        setSyncStatus('local');
      }
      if (isMounted && authSeqRef.current === seq) {
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
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
        const targetUid = res.user.uid;
        const seq = authSeqRef.current;
        await syncUserProfile(res.user);
        if (authSeqRef.current === seq && auth.currentUser?.uid === targetUid) {
          setSyncStatus('synced');
        }
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
    const previousUid = auth.currentUser?.uid ?? user?.uid ?? null;
    // Invalidate all in-flight async auth work immediately
    authSeqRef.current += 1;

    // Synchronously flush pending timers/offline queue & wipe UI/local display state
    beforeLogoutCallbacksRef.current.forEach((cb) => {
      try {
        cb(previousUid);
      } catch (e) {
        console.error('Error in beforeLogout callback:', e);
      }
    });

    setUser(null);
    setAuthError(null);
    setSyncStatus('local');

    try {
      await signOut(auth);
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
        registerBeforeLogout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
