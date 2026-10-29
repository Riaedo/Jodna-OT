export const SUPABASE_SQL_SCHEMA = `-- ============================================================
-- Supabase Schema for Gemini Chat History & Multi-Device Sync
-- สามารถคัดลอกโค้ดนี้ไปรันใน Supabase -> SQL Editor ได้ทันที
-- ============================================================

-- 1. สร้างตาราง chat_sessions (ประวัติบทสนทนา)
CREATE TABLE IF NOT EXISTS public.chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_sync_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT 'บทสนทนาใหม่',
    model TEXT NOT NULL DEFAULT 'gemini-3.8-flash',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. สร้างตาราง chat_messages (ข้อความในแต่ละห้องแชท)
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    user_sync_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. สร้าง Index เพื่อให้ดึงข้อมูลได้รวดเร็ว
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_sync_id 
    ON public.chat_sessions(user_sync_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id 
    ON public.chat_messages(session_id, created_at ASC);

-- 4. ตั้งค่าสิทธิ์ Row Level Security (RLS) ให้อ่านและเขียนผ่าน Anon Key ได้
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- ลบนโยบายเดิมหากมีอยู่แล้ว
DROP POLICY IF EXISTS "Allow anon all on chat_sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Allow anon all on chat_messages" ON public.chat_messages;

-- อนุญาตให้อ่านและบันทึกข้อมูลได้ตาม user_sync_id
CREATE POLICY "Allow anon all on chat_sessions" 
    ON public.chat_sessions FOR ALL 
    USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon all on chat_messages" 
    ON public.chat_messages FOR ALL 
    USING (true) WITH CHECK (true);

-- 5. เปิดใช้งาน Realtime เพื่อให้ข้อมูลเด้งซิงค์ระหว่าง PC และ มือถือ ทันที
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
`;
