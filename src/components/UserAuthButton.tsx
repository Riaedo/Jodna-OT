import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  AlertCircle, 
  LogOut, 
  User as UserIcon, 
  ShieldCheck,
  ChevronDown
} from 'lucide-react';

export const UserAuthButton: React.FC = () => {
  const { user, loading, syncStatus, signInWithGoogle, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logout();
      setIsOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="h-8 w-8 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
    );
  }

  if (!user) {
    return (
      <button
        onClick={handleSignIn}
        disabled={isSigningIn}
        title="เข้าสู่ระบบด้วย Google เพื่อซิงค์ข้อมูลบน Cloud (Firebase)"
        className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 shadow-sm text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs font-bold transition-all active:scale-95 shrink-0"
      >
        {isSigningIn ? (
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-500" />
        ) : (
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
        )}
        <span className="hidden sm:inline">เข้าสู่ระบบ</span>
      </button>
    );
  }

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 p-1 sm:px-2 sm:py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 transition-all text-xs"
        title={user.displayName || user.email || 'บัญชีผู้ใช้'}
      >
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName || 'Avatar'}
            className="w-6 h-6 rounded-lg object-cover ring-1 ring-indigo-500/30"
          />
        ) : (
          <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px]">
            {(user.displayName?.[0] || user.email?.[0] || 'U').toUpperCase()}
          </div>
        )}

        <div className="hidden md:flex flex-col text-left leading-none">
          <span className="font-bold text-[11px] text-slate-800 dark:text-slate-100 truncate max-w-[80px]">
            {user.displayName?.split(' ')[0] || 'ผู้ใช้'}
          </span>
          <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
            <Cloud className="w-2.5 h-2.5" />
            <span>ซิงค์แล้ว</span>
          </span>
        </div>

        <ChevronDown className="w-3 h-3 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-10 mt-1.5 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-3 z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md">
          {/* User info */}
          <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-100 dark:border-slate-800">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt=""
                className="w-9 h-9 rounded-xl object-cover ring-2 ring-indigo-500/20"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                {(user.displayName?.[0] || user.email?.[0] || 'U').toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h5 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {user.displayName || 'ผู้ใช้ Google'}
              </h5>
              <p className="text-[10px] text-slate-400 truncate">
                {user.email}
              </p>
            </div>
          </div>

          {/* Sync status detail */}
          <div className="py-2.5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">สถานะคลาวด์:</span>
              {syncStatus === 'synced' && (
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  <ShieldCheck className="w-3 h-3" />
                  ซิงค์แบบเรียลไทม์
                </span>
              )}
              {syncStatus === 'saving' && (
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  กำลังบันทึก...
                </span>
              )}
              {syncStatus === 'error' && (
                <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-800">
                  <AlertCircle className="w-3 h-3" />
                  ข้อผิดพลาด
                </span>
              )}
              {syncStatus === 'local' && (
                <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                  <CloudOff className="w-3 h-3" />
                  ในเครื่อง
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
              ข้อมูลสถิติ โอที และการตั้งค่าถูกเข้ารหัสและบันทึกลง Google Firebase อย่างปลอดภัย
            </p>
          </div>

          {/* Sign out button */}
          <button
            onClick={handleSignOut}
            className="w-full mt-2 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>ออกจากระบบ</span>
          </button>
        </div>
      )}
    </div>
  );
};
