import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize Google GenAI client (Server-side only)
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    geminiConfigured: !!process.env.GEMINI_API_KEY,
  });
});

interface ChatMessageInput {
  role: 'user' | 'assistant' | 'model' | 'system';
  content: string;
}

// Generate Chat Response
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { messages, systemInstruction, model } = req.body as {
      messages: ChatMessageInput[];
      systemInstruction?: string;
      model?: string;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    // Format messages for Google GenAI SDK
    // Filter out system messages from history if any, and map assistant -> model
    const filteredMessages = messages.filter((m) => m.role !== 'system');
    const contents = filteredMessages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content || '' }],
    }));

    const targetModel = model && ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.5-pro'].includes(model)
      ? model
      : 'gemini-3.8-flash';

    const response = await ai.models.generateContent({
      model: targetModel,
      contents,
      config: {
        systemInstruction: systemInstruction || 'คุณคือผู้ช่วย AI อัจฉริยะ (Gemini) ที่ตอบคำถามได้อย่างเป็นมิตร ละเอียด ถูกต้อง ชัดเจน พร้อมจัดรูปแบบ Markdown ที่สวยงาม อ่านง่าย รองรับการเขียนโค้ดและภาษาไทยอย่างยอดเยี่ยม',
      },
    });

    const outputText = response.text || '';
    return res.json({ text: outputText });
  } catch (err: any) {
    console.error('Error in /api/chat:', err);
    return res.status(500).json({
      error: err?.message || 'Failed to generate response from Gemini',
    });
  }
});

// Auto-generate conversation title
app.post('/api/chat/title', async (req: Request, res: Response) => {
  try {
    const { firstMessage } = req.body as { firstMessage: string };
    if (!firstMessage) {
      return res.json({ title: 'บทสนทนาใหม่' });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `ช่วยตั้งชื่อหัวข้อบทสนทนาสั้นๆ (ไม่เกิน 5-6 คำ ไม่ต้องมีเครื่องหมายคำพูด) ให้กับข้อความนี้:\n"${firstMessage.slice(0, 300)}"`,
      config: {
        systemInstruction: 'คุณคือผู้ช่วยตั้งชื่อหัวข้อบทสนทนา ให้ตอบเฉพาะชื่อหัวข้อสั้นๆ เท่านั้น ไม่ต้องมีคำอธิบายเพิ่มเติม',
      },
    });

    const title = (response.text || '').trim().replace(/^["']|["']$/g, '') || 'บทสนทนาใหม่';
    return res.json({ title });
  } catch (err) {
    console.error('Error generating title:', err);
    return res.json({ title: 'บทสนทนาใหม่' });
  }
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
