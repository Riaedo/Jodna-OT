import React, { useState } from 'react';
import { X, Smartphone, Monitor, Copy, Check, RefreshCw, ArrowRight, Share2, Sparkles } from 'lucide-react';
import { generateSyncId, saveSupabaseConfig } from '../lib/supabase';

interface SyncDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSyncId: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  onSyncIdChanged: (newSyncId: string) => void;
}

export const SyncDeviceModal: React.FC<SyncDeviceModalProps> = ({
  isOpen,
  onClose,
  currentSyncId,
  supabaseUrl,
  supabaseAnonKey,
  onSyncIdChanged,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [inputSyncId, setInputSyncId] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  if (!isOpen) return null;

  // Generate mobile direct link
  const generatePairUrl = () => {
    const origin = window.location.origin + window.location.pathname;
    const params = new URLSearchParams();
    params.set('sync_id', currentSyncId);
    if (supabaseUrl) params.set('sb_url', supabaseUrl);
    if (supabaseAnonKey) params.set('sb_key', supabaseAnonKey);
    return `${origin}?${params.toString()}`;
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(currentSyncId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(generatePairUrl());
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleGenerateNew = () => {
    const newId = generateSyncId();
    saveSupabaseConfig(supabaseUrl, supabaseAnonKey, newId);
    onSyncIdChanged(newId);
    setStatusMsg('สร้างรหัส Sync ใหม่เรียบร้อยแล้ว');
    setTimeout(() => setStatusMsg(''), 3000);
  };

  const handleSwitchSyncId = () => {
    const cleanId = inputSyncId.trim().toUpperCase();
    if (!cleanId) return;

    saveSupabaseConfig(supabaseUrl, supabaseAnonKey, cleanId);
    onSyncIdChanged(cleanId);
    setInputSyncId('');
    setStatusMsg(`สลับไปยังรหัส ${cleanId} เรียบร้อยแล้ว`);
    setTimeout(() => {
      setStatusMsg('');
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <div className="flex items-center -space-x-1">
                <Monitor className="w-4 h-4" />
                <Smartphone className="w-4 h-4 text-indigo-300" />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">ซิงค์ข้ามอุปกรณ์ PC & มือถือ</h2>
              <p className="text-xs text-slate-400">ใช้รหัสเดียวกันเพื่อแชร์ประวัติแชทแบบ Real-time</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 text-sm">
          {/* Current Device Sync Code Box */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                รหัสซิงค์ของเครื่องนี้ (Sync ID)
              </span>
              <button
                onClick={handleGenerateNew}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-300 transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                สุ่มรหัสใหม่
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-800/80 border border-indigo-500/30 flex items-center justify-between shadow-inner">
              <div>
                <span className="font-mono text-xl font-bold tracking-wider text-indigo-400">
                  {currentSyncId}
                </span>
                <p className="text-xs text-slate-400 mt-0.5">นำรหัสนี้ไปใส่ในมือถือ หรือเครื่อง PC อื่น</p>
              </div>
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition cursor-pointer"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-4 h-4" />
                    คัดลอกแล้ว
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    คัดลอกรหัส
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Share Link for Mobile */}
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Share2 className="w-3.5 h-3.5 text-indigo-400" />
                ลิงก์สำหรับเปิดบนมือถือ (Auto-Connect)
              </span>
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium transition cursor-pointer"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    คัดลอกลิงก์แล้ว!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    คัดลอกลิงก์
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              ส่งลิงก์นี้เข้าแชท/ไลน์แล้วกดเปิดบนมือถือ ระบบจะตั้งค่า Supabase และรหัสซิงค์ให้ทันทีโดยอัตโนมัติ
            </p>
          </div>

          {/* Connect to another existing Sync ID */}
          <div className="pt-2 border-t border-slate-800">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              มีรหัส Sync จากเครื่องอื่นอยู่แล้วหรือไม่?
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputSyncId}
                onChange={(e) => setInputSyncId(e.target.value.toUpperCase())}
                placeholder="เช่น SYNC-9AB2-4K8P"
                className="flex-1 px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono text-xs uppercase transition"
              />
              <button
                onClick={handleSwitchSyncId}
                disabled={!inputSyncId.trim()}
                className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
              >
                เชื่อมต่อ
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {statusMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <Sparkles className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{statusMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-slate-800 bg-slate-900/90">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition cursor-pointer"
          >
            เสร็จสิ้น
          </button>
        </div>
      </div>
    </div>
  );
};
