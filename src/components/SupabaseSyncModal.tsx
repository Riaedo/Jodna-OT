import React, { useState, useEffect } from 'react';
import { 
  X, 
  Database, 
  Check, 
  Copy, 
  Laptop, 
  Smartphone, 
  Key, 
  ExternalLink, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  QrCode
} from 'lucide-react';
import { 
  getStoredSupabaseConfig, 
  saveStoredSupabaseConfig, 
  testSupabaseConnection, 
  SupabaseConfig 
} from '../lib/supabase';
import { getDeviceSyncUserId, setDeviceSyncUserId } from '../services/chatSyncService';

interface SupabaseSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigUpdated?: () => void;
}

export const SupabaseSyncModal: React.FC<SupabaseSyncModalProps> = ({
  isOpen,
  onClose,
  onConfigUpdated,
}) => {
  const [config, setConfig] = useState<SupabaseConfig>(getStoredSupabaseConfig());
  const [syncUserId, setSyncUserId] = useState(getDeviceSyncUserId());
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setConfig(getStoredSupabaseConfig());
      setSyncUserId(getDeviceSyncUserId());
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveConfig = () => {
    saveStoredSupabaseConfig(config);
    if (onConfigUpdated) onConfigUpdated();
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    const res = await testSupabaseConnection(config.url, config.anonKey);
    setIsTesting(false);
    setTestResult(res);
    if (res.ok) {
      saveStoredSupabaseConfig({ ...config, enabled: true });
      if (onConfigUpdated) onConfigUpdated();
    }
  };

  const shareableSyncUrl = `${window.location.origin}${window.location.pathname}?sync=${encodeURIComponent(syncUserId)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareableSyncUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(syncUserId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                ตั้งค่าการซิงค์ข้อมูล (PC ⟷ Mobile)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                จัดการฐานข้อมูล Cloud SQL และ Supabase (@supabase/supabase-js)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-xs sm:text-sm">
          
          {/* Card 1: Live Cloud Sync Status */}
          <div className="rounded-2xl p-4 bg-gradient-to-br from-indigo-50/80 to-purple-50/80 dark:from-indigo-950/40 dark:to-purple-950/40 border border-indigo-200/80 dark:border-indigo-800/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-bold text-indigo-900 dark:text-indigo-200">
                  ระบบคลาวด์ซิงค์แบบเรียลไทม์ (Cloud SQL PostgreSQL)
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px]">
                พร้อมใช้งาน
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              ฐานข้อมูล PostgreSQL ในภูมิภาค <strong>asia-southeast1</strong> พร้อมจัดเก็บประวัติการแชทอัตโนมัติ ช่วยให้คุณเปิดอ่านและคุยต่อได้ทันทีระหว่างคอมพิวเตอร์และมือถือ
            </p>

            {/* Quick Share Link between PC & Mobile */}
            <div className="pt-2 border-t border-indigo-200/60 dark:border-indigo-900/60">
              <label className="text-[11px] font-bold text-indigo-950 dark:text-indigo-300 block mb-1.5">
                ลิงก์เชื่อมต่อ PC 💻 ⟷ มือถือ 📱 (เปิดลิงก์นี้ในมือถือเพื่อซิงค์ทันที)
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  readOnly
                  value={shareableSyncUrl}
                  className="flex-1 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-700 dark:text-slate-200 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors shrink-0 shadow-sm"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์'}</span>
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>รหัส Sync ID ประจำเครื่อง: <strong className="font-mono text-indigo-600 dark:text-indigo-400">{syncUserId}</strong></span>
                <button onClick={handleCopyId} className="hover:underline text-indigo-600 dark:text-indigo-400">
                  {copiedId ? 'คัดลอกแล้ว' : 'คัดลอกรหัส'}
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: Supabase (@supabase/supabase-js) Integration */}
          <div className="rounded-2xl p-4 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-bold text-xs">
                  S
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-100">
                    เชื่อมต่อ Supabase (@supabase/supabase-js)
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    ทางเลือกเสริมสำหรับผู้ใช้ที่มีโปรเจกต์ Supabase เอง
                  </span>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={(e) => {
                    const updated = { ...config, enabled: e.target.checked };
                    setConfig(updated);
                    saveStoredSupabaseConfig(updated);
                  }}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Supabase Project URL
                </label>
                <input
                  type="url"
                  placeholder="https://xyzcompany.supabase.co"
                  value={config.url}
                  onChange={(e) => {
                    const updated = { ...config, url: e.target.value.trim() };
                    setConfig(updated);
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Supabase Public Anon Key
                </label>
                <input
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={config.anonKey}
                  onChange={(e) => {
                    const updated = { ...config, anonKey: e.target.value.trim() };
                    setConfig(updated);
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Test result message */}
              {testResult && (
                <div
                  className={`p-3 rounded-xl flex items-center gap-2 text-xs ${
                    testResult.ok
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                  }`}
                >
                  {testResult.ok ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <a
                  href="https://supabase.com/dashboard"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-slate-500 hover:text-emerald-600 flex items-center gap-1"
                >
                  <span>รับคีย์จาก Supabase Dashboard</span>
                  <ExternalLink className="w-3 h-3" />
                </a>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTesting || !config.url || !config.anonKey}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 font-semibold text-xs text-slate-700 dark:text-slate-200 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                    <span>{isTesting ? 'กำลังทดสอบ...' : 'ทดสอบการเชื่อมต่อ'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleSaveConfig();
                      onClose();
                    }}
                    className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-semibold text-xs text-white transition-colors shadow-sm"
                  >
                    บันทึก
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 text-white font-medium text-xs transition-colors"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
