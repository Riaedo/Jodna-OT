import React, { useState } from 'react';
import { X, Database, Check, AlertCircle, Copy, Loader2, ExternalLink, Code2 } from 'lucide-react';
import { saveSupabaseConfig, testSupabaseConnection } from '../lib/supabase';
import { SUPABASE_SQL_SCHEMA } from '../utils/supabaseSchema';

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUrl: string;
  currentAnonKey: string;
  currentSyncId: string;
  onConfigSaved: (url: string, anonKey: string) => void;
}

export const SupabaseModal: React.FC<SupabaseModalProps> = ({
  isOpen,
  onClose,
  currentUrl,
  currentAnonKey,
  currentSyncId,
  onConfigSaved,
}) => {
  const [url, setUrl] = useState(currentUrl);
  const [anonKey, setAnonKey] = useState(currentAnonKey);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedSchema, setCopiedSchema] = useState(false);
  const [activeTab, setActiveTab] = useState<'settings' | 'sql'>('settings');

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    const result = await testSupabaseConnection(url, anonKey);
    setIsTesting(false);
    setTestResult(result);
  };

  const handleSave = () => {
    saveSupabaseConfig(url, anonKey, currentSyncId);
    onConfigSaved(url, anonKey);
    onClose();
  };

  const handleCopySchema = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopiedSchema(true);
    setTimeout(() => setCopiedSchema(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">ตั้งค่าการเชื่อมต่อ Supabase</h2>
              <p className="text-xs text-slate-400">ซิงค์ประวัติแชท Real-time ข้ามอุปกรณ์ PC & มือถือ</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab buttons */}
        <div className="flex border-b border-slate-800 px-6 pt-2 bg-slate-900/50">
          <button
            onClick={() => setActiveTab('settings')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'settings'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-4 h-4" />
            เชื่อมต่อ Credentials
          </button>
          <button
            onClick={() => setActiveTab('sql')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'sql'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-4 h-4" />
            SQL Schema ตารางข้อมูล
          </button>
        </div>

        {/* Content body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {activeTab === 'settings' ? (
            <>
              <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4 text-xs text-slate-300 leading-relaxed">
                <p className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  วิธีหา Supabase URL และ Anon Key:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-slate-300 pl-1">
                  <li>เข้าสู่ระบบ Supabase Dashboard ที่โปรเจกต์ของคุณ</li>
                  <li>ไปที่เมนู <strong>Project Settings</strong> (รูปฟันเฟือง) &gt; <strong>API</strong></li>
                  <li>คัดลอก <strong>Project URL</strong> และ <strong>anon / public key</strong> มาวางด้านล่าง</li>
                </ol>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Project URL <span className="text-emerald-400">*</span>
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://xxxxxxxxxxxxxxxxxxxx.supabase.co"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono text-xs transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Anon / Public Key <span className="text-emerald-400">*</span>
                </label>
                <textarea
                  value={anonKey}
                  onChange={(e) => setAnonKey(e.target.value)}
                  rows={3}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono text-xs transition resize-none"
                />
              </div>

              {testResult && (
                <div
                  className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
                    testResult.success
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
                >
                  {testResult.success ? (
                    <Check className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  )}
                  <span className="leading-relaxed">{testResult.message}</span>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-300">
                  รันคำสั่ง SQL นี้เพียงครั้งเดียวใน Supabase SQL Editor เพื่อสร้างตารางและเปิด Realtime
                </p>
                <button
                  onClick={handleCopySchema}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition cursor-pointer"
                >
                  {copiedSchema ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      คัดลอก SQL แล้ว!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      คัดลอก SQL ทั้งหมด
                    </>
                  )}
                </button>
              </div>

              <div className="relative rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-300 max-h-72 overflow-y-auto leading-relaxed">
                <pre>{SUPABASE_SQL_SCHEMA}</pre>
              </div>

              <div className="text-xs text-slate-400 flex items-center gap-2">
                <span>ตารางที่สร้าง:</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono">chat_sessions</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono">chat_messages</span>
                <span className="text-emerald-400">✓ รองรับ Realtime</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/90">
          <button
            onClick={handleTestConnection}
            disabled={isTesting || !url || !anonKey}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-medium border border-slate-700 transition cursor-pointer"
          >
            {isTesting ? <Loader2 className="w-4 h-4 animate-spin text-emerald-400" /> : <Database className="w-4 h-4 text-emerald-400" />}
            ทดสอบการเชื่อมต่อ
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-medium transition cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 transition cursor-pointer"
            >
              บันทึกและเชื่อมต่อ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
