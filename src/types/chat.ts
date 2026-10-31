export type Role = 'user' | 'model' | 'system';

export interface ChatMessage {
  id: string;
  sessionId: string;
  userId?: string;
  role: Role;
  content: string;
  imageUrl?: string | null;
  thinking?: string | null;
  createdAt?: string | Date;
}

export interface ChatSession {
  id: string;
  userId?: string;
  title: string;
  model: string;
  systemInstruction?: string | null;
  pinned?: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface GeminiModelInfo {
  id: string;
  name: string;
  description: string;
  badge?: string;
  isDefault?: boolean;
  multimodal: boolean;
}

export const AVAILABLE_MODELS: GeminiModelInfo[] = [
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'รวดเร็ว ฉลาดรอบด้าน เหมาะกับการใช้งานทั่วไปและเขียนโค้ด',
    badge: 'แนะนำ',
    isDefault: true,
    multimodal: true,
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    description: 'ความแม่นยำสูง เหมาะกับการวิเคราะห์เชิงลึกและงานซับซ้อน',
    badge: 'Pro',
    multimodal: true,
  },
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    description: 'โมเดลรุ่นใหม่ความเร็วสูงพิเศษ ประสิทธิภาพยอดเยี่ยม',
    badge: 'เร็วที่สุด',
    multimodal: true,
  },
];

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}
