import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { db } from './src/db/index.ts';
import { chatSessions, chatMessages, users } from './src/db/schema.ts';
import { eq, desc, and } from 'drizzle-orm';
import { optionalAuth, AuthRequest } from './src/middleware/auth.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Body parsers
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Initialize Google GenAI client (reads GEMINI_API_KEY from environment)
const ai = new GoogleGenAI();

// ----------------------------------------------------
// User Profile Sync Endpoint
// ----------------------------------------------------
app.post('/api/users/sync', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { email, displayName, photoUrl } = req.body;
    const uid = req.effectiveUserId;

    if (!uid) {
      return res.status(400).json({ error: 'Missing user identification' });
    }

    const existing = await db.select().from(users).where(eq(users.uid, uid)).limit(1);

    if (existing.length === 0) {
      await db.insert(users).values({
        uid,
        email: email || `${uid}@guest.app`,
        displayName: displayName || 'ผู้ใช้งาน',
        photoUrl: photoUrl || null,
      });
    } else {
      await db.update(users).set({
        email: email || existing[0].email,
        displayName: displayName || existing[0].displayName,
        photoUrl: photoUrl || existing[0].photoUrl,
        updatedAt: new Date(),
      }).where(eq(users.uid, uid));
    }

    res.json({ ok: true, uid });
  } catch (err: any) {
    console.error('Failed to sync user:', err);
    res.status(500).json({ error: 'Failed to sync user record' });
  }
});

// ----------------------------------------------------
// Chat Sessions Endpoints
// ----------------------------------------------------
app.get('/api/chat/sessions', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.effectiveUserId || 'default_guest_user';
    const sessions = await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.userId, uid))
      .orderBy(desc(chatSessions.pinned), desc(chatSessions.updatedAt));

    res.json(sessions);
  } catch (err: any) {
    console.error('Failed to fetch chat sessions:', err);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

app.post('/api/chat/sessions', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.effectiveUserId || 'default_guest_user';
    const { id, title, model, systemInstruction, pinned } = req.body;

    const newId = id || `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    await db.insert(chatSessions).values({
      id: newId,
      userId: uid,
      title: title || 'การสนทนาใหม่',
      model: model || 'gemini-2.5-flash',
      systemInstruction: systemInstruction || null,
      pinned: Boolean(pinned),
    });

    const created = await db.select().from(chatSessions).where(eq(chatSessions.id, newId)).limit(1);
    res.json(created[0]);
  } catch (err: any) {
    console.error('Failed to create session:', err);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

app.put('/api/chat/sessions/:id', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const uid = req.effectiveUserId || 'default_guest_user';
    const { title, pinned, model, systemInstruction } = req.body;

    const updateData: any = { updatedAt: new Date() };
    if (title !== undefined) updateData.title = title;
    if (pinned !== undefined) updateData.pinned = pinned;
    if (model !== undefined) updateData.model = model;
    if (systemInstruction !== undefined) updateData.systemInstruction = systemInstruction;

    await db
      .update(chatSessions)
      .set(updateData)
      .where(and(eq(chatSessions.id, id), eq(chatSessions.userId, uid)));

    res.json({ ok: true });
  } catch (err: any) {
    console.error('Failed to update session:', err);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

app.delete('/api/chat/sessions/:id', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const uid = req.effectiveUserId || 'default_guest_user';

    // Delete cascading messages and session
    await db.delete(chatMessages).where(eq(chatMessages.sessionId, id));
    await db.delete(chatSessions).where(and(eq(chatSessions.id, id), eq(chatSessions.userId, uid)));

    res.json({ ok: true });
  } catch (err: any) {
    console.error('Failed to delete session:', err);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// ----------------------------------------------------
// Chat Messages Endpoints
// ----------------------------------------------------
app.get('/api/chat/sessions/:id/messages', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, id))
      .orderBy(chatMessages.createdAt);

    res.json(messages);
  } catch (err: any) {
    console.error('Failed to fetch messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.post('/api/chat/sessions/:id/messages', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { id: sessionId } = req.params;
    const uid = req.effectiveUserId || 'default_guest_user';
    const { id, role, content, imageUrl, thinking } = req.body;

    if (!role || !content) {
      return res.status(400).json({ error: 'Role and content are required' });
    }

    const msgId = id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    await db.insert(chatMessages).values({
      id: msgId,
      sessionId,
      userId: uid,
      role,
      content,
      imageUrl: imageUrl || null,
      thinking: thinking || null,
    });

    // Touch session updatedAt
    await db
      .update(chatSessions)
      .set({ updatedAt: new Date() })
      .where(eq(chatSessions.id, sessionId));

    res.json({ ok: true, id: msgId });
  } catch (err: any) {
    console.error('Failed to save message:', err);
    res.status(500).json({ error: 'Failed to save message' });
  }
});

app.delete('/api/chat/sessions/:id/messages', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { id: sessionId } = req.params;
    await db.delete(chatMessages).where(eq(chatMessages.sessionId, sessionId));
    res.json({ ok: true });
  } catch (err: any) {
    console.error('Failed to clear messages:', err);
    res.status(500).json({ error: 'Failed to clear messages' });
  }
});

// ----------------------------------------------------
// Gemini Streaming API Route
// ----------------------------------------------------
app.post('/api/gemini/stream', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { messages, model, systemInstruction, imageBase64, imageMimeType } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const targetModel = model || 'gemini-2.5-flash';

    // Format contents for @google/genai SDK
    const contents: any[] = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const isLatestUserMessage = i === messages.length - 1 && msg.role === 'user';

      if (isLatestUserMessage && imageBase64 && imageMimeType) {
        // Multi-modal message with image
        contents.push({
          role: 'user',
          parts: [
            {
              inlineData: {
                data: imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, ''),
                mimeType: imageMimeType,
              },
            },
            {
              text: msg.content,
            },
          ],
        });
      } else {
        contents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }],
        });
      }
    }

    // Set headers for Server-Sent Events (SSE)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const responseStream = await ai.models.generateContentStream({
      model: targetModel,
      contents,
      config: {
        systemInstruction: systemInstruction || 'คุณคือผู้ช่วยอัจฉริยะ Gemini ที่ตอบคำถามอย่างเป็นประโยชน์ ถูกต้อง ละเอียด และเป็นมิตร ใช้ภาษาไทยเป็นหลักและจัดรูปแบบคำตอบด้วย Markdown อย่างสวยงาม',
      },
    });

    for await (const chunk of responseStream) {
      const text = chunk.text;
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err: any) {
    console.error('Error generating Gemini response stream:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err?.message || 'Gemini API stream failed' });
    } else {
      res.write(`data: ${JSON.stringify({ error: err?.message || 'Error occurred during streaming' })}\n\n`);
      res.end();
    }
  }
});

// ----------------------------------------------------
// Health and Config Check
// ----------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    cloudSql: Boolean(process.env.SQL_HOST),
    database: process.env.SQL_DB_NAME || 'default',
    timestamp: new Date().toISOString(),
  });
});

// ----------------------------------------------------
// Vite Development or Production Static Serving
// ----------------------------------------------------
const isProduction = process.env.NODE_ENV === 'production';

if (!isProduction) {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Gemini Chat & Sync Server running on http://0.0.0.0:${PORT}`);
});
