import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

// POST /api/telegram/send - send a Telegram message using the bot tokens
router.post('/send', requireAuth(), async (req, res) => {
  const { chatId, message, botType = 'client' } = req.body;
  if (!chatId || !message) {
    return res.status(400).json({ error: "Missing chatId or message" });
  }

  const internalToken = process.env.TELEGRAM_BOT_TOKEN_INTERNAL;
  const clientToken = process.env.TELEGRAM_BOT_TOKEN_CLIENT;

  let token = botType === 'internal' ? internalToken : clientToken;

  if (!token) {
    console.warn(`Token for botType ${botType} not configured. Falling back to the other bot if available.`);
    token = internalToken || clientToken;
    if (!token) {
      return res.status(500).json({ error: "No Telegram bot tokens configured" });
    }
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' })
    });
    
    const data: any = await response.json();
    if (!data.ok) {
      return res.status(data.error_code || 500).json({
        ok: false,
        error: data.description || "Telegram API Error"
      });
    }
    return res.json({ ok: true });
  } catch (error: any) {
    console.error("Failed to send telegram notification via route:", error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
