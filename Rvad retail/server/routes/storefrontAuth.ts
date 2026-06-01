/**
 * storefrontAuth.ts
 * Customer-facing auth routes (phone + password → JWT).
 * Completely separate from the employee PIN-based system.
 *
 * Routes:
 *   POST /api/storefront/auth/register  — create new customer account
 *   POST /api/storefront/auth/login     — login, returns JWT + profile
 *   GET  /api/storefront/auth/me        — get current customer profile (requires customer JWT)
 */

import { Router } from 'express';
import { db } from '../db/connection';
import { customers } from '../db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { sendTelegramMessage } from '../telegram/internal';

const router = Router();

const JWT_SECRET =
  process.env.JWT_SECRET ||
  '4f63c8a9134b22c7128d546ef81a4b6c321d54f67e89ab0c210d3e5b6c7a8d9e';

function normalizePhone(p: string): string {
  let clean = p.replace(/\D/g, '');
  if (clean.startsWith('8') && clean.length === 11) {
    clean = '7' + clean.slice(1);
  }
  return clean;
}

// ─── POST /api/storefront/auth/register ────────────────────────────────────
// Body: { name, phone, password }
router.post('/register', async (req, res) => {
  const { name, phone, password } = req.body;

  if (!name || !phone || !password) {
    return res.status(400).json({ error: 'name, phone и password обязательны.' });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: 'Пароль должен быть не менее 4 символов.' });
  }

  try {
    const phoneClean = normalizePhone(phone);
    const allCust = await db.select().from(customers);
    const existingCustomer = allCust.find(c => normalizePhone(c.phone) === phoneClean);

    if (existingCustomer) {
      const customer = existingCustomer;
      // If customer exists but has no password hash, they are an existing customer setting their password for the first time
      if (!customer.passwordHash) {
        const passwordHash = await bcrypt.hash(password, 10);
        await db.update(customers)
          .set({ passwordHash, name: name || customer.name })
          .where(eq(customers.id, customer.id));

        const token = jwt.sign({ customerId: customer.id, name: customer.name, phone: customer.phone }, JWT_SECRET, {
          expiresIn: '30d',
        });

        return res.status(200).json({
          token,
          customer: {
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
            debt: customer.debt,
            debtLimit: customer.debtLimit,
            discountPercent: customer.discountPercent,
            telegramLinked: !!customer.telegramChatId,
          },
        });
      }

      return res
        .status(409)
        .json({ error: 'Клиент с таким телефоном уже зарегистрирован.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const id = `cust-sf-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    await db.insert(customers).values({
      id,
      name,
      phone,
      passwordHash,
      debt: 0,
      debtLimit: 50000,
      discountPercent: 0,
      notes: null,
      telegramChatId: null,
    });

    const token = jwt.sign({ customerId: id, name, phone }, JWT_SECRET, {
      expiresIn: '30d',
    });

    return res.status(201).json({
      token,
      customer: {
        id,
        name,
        phone,
        debt: 0,
        debtLimit: 50000,
        discountPercent: 0,
        telegramLinked: false,
      },
    });
  } catch (error: any) {
    console.error('[storefrontAuth] register error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

// Store verification codes in memory: phoneClean -> { code, expires }
export const resetCodes = new Map<string, { code: string; expires: number }>();

// ─── POST /api/storefront/auth/request-reset ────────────────────────────────
// Body: { phone }
router.post('/request-reset', async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'phone обязателен.' });
  }

  try {
    const phoneClean = normalizePhone(phone);
    const allCust = await db.select().from(customers);
    const customer = allCust.find(c => normalizePhone(c.phone) === phoneClean);

    if (!customer) {
      return res.status(404).json({ error: 'Клиент с таким номером телефона не найден.' });
    }

    // Generate random 4-digit code
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    resetCodes.set(phoneClean, { code, expires: Date.now() + 10 * 60 * 1000 });

    if (customer.telegramChatId) {
      // Send code via bot
      const clientToken = process.env.TELEGRAM_BOT_TOKEN_CLIENT;
      if (clientToken) {
        const replyText = `🔑 <b>Код подтверждения для сброса пароля:</b> <code>${code}</code>\n\n` +
                          `Используйте его на сайте магазина "1000 Мелочей" для установки нового пароля.`;
        await sendTelegramMessage(clientToken, Number(customer.telegramChatId), replyText);
      }
      return res.json({ success: true, telegramLinked: true });
    } else {
      return res.json({ success: true, telegramLinked: false });
    }
  } catch (error: any) {
    console.error('[storefrontAuth] request-reset error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/storefront/auth/reset-password ──────────────────────────────
// Body: { phone, code, password }
router.post('/reset-password', async (req, res) => {
  const { phone, code, password } = req.body;

  if (!phone || !code || !password) {
    return res.status(400).json({ error: 'phone, code и password обязательны.' });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: 'Пароль должен быть не менее 4 символов.' });
  }

  try {
    const phoneClean = normalizePhone(phone);
    const record = resetCodes.get(phoneClean);

    if (!record || record.code !== code.trim() || record.expires < Date.now()) {
      return res.status(400).json({ error: 'Неверный или истекший код подтверждения.' });
    }

    const allCust = await db.select().from(customers);
    const customer = allCust.find(c => normalizePhone(c.phone) === phoneClean);

    if (!customer) {
      return res.status(404).json({ error: 'Клиент с таким номером телефона не найден.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await db.update(customers)
      .set({ passwordHash })
      .where(eq(customers.id, customer.id));

    resetCodes.delete(phoneClean);

    return res.json({ success: true });
  } catch (error: any) {
    console.error('[storefrontAuth] reset-password error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/storefront/auth/login ───────────────────────────────────────
// Body: { phone, password }
router.post('/login', async (req, res) => {
  const { phone, password } = req.body;

  if (!phone || !password) {
    return res.status(400).json({ error: 'phone и password обязательны.' });
  }

  try {
    const phoneClean = normalizePhone(phone);
    const allCust = await db.select().from(customers);
    const customer = allCust.find(c => normalizePhone(c.phone) === phoneClean);

    if (!customer) {
      return res.status(401).json({ error: 'Клиент не найден.' });
    }

    // Customer was added by employees before storefront existed — no password hash
    if (!customer.passwordHash) {
      return res.status(401).json({
        error:
          'Учётная запись создана администратором без пароля. Пожалуйста, пройдите регистрацию для установки пароля.',
      });
    }

    const match = await bcrypt.compare(password, customer.passwordHash);
    if (!match) {
      return res.status(401).json({ error: 'Неверный пароль.' });
    }

    const token = jwt.sign(
      { customerId: customer.id, name: customer.name, phone: customer.phone },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    return res.json({
      token,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        debt: customer.debt,
        debtLimit: customer.debtLimit,
        discountPercent: customer.discountPercent,
        telegramLinked: !!customer.telegramChatId,
      },
    });
  } catch (error: any) {
    console.error('[storefrontAuth] login error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

// ─── GET /api/storefront/auth/me ────────────────────────────────────────────
// Requires: Authorization: Bearer <customer-jwt>
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Не авторизован.' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { customerId: string };

    const list = await db
      .select()
      .from(customers)
      .where(eq(customers.id, decoded.customerId));

    if (list.length === 0) {
      return res.status(404).json({ error: 'Клиент не найден.' });
    }

    const c = list[0];
    return res.json({
      customer: {
        id: c.id,
        name: c.name,
        phone: c.phone,
        debt: c.debt,
        debtLimit: c.debtLimit,
        discountPercent: c.discountPercent,
        telegramLinked: !!c.telegramChatId,
      }
    });
  } catch (error: any) {
    return res.status(401).json({ error: 'Токен недействителен или истёк.' });
  }
});

export default router;
